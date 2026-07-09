from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SWOTViewSet

router = DefaultRouter()
router.register('', SWOTViewSet, basename='swot')

urlpatterns = [
    path('', include(router.urls)),
]
