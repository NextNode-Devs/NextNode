import logging

from django.db import DatabaseError, connection

logger = logging.getLogger(__name__)


class DjangoDatabaseProbe:
    def is_reachable(self) -> bool:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                return cursor.fetchone() == (1,)
        except DatabaseError:
            logger.warning("Database health probe failed")
            return False
