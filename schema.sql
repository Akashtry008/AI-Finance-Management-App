-- ============================================================
--  Finance Management App — MySQL Schema for XAMPP
--  Run this once in phpMyAdmin (http://localhost/phpmyadmin)
--  or paste into the XAMPP MySQL shell.
-- ============================================================

-- 1. Create database
CREATE DATABASE IF NOT EXISTS finance_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE finance_app;

-- ============================================================
--  2. Tables
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            INT            AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)    NOT NULL UNIQUE,
    email         VARCHAR(120)   NOT NULL UNIQUE,
    display_name  VARCHAR(100),
    theme         VARCHAR(20)    DEFAULT 'dark',
    currency      VARCHAR(10)    DEFAULT 'INR',
    password_hash VARCHAR(255)   NOT NULL,
    is_admin      TINYINT(1)     NOT NULL DEFAULT 0,
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Categories (each user has their own set)
CREATE TABLE IF NOT EXISTS categories (
    id      INT          AUTO_INCREMENT PRIMARY KEY,
    user_id INT          NOT NULL,
    name    VARCHAR(100) NOT NULL,
    type    ENUM('income','expense') NOT NULL,
    UNIQUE KEY uq_user_category (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id          INT            AUTO_INCREMENT PRIMARY KEY,
    user_id     INT            NOT NULL,
    category_id INT            NOT NULL,
    amount      DECIMAL(12,2)  NOT NULL,
    description VARCHAR(255)   DEFAULT NULL,
    txn_date    DATE           NOT NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ── Authentication ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_resets (
    token VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trigger to cascade delete user data
DELIMITER //
CREATE TRIGGER IF NOT EXISTS before_user_delete
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    DELETE FROM transactions WHERE user_id = OLD.id;
    DELETE FROM categories  WHERE user_id = OLD.id;
    DELETE FROM budgets     WHERE user_id = OLD.id;
END//
DELIMITER ;

-- ── Split Expense Tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS split_groups (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    owner_id    INT NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS split_group_members (
    group_id    INT NOT NULL,
    user_id     INT NOT NULL,
    joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS split_expenses (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    group_id     INT NOT NULL,
    paid_by      INT NOT NULL,
    description  VARCHAR(255) NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by)  REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS split_participants (
    expense_id  INT NOT NULL,
    user_id     INT NOT NULL,
    share       DECIMAL(12,2) NOT NULL,
    settled     TINYINT(1) DEFAULT 0,
    PRIMARY KEY (expense_id, user_id),
    FOREIGN KEY (expense_id) REFERENCES split_expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
);

-- Budgets (one per user/category/month/year)
CREATE TABLE IF NOT EXISTS budgets (
    id          INT            AUTO_INCREMENT PRIMARY KEY,
    user_id     INT            NOT NULL,
    category_id INT            NOT NULL,
    month       TINYINT        NOT NULL,
    year        SMALLINT       NOT NULL,
    amount      DECIMAL(12,2)  NOT NULL,
    UNIQUE KEY uq_budget (user_id, category_id, month, year),
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Savings Goals
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

-- ============================================================
--  Done! Start python main.py — admin is seeded automatically.
-- ============================================================
