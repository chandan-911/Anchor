import json
import csv
import datetime
from django.db.models import Avg, Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import GrowthReport, Goal
from .serializers import GrowthReportSerializer
from journal.models import JournalEntry
from decisions.models import Decision
from opportunities.models import Opportunity
from anchor_project.gemini import query_gemini

class AnalyticsDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # 1. Journals over time (last 14 entries)
        journals = JournalEntry.objects.filter(user=user).order_by('created_at')[:14]
        mood_trends = []
        for j in journals:
            mood_trends.append({
                "date": j.created_at.strftime("%b %d"),
                "mood": j.mood_score,
                "confidence": j.confidence_score,
                "stress": j.stress_score,
                "energy": j.energy_level
            })
            
        # 2. Decision statistics
        decisions_summary = Decision.objects.filter(user=user).values('status').annotate(count=Count('status'))
        decision_stats = {
            "pending": 0,
            "completed": 0,
            "abandoned": 0,
            "avg_confidence": Decision.objects.filter(user=user).aggregate(Avg('confidence_score'))['confidence_score__avg'] or 0
        }
        for ds in decisions_summary:
            decision_stats[ds['status']] = ds['count']
            
        # 3. Opportunity Radar statistics
        opp_summary = Opportunity.objects.filter(user=user).values('category', 'status').annotate(count=Count('id'))
        opp_stats = {
            "job": 0, "internship": 0, "startup": 0, "scholarship": 0, "learning": 0, "networking": 0,
            "open": 0, "applied": 0, "completed": 0, "ignored": 0
        }
        for os in opp_summary:
            opp_stats[os['category']] = opp_stats.get(os['category'], 0) + os['count']
            opp_stats[os['status']] = opp_stats.get(os['status'], 0) + os['count']
            
        # 4. Goals statistics
        goal_summary = Goal.objects.filter(user=user).values('status').annotate(count=Count('id'))
        goal_stats = {"active": 0, "completed": 0, "failed": 0}
        for gs in goal_summary:
            goal_stats[gs['status']] = gs['count']
            
        # 5. Growth Score calculation
        # Max scores: 30 journals (30 pts), 5 goals completed (35 pts), 5 decisions completed (35 pts)
        journal_pts = min(JournalEntry.objects.filter(user=user).count() * 2, 30)
        goal_pts = min(Goal.objects.filter(user=user, status='completed').count() * 7, 35)
        decision_pts = min(Decision.objects.filter(user=user, status='completed').count() * 7, 35)
        growth_score = journal_pts + goal_pts + decision_pts

        return Response({
            "mood_trends": mood_trends,
            "decision_stats": decision_stats,
            "opportunity_stats": opp_stats,
            "goal_stats": goal_stats,
            "growth_score": growth_score,
            "journal_count": JournalEntry.objects.filter(user=user).count()
        }, status=status.HTTP_200_OK)

