# services.py
from datetime import date
from db import get_cursor

# ---------- Categories ----------
def ensure_default_categories(user_id: int):
    defaults = [
        ("Salary",        "income"),
        ("Bonus",         "income"),
        ("Food",          "expense"),
        ("Rent",          "expense"),
        ("Transport",     "expense"),
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
                       amount: float, txn_date: date,
                       description: str | None = None) -> bool:
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

    income  = next((r["total"] for r in rows if r["type"] == "income"),  0) or 0
    expense = next((r["total"] for r in rows if r["type"] == "expense"), 0) or 0
    return {"income": float(income), "expense": float(expense), "savings": float(income - expense)}


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

    income  = next((r["total"] for r in rows if r["type"] == "income"),  0) or 0
    expense = next((r["total"] for r in rows if r["type"] == "expense"), 0) or 0
    return {"income": float(income), "expense": float(expense), "savings": float(income - expense)}


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
        budget = float(budget_row["amount"]) if budget_row else 0.0

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
        spent = float(cur.fetchone()["spent"])

    return {
        "budget": budget,
        "spent": spent,
        "remaining": budget - spent,
        "exceeded": spent > budget if budget > 0 else False,
    }


# ---------- Admin ----------
def admin_system_stats(month: int | None = None, year: int | None = None) -> dict:
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(id) AS total_users FROM users WHERE is_admin = 0")
        total_users = cur.fetchone()["total_users"]

        sql = "SELECT COUNT(id) AS total_txns, COALESCE(SUM(amount), 0) AS total_volume FROM transactions"
        params = []
        if month is not None and year is not None:
            sql += " WHERE MONTH(txn_date) = %s AND YEAR(txn_date) = %s"
            params.extend([month, year])

        cur.execute(sql, tuple(params))
        txn_stats = cur.fetchone()

    return {
        "total_users": total_users,
        "total_transactions": txn_stats["total_txns"],
        "total_volume": float(txn_stats["total_volume"])
    }

def admin_list_users(month: int | None = None, year: int | None = None):
    with get_cursor() as cur:
        join_clause = "LEFT JOIN transactions t ON u.id = t.user_id"
        params = []
        if month is not None and year is not None:
            join_clause += " AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s"
            params.extend([month, year])

        sql = f"""
            SELECT u.id, u.username, u.created_at, 
                   COUNT(t.id) AS transaction_count,
                   COALESCE(SUM(t.amount), 0) AS total_spent
            FROM users u
            {join_clause}
            WHERE u.is_admin = 0
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """
        cur.execute(sql, tuple(params))
        users = cur.fetchall()
        for u in users:
            u["total_spent"] = float(u["total_spent"])
        return users

def admin_delete_user(user_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM users WHERE id = %s AND is_admin = 0", (user_id,))
        return cur.rowcount > 0


# ---------- Charts ----------
def category_breakdown(user_id: int, month: int, year: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT c.name, c.type, COALESCE(SUM(t.amount), 0) AS total
            FROM categories c
            LEFT JOIN transactions t ON t.category_id = c.id
                AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s
            WHERE c.user_id = %s AND c.type = 'expense'
            GROUP BY c.id, c.name, c.type
            HAVING total > 0
            ORDER BY total DESC
            """,
            (month, year, user_id),
        )
        rows = cur.fetchall()
    return [{"name": r["name"], "value": float(r["total"])} for r in rows]


def monthly_trend(user_id: int, year: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT MONTH(t.txn_date) AS mon, c.type,
                   COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND YEAR(t.txn_date) = %s
            GROUP BY mon, c.type
            ORDER BY mon
            """,
            (user_id, year),
        )
        rows = cur.fetchall()

    month_names = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]
    result = {i+1: {"month": month_names[i], "income": 0.0, "expense": 0.0}
              for i in range(12)}
    for r in rows:
        m = r["mon"]
        result[m][r["type"]] = float(r["total"])
    return list(result.values())


# ---------- Split Groups ----------
def create_split_group(owner_id: int, name: str, description: str = None) -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO split_groups (owner_id, name, description) VALUES (%s, %s, %s)",
            (owner_id, name, description),
        )
        return cur.lastrowid


def list_split_groups(user_id: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT g.id, g.name, g.description, g.created_at, g.owner_id,
                   COUNT(DISTINCT gm.user_id) AS member_count,
                   COUNT(DISTINCT se.id) AS expense_count
            FROM split_groups g
            JOIN split_group_members gm_self ON gm_self.group_id = g.id AND gm_self.user_id = %s
            LEFT JOIN split_group_members gm ON gm.group_id = g.id
            LEFT JOIN split_expenses se ON se.group_id = g.id
            GROUP BY g.id
            ORDER BY g.created_at DESC
            """,
            (user_id,),
        )
        return cur.fetchall()


def add_group_member(group_id: int, username: str) -> dict:
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE username = %s AND is_admin = 0", (username,))
        row = cur.fetchone()
        if not row:
            return {"error": "User not found"}
        uid = row["id"]
        cur.execute(
            "INSERT IGNORE INTO split_group_members (group_id, user_id) VALUES (%s, %s)",
            (group_id, uid),
        )
        return {"user_id": uid, "username": username}


def get_group_members(group_id: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.username
            FROM split_group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = %s
            ORDER BY u.username
            """,
            (group_id,),
        )
        return cur.fetchall()


