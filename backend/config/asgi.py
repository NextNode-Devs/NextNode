"""HTTP and WebSockets (#1). The socket accepts only the frontend's Origin and
reads no cookies: it authenticates from the first frame (see consumer.py)."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Load Django before importing anything that touches models.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

from nextnode.presentation.realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": OriginValidator(URLRouter(websocket_urlpatterns), list(settings.ENV.frontend_origins)),
    }
)
