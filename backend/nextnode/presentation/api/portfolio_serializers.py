"""Transport validation for the portfolio (#2): shape and types only. Lengths,
link format, skill rules and the project cap live in the domain, which names
the field each error belongs to."""

from rest_framework import serializers

from nextnode.application.accounts.portfolio import PortfolioCommand, ProjectLinkInput
from nextnode.presentation.api.account_serializers import StrictSerializer

# Generous outer bounds so a request can't make us loop over thousands of items;
# the real limits (6 projects, 20 skills) come from the domain with clearer messages.
_LIST_BOUND = 50


def _text(**options) -> serializers.CharField:
    return serializers.CharField(allow_blank=True, trim_whitespace=False, **options)


class ProjectLinkSerializer(StrictSerializer):
    title = _text()
    repository_url = _text()
    demo_url = _text(allow_null=True, required=False, default=None)


class PortfolioSerializer(StrictSerializer):
    headline = _text()
    bio = _text(required=False, default="")
    github_username = _text(allow_null=True, required=False, default=None)
    skills = serializers.ListField(child=_text(), max_length=_LIST_BOUND)
    projects = serializers.ListField(child=ProjectLinkSerializer(), max_length=_LIST_BOUND)
    resume_url = _text(allow_null=True, required=False, default=None)
    is_available = serializers.BooleanField()

    def to_command(self) -> PortfolioCommand:
        data = self.validated_data
        return PortfolioCommand(
            headline=data["headline"],
            bio=data["bio"],
            github_username=data["github_username"],
            skills=data["skills"],
            projects=[ProjectLinkInput(**project) for project in data["projects"]],
            resume_url=data["resume_url"],
            is_available=data["is_available"],
        )
