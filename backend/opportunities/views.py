import json
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Opportunity
from .serializers import OpportunitySerializer
from journal.models import JournalEntry
from chat.models import Message
from analytics.models import Goal
from decisions.models import Decision
from anchor_project.gemini import query_gemini
from streaks.utils import log_user_activity

class OpportunityViewSet(viewsets.ModelViewSet):
    serializer_class = OpportunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Opportunity.objects.filter(user=self.request.user).order_by('-priority_score', '-created_at')

    @action(detail=False, methods=['post'], url_path='scan')
    def scan_opportunities(self, request):
        user = request.user
        
        # 1. Gather context
        journals = JournalEntry.objects.filter(user=user)[:15]
        goals = Goal.objects.filter(user=user)[:8]
        decisions = Decision.objects.filter(user=user)[:8]
        messages = Message.objects.filter(conversation__user=user).order_by('-created_at')[:15]

        journals_text = "\n".join([f"- {j.content}" for j in journals])
        goals_text = "\n".join([f"- {g.title} ({g.category})" for g in goals])
        decisions_text = "\n".join([f"- {d.title} (Status: {d.status})" for d in decisions])
        messages_text = "\n".join([f"- {m.content}" for m in messages if m.sender == 'user'])

        # 2. Call Gemini
        system_instruction = (
            "You are the Opportunity Radar Engine for Anchor. Your task is to analyze the user's context and "
            "synthesize matching, actionable opportunities (categories: 'job', 'internship', 'startup', "
            "'scholarship', 'learning', or 'networking').\n\n"
            "For each opportunity, you MUST construct a real, active search URL matched to the recommendation in the "
            "'external_link' field. Do NOT use fake domains. Instead, generate specific query strings on popular portals:\n"
            "- For 'learning': Use direct search URLs like 'https://www.coursera.org/search?query=...' or 'https://www.udemy.com/courses/search/?q=...'\n"
            "- For 'job' / 'internship': Use 'https://www.linkedin.com/jobs/search/?keywords=...' or 'https://www.indeed.com/jobs?q=...'\n"
            "- For 'networking' / 'startup': Use 'https://www.meetup.com/find/?keywords=...' or YCombinator search 'https://www.ycombinator.com/companies'\n"
            "- For 'scholarship': Use 'https://www.google.com/search?q=scholarships+for+...'\n\n"
            "For each opportunity, calculate an Impact Score (1-100) and an Urgency Score (1-100).\n\n"
            "CRITICAL: You MUST respond in a valid raw JSON list of objects. Do NOT wrap it in markdown backticks. "
            "Match this JSON schema exactly:\n"
            "[\n"
            "  {\n"
            "    \"title\": \"Descriptive title of the opportunity\",\n"
            "    \"description\": \"Actionable steps detailing how the user can seize this opportunity\",\n"
            "    \"category\": \"job\" | \"internship\" | \"startup\" | \"scholarship\" | \"learning\" | \"networking\",\n"
            "    \"impact_score\": 85,\n"
            "    \"urgency_score\": 70,\n"
            "    \"external_link\": \"https://www.coursera.org/search?query=react+native\"\n"
            "  }\n"
            "]"
        )

        prompt = (
            f"User context:\n"
            f"--- Journal thoughts ---\n{journals_text}\n\n"
            f"--- Active Goals ---\n{goals_text}\n\n"
            f"--- Decisions ---\n{decisions_text}\n\n"
            f"--- Recent chat concerns ---\n{messages_text}\n\n"
            f"Find matching live web opportunities. Return a JSON list."
        )

        raw_ai_response = query_gemini(prompt, system_instruction=system_instruction)

        cleaned_response = raw_ai_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()

        try:
            items = json.loads(cleaned_response)
        except Exception:
            # Fallback
            items = [
                {
                    "title": "Build a Personal Portfolio website",
                    "description": "Showcase your React & Tailwind skills to potential employers by hosting a portfolio on Vercel.",
                    "category": "learning",
                    "impact_score": 80,
                    "urgency_score": 60,
                    "external_link": "https://vercel.com"
                },
                {
                    "title": "Join local Developer meetups",
                    "description": "Attend tech gatherings to meet mentors, find startup partners or job referrals.",
                    "category": "networking",
                    "impact_score": 75,
                    "urgency_score": 50,
                    "external_link": "https://meetup.com"
                }
            ]

        # 3. Save opportunities
        created_opportunities = []
        
        # Optionally delete old 'open' opportunities so we don't build duplicates
        Opportunity.objects.filter(user=user, status='open').delete()

        for item in items:
            impact = item.get("impact_score", 50)
            urgency = item.get("urgency_score", 50)
            priority = int((impact * 0.6) + (urgency * 0.4))
            
            opp = Opportunity.objects.create(
                user=user,
                title=item.get("title", "Growth Action"),
                description=item.get("description", ""),
                category=item.get("category", "learning"),
                impact_score=impact,
                urgency_score=urgency,
                priority_score=priority,
                external_link=item.get("external_link", ""),
                status='open'
            )
            created_opportunities.append(opp)

        # 4. Log Activity
        gamification_data = log_user_activity(user, 'opportunity')

        return Response({
            "opportunities": OpportunitySerializer(created_opportunities, many=True).data,
            "gamification": gamification_data
        }, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Opportunity.STATUS_CHOICES):
            instance.status = new_status
            instance.save()
            
            # If status completed, award XP!
            if new_status == 'completed':
                log_user_activity(request.user, 'opportunity')
                
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
