"""Team invitation links (A4, #178). Kept out of ``models.py`` for its 500-line
limit; ``models.py`` imports this module so Django registers it."""

from django.db import models
from django.db.models import F, Q

from nextnode.infrastructure.persistence.models import AccountModel, ProjectModel


class InviteLinkModel(models.Model):
    project = models.ForeignKey(ProjectModel, on_delete=models.CASCADE, related_name="invite_links")
    token = models.CharField(max_length=64, unique=True)  # 256 random bits, URL-safe
    created_by = models.ForeignKey(AccountModel, on_delete=models.PROTECT, related_name="invite_links_made")
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(
        AccountModel, on_delete=models.PROTECT, related_name="invite_links_used", null=True, blank=True
    )
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "team_invite_link"
        ordering = ("-created_at", "-id")
        constraints = (
            # One live link per team: a new one stops the old one first.
            models.UniqueConstraint(
                fields=["project"],
                condition=Q(used_at__isnull=True, revoked_at__isnull=True),
                name="invite_link_one_live",
            ),
            models.CheckConstraint(
                condition=Q(expires_at__gt=F("created_at")), name="invite_link_expires_later"
            ),
            models.CheckConstraint(
                condition=Q(used_at__isnull=True, used_by__isnull=True)
                | Q(used_at__isnull=False, used_by__isnull=False),
                name="invite_link_used_by_whom",
            ),
        )

    def __str__(self) -> str:
        return f"invite link for project {self.project_id}"
