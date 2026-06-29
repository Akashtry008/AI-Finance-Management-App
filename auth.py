# auth.py
import bcrypt
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from db import get_cursor
from config import SMTP_CONFIG

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash) -> bool:
    """Safely compare password against hash regardless of DB column type (str/bytes/memoryview)."""
    try:
        if isinstance(password_hash, memoryview):
            password_hash = bytes(password_hash)
        if isinstance(password_hash, str):
            password_hash = password_hash.encode("utf-8")
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash)
    except Exception:
        return False


def ensure_admin_exists():
    """Seed the admin account on startup if it doesn't exist yet.
    Also repairs the hash if it's stored as raw bytes (VARBINARY corruption).
    """
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id, password_hash FROM users WHERE username = %s", (ADMIN_USERNAME,))
        row = cur.fetchone()
        if not row:
            # Admin doesn't exist at all — create fresh
            pw_hash = hash_password(ADMIN_PASSWORD)
            cur.execute(
                "INSERT INTO users (username, email, password_hash, is_admin) VALUES (%s, %s, %s, 1)",
                (ADMIN_USERNAME, "admin@localhost.com", pw_hash),
            )
        else:
            # Admin exists — verify the stored hash is valid bcrypt, fix if broken
            ph = row["password_hash"]
            if isinstance(ph, (bytes, memoryview)):
                ph = bytes(ph) if isinstance(ph, memoryview) else ph
                try:
                    ph_str = ph.decode("utf-8")
                except Exception:
                    ph_str = ""
            else:
                ph_str = ph or ""
            # Re-hash if the stored value isn't a valid bcrypt hash
            if not ph_str.startswith("$2b$") and not ph_str.startswith("$2a$"):
                new_hash = hash_password(ADMIN_PASSWORD)
                cur.execute(
                    "UPDATE users SET password_hash = %s WHERE username = %s",
                    (new_hash, ADMIN_USERNAME),
                )
                print("[startup] Admin password hash was corrupt — re-hashed successfully.")


def register_user(username: str, email: str, password: str) -> bool:
    """Returns True if created, False if username or email already exists."""
    if username.lower() == ADMIN_USERNAME:
        return False
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
        if cur.fetchone():
            return False
        pw_hash = hash_password(password)
        cur.execute(
            "INSERT INTO users (username, email, password_hash, is_admin) VALUES (%s, %s, %s, 0)",
            (username, email, pw_hash),
        )
        return True


def login_user(username: str, password: str) -> dict | None:
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, password_hash, is_admin FROM users WHERE username = %s",
            (username,),
        )
        row = cur.fetchone()
        if not row:
            return None
        if not verify_password(password, row["password_hash"]):
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "is_admin": bool(row["is_admin"]),
        }


def get_user_by_id(user_id: int) -> dict | None:
    with get_cursor() as cur:
        cur.execute("SELECT id, username, is_admin FROM users WHERE id = %s", (user_id,))
        return cur.fetchone()

def generate_reset_token(email: str) -> str | None:
    """Generate a reset token and send it via email."""
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id, username FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row:
            return None
        
        user_id = row["id"]
        username = row["username"]
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=1)
        
        cur.execute(
            """
            INSERT INTO password_resets (token, user_id, expires_at)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)
            """,
            (token, user_id, expires_at)
        )
        
        # Send email using config.py credentials
        smtp_user = SMTP_CONFIG.get('username', '')
        smtp_pass = SMTP_CONFIG.get('password', '')
        app_url   = SMTP_CONFIG.get('app_url', 'http://localhost:5174')
        reset_link = f"{app_url}/reset-password?token={token}"
        
        if smtp_user and smtp_pass:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "FinanceOS - Password Reset Request"
            msg["From"]    = smtp_user
            msg["To"]      = email
            html = f"""
            <html>
              <body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem;">
                <div style="max-width:480px;margin:auto;background:#1e293b;border-radius:12px;padding:2rem;border:1px solid #334155;">
                  <h2 style="color:#10b981">FinanceOS Password Reset</h2>
                  <p>Hello <strong>{username}</strong>,</p>
                  <p>A password reset was requested for your account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
                  <a href="{reset_link}" style="display:inline-block;margin:1.5rem 0;padding:12px 28px;background:#10b981;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Reset My Password</a>
                  <p style="color:#94a3b8;font-size:0.85rem;">If you did not request this, you can safely ignore this email.</p>
                </div>
              </body>
            </html>
            """
            msg.attach(MIMEText(html, "html"))
            try:
                with smtplib.SMTP(SMTP_CONFIG['server'], SMTP_CONFIG['port']) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_user, email, msg.as_string())
                print(f"[{datetime.now()}] SUCCESS: Password reset email sent to {email}")
            except Exception as e:
                print(f"[{datetime.now()}] SMTP ERROR for {email}: {e}")
        else:
            # Fallback: print the link to the terminal if SMTP not configured
            print(f"\n{'='*60}")
            print(f"[SMTP NOT CONFIGURED] Password reset link for: {email}")
            print(f"Link: {reset_link}")
            print(f"{'='*60}\n")
        
        return token


def reset_password_with_token(token: str, new_password: str) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "SELECT user_id, expires_at FROM password_resets WHERE token = %s",
            (token,)
        )
        row = cur.fetchone()
        
        if not row:
            return False
            
        if row["expires_at"] < datetime.now():
            cur.execute("DELETE FROM password_resets WHERE token = %s", (token,))
            return False
            
        pw_hash = hash_password(new_password)
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (pw_hash, row["user_id"])
        )
        cur.execute("DELETE FROM password_resets WHERE user_id = %s", (row["user_id"],))
        return True