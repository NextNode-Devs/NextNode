"""Every Hire Devs use case, built once from the shared collaborators, so the
container wires one property (``container.teams``) instead of one per action."""

from __future__ import annotations

from nextnode.application.teams.deps import TeamDeps
from nextnode.application.teams.membership import (
    AcceptApplication,
    AcceptInvitation,
    DeclineInvitation,
    RejectApplication,
    WithdrawApplication,
)
from nextnode.application.teams.recruiting import (
    ApplyToJoinTeam,
    CloseRecruitment,
    InviteDeveloper,
    SetTeamSize,
)


class TeamUseCases:
    def __init__(self, deps: TeamDeps) -> None:
        self.set_team_size = SetTeamSize(deps)
        self.apply_to_join = ApplyToJoinTeam(deps)
        self.accept_application = AcceptApplication(deps)
        self.reject_application = RejectApplication(deps)
        self.withdraw_application = WithdrawApplication(deps)
        self.invite_developer = InviteDeveloper(deps)
        self.accept_invitation = AcceptInvitation(deps)
        self.decline_invitation = DeclineInvitation(deps)
        self.close_recruitment = CloseRecruitment(deps)
