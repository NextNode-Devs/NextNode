"""Assistant Lead and inactivity on developer projects (NN-39).

- The Team Lead chooses one Assistant Lead from the members.
- The Lead or the Assistant Lead may close the project.
- A daily run (``RunActivityChecks``) asks the members "Is this project still
  active?" once the Lead has been silent in the project chat for 30 days, and
  closes the project if nobody answers within 7 days. While a check waits, the
  project is hidden from the open-projects feed (``ProjectRepository.search``).
- The first member to confirm becomes Assistant Lead if there is none yet.

Client projects are never affected: they have no Assistant Lead.
"""

from __future__ import annotations

from datetime import datetime

from nextnode.application.access import AccessPolicy, ResourceRef
from nextnode.application.conversations.ports import AccountNames, Clock, ConversationEvents, UnitOfWork
from nextnode.application.ports import Actor
from nextnode.application.projects.ports import ProjectRecord, ProjectRepository
from nextnode.application.stewardship.dto import (
    ASSISTANT_LEAD_CAN,
    ASSISTANT_LEAD_CANNOT,
    ActivityCheckView,
    ActivityRunReport,
    PermissionView,
    PersonView,
    StewardshipActions,
    StewardshipView,
    check_due_at,
    team_updated_frame,
)
from nextnode.application.stewardship.ports import ActivityChecks, LeadActivity
from nextnode.domain.errors import ConflictError, ForbiddenError, NotFoundError
from nextnode.domain.projects import ActivityCheck, inactive_since

PROJECT_NOT_FOUND = "Project not found."
CLIENT_PROJECT = "Client projects have no Assistant Lead; only developer projects do."


class StewardshipDeps:
    def __init__(
        self,
        projects: ProjectRepository,
        checks: ActivityChecks,
        activity: LeadActivity,
        names: AccountNames,
        events: ConversationEvents,
        policy: AccessPolicy,
        clock: Clock,
        uow: UnitOfWork,
    ) -> None:
        self.projects = projects
        self.checks = checks
        self.activity = activity
        self.names = names
        self.events = events
        self.policy = policy
        self.clock = clock
        self.uow = uow

    def load(self, project_id: int, *, for_update: bool = False) -> ProjectRecord:
        record = (self.projects.get_for_update if for_update else self.projects.get)(project_id)
        if record is None:
            raise NotFoundError(PROJECT_NOT_FOUND)
        if record.project.is_client_project:
            raise ConflictError(CLIENT_PROJECT)
        return record

    def baseline(self, project_id: int) -> datetime | None:
        """Since when the Lead counts as silent: their latest workspace message
        (or the chat's opening), but never before the last check ended."""
        last = self.activity.last_active_at(project_id)
        latest = self.checks.latest_for(project_id)
        if last is not None and latest is not None and latest.ended_at is not None:
            return max(last, latest.ended_at)
        return last

    def announce(self, record: ProjectRecord, reason: str) -> None:
        assert record.project.id is not None
        self.events.publish(record.team.participant_ids, team_updated_frame(record.project.id, reason))

    def view(self, record: ProjectRecord, actor: Actor) -> StewardshipView:
        project, team = record.project, record.team
        assert project.id is not None
        check = self.checks.latest_for(project.id)
        people = set(team.participant_ids)
        if check is not None and check.answered_by_account_id is not None:
            people.add(check.answered_by_account_id)
        names = self.names.names(sorted(people))
        me = actor.account_id
        pending = check is not None and check.is_pending
        assistant = team.assistant_lead_account_id
        return StewardshipView(
            project_id=project.id,
            project_status=project.status.value,
            assistant_lead=PersonView(assistant, names.get(assistant, "Unknown")) if assistant else None,
            assistant_lead_can=[PermissionView(label, available) for label, available in ASSISTANT_LEAD_CAN],
            assistant_lead_cannot=list(ASSISTANT_LEAD_CANNOT),
            lead_last_active_at=_iso(self.activity.last_active_at(project.id)),
            activity_check_due_at=check_due_at(self.baseline(project.id)) if project.is_open else None,
            activity_check=ActivityCheckView.of(check, names) if check else None,
            hidden_from_feed=pending,
            members=[PersonView(m, names.get(m, "Unknown")) for m in team.member_account_ids],
            actions=StewardshipActions(
                choose_assistant_lead=project.is_open and team.is_lead(me) and bool(team.member_account_ids),
                confirm_active=pending and (team.is_member(me) or team.is_lead(me)),
                close_project=project.is_open and team.is_steward(me),
            ),
        )


def _iso(at: datetime | None) -> str | None:
    return at.isoformat() if at else None


