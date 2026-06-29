import datetime
import os
from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt

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
    set_budget,
    get_budget_status,
    admin_system_stats,
    admin_list_users,
    admin_delete_user,
    category_breakdown,
    monthly_trend,
    create_split_group,
    list_split_groups,
    add_group_member,
    get_group_members,
    add_split_expense,
    list_split_expenses,
    get_group_balances,
    settle_participant,
    delete_split_group,
    list_goals,
    create_goal,
    add_funds_to_goal,
    delete_goal,
    get_user_notifications,
)

SECRET_KEY = "super-secret-key-for-local-dev-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Seed admin account and ensure all tables exist on startup."""
    # ── Startup ──────────────────────────────────────────────────────────────
    try:
        from db import get_cursor
        with get_cursor(commit=True) as cur:
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
                    id             INT            AUTO_INCREMENT PRIMARY KEY,
                    user_id        INT            NOT NULL,
                    name           VARCHAR(100)   NOT NULL,
                    target_amount  DECIMAL(12,2)  NOT NULL,
                    current_amount DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
                    deadline       DATE           DEFAULT NULL,
                    color          VARCHAR(20)    DEFAULT '#6366f1',
                    created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS split_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    owner_id INT NOT NULL,
                    name VARCHAR(120) NOT NULL,
                    description TEXT,
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/debug-db")
def debug_db():
    from config import DB_CONFIG
    import mysql.connector
    
    # Hide password in output for safety
    safe_config = DB_CONFIG.copy()
    if 'password' in safe_config and safe_config['password']:
        safe_config['password'] = '***' + safe_config['password'][-4:]
        
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT 1")
        res = cur.fetchone()
        cur.execute("SHOW TABLES")
        tables = [list(r.values())[0] for r in cur.fetchall()]
        cur.close()
        conn.close()
        return {
            "status": "success",
            "db_config_used": safe_config,
            "ping_result": res,
            "tables_found": tables
        }
    except Exception as e:
        return {
            "status": "failed",
            "db_config_used": safe_config,
            "error_type": type(e).__name__,
            "error_message": str(e)
        }

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


@app.post("/transactions")
def create_transaction(txn: TransactionCreate, user_id: int = Depends(get_current_user)):
    try:
        d = datetime.datetime.strptime(txn.txn_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    add_transaction(user_id, txn.category_id, txn.amount, d, txn.description)
    return {"msg": "Transaction added"}


@app.put("/transactions/{txn_id}")
def update_txn(txn_id: int, txn: TransactionCreate, user_id: int = Depends(get_current_user)):
    try:
        d = datetime.datetime.strptime(txn.txn_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    success = update_transaction(user_id, txn_id, txn.category_id, txn.amount, d, txn.description)
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
                     user_id: int = Depends(get_current_user)):
    return list_transactions(user_id, month, year)


# ── Reports ──────────────────────────────────────────────────────────────────

@app.get("/reports/monthly")
def get_monthly_report(month: int, year: int, user_id: int = Depends(get_current_user)):
    return monthly_report(user_id, month, year)


@app.get("/reports/yearly")
def get_yearly_report(year: int, user_id: int = Depends(get_current_user)):
    return yearly_report(user_id, year)


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)


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
    description: str = None

class AddMember(BaseModel):
    username: str

class SplitExpenseCreate(BaseModel):
    paid_by: int
    description: str
    amount: float
    expense_date: str
    split_with: list[int]

class SettleReq(BaseModel):
    user_id: int


@app.post("/split/groups")
def create_group(data: SplitGroupCreate, user_id: int = Depends(get_current_user)):
    gid = create_split_group(user_id, data.name, data.description)
    # auto-add creator as member
    add_group_member(gid, None)
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
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/split/groups/{group_id}/members")
def get_members(group_id: int, user_id: int = Depends(get_current_user)):
    return get_group_members(group_id)


@app.post("/split/groups/{group_id}/expenses")
def add_expense(group_id: int, data: SplitExpenseCreate, user_id: int = Depends(get_current_user)):
    eid = add_split_expense(group_id, data.paid_by, data.description,
                             data.amount, data.expense_date, data.split_with)
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


# ── Savings Goals ─────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    name: str
    target_amount: float
    color: str = "#6366f1"
    deadline: date = None

class GoalAddFunds(BaseModel):
    amount: float

@app.get("/goals")
def get_all_goals(user_id: int = Depends(get_current_user)):
    return list_goals(user_id)

@app.post("/goals")
def new_goal(data: GoalCreate, user_id: int = Depends(get_current_user)):
    gid = create_goal(user_id, data.name, data.target_amount, data.color, data.deadline)
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


# ── AI Financial Assistant ───────────────────────────────────────────────────

class ChatMessageReq(BaseModel):
    message: str

