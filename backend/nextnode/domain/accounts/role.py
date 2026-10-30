from enum import StrEnum


class Role(StrEnum):
    """Chosen once at onboarding. Team Lead is per project, never a role."""

    DEVELOPER = "developer"
    CLIENT = "client"
