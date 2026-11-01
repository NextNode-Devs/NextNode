"""The start gate's tables (#6). Kept out of ``models.py`` for its 500-line
limit; ``models.py`` imports them so Django registers them with the app."""

from django.db import models
from django.db.models import F, Q

from nextnode.infrastructure.persistence.models import AccountModel, ProjectModel


class OfferModel(models.Model):
    """One signed version of the Team Lead's offer on a client project. Its
    terms and signature are written once; the client's decision is written
    once more (``sent`` -> ``accepted`` | ``declined``) and never again. The
    id is the "offer version id" a deposit (#7) is paid against."""

    class Status(models.TextChoices):
        SENT = "sent"
        ACCEPTED = "accepted"
        DECLINED = "declined"

    project = models.ForeignKey(ProjectModel, on_delete=models.PROTECT, related_name="offers")
    version = models.PositiveIntegerField()
    summary = models.TextField(max_length=2000)
    total_cents = models.PositiveIntegerField()  # CAD
    start_date = models.DateField()
    delivery_date = models.DateField()
    signed_by = models.ForeignKey(AccountModel, on_delete=models.PROTECT, related_name="offers_signed")
    signed_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SENT)
    decided_by = models.ForeignKey(
        AccountModel, on_delete=models.PROTECT, related_name="offers_decided", null=True, blank=True
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "project_offer"
        ordering = ("project_id", "version")
        constraints = (
            models.UniqueConstraint(fields=["project", "version"], name="offer_version_once"),
            models.UniqueConstraint(fields=["project"], condition=Q(status="sent"), name="offer_one_open"),
            models.UniqueConstraint(
                fields=["project"], condition=Q(status="accepted"), name="offer_one_accepted"
            ),
            models.CheckConstraint(condition=Q(total_cents__gte=150_000), name="offer_total_minimum"),
            models.CheckConstraint(
                condition=Q(delivery_date__gt=F("start_date")), name="offer_delivery_after_start"
            ),
            models.CheckConstraint(
                condition=Q(
                    status="sent", decided_by__isnull=True, decided_at__isnull=True, decline_reason=""
                )
                | Q(status="accepted", decided_by__isnull=False, decided_at__isnull=False, decline_reason="")
                | (
                    Q(status="declined", decided_by__isnull=False, decided_at__isnull=False)
                    & ~Q(decline_reason="")
                ),
                name="offer_decision_matches_status",
            ),
        )

    def __str__(self) -> str:
        return f"offer v{self.version} on project {self.project_id} ({self.status})"


class ProjectTimelineModel(models.Model):
    """A developer idea's finalised timeline: recorded once, and it started the project."""

    project = models.OneToOneField(ProjectModel, on_delete=models.PROTECT, related_name="timeline")
    start_date = models.DateField()
    delivery_date = models.DateField()
    finalised_by = models.ForeignKey(
        AccountModel, on_delete=models.PROTECT, related_name="timelines_finalised"
    )
    finalised_at = models.DateTimeField()

    class Meta:
        db_table = "project_timeline"
        constraints = (
            models.CheckConstraint(
                condition=Q(delivery_date__gt=F("start_date")), name="timeline_delivery_after_start"
            ),
        )

    def __str__(self) -> str:
        return f"timeline of project {self.project_id}"
