from django.urls import include, path

from nextnode.presentation.api import errors

urlpatterns = [
    path("api/", include("nextnode.presentation.api.urls")),
]

handler404 = errors.not_found
handler500 = errors.server_error