class GetStewardship:
    """The Assistant Lead and the activity check, for the project's own team only."""

    def __init__(self, deps: StewardshipDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> StewardshipView:
        self._d.policy.check(actor, "read", ResourceRef("project_team", project_id))
        return self._d.view(self._d.load(project_id), actor)


class ChooseAssistantLead:
    """The Team Lead picks one member; choosing again replaces them."""

    def __init__(self, deps: StewardshipDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int, member_account_id: int) -> StewardshipView:
        self._d.policy.check(actor, "steward", ResourceRef("project_team", project_id))
        with self._d.uow.atomic():
            record = self._d.load(project_id, for_update=True)
            if not record.project.is_open:
                raise ConflictError(f"This project is {record.project.status}, so its team can't change.")
            team = record.team.with_assistant_lead(actor.account_id, member_account_id)
            self._d.projects.save_team(team)
            record = self._d.load(project_id)
            self._d.announce(record, "assistant_lead")
        return self._d.view(record, actor)


class ConfirmProjectActive:
    """A member answers "Yes, still active". The first member to confirm becomes
    Assistant Lead if the team has none, and the project returns to the feed."""

    def __init__(self, deps: StewardshipDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> StewardshipView:
        self._d.policy.check(actor, "read", ResourceRef("project_team", project_id))
        assert actor.account_id is not None
        with self._d.uow.atomic():
            record = self._d.load(project_id, for_update=True)
            check = self._d.checks.latest_for(project_id)
            if check is None or not check.is_pending:
                raise ConflictError("Nobody has been asked whether this project is still active.")
            answered = check.confirm(record.team, actor.account_id, self._d.clock.now())
            self._d.checks.save(answered)
            team = record.team
            if team.is_member(actor.account_id) and team.assistant_lead_account_id is None:
                self._d.projects.save_team(team.elect_assistant_lead(actor.account_id))
            record = self._d.load(project_id)
            self._d.announce(record, "activity_confirmed")
        return self._d.view(record, actor)


class CloseDeveloperProject:
    """The Team Lead or the Assistant Lead marks a developer project closed."""

    def __init__(self, deps: StewardshipDeps) -> None:
        self._d = deps

    def execute(self, actor: Actor, project_id: int) -> StewardshipView:
        self._d.policy.check(actor, "steward", ResourceRef("project_team", project_id))
        with self._d.uow.atomic():
            record = self._d.load(project_id, for_update=True)
            if not record.team.is_steward(actor.account_id):
                raise ForbiddenError("Only the Team Lead or the Assistant Lead can close this project.")
            self._d.projects.save(record.project.close())
            check = self._d.checks.latest_for(project_id)
            if check is not None and check.is_pending:
                self._d.checks.save(check.cancel(self._d.clock.now()))
            record = self._d.load(project_id)
            self._d.announce(record, "project_closed")
        return self._d.view(record, actor)


class RunActivityChecks:
    """The daily job (``manage.py check_project_activity``). Safe to run more
    often: each step only acts once its deadline has passed."""

    def __init__(self, deps: StewardshipDeps) -> None:
        self._d = deps

    def execute(self, now: datetime | None = None) -> ActivityRunReport:
        at = now or self._d.clock.now()
        report = ActivityRunReport(asked=[], closed=[], lead_returned=[])
        for check in self._d.checks.pending():
            self._settle(check, at, report)
        waiting = {check.project_id for check in self._d.checks.pending()}
        for project_id in self._d.activity.open_developer_projects():
            if project_id not in waiting:
                self._maybe_ask(project_id, at, report)
        return report

    def _settle(self, check: ActivityCheck, at: datetime, report: ActivityRunReport) -> None:
        with self._d.uow.atomic():
            record = self._d.projects.get_for_update(check.project_id)
            last = self._d.activity.last_active_at(check.project_id)
            if record is None or not record.project.is_open:
                self._d.checks.save(check.cancel(at))
                return
            if last is not None and last > check.started_at:
                self._d.checks.save(check.lead_returned(at))
                report.lead_returned.append(check.project_id)
            elif check.is_overdue(at):
                self._d.checks.save(check.expire(at))
                self._d.projects.save(record.project.close())
                report.closed.append(check.project_id)
            else:
                return
            self._d.announce(record, "activity_check")

    def _maybe_ask(self, project_id: int, at: datetime, report: ActivityRunReport) -> None:
        baseline = self._d.baseline(project_id)
        if baseline is None or not inactive_since(baseline, at):
            return
        with self._d.uow.atomic():
            record = self._d.projects.get_for_update(project_id)
            if record is None or not record.project.is_open or record.project.is_client_project:
                return
            self._d.checks.add(ActivityCheck.ask(project_id, at))
            self._d.announce(record, "activity_check")
        report.asked.append(project_id)


class StewardshipUseCases:
    """Built once, so the container wires one property."""

    def __init__(self, deps: StewardshipDeps) -> None:
        self.get = GetStewardship(deps)
        self.choose_assistant_lead = ChooseAssistantLead(deps)
        self.confirm_active = ConfirmProjectActive(deps)
        self.close_project = CloseDeveloperProject(deps)
        self.run_activity_checks = RunActivityChecks(deps)
