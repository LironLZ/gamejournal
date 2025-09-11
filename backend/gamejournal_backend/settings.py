"""
Django settings for gamejournal_backend (dev/prod ready).
"""
from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url
from datetime import timedelta

# --- Paths / env -------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")  # loads RAWG_API_KEY, etc.

# Toggle by environment (falls back to safe dev defaults)
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure--wgd1bi#p#3nkxyddihrgc$(5iz&mpm2fyud595mgrj!#!g2&",  # dev only
)
ALLOWED_HOSTS = [h for h in os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h]

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),   # was 5m by default
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),     # keep user logged in
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- Apps --------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # 3rd party
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",

    # local
    "core",
]

# --- Middleware --------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",        # keep first
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # for static files in prod
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# CORS: allow all in dev; in prod, read allowed origins from env
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    CORS_ALLOWED_ORIGINS = [o for o in origins.split(",") if o]

# --- DRF / OpenAPI -----------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "GameJournal API",
    "VERSION": "0.1.0",
}

# --- SSO / Auth feature flags ------------------------------------------------
# If set, Google SSO will verify ID tokens against this client ID.
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")

# If True, only emails listed in ALLOWED_EMAILS can sign in (good for private demo).
# If False (default), any Google account can sign in.
ENFORCE_ALLOWLIST = os.getenv("ENFORCE_ALLOWLIST", "false").lower() == "true"
ALLOWED_EMAILS = {e.strip().lower() for e in os.getenv("ALLOWED_EMAILS", "").split(",") if e.strip()}

# Toggle password-based registration in production (keep False for SSO-only prod).
ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "false").lower() == "true"

ROOT_URLCONF = "gamejournal_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "gamejournal_backend.wsgi.application"

# --- Database (SQLite in dev; Postgres in prod via DATABASE_URL) ------------
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

# --- Auth --------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- i18n --------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Jerusalem"
USE_I18N = True
USE_TZ = True

# --- Static (admin assets) ---------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Use hashed/compressed static files in prod (requires collectstatic)
if not DEBUG:
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
