"""The activity check's table (NN-39). Kept out of ``models.py`` for its
500-line limit; ``models.py`` imports it so Django registers it with the app."""

from django.db import models
from django.db.models import F, Q

from nextnode.infrastructure.persistence.models import AccountModel, ProjectModel


class ActivityCheckModel(models.Model):
    """One "Is this project still active?" question on a developer project.
    At most one is pending per project; ended ones are kept as history."""

    class Status(models.TextChoices):
        PENDING = "pending"
        CONFIRMED = "confirmed"
        LEAD_RETURNED = "lead_returned"
        CLOSED = "closed"

    project = models.ForeignKey(ProjectModel, on_delete=models.PROTECT, related_name="activity_checks")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    started_at = models.DateTimeField()
    answer_by = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    answered_by = models.ForeignKey(
        AccountModel, on_delete=models.PROTECT, related_name="activity_checks_answered", null=True, blank=True
    )

    class Meta:
        db_table = "project_activity_check"
        ordering = ("project_id", "started_at", "id")
        constraints = (
            models.UniqueConstraint(
                fields=["project"], condition=Q(status="pending"), name="activity_check_one_pending"
            ),
            models.CheckConstraint(
                condition=Q(status="pending", ended_at__isnull=True)
                | (~Q(status="pending") & Q(ended_at__isnull=False)),
                name="activity_check_ended_at_matches_status",
            ),
            models.CheckConstraint(
                condition=Q(answer_by__gt=F("started_at")), name="activity_check_answer_after_start"
            ),
        )

    def __str__(self) -> str:
        return f"activity check {self.id} on project {self.project_id} ({self.status})"
