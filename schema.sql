-- ============================================================
--  Finance Management App — MySQL Schema
--  For Railway: Run this in the Railway MySQL Data tab or Console
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            INT            AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)    NOT NULL UNIQUE,
    email         VARCHAR(120)   UNIQUE,
    display_name  VARCHAR(100),
    theme         VARCHAR(20)    DEFAULT 'dark',
    currency      VARCHAR(10)    DEFAULT 'INR',
    password_hash VARCHAR(255)   NOT NULL,
    is_admin      TINYINT(1)     NOT NULL DEFAULT 0,
    security_lock_enabled TINYINT(1) DEFAULT 0,
    security_lock_mode    VARCHAR(20) DEFAULT 'pin',
    security_lock_pin     VARCHAR(50) DEFAULT '1234',
    security_lock_password VARCHAR(255) DEFAULT 'admin123',
    security_lock_pattern  VARCHAR(100) DEFAULT '0-1-2-5-8',
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
    tags        VARCHAR(255)   DEFAULT '',
    txn_date    DATE           NOT NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Budgets
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

-- Password Resets
CREATE TABLE IF NOT EXISTS password_resets (
    token      VARCHAR(64)  PRIMARY KEY,
    user_id    INT          NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Savings Goals
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

-- Recurring Bills (Bills & Subscriptions Radar)
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

-- Split Groups
CREATE TABLE IF NOT EXISTS split_groups (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    owner_id      INT NOT NULL,
    name          VARCHAR(120) NOT NULL,
    description   TEXT,
    target_budget DECIMAL(12,2) DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Split Group Members
CREATE TABLE IF NOT EXISTS split_group_members (
    group_id  INT NOT NULL,
    user_id   INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
);

-- Split Expenses
CREATE TABLE IF NOT EXISTS split_expenses (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    group_id          INT NOT NULL,
    paid_by           INT NOT NULL,
    description       VARCHAR(255) NOT NULL,
    amount            DECIMAL(12,2) NOT NULL,
    expense_date      DATE NOT NULL,
    original_currency VARCHAR(10) DEFAULT NULL,
    original_amount   DECIMAL(12,2) DEFAULT NULL,
    exchange_rate     DECIMAL(12,4) DEFAULT 1.0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES split_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by)  REFERENCES users(id)  ON DELETE CASCADE
);

-- Split Participants
CREATE TABLE IF NOT EXISTS split_participants (
    expense_id INT NOT NULL,
    user_id    INT NOT NULL,
    share      DECIMAL(12,2) NOT NULL,
    settled    TINYINT(1) DEFAULT 0,
    PRIMARY KEY (expense_id, user_id),
    FOREIGN KEY (expense_id) REFERENCES split_expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- Split Settlements
CREATE TABLE IF NOT EXISTS split_settlements (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    group_id    INT NOT NULL,
    payer_id    INT NOT NULL,
    receiver_id INT NOT NULL,
    amount      DECIMAL(12,2) NOT NULL,
    currency    VARCHAR(10) DEFAULT 'INR',
    settled_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note        VARCHAR(255) DEFAULT '',
    FOREIGN KEY (group_id)    REFERENCES split_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (payer_id)    REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id)        ON DELETE CASCADE
);

-- ============================================================
--  Done! The backend will seed the admin account automatically.
-- ============================================================
