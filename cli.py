# cli.py
from datetime import datetime
from auth import register_user, login_user
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
)
from backup import backup_user_data, restore_user_data

def prompt_int(message: str) -> int:
    while True:
        try:
            return int(input(message).strip())
        except ValueError:
            print("Please enter a valid integer.")

def prompt_float(message: str) -> float:
    while True:
        try:
            return float(input(message).strip())
        except ValueError:
            print("Please enter a valid number.")

def main_menu():
    user = None
    while True:
        if not user:
            print("\n=== Personal Finance Manager ===")
            print("1. Register")
            print("2. Login")
            print("3. Exit")
            choice = input("Choose an option: ").strip()

            if choice == "1":
                username = input("Username: ").strip()
                password = input("Password: ").strip()
                if register_user(username, password):
                    print("User registered successfully.")
                else:
                    print("Username already exists.")
            elif choice == "2":
                username = input("Username: ").strip()
                password = input("Password: ").strip()
                user = login_user(username, password)
                if not user:
                    print("Invalid credentials.")
                else:
                    ensure_default_categories(user["id"])
                    print(f"Welcome, {user['username']}!")
            elif choice == "3":
                print("Goodbye!")
                break
            else:
                print("Invalid choice.")
        else:
            # Logged-in menu
            print(f"\n=== Dashboard ({user['username']}) ===")
            print("1. Manage transactions")
            print("2. View reports")
            print("3. Manage budgets")
            print("4. Backup/Restore data")
            print("5. Logout")

            choice = input("Choose an option: ").strip()

            if choice == "1":
                transactions_menu(user["id"])
            elif choice == "2":
                reports_menu(user["id"])
            elif choice == "3":
                budgets_menu(user["id"])
            elif choice == "4":
                backup_menu(user["id"])
            elif choice == "5":
                user = None
            else:
                print("Invalid choice.")

def choose_category(user_id: int, ctype: str):
    cats = list_categories(user_id, ctype)
    if not cats:
        print("No categories available.")
        return None
    for c in cats:
        print(f"{c['id']}. {c['name']}")
    cid = prompt_int("Enter category ID: ")
    if not any(c["id"] == cid for c in cats):
        print("Invalid category.")
        return None
    return cid

def parse_date_input() -> datetime.date:
    while True:
        s = input("Enter date (YYYY-MM-DD): ").strip()
        try:
            return datetime.strptime(s, "%Y-%m-%d").date()
        except ValueError:
            print("Invalid date format.")

def transactions_menu(user_id: int):
    while True:
        print("\n--- Transactions ---")
        print("1. Add income")
        print("2. Add expense")
        print("3. Update transaction")
        print("4. Delete transaction")
        print("5. List transactions")
        print("6. Back")
        choice = input("Choose: ").strip()

        if choice == "1":
            cid = choose_category(user_id, "income")
            if cid is None:
                continue
            amount = prompt_float("Amount: ")
            date_ = parse_date_input()
            desc = input("Description (optional): ").strip() or None
            add_transaction(user_id, cid, amount, date_, desc)
            print("Income added.")
        elif choice == "2":
            cid = choose_category(user_id, "expense")
            if cid is None:
                continue
            amount = prompt_float("Amount: ")
            date_ = parse_date_input()
            desc = input("Description (optional): ").strip() or None
            add_transaction(user_id, cid, amount, date_, desc)
            print("Expense added.")
        elif choice == "3":
            txns = list_transactions(user_id)
            if not txns:
                print("No transactions.")
                continue
            for t in txns:
                print(f"{t['id']}: {t['txn_date']} {t['category_name']} {t['amount']} ({t['description']})")
            tid = prompt_int("Transaction ID to update: ")
            # For simplicity assume all are expense when updating; in practice you might show type and choose categories accordingly.
            cid = choose_category(user_id, "expense")
            if cid is None:
                continue
            amount = prompt_float("New amount: ")
            date_ = parse_date_input()
            desc = input("New description (optional): ").strip() or None
            if update_transaction(user_id, tid, cid, amount, date_, desc):
                print("Updated.")
            else:
                print("Transaction not found.")
        elif choice == "4":
            txns = list_transactions(user_id)
            if not txns:
                print("No transactions.")
                continue
            for t in txns:
                print(f"{t['id']}: {t['txn_date']} {t['category_name']} {t['amount']} ({t['description']})")
            tid = prompt_int("Transaction ID to delete: ")
            if delete_transaction(user_id, tid):
                print("Deleted.")
            else:
                print("Not found.")
        elif choice == "5":
            txns = list_transactions(user_id)
            if not txns:
                print("No transactions.")
            else:
                for t in txns:
                    print(f"{t['id']}: {t['txn_date']} [{t['category_type']}] {t['category_name']} {t['amount']} ({t['description']})")
        elif choice == "6":
            break
        else:
            print("Invalid choice.")

def reports_menu(user_id: int):
    print("\n--- Reports ---")
    print("1. Monthly report")
    print("2. Yearly report")
    choice = input("Choose: ").strip()
    if choice == "1":
        month = prompt_int("Month (1-12): ")
        year = prompt_int("Year (e.g., 2026): ")
        r = monthly_report(user_id, month, year)
        print(f"Total income: {r['income']:.2f}")
        print(f"Total expenses: {r['expense']:.2f}")
        print(f"Savings: {r['savings']:.2f}")
    elif choice == "2":
        year = prompt_int("Year: ")
        r = yearly_report(user_id, year)
        print(f"Total income: {r['income']:.2f}")
        print(f"Total expenses: {r['expense']:.2f}")
        print(f"Savings: {r['savings']:.2f}")
    else:
        print("Invalid choice.")

def budgets_menu(user_id: int):
    print("\n--- Budgets ---")
    print("1. Set budget for category")
    print("2. Check budget status for category")
    choice = input("Choose: ").strip()
    if choice == "1":
        cid = choose_category(user_id, "expense")
        if cid is None:
            return
        month = prompt_int("Month (1-12): ")
        year = prompt_int("Year: ")
        amount = prompt_float("Budget amount: ")
        set_budget(user_id, cid, month, year, amount)
        print("Budget set.")
    elif choice == "2":
        cid = choose_category(user_id, "expense")
        if cid is None:
            return
        month = prompt_int("Month (1-12): ")
        year = prompt_int("Year: ")
        status = get_budget_status(user_id, cid, month, year)
        print(f"Budget: {status['budget']:.2f}")
        print(f"Spent: {status['spent']:.2f}")
        print(f"Remaining: {status['remaining']:.2f}")
        if status["exceeded"]:
            print("WARNING: You exceeded your budget for this category!")
    else:
        print("Invalid choice.")

def backup_menu(user_id: int):
    print("\n--- Backup / Restore ---")
    print("1. Backup to file")
    print("2. Restore from file")
    choice = input("Choose: ").strip()
    if choice == "1":
        path = input("Backup file path: ").strip()
        backup_user_data(user_id, path)
        print("Backup completed.")
    elif choice == "2":
        path = input("Backup file path: ").strip()
        restore_user_data(user_id, path)
        print("Restore completed.")
    else:
        print("Invalid choice.")

if __name__ == "__main__":
    main_menu()