from django.db import models
from django.contrib.auth.models import User

class ActivityLog(models.Model):
    ACTIVITY_TYPES = (
        ('journal', 'Journal Entry'),
        ('chat', 'AI Chat'),
        ('decision', 'Decision Assessment'),
        ('swot', 'SWOT Analysis'),
        ('opportunity', 'Opportunity Radar'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    date = models.DateField(auto_now_add=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} on {self.date}"
