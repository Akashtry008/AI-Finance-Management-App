# services.py
from datetime import date
from db import get_cursor

# ---------- Categories ----------
def ensure_default_categories(user_id: int):
    defaults = [
        ("Salary", "income"),
        ("Bonus", "income"),
        ("Food", "expense"),
        ("Rent", "expense"),
        ("Transport", "expense"),
        ("Entertainment", "expense"),
    ]
    with get_cursor(commit=True) as cur:
        for name, ctype in defaults:
            cur.execute(
                """
                INSERT IGNORE INTO categories (user_id, name, type)
                VALUES (%s, %s, %s)
                """,
                (user_id, name, ctype),
            )

def list_categories(user_id: int, ctype: str | None = None):
    with get_cursor() as cur:
        if ctype:
            cur.execute(
                "SELECT id, name, type FROM categories WHERE user_id = %s AND type = %s ORDER BY name",
                (user_id, ctype),
            )
        else:
            cur.execute(
                "SELECT id, name, type FROM categories WHERE user_id = %s ORDER BY type, name",
                (user_id,),
            )
        return cur.fetchall()

# ---------- Transactions ----------
def add_transaction(user_id: int, category_id: int, amount: float,
                    txn_date: date, description: str | None = None):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO transactions (user_id, category_id, amount, description, txn_date)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, category_id, amount, description, txn_date),
        )

def update_transaction(user_id: int, txn_id: int, category_id: int,
                       amount: float, txn_date: date, description: str | None = None) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE transactions
            SET category_id = %s, amount = %s, description = %s, txn_date = %s
            WHERE id = %s AND user_id = %s
            """,
            (category_id, amount, description, txn_date, txn_id, user_id),
        )
        return cur.rowcount > 0

def delete_transaction(user_id: int, txn_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM transactions WHERE id = %s AND user_id = %s",
            (txn_id, user_id),
        )
        return cur.rowcount > 0

def list_transactions(user_id: int, month: int | None = None, year: int | None = None):
    sql = """
        SELECT t.id, t.amount, t.description, t.txn_date,
               c.name AS category_name, c.type AS category_type
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = %s
    """
    params: list = [user_id]
    if month is not None and year is not None:
        sql += " AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s"
        params.extend([month, year])
    sql += " ORDER BY t.txn_date DESC"
    with get_cursor() as cur:
        cur.execute(sql, tuple(params))
        return cur.fetchall()

# ---------- Reports ----------
def monthly_report(user_id: int, month: int, year: int) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT c.type, SUM(t.amount) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s
              AND MONTH(t.txn_date) = %s
              AND YEAR(t.txn_date) = %s
            GROUP BY c.type
            """,
            (user_id, month, year),
        )
        rows = cur.fetchall()

    income = next((r["total"] for r in rows if r["type"] == "income"), 0) or 0
    expense = next((r["total"] for r in rows if r["type"] == "expense"), 0) or 0
    savings = income - expense

    return {"income": income, "expense": expense, "savings": savings}

def yearly_report(user_id: int, year: int) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT c.type, SUM(t.amount) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.type
            """,
            (user_id, year),
        )
        rows = cur.fetchall()

    income = next((r["total"] for r in rows if r["type"] == "income"), 0) or 0
    expense = next((r["total"] for r in rows if r["type"] == "expense"), 0) or 0
    savings = income - expense

    return {"income": income, "expense": expense, "savings": savings}

# ---------- Budgets ----------
def set_budget(user_id: int, category_id: int, month: int, year: int, amount: float):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO budgets (user_id, category_id, month, year, amount)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
            """,
            (user_id, category_id, month, year, amount),
        )

def get_budget_status(user_id: int, category_id: int, month: int, year: int) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT amount FROM budgets
            WHERE user_id = %s AND category_id = %s AND month = %s AND year = %s
            """,
            (user_id, category_id, month, year),
        )
        budget_row = cur.fetchone()
        budget = budget_row["amount"] if budget_row else 0

        cur.execute(
            """
            SELECT COALESCE(SUM(t.amount), 0) AS spent
            FROM transactions t
            WHERE t.user_id = %s
              AND t.category_id = %s
              AND MONTH(t.txn_date) = %s
              AND YEAR(t.txn_date) = %s
            """,
            (user_id, category_id, month, year),
        )
        spent = cur.fetchone()["spent"]

    return {
        "budget": budget,
        "spent": spent,
        "remaining": budget - spent,
        "exceeded": spent > budget if budget > 0 else False,
    }