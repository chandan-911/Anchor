from django.db import models
from django.contrib.auth.models import User

class Decision(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='decisions')
    title = models.CharField(max_length=255)
    description = models.TextField() # dilemma or prompt
    summary = models.TextField(blank=True, default='')
    advantages = models.JSONField(default=list, blank=True)
    disadvantages = models.JSONField(default=list, blank=True)
    risks = models.JSONField(default=list, blank=True)
    opportunities = models.JSONField(default=list, blank=True)
    long_term_impact = models.TextField(blank=True, default='')
    recommended_choice = models.CharField(max_length=255, blank=True, default='')
    confidence_score = models.IntegerField(default=0) # 1-100%
    immediate_next_actions = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Decision: {self.title} ({self.status}) for {self.user.username}"
