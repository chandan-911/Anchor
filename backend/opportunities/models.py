from django.db import models
from django.contrib.auth.models import User

class Opportunity(models.Model):
    CATEGORY_CHOICES = (
        ('job', 'Job Opportunity'),
        ('internship', 'Internship Opportunity'),
        ('startup', 'Startup Opportunity'),
        ('scholarship', 'Scholarship Opportunity'),
        ('learning', 'Learning Opportunity'),
        ('networking', 'Networking Opportunity'),
    )
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('applied', 'Applied'),
        ('completed', 'Completed'),
        ('ignored', 'Ignored'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opportunities')
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    priority_score = models.IntegerField(default=50) # 1-100
    impact_score = models.IntegerField(default=50)   # 1-100
    urgency_score = models.IntegerField(default=50)  # 1-100
    external_link = models.URLField(max_length=500, blank=True, null=True, default='')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority_score', '-created_at']

    def __str__(self):
        return f"{self.category.capitalize()}: {self.title} ({self.priority_score} pts) for {self.user.username}"
