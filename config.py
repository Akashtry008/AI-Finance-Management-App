DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '',          # XAMPP default: root has no password
    'database': 'finance_app',
    'charset': 'utf8mb4',
}

# ── Email / SMTP Configuration ────────────────────────────────────────────────
# To enable password reset emails:
#   1. Create a Gmail App Password at: https://myaccount.google.com/apppasswords
#      (requires 2-Step Verification to be enabled)
#   2. Fill in your Gmail address and the 16-character App Password below.
SMTP_CONFIG = {
    'server':   'smtp.gmail.com',
    'port':     587,
    'username': 'akashmakavana0@gmail.com',   # e.g. yourname@gmail.com
    'password': 'julrrcswkbjztvsb',   # e.g. abcd efgh ijkl mnop  (Gmail App Password)
    'app_url':  'http://localhost:5173',
}