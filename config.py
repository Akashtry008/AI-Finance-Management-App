import os
import urllib.parse

# Load .env file automatically if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# ── Database Configuration ─────────────────────────────────────────────────────
# Supports single connection URL (DATABASE_URL / MYSQL_URL) used by Railway, Render, etc.
# Or individual environment variables (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE).
# Locally (XAMPP): falls back to localhost defaults.
_db_url = os.environ.get('MYSQL_URL') or os.environ.get('DATABASE_URL')

if _db_url:
    _parsed = urllib.parse.urlparse(_db_url)
    DB_CONFIG = {
        'host':     _parsed.hostname or 'localhost',
        'port':     _parsed.port or 3306,
        'user':     _parsed.username or 'root',
        'password': _parsed.password or '',
        'database': (_parsed.path.lstrip('/') if _parsed.path else '') or 'finance_app',
        'charset':  'utf8mb4',
    }
else:
    DB_CONFIG = {
        'host':     os.environ.get('MYSQLHOST',     'localhost'),
        'port':     int(os.environ.get('MYSQLPORT', '3306')),
        'user':     os.environ.get('MYSQLUSER',     'root'),
        'password': os.environ.get('MYSQLPASSWORD', ''),
        'database': os.environ.get('MYSQLDATABASE', 'finance_app'),
        'charset':  'utf8mb4',
    }

# ── Email / SMTP Configuration ─────────────────────────────────────────────────
# Supports Gmail, SendGrid, Mailgun, Amazon SES, Outlook, or custom SMTP servers.
SMTP_CONFIG = {
    'server':      os.environ.get('SMTP_SERVER') or os.environ.get('MAIL_SERVER') or os.environ.get('EMAIL_HOST') or 'smtp.gmail.com',
    'port':        int(os.environ.get('SMTP_PORT') or os.environ.get('MAIL_PORT') or os.environ.get('EMAIL_PORT') or 587),
    'username':    os.environ.get('SMTP_USERNAME') or os.environ.get('SMTP_USER') or os.environ.get('MAIL_USERNAME') or os.environ.get('EMAIL_HOST_USER') or '',
    'password':    os.environ.get('SMTP_PASSWORD') or os.environ.get('SMTP_PASS') or os.environ.get('MAIL_PASSWORD') or os.environ.get('EMAIL_HOST_PASSWORD') or '',
    'sender_name': os.environ.get('SMTP_SENDER_NAME') or 'FinanceOS Security',
    'from_email':  os.environ.get('SMTP_FROM') or os.environ.get('MAIL_FROM') or os.environ.get('EMAIL_FROM') or '',
    'app_url':     (os.environ.get('APP_URL') or os.environ.get('FRONTEND_URL') or 'http://localhost:5173').rstrip('/'),
}