class GrowthReportViewSet(viewsets.ModelViewSet):
    serializer_class = GrowthReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GrowthReport.objects.filter(user=self.request.user).order_by('-created_at')

    def get_permissions(self):
        if self.action == 'export_report':
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_report(self, request):
        user = request.user
        report_type = request.data.get('report_type', 'weekly')
        if report_type not in ['weekly', 'monthly']:
            report_type = 'weekly'

        today = datetime.date.today()
        days = 7 if report_type == 'weekly' else 30
        start_date = today - datetime.timedelta(days=days)

        # 1. Fetch activities inside the period
        journals = JournalEntry.objects.filter(user=user, created_at__date__gte=start_date)
        goals = Goal.objects.filter(user=user, created_at__date__gte=start_date)
        decisions = Decision.objects.filter(user=user, created_at__date__gte=start_date)
        
        # 2. Compile metrics
        avg_mood = journals.aggregate(Avg('mood_score'))['mood_score__avg'] or 5
        avg_stress = journals.aggregate(Avg('stress_score'))['stress_score__avg'] or 5
        avg_confidence = journals.aggregate(Avg('confidence_score'))['confidence_score__avg'] or 5

        journals_text = "\n".join([f"- {j.content} (Mood: {j.mood_score}, Confidence: {j.confidence_score}, Stress: {j.stress_score})" for j in journals])
        goals_text = "\n".join([f"- Goal: {g.title} | Status: {g.status} | Category: {g.category}" for g in goals])
        decisions_text = "\n".join([f"- Decision: {d.title} | Status: {d.status} | Recommended Choice: {d.recommended_choice}" for d in decisions])

        # 3. Call Gemini
        system_instruction = (
            "You are the Analytics Reflection Engine for Anchor. Your task is to analyze the user's weekly "
            "or monthly growth data and write a growth reflection report. You must summarize accomplishments, "
            "blockers, lessons learned, and action points to stop overthinking.\n\n"
            "CRITICAL: You MUST respond in a valid raw JSON object. Do NOT wrap it in markdown backticks. "
            "Match this JSON schema exactly:\n"
            "{\n"
            "  \"wins\": [\"Accomplishment 1\", \"Accomplishment 2\", ...],\n"
            "  \"challenges\": [\"Blocker/Challenge 1\", \"Blocker/Challenge 2\", ...],\n"
            "  \"lessons_learned\": [\"Insight learned this week/month\", ...],\n"
            "  \"missed_opportunities\": [\"Missed opportunities or actions to address\", ...],\n"
            "  \"focus_areas\": [\"Key area of focus for the next period\", ...],\n"
            "  \"suggested_actions\": [\"Immediate action step 1\", \"Action step 2\", ...]\n"
            "}"
        )

        prompt = (
            f"Generating: {report_type.capitalize()} Report ({start_date} to {today})\n\n"
            f"Metrics Summary:\n"
            f"- Average Mood: {avg_mood:.1f}/10\n"
            f"- Average Stress: {avg_stress:.1f}/10\n"
            f"- Average Confidence: {avg_confidence:.1f}/10\n\n"
            f"User History in this period:\n"
            f"--- Reflections ---\n{journals_text}\n\n"
            f"--- Goals ---\n{goals_text}\n\n"
            f"--- Decisions ---\n{decisions_text}\n\n"
            f"Generate the report JSON."
        )

        raw_ai_response = query_gemini(prompt, system_instruction=system_instruction)

        cleaned_response = raw_ai_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()

        try:
            report_data = json.loads(cleaned_response)
        except Exception:
            # Fallback
            report_data = {
                "wins": ["Maintained streak", "Continued reflection"],
                "challenges": ["Managing stress levels"],
                "lessons_learned": ["Consistency drives clarity"],
                "missed_opportunities": ["None identified"],
                "focus_areas": ["Daily journals and decision tracking"],
                "suggested_actions": ["Keep journaling daily", "Review pending decisions"]
            }

        # 4. Save report in Database
        report = GrowthReport.objects.create(
            user=user,
            report_type=report_type,
            start_date=start_date,
            end_date=today,
            content=report_data
        )

        return Response(GrowthReportSerializer(report).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='export')
    def export_report(self, request, pk=None):
        user = request.user
        if not user or not user.is_authenticated:
            token_str = request.query_params.get('token')
            if token_str:
                try:
                    from rest_framework_simplejwt.tokens import AccessToken
                    from django.contrib.auth.models import User
                    access_token = AccessToken(token_str)
                    user_id = access_token['user_id']
                    user = User.objects.get(id=user_id)
                except Exception:
                    return HttpResponse("Unauthorized", status=401)
                    
        if not user or not user.is_authenticated:
            return HttpResponse("Unauthorized", status=401)

        report = get_object_or_404(GrowthReport, id=pk, user=user)
        export_format = request.query_params.get('format', 'json').lower()
        content = report.content

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="growth_report_{report.id}.csv"'
            
            writer = csv.writer(response)
            writer.writerow(['Category', 'Detail'])
            for w in content.get('wins', []):
                writer.writerow(['Win', w])
            for c in content.get('challenges', []):
                writer.writerow(['Challenge', c])
            for l in content.get('lessons_learned', []):
                writer.writerow(['Lesson Learned', l])
            for m in content.get('missed_opportunities', []):
                writer.writerow(['Missed Opportunity', m])
            for f in content.get('focus_areas', []):
                writer.writerow(['Focus Area', f])
            for a in content.get('suggested_actions', []):
                writer.writerow(['Suggested Action', a])
            return response

        elif export_format == 'pdf':
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                
                response = HttpResponse(content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="growth_report_{report.id}.pdf"'
                
                doc = SimpleDocTemplate(response, pagesize=letter)
                styles = getSampleStyleSheet()
                
                title_style = ParagraphStyle(
                    'TitleStyle',
                    parent=styles['Heading1'],
                    fontSize=24,
                    leading=28,
                    spaceAfter=15
                )
                h2_style = ParagraphStyle(
                    'H2Style',
                    parent=styles['Heading2'],
                    fontSize=16,
                    leading=20,
                    spaceBefore=10,
                    spaceAfter=5
                )
                body_style = ParagraphStyle(
                    'BodyStyle',
                    parent=styles['Normal'],
                    fontSize=11,
                    leading=14,
                    spaceAfter=4
                )
                
                story = []
                story.append(Paragraph(f"Anchor {report.report_type.capitalize()} Reflection Report", title_style))
                story.append(Paragraph(f"Period: {report.start_date} to {report.end_date}", body_style))
                story.append(Spacer(1, 15))
                
                sections = [
                    ("Wins", 'wins'),
                    ("Challenges", 'challenges'),
                    ("Lessons Learned", 'lessons_learned'),
                    ("Missed Opportunities", 'missed_opportunities'),
                    ("Focus Areas", 'focus_areas'),
                    ("Suggested Actions", 'suggested_actions')
                ]
                
                for label, key in sections:
                    story.append(Paragraph(label, h2_style))
                    for item in content.get(key, []):
                        story.append(Paragraph(f"• {item}", body_style))
                    story.append(Spacer(1, 10))
                
                doc.build(story)
                return response
            except ImportError:
                # Fallback to plain text
                response = HttpResponse(content_type='text/plain')
                response['Content-Disposition'] = f'attachment; filename="growth_report_{report.id}.txt"'
                output = [
                    f"Anchor {report.report_type.capitalize()} Reflection Report",
                    f"Period: {report.start_date} to {report.end_date}\n"
                ]
                for label, key in [("Wins", 'wins'), ("Challenges", 'challenges'), 
                                   ("Lessons Learned", 'lessons_learned'), ("Missed Opportunities", 'missed_opportunities'),
                                   ("Focus Areas", 'focus_areas'), ("Suggested Actions", 'suggested_actions')]:
                    output.append(f"\n{label.upper()}:")
                    output.extend([f"- {i}" for i in content.get(key, [])])
                response.write("\n".join(output))
                return response

        return Response(GrowthReportSerializer(report).data)
