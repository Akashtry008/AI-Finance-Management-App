# db.py – MySQL connection manager with auto-retry and reconnect resilience
import time
import mysql.connector
from contextlib import contextmanager
from config import DB_CONFIG


@contextmanager
def get_connection(retries: int = 3, delay: float = 0.8):
    """Yields a MySQL connection with automatic retry on transient cloud/network drops."""
    conn = None
    last_err = None
    for attempt in range(retries):
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            if conn.is_connected():
                break
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise last_err

    try:
        yield conn
    finally:
        if conn and conn.is_connected():
            try:
                conn.close()
            except Exception:
                pass


@contextmanager
def get_cursor(commit: bool = False):
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=True)  # rows as dicts
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            try:
                cursor.close()
            except Exception:
                pass