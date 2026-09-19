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


DEFAULT_CATEGORIES = [
    # Expenses
    ("Food & Dining", "expense"),
    ("Groceries", "expense"),
    ("Transportation", "expense"),
    ("Housing & Rent", "expense"),
    ("Utilities & Bills", "expense"),
    ("Entertainment & Leisure", "expense"),
    ("Shopping & Lifestyle", "expense"),
    ("Healthcare & Medical", "expense"),
    ("Education & Learning", "expense"),
    ("Travel & Vacation", "expense"),
    ("Personal Care", "expense"),
    ("Miscellaneous", "expense"),
    # Income
    ("Salary & Wages", "income"),
    ("Freelance & Consulting", "income"),
    ("Investments & Dividends", "income"),
    ("Rental Income", "income"),
    ("Gifts & Grants", "income"),
    ("Other Income", "income"),
]

def seed_default_categories(user_id: int):
    with get_cursor(commit=True) as cur:
        for name, ctype in DEFAULT_CATEGORIES:
            cur.execute(
                "INSERT IGNORE INTO categories (user_id, name, type) VALUES (%s, %s, %s)",
                (user_id, name, ctype),
            )

def list_categories(user_id: int, ctype: str | None = None):
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM categories WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        if not row or row["cnt"] == 0:
            seed_default_categories(user_id)

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
                    txn_date: date, description: str | None = None,
                    tags: str | None = None):
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO transactions (user_id, category_id, amount, description, txn_date, tags)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (user_id, category_id, amount, description, txn_date, tags or ""),
        )


def update_transaction(user_id: int, txn_id: int, category_id: int,
                       amount: float, txn_date: date,
                       description: str | None = None,
                       tags: str | None = None) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            UPDATE transactions
            SET category_id = %s, amount = %s, description = %s, txn_date = %s, tags = %s
            WHERE id = %s AND user_id = %s
            """,
            (category_id, amount, description, txn_date, tags or "", txn_id, user_id),
        )
        return cur.rowcount > 0


def delete_transaction(user_id: int, txn_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM transactions WHERE id = %s AND user_id = %s",
            (txn_id, user_id),
        )
        return cur.rowcount > 0


def list_transactions(user_id: int, month: int | None = None, year: int | None = None,
                      start_date: str | None = None, end_date: str | None = None,
                      tag: str | None = None):
    sql = """
        SELECT t.id, t.amount, t.description, t.txn_date, t.category_id,
               COALESCE(t.tags, '') AS tags,
               c.name AS category_name, c.type AS category_type
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = %s
    """
    params: list = [user_id]
    if start_date and end_date:
        sql += " AND t.txn_date >= %s AND t.txn_date <= %s"
        params.extend([start_date, end_date])
    elif month is not None and year is not None:
        sql += " AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s"
        params.extend([month, year])
    if tag:
        sql += " AND t.tags LIKE %s"
        params.append(f"%{tag}%")
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
            SELECT amount, IFNULL(rollover, 1) AS rollover FROM budgets
            WHERE user_id = %s AND category_id = %s AND month = %s AND year = %s
            """,
            (user_id, category_id, month, year),
        )
        budget_row = cur.fetchone()
        budget = float(budget_row["amount"]) if budget_row else 0.0
        is_rollover = bool(budget_row["rollover"]) if budget_row else True

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

        # Calculate rollover from previous month if enabled
        rollover_amount = 0.0
        if is_rollover:
            prev_month = 12 if month == 1 else month - 1
            prev_year = year - 1 if month == 1 else year

            cur.execute(
                """
                SELECT amount FROM budgets
                WHERE user_id = %s AND category_id = %s AND month = %s AND year = %s
                """,
                (user_id, category_id, prev_month, prev_year),
            )
            prev_budget_row = cur.fetchone()
            if prev_budget_row and float(prev_budget_row["amount"]) > 0:
                prev_budget = float(prev_budget_row["amount"])
                cur.execute(
                    """
                    SELECT COALESCE(SUM(t.amount), 0) AS spent
                    FROM transactions t
                    WHERE t.user_id = %s
                      AND t.category_id = %s
                      AND MONTH(t.txn_date) = %s
                      AND YEAR(t.txn_date) = %s
                    """,
                    (user_id, category_id, prev_month, prev_year),
                )
                prev_spent = float(cur.fetchone()["spent"])
                if prev_budget > prev_spent:
                    rollover_amount = round(prev_budget - prev_spent, 2)

        effective_budget = round(budget + rollover_amount, 2)

    return {
        "budget": budget,
        "rollover_amount": rollover_amount,
        "effective_budget": effective_budget,
        "spent": spent,
        "remaining": round(effective_budget - spent, 2),
        "exceeded": spent > effective_budget if effective_budget > 0 else False,
    }


def get_all_budgets_status(user_id: int, month: int, year: int) -> list:
    with get_cursor() as cur:
        cur.execute("""
            SELECT b.category_id, b.amount AS budget_amount, c.name AS cat_name
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = %s AND b.month = %s AND b.year = %s
            ORDER BY c.name
        """, (user_id, month, year))
        budget_rows = cur.fetchall()
        budgets_detail = []
        for b in budget_rows:
            status = get_budget_status(user_id, b["category_id"], month, year)
            limit = float(status.get("effective_budget") or b["budget_amount"])
            spent = float(status.get("spent") or 0.0)
            budgets_detail.append({
                "category_id": b["category_id"],
                "category_name": b["cat_name"],
                "limit_amount": limit,
                "amount": limit,
                "spent": spent,
                "remaining": round(limit - spent, 2),
                "exceeded": spent > limit
            })
        return budgets_detail


def get_user_pending_split_debt(user_id: int) -> float:
    with get_cursor() as cur:
        cur.execute("""
            SELECT COALESCE(SUM(sp.share), 0) AS total_debt
            FROM split_participants sp
            JOIN split_expenses se ON sp.expense_id = se.id
            WHERE sp.user_id = %s AND sp.settled = 0 AND se.paid_by != %s
        """, (user_id, user_id))
        row = cur.fetchone()
        return float(row["total_debt"]) if row and row.get("total_debt") else 0.0


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
def create_split_group(owner_id: int, name: str, description: str = None, target_budget: float | None = None) -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO split_groups (owner_id, name, description, target_budget) VALUES (%s, %s, %s, %s)",
            (owner_id, name, description, target_budget),
        )
        return cur.lastrowid


