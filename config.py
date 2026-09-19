import os
import urllib.parse

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
SMTP_CONFIG = {
    'server':   os.environ.get('SMTP_SERVER',   'smtp.gmail.com'),
    'port':     int(os.environ.get('SMTP_PORT', '587')),
    'username': os.environ.get('SMTP_USERNAME', ''),
    'password': os.environ.get('SMTP_PASSWORD', ''),
    'app_url':  os.environ.get('APP_URL',       'http://localhost:5173'),
}