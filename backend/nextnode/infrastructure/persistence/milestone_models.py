"""Milestones on an offer version (A1, #175). Kept out of ``models.py`` for its
500-line limit; ``models.py`` imports this module so Django registers it.

Rows are written with their offer version and never re-planned: a new plan is
a new version. A2 (#176) moves ``status`` and adds the review history."""

from django.db import models
from django.db.models import Q

from nextnode.infrastructure.persistence.models import AccountModel
from nextnode.infrastructure.persistence.start_gate_models import OfferModel


class MilestoneModel(models.Model):
    class Status(models.TextChoices):
        PENDING_DEPOSIT = "pending_deposit"
        NOT_STARTED = "not_started"
        IN_PROGRESS = "in_progress"
        UNDER_REVIEW = "under_review"
        COMPLETED = "completed"

    offer = models.ForeignKey(OfferModel, on_delete=models.PROTECT, related_name="milestones")
    sequence = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=1000, blank=True)
    amount_cents = models.PositiveIntegerField()  # CAD
    due_date = models.DateField()
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING_DEPOSIT, db_default="pending_deposit"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)  # A2: the latest submission
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "offer_milestone"
        ordering = ("offer_id", "sequence")
        constraints = (
            models.UniqueConstraint(fields=["offer", "sequence"], name="milestone_sequence_once"),
            models.CheckConstraint(
                condition=Q(sequence__gte=1, sequence__lte=10), name="milestone_sequence_range"
            ),
            models.CheckConstraint(condition=Q(amount_cents__gt=0), name="milestone_amount_positive"),
        )

    def __str__(self) -> str:
        return f"milestone {self.sequence} of offer {self.offer_id}"


class MilestoneReviewModel(models.Model):
    """One step of a milestone's review loop (A2, #176): written once, never edited."""

    class Kind(models.TextChoices):
        SUBMITTED = "submitted"
        REVISION_REQUESTED = "revision_requested"
        APPROVED = "approved"

    milestone = models.ForeignKey(MilestoneModel, on_delete=models.PROTECT, related_name="reviews")
    kind = models.CharField(max_length=24, choices=Kind.choices)
    note = models.TextField(max_length=2000, blank=True)
    link_url = models.URLField(max_length=500, blank=True)
    author = models.ForeignKey(AccountModel, on_delete=models.PROTECT, related_name="milestone_reviews")
    author_role = models.CharField(max_length=8)  # client | lead
    created_at = models.DateTimeField()

    class Meta:
        db_table = "milestone_review"
        ordering = ("created_at", "id")
        constraints = (
            models.CheckConstraint(
                condition=Q(author_role__in=["client", "lead"]), name="review_author_role_valid"
            ),
            # The Lead submits; the client approves or asks for changes.
            models.CheckConstraint(
                condition=Q(kind="submitted", author_role="lead")
                | Q(kind__in=["revision_requested", "approved"], author_role="client"),
                name="review_kind_matches_author",
            ),
        )

    def __str__(self) -> str:
        return f"{self.kind} on milestone {self.milestone_id}"
