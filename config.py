import os

# ── Database Configuration ─────────────────────────────────────────────────────
# In production (Railway): these env vars are injected automatically by Railway's MySQL plugin.
# Locally (XAMPP): falls back to localhost defaults.
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
    'username': os.environ.get('SMTP_USERNAME', 'akashmakavana0@gmail.com'),
    'password': os.environ.get('SMTP_PASSWORD', 'julrrcswkbjztvsb'),
    'app_url':  os.environ.get('APP_URL',       'http://localhost:5173'),
}