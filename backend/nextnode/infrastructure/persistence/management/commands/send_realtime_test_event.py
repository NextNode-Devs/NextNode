"""Publishes a test event to an account's sockets, from this process.

Run it while a browser holds a socket on a *different* backend process to see
an event cross processes through Redis (#1, acceptance criterion 9):

    uv run python manage.py send_realtime_test_event <account_id>
"""

from datetime import UTC, datetime

from django.core.management.base import BaseCommand

from nextnode.infrastructure.container import get_container


class Command(BaseCommand):
    help = "Send a realtime.test event to every socket the account has open."

    def add_arguments(self, parser):
        parser.add_argument("account_id", type=int)

    def handle(self, *args, account_id: int, **options):
        event = {"type": "realtime.test", "sent_at": datetime.now(UTC).isoformat()}
        get_container().realtime.publish_to_account(account_id, event)
        self.stdout.write(self.style.SUCCESS(f"Sent {event['type']} to account {account_id}."))