def list_split_groups(user_id: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT g.id, g.name, g.description, g.created_at, g.owner_id, g.target_budget,
                   COUNT(DISTINCT gm.user_id) AS member_count,
                   COUNT(DISTINCT se.id) AS expense_count,
                   COALESCE(exp_totals.total_spent, 0) AS total_spent
            FROM split_groups g
            JOIN split_group_members gm_self ON gm_self.group_id = g.id AND gm_self.user_id = %s
            LEFT JOIN split_group_members gm ON gm.group_id = g.id
            LEFT JOIN split_expenses se ON se.group_id = g.id
            LEFT JOIN (
                SELECT group_id, SUM(amount) AS total_spent
                FROM split_expenses
                GROUP BY group_id
            ) exp_totals ON exp_totals.group_id = g.id
            GROUP BY g.id
            ORDER BY g.created_at DESC
            """,
            (user_id,),
        )
        groups = cur.fetchall()
        for g in groups:
            g["target_budget"] = float(g["target_budget"]) if g.get("target_budget") is not None else None
            g["total_spent"] = float(g["total_spent"]) if g.get("total_spent") is not None else 0.0
        return groups


def add_group_member(group_id: int, username: str) -> dict:
    if not username:
        return {"error": "Username is required"}
    names = [n.strip() for n in username.split(",") if n.strip()]
    if not names:
        return {"error": "Valid username required"}

    added_members = []
    with get_cursor(commit=True) as cur:
        for name in names:
            cur.execute("SELECT id, username FROM users WHERE username = %s", (name,))
            row = cur.fetchone()
            if row:
                uid = row["id"]
                uname = row["username"]
            else:
                # Auto-create lightweight user so groups can split with friends immediately
                cur.execute(
                    "INSERT INTO users (username, display_name, password_hash, is_admin) VALUES (%s, %s, '', 0)",
                    (name, name),
                )
                uid = cur.lastrowid
                uname = name

            cur.execute(
                "INSERT IGNORE INTO split_group_members (group_id, user_id) VALUES (%s, %s)",
                (group_id, uid),
            )
            added_members.append({"user_id": uid, "username": uname})

    if len(added_members) == 1:
        return added_members[0]
    return {"added": added_members, "count": len(added_members)}


def get_candidate_members(group_id: int) -> list:
    """Return registered users who are not yet members of the group for quick-add suggestions."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.username, u.display_name
            FROM users u
            WHERE u.is_admin = 0
              AND u.id NOT IN (
                  SELECT gm.user_id FROM split_group_members gm WHERE gm.group_id = %s
              )
            ORDER BY u.username
            LIMIT 15
            """,
            (group_id,),
        )
        return cur.fetchall()


def remove_group_member(group_id: int, user_id: int) -> dict:
    """Remove a member from a group if they don't have unsettled expenses or paid expenses in this group."""
    with get_cursor(commit=True) as cur:
        # Check if user paid any expenses in this group
        cur.execute("SELECT COUNT(*) AS c FROM split_expenses WHERE group_id = %s AND paid_by = %s", (group_id, user_id))
        if cur.fetchone()["c"] > 0:
            return {"error": "Cannot remove member who has paid expenses in this group."}

        # Check if user has unsettled participant shares in this group
        cur.execute("""
            SELECT COUNT(*) AS c 
            FROM split_participants sp
            JOIN split_expenses se ON sp.expense_id = se.id
            WHERE se.group_id = %s AND sp.user_id = %s AND sp.settled = 0
        """, (group_id, user_id))
        if cur.fetchone()["c"] > 0:
            return {"error": "Cannot remove member with unsettled balances."}

        cur.execute("DELETE FROM split_group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id))
        return {"success": True, "msg": "Member removed"}


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
                      split_with: list[int],
                      custom_shares: dict = None,
                      original_currency: str = None,
                      original_amount: float = None,
                      exchange_rate: float = 1.0) -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO split_expenses (group_id, paid_by, description, amount, expense_date, original_currency, original_amount, exchange_rate)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (group_id, paid_by, description, amount, expense_date, original_currency, original_amount, exchange_rate),
        )
        expense_id = cur.lastrowid
        split_with = list(dict.fromkeys(split_with)) if split_with else [paid_by]
        default_share = round(amount / len(split_with), 2) if split_with else amount
        for uid in split_with:
            if custom_shares:
                s = custom_shares.get(str(uid), custom_shares.get(uid, default_share))
                share = round(float(s), 2)
            else:
                share = default_share
            cur.execute(
                "INSERT INTO split_participants (expense_id, user_id, share) VALUES (%s, %s, %s)",
                (expense_id, uid, share),
            )

        # Auto-record personal transaction for paid_by user so it reflects in their transactions ledger
        try:
            cur.execute("SELECT name FROM split_groups WHERE id = %s", (group_id,))
            g_row = cur.fetchone()
            g_name = g_row["name"] if g_row else "Group"

            cur.execute(
                "SELECT id, name FROM categories WHERE user_id = %s AND type = 'expense'",
                (paid_by,)
            )
            user_cats = cur.fetchall()
            matched_cat_id = None
            desc_lower = (description or "").lower()
            for c in user_cats:
                if c["name"].lower() in desc_lower or desc_lower in c["name"].lower():
                    matched_cat_id = c["id"]
                    break
            if not matched_cat_id and user_cats:
                matched_cat_id = user_cats[0]["id"]
            if not matched_cat_id:
                try:
                    cur.execute("INSERT INTO categories (user_id, name, type) VALUES (%s, %s, 'expense')", (paid_by, 'Group Expense'))
                    matched_cat_id = cur.lastrowid
                except Exception:
                    cur.execute("SELECT id FROM categories WHERE user_id = %s LIMIT 1", (paid_by,))
                    row = cur.fetchone()
                    matched_cat_id = row["id"] if row else 1

            clean_tag = f"#GroupExpense, #{g_name.replace(' ', '')}"
            cur.execute(
                """
                INSERT INTO transactions (user_id, category_id, amount, txn_date, description, tags)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (paid_by, matched_cat_id, amount, expense_date, f"{description} ({g_name})", clean_tag),
            )
        except Exception as ex:
            print(f"[add_split_expense] personal transaction auto-logging note: {ex}")

        return expense_id


def list_split_expenses(group_id: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT se.id, se.description, se.amount, se.expense_date,
                   se.original_currency, se.original_amount, se.exchange_rate,
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
            if e.get("original_amount") is not None:
                e["original_amount"] = float(e["original_amount"])
            if e.get("exchange_rate") is not None:
                e["exchange_rate"] = float(e["exchange_rate"])
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
        # 1. Total paid by each user in group
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

        # 2. Total share consumed by each user across all expenses (regardless of settled)
        cur.execute(
            """
            SELECT sp.user_id, SUM(sp.share) AS share_total
            FROM split_participants sp
            JOIN split_expenses se ON se.id = sp.expense_id
            WHERE se.group_id = %s
            GROUP BY sp.user_id
            """,
            (group_id,),
        )
        share_rows = {r["user_id"]: float(r["share_total"]) for r in cur.fetchall()}

        # 3. Pending unsettled amount this user is owed by other members (user paid, others haven't settled)
        cur.execute(
            """
            SELECT se.paid_by, SUM(sp.share) AS pending_owed_to_me
            FROM split_participants sp
            JOIN split_expenses se ON se.id = sp.expense_id
            WHERE se.group_id = %s AND sp.user_id != se.paid_by AND sp.settled = 0
            GROUP BY se.paid_by
            """,
            (group_id,),
        )
        pending_owed_to_user = {r["paid_by"]: float(r["pending_owed_to_me"]) for r in cur.fetchall()}

        # 4. Pending unsettled amount this user owes to other payers
        cur.execute(
            """
            SELECT sp.user_id, SUM(sp.share) AS pending_i_owe
            FROM split_participants sp
            JOIN split_expenses se ON se.id = sp.expense_id
            WHERE se.group_id = %s AND sp.user_id != se.paid_by AND sp.settled = 0
            GROUP BY sp.user_id
            """,
            (group_id,),
        )
        pending_i_owe = {r["user_id"]: float(r["pending_i_owe"]) for r in cur.fetchall()}

        members = get_group_members(group_id)
        balances = []
        for m in members:
            uid = m["id"]
            paid = paid_rows.get(uid, 0.0)
            share = share_rows.get(uid, 0.0)
            lifetime_net = round(paid - share, 2)
            pending_net = round(pending_owed_to_user.get(uid, 0.0) - pending_i_owe.get(uid, 0.0), 2)
            balances.append({
                "user_id": uid,
                "username": m["username"],
                "balance": pending_net,  # Active pending net balance
                "total_paid": round(paid, 2),
                "total_share": round(share, 2),
                "lifetime_balance": lifetime_net,
                "pending_owed_to_user": round(pending_owed_to_user.get(uid, 0.0), 2),
                "pending_i_owe": round(pending_i_owe.get(uid, 0.0), 2),
            })
        return balances


def settle_participant(expense_id: int, user_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE split_participants SET settled = 1 WHERE expense_id = %s AND user_id = %s",
            (expense_id, user_id),
        )
        return cur.rowcount > 0


def unsettle_participant(expense_id: int, user_id: int) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE split_participants SET settled = 0 WHERE expense_id = %s AND user_id = %s",
            (expense_id, user_id),
        )
        return cur.rowcount > 0


def toggle_participant_settle(expense_id: int, user_id: int) -> dict:
    with get_cursor(commit=True) as cur:
        cur.execute(
            "SELECT settled FROM split_participants WHERE expense_id = %s AND user_id = %s",
            (expense_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            return {"error": "Participant not found"}
        new_status = 0 if row["settled"] == 1 else 1
        cur.execute(
            "UPDATE split_participants SET settled = %s WHERE expense_id = %s AND user_id = %s",
            (new_status, expense_id, user_id),
        )
        return {"success": True, "settled": new_status}


def get_group_settlement_plan(group_id: int) -> dict:
    """
    Computes:
    1. Overall group total spent.
    2. Breakdown of who paid how much, who consumed how much, and net balance.
    3. Optimized transfer list ('Who Pays Whom') to settle all pending debts with minimal payments.
    """
    balances = get_group_balances(group_id)
    with get_cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(amount), 0) as total_spent FROM split_expenses WHERE group_id = %s", (group_id,))
        total_spent = float(cur.fetchone()["total_spent"])

        cur.execute("""
            SELECT COUNT(*) AS total_shares,
                   SUM(CASE WHEN sp.settled = 1 THEN 1 ELSE 0 END) AS settled_shares,
                   SUM(CASE WHEN sp.settled = 0 AND sp.user_id != se.paid_by THEN sp.share ELSE 0 END) AS pending_amount
            FROM split_participants sp
            JOIN split_expenses se ON se.id = sp.expense_id
            WHERE se.group_id = %s
        """, (group_id,))
        stats = cur.fetchone() or {"total_shares": 0, "settled_shares": 0, "pending_amount": 0.0}
        pending_amount = float(stats["pending_amount"] or 0.0)

    # Debt Simplification Algorithm based on pending balance
    debtors = []
    creditors = []
    for b in balances:
        net = b["balance"]
        if net < -0.01:
            debtors.append({"user_id": b["user_id"], "username": b["username"], "amount": abs(net)})
        elif net > 0.01:
            creditors.append({"user_id": b["user_id"], "username": b["username"], "amount": net})

    debtors.sort(key=lambda x: x["amount"], reverse=True)
    creditors.sort(key=lambda x: x["amount"], reverse=True)

    transfers = []
    i = 0
    j = 0
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]
        transfer_amount = min(debtor["amount"], creditor["amount"])
        if transfer_amount > 0.01:
            transfers.append({
                "from_user_id": debtor["user_id"],
                "from_username": debtor["username"],
                "to_user_id": creditor["user_id"],
                "to_username": creditor["username"],
                "amount": round(transfer_amount, 2)
            })
            debtor["amount"] -= transfer_amount
            creditor["amount"] -= transfer_amount

        if debtor["amount"] <= 0.01:
            i += 1
        if creditor["amount"] <= 0.01:
            j += 1

    return {
        "total_spent": round(total_spent, 2),
        "pending_amount": round(pending_amount, 2),
        "is_fully_settled": len(transfers) == 0,
        "members": balances,
        "transfers": transfers
    }


def record_settlement(group_id: int, payer_id: int, receiver_id: int,
                      amount: float, currency: str = "INR", note: str = "") -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO split_settlements (group_id, payer_id, receiver_id, amount, currency, note)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (group_id, payer_id, receiver_id, amount, currency, note or ""),
        )
        return cur.lastrowid


def list_settlements(group_id: int) -> list:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.group_id, s.payer_id, s.receiver_id, s.amount,
                   s.currency, s.settled_at, s.note,
                   p.username AS payer_name,
                   r.username AS receiver_name
            FROM split_settlements s
            JOIN users p ON p.id = s.payer_id
            JOIN users r ON r.id = s.receiver_id
            WHERE s.group_id = %s
            ORDER BY s.settled_at DESC
            """,
            (group_id,),
        )
        rows = cur.fetchall()
        for r in rows:
            r["amount"] = float(r["amount"])
            if r.get("settled_at"):
                r["settled_at"] = str(r["settled_at"])
        return rows


