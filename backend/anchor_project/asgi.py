import os

# Monkeypatch pymysql for MySQL support
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'anchor_project.settings')

application = get_asgi_application()
