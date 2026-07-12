from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import JournalEntry
from .serializers import JournalEntrySerializer
from anchor_project.gemini import get_embedding
from streaks.utils import log_user_activity

class JournalEntryViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return JournalEntry.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Generate semantic embedding
        content = serializer.validated_data.get('content', '')
        embedding = get_embedding(content)
        
        # AI Mood and Emotional State Analysis
        mood_score = 5
        confidence_score = 5
        stress_score = 5
        energy_level = 5
        
        try:
            from anchor_project.gemini import query_gemini
            import json
            
            system_instruction = (
                "You are an emotional analysis assistant. Analyze the user's journal entry text and output "
                "ratings from 1 to 10 for each of the following properties:\n"
                "1. mood_score (1 is extremely sad/depressed, 10 is extremely happy/elated)\n"
                "2. confidence_score (1 is completely insecure/doubting, 10 is extremely confident/bold)\n"
                "3. stress_score (1 is completely calm/relaxed, 10 is extremely stressed/anxious)\n"
                "4. energy_level (1 is exhausted/fatigued, 10 is highly energetic/vibrant)\n\n"
                "CRITICAL: Output ONLY valid JSON in the following format:\n"
                "{\n"
                "  \"mood_score\": 5,\n"
                "  \"confidence_score\": 5,\n"
                "  \"stress_score\": 5,\n"
                "  \"energy_level\": 5\n"
                "}\n"
                "Do not include any explanation or markdown code wrappers."
            )
            
            prompt = f"Analyze the following journal entry text:\n\n{content}"
            ai_res = query_gemini(prompt, system_instruction=system_instruction, temperature=0.1)
            
            cleaned_res = ai_res.strip()
            if cleaned_res.startswith("```json"):
                cleaned_res = cleaned_res[7:]
            if cleaned_res.endswith("```"):
                cleaned_res = cleaned_res[:-3]
            cleaned_res = cleaned_res.strip()
            
            scores = json.loads(cleaned_res)
            mood_score = max(1, min(10, int(scores.get('mood_score', 5))))
            confidence_score = max(1, min(10, int(scores.get('confidence_score', 5))))
            stress_score = max(1, min(10, int(scores.get('stress_score', 5))))
            energy_level = max(1, min(10, int(scores.get('energy_level', 5))))
        except Exception as e:
            print(f"[Journal Analysis] Failed to analyze emotional state: {e}")
            
        # Save entry
        entry = serializer.save(
            user=request.user, 
            embedding=embedding,
            mood_score=mood_score,
            confidence_score=confidence_score,
            stress_score=stress_score,
            energy_level=energy_level
        )
        
        # Update streak, XP, badges
        gamification_data = log_user_activity(request.user, 'journal')
        
        headers = self.get_success_headers(serializer.data)
        # Re-fetch serialized data to include the auto-calculated scores
        refetched_serializer = self.get_serializer(entry)
        return Response({
            "entry": refetched_serializer.data,
            "gamification": gamification_data
        }, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Check if content changed to re-generate embedding and emotional analysis
        if 'content' in serializer.validated_data:
            content = serializer.validated_data['content']
            if content != instance.content:
                serializer.validated_data['embedding'] = get_embedding(content)
                
                # Re-analyze emotional scores
                try:
                    from anchor_project.gemini import query_gemini
                    import json
                    
                    system_instruction = (
                        "You are an emotional analysis assistant. Analyze the user's journal entry text and output "
                        "ratings from 1 to 10 for each of the following properties:\n"
                        "1. mood_score (1 is extremely sad/depressed, 10 is extremely happy/elated)\n"
                        "2. confidence_score (1 is completely insecure/doubting, 10 is extremely confident/bold)\n"
                        "3. stress_score (1 is completely calm/relaxed, 10 is extremely stressed/anxious)\n"
                        "4. energy_level (1 is exhausted/fatigued, 10 is highly energetic/vibrant)\n\n"
                        "CRITICAL: Output ONLY valid JSON in the following format:\n"
                        "{\n"
                        "  \"mood_score\": 5,\n"
                        "  \"confidence_score\": 5,\n"
                        "  \"stress_score\": 5,\n"
                        "  \"energy_level\": 5\n"
                        "}\n"
                        "Do not include any explanation or markdown code wrappers."
                    )
                    
                    prompt = f"Analyze the following journal entry text:\n\n{content}"
                    ai_res = query_gemini(prompt, system_instruction=system_instruction, temperature=0.1)
                    
                    cleaned_res = ai_res.strip()
                    if cleaned_res.startswith("```json"):
                        cleaned_res = cleaned_res[7:]
                    if cleaned_res.endswith("```"):
                        cleaned_res = cleaned_res[:-3]
                    cleaned_res = cleaned_res.strip()
                    
                    scores = json.loads(cleaned_res)
                    serializer.validated_data['mood_score'] = max(1, min(10, int(scores.get('mood_score', 5))))
                    serializer.validated_data['confidence_score'] = max(1, min(10, int(scores.get('confidence_score', 5))))
                    serializer.validated_data['stress_score'] = max(1, min(10, int(scores.get('stress_score', 5))))
                    serializer.validated_data['energy_level'] = max(1, min(10, int(scores.get('energy_level', 5))))
                except Exception as e:
                    print(f"[Journal Analysis] Failed to re-analyze emotional state: {e}")
                    
        serializer.save()
        return Response(serializer.data)

from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser

class JournalOCRView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({"detail": "Image file is required."}, status=status.HTTP_400_BAD_REQUEST)

        image_bytes = image_file.read()
        content_type = image_file.content_type or 'image/jpeg'
        if ';' in content_type:
            content_type = content_type.split(';')[0].strip()

        try:
            from anchor_project.gemini import query_multimodal_vision

            system_instruction = (
                "You are an expert handwriting transcriber and optical character recognition (OCR) assistant. "
                "Your goal is to parse the user's handwritten diary page image into clean, legible, and structured text. "
                "Follow these guidelines:\n"
                "1. Transcribe the handwriting exactly as written, correcting minor punctuation or spelling spacing where necessary for readability, but keeping the user's authentic thoughts.\n"
                "2. If some words are blurred or illegible, make your best guess based on surrounding sentence context.\n"
                "3. Keep any original paragraphs or line-break styling if it matches section thoughts.\n"
                "4. Return ONLY the transcribed plain text. Do NOT include any intro notes, tags, summaries, explanations, or markdown code blocks (e.g., do not wrap in ```text or ```)."
            )

            transcription = query_multimodal_vision(image_bytes, content_type, system_instruction)

            if not transcription or transcription.startswith("Error:"):
                return Response({"detail": transcription or "Could not extract any text from the diary image. Please make sure the writing is clear and well-lit."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

            return Response({"text": transcription}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"[Journal OCR] OCR transcription failed: {e}")
            return Response({"detail": f"Failed to transcribe image: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
