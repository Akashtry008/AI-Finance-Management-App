# backup.py
import json
from db import get_cursor

def backup_user_data(user_id: int, filepath: str):
    data: dict = {}
    with get_cursor() as cur:
        # user
        cur.execute("SELECT id, username, created_at FROM users WHERE id = %s", (user_id,))
        data["user"] = cur.fetchone()

        # categories
        cur.execute(
            "SELECT id, name, type FROM categories WHERE user_id = %s",
            (user_id,),
        )
        data["categories"] = cur.fetchall()

        # transactions
        cur.execute(
            """
            SELECT id, category_id, amount, description, txn_date
            FROM transactions WHERE user_id = %s
            """,
            (user_id,),
        )
        data["transactions"] = cur.fetchall()

        # budgets
        cur.execute(
            """
            SELECT id, category_id, month, year, amount
            FROM budgets WHERE user_id = %s
            """,
            (user_id,),
        )
        data["budgets"] = cur.fetchall()

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, indent=2)

def restore_user_data(user_id: int, filepath: str):
    """Simple restore that assumes same user & categories; can be improved."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # For safety you may want to clear old data or map category ids carefully.
    # Here we only restore transactions and budgets using current category ids.
    with get_cursor(commit=True) as cur:
        for t in data.get("transactions", []):
            cur.execute(
                """
                INSERT IGNORE INTO transactions
                    (user_id, category_id, amount, description, txn_date)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, t["category_id"], t["amount"], t["description"], t["txn_date"]),
            )
        for b in data.get("budgets", []):
            cur.execute(
                """
                INSERT IGNORE INTO budgets
                    (user_id, category_id, month, year, amount)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, b["category_id"], b["month"], b["year"], b["amount"]),
            )