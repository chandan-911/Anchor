import json
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer
from .memory import retrieve_user_context, format_context_prompt
from anchor_project.gemini import get_embedding, query_gemini
from streaks.utils import log_user_activity

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class MessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, conversation_id):
        conv = get_object_or_404(Conversation, id=conversation_id, user=request.user)
        messages = conv.messages.all()
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

class AskAIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id):
        conv = get_object_or_404(Conversation, id=conversation_id, user=request.user)
        user_message_text = request.data.get('message', '').strip()
        
        if not user_message_text:
            return Response({"detail": "Message text cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            
        # 1. Generate user embedding and save user message
        user_emb = get_embedding(user_message_text)
        user_message = Message.objects.create(
            conversation=conv,
            sender='user',
            content=user_message_text,
            embedding=user_emb
        )
        
        # 2. Retrieve multi-layer memory context
        context = retrieve_user_context(request.user, user_message_text, conversation_id=conv.id)
        context_prompt = format_context_prompt(context)
        
        # 3. Define AI Coach system instructions and output format
        system_instruction = (
            "You are the Anchor AI Coach & Decision Strategist. You help the user stop overthinking, "
            "obtain clarity, and take action. You have access to their history of journals, goals, decisions, "
            "streaks, and SWOT analysis.\n\n"
            "CRITICAL: You must NEVER reply using raw markdown text. You must respond in a structured JSON "
            "format so the frontend can render rich interactive UI widgets instead of raw markdown.\n\n"
            "Here is the required JSON structure you MUST return:\n"
            "{\n"
            "  \"text\": \"Main conversational coach response (warm, analytical, direct, challenging limiting beliefs)\",\n"
            "  \"summary\": \"A short 1-sentence clarity/focus statement...\",\n"
            "  \"blocks\": [\n"
            "    {\n"
            "      \"type\": \"insight_card\" | \"action_card\" | \"warning_card\" | \"opportunity_card\" | \"decision_card\",\n"
            "      \"title\": \"Widget Title\",\n"
            "      \"content\": \"Explanation text inside the card...\",\n"
            "      \"actions\": [\"list\", \"of\", \"concrete\", \"action\", \"steps\"], (for action_card / decision_card)\n"
            "      \"advantages\": [\"list\", \"of\", \"pros\"], (only for decision_card)\n"
            "      \"risks\": [\"list\", \"of\", \"risks\"], (only for decision_card)\n"
            "      \"opportunities\": [\"list\", \"of\", \"growth\", \"points\"] (only for decision_card)\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Make sure the response is valid JSON. Do not include any markdown backticks ```json ... ``` wrapper. Just output raw JSON."
        )
        
        prompt = f"User Memory Context:\n{context_prompt}\n\nUser Question:\n{user_message_text}"
        
        # 4. Query Gemini API
        ai_raw_response = query_gemini(prompt, system_instruction=system_instruction)
        
        # Clean up any potential markdown wrapper if Gemini adds it
        cleaned_response = ai_raw_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        # Verify JSON validity, fallback to basic text response structure if invalid JSON
        try:
            json.loads(cleaned_response)
        except Exception:
            # Fallback if Gemini fails to output correct JSON format
            fallback_dict = {
                "text": cleaned_response,
                "summary": "Focusing on immediate action steps.",
                "blocks": [
                    {
                        "type": "insight_card",
                        "title": "Clarity Insight",
                        "content": "Take a deep breath. Let's break this down systematically."
                    }
                ]
            }
            cleaned_response = json.dumps(fallback_dict)
            
        # 5. Save AI message
        ai_message = Message.objects.create(
            conversation=conv,
            sender='ai',
            content=cleaned_response
        )
        
        # Update conversation timestamp
        conv.save()
        
        # 6. Log activity for gamification
        gamification_data = log_user_activity(request.user, 'chat')
        
        return Response({
            "user_message": MessageSerializer(user_message).data,
            "ai_message": MessageSerializer(ai_message).data,
            "gamification": gamification_data
        }, status=status.HTTP_200_OK)

class VoiceTranscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, conversation_id):
        conv = get_object_or_404(Conversation, id=conversation_id, user=request.user)
        audio_file = request.FILES.get('audio')
        
        if not audio_file:
            return Response({"detail": "Audio file is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Read file bytes
        audio_bytes = audio_file.read()
        mime_type = audio_file.content_type or 'audio/webm'
        
        # 1. Transcribe the audio using Gemini
        try:
            import google.generativeai as genai
            from anchor_project.gemini import GEMINI_API_KEY
            if not GEMINI_API_KEY:
                raise ValueError("Gemini API Key is not configured.")
                
            print(f"[Voice Backend] Transcribing audio with mime_type: {mime_type}...")
            
            # Use Gemini 1.5 Flash to transcribe the audio content directly
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content([
                {
                    "mime_type": mime_type,
                    "data": audio_bytes
                },
                "Please transcribe this audio into the exact text spoken. Return ONLY the transcription, with no extra tags, introductory phrases, or markdown. If nothing is spoken or it is silent, return empty string."
            ])
            transcription = response.text.strip()
            print(f"[Voice Backend] Transcribed text: {transcription}")
        except Exception as e:
            print(f"[Voice Backend] Transcription failed: {e}")
            return Response({"detail": f"Failed to transcribe audio: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not transcription:
            return Response({"detail": "No clear speech detected in the audio."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Generate user embedding and save user message
        user_emb = get_embedding(transcription)
        user_message = Message.objects.create(
            conversation=conv,
            sender='user',
            content=transcription,
            embedding=user_emb
        )
        
        # 3. Retrieve multi-layer memory context
        context = retrieve_user_context(request.user, transcription, conversation_id=conv.id)
        context_prompt = format_context_prompt(context)
        
        # 4. Define AI Coach system instructions
        system_instruction = (
            "You are the Anchor AI Coach & Decision Strategist. You help the user stop overthinking, "
            "obtain clarity, and take action. You have access to their history of journals, goals, decisions, "
            "streaks, and SWOT analysis.\n\n"
            "CRITICAL: You must NEVER reply using raw markdown text. You must respond in a structured JSON "
            "format so the frontend can render rich interactive UI widgets instead of raw markdown.\n\n"
            "Here is the required JSON structure you MUST return:\n"
            "{\n"
            "  \"text\": \"Main conversational coach response (warm, analytical, direct, challenging limiting beliefs)\",\n"
            "  \"summary\": \"A short 1-sentence clarity/focus statement...\",\n"
            "  \"blocks\": [\n"
            "    {\n"
            "      \"type\": \"insight_card\" | \"action_card\" | \"warning_card\" | \"opportunity_card\" | \"decision_card\",\n"
            "      \"title\": \"Widget Title\",\n"
            "      \"content\": \"Explanation text inside the card...\",\n"
            "      \"actions\": [\"list\", \"of\", \"concrete\", \"action\", \"steps\"], (for action_card / decision_card)\n"
            "      \"advantages\": [\"list\", \"of\", \"pros\"], (only for decision_card)\n"
            "      \"risks\": [\"list\", \"of\", \"risks\"], (only for decision_card)\n"
            "      \"opportunities\": [\"list\", \"of\", \"growth\", \"points\"] (only for decision_card)\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Make sure the response is valid JSON. Do not include any markdown backticks ```json ... ``` wrapper. Just output raw JSON."
        )
        
        prompt = f"User Memory Context:\n{context_prompt}\n\nUser Question:\n{transcription}"
        
        # 5. Query Gemini API
        ai_raw_response = query_gemini(prompt, system_instruction=system_instruction)
        
        # Clean up any potential markdown wrapper if Gemini adds it
        cleaned_response = ai_raw_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        # Verify JSON validity, fallback if invalid
        try:
            json.loads(cleaned_response)
        except Exception:
            fallback_dict = {
                "text": cleaned_response,
                "summary": "Focusing on immediate action steps.",
                "blocks": [
                    {
                        "type": "insight_card",
                        "title": "Clarity Insight",
                        "content": "Take a deep breath. Let's break this down systematically."
                    }
                ]
            }
            cleaned_response = json.dumps(fallback_dict)
            
        # 6. Save AI message
        ai_message = Message.objects.create(
            conversation=conv,
            sender='ai',
            content=cleaned_response
        )
        
        # Update conversation timestamp
        conv.save()
        
        # 7. Log activity for gamification
        gamification_data = log_user_activity(request.user, 'chat')
        
        return Response({
            "transcription": transcription,
            "user_message": MessageSerializer(user_message).data,
            "ai_message": MessageSerializer(ai_message).data,
            "gamification": gamification_data
        }, status=status.HTTP_200_OK)