# ---------- Savings Goals ----------
def list_goals(user_id: int):
    with get_cursor(commit=True) as cur:
        # Auto-clamp any legacy overshoot numbers from testing so they never exceed target
        cur.execute("UPDATE savings_goals SET current_amount = target_amount WHERE current_amount > target_amount AND user_id = %s", (user_id,))
        cur.execute("SELECT id, name, target_amount, current_amount, deadline, color, monthly_allocation FROM savings_goals WHERE user_id = %s", (user_id,))
        goals = cur.fetchall()
        for g in goals:
            g["target_amount"] = float(g["target_amount"])
            g["current_amount"] = float(g["current_amount"])
            if g.get("monthly_allocation") is not None:
                g["monthly_allocation"] = float(g["monthly_allocation"])
        return goals

def create_goal(user_id: int, name: str, target: float, color: str, deadline: date | None = None, monthly_allocation: float | None = None):
    with get_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO savings_goals (user_id, name, target_amount, color, deadline, monthly_allocation) VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, name, target, color, deadline, monthly_allocation)
        )
        return cur.lastrowid

def add_funds_to_goal(user_id: int, goal_id: int, amount: float):
    if amount <= 0:
        return False
    with get_cursor(commit=True) as cur:
        # Use LEAST to ensure current_amount never exceeds target_amount
        cur.execute(
            "UPDATE savings_goals SET current_amount = LEAST(target_amount, current_amount + %s) WHERE id = %s AND user_id = %s",
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


# ---------- Comprehensive AI Activity Profile ----------
def get_comprehensive_financial_context(user_id: int) -> dict:
    """Fetch complete financial snapshot of user: cashflow, budgets, goals, split debts, and transactions."""
    today = date.today()
    curr_month = today.month
    curr_year = today.year
    prev_month = 12 if curr_month == 1 else curr_month - 1
    prev_year = curr_year - 1 if curr_month == 1 else curr_year

    with get_cursor() as cur:
        # 1. User profile
        cur.execute("SELECT username, display_name, currency FROM users WHERE id = %s", (user_id,))
        user_info = cur.fetchone() or {"username": "User", "display_name": "User", "currency": "INR"}

        # 2. Current month cashflow
        cur.execute("""
            SELECT c.type, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.type
        """, (user_id, curr_month, curr_year))
        curr_month_map = {r["type"]: float(r["total"]) for r in cur.fetchall()}
        income_this_month = curr_month_map.get("income", 0.0)
        expense_this_month = curr_month_map.get("expense", 0.0)
        net_savings_this_month = income_this_month - expense_this_month
        savings_rate = (net_savings_this_month / income_this_month * 100) if income_this_month > 0 else 0.0

        # 3. Previous month cashflow (for trends)
        cur.execute("""
            SELECT c.type, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.type
        """, (user_id, prev_month, prev_year))
        prev_month_map = {r["type"]: float(r["total"]) for r in cur.fetchall()}
        income_last_month = prev_month_map.get("income", 0.0)
        expense_last_month = prev_month_map.get("expense", 0.0)

        # 4. Top spending categories this month
        cur.execute("""
            SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND c.type = 'expense'
              AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.id, c.name
            HAVING total > 0
            ORDER BY total DESC
        """, (user_id, curr_month, curr_year))
        cat_breakdown = []
        for row in cur.fetchall():
            cat_tot = float(row["total"])
            pct = (cat_tot / expense_this_month * 100) if expense_this_month > 0 else 0.0
            cat_breakdown.append({"category": row["name"], "spent": cat_tot, "percentage": round(pct, 1)})

        # 5. All active budgets & health
        cur.execute("""
            SELECT b.category_id, b.amount AS budget_amount, c.name AS cat_name
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = %s AND b.month = %s AND b.year = %s
            ORDER BY c.name
        """, (user_id, curr_month, curr_year))
        budget_rows = cur.fetchall()
        budgets_detail = []
        for b in budget_rows:
            status = get_budget_status(user_id, b["category_id"], curr_month, curr_year)
            limit = float(b["budget_amount"])
            spent = float(status["spent"])
            rem = float(status["remaining"])
            ratio = (spent / limit * 100) if limit > 0 else 0.0
            health = "exceeded" if spent > limit else ("warning" if ratio >= 80 else "healthy")
            budgets_detail.append({
                "category": b["cat_name"],
                "limit": limit,
                "spent": spent,
                "remaining": rem,
                "utilized_pct": round(ratio, 1),
                "status": health
            })

        # 6. Savings Goals
        cur.execute("""
            SELECT name, target_amount, current_amount, deadline, color
            FROM savings_goals
            WHERE user_id = %s
            ORDER BY current_amount / target_amount DESC
        """, (user_id,))
        goals_detail = []
        for g in cur.fetchall():
            tgt = float(g["target_amount"])
            cur_amt = float(g["current_amount"])
            pct = (cur_amt / tgt * 100) if tgt > 0 else 0.0
            days_left = None
            if g["deadline"]:
                dl = g["deadline"] if isinstance(g["deadline"], date) else date.fromisoformat(str(g["deadline"]))
                days_left = (dl - today).days
            goals_detail.append({
                "name": g["name"],
                "target": tgt,
                "saved": cur_amt,
                "remaining_to_save": max(0.0, tgt - cur_amt),
                "pct_complete": round(pct, 1),
                "deadline": str(g["deadline"]) if g["deadline"] else None,
                "days_left": days_left
            })

        # 7. Split debts & balances
        # Money friends owe the user
        cur.execute("""
            SELECT sg.name AS group_name, u.username AS debtor_name, SUM(sp.share) AS amount
            FROM split_participants sp
            JOIN split_expenses se ON sp.expense_id = se.id
            JOIN split_groups sg ON se.group_id = sg.id
            JOIN users u ON sp.user_id = u.id
            WHERE se.paid_by = %s AND sp.user_id != %s AND sp.settled = 0
            GROUP BY sg.id, sp.user_id
        """, (user_id, user_id))
        owed_to_user = [
            {"friend": r["debtor_name"], "group": r["group_name"], "amount": float(r["amount"])}
            for r in cur.fetchall()
        ]
        total_owed_to_user = sum(item["amount"] for item in owed_to_user)

        # Money user owes to friends
        cur.execute("""
            SELECT sg.name AS group_name, u.username AS creditor_name, SUM(sp.share) AS amount
            FROM split_participants sp
            JOIN split_expenses se ON sp.expense_id = se.id
            JOIN split_groups sg ON se.group_id = sg.id
            JOIN users u ON se.paid_by = u.id
            WHERE sp.user_id = %s AND sp.settled = 0 AND se.paid_by != %s
            GROUP BY sg.id, se.paid_by
        """, (user_id, user_id))
        user_owes = [
            {"friend": r["creditor_name"], "group": r["group_name"], "amount": float(r["amount"])}
            for r in cur.fetchall()
        ]
        total_user_owes = sum(item["amount"] for item in user_owes)
        net_split_balance = total_owed_to_user - total_user_owes

        # 8. Recent transactions (last 30)
        cur.execute("""
            SELECT t.id, t.amount, t.description, t.txn_date, c.name AS category_name, c.type AS category_type
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s
            ORDER BY t.txn_date DESC, t.id DESC
            LIMIT 30
        """, (user_id,))
        recent_txns = [
            {
                "date": str(r["txn_date"]),
                "type": r["category_type"],
                "category": r["category_name"],
                "amount": float(r["amount"]),
                "description": r["description"] or ""
            }
            for r in cur.fetchall()
        ]

    return {
        "user": user_info,
        "date": today.strftime("%Y-%m-%d"),
        "curr_month": curr_month,
        "curr_year": curr_year,
        "curr_month_cashflow": {
            "income": income_this_month,
            "expenses": expense_this_month,
            "net_savings": net_savings_this_month,
            "savings_rate_pct": round(savings_rate, 1)
        },
        "prev_month_cashflow": {
            "income": income_last_month,
            "expenses": expense_last_month
        },
        "category_breakdown": cat_breakdown,
        "budgets": budgets_detail,
        "goals": goals_detail,
        "split_debts": {
            "owed_to_user": owed_to_user,
            "total_owed_to_user": total_owed_to_user,
            "user_owes": user_owes,
            "total_user_owes": total_user_owes,
            "net_split_balance": net_split_balance
        },
        "recent_transactions": recent_txns
    }


# ---------- Advanced Analytics & Reports ----------
def range_report(user_id: int, start_date: str, end_date: str) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT c.type, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND t.txn_date >= %s AND t.txn_date <= %s
            GROUP BY c.type
            """,
            (user_id, start_date, end_date),
        )
        rows = cur.fetchall()
        income = next((float(r["total"]) for r in rows if r["type"] == "income"), 0.0)
        expense = next((float(r["total"]) for r in rows if r["type"] == "expense"), 0.0)

        cur.execute(
            """
            SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND c.type = 'expense'
              AND t.txn_date >= %s AND t.txn_date <= %s
            GROUP BY c.id, c.name
            HAVING total > 0
            ORDER BY total DESC
            """,
            (user_id, start_date, end_date),
        )
        cat_rows = [{"category": r["name"], "spent": float(r["total"])} for r in cur.fetchall()]

    return {
        "start_date": start_date,
        "end_date": end_date,
        "income": round(income, 2),
        "expense": round(expense, 2),
        "savings": round(income - expense, 2),
        "categories": cat_rows,
    }


def period_comparison(user_id: int, month: int, year: int) -> dict:
    """Compare selected month with previous month (MoM) and same month last year (YoY)."""
    prev_m = 12 if month == 1 else month - 1
    prev_y = year - 1 if month == 1 else year
    yoy_y = year - 1

    curr = monthly_report(user_id, month, year)
    mom = monthly_report(user_id, prev_m, prev_y)
    yoy = monthly_report(user_id, month, yoy_y)

    with get_cursor() as cur:
        # Category breakdown for current month
        cur.execute("""
            SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND c.type = 'expense'
              AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.id, c.name
        """, (user_id, month, year))
        curr_cats = {r["name"]: float(r["total"]) for r in cur.fetchall()}

        # Category breakdown for previous month
        cur.execute("""
            SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND c.type = 'expense'
              AND MONTH(t.txn_date) = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.id, c.name
        """, (user_id, prev_m, prev_y))
        mom_cats = {r["name"]: float(r["total"]) for r in cur.fetchall()}

    all_cat_names = sorted(list(set(list(curr_cats.keys()) + list(mom_cats.keys()))))
    cat_comparisons = []
    for name in all_cat_names:
        c_amt = curr_cats.get(name, 0.0)
        p_amt = mom_cats.get(name, 0.0)
        diff = round(c_amt - p_amt, 2)
        pct = round(((c_amt - p_amt) / p_amt * 100), 1) if p_amt > 0 else (100.0 if c_amt > 0 else 0.0)
        cat_comparisons.append({
            "category": name,
            "current_spent": c_amt,
            "prev_spent": p_amt,
            "difference": diff,
            "pct_change": pct,
        })

    def calc_delta(curr_val, prev_val):
        diff = round(curr_val - prev_val, 2)
        pct = round((diff / prev_val * 100), 1) if prev_val > 0 else 0.0
        return {"current": curr_val, "previous": prev_val, "diff": diff, "pct_change": pct}

    return {
        "current_period": f"{year}-{month:02d}",
        "mom": {
            "period": f"{prev_y}-{prev_m:02d}",
            "income": calc_delta(curr["income"], mom["income"]),
            "expense": calc_delta(curr["expense"], mom["expense"]),
            "savings": calc_delta(curr["savings"], mom["savings"]),
        },
        "yoy": {
            "period": f"{yoy_y}-{month:02d}",
            "income": calc_delta(curr["income"], yoy["income"]),
            "expense": calc_delta(curr["expense"], yoy["expense"]),
            "savings": calc_delta(curr["savings"], yoy["savings"]),
        },
        "category_changes": cat_comparisons,
    }


def year_in_review(user_id: int, year: int) -> dict:
    """Financial Wrapped for the given year."""
    with get_cursor() as cur:
        # Yearly totals
        cur.execute("""
            SELECT c.type, COALESCE(SUM(t.amount), 0) AS total, COUNT(t.id) as count
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND YEAR(t.txn_date) = %s
            GROUP BY c.type
        """, (user_id, year))
        totals = {r["type"]: {"total": float(r["total"]), "count": r["count"]} for r in cur.fetchall()}

        total_income = totals.get("income", {}).get("total", 0.0)
        total_expense = totals.get("expense", {}).get("total", 0.0)
        net_savings = round(total_income - total_expense, 2)
        savings_rate = round((net_savings / total_income * 100), 1) if total_income > 0 else 0.0
        total_txns = sum(v["count"] for v in totals.values())

        # Monthly breakdown
        cur.execute("""
            SELECT MONTH(t.txn_date) as month_num, c.type, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND YEAR(t.txn_date) = %s
            GROUP BY MONTH(t.txn_date), c.type
            ORDER BY month_num
        """, (user_id, year))
        m_rows = cur.fetchall()
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        monthly_data = {i: {"month": month_names[i-1], "income": 0.0, "expense": 0.0} for i in range(1, 13)}
        for r in m_rows:
            m = r["month_num"]
            monthly_data[m][r["type"]] = float(r["total"])

        month_list = list(monthly_data.values())
        expenses_by_month = [(m["month"], m["expense"]) for m in month_list if m["expense"] > 0]
        highest_month = max(expenses_by_month, key=lambda x: x[1]) if expenses_by_month else ("None", 0.0)
        lowest_month = min(expenses_by_month, key=lambda x: x[1]) if expenses_by_month else ("None", 0.0)

        # Top spending categories
        cur.execute("""
            SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND c.type = 'expense' AND YEAR(t.txn_date) = %s
            GROUP BY c.id, c.name
            ORDER BY total DESC
            LIMIT 5
        """, (user_id, year))
        top_cats = []
        for r in cur.fetchall():
            tot = float(r["total"])
            pct = round(tot / total_expense * 100, 1) if total_expense > 0 else 0.0
            top_cats.append({"category": r["name"], "spent": tot, "percentage": pct})

        # Top merchant / place (from descriptions)
        cur.execute("""
            SELECT description, COUNT(*) as freq, SUM(amount) as total_spent
            FROM transactions
            WHERE user_id = %s AND YEAR(txn_date) = %s AND description IS NOT NULL AND TRIM(description) != ''
            GROUP BY description
            ORDER BY freq DESC, total_spent DESC
            LIMIT 1
        """, (user_id, year))
        top_merchant_row = cur.fetchone()
        top_merchant = {
            "name": top_merchant_row["description"],
            "visits": top_merchant_row["freq"],
            "total_spent": float(top_merchant_row["total_spent"]),
        } if top_merchant_row else None

        # Largest single transaction
        cur.execute("""
            SELECT t.amount, t.description, t.txn_date, c.name as category_name
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND YEAR(t.txn_date) = %s AND c.type = 'expense'
            ORDER BY t.amount DESC
            LIMIT 1
        """, (user_id, year))
        largest_txn_row = cur.fetchone()
        largest_txn = {
            "amount": float(largest_txn_row["amount"]),
            "description": largest_txn_row["description"] or "Expense",
            "date": str(largest_txn_row["txn_date"]),
            "category": largest_txn_row["category_name"],
        } if largest_txn_row else None

        # Savings Goals achieved or contributed in year
        cur.execute("""
            SELECT COUNT(*) AS total_goals,
                   SUM(CASE WHEN current_amount >= target_amount THEN 1 ELSE 0 END) AS completed_goals,
                   COALESCE(SUM(current_amount), 0) AS total_saved
            FROM savings_goals
            WHERE user_id = %s
        """, (user_id,))
        goals_row = cur.fetchone() or {"total_goals": 0, "completed_goals": 0, "total_saved": 0.0}

    return {
        "year": year,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_savings": net_savings,
        "savings_rate": savings_rate,
        "total_transactions": total_txns,
        "highest_spending_month": {"month": highest_month[0], "amount": highest_month[1]},
        "lowest_spending_month": {"month": lowest_month[0], "amount": lowest_month[1]},
        "top_categories": top_cats,
        "top_merchant": top_merchant,
        "largest_expense": largest_txn,
        "monthly_breakdown": month_list,
        "goals_summary": {
            "total": goals_row["total_goals"],
            "completed": int(goals_row["completed_goals"] or 0),
            "total_saved": float(goals_row["total_saved"] or 0.0),
        }
    }


# ---------- Account Data Backup & Restore ----------
def export_full_account_data(user_id: int, month: int | None = None, year: int | None = None) -> dict:
    from datetime import datetime
    with get_cursor() as cur:
        # Profile
        cur.execute("SELECT id, username, email, display_name, theme, currency, created_at FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if user and user.get("created_at"):
            user["created_at"] = str(user["created_at"])

        # Categories
        cur.execute("SELECT id, name, type FROM categories WHERE user_id = %s", (user_id,))
        categories = cur.fetchall()

        # Transactions
        txns = list_transactions(user_id, month=month, year=year)
        for t in txns:
            t["amount"] = float(t["amount"])
            t["txn_date"] = str(t["txn_date"])

        # Budgets
        b_sql = "SELECT category_id, month, year, amount, IFNULL(rollover, 1) as rollover FROM budgets WHERE user_id = %s"
        b_params = [user_id]
        if month is not None and year is not None:
            b_sql += " AND month = %s AND year = %s"
            b_params.extend([month, year])
        cur.execute(b_sql, tuple(b_params))
        budgets = cur.fetchall()
        for b in budgets:
            b["amount"] = float(b["amount"])

        # Goals
        cur.execute("SELECT name, target_amount, current_amount, deadline, color, monthly_allocation FROM savings_goals WHERE user_id = %s", (user_id,))
        goals = cur.fetchall()
        for g in goals:
            g["target_amount"] = float(g["target_amount"])
            g["current_amount"] = float(g["current_amount"])
            if g.get("deadline"):
                g["deadline"] = str(g["deadline"])
            if g.get("monthly_allocation") is not None:
                g["monthly_allocation"] = float(g["monthly_allocation"])

        # Split Groups
        cur.execute("""
            SELECT g.id, g.name, g.description, g.target_budget, g.created_at
            FROM split_groups g
            JOIN split_group_members gm ON gm.group_id = g.id
            WHERE gm.user_id = %s
        """, (user_id,))
        groups = cur.fetchall()
        for grp in groups:
            grp["target_budget"] = float(grp["target_budget"]) if grp.get("target_budget") else None
            grp["created_at"] = str(grp["created_at"]) if grp.get("created_at") else None

    return {
        "metadata": {
            "app": "FinanceOS",
            "version": "2.0",
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "filter_month": month,
            "filter_year": year,
        },
        "user": user,
        "categories": categories,
        "transactions": txns,
        "budgets": budgets,
        "goals": goals,
        "split_groups": groups,
    }


def restore_full_account_data(user_id: int, data: dict) -> dict:
    """Restore transactions, budgets, and goals from imported backup payload."""
    if not isinstance(data, dict):
        return {"error": "Invalid backup data format."}

    # Verify or match categories
    cat_id_map = {}
    with get_cursor(commit=True) as cur:
        cur.execute("SELECT id, name, type FROM categories WHERE user_id = %s", (user_id,))
        for c in cur.fetchall():
            cat_id_map[(c["name"].lower(), c["type"].lower())] = c["id"]

        # Ensure all incoming categories exist
        incoming_cats = data.get("categories", [])
        for c in incoming_cats:
            key = (c["name"].lower(), c["type"].lower())
            if key not in cat_id_map:
                cur.execute("INSERT IGNORE INTO categories (user_id, name, type) VALUES (%s, %s, %s)",
                            (user_id, c["name"], c["type"]))
                cur.execute("SELECT id FROM categories WHERE user_id = %s AND name = %s AND type = %s",
                            (user_id, c["name"], c["type"]))
                row = cur.fetchone()
                if row:
                    cat_id_map[key] = row["id"]

        # Restore transactions
        restored_txns = 0
        for t in data.get("transactions", []):
            cat_name = t.get("category_name", "")
            cat_type = t.get("category_type", "expense")
            target_cat_id = cat_id_map.get((cat_name.lower(), cat_type.lower()))
            if not target_cat_id:
                target_cat_id = next((cid for (k, ctype), cid in cat_id_map.items() if ctype == cat_type.lower()), None)

            if target_cat_id:
                cur.execute("""
                    INSERT INTO transactions (user_id, category_id, amount, description, txn_date, tags)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (user_id, target_cat_id, t.get("amount", 0), t.get("description"), t.get("txn_date"), t.get("tags", "")))
                restored_txns += 1

        # Restore goals
        restored_goals = 0
        for g in data.get("goals", []):
            cur.execute("""
                INSERT INTO savings_goals (user_id, name, target_amount, current_amount, deadline, color, monthly_allocation)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_id, g["name"], g["target_amount"], g.get("current_amount", 0), g.get("deadline"), g.get("color", "#6366f1"), g.get("monthly_allocation")))
            restored_goals += 1

    return {
        "success": True,
        "restored_transactions": restored_txns,
        "restored_goals": restored_goals,
    }


# ── Recurring Bills ─────────────────────────────────────────────────────────

def list_recurring_bills(user_id: int) -> list:
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, amount, day, category, cycle, last_paid_month, created_at
            FROM recurring_bills
            WHERE user_id = %s
            ORDER BY day ASC
        """, (user_id,))
        rows = cur.fetchall()
        for r in rows:
            r["amount"] = float(r["amount"])
            r["day"] = int(r["day"])
            r["created_at"] = str(r["created_at"]) if r.get("created_at") else None
        return rows


