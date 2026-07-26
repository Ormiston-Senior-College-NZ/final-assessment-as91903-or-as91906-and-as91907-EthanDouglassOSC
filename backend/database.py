import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "studentnet.db")


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
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
    cursor = connection.cursor()

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
            learning_area,
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

def save_setup(student_id, year_level, learning_area, subjects):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        UPDATE users
        SET
            year_level = ?,
            learning_area = ?,
            setup_complete = 1
        WHERE student_id = ?
    """, (
        year_level,
        learning_area,
        student_id
    ))

    cursor.execute("""
        DELETE FROM student_subjects
        WHERE student_id = ?
    """, (student_id,))

    for line, course_id in enumerate(subjects, start=1):

        cursor.execute("""
            INSERT INTO student_subjects
            (
                student_id,
                line,
                course_id
            )
            VALUES
            (?, ?, ?)
        """, (
            student_id,
            line,
            course_id
        ))

    connection.commit()
    connection.close()


# ==========================================================
# GET STUDENT SUBJECTS
# ==========================================================

def get_student_subjects(student_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            student_subjects.line,
            courses.code,
            courses.name,
            courses.level
        FROM student_subjects
        JOIN courses
        ON student_subjects.course_id = courses.id
        WHERE student_subjects.student_id = ?
        ORDER BY line
    """, (student_id,))

    subjects = cursor.fetchall()

    connection.close()

    return subjects