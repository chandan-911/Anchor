import datetime
from django.db import models
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import ActivityLog
from .serializers import ActivityLogSerializer
from authentication.models import UserProfile
from analytics.models import Goal
from rest_framework import serializers

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = ('id', 'title', 'description', 'category', 'status', 'target_date', 'achieved_at', 'created_at')
        read_only_fields = ('id', 'achieved_at', 'created_at')

class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user).order_by('target_date', '-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')
        if new_status == 'completed' and instance.status != 'completed':
            instance.status = 'completed'
            instance.achieved_at = timezone.now()
            instance.save()
            # Log activity to update streaks & XP
            from .utils import log_user_activity
            log_user_activity(request.user, 'journal') # Give some xp!
        else:
            instance.status = new_status
            instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

class StreakStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, created = UserProfile.objects.get_or_create(user=user)
        
        # Calculate weekly and monthly consistency
        today = datetime.date.today()
        seven_days_ago = today - datetime.timedelta(days=6)
        start_of_month = today.replace(day=1)
        
        # Fetch activity dates in range
        weekly_activities = ActivityLog.objects.filter(
            user=user, 
            date__gte=seven_days_ago
        ).values_list('date', flat=True).distinct()
        
        monthly_activities = ActivityLog.objects.filter(
            user=user, 
            date__gte=start_of_month
        ).values_list('date', flat=True).distinct()
        
        weekly_consistency = len(weekly_activities)
        monthly_consistency = len(monthly_activities)
        
        # Calculate milestones / badges
        badges_list = profile.badges
        
        return Response({
            "current_streak": profile.current_streak,
            "longest_streak": profile.longest_streak,
            "level": profile.level,
            "xp_points": profile.xp_points,
            "xp_for_next_level": profile.level * 100,
            "weekly_consistency_days": weekly_consistency,
            "monthly_consistency_days": monthly_consistency,
            "badges": badges_list,
            "last_activity_date": profile.last_activity_date
        }, status=status.HTTP_200_OK)
