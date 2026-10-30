from django.urls import path

from nextnode.presentation.realtime import conversations
from nextnode.presentation.realtime.consumer import RealtimeConsumer

conversations.register()  # #4: message.send

websocket_urlpatterns = [path("ws/", RealtimeConsumer.as_asgi())]
