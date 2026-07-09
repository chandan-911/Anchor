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
        
        # Save entry
        entry = serializer.save(user=request.user, embedding=embedding)
        
        # Update streak, XP, badges
        gamification_data = log_user_activity(request.user, 'journal')
        
        headers = self.get_success_headers(serializer.data)
        return Response({
            "entry": serializer.data,
            "gamification": gamification_data
        }, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Check if content changed to re-generate embedding
        if 'content' in serializer.validated_data:
            content = serializer.validated_data['content']
            if content != instance.content:
                serializer.validated_data['embedding'] = get_embedding(content)
                
        serializer.save()
        return Response(serializer.data)
