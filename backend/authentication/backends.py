from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Custom authentication backend that allows users to authenticate
    using either their username or their email address (case-insensitively).
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            return None
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            # Query user by case-insensitive username OR case-insensitive email
            user = User.objects.filter(
                Q(username__iexact=username) | Q(email__iexact=username)
            ).first()
            
            if user and user.check_password(password):
                return user
        except Exception as e:
            print(f"[Auth Backend] Authentication failed with error: {e}")
            return None
        return None
