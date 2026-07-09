import json
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Decision
from .serializers import DecisionSerializer
from chat.memory import retrieve_user_context, format_context_prompt
from anchor_project.gemini import query_gemini
from streaks.utils import log_user_activity

class DecisionViewSet(viewsets.ModelViewSet):
    serializer_class = DecisionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Decision.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        title = serializer.validated_data.get('title')
        description = serializer.validated_data.get('description')
        
        # 1. Retrieve user memory context
        context = retrieve_user_context(request.user, description)
        context_prompt = format_context_prompt(context)
        
        # 2. Call Gemini decision strategist
        system_instruction = (
            "You are the Decision Intelligence Engine for Anchor. Your goal is to analyze the user's dilemma, "
            "evaluate options, and output a structured decision analysis mapping advantages, disadvantages, "
            "risks, long-term impact, clear recommended choices, confidence, and immediate actions to break paralysis.\n\n"
            "CRITICAL: You MUST respond with a valid raw JSON object. Do NOT wrap it in markdown backticks. "
            "Match this JSON schema exactly:\n"
            "{\n"
            "  \"summary\": \"Concise explanation of the decision dilemma and key tradeoffs...\",\n"
            "  \"advantages\": [\"Advantage 1\", \"Advantage 2\", ...],\n"
            "  \"disadvantages\": [\"Disadvantage 1\", \"Disadvantage 2\", ...],\n"
            "  \"risks\": [\"Risk 1 (with mitigation suggestion)\", ...],\n"
            "  \"opportunities\": [\"Growth Opportunity 1\", ...],\n"
            "  \"long_term_impact\": \"Detail the 5-10 year long-term outcome or strategic impact of resolving this...\",\n"
            "  \"recommended_choice\": \"The definitive recommended choice to make...\",\n"
            "  \"confidence_score\": 85,  (Integer between 0 and 100 representing recommendation confidence)\n"
            "  \"immediate_next_actions\": [\"First concrete action step\", \"Second concrete action step\", ...]\n"
            "}"
        )
        
        prompt = f"User Memory Context:\n{context_prompt}\n\nDilemma title: {title}\nDilemma Description:\n{description}"
        
        raw_ai_response = query_gemini(prompt, system_instruction=system_instruction)
        
        cleaned_response = raw_ai_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        # Parse decision JSON
        try:
            decision_data = json.loads(cleaned_response)
        except Exception:
            # Fallback
            decision_data = {
                "summary": "Analysing decision dilemma.",
                "advantages": ["Potential positive outcome"],
                "disadvantages": ["Potential tradeoffs"],
                "risks": ["Risk of inaction"],
                "opportunities": ["Opportunity for growth"],
                "long_term_impact": "Requires further deliberation.",
                "recommended_choice": "Take time to reflect on options.",
                "confidence_score": 50,
                "immediate_next_actions": ["List core criteria", "Reflect on core values"]
            }
            
        # 3. Save Decision object
        decision = Decision.objects.create(
            user=request.user,
            title=title,
            description=description,
            summary=decision_data.get("summary", ""),
            advantages=decision_data.get("advantages", []),
            disadvantages=decision_data.get("disadvantages", []),
            risks=decision_data.get("risks", []),
            opportunities=decision_data.get("opportunities", []),
            long_term_impact=decision_data.get("long_term_impact", ""),
            recommended_choice=decision_data.get("recommended_choice", ""),
            confidence_score=decision_data.get("confidence_score", 50),
            immediate_next_actions=decision_data.get("immediate_next_actions", []),
            status='pending'
        )
        
        # 4. Log activity
        gamification_data = log_user_activity(request.user, 'decision')
        
        headers = self.get_success_headers(serializer.data)
        return Response({
            "decision": DecisionSerializer(decision).data,
            "gamification": gamification_data
        }, status=status.HTTP_201_CREATED, headers=headers)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Decision.STATUS_CHOICES):
            instance.status = new_status
            instance.save()
            
            # If status becomes completed, log as achievement update!
            if new_status == 'completed':
                log_user_activity(request.user, 'decision')
                
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
