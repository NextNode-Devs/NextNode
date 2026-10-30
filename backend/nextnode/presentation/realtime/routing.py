from django.urls import path

from nextnode.presentation.realtime.consumer import RealtimeConsumer

websocket_urlpatterns = [path("ws/", RealtimeConsumer.as_asgi())]
