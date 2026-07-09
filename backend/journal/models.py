from django.db import models
from django.contrib.auth.models import User

class JournalEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='journals')
    content = models.TextField()
    mood_score = models.IntegerField(default=5)       # 1-10
    confidence_score = models.IntegerField(default=5) # 1-10
    stress_score = models.IntegerField(default=5)     # 1-10
    energy_level = models.IntegerField(default=5)     # 1-10
    language = models.CharField(max_length=10, default='en')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    embedding = models.JSONField(null=True, blank=True) # Semantic memory embedding (list of floats)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"Journal Entry by {self.user.username} on {self.created_at.strftime('%Y-%m-%d')}"
