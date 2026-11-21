"""Portfolio certificates (NN-34, #102). Kept out of ``models.py`` for its
500-line limit; ``models.py`` imports it so Django registers it with the app."""

import uuid

from django.db import models
from django.db.models import Q

from nextnode.infrastructure.persistence.models import AccountModel


class CertificateModel(models.Model):
    """A PDF certificate a developer uploaded to their portfolio. The bytes live
    in ``FileStorage`` under ``storage_key``; ``filename`` is for display only."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    developer = models.ForeignKey(AccountModel, on_delete=models.CASCADE, related_name="certificates")
    storage_key = models.CharField(max_length=64, unique=True)
    filename = models.CharField(max_length=200)
    size_bytes = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField()

    class Meta:
        db_table = "developer_certificate"
        ordering = ("uploaded_at", "id")
        constraints = (models.CheckConstraint(condition=Q(size_bytes__gt=0), name="certificate_not_empty"),)

    def __str__(self) -> str:
        return self.filename
