# auth.py
import bcrypt
from db import get_cursor

def hash_password(plain_password: str) -> bytes:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())

def verify_password(plain_password: str, password_hash: bytes) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash)

def register_user(username: str, password: str) -> bool:
    # returns True if created, False if username exists
    with get_cursor(commit=True) as cur:
        # check if exists
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            return False
        pw_hash = hash_password(password)
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            (username, pw_hash),
        )
        return True

def login_user(username: str, password: str) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, password_hash FROM users WHERE username = %s",
            (username,),
        )
        row = cur.fetchone()
        if not row:
            return None
        if not verify_password(password, row["password_hash"]):
            return None
        return {"id": row["id"], "username": row["username"]}