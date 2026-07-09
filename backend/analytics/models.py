from django.db import models
from django.contrib.auth.models import User

class Goal(models.Model):
    CATEGORY_CHOICES = (
        ('career', 'Career & Professional'),
        ('personal', 'Personal Development'),
        ('health', 'Health & Wellness'),
        ('financial', 'Financial Growth'),
        ('relationships', 'Relationships & Social'),
    )
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='goals')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='personal')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    target_date = models.DateField(null=True, blank=True)
    achieved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['target_date', '-created_at']

    def __str__(self):
        return f"Goal: {self.title} ({self.status}) for {self.user.username}"

class GrowthReport(models.Model):
    REPORT_TYPES = (
        ('weekly', 'Weekly Reflection Report'),
        ('monthly', 'Monthly Growth Report'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports')
    report_type = models.CharField(max_length=10, choices=REPORT_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    content = models.JSONField() # JSON containing wins, challenges, lessons learned, focus areas, mood/stress trends, etc.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report_type.capitalize()} Report ({self.start_date} to {self.end_date}) for {self.user.username}"
