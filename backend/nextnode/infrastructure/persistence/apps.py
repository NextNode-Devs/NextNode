from django.apps import AppConfig


class PersistenceConfig(AppConfig):
    """Django app holding the ORM models and migrations. ORM models are not
    domain entities; repository adapters in this package map between them."""

    name = "nextnode.infrastructure.persistence"
    label = "nextnode"
    default_auto_field = "django.db.models.BigAutoField"