def add_split_expense(group_id: int, paid_by: int, description: str,
                      amount: float, expense_date: str,
                      split_with: list[int]) -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO split_expenses (group_id, paid_by, description, amount, expense_date)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (group_id, paid_by, description, amount, expense_date),
        )
        expense_id = cur.lastrowid
        share = round(amount / len(split_with), 2) if split_with else amount
        for uid in split_with:
            cur.execute(
                "INSERT INTO split_participants (expense_id, user_id, share) VALUES (%s, %s, %s)",
                (expense_id, uid, share),
            )
        return expense_id


def list_split_expenses(group_id: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT se.id, se.description, se.amount, se.expense_date,
                   u.username AS paid_by_name,
                   se.paid_by
            FROM split_expenses se
            JOIN users u ON u.id = se.paid_by
            WHERE se.group_id = %s
            ORDER BY se.expense_date DESC
            """,
            (group_id,),
        )
        expenses = cur.fetchall()
        for e in expenses:
            e["amount"] = float(e["amount"])
            cur.execute(
                """
                SELECT u.id, u.username, sp.share, sp.settled
                FROM split_participants sp
                JOIN users u ON u.id = sp.user_id
                WHERE sp.expense_id = %s
                """,
                (e["id"],),
            )
            parts = cur.fetchall()
            for p in parts:
                p["share"] = float(p["share"])
            e["participants"] = parts
        return expenses


def get_group_balances(group_id: int) -> list:
    """Calculate net balances: positive = owed money, negative = owes money."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT se.paid_by, SUM(se.amount) AS paid_total
            FROM split_expenses se
            WHERE se.group_id = %s
            GROUP BY se.paid_by
            """,
            (group_id,),
        )
        paid_rows = {r["paid_by"]: float(r["paid_total"]) for r in cur.fetchall()}

        cur.execute(
            """
            SELECT sp.user_id, SUM(sp.share) AS owed_total
            FROM split_participants sp
            JOIN split_expenses se ON se.id = sp.expense_id
            WHERE se.group_id = %s AND sp.settled = 0
            GROUP BY sp.user_id
            """,
            (group_id,),
        )
        owed_rows = {r["user_id"]: float(r["owed_total"]) for r in cur.fetchall()}

        members = get_group_members(group_id)
        balances = []
        for m in members:
            uid = m["id"]
            net = paid_rows.get(uid, 0.0) - owed_rows.get(uid, 0.0)
            balances.append({"user_id": uid, "username": m["username"], "balance": round(net, 2)})
        return balances


def settle_participant(expense_id: int, user_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE split_participants SET settled = 1 WHERE expense_id = %s AND user_id = %s",
            (expense_id, user_id),
        )
        return cur.rowcount > 0


# ---------- Savings Goals ----------
def list_goals(user_id: int):
    with get_cursor() as cur:
        cur.execute("SELECT id, name, target_amount, current_amount, deadline, color FROM savings_goals WHERE user_id = %s", (user_id,))
        return cur.fetchall()

def create_goal(user_id: int, name: str, target: float, color: str, deadline: date | None = None):
    with get_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO savings_goals (user_id, name, target_amount, color, deadline) VALUES (%s, %s, %s, %s, %s)",
            (user_id, name, target, color, deadline)
        )
        return cur.lastrowid

def add_funds_to_goal(user_id: int, goal_id: int, amount: float):
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE savings_goals SET current_amount = current_amount + %s WHERE id = %s AND user_id = %s",
            (amount, goal_id, user_id)
        )
        return cur.rowcount > 0

def delete_goal(user_id: int, goal_id: int):
    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
        return cur.rowcount > 0


# ---------- Smart Notifications ----------
def get_user_notifications(user_id: int):
    notifications = []
    with get_cursor() as cur:
        # Check budgets > 90%
        curr_month = date.today().month
        curr_year = date.today().year
        cur.execute("""
            SELECT b.amount as budget_amount, c.name as cat_name, 
                   IFNULL(SUM(t.amount), 0) as spent
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            LEFT JOIN transactions t ON t.category_id = c.id 
                 AND MONTH(t.txn_date) = b.month AND YEAR(t.txn_date) = b.year
            WHERE b.user_id = %s AND b.month = %s AND b.year = %s
            GROUP BY b.id
        """, (user_id, curr_month, curr_year))
        
        for row in cur.fetchall():
            if row['budget_amount'] > 0:
                ratio = float(row['spent']) / float(row['budget_amount'])
                if ratio >= 0.9:
                    # Give a unique ID based on category and month
                    notifications.append({
                        "id": f"warn-budget-{row['cat_name']}-{curr_month}",
                        "type": "warning",
                        "title": "Budget Alert",
                        "message": f"You have spent {ratio*100:.1f}% of your '{row['cat_name']}' budget."
                    })
        
        # Check pending split expenses
        cur.execute("""
            SELECT sg.name, SUM(sp.share) as owed
            FROM split_participants sp
            JOIN split_expenses se ON sp.expense_id = se.id
            JOIN split_groups sg ON se.group_id = sg.id
            WHERE sp.user_id = %s AND sp.settled = 0 AND se.paid_by != %s
            GROUP BY sg.id
        """, (user_id, user_id))
        
        for row in cur.fetchall():
            if row['owed'] and row['owed'] > 0:
                notifications.append({
                    "id": f"split-owed-{row['name']}",
                    "type": "info",
                    "title": "Pending Split Balance",
                    "message": f"You owe ${float(row['owed']):.2f} in group '{row['name']}'."
                })
                
    return notifications


def delete_split_group(group_id: int, owner_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM split_groups WHERE id = %s AND owner_id = %s",
            (group_id, owner_id),
        )
        return cur.rowcount > 0