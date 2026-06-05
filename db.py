# db.py  –  MySQL backend via XAMPP
import mysql.connector
from contextlib import contextmanager
from config import DB_CONFIG


@contextmanager
def get_connection():
    conn = mysql.connector.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        if conn.is_connected():
            conn.close()


@contextmanager
def get_cursor(commit: bool = False):
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=True)   # rows as dicts
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()