"""Notifications and their settings (A3, #177; NN-19 #89). Kept out of
``models.py`` for its 500-line limit; ``models.py`` imports this module so
Django registers it."""

from django.db import models
from django.db.models import Q

from nextnode.infrastructure.persistence.models import AccountModel

CATEGORIES = ["hiring", "team", "projects", "payments", "messages"]


class NotificationModel(models.Model):
    """One notification for one person. Written once; only ``read_at`` changes."""

    recipient = models.ForeignKey(AccountModel, on_delete=models.CASCADE, related_name="notifications")
    category = models.CharField(max_length=16)
    kind = models.CharField(max_length=48)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=500)
    link = models.CharField(max_length=300, blank=True)  # an app path such as /projects/12
    created_at = models.DateTimeField()
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notification"
        ordering = ("-created_at", "-id")
        indexes = (models.Index(fields=["recipient", "-created_at"], name="notification_inbox"),)
        constraints = (
            models.CheckConstraint(condition=Q(category__in=CATEGORIES), name="notification_category_valid"),
            models.CheckConstraint(
                condition=Q(link="") | Q(link__startswith="/"), name="notification_link_is_path"
            ),
        )

    def __str__(self) -> str:
        return f"{self.kind} for {self.recipient_id}"


class NotificationSettingModel(models.Model):
    """A person's choice for one category. Only categories they've changed are
    stored; the rest use the defaults in ``application.notifications``."""

    account = models.ForeignKey(AccountModel, on_delete=models.CASCADE, related_name="notification_settings")
    category = models.CharField(max_length=16)
    in_app = models.BooleanField()
    email = models.BooleanField()

    class Meta:
        db_table = "notification_setting"
        constraints = (
            models.UniqueConstraint(fields=["account", "category"], name="notification_setting_once"),
            models.CheckConstraint(
                condition=Q(category__in=CATEGORIES), name="notification_setting_category_valid"
            ),
        )

    def __str__(self) -> str:
        return f"{self.category} settings for {self.account_id}"
