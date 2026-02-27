## Personal Finance Management CLI (Python + MySQL)

A command-line application to manage personal finances.  
It lets you register/login, track income and expenses, generate reports, set budgets, and back up/restore data using a MySQL database.

---

## Features

- **User accounts**
  - Register with a unique username and password.
  - Login authentication for each user.
- **Income & expense tracking**
  - Add income and expense transactions.
  - Use simple text categories (e.g. `Salary`, `Food`, `Rent`).
  - Update and delete existing transactions.
  - List all your transactions.
- **Financial reports**
  - **Monthly report**: total income, expenses, and savings for a given month/year.
  - **Yearly report**: total income, expenses, and savings for a given year.
- **Budgeting**
  - Set monthly budgets per category (e.g. Food, Rent).
  - Check how much you have spent vs. your budget.
  - Get a warning when you exceed a budget.
- **Data persistence**
  - All data stored in **MySQL** tables.
  - Backup and restore user data to/from a JSON file.

---

## Technologies Used

- **Language**: Python 3.x
- **Database**: MySQL
- **Python packages**:
  - `mysql-connector-python` – MySQL connection
  - `bcrypt` (if you enabled hashed passwords)
  - `unittest` – for tests

---

## Project Structure

This project uses a modular, easy-to-understand layout:

- `config.py` – database configuration (host, user, password, database).
- `db.py` – helper functions for connecting to MySQL.
- `auth.py` – user registration and login logic.
- `services.py` – core finance logic:
  - manage transactions (add/update/delete/list)
  - generate monthly and yearly reports
  - manage budgets and budget status
- `backup.py` – backup and restore functions (JSON-based).
- `cli.py` – main command-line interface and menus.
- `models.py` – reserved for higher-level DB helpers or models (optional).
- `tests/`
  - `test_auth.py` – unit tests for authentication.
  - `test_services.py` – unit tests for service functions.

---

## Prerequisites

- Python **3.8+**
- MySQL server installed and running
- A MySQL user and database for this app

Example MySQL setup (run in a MySQL client as a user with privileges):

```sql
CREATE DATABASE finance_app;
CREATE USER 'fin_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON finance_app.* TO 'fin_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## Installation & Setup

1. **Go to the project folder**

   ```bash
   cd "Finance mgmt app"
   ```

2. **Create and activate a virtual environment** (recommended)

   ```bash
   python -m venv venv
   venv\Scripts\activate  # on Windows
   # source venv/bin/activate  # on Linux/Mac
   ```

3. **Install dependencies**

   ```bash
   pip install mysql-connector-python bcrypt
   ```

4. **Configure database settings**

   - Open `config.py`.
   - Set the correct:
     - `host`
     - `user`
     - `password`
     - `database`
   - These values must match your MySQL configuration from the step above.

---

## Running the Application

1. Make sure **MySQL is running** and `config.py` is configured correctly.
2. From the project root, run:

   ```bash
   python cli.py
   ```

3. Use the main menu in the terminal:
   - **Register** a new user (first time).
   - **Login** with your username and password.
   - After login, use the dashboard to manage transactions, reports, budgets, and backups.

---

## Basic Usage (Main Menus)

- **Authentication**
  - From the start screen:
    - Choose **1. Register** to create a new account (username + password).
    - Choose **2. Login** to sign in to an existing account.

- **Transactions**
  - From the dashboard, choose **1. Manage transactions**:
    - **Add income / Add expense**: pick a category (e.g. `Salary`, `Food`, `Rent`), enter amount, date \(`YYYY-MM-DD`\), and an optional description.
    - **Update transaction**: select a transaction ID and change its category, amount, date, or description.
    - **Delete transaction**: remove a transaction by ID.
    - **List transactions**: view your recent income and expense records.

- **Reports**
  - From the dashboard, choose **2. View reports**:
    - **Monthly report**: enter month \(`1–12`\) and year to see total income, expenses, and savings.
    - **Yearly report**: enter a year to see total income, expenses, and savings for that year.

- **Budgets**
  - From the dashboard, choose **3. Manage budgets**:
    - **Set budget for category**: choose an expense category, then enter month, year, and budget amount.
    - **Check budget status**: see budget amount, total spent, remaining amount, and a warning if the budget is exceeded.

- **Backup / Restore**
  - From the dashboard, choose **4. Backup/Restore data**:
    - **Backup to file**: choose a file path (e.g. `backup_2026_02.json`) to export your data.
    - **Restore from file**: choose a JSON backup file to import your data.

- **Logout**
  - Choose **5. Logout** on the dashboard to return to the login/register screen.

---

## Running Tests

From the project root, run:

```bash
python -m unittest discover -s tests
```

This runs all tests in the `tests` folder (such as `test_auth.py` and `test_services.py`).

---

## Notes, Limitations & Future Improvements

- **Educational purpose**: This project is designed as a learning/demo app, not a production-ready banking system.
- **Security**:
  - Password handling can be configured to use `bcrypt`, but you should always hash passwords and never store them in plain text in real deployments.
- **Validation & errors**:
  - Input validation and error handling are basic and can be extended (e.g., stricter checks on dates, amounts, and categories).
- **Possible future improvements**:
  - Stronger validation and clearer error messages.
  - More detailed reports (per-category summaries, CSV export, charts).
  - Consistent use of secure password hashing everywhere.
  - Additional test coverage for all features.