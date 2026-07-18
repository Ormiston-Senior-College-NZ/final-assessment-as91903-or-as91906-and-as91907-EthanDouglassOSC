import sqlite3

connection = sqlite3.connect("studentnet.db")
cursor = connection.cursor()

# Create users table
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    student_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL
)
""")

# Test users
users = [
    ("24244", "test", "Ethan", "Douglass"),
    ("admin", "admin", "Admin", "User"),
    ("12345", "password", "Sarah", "Wilson")
]

cursor.executemany("""
INSERT OR IGNORE INTO users
(student_id, password, first_name, last_name)
VALUES (?, ?, ?, ?)
""", users)

connection.commit()
connection.close()

print("Database created successfully.")