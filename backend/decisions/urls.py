from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DecisionViewSet

router = DefaultRouter()
router.register('', DecisionViewSet, basename='decisions')

urlpatterns = [
    path('', include(router.urls)),
]
