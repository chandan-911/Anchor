import datetime
from django.utils import timezone
from .models import ActivityLog
from authentication.models import UserProfile

def log_user_activity(user, activity_type: str):
    """
    Logs user activity, updates streaks, grants XP, handles level-up, and awards badges.
    Returns a dict with status updates (streak_incremented, leveled_up, unlocked_badges).
    """
    today = datetime.date.today()
    
    # 1. Create activity log (only one per type per day needed, but let's record it)
    ActivityLog.objects.create(user=user, activity_type=activity_type)
    
    profile, created = UserProfile.objects.get_or_create(user=user)
    last_active = profile.last_activity_date
    
    streak_changed = False
    leveled_up = False
    new_badges = []
    
    # 2. Streak calculations
    if last_active is None:
        profile.current_streak = 1
        profile.longest_streak = max(profile.longest_streak, 1)
        profile.last_activity_date = today
        streak_changed = True
    else:
        delta = today - last_active
        if delta.days == 1:
            # Consecutive day!
            profile.current_streak += 1
            profile.longest_streak = max(profile.longest_streak, profile.current_streak)
            profile.last_activity_date = today
            streak_changed = True
        elif delta.days > 1:
            # Broke streak, reset to 1
            profile.current_streak = 1
            profile.last_activity_date = today
            streak_changed = True
        elif delta.days == 0:
            # Already active today, streak remains the same
            pass

    # 3. XP & Leveling system
    # Grant XP based on activity type
    xp_to_grant = 15
    if activity_type == 'journal':
        xp_to_grant = 25
    elif activity_type == 'decision':
        xp_to_grant = 30
    elif activity_type == 'swot':
        xp_to_grant = 40
        
    profile.xp_points += xp_to_grant
    
    # Simple level system: 100 XP per level
    xp_for_next_level = profile.level * 100
    while profile.xp_points >= xp_for_next_level:
        profile.xp_points -= xp_for_next_level
        profile.level += 1
        leveled_up = True
        xp_for_next_level = profile.level * 100

    # 4. Badges awards
    unlocked = set(profile.badges)
    
    # Streak badges
    if profile.current_streak >= 7 and "7 Day Thinker" not in unlocked:
        unlocked.add("7 Day Thinker")
        new_badges.append("7 Day Thinker")
    if profile.current_streak >= 30 and "30 Day Reflector" not in unlocked:
        unlocked.add("30 Day Reflector")
        new_badges.append("30 Day Reflector")
    if profile.current_streak >= 100 and "100 Day Builder" not in unlocked:
        unlocked.add("100 Day Builder")
        new_badges.append("100 Day Builder")

    # Activity count badges
    journal_count = user.journals.count()
    if journal_count >= 10 and "Self-Reflector" not in unlocked:
        unlocked.add("Self-Reflector")
        new_badges.append("Self-Reflector")
        
    decision_count = user.decisions.count()
    if decision_count >= 5 and "Decision Master" not in unlocked:
        unlocked.add("Decision Master")
        new_badges.append("Decision Master")
        
    opportunity_count = user.opportunities.filter(status='completed').count()
    if opportunity_count >= 3 and "Opportunity Hunter" not in unlocked:
        unlocked.add("Opportunity Hunter")
        new_badges.append("Opportunity Hunter")

    profile.badges = list(unlocked)
    profile.save()
    
    return {
        "xp_granted": xp_to_grant,
        "current_streak": profile.current_streak,
        "longest_streak": profile.longest_streak,
        "level": profile.level,
        "xp_points": profile.xp_points,
        "leveled_up": leveled_up,
        "new_badges": new_badges
    }
