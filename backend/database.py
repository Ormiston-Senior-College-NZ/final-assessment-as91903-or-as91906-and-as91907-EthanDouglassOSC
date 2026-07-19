import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "studentnet.db")


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


# ==========================================
# LOGIN
# ==========================================

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


# ==========================================
# SIGN UP
# ==========================================

def signup(student_id, email, password, first_name, last_name):

    connection = get_connection()
    cursor = connection.cursor()

    # Check if account already exists
    cursor.execute("""
        SELECT *
        FROM users
        WHERE student_id = ?
    """, (student_id,))

    if cursor.fetchone():
        connection.close()
        return False

    cursor.execute("""
        INSERT INTO users
        (
            student_id,
            email,
            password,
            first_name,
            last_name,
            year_level,
            learning_area
        )
        VALUES
        (?, ?, ?, ?, ?, NULL, NULL)
    """, (
        student_id,
        email,
        password,
        first_name,
        last_name
    ))

    connection.commit()
    connection.close()

    return True


# ==========================================
# GET USER
# ==========================================

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


# ==========================================
# TIMETABLE
# ==========================================

def get_timetable(student_id, day):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM timetable
        WHERE student_id = ?
        AND day = ?
        ORDER BY start_time
    """, (student_id, day))

    lessons = cursor.fetchall()

    connection.close()

    return lessons