@app.post("/ai/chat")
def ai_chat(req: ChatMessageReq, user_id: int = Depends(get_current_user)):
    from services import list_transactions, list_goals, get_budget_status
    from db import get_cursor
    
    # 1. Fetch user data
    txns = list_transactions(user_id)
    goals = list_goals(user_id)
    
    # Get active budgets status
    budgets_status = []
    curr_month = date.today().month
    curr_year = date.today().year
    with get_cursor() as cur:
        cur.execute("""
            SELECT b.category_id, b.amount, c.name 
            FROM budgets b 
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = %s AND b.month = %s AND b.year = %s
        """, (user_id, curr_month, curr_year))
        budget_rows = cur.fetchall()
        for br in budget_rows:
            status = get_budget_status(user_id, br["category_id"], curr_month, curr_year)
            budgets_status.append({
                "category": br["name"],
                "budget_amount": br["amount"],
                "spent": status["spent"],
                "remaining": status["remaining"]
            })
            
    # Format current date
    today_str = date.today().strftime("%Y-%m-%d")
    
    # 2. Format Context for LLM
    context_lines = [
        f"Today's date is: {today_str}.",
        "Here is the user's financial overview to help you answer questions:",
        "- Budgets for current month:"
    ]
    if budgets_status:
        for b in budgets_status:
            context_lines.append(f"  * Category '{b['category']}': Budget limit is {b['budget_amount']}, Spent so far is {b['spent']}, Remaining budget: {b['remaining']}")
    else:
        context_lines.append("  * No budgets set for the current month.")
        
    context_lines.append("- Active Savings Goals:")
    if goals:
        for g in goals:
            context_lines.append(f"  * Goal '{g['name']}': Target: {g['target_amount']}, Saved: {g['current_amount']}, Deadline: {g['deadline'] or 'none'}")
    else:
        context_lines.append("  * No active savings goals.")
        
    context_lines.append("- Recent Transactions (last 20):")
    recent_txns = txns[:20]
    if recent_txns:
        for t in recent_txns:
            context_lines.append(f"  * {t['txn_date']}: {t['category_type'].upper()} of {t['amount']} for '{t['category_name']}' (Desc: {t['description'] or 'none'})")
    else:
        context_lines.append("  * No transactions recorded.")
        
    context = "\n".join(context_lines)
    
    # 3. Call Gemini SDK if Key exists
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            system_instruction = (
                "You are FinanceOS AI, an intelligent, helpful, and concise financial assistant. "
                "You have access to the user's real-time financial stats in the prompt context. "
                "Analyze the user's transactions, budget limits, or savings goals to answer their questions. "
                "Always format monetary values clearly. Keep answers under 3-4 sentences when possible. "
                "If they ask about items not present in the context, politely mention that you don't have access to that information."
            )
            prompt = f"{system_instruction}\n\n[USER DATA CONTEXT]\n{context}\n\nUser Question: {req.message}"
            response = model.generate_content(prompt)
            return {"response": response.text}
        except Exception as e:
            print(f"Gemini API Error: {e}")
            # Fall through to local fallback
            
    # 4. Fallback Mode (Rule-based parsing)
    msg = req.message.lower()
    total_spent = sum(float(t['amount']) for t in txns if t['category_type'] == 'expense')
    total_income = sum(float(t['amount']) for t in txns if t['category_type'] == 'income')
    
    if "spent" in msg or "expense" in msg or "spend" in msg:
        if budgets_status:
            exceeded = [b for b in budgets_status if b['spent'] > b['budget_amount']]
            exceeded_str = f" You have exceeded budget in: {', '.join([b['category'] for b in exceeded])}." if exceeded else ""
            return {"response": f"Based on my quick check, your total recorded expenses are {total_spent:.2f}. You have {len(budgets_status)} active budgets.{exceeded_str}"}
        return {"response": f"Your total expenses recorded so far are {total_spent:.2f}. No active budgets are set for this month yet."}
    elif "income" in msg or "salary" in msg or "earn" in msg:
        return {"response": f"You have recorded a total income of {total_income:.2f} across all transactions."}
    elif "goal" in msg or "save" in msg or "saving" in msg:
        if goals:
            g_str = ", ".join([f"'{g['name']}' ({g['current_amount']}/{g['target_amount']})" for g in goals])
            return {"response": f"You are currently tracking {len(goals)} savings goals: {g_str}."}
        return {"response": "You don't have any active savings goals set up yet. Go to the Savings page to start one!"}
    
    return {
        "response": (
            "Hi! I am FinanceOS AI. I'm currently running in local fallback mode. "
            f"I see you have recorded {len(txns)} transactions, {len(budgets_status)} active budgets, "
            f"and {len(goals)} active savings goals. To get personalized analysis with generative intelligence, "
            "please configure the GEMINI_API_KEY environment variable."
        )
    }

