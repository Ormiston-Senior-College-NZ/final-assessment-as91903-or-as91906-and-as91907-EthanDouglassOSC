import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(__file__), "studentnet.db")

# Delete old database
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
    learning_area TEXT,

    setup_complete INTEGER DEFAULT 0

)
""")

# ==========================================================
# COURSES
# ==========================================================

cursor.execute("""
CREATE TABLE courses (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    code TEXT UNIQUE,
    name TEXT,
    level INTEGER

)
""")

# ==========================================================
# STUDENT SUBJECTS
# ==========================================================

cursor.execute("""
CREATE TABLE student_subjects (

    student_id TEXT,
    line INTEGER,
    course_id INTEGER,

    PRIMARY KEY(student_id, line),

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
    session INTEGER,

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
# SAMPLE USER
# ==========================================================

cursor.execute("""
INSERT INTO users
VALUES
(
'24244',
'st24244@ormiston.school.nz',
'test',
'Ethan',
'Douglass',
13,
'Papatuanuku',
1
)
""")

# ==========================================================
# COURSES
# ==========================================================

courses = [

("ENG1","English",1),
("MAT1","Mathematics",1),
("SCI1","Science",1),

("ENG2","English",2),
("STA2","Statistics",2),
("BUS2","Business",2),
("ACC2","Accounting",2),

("ENG3","English Projects",3),
("STA3","Statistics",3),
("BUS3","Business",3),
("CSC3","Computer Science",3),
("ACC3","Accounting",3),
("CAL3","Calculus",3),
("BIO3","Biology",3),
("CHE3","Chemistry",3),
("PHY3","Physics",3),
("DVC3","Design Visual Communication",3)

]

cursor.executemany("""
INSERT INTO courses
(code,name,level)
VALUES (?,?,?)
""", courses)

# ==========================================================
# TIMETABLE SLOTS
# ==========================================================

slots = [

(1,1,"09:00","10:30"),
(1,2,"10:50","12:20"),
(1,6,"13:10","13:35"),
(1,3,"13:40","14:30"),
(1,4,"14:35","15:25"),

(2,6,"09:00","10:30"),
(2,5,"10:50","12:20"),
(2,4,"13:10","14:00"),
(2,1,"14:05","14:55"),

(3,3,"09:00","10:30"),
(3,4,"10:50","12:20"),
(3,6,"13:10","13:35"),
(3,2,"13:40","14:30"),
(3,5,"14:35","15:25"),

(4,4,"09:00","09:50"),
(4,5,"09:55","10:45"),
(4,3,"11:05","11:55"),
(4,6,"12:00","12:50"),
(4,1,"13:40","14:30"),
(4,2,"14:35","15:25"),

(4,5,"09:00","09:50"),
(4,2,"09:55","10:45"),
(4,1,"11:05","11:55"),
(4,3,"12:00","12:50"),
(5,6,"13:40","14:55")

]

cursor.executemany("""
INSERT INTO timetable_slots
(day,session,start_time,end_time)
VALUES (?,?,?,?)
""", slots)

connection.commit()
connection.close()

print("StudentNET database created successfully!")