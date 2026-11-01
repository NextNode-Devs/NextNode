"""Transport validation for projects (#3): shape and types only. Lengths, the
tech stack rules, the delivery date and the minimum budget live in the domain,
which names the field each error belongs to."""

from rest_framework import serializers

from nextnode.application.projects.commands import ProjectCommand
from nextnode.presentation.api.account_serializers import StrictSerializer

# A generous outer bound; the real limit (20 technologies) comes from the domain.
_LIST_BOUND = 50


def _text() -> serializers.CharField:
    return serializers.CharField(allow_blank=True, trim_whitespace=False)


class _ProjectSerializer(StrictSerializer):
    title = _text()
    description = _text()
    tech_stack = serializers.ListField(child=_text(), max_length=_LIST_BOUND)
    target_delivery_date = serializers.DateField()

    def to_command(self) -> ProjectCommand:
        data = self.validated_data
        return ProjectCommand(
            title=data["title"],
            description=data["description"],
            tech_stack=data["tech_stack"],
            target_delivery_date=data["target_delivery_date"],
            proposed_budget_cents=data.get("proposed_budget_cents"),
        )


class ClientBriefSerializer(_ProjectSerializer):
    proposed_budget_cents = serializers.IntegerField(allow_null=True, required=False, default=None)


class ProjectIdeaSerializer(_ProjectSerializer):
    """No budget field at all: sending one is refused as an unknown field."""


def project_serializer_for(kind: str) -> type[_ProjectSerializer]:
    return ClientBriefSerializer if kind == "client" else ProjectIdeaSerializer
