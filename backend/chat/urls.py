from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, MessageListView, AskAIView, VoiceTranscribeView

router = DefaultRouter()
router.register('conversations', ConversationViewSet, basename='conversations')

urlpatterns = [
    path('', include(router.urls)),
    path('conversations/<int:conversation_id>/messages/', MessageListView.as_view(), name='message_list'),
    path('conversations/<int:conversation_id>/ask/', AskAIView.as_view(), name='ask_ai'),
    path('conversations/<int:conversation_id>/voice-transcribe/', VoiceTranscribeView.as_view(), name='voice_transcribe'),
]
