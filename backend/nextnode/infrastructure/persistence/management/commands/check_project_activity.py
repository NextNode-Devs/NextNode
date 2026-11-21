"""The daily inactivity check for developer projects (NN-39).

Once a day (a scheduler such as cron or Windows Task Scheduler):

    uv run python manage.py check_project_activity

As a long-running worker instead, checking every hour:

    uv run python manage.py check_project_activity --every 3600

To see what would happen on a later date (e.g. 30 days ahead, for a demo):

    uv run python manage.py check_project_activity --as-of 2026-12-25T09:00:00+00:00

Each run asks the members of developer projects whose Lead has been silent in
the project chat for 30 days, and closes projects nobody answered for within
7 days. Running it more often than daily is safe.
"""

import time
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError

from nextnode.infrastructure.container import get_container


class Command(BaseCommand):
    help = "Ask members of inactive developer projects, and close the ones nobody answered for."

    def add_arguments(self, parser):
        parser.add_argument("--as-of", help="Act as if it were this ISO 8601 date-time (with a UTC offset).")
        parser.add_argument("--every", type=int, help="Keep running, checking every N seconds (at least 60).")

    def handle(self, *args, as_of: str | None = None, every: int | None = None, **options):
        now = _parse(as_of) if as_of else None
        if every is not None and (every < 60 or now is not None):
            raise CommandError("--every needs at least 60 seconds and can't be combined with --as-of.")
        while True:
            report = get_container().stewardship.run_activity_checks.execute(now)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Asked {_ids(report.asked)}; closed {_ids(report.closed)}; "
                    f"Lead returned on {_ids(report.lead_returned)}."
                )
            )
            if every is None:
                return
            time.sleep(every)


def _parse(value: str) -> datetime:
    try:
        at = datetime.fromisoformat(value)
    except ValueError:
        raise CommandError(f"{value!r} isn't an ISO 8601 date-time.") from None
    if at.tzinfo is None:
        raise CommandError("Give a UTC offset, e.g. 2026-12-25T09:00:00+00:00.")
    return at


def _ids(project_ids: list[int]) -> str:
    return "projects " + ", ".join(map(str, project_ids)) if project_ids else "no projects"
