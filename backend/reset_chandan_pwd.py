import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'anchor_project.settings')
django.setup()

from django.contrib.auth.models import User

try:
    u = User.objects.filter(username='Chandan').first()
    if u:
        u.set_password('1234567')
        u.save()
        print("[Auth Reset] User Chandan password updated to 1234567 successfully in database.")
    else:
        User.objects.create_user('Chandan', 'ck7464877@gmail.com', '1234567')
        print("[Auth Reset] User Chandan created with password 1234567 successfully.")
except Exception as e:
    print(f"[Auth Reset] Failed to set password: {e}")
