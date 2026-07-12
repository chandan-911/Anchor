import json
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
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
        # Exclude temporary voice sessions from the user's permanent conversation history
        return Conversation.objects.filter(user=self.request.user).exclude(title="Voice Session").order_by('-updated_at')

    def perform_create(self, serializer):
        # Automatically clean up any abandoned/unsaved Voice Session drafts for the user
        Conversation.objects.filter(user=self.request.user, title="Voice Session").delete()
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
        
        # Sanitize mime type for Gemini
        raw_mime = audio_file.content_type or 'audio/webm'
        if ';' in raw_mime:
            raw_mime = raw_mime.split(';')[0].strip()
            
        # Map iOS containers to Gemini supported formats
        if raw_mime in ['audio/mp4', 'audio/m4a', 'audio/x-m4a']:
            mime_type = 'audio/aac'
        else:
            mime_type = raw_mime

        # Get requested language parameter or fallback to user profile settings
        requested_lang = request.data.get('language') or request.POST.get('language')
        from authentication.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        preferred_lang = requested_lang or profile.language_preference or 'en'
        
        lang_hint = 'en'
        if 'pa' in preferred_lang:
            lang_hint = 'pa'
        elif 'hi' in preferred_lang:
            lang_hint = 'hi'
        elif 'es' in preferred_lang:
            lang_hint = 'es'
        elif 'fr' in preferred_lang:
            lang_hint = 'fr'
        elif 'ja' in preferred_lang:
            lang_hint = 'ja'
        
        # 1. Transcribe the audio (Try 1: Gemini multimodal, Try 2: Groq Whisper fallback)
        transcription = ""
        transcription_error = ""
        
        # Multi-lingual transcription instructions
        transcription_instruction = (
            "You are an expert multi-lingual speech-to-text transcriber. Transcribe this audio recording into exact, grammatical text. "
            "Follow these guidelines:\n"
            "1. The user may speak in English, Hindi, or Punjabi, or code-switch/mix these languages. Transcribe exactly in the language(s) spoken using their correct scripts (Devanagari for Hindi, Gurmukhi for Punjabi, Latin for English).\n"
            "2. Filter out filler words, stutters, and verbal ticks (e.g., 'um', 'uh', 'ah', 'like') to produce clean, legible text.\n"
            "3. Use surrounding sentence context to resolve phonetic ambiguities and spelling errors.\n"
            "4. Return ONLY the final transcribed text. Do NOT include any introductory notes, wrappers, explanations, tags, or markdown backticks."
        )

        # Try 1: Gemini 1.5 Flash
        try:
            import google.generativeai as genai
            from anchor_project.gemini import GEMINI_API_KEY
            if GEMINI_API_KEY:
                gemini_model_names = [
                    "gemini-1.5-flash",
                    "models/gemini-1.5-flash",
                    "gemini-1.5-pro",
                    "gemini-pro"
                ]
                for m_name in gemini_model_names:
                    try:
                        print(f"[Voice Backend] Attempting transcription via Gemini model: {m_name}...")
                        model = genai.GenerativeModel(m_name)
                        response = model.generate_content([
                            {
                                "mime_type": mime_type,
                                "data": audio_bytes
                            },
                            transcription_instruction
                        ])
                        
                        try:
                            transcription = response.text.strip()
                        except Exception:
                            if response.candidates and len(response.candidates) > 0:
                                candidate = response.candidates[0]
                                if candidate.content and candidate.content.parts:
                                    transcription = "".join([part.text for part in candidate.content.parts if hasattr(part, 'text')]).strip()
                        if transcription:
                            break
                    except Exception as inner_e:
                        print(f"[Voice Backend] Gemini model {m_name} failed: {inner_e}")
        except Exception as e:
            print(f"[Voice Backend] Gemini transcription outer loop failed: {e}")
            transcription_error = str(e)

        # Try 2: Groq Whisper Fallback
        if not transcription:
            try:
                import requests
                from anchor_project.gemini import os
                grok_key = os.getenv('GROK_API_KEY')
                if grok_key:
                    print(f"[Voice Backend] Gemini failed/empty. Trying Groq Whisper fallback (hint: {lang_hint})...")
                    url = "https://api.groq.com/openai/v1/audio/transcriptions"
                    headers = {
                        "Authorization": f"Bearer {grok_key}"
                    }
                    filename = 'voice.webm'
                    if 'wav' in raw_mime: filename = 'voice.wav'
                    elif 'mp4' in raw_mime: filename = 'voice.mp4'
                    
                    files = {
                        "file": (filename, audio_bytes, raw_mime)
                    }
                    data = {
                        "model": "whisper-large-v3",
                        "language": lang_hint,
                        "prompt": "ਪੰਜਾਬੀ, Gurmukhi script transcription. मैं हिंदी बोल रहा हूँ, देवनागरी, Hindi transcription."
                    }
                    res = requests.post(url, headers=headers, files=files, data=data, timeout=12)
                    if res.status_code == 200:
                        transcription = res.json().get('text', '').strip()
                        print(f"[Voice Backend] Groq Whisper transcription success: {transcription}")
                    else:
                        print(f"[Voice Backend] Groq Whisper returned status {res.status_code}: {res.text}")
                        transcription_error += f" | Groq Status {res.status_code}"
            except Exception as e:
                print(f"[Voice Backend] Groq Whisper fallback failed: {e}")
                transcription_error += f" | Whisper Error: {str(e)}"

        if not transcription:
            error_msg = "No clear speech detected in the audio. Please speak closer to your microphone or try again."
            if "not-allowed" in transcription_error or "403" in transcription_error:
                error_msg = "API authentication error. Please try again or check keys."
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

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
            f"LANGUAGE RULE: You MUST write your response in the EXACT same language and script as the user's question transcription "
            f"(e.g., if the user spoke in Gurmukhi/Punjabi, your reply 'text' field MUST be in Gurmukhi/Punjabi; "
            f"if they spoke in Hindi/Devanagari, it MUST be in Hindi/Devanagari; if they spoke in English, it MUST be in English). "
            f"Do NOT translate their question to English to respond, and do NOT reply in a different language unless requested. "
            f"Your reply 'text' value MUST match the exact language spoken naturally.\n\n"
            "CRITICAL: You must NEVER reply using raw markdown formatting inside the 'text' property of the JSON response. "
            "Do NOT include bold asterisks (**), italics (*), hashes (#), list dashes (-), or list numbering in the 'text' value. "
            "Keep the 'text' property value as clean, plain, conversational text optimized for being read out loud by SpeechSynthesis.\n\n"
            "Here is the required JSON structure you MUST return:\n"
            "{\n"
            "  \"text\": \"Main conversational coach response (plain text only, warm, direct, challenging limiting beliefs, no markdown syntax)\",\n"
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
        
        # Unicode helper to detect Gurmukhi (Punjabi) and Devanagari (Hindi) transcription scripts
        detected_lang = 'english'
        if any(0x0A00 <= ord(c) <= 0x0A7F for c in transcription):
            detected_lang = 'punjabi'
        elif any(0x0900 <= ord(c) <= 0x097F for c in transcription):
            detected_lang = 'hindi'

        lang_instruction = ""
        if detected_lang == 'punjabi':
            lang_instruction = (
                "CRITICAL LANGUAGE RULE: The user has asked in Punjabi (using Gurmukhi characters). "
                "You MUST reply in Punjabi using the native Gurmukhi script in the JSON 'text' field. "
                "Do NOT write in English, do NOT translate it, and do NOT use Latin transliteration. Example: 'ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।'"
            )
        elif detected_lang == 'hindi':
            lang_instruction = (
                "CRITICAL LANGUAGE RULE: The user has asked in Hindi (using Devanagari characters). "
                "You MUST reply in Hindi using the native Devanagari script in the JSON 'text' field. "
                "Do NOT write in English, do NOT translate it, and do NOT use Latin transliteration. Example: 'मैं आपकी मदद कर सकता हूँ।'"
            )
        else:
            lang_instruction = (
                "CRITICAL LANGUAGE RULE: Respond in English in the JSON 'text' field."
            )

        prompt = (
            f"User Memory Context:\n{context_prompt}\n\n"
            f"User Question:\n{transcription}\n\n"
            f"Instruction: {lang_instruction}"
        )
        
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
