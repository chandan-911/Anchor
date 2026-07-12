from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import JournalEntryViewSet, JournalOCRView

router = DefaultRouter()
router.register('', JournalEntryViewSet, basename='journal')

urlpatterns = [
    path('ocr/', JournalOCRView.as_view(), name='journal_ocr'),
    path('', include(router.urls)),
]