def add_recurring_bill(user_id: int, bill_id: str, name: str, amount: float, day: int, category: str = "Utilities", cycle: str = "Monthly") -> dict:
    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO recurring_bills (id, user_id, name, amount, day, category, cycle, last_paid_month)
            VALUES (%s, %s, %s, %s, %s, %s, %s, '')
            ON DUPLICATE KEY UPDATE name=%s, amount=%s, day=%s, category=%s, cycle=%s
        """, (bill_id, user_id, name, amount, day, category, cycle, name, amount, day, category, cycle))
    return {
        "id": bill_id,
        "name": name,
        "amount": amount,
        "day": day,
        "category": category,
        "cycle": cycle,
        "last_paid_month": ""
    }


def delete_recurring_bill(user_id: int, bill_id: str) -> bool:
    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM recurring_bills WHERE id = %s AND user_id = %s", (bill_id, user_id))
        return cur.rowcount > 0


def mark_recurring_bill_paid(user_id: int, bill_id: str, month: int, year: int) -> bool:
    tag = f"{year}-{month}"
    with get_cursor(commit=True) as cur:
        cur.execute("UPDATE recurring_bills SET last_paid_month = %s WHERE id = %s AND user_id = %s", (tag, bill_id, user_id))
        return cur.rowcount > 0


# ── AI Financial Engine ─────────────────────────────────────────────────────

def generate_ai_financial_response(user_id: int, query: str) -> str:
    """Generate intelligent financial insights using live data from user's transactions, budgets, goals, and split groups."""
    from datetime import date
    today = date.today()
    month, year = today.month, today.year

    # 1. Fetch live metrics
    monthly = monthly_report(user_id, month, year)
    income = float(monthly.get("total_income", 0))
    expense = float(monthly.get("total_expense", 0))
    savings = float(monthly.get("savings", 0))
    savings_rate = float(monthly.get("savings_rate", 0))

    cat_data = category_breakdown(user_id, month, year)
    budgets = get_all_budgets_status(user_id, month, year)
    goals = list_goals(user_id)
    split_debt = get_user_pending_split_debt(user_id)

    q = (query or "").lower().strip()

    # Detect user intent
    if any(k in q for k in ["spending audit", "audit", "summary", "overview"]):
        top_cats = sorted(cat_data, key=lambda c: float(c.get("total", 0)), reverse=True)[:3]
        top_str = ", ".join([f"**{c['name']}** ({float(c['total']):,.2f})" for c in top_cats]) if top_cats else "None recorded yet"
        return (
            f"### 🔍 Real-Time Spending Audit ({today.strftime('%B %Y')})\n\n"
            f"• **Total Inflows**: `{income:,.2f}`\n"
            f"• **Total Outflows**: `{expense:,.2f}`\n"
            f"• **Net Savings**: `{savings:,.2f}` ({savings_rate:.1f}% savings rate)\n\n"
            f"**Top Spending Drivers**:\n{top_str}\n\n"
            f"💡 *Tip*: Your savings rate is {'in the optimal zone (>20%)' if savings_rate >= 20 else 'below the recommended 20% benchmark'}. "
            f"{'Consider reviewing flexible lifestyle expenses.' if savings_rate < 20 else 'Great job maintaining positive cash flow!'}"
        )

    if any(k in q for k in ["spike", "abnormal", "unusual", "high"]):
        over_budgets = [b for b in budgets if b.get("percent_used", 0) > 90]
        if over_budgets:
            items = "\n".join([f"• 🚨 **{b['category_name']}**: Used {b['percent_used']:.1f}% ({float(b['spent']):,.2f} of {float(b['budget_amount']):,.2f})" for b in over_budgets])
            return f"### 🚨 Spending Spikes & Alert Thresholds\n\nThe following categories have crossed or approached 90% threshold:\n\n{items}\n\n⚠️ *Recommendation*: Freeze non-essential purchases in these categories for the rest of {today.strftime('%B')}."
        else:
            top = sorted(cat_data, key=lambda c: float(c.get("total", 0)), reverse=True)
            if top:
                return f"### 🛡️ Category Check\n\nNo extreme spikes detected! Your highest spending category this month is **{top[0]['name']}** at `{float(top[0]['total']):,.2f}` ({top[0].get('percentage', 0):.1f}% of expenses)."
            return "### 🛡️ Spending Spikes\n\nNo abnormal category spikes or threshold breaches detected in current records."

    if any(k in q for k in ["budget health", "budget", "over budget", "limit"]):
        if not budgets:
            return "### ⚠️ Budget Health\n\nYou haven't configured any category budgets yet! Head over to the **Budgets** tab to set monthly limits and activate overspending alerts."
        over = [b for b in budgets if b.get("status") == "over"]
        warning = [b for b in budgets if b.get("status") == "warning"]
        good = [b for b in budgets if b.get("status") == "good"]
        return (
            f"### 📊 Budget Health Report\n\n"
            f"• **Total Active Budgets**: {len(budgets)}\n"
            f"• 🚨 **Over Budget**: {len(over)} ({', '.join([b['category_name'] for b in over]) or 'None'})\n"
            f"• ⚠️ **Near Limit (80-100%)**: {len(warning)} ({', '.join([b['category_name'] for b in warning]) or 'None'})\n"
            f"• ✅ **Healthy (<80%)**: {len(good)}\n\n"
            f"💡 *Action*: Keep essential spending disciplined to avoid budget rollover deficits next month."
        )

    if any(k in q for k in ["split", "debt", "owe", "group"]):
        debt = float(split_debt.get("pending_group_debt", 0)) if isinstance(split_debt, dict) else float(split_debt or 0)
        if debt > 0:
            return f"### 👥 Split Groups & Pending Liabilities\n\n• **Your Total Pending Debt**: `{debt:,.2f}`\n\nYou have outstanding shares in your group expenses. Open the **Split** tab to view the automated **Min-Cashflow Settlement Plan** and mark settlements once paid."
        return "### 👥 Split Groups & Debts\n\n🎉 You currently have **zero pending split debts** across all active groups! All shared expenses are settled."

    if any(k in q for k in ["save", "saving", "advice", "invest", "kakeibo", "50/30/20"]):
        return (
            f"### 💡 Personalized Savings Advisory\n\n"
            f"Based on your current cashflow (Income: `{income:,.2f}` | Expense: `{expense:,.2f}`):\n\n"
            f"1. **Adopt the 50/30/20 Framework**:\n"
            f"   - Needs (Rent, Utilities, Food): Max `{income * 0.5:,.2f}`\n"
            f"   - Wants (Dining, Shopping): Max `{income * 0.3:,.2f}`\n"
            f"   - Savings & Debt Repayment: Min `{income * 0.2:,.2f}`\n\n"
            f"2. **Kakeibo Mindset Prompt**:\n"
            f"   - Ask before discretionary spending: *Can I live without it? Will I use it in 30 days?*\n\n"
            f"3. **Goal Progress**:\n"
            f"   - You have {len(goals)} active savings goal(s). Automating monthly allocations on payday dramatically improves milestone completion!"
        )

    if any(k in q for k in ["month-over-month", "comparison", "trend"]):
        prev_m = 12 if month == 1 else month - 1
        prev_y = year - 1 if month == 1 else year
        prev_rep = monthly_report(user_id, prev_m, prev_y)
        prev_exp = float(prev_rep.get("total_expense", 0))
        diff = expense - prev_exp
        direction = "increased" if diff > 0 else "decreased"
        return (
            f"### 📈 Month-over-Month Comparison\n\n"
            f"• **Current Month ({today.strftime('%b')})**: `{expense:,.2f}`\n"
            f"• **Previous Month**: `{prev_exp:,.2f}`\n"
            f"• **Variance**: Spending has {direction} by `{abs(diff):,.2f}` ({abs(diff / (prev_exp or 1) * 100):.1f}%)\n\n"
            f"Visit the **Dashboard Period Comparison** module to drill into granular item-level variances."
        )

    # General / conversational fallback using live statistics
    return (
        f"Hello! Here is your real-time financial snapshot for {today.strftime('%B %Y')}:\n\n"
        f"• **Inflow / Income**: `{income:,.2f}`\n"
        f"• **Outflow / Expense**: `{expense:,.2f}`\n"
        f"• **Net Savings**: `{savings:,.2f}` ({savings_rate:.1f}%)\n"
        f"• **Active Budgets**: {len(budgets)} | **Savings Goals**: {len(goals)}\n\n"
        f"You can ask me to perform a **Spending Audit**, check **Category Spikes**, analyze **Month-over-Month** trends, or give **Savings Advice**!"
    )


