import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "studentnet.db")


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


# ==========================================================
# LOGIN
# ==========================================================

def login(student_id, password):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM users
        WHERE student_id = ?
        AND password = ?
    """, (student_id, password))

    user = cursor.fetchone()

    connection.close()

    return user


# ==========================================================
# SIGN UP
# ==========================================================

def signup(student_id, email, password, first_name, last_name):

    connection = get_connection()
    try:
        connection.execute("""
            INSERT INTO users
            (
                student_id,
                email,
                password,
                first_name,
                last_name,
                year_level,
                kainga,
                setup_complete
            )
            VALUES
            (?, ?, ?, ?, ?, NULL, NULL, 0)
        """, (
            student_id,
            email,
            password,
            first_name,
            last_name
        ))
        connection.commit()
    except sqlite3.IntegrityError:
        connection.rollback()
        return False
    finally:
        connection.close()

    return True


# ==========================================================
# GET USER
# ==========================================================

def get_user(student_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM users
        WHERE student_id = ?
    """, (student_id,))

    user = cursor.fetchone()

    connection.close()

    return user


# ==========================================================
# GET COURSES
# ==========================================================

def get_courses():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM courses
        ORDER BY level, name
    """)

    courses = cursor.fetchall()

    connection.close()

    return courses


# ==========================================================
# SAVE SETUP
# ==========================================================

def save_setup(student_id, year_level, kainga, subjects):

    if len(subjects) != 5 or any(not course_id for course_id in subjects):
        raise ValueError("Exactly five subjects must be selected")

    connection = get_connection()
    try:
        cursor = connection.execute("""
            UPDATE users
            SET
                year_level = ?,
                kainga = ?,
                setup_complete = 1
            WHERE student_id = ?
        """, (
            year_level,
            kainga,
            student_id
        ))

        if cursor.rowcount != 1:
            raise ValueError("Student does not exist")

        connection.execute("""
            DELETE FROM student_lines
            WHERE student_id = ?
        """, (student_id,))

        for line, course_id in enumerate(subjects, start=1):
            connection.execute("""
                INSERT INTO student_lines
                (student_id, line, course_id)
                VALUES (?, ?, ?)
            """, (
            student_id,
            line,
            course_id
            ))

        connection.commit()
    except (sqlite3.Error, ValueError):
        connection.rollback()
        raise
    finally:
        connection.close()


# ==========================================================
# GET STUDENT SUBJECTS
# ==========================================================

def get_student_subjects(student_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            student_lines.line,
            courses.code,
            courses.name,
            courses.level
        FROM student_lines
        JOIN courses
        ON student_lines.course_id = courses.id
        WHERE student_lines.student_id = ?
        ORDER BY line
    """, (student_id,))

    subjects = cursor.fetchall()

    connection.close()

    return subjects

def get_timetable(student_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            COALESCE(student_lines.line, timetable_slots.session) AS line,
            CASE
                WHEN timetable_slots.session = 6 THEN 'LA'
                ELSE courses.code
            END AS code,
            CASE
                WHEN timetable_slots.session = 6 THEN 'LA / iTime'
                ELSE courses.name
            END AS name,
            teachers.name AS teacher,
            rooms.code AS room,
            rooms.name AS room_name,
            timetable_slots.day,
            timetable_slots.session,
            timetable_slots.start_time,
            timetable_slots.end_time

        FROM timetable_slots

        LEFT JOIN student_lines
            ON timetable_slots.session = student_lines.line
            AND student_lines.student_id = ?

        LEFT JOIN courses
            ON student_lines.course_id = courses.id

        LEFT JOIN course_schedule
            ON student_lines.course_id = course_schedule.course_id
            AND timetable_slots.day = course_schedule.day
            AND timetable_slots.session = course_schedule.session

        LEFT JOIN teachers
            ON course_schedule.teacher_id = teachers.id

        LEFT JOIN rooms
            ON course_schedule.room_id = rooms.id

        WHERE timetable_slots.session = 6
            OR student_lines.course_id IS NOT NULL

        ORDER BY timetable_slots.day, timetable_slots.start_time
    """, (student_id,))

    timetable = cursor.fetchall()

    connection.close()

    return timetable
