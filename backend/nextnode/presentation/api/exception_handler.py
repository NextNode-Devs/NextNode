"""The single place errors become HTTP responses.

Shape: ``{"error": {"code", "message", "fields"?}}``. Unknown exceptions are
logged server-side and answered with a generic 500 that reveals nothing.
"""

import logging

from django.http import Http404
from rest_framework import exceptions as drf
from rest_framework.response import Response

from nextnode.application.payments.ports import InvalidWebhookError, PaymentsUnavailableError
from nextnode.domain import errors as domain
from nextnode.domain.payments import PaymentMismatchError

logger = logging.getLogger(__name__)

DOMAIN_STATUS = {
    domain.ValidationError: 400,
    domain.ForbiddenError: 403,
    domain.NotFoundError: 404,
    domain.ConflictError: 409,
    domain.InvalidStateTransitionError: 409,
    PaymentMismatchError: 400,
}


def error_body(code: str, message: str, fields: dict | None = None) -> dict:
    error: dict = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def _flatten(detail) -> dict[str, list[str]]:
    if isinstance(detail, dict):
        return {
            key: [str(item) for item in (value if isinstance(value, list) else [value])]
            for key, value in detail.items()
        }
    return {"non_field_errors": [str(item) for item in (detail if isinstance(detail, list) else [detail])]}


def handle_exception(exc: Exception, context: dict) -> Response:
    if isinstance(exc, domain.DomainError):
        status = DOMAIN_STATUS.get(type(exc), 400)
        fields = exc.fields if isinstance(exc, domain.ValidationError) else None
        return Response(error_body(exc.code, exc.message, fields), status=status)

    if isinstance(exc, InvalidWebhookError):
        return Response(error_body("INVALID_WEBHOOK", str(exc)), status=400)

    if isinstance(exc, PaymentsUnavailableError):
        return Response(error_body("PAYMENTS_UNAVAILABLE", str(exc)), status=503)

    if isinstance(exc, Http404):
        exc = drf.NotFound()

    if isinstance(exc, drf.ValidationError):
        return Response(
            error_body("VALIDATION_ERROR", "Some fields need attention.", _flatten(exc.detail)), status=400
        )

    if isinstance(exc, drf.APIException):
        codes = {
            drf.NotAuthenticated: "UNAUTHENTICATED",
            drf.AuthenticationFailed: "UNAUTHENTICATED",
            drf.PermissionDenied: "FORBIDDEN",
            drf.NotFound: "NOT_FOUND",
            drf.MethodNotAllowed: "METHOD_NOT_ALLOWED",
            drf.UnsupportedMediaType: "UNSUPPORTED_MEDIA_TYPE",
            drf.ParseError: "PARSE_ERROR",
            drf.Throttled: "RATE_LIMITED",
        }
        code = next((value for cls, value in codes.items() if isinstance(exc, cls)), "ERROR")
        response = Response(error_body(code, str(exc.detail)), status=exc.status_code)
        if getattr(exc, "auth_header", None):
            response["WWW-Authenticate"] = exc.auth_header
        return response

    logger.exception("Unhandled error in %s", context.get("view").__class__.__name__)
    return Response(error_body("INTERNAL_ERROR", "Something went wrong on our side."), status=500)
