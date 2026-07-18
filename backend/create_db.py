import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(__file__), "studentnet.db")

connection = sqlite3.connect(DATABASE)
cursor = connection.cursor()

# --------------------
# Users
# --------------------

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    student_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL
)
""")

users = [
    ("24244", "test", "Ethan", "Douglass"),
    ("admin", "admin", "Admin", "User"),
    ("12345", "password", "Sarah", "Wilson")
]

cursor.executemany("""
INSERT OR IGNORE INTO users
VALUES (?, ?, ?, ?)
""", users)

# --------------------
# Timetable
# --------------------

cursor.execute("""
CREATE TABLE IF NOT EXISTS timetable (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    student_id TEXT,

    day INTEGER,

    session TEXT,

    subject TEXT,

    room TEXT,

    start_time TEXT,

    end_time TEXT
)
""")

lessons = [

    ("24244",1,"1","Statistics","Papatuanuku Outer","09:00","10:30"),
    ("24244",1,"Break","","","10:30","10:50"),
    ("24244",1,"2","Business","Mokoroa Pod","10:50","12:20"),
    ("24244",1,"Lunch","","","12:20","13:10"),
    ("24244",1,"3","LA","Papatuanuku Outer","13:10","13:35"),
    ("24244",1,"4","Computer Science","Puriri 7","13:40","14:30"),
    ("24244",1,"5","English Projects","Pukeko Inner 2","14:35","15:25"),

]

cursor.executemany("""
INSERT INTO timetable
(student_id,day,session,subject,room,start_time,end_time)
VALUES (?,?,?,?,?,?,?)
""", lessons)

connection.commit()
connection.close()

print("Database Created")