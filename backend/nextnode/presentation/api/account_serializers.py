"""Transport validation for onboarding: shape and types only. The rules
(lengths, skill normalisation, role/profile match) live in the domain."""

from rest_framework import serializers

from nextnode.application.accounts.onboarding import ClientDetails, DeveloperDetails, OnboardingCommand


class StrictSerializer(serializers.Serializer):
    """Refuses keys it does not know, so nothing extra can ride along."""

    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError(
                    {key: ["This field is not accepted."] for key in sorted(unknown)}
                )
        return super().to_internal_value(data)


class ClientDetailsSerializer(StrictSerializer):
    company_name = serializers.CharField(allow_blank=True, trim_whitespace=False)
    industry = serializers.CharField(allow_blank=True, trim_whitespace=False)


class DeveloperDetailsSerializer(StrictSerializer):
    headline = serializers.CharField(allow_blank=True, trim_whitespace=False)
    bio = serializers.CharField(allow_blank=True, trim_whitespace=False, required=False, default="")
    github_username = serializers.CharField(allow_blank=True, allow_null=True, required=False, default=None)
    skills = serializers.ListField(child=serializers.CharField(allow_blank=True, trim_whitespace=False))


class OnboardingSerializer(StrictSerializer):
    role = serializers.CharField()
    display_name = serializers.CharField(allow_blank=True, trim_whitespace=False)
    client = ClientDetailsSerializer(required=False)
    developer = DeveloperDetailsSerializer(required=False)

    def to_command(self) -> OnboardingCommand:
        data = self.validated_data
        client = data.get("client")
        developer = data.get("developer")
        return OnboardingCommand(
            role=data["role"],
            display_name=data["display_name"],
            client=ClientDetails(**client) if client is not None else None,
            developer=DeveloperDetails(**developer) if developer is not None else None,
        )