# ── Proprietary Financial Health Index ──────────────────────────────────────

def compute_financial_health_index(user_id: int, month: int, year: int) -> dict:
    """Calculate the proprietary 0-1000 Financial Health Index with pillars and boosters."""
    m_rep = monthly_report(user_id, month, year)
    income = float(m_rep.get("total_income", 0))
    expense = float(m_rep.get("total_expense", 0))
    savings_rate = float(m_rep.get("savings_rate", 0))

    budgets = get_all_budgets_status(user_id, month, year)
    goals = list_goals(user_id)
    split_debt = get_user_pending_split_debt(user_id)
    debt = float(split_debt.get("pending_group_debt", 0)) if isinstance(split_debt, dict) else float(split_debt or 0)

    # 1. Savings Pillar (0-300 pts)
    savings_score = min(300, max(0, int((savings_rate / 25.0) * 300)))

    # 2. Budget Discipline (0-250 pts)
    if budgets:
        over_count = sum(1 for b in budgets if b.get("status") == "over")
        warn_count = sum(1 for b in budgets if b.get("status") == "warning")
        penalty = (over_count * 60) + (warn_count * 20)
        budget_score = max(50, 250 - penalty)
    else:
        budget_score = 150

    # 3. Debt-to-Cashflow Ratio (0-250 pts)
    if income > 0:
        debt_ratio = debt / income
        if debt_ratio == 0:
            debt_score = 250
        elif debt_ratio < 0.1:
            debt_score = 210
        elif debt_ratio < 0.3:
            debt_score = 150
        else:
            debt_score = max(40, int(250 - (debt_ratio * 300)))
    else:
        debt_score = 200 if debt == 0 else 80

    # 4. Goal Momentum (0-200 pts)
    if goals:
        progresses = []
        for g in goals:
            target = float(g.get("target_amount", 1))
            current = float(g.get("current_amount", 0))
            progresses.append(min(1.0, current / target if target > 0 else 0))
        avg_prog = sum(progresses) / len(progresses)
        goal_score = int(avg_prog * 150) + 50
    else:
        goal_score = 100

    total_score = min(1000, max(100, savings_score + budget_score + debt_score + goal_score))

    if total_score >= 800:
        tier = "elite"
        tier_label = "Prime / Elite"
        tier_color = "#10b981"
    elif total_score >= 650:
        tier = "healthy"
        tier_label = "Healthy / Strong"
        tier_color = "#6366f1"
    elif total_score >= 500:
        tier = "stable"
        tier_label = "Moderate / Stable"
        tier_color = "#f59e0b"
    else:
        tier = "at_risk"
        tier_label = "Vulnerable / Attention Needed"
        tier_color = "#ef4444"

    return {
        "score": total_score,
        "tier": tier,
        "tier_label": tier_label,
        "tier_color": tier_color,
        "pillars": {
            "savings": {"score": savings_score, "max": 300, "rate": savings_rate},
            "budget_discipline": {"score": budget_score, "max": 250},
            "debt_management": {"score": debt_score, "max": 250, "debt": debt},
            "goal_momentum": {"score": goal_score, "max": 200, "goals_count": len(goals)}
        },
        "boosters": [
            "Maintain >20% savings rate for 3 consecutive months (+50 pts)",
            "Resolve outstanding split group liabilities (+30 pts)",
            "Keep category budgets strictly under 85% utilization (+40 pts)"
        ]
    }