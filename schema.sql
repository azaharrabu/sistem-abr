CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    subscription_type TEXT, -- Boleh jadi '6-bulan' atau '12-bulan'
    subscription_end_date DATE
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE subscription_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_months INTEGER NOT NULL,
    transaction_reference TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
