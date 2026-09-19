import asyncio
import datetime
import os
from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
import json
from typing import Optional, List, Dict, Any

from auth import (
    register_user,
    login_user,
    ensure_admin_exists,
    get_user_by_id,
    generate_reset_token,
    reset_password_with_token
)
from services import (
    ensure_default_categories,
    list_categories,
    add_transaction,
    update_transaction,
    delete_transaction,
    list_transactions,
    monthly_report,
    yearly_report,
    range_report,
    period_comparison,
    year_in_review,
    set_budget,
    get_budget_status,
    get_all_budgets_status,
    get_user_pending_split_debt,
    admin_system_stats,
    admin_list_users,
    admin_delete_user,
    category_breakdown,
    monthly_trend,
    create_split_group,
    list_split_groups,
    add_group_member,
    get_group_members,
    get_candidate_members,
    remove_group_member,
    add_split_expense,
    list_split_expenses,
    get_group_balances,
    settle_participant,
    unsettle_participant,
    toggle_participant_settle,
    get_group_settlement_plan,
    record_settlement,
    list_settlements,
    delete_split_group,
    list_goals,
    create_goal,
    add_funds_to_goal,
    delete_goal,
    get_user_notifications,
    export_full_account_data,
    restore_full_account_data,
    list_recurring_bills,
    add_recurring_bill,
    delete_recurring_bill,
    mark_recurring_bill_paid,
    generate_ai_financial_response,
    compute_financial_health_index,
    get_user_security_settings,
    update_user_security_settings,
)

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super-secret-key-for-local-dev-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Seed admin account and ensure all tables exist on startup."""
    # ── Startup ──────────────────────────────────────────────────────────────
    try:
        from db import get_cursor
        with get_cursor(commit=True) as cur:
            # 1. Ensure core base tables exist (prevents crash on fresh cloud DBs)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            INT            AUTO_INCREMENT PRIMARY KEY,
                    username      VARCHAR(50)    NOT NULL UNIQUE,
                    email         VARCHAR(120)   UNIQUE,
                    display_name  VARCHAR(100),
                    theme         VARCHAR(20)    DEFAULT 'dark',
                    currency      VARCHAR(10)    DEFAULT 'INR',
                    password_hash VARCHAR(255)   NOT NULL,
                    is_admin      TINYINT(1)     NOT NULL DEFAULT 0,
                    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id      INT          AUTO_INCREMENT PRIMARY KEY,
                    user_id INT          NOT NULL,
                    name    VARCHAR(100) NOT NULL,
                    type    ENUM('income','expense') NOT NULL,
                    UNIQUE KEY uq_user_category (user_id, name),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id          INT            AUTO_INCREMENT PRIMARY KEY,
                    user_id     INT            NOT NULL,
                    category_id INT            NOT NULL,
                    amount      DECIMAL(12,2)  NOT NULL,
                    description VARCHAR(255)   DEFAULT NULL,
                    tags        VARCHAR(255)   DEFAULT '',
                    txn_date    DATE           NOT NULL,
                    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
                ) ENGINE=InnoDB;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS budgets (
                    id          INT            AUTO_INCREMENT PRIMARY KEY,
                    user_id     INT            NOT NULL,
                    category_id INT            NOT NULL,
                    month       TINYINT        NOT NULL,
                    year        SMALLINT       NOT NULL,
                    amount      DECIMAL(12,2)  NOT NULL,
                    rollover    TINYINT(1)     DEFAULT 1,
                    UNIQUE KEY uq_budget (user_id, category_id, month, year),
                    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS recurring_bills (
                    id                 VARCHAR(64)    PRIMARY KEY,
                    user_id            INT            NOT NULL,
                    name               VARCHAR(120)   NOT NULL,
                    amount             DECIMAL(12,2)  NOT NULL,
                    day                INT            NOT NULL DEFAULT 1,
                    category           VARCHAR(60)    DEFAULT 'Utilities',
                    cycle              VARCHAR(40)    DEFAULT 'Monthly',
                    last_paid_month    VARCHAR(20)    DEFAULT '',
                    created_at         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            """)

            # 2. Incremental column migrations (backward-compatible)
            try:
                cur.execute("ALTER TABLE users ADD COLUMN email VARCHAR(120) UNIQUE")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN display_name VARCHAR(100)")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'dark'")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN currency VARCHAR(10) DEFAULT 'INR'")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE transactions ADD COLUMN tags VARCHAR(255) DEFAULT ''")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE budgets ADD COLUMN rollover TINYINT(1) DEFAULT 1")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE split_groups ADD COLUMN target_budget DECIMAL(12,2) DEFAULT NULL")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE split_expenses ADD COLUMN original_currency VARCHAR(10) DEFAULT NULL")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE split_expenses ADD COLUMN original_amount DECIMAL(12,2) DEFAULT NULL")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE split_expenses ADD COLUMN exchange_rate DECIMAL(12,4) DEFAULT 1.0")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE savings_goals ADD COLUMN monthly_allocation DECIMAL(12,2) DEFAULT NULL")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN security_lock_enabled TINYINT(1) DEFAULT 0")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN security_lock_mode VARCHAR(20) DEFAULT 'pin'")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN security_lock_pin VARCHAR(50) DEFAULT '1234'")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN security_lock_password VARCHAR(255) DEFAULT 'admin123'")
            except Exception:
                pass
            try:
                cur.execute("ALTER TABLE users ADD COLUMN security_lock_pattern VARCHAR(100) DEFAULT '0-1-2-5-8'")
            except Exception:
                pass

            cur.execute("""
                CREATE TABLE IF NOT EXISTS password_resets (
                    token VARCHAR(64) PRIMARY KEY,
                    user_id INT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS savings_goals (
                    id                 INT            AUTO_INCREMENT PRIMARY KEY,
                    user_id            INT            NOT NULL,
                    name               VARCHAR(100)   NOT NULL,
                    target_amount      DECIMAL(12,2)  NOT NULL,
                    current_amount     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
                    deadline           DATE           DEFAULT NULL,
                    color              VARCHAR(20)    DEFAULT '#6366f1',
                    monthly_allocation DECIMAL(12,2)  DEFAULT NULL,
                    created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS split_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    owner_id INT NOT NULL,
                    name VARCHAR(120) NOT NULL,
                    description TEXT,
                    target_budget DECIMAL(12,2) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS split_group_members (
                    group_id INT NOT NULL,
                    user_id INT NOT NULL,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (group_id, user_id),
                    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS split_expenses (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_id INT NOT NULL,
                    paid_by INT NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    expense_date DATE NOT NULL,
                    original_currency VARCHAR(10) DEFAULT NULL,
                    original_amount DECIMAL(12,2) DEFAULT NULL,
                    exchange_rate DECIMAL(12,4) DEFAULT 1.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
                    FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS split_participants (
                    expense_id INT NOT NULL,
                    user_id INT NOT NULL,
                    share DECIMAL(12,2) NOT NULL,
                    settled TINYINT(1) DEFAULT 0,
                    PRIMARY KEY (expense_id, user_id),
                    FOREIGN KEY (expense_id) REFERENCES split_expenses(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS split_settlements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    group_id INT NOT NULL,
                    payer_id INT NOT NULL,
                    receiver_id INT NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    currency VARCHAR(10) DEFAULT 'INR',
                    settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    note VARCHAR(255) DEFAULT '',
                    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
                    FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
        print("[startup] Tables ready.")
    except Exception as e:
        print(f"[startup] WARNING: Could not create tables – {e}")

    # ── Migrate password_hash VARBINARY → VARCHAR (permanent login fix) ──────
    try:
        from db import get_cursor
        with get_cursor(commit=True) as cur:
            cur.execute("""
                SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'password_hash'
            """)
            col_info = cur.fetchone()
            if col_info and col_info.get('DATA_TYPE', '').lower() == 'varbinary':
                cur.execute(
                    "ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL"
                )
                print("[startup] Migrated password_hash VARBINARY -> VARCHAR.")
    except Exception as e:
        print(f"[startup] WARNING: Column migration skipped – {e}")

    # ── Seed admin ───────────────────────────────────────────────────────────
    try:
        ensure_admin_exists()
        print("[startup] Admin ready  ->  username: admin  |  password: admin123")
    except Exception as e:
        print(f"[startup] WARNING: Could not seed admin – {e}")
        print("[startup] Make sure XAMPP MySQL is running and 'finance_app' DB exists.")

    yield  # App runs here
    # ── Shutdown (nothing needed) ────────────────────────────────────────────


app = FastAPI(title="Finance Management API", lifespan=lifespan)


# Read allowed origins from env var (comma-separated list).
# Locally defaults to localhost. In Railway, set ALLOWED_ORIGINS=https://your-app.vercel.app
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
)
frontend_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Whitelist any subdomain of vercel.app and localhost on any port to prevent CORS blocks
allow_origin_regex = r"^https://.*\.vercel\.app$|^http://localhost(:\d+)?$|^http://127\.0\.0\.1(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "status": "online",
        "message": "AI Finance Management API is running!",
        "docs": "http://127.0.0.1:8000/docs",
        "health": "http://127.0.0.1:8000/health",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (
        expires_delta or datetime.timedelta(minutes=15)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_admin(user_id: int = Depends(get_current_user)) -> int:
    from db import get_cursor
    with get_cursor() as cur:
        cur.execute("SELECT is_admin FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row or not row["is_admin"]:
            raise HTTPException(status_code=403, detail="Not authorized (Admin only)")
    return user_id


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserReg(BaseModel):
    username: str
    email: str
    password: str


@app.post("/register")
def register(user: UserReg):
    if register_user(user.username, user.email, user.password):
        return {"msg": "User registered successfully"}
    raise HTTPException(status_code=400, detail="Username or email already exists")


@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = login_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    ensure_default_categories(user["id"])
    token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token({"sub": str(user["id"])}, token_expires)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user["username"],
        "is_admin": user["is_admin"],
    }

@app.get("/me")
def get_me(user_id: int = Depends(get_current_user)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

class ForgotPasswordReq(BaseModel):
    email: str

class ResetPasswordReq(BaseModel):
    token: str
    new_password: str

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordReq):
    token = generate_reset_token(req.email)
    # Always return success to prevent enumeration
    return {"msg": "If the email exists, a reset link was sent."}

@app.post("/reset-password")
def reset_password(req: ResetPasswordReq):
    if reset_password_with_token(req.token, req.new_password):
        return {"msg": "Password reset successfully"}
    raise HTTPException(status_code=400, detail="Invalid or expired token")


class SecurityLockResetReq(BaseModel):
    email: str

@app.post("/auth/security-lock/reset-verify")
def verify_security_lock_reset(req: SecurityLockResetReq, user_id: int = Depends(get_current_user)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reg_email = (user.get("email") or "").strip().lower()
    input_email = req.email.strip().lower()

    if not reg_email or input_email != reg_email:
        raise HTTPException(
            status_code=400,
            detail="The entered email does not match your registered account email."
        )

    return {
        "success": True,
        "msg": "Email verified! You may now unlock and reset your security credentials.",
        "email": reg_email
    }


# ── Categories ───────────────────────────────────────────────────────────────

@app.get("/categories")
def get_categories(ctype: str = None, user_id: int = Depends(get_current_user)):
    return list_categories(user_id, ctype)


# ── Transactions ─────────────────────────────────────────────────────────────

@app.post("/transactions/scan-receipt")
async def scan_receipt(file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    try:
        import easyocr
        import re
        from PIL import Image
        import io
        import numpy as np

        image_bytes = await file.read()
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_np = np.array(img)

        # Initialize reader (will use CPU and download models on first run if needed)
        reader = easyocr.Reader(['en'], gpu=False)
        result = reader.readtext(img_np)

        max_amount = 0.0
        date_found = None
        
        amount_pattern = re.compile(r'(?:rs\.?|inr|\$|€|£)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', re.IGNORECASE)
        date_pattern = re.compile(r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b')

        for (bbox, text, prob) in result:
            text = text.lower().strip()
            
            # Find dates
            if not date_found:
                d_match = date_pattern.search(text)
                if d_match:
                    try:
                        # Try to parse to YYYY-MM-DD
                        d_str = d_match.group(1).replace('/', '-')
                        parts = d_str.split('-')
                        if len(parts[-1]) == 2:
                            parts[-1] = "20" + parts[-1]
                        if len(parts[0]) == 4:
                            d = datetime.datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%Y-%m-%d")
                        else:
                            d = datetime.datetime.strptime(f"{parts[2]}-{parts[1]}-{parts[0]}", "%Y-%m-%d")
                        date_found = d.strftime("%Y-%m-%d")
                    except:
                        pass
            
            # Find amounts
            matches = amount_pattern.findall(text)
            for m in matches:
                try:
                    val = float(m.replace(',', ''))
                    # Receipts usually have total at the bottom which is the largest number
                    if val > max_amount and val < 1000000: # sanity check
                        max_amount = val
                except:
                    pass

        return {
            "amount": max_amount,
            "date": date_found or date.today().strftime("%Y-%m-%d")
        }
    except Exception as e:
        print(f"OCR Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process receipt image")


class TransactionCreate(BaseModel):
    category_id: int
    amount: float
    txn_date: str       # YYYY-MM-DD
    description: str = None
    tags: str = ""


@app.post("/transactions")
def create_transaction(txn: TransactionCreate, user_id: int = Depends(get_current_user)):
    try:
        d = datetime.datetime.strptime(txn.txn_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    add_transaction(user_id, txn.category_id, txn.amount, d, txn.description, txn.tags)
    return {"msg": "Transaction added"}


@app.put("/transactions/{txn_id}")
def update_txn(txn_id: int, txn: TransactionCreate, user_id: int = Depends(get_current_user)):
    try:
        d = datetime.datetime.strptime(txn.txn_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    success = update_transaction(user_id, txn_id, txn.category_id, txn.amount, d, txn.description, txn.tags)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"msg": "Transaction updated"}


@app.delete("/transactions/{txn_id}")
def delete_txn(txn_id: int, user_id: int = Depends(get_current_user)):
    success = delete_transaction(user_id, txn_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"msg": "Transaction deleted"}


@app.get("/transactions")
def get_transactions(month: int = None, year: int = None,
                     start_date: str = None, end_date: str = None,
                     tag: str = None,
                     user_id: int = Depends(get_current_user)):
    return list_transactions(user_id, month=month, year=year,
                             start_date=start_date, end_date=end_date,
                             tag=tag)


# ── Reports ──────────────────────────────────────────────────────────────────

@app.get("/reports/monthly")
def get_monthly_report(month: int, year: int, user_id: int = Depends(get_current_user)):
    return monthly_report(user_id, month, year)


@app.get("/reports/yearly")
def get_yearly_report(year: int, user_id: int = Depends(get_current_user)):
    return yearly_report(user_id, year)


@app.get("/reports/range")
def get_range_report(start_date: str, end_date: str, user_id: int = Depends(get_current_user)):
    return range_report(user_id, start_date, end_date)


@app.get("/reports/comparison")
def get_period_comparison(month: int, year: int, user_id: int = Depends(get_current_user)):
    return period_comparison(user_id, month, year)


@app.get("/reports/wrapped")
def get_year_wrapped(year: int, user_id: int = Depends(get_current_user)):
    return year_in_review(user_id, year)


# ── Budgets ──────────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    category_id: int
    month: int
    year: int
    amount: float


@app.post("/budgets")
def create_budget(budget: BudgetCreate, user_id: int = Depends(get_current_user)):
    set_budget(user_id, budget.category_id, budget.month, budget.year, budget.amount)
    return {"msg": "Budget set"}


@app.get("/budgets/status")
def check_budget(category_id: int, month: int, year: int,
                 user_id: int = Depends(get_current_user)):
    return get_budget_status(user_id, category_id, month, year)


@app.get("/budgets/summary")
def get_budgets_summary(month: int, year: int, user_id: int = Depends(get_current_user)):
    return get_all_budgets_status(user_id, month, year)


# ── Admin ────────────────────────────────────────────────────────────────────

@app.get("/admin/stats")
def get_admin_stats(month: int = None, year: int = None, admin_id: int = Depends(get_current_admin)):
    return admin_system_stats(month, year)

@app.get("/admin/users")
def get_admin_users(month: int = None, year: int = None, admin_id: int = Depends(get_current_admin)):
    return admin_list_users(month, year)

@app.delete("/admin/users/{target_user_id}")
def delete_user(target_user_id: int, admin_id: int = Depends(get_current_admin)):
    success = admin_delete_user(target_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or is an admin")
    return {"msg": "User deleted"}


# ── Charts ───────────────────────────────────────────────────────────────────

@app.get("/reports/category-breakdown")
def get_category_breakdown(month: int, year: int, user_id: int = Depends(get_current_user)):
    return category_breakdown(user_id, month, year)


@app.get("/reports/monthly-trend")
def get_monthly_trend(year: int, user_id: int = Depends(get_current_user)):
    return monthly_trend(user_id, year)


# ── Split Expenses ────────────────────────────────────────────────────────────

class SplitGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_budget: Optional[float] = None

class AddMember(BaseModel):
    username: str

class SplitExpenseCreate(BaseModel):
    paid_by: Optional[int] = None
    description: str
    amount: float
    expense_date: str
    split_with: Optional[list[int]] = None
    custom_shares: Optional[dict[str, float]] = None
    original_currency: Optional[str] = None
    original_amount: Optional[float] = None
    exchange_rate: Optional[float] = 1.0

class SettleReq(BaseModel):
    user_id: int

class SettlementCreate(BaseModel):
    payer_id: int
    receiver_id: int
    amount: float
    currency: str = "INR"
    note: str = ""


@app.post("/split/groups")
def create_group(data: SplitGroupCreate, user_id: int = Depends(get_current_user)):
    gid = create_split_group(user_id, data.name, data.description, data.target_budget)
    # auto-add creator as member
    from db import get_cursor
    with get_cursor(commit=True) as cur:
        cur.execute("INSERT IGNORE INTO split_group_members (group_id, user_id) VALUES (%s,%s)", (gid, user_id))
    return {"id": gid, "msg": "Group created"}


@app.get("/split/groups")
def get_groups(user_id: int = Depends(get_current_user)):
    return list_split_groups(user_id)


@app.delete("/split/groups/{group_id}")
def remove_group(group_id: int, user_id: int = Depends(get_current_user)):
    if not delete_split_group(group_id, user_id):
        raise HTTPException(status_code=403, detail="Not owner or group not found")
    return {"msg": "Group deleted"}


@app.post("/split/groups/{group_id}/members")
def add_member(group_id: int, data: AddMember, user_id: int = Depends(get_current_user)):
    result = add_group_member(group_id, data.username)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/split/groups/{group_id}/members")
def get_members(group_id: int, user_id: int = Depends(get_current_user)):
    return get_group_members(group_id)


@app.get("/split/groups/{group_id}/candidate-members")
def get_candidates(group_id: int, user_id: int = Depends(get_current_user)):
    return get_candidate_members(group_id)


@app.delete("/split/groups/{group_id}/members/{member_id}")
def delete_member(group_id: int, member_id: int, user_id: int = Depends(get_current_user)):
    result = remove_group_member(group_id, member_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/split/groups/{group_id}/expenses")
def add_expense(group_id: int, data: SplitExpenseCreate, user_id: int = Depends(get_current_user)):
    paid_by = data.paid_by if data.paid_by is not None else user_id
    split_with = data.split_with
    if not split_with:
        from services import get_group_members
        members = get_group_members(group_id)
        split_with = [m["id"] for m in members]
        if not split_with:
            split_with = [paid_by]
    eid = add_split_expense(group_id, paid_by, data.description,
                             data.amount, data.expense_date, split_with,
                             data.custom_shares,
                             data.original_currency, data.original_amount, data.exchange_rate)
    return {"id": eid, "msg": "Expense added"}


@app.get("/split/groups/{group_id}/expenses")
def get_expenses(group_id: int, user_id: int = Depends(get_current_user)):
    return list_split_expenses(group_id)


@app.get("/split/groups/{group_id}/balances")
def get_balances(group_id: int, user_id: int = Depends(get_current_user)):
    return get_group_balances(group_id)


@app.post("/split/expenses/{expense_id}/settle")
def settle(expense_id: int, data: SettleReq, user_id: int = Depends(get_current_user)):
    settle_participant(expense_id, data.user_id)
    return {"msg": "Settled"}


@app.post("/split/expenses/{expense_id}/unsettle")
def unsettle(expense_id: int, data: SettleReq, user_id: int = Depends(get_current_user)):
    unsettle_participant(expense_id, data.user_id)
    return {"msg": "Unsettled"}


@app.post("/split/expenses/{expense_id}/toggle-settle")
def toggle_settle(expense_id: int, data: SettleReq, user_id: int = Depends(get_current_user)):
    res = toggle_participant_settle(expense_id, data.user_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


@app.get("/split/groups/{group_id}/settlement-plan")
def settlement_plan(group_id: int, user_id: int = Depends(get_current_user)):
    return get_group_settlement_plan(group_id)


@app.post("/split/groups/{group_id}/settlements")
def create_settlement(group_id: int, data: SettlementCreate, user_id: int = Depends(get_current_user)):
    sid = record_settlement(group_id, data.payer_id, data.receiver_id, data.amount, data.currency, data.note)
    return {"id": sid, "msg": "Settlement recorded"}


@app.get("/split/groups/{group_id}/settlements")
def get_settlements(group_id: int, user_id: int = Depends(get_current_user)):
    return list_settlements(group_id)


@app.get("/split/debt-summary")
def get_debt_summary(user_id: int = Depends(get_current_user)):
    return {"pending_group_debt": get_user_pending_split_debt(user_id)}


# ── Savings Goals ─────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    name: str
    target_amount: float
    color: str = "#6366f1"
    deadline: date = None
    monthly_allocation: float = None

class GoalAddFunds(BaseModel):
    amount: float

@app.get("/goals")
def get_all_goals(user_id: int = Depends(get_current_user)):
    return list_goals(user_id)

@app.post("/goals")
def new_goal(data: GoalCreate, user_id: int = Depends(get_current_user)):
    gid = create_goal(user_id, data.name, data.target_amount, data.color, data.deadline, data.monthly_allocation)
    return {"id": gid, "msg": "Goal created"}

@app.put("/goals/{goal_id}/add")
def fund_goal(goal_id: int, data: GoalAddFunds, user_id: int = Depends(get_current_user)):
    if not add_funds_to_goal(user_id, goal_id, data.amount):
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"msg": "Funds added"}

@app.delete("/goals/{goal_id}")
def remove_goal(goal_id: int, user_id: int = Depends(get_current_user)):
    if not delete_goal(user_id, goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"msg": "Goal deleted"}


# ── Smart Notifications ───────────────────────────────────────────────────────

@app.get("/notifications")
def get_notifications(user_id: int = Depends(get_current_user)):
    return get_user_notifications(user_id)


# ── User Profile ──────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    display_name: str = None
    email: str = None
    theme: str = None
    currency: str = None

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

@app.get("/profile")
def get_profile(user_id: int = Depends(get_current_user)):
    from db import get_cursor
    with get_cursor() as cur:
        cur.execute("SELECT username, email, display_name, theme, currency, created_at FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

@app.put("/profile")
def update_profile(data: ProfileUpdate, user_id: int = Depends(get_current_user)):
    from db import get_cursor
    updates = []
    params = []
    if data.display_name is not None:
        updates.append("display_name = %s")
        params.append(data.display_name)
    if data.email is not None:
        updates.append("email = %s")
        params.append(data.email)
    if data.theme is not None:
        updates.append("theme = %s")
        params.append(data.theme)
    if data.currency is not None:
        updates.append("currency = %s")
        params.append(data.currency)
        
    if not updates:
        return {"msg": "No changes requested"}
        
    params.append(user_id)
    with get_cursor(commit=True) as cur:
        try:
            cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", params)
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(status_code=400, detail="Email already in use")
            raise HTTPException(status_code=500, detail=str(e))
    return {"msg": "Profile updated"}

@app.put("/profile/password")
def update_password(data: PasswordUpdate, user_id: int = Depends(get_current_user)):
    from db import get_cursor
    from auth import verify_password, hash_password
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user or not verify_password(data.current_password, user['password_hash']):
            raise HTTPException(status_code=400, detail="Incorrect current password")
            
        new_hash = hash_password(data.new_password)
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
    return {"msg": "Password updated successfully"}


class RestoreDataReq(BaseModel):
    data: dict

@app.get("/profile/backup")
def get_profile_backup(month: int = None, year: int = None, user_id: int = Depends(get_current_user)):
    return export_full_account_data(user_id, month=month, year=year)

@app.post("/profile/restore")
def restore_profile_backup(req: RestoreDataReq, user_id: int = Depends(get_current_user)):
    result = restore_full_account_data(user_id, req.data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── AI Financial Assistant ───────────────────────────────────────────────────

class ChatMessageReq(BaseModel):
    message: str


def build_financial_llm_prompt(context_data: dict, user_question: str) -> str:
    user_info = context_data["user"]
    curr = user_info.get("currency", "INR")
    name = user_info.get("display_name") or user_info.get("username", "User")
    today = context_data["date"]
    cf = context_data["curr_month_cashflow"]
    prev_cf = context_data["prev_month_cashflow"]

    lines = [
        "You are FinanceOS AI, an intelligent, empathetic, and precision-focused personal financial assistant.",
        f"You are providing personalized guidance for {name}.",
        f"Preferred Currency: {curr}. Today's Date: {today}.",
        "",
        "=== REAL-TIME USER FINANCIAL CONTEXT ===",
        f"1. Current Month Cashflow ({today[:7]}):",
        f"   - Total Income: {curr} {cf['income']:.2f}",
        f"   - Total Expenses: {curr} {cf['expenses']:.2f}",
        f"   - Net Cashflow (Savings): {curr} {cf['net_savings']:.2f}",
        f"   - Savings Rate: {cf['savings_rate_pct']}%",
        f"2. Previous Month Comparison:",
        f"   - Previous Month Income: {curr} {prev_cf['income']:.2f}",
        f"   - Previous Month Expenses: {curr} {prev_cf['expenses']:.2f}",
        "",
        "3. Spending by Category This Month:"
    ]

    if context_data["category_breakdown"]:
        for c in context_data["category_breakdown"]:
            lines.append(f"   - {c['category']}: {curr} {c['spent']:.2f} ({c['percentage']}% of total expenses)")
    else:
        lines.append("   - No expenses recorded yet this month.")

    lines.append("\n4. Active Category Budgets:")
    if context_data["budgets"]:
        for b in context_data["budgets"]:
            lines.append(
                f"   - {b['category']}: Limit {curr} {b['limit']:.2f} | Spent {curr} {b['spent']:.2f} | "
                f"Remaining {curr} {b['remaining']:.2f} ({b['utilized_pct']}% used) [Status: {b['status'].upper()}]"
            )
    else:
        lines.append("   - No category budgets configured for this month.")

    lines.append("\n5. Savings Goals:")
    if context_data["goals"]:
        for g in context_data["goals"]:
            deadline_info = f"Deadline: {g['deadline']} ({g['days_left']} days left)" if g["deadline"] else "No deadline set"
            lines.append(
                f"   - Goal '{g['name']}': Saved {curr} {g['saved']:.2f} / Target {curr} {g['target']:.2f} "
                f"({g['pct_complete']}% complete, remaining: {curr} {g['remaining_to_save']:.2f}) | {deadline_info}"
            )
    else:
        lines.append("   - No active savings goals.")

    lines.append("\n6. Group Split Expenses & Social Debts:")
    debts = context_data["split_debts"]
    lines.append(f"   - Overall Net Balance across split groups: {curr} {debts['net_split_balance']:.2f}")
    if debts["owed_to_user"]:
        lines.append(f"   - Money Friends Owe {name}: Total {curr} {debts['total_owed_to_user']:.2f}")
        for item in debts["owed_to_user"]:
            lines.append(f"     * {item['friend']} owes {curr} {item['amount']:.2f} in group '{item['group']}'")
    else:
        lines.append(f"   - Nobody owes {name} money in split groups.")

    if debts["user_owes"]:
        lines.append(f"   - Money {name} Owes to Friends: Total {curr} {debts['total_user_owes']:.2f}")
        for item in debts["user_owes"]:
            lines.append(f"     * Owes {item['friend']} {curr} {item['amount']:.2f} in group '{item['group']}'")
    else:
        lines.append(f"   - {name} does not owe any money in split groups.")

    lines.append("\n7. Recent Transactions (Last 30):")
    if context_data["recent_transactions"]:
        for t in context_data["recent_transactions"][:25]:
            desc = f" - '{t['description']}'" if t["description"] else ""
            lines.append(f"   - [{t['date']}] {t['type'].upper()}: {curr} {t['amount']:.2f} in '{t['category']}'{desc}")
    else:
        lines.append("   - No transactions recorded.")

    lines.extend([
        "",
        "=== INSTRUCTIONS FOR THE ASSISTANT ===",
        "- Answer the user's question directly, accurately, and concisely using the provided context.",
        "- Always format monetary values with the user's currency symbol and bold key numbers.",
        "- Use markdown bullet points and clean structure for readability.",
        "- If asked for advice, ground your recommendations on their actual numbers (e.g., top spending categories, budget capacity).",
        "- Keep answers helpful and under 4-5 sentences unless detailed breakdown is explicitly requested.",
        "",
        f"User Question: {user_question}"
    ])
    return "\n".join(lines)


def generate_fallback_response(context_data: dict, user_question: str) -> str:
    msg = user_question.lower()
    cf = context_data["curr_month_cashflow"]
    curr = context_data["user"].get("currency", "INR")
    budgets = context_data["budgets"]
    goals = context_data["goals"]
    debts = context_data["split_debts"]
    cats = context_data["category_breakdown"]

    if any(w in msg for w in ["budget", "over budget", "limit", "exceed"]):
        if not budgets:
            return "You haven't set any budgets for this month yet. Head to the Budgets page to set spending limits!"
        exceeded = [b for b in budgets if b["status"] == "exceeded"]
        warning = [b for b in budgets if b["status"] == "warning"]
        parts = ["Here is your budget health check for this month:"]
        if exceeded:
            parts.append("⚠️ **Exceeded Budgets**:\n" + "\n".join([f"• **{b['category']}**: Spent {curr} {b['spent']:.2f} of {curr} {b['limit']:.2f} ({b['utilized_pct']}%)" for b in exceeded]))
        if warning:
            parts.append("🔔 **Near Limit (>80%)**:\n" + "\n".join([f"• **{b['category']}**: Spent {curr} {b['spent']:.2f} of {curr} {b['limit']:.2f} ({b['utilized_pct']}%)" for b in warning]))
        if not exceeded and not warning:
            parts.append("✅ **All budgets are in a healthy range!** You are well within your configured limits.")
        total_budget_spent = sum(b['spent'] for b in budgets)
        total_budget_limit = sum(b['limit'] for b in budgets)
        parts.append(f"📊 Total budgeted spending: **{curr} {total_budget_spent:.2f}** out of **{curr} {total_budget_limit:.2f}**.")
        return "\n\n".join(parts)

    elif any(w in msg for w in ["spent", "expense", "spend", "summary", "month", "cashflow"]):
        top_cat = f", with the highest spend in **{cats[0]['category']}** ({curr} {cats[0]['spent']:.2f})" if cats else ""
        return (
            f"📊 **Monthly Spending Overview** ({context_data['date'][:7]}):\n\n"
            f"• **Total Expenses**: **{curr} {cf['expenses']:.2f}**{top_cat}\n"
            f"• **Total Income**: **{curr} {cf['income']:.2f}**\n"
            f"• **Net Savings**: **{curr} {cf['net_savings']:.2f}** (Savings Rate: **{cf['savings_rate_pct']}%**)\n"
            f"• **Recent Transactions Logged**: {len(context_data['recent_transactions'])}"
        )

    elif any(w in msg for w in ["goal", "save", "saving", "target"]):
        if not goals:
            return "You don't have any active savings goals set up yet. Head to the Savings Goals page to set your first target!"
        goal_strs = [
            f"• **{g['name']}**: Saved **{curr} {g['saved']:.2f}** of **{curr} {g['target']:.2f}** ({g['pct_complete']}%)" +
            (f" — *{g['days_left']} days left until deadline*" if g["days_left"] is not None else "")
            for g in goals
        ]
        return "🎯 **Your Active Savings Goals**:\n\n" + "\n".join(goal_strs)

    elif any(w in msg for w in ["split", "owe", "debt", "friend", "group"]):
        owed_me = debts["total_owed_to_user"]
        i_owe = debts["total_user_owes"]
        lines = ["👥 **Group Debts & Split Expenses Summary**:\n"]
        if owed_me > 0:
            lines.append(f"• **Friends owe you**: **{curr} {owed_me:.2f}** across your groups:")
            for o in debts["owed_to_user"][:5]:
                lines.append(f"   - **{o['friend']}** owes **{curr} {o['amount']:.2f}** in '{o['group']}'")
        else:
            lines.append("• Nobody currently owes you money in your split groups.")

        if i_owe > 0:
            lines.append(f"\n• **You owe friends**: **{curr} {i_owe:.2f}**:")
            for uo in debts["user_owes"][:5]:
                lines.append(f"   - You owe **{uo['friend']}** **{curr} {uo['amount']:.2f}** in '{uo['group']}'")
        else:
            lines.append("• You are fully settled up and do not owe anyone!")

        lines.append(f"\n• **Overall Net Balance**: **{curr} {debts['net_split_balance']:.2f}**")
        return "\n".join(lines)

    elif any(w in msg for w in ["audit", "spending audit", "health check"]):
        top_cats = ", ".join([f"**{c['category']}** ({curr} {c['spent']:.2f})" for c in cats[:3]]) if cats else "None"
        exceeded_b = [b for b in budgets if b["status"] == "exceeded"]
        audit_lines = [
            f"🔍 **Comprehensive Financial Health Audit** ({context_data['date'][:7]}):",
            f"• **Net Savings Rate**: **{cf['savings_rate_pct']}%** (Target: 20%+)",
            f"• **Cashflow**: Income {curr} {cf['income']:.2f} vs Expenses {curr} {cf['expenses']:.2f} (Net: **{curr} {cf['net_savings']:.2f}**)",
            f"• **Top Spending Pressure**: {top_cats}",
        ]
        if exceeded_b:
            audit_lines.append(f"• ⚠️ **Budget Alert**: {len(exceeded_b)} budget(s) exceeded this month.")
        else:
            audit_lines.append("• ✅ **Budget Health**: No budgets currently breached.")
        if cf['savings_rate_pct'] >= 20:
            audit_lines.append("• 🌟 **Rating**: Excellent! Your savings discipline is exceptional.")
        elif cf['savings_rate_pct'] >= 10:
            audit_lines.append("• 📈 **Rating**: Good! Trimming top discretionary categories can boost you past 20%.")
        else:
            audit_lines.append("• ⚠️ **Rating**: Caution. Spending is near or exceeding income. Consider an immediate discretionary freeze.")
        return "\n\n".join(audit_lines)

    elif any(w in msg for w in ["spike", "category spike", "abnormal"]):
        if not cats:
            return "No expense data recorded this month to analyze spikes."
        spikes = [c for c in cats if c["percentage"] >= 25]
        if spikes:
            spike_strs = [f"• **{c['category']}**: **{curr} {c['spent']:.2f}** ({c['percentage']}% of all monthly spend!)" for c in spikes]
            return "🚨 **High-Concentration Spending Spikes Detected**:\n\n" + "\n".join(spike_strs) + "\n\n💡 *Tip: Diversifying and placing strict budget ceilings on these areas will balance your cashflow.*"
        else:
            return f"✅ **No single category spike detected.** Your spending is relatively evenly distributed across {len(cats)} categories."

    elif any(w in msg for w in ["month-over-month", "mom", "comparison"]):
        p_inc = prev_cf["income"]
        p_exp = prev_cf["expenses"]
        c_inc = cf["income"]
        c_exp = cf["expenses"]
        exp_diff = c_exp - p_exp
        exp_pct = ((exp_diff / p_exp) * 100) if p_exp > 0 else (100.0 if c_exp > 0 else 0.0)
        direction = "increased 🔺" if exp_diff > 0 else ("decreased 🔻" if exp_diff < 0 else "stayed even")
        return (
            f"📊 **Month-over-Month Comparison**:\n\n"
            f"• **This Month**: Income {curr} {c_inc:.2f} | Expenses **{curr} {c_exp:.2f}**\n"
            f"• **Last Month**: Income {curr} {p_inc:.2f} | Expenses **{curr} {p_exp:.2f}**\n"
            f"• **Expense Delta**: Expenses have {direction} by **{curr} {abs(exp_diff):.2f}** ({abs(exp_pct):.1f}%).\n"
            f"• **Net Savings Delta**: {curr} {(c_inc - c_exp) - (p_inc - p_exp):.2f}"
        )

    elif any(w in msg for w in ["tip", "advice", "how to save", "reduce", "recommend"]):
        if cats:
            top = cats[0]
            savings_potential = top["spent"] * 0.15
            return (
                f"💡 **AI Financial Optimization Tip**:\n\n"
                f"• Your top spending category this month is **{top['category']}** at **{curr} {top['spent']:.2f}** "
                f"({top['percentage']}% of all expenses).\n"
                f"• By reducing non-essential purchases in {top['category']} by just 15%, you could save **{curr} {savings_potential:.2f}** more this month!\n"
                f"• Your current savings rate is **{cf['savings_rate_pct']}%**. Aiming for 20%+ is a proven personal finance benchmark."
            )
        return "💡 Set category budgets early in the month, track transactions daily, and try to build an emergency fund covering at least 3 months of basic expenses."

    # Default overview
    name = context_data["user"].get("display_name") or context_data["user"].get("username", "there")
    return (
        f"👋 Hi **{name}**! I'm FinanceOS AI, your personal financial assistant.\n\n"
        f"Here is your real-time status for this month:\n"
        f"• **Income**: {curr} {cf['income']:.2f} | **Expenses**: {curr} {cf['expenses']:.2f} (Net: **{curr} {cf['net_savings']:.2f}**)\n"
        f"• **Budgets Active**: {len(budgets)} | **Goals Tracked**: {len(goals)} | **Recent Txns**: {len(context_data['recent_transactions'])}\n\n"
        "Feel free to ask me questions like:\n"
        "• *'Am I over budget this month?'*\n"
        "• *'What are my biggest expenses?'*\n"
        "• *'Who owes me money in Split?'*\n"
        "• *'How can I save more money?'*"
    )


@app.post("/ai/chat/stream")
async def ai_chat_stream(req: ChatMessageReq, user_id: int = Depends(get_current_user)):
    from services import get_comprehensive_financial_context
    context_data = get_comprehensive_financial_context(user_id)
    gemini_key = os.environ.get("GEMINI_API_KEY")

    async def sse_generator():
        if gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                prompt = build_financial_llm_prompt(context_data, req.message)
                response = model.generate_content(prompt, stream=True)
                for chunk in response:
                    if chunk.text:
                        payload = json.dumps({"text": chunk.text, "chunk": chunk.text})
                        yield f"data: {payload}\n\n"
                        await asyncio.sleep(0.01)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                print(f"Gemini Streaming Error: {e}")
                # Fall through to local fallback generator below

        # Fallback intelligent streaming
        fallback_text = generate_fallback_response(context_data, req.message)
        words = fallback_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            payload = json.dumps({"text": chunk, "chunk": chunk})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.015)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/ai/chat")
def ai_chat(req: ChatMessageReq, user_id: int = Depends(get_current_user)):
    from services import get_comprehensive_financial_context
    context_data = get_comprehensive_financial_context(user_id)
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = build_financial_llm_prompt(context_data, req.message)
            response = model.generate_content(prompt)
            return {"response": response.text}
        except Exception as e:
            print(f"Gemini API Error: {e}")

    return {"response": generate_fallback_response(context_data, req.message)}


# ── Security Lock Reset Verification ────────────────────────────────────────

class SecurityResetVerifyRequest(BaseModel):
    email: str


@app.post("/auth/security-lock/reset-verify")
def verify_security_lock_reset(
    req: SecurityResetVerifyRequest,
    user_id: int = Depends(get_current_user)
):
    """Verify that the provided email matches the authenticated user's email."""
    from auth import get_user_by_id
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    registered_email = (user.get("email") or "").strip().lower()
    provided_email = (req.email or "").strip().lower()
    if not registered_email or registered_email != provided_email:
        raise HTTPException(
            status_code=400,
            detail="The provided email does not match your registered account email."
        )
    return {"success": True, "message": "Identity verified successfully. Default lock reset permitted."}


# ── Proprietary Financial Health Index Endpoint ─────────────────────────────

@app.get("/reports/financial-health")
def get_financial_health_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user_id: int = Depends(get_current_user)
):
    """Returns the 0-1000 proprietary Financial Health Index, pillars, and boosters."""
    today = date.today()
    m = month or today.month
    y = year or today.year
    return compute_financial_health_index(user_id, m, y)


