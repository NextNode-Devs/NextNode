"""Stand-in for #3's projects until its Project and Team models exist.

Hire Lead needs a project's client, kind, status and Lead, and
``Team.assign_lead``. Until #3 merges there are no projects, so every project
is "not found" and nobody can apply, invite or hire in the running app. #3
replaces this with an adapter over its models (see ``LeadProjects`` in
``application/hiring/ports.py``) and wires it in ``container.py``.
"""

from nextnode.domain.hiring import LeadProject


class ProjectsNotReadyForHiring:
    def get(self, project_id: int) -> LeadProject | None:
        return None

    def get_for_update(self, project_id: int) -> LeadProject | None:
        return None

    def assign_lead(self, project_id: int, developer_account_id: int) -> None:
        raise RuntimeError("Projects arrive with #3; nothing can be hired before then.")
