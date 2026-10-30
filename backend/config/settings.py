"""Django settings. Values come from ``config.env``; never read os.environ here."""

from config import env as env_module

ENV = env_module.load()

BASE_DIR = env_module.BASE_DIR
SECRET_KEY = ENV.secret_key
DEBUG = ENV.debug
ALLOWED_HOSTS = list(ENV.allowed_hosts)

INSTALLED_APPS = [
    # First, so `runserver` serves the ASGI app (HTTP + WebSockets).
    "daphne",
    "channels",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "nextnode.infrastructure.persistence",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES: list[dict] = []

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": ENV.database.name,
        "USER": ENV.database.user,
        "PASSWORD": ENV.database.password,
        "HOST": ENV.database.host,
        "PORT": ENV.database.port,
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
        "ATOMIC_REQUESTS": False,
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True
STATIC_URL = "static/"

# --- API -------------------------------------------------------------------
# Authentication is a Clerk session token sent as `Authorization: Bearer`.
# SessionAuthentication is deliberately absent: no API endpoint is authorised
# by a cookie, so browsers cannot be tricked into sending credentials (CSRF).
# See docs/decisions/auth-cors-csrf.md before adding any cookie-based auth.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "nextnode.presentation.api.authentication.ClerkBearerAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "nextnode.presentation.api.exception_handler.handle_exception",
    "UNAUTHENTICATED_USER": None,
}

# --- Real time (#1) ----------------------------------------------------------
# Redis carries socket events between backend processes. Unit tests swap in
# the in-memory layer (tests/conftest.py); docs/proposals/realtime-messaging.md.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [ENV.redis_url]},
    }
}

# --- CORS / CSRF -----------------------------------------------------------
CORS_ALLOWED_ORIGINS = list(ENV.frontend_origins)
CORS_URLS_REGEX = r"^/api/.*$"
CORS_ALLOW_CREDENTIALS = False
CSRF_TRUSTED_ORIGINS = list(ENV.frontend_origins)
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

# --- Transport security ----------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
if ENV.is_production:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True

# --- Logging ---------------------------------------------------------------
# Never log request headers or bodies: they carry bearer tokens and personal data.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"django.request": {"level": "ERROR"}},
}