# ── Recurring Bills Endpoints ───────────────────────────────────────────────

class RecurringBillCreateReq(BaseModel):
    id: Optional[str] = None
    name: str
    amount: float
    day: int = 1
    category: str = "Utilities"
    cycle: str = "Monthly"


class RecurringBillPayReq(BaseModel):
    month: int
    year: int


@app.get("/recurring-bills")
def get_recurring_bills_api(user_id: int = Depends(get_current_user)):
    return list_recurring_bills(user_id)


@app.post("/recurring-bills")
def create_recurring_bill_api(
    req: RecurringBillCreateReq,
    user_id: int = Depends(get_current_user)
):
    import time
    bill_id = req.id or f"rb-{int(time.time() * 1000)}"
    return add_recurring_bill(
        user_id=user_id,
        bill_id=bill_id,
        name=req.name,
        amount=req.amount,
        day=req.day,
        category=req.category,
        cycle=req.cycle
    )


@app.delete("/recurring-bills/{bill_id}")
def delete_recurring_bill_api(bill_id: str, user_id: int = Depends(get_current_user)):
    success = delete_recurring_bill(user_id, bill_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    return {"success": True, "deleted_id": bill_id}


@app.put("/recurring-bills/{bill_id}/pay")
def mark_bill_paid_api(
    bill_id: str,
    req: RecurringBillPayReq,
    user_id: int = Depends(get_current_user)
):
    success = mark_recurring_bill_paid(user_id, bill_id, req.month, req.year)
    if not success:
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    return {"success": True, "bill_id": bill_id, "paid_month": f"{req.year}-{req.month}"}


# ── Account Data Backup & Restore ───────────────────────────────────────────

@app.get("/profile/backup")
def get_profile_backup_api(
    month: Optional[str] = None,
    year: Optional[str] = None,
    user_id: int = Depends(get_current_user)
):
    """Export complete account data (transactions, budgets, goals, recurring bills, groups) into portable JSON."""
    m = int(month) if (month and month != "all") else None
    y = int(year) if (year and year != "all") else None
    return export_full_account_data(user_id, month=m, year=y)


class RestoreBackupReq(BaseModel):
    data: dict


@app.post("/profile/restore")
def post_profile_restore_api(
    req: RestoreBackupReq,
    user_id: int = Depends(get_current_user)
):
    """Restore transactions, budgets, goals, and recurring bills from uploaded JSON backup."""
    return restore_full_account_data(user_id, req.data)


# ── Persistent Security Lock Configuration ──────────────────────────────────

class SecuritySettingsUpdateReq(BaseModel):
    enabled: Optional[bool] = None
    mode: Optional[str] = None
    pin: Optional[str] = None
    password: Optional[str] = None
    pattern: Optional[str] = None


@app.get("/profile/security-lock")
def get_security_lock_api(user_id: int = Depends(get_current_user)):
    """Fetch user's security lock configuration from database."""
    return get_user_security_settings(user_id)


@app.put("/profile/security-lock")
def update_security_lock_api(
    req: SecuritySettingsUpdateReq,
    user_id: int = Depends(get_current_user)
):
    """Update user's security lock configuration in database."""
    return update_user_security_settings(
        user_id=user_id,
        enabled=req.enabled,
        mode=req.mode,
        pin=req.pin,
        password=req.password,
        pattern=req.pattern
    )


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 8000))
    print(f"\n🚀 AI Finance API running at:")
    print(f"   -> Local:   http://{host}:{port}")
    print(f"   -> Docs:    http://{host}:{port}/docs\n")
    uvicorn.run("main:app", host=host, port=port, reload=True)

