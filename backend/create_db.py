import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(__file__), "studentnet.db")

# Delete the old database
if os.path.exists(DATABASE):
    os.remove(DATABASE)

connection = sqlite3.connect(DATABASE)
cursor = connection.cursor()

# ==========================================================
# USERS
# ==========================================================

cursor.execute("""
CREATE TABLE users (

    student_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    year_level INTEGER,
    learning_area TEXT

)
""")

# ==========================================================
# COURSES
# ==========================================================

cursor.execute("""
CREATE TABLE courses (

    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT,
    name TEXT,
    level INTEGER,
    area TEXT

)
""")

# ==========================================================
# STUDENT COURSES
# ==========================================================

cursor.execute("""
CREATE TABLE student_courses (

    student_id TEXT,
    course_id INTEGER,

    PRIMARY KEY(student_id, course_id),

    FOREIGN KEY(student_id) REFERENCES users(student_id),
    FOREIGN KEY(course_id) REFERENCES courses(id)

)
""")

# ==========================================================
# TIMETABLE SLOTS
# ==========================================================

cursor.execute("""
CREATE TABLE timetable_slots (

    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER,
    session TEXT,
    start_time TEXT,
    end_time TEXT

)
""")

# ==========================================================
# COURSE SCHEDULE
# ==========================================================

cursor.execute("""
CREATE TABLE course_schedule (

    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    slot_id INTEGER,
    room TEXT,

    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(slot_id) REFERENCES timetable_slots(id)

)
""")

# ==========================================================
# SAMPLE USERS
# ==========================================================

users = [

    (
        "24244",
        "st24244@ormiston.school.nz",
        "test",
        "Ethan",
        "Douglass",
        13,
        "Papatuanuku"
    ),

    (
        "admin",
        "admin@ormiston.school.nz",
        "admin",
        "Admin",
        "User",
        0,
        "Staff"
    )

]

cursor.executemany("""
INSERT INTO users
VALUES (?,?,?,?,?,?,?)
""", users)

# ==========================================================
# SAMPLE COURSES
# ==========================================================

courses = [

    ("STA3", "Statistics", 3, "Mathematics"),
    ("BUS3", "Business", 3, "Commerce"),
    ("ENG3", "English Projects", 3, "English"),
    ("CSC3", "Computer Science", 3, "Technology"),
    ("ACC3", "Accounting", 3, "Commerce")

]

cursor.executemany("""
INSERT INTO courses
(code, name, level, area)
VALUES (?,?,?,?)
""", courses)

# ==========================================================
# TIMETABLE SLOTS
# ==========================================================

slots = [

    (1, "1", "09:00", "10:30"),
    (1, "2", "10:50", "12:20"),
    (1, "3", "13:10", "13:35"),
    (1, "4", "13:40", "14:30"),
    (1, "5", "14:35", "15:25")

]

cursor.executemany("""
INSERT INTO timetable_slots
(day, session, start_time, end_time)
VALUES (?,?,?,?)
""", slots)

connection.commit()
connection.close()

print("StudentNET database created successfully!")