"""
Django settings for GameJournal (Railway backend + Netlify frontend).
"""
from pathlib import Path
from datetime import timedelta
import os

import dj_database_url
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# Paths / env
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DEBUG", "False").lower() == "true"

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-change-me",  # dev fallback
)

# Railway host + custom ALLOWED_HOSTS
_default_allowed = ["127.0.0.1", "localhost"]
railway_host = os.getenv("RAILWAY_PUBLIC_DOMAIN") or os.getenv("RAILWAY_URL")
if railway_host:
    _default_allowed.append(railway_host.replace("https://", "").replace("http://", ""))
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("ALLOWED_HOSTS", ",".join(_default_allowed)).split(",")
    if h.strip()
]

# -----------------------------------------------------------------------------
# Apps
# -----------------------------------------------------------------------------
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # 3rd-party
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",

    # Local apps
    "core",
]

# Optional Cloudinary (only if CLOUDINARY_URL is set)
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()
USE_CLOUDINARY = bool(CLOUDINARY_URL)
if USE_CLOUDINARY:
    INSTALLED_APPS += ["cloudinary", "cloudinary_storage"]

# -----------------------------------------------------------------------------
# Middleware (CORS FIRST)
# -----------------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",        # MUST be at top
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # static
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# -----------------------------------------------------------------------------
# CORS / CSRF (domain list covers Netlify + custom domain)
# -----------------------------------------------------------------------------
_default_frontend_origins = [
    "https://www.gamejournal.online",
    "https://gamejournal.online",
    "https://agamejournal.netlify.app",
    "http://localhost:5173",
]

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        o.strip() for o in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            ",".join(_default_frontend_origins)
        ).split(",") if o.strip()
    ]

# Preflight/credentials
CORS_ALLOW_CREDENTIALS = True


# CSRF must use scheme+host
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv(
        "CSRF_TRUSTED_ORIGINS",
        "https://www.gamejournal.online,https://gamejournal.online,https://agamejournal.netlify.app"
    ).split(",") if o.strip()
]

# If you use cookie-based auth anywhere:
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SAMESITE = "None"

# -----------------------------------------------------------------------------
# DRF / JWT / OpenAPI
# -----------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "AUTH_HEADER_TYPES": ("Bearer",),
}
SPECTACULAR_SETTINGS = {"TITLE": "GameJournal API", "VERSION": "0.1.0"}

# -----------------------------------------------------------------------------
# Google Sign-In (allow multiple client IDs)
# -----------------------------------------------------------------------------
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
GOOGLE_OAUTH_CLIENT_IDS = {
    s.strip() for s in os.getenv(
        "GOOGLE_OAUTH_CLIENT_IDS",
        GOOGLE_OAUTH_CLIENT_ID
    ).split(",") if s.strip()
}
ENFORCE_ALLOWLIST = os.getenv("ENFORCE_ALLOWLIST", "false").lower() == "true"
ALLOWED_EMAILS = {
    e.strip().lower() for e in os.getenv("ALLOWED_EMAILS", "").split(",") if e.strip()
}

# -----------------------------------------------------------------------------
# URLs / WSGI
# -----------------------------------------------------------------------------
ROOT_URLCONF = "gamejournal_backend.urls"
WSGI_APPLICATION = "gamejournal_backend.wsgi.application"

TEMPLATES = [{
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
}]

# -----------------------------------------------------------------------------
# Database (SQLite local; Postgres via DATABASE_URL on Railway)
# -----------------------------------------------------------------------------
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

# -----------------------------------------------------------------------------
# Auth validators
# -----------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# -----------------------------------------------------------------------------
# i18n
# -----------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

# -----------------------------------------------------------------------------
# Static / Media / Storage
# -----------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

if USE_CLOUDINARY:
    STORAGES = {
        "default": {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }
    os.environ.setdefault("CLOUDINARY_SECURE", "true")
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }

# -----------------------------------------------------------------------------
# Security / proxy headers (Railway behind TLS)
# -----------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
