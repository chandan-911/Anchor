from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.TextField(blank=True, default='')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    xp_points = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    theme_preference = models.CharField(max_length=10, default='dark')
    language_preference = models.CharField(max_length=10, default='en')
    badges = models.JSONField(default=list, blank=True)
    last_activity_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
