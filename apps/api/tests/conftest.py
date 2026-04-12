import os

from app.config import get_settings

# Define segredos de teste antes de importar app/main nos módulos de teste.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ADMIN_API_KEY", "dev-admin-key-change-in-production")

get_settings.cache_clear()
