import csv
import json
from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SWOTReport
from .serializers import SWOTReportSerializer
from journal.models import JournalEntry
from chat.models import Message
from analytics.models import Goal
from decisions.models import Decision
from anchor_project.gemini import query_gemini
from streaks.utils import log_user_activity

class SWOTViewSet(viewsets.ModelViewSet):
    serializer_class = SWOTReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SWOTReport.objects.filter(user=self.request.user).order_by('-created_at')

    def get_permissions(self):
        if self.action == 'export_report':
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_swot(self, request):
        user = request.user
        period = request.data.get('period', 'monthly')
        if period not in ['weekly', 'monthly', 'quarterly', 'yearly']:
            period = 'monthly'

        # 1. Compile User Data for Gemini Context
        journals = JournalEntry.objects.filter(user=user)[:20]
        goals = Goal.objects.filter(user=user)[:10]
        decisions = Decision.objects.filter(user=user)[:10]
        messages = Message.objects.filter(conversation__user=user).order_by('-created_at')[:20]

        journals_text = "\n".join([f"- Journal ({j.created_at.strftime('%Y-%m-%d')}): {j.content} (Mood: {j.mood_score}, Confidence: {j.confidence_score}, Stress: {j.stress_score})" for j in journals])
        goals_text = "\n".join([f"- Goal ({g.category}): {g.title} [{g.status}]" for g in goals])
        decisions_text = "\n".join([f"- Decision: {d.title} (Recommended: {d.recommended_choice}, Status: {d.status})" for d in decisions])
        messages_text = "\n".join([f"- Message: {m.content}" for m in messages if m.sender == 'user'])

        # 2. Query Gemini
        system_instruction = (
            "You are the SWOT Intelligence Engine for Anchor. Your task is to analyze the user's journals, "
            "goals, decisions, and chat messages to generate a comprehensive, personalized SWOT analysis report "
            "with actionable growth recommendations.\n\n"
            "CRITICAL: You MUST respond in a valid raw JSON object. Do NOT wrap it in markdown backticks. "
            "Match this JSON schema exactly:\n"
            "{\n"
            "  \"strengths\": [\"Strength 1 with brief reason\", \"Strength 2...\", ...],\n"
            "  \"weaknesses\": [\"Weakness 1 detailing limiting belief or obstacle\", ...],\n"
            "  \"opportunities\": [\"Actionable growth opportunity based on goals/ideas\", ...],\n"
            "  \"threats\": [\"External threat, overthinking pattern, or risk factor\", ...],\n"
            "  \"growth_recommendations\": [\"Growth roadmap point 1\", \"Growth roadmap point 2\", ...]\n"
            "}"
        )

        prompt = (
            f"User Profile Info:\n"
            f"Level: {user.profile.level}, Streaks: {user.profile.current_streak}\n\n"
            f"User Data Context:\n"
            f"--- Recent Reflections ---\n{journals_text}\n\n"
            f"--- Active Goals ---\n{goals_text}\n\n"
            f"--- Decision History ---\n{decisions_text}\n\n"
            f"--- Recent Conversation Questions ---\n{messages_text}\n\n"
            f"Analyze the user's patterns and output the SWOT JSON report."
        )

        raw_ai_response = query_gemini(prompt, system_instruction=system_instruction)

        cleaned_response = raw_ai_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()

        try:
            swot_data = json.loads(cleaned_response)
        except Exception:
            # Fallback
            swot_data = {
                "strengths": ["Self-awareness", "Desire for clarity"],
                "weaknesses": ["Analysis paralysis", "Inconsistent execution"],
                "opportunities": ["Create structured action plans", "Leverage AI coach"],
                "threats": ["Overwhelm from high stress scores", "Losing momentum"],
                "growth_recommendations": ["Commit to daily micro-journaling", "Track decision outcomes weekly"]
            }

        # 3. Create SWOT Report in Database
        report = SWOTReport.objects.create(
            user=user,
            strengths=swot_data.get("strengths", []),
            weaknesses=swot_data.get("weaknesses", []),
            opportunities=swot_data.get("opportunities", []),
            threats=swot_data.get("threats", []),
            growth_recommendations=swot_data.get("growth_recommendations", []),
            period=period
        )

        # 4. Log User Activity for Gamification
        gamification_data = log_user_activity(user, 'swot')

        return Response({
            "report": SWOTReportSerializer(report).data,
            "gamification": gamification_data
        }, status=status.HTTP_201_CREATED)

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

        report = get_object_or_404(SWOTReport, id=pk, user=user)
        export_format = request.query_params.get('format', 'json').lower()

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="swot_report_{report.id}.csv"'
            
            writer = csv.writer(response)
            writer.writerow(['Category', 'Item Description'])
            
            for s in report.strengths:
                writer.writerow(['Strength', s])
            for w in report.weaknesses:
                writer.writerow(['Weakness', w])
            for o in report.opportunities:
                writer.writerow(['Opportunity', o])
            for t in report.threats:
                writer.writerow(['Threat', t])
            for r in report.growth_recommendations:
                writer.writerow(['Recommendation', r])
                
            return response

        elif export_format == 'pdf':
            # Generate plain text / HTML style simple PDF.
            # If ReportLab is installed, we write standard flowables, otherwise fallback to HTML/text response.
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                
                response = HttpResponse(content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="swot_report_{report.id}.pdf"'
                
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
                story.append(Paragraph(f"Anchor SWOT Analysis Report ({report.period.capitalize()})", title_style))
                story.append(Paragraph(f"Generated on: {report.created_at.strftime('%Y-%m-%d %H:%M')}", body_style))
                story.append(Spacer(1, 15))
                
                story.append(Paragraph("Strengths", h2_style))
                for s in report.strengths:
                    story.append(Paragraph(f"• {s}", body_style))
                story.append(Spacer(1, 10))
                
                story.append(Paragraph("Weaknesses", h2_style))
                for w in report.weaknesses:
                    story.append(Paragraph(f"• {w}", body_style))
                story.append(Spacer(1, 10))
                
                story.append(Paragraph("Opportunities", h2_style))
                for o in report.opportunities:
                    story.append(Paragraph(f"• {o}", body_style))
                story.append(Spacer(1, 10))
                
                story.append(Paragraph("Threats", h2_style))
                for t in report.threats:
                    story.append(Paragraph(f"• {t}", body_style))
                story.append(Spacer(1, 10))
                
                story.append(Paragraph("Growth Recommendations", h2_style))
                for r in report.growth_recommendations:
                    story.append(Paragraph(f"• {r}", body_style))
                
                doc.build(story)
                return response
            except ImportError:
                # Fallback simple text formatting if reportlab is not available
                response = HttpResponse(content_type='text/plain')
                response['Content-Disposition'] = f'attachment; filename="swot_report_{report.id}.txt"'
                
                output = []
                output.append(f"Anchor SWOT Analysis Report ({report.period.capitalize()})\n")
                output.append(f"Generated on: {report.created_at.strftime('%Y-%m-%d %H:%M')}\n\n")
                
                output.append("STRENGTHS:")
                output.extend([f"- {s}" for s in report.strengths])
                output.append("\nWEAKNESSES:")
                output.extend([f"- {w}" for w in report.weaknesses])
                output.append("\nOPPORTUNITIES:")
                output.extend([f"- {o}" for o in report.opportunities])
                output.append("\nTHREATS:")
                output.extend([f"- {t}" for t in report.threats])
                output.append("\nGROWTH RECOMMENDATIONS:")
                output.extend([f"- {r}" for r in report.growth_recommendations])
                
                response.write("\n".join(output))
                return response

        # Default fallback to JSON
        return Response(SWOTReportSerializer(report).data)
