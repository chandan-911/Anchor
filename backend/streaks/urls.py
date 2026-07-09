from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StreakStatsView, GoalViewSet

router = DefaultRouter()
router.register('goals', GoalViewSet, basename='goals')

urlpatterns = [
    path('', StreakStatsView.as_view(), name='streak_stats'),
    path('', include(router.urls)),
]
