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


def update_user(
    student_id,
    first_name,
    last_name,
    year_level,
    kainga,
    subjects,
    current_password=None,
    new_password=None
):
    connection = get_connection()

    try:
        user = connection.execute("""
            SELECT password
            FROM users
            WHERE student_id = ?
        """, (student_id,)).fetchone()

        if not user:
            return False, "Student not found."

        if new_password and user["password"] != current_password:
            return False, "Current password is incorrect."

        selected_courses = connection.execute("""
            SELECT id, level
            FROM courses
            WHERE id IN (?, ?, ?, ?, ?)
        """, tuple(subjects)).fetchall()

        allowed_levels = {
            11: {1},
            12: {2, 3},
            13: {3}
        }

        if len(selected_courses) != 5:
            return False, "One or more selected subjects do not exist."

        if any(course["level"] not in allowed_levels[year_level] for course in selected_courses):
            return False, "One or more subjects do not match the selected year level."

        if new_password:
            connection.execute("""
                UPDATE users
                SET first_name = ?, last_name = ?, year_level = ?, kainga = ?,
                    password = ?
                WHERE student_id = ?
            """, (
                first_name,
                last_name,
                year_level,
                kainga,
                new_password,
                student_id
            ))
        else:
            connection.execute("""
                UPDATE users
                SET first_name = ?, last_name = ?, year_level = ?, kainga = ?
                WHERE student_id = ?
            """, (
                first_name,
                last_name,
                year_level,
                kainga,
                student_id
            ))

        connection.execute("""
            DELETE FROM student_lines
            WHERE student_id = ?
        """, (student_id,))

        for line, course_id in enumerate(subjects, start=1):
            connection.execute("""
                INSERT INTO student_lines (student_id, line, course_id)
                VALUES (?, ?, ?)
            """, (student_id, line, course_id))

        connection.commit()
        return True, "Account settings saved."
    except sqlite3.Error:
        connection.rollback()
        raise
    finally:
        connection.close()


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


def create_course(code, name, level, category):
    connection = get_connection()
    try:
        cursor = connection.execute("""
            INSERT INTO courses (code, name, level, category)
            VALUES (?, ?, ?, ?)
        """, (code, name, level, category))
        connection.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        connection.rollback()
        return None
    finally:
        connection.close()


def update_course(course_id, code, name, level, category):
    connection = get_connection()
    try:
        cursor = connection.execute("""
            UPDATE courses
            SET code = ?, name = ?, level = ?, category = ?
            WHERE id = ?
        """, (code, name, level, category, course_id))
        connection.commit()
        return cursor.rowcount == 1
    except sqlite3.IntegrityError:
        connection.rollback()
        return False
    finally:
        connection.close()


def delete_course(course_id):
    connection = get_connection()
    try:
        cursor = connection.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        connection.commit()
        return cursor.rowcount == 1, None
    except sqlite3.IntegrityError:
        connection.rollback()
        return False, "This course is in use and cannot be deleted."
    finally:
        connection.close()


def is_admin(student_id):
    connection = get_connection()
    user = connection.execute(
        "SELECT is_admin FROM users WHERE student_id = ?",
        (student_id,)
    ).fetchone()
    connection.close()
    return bool(user and user["is_admin"])


def get_scheduling_data():
    connection = get_connection()
    teachers = connection.execute("""
        SELECT id, name, role, email, kainga
        FROM teachers
        ORDER BY name
    """).fetchall()
    rooms = connection.execute("""
        SELECT id, code, name
        FROM rooms
        ORDER BY code
    """).fetchall()
    assignments = connection.execute("""
        SELECT
            course_schedule.course_id,
            MIN(course_schedule.session) AS line,
            MIN(course_schedule.teacher_id) AS teacher_id,
            MIN(course_schedule.room_id) AS room_id
        FROM course_schedule
        GROUP BY course_schedule.course_id
    """).fetchall()
    connection.close()
    return teachers, rooms, assignments


def save_course_assignment(course_id, line, teacher_id, room_id):
    connection = get_connection()
    try:
        course = connection.execute(
            "SELECT id FROM courses WHERE id = ?", (course_id,)
        ).fetchone()
        teacher = connection.execute(
            "SELECT id FROM teachers WHERE id = ?", (teacher_id,)
        ).fetchone()
        room = connection.execute(
            "SELECT id FROM rooms WHERE id = ?", (room_id,)
        ).fetchone()
        if not course or not teacher or not room or line not in (1, 2, 3, 4, 5):
            return False, "Select a valid course, line, teacher, and room."

        teacher_clash = connection.execute("""
            SELECT courses.code
            FROM course_schedule
            JOIN courses ON courses.id = course_schedule.course_id
            WHERE course_schedule.teacher_id = ?
              AND course_schedule.session = ?
              AND course_schedule.course_id != ?
            LIMIT 1
        """, (teacher_id, line, course_id)).fetchone()
        if teacher_clash:
            return False, f"That teacher already teaches {teacher_clash['code']} on Line {line}."

        room_clash = connection.execute("""
            SELECT courses.code
            FROM course_schedule
            JOIN courses ON courses.id = course_schedule.course_id
            WHERE course_schedule.room_id = ?
              AND course_schedule.session = ?
              AND course_schedule.course_id != ?
            LIMIT 1
        """, (room_id, line, course_id)).fetchone()
        if room_clash:
            return False, f"That room is already used by {room_clash['code']} on Line {line}."

        connection.execute("DELETE FROM course_schedule WHERE course_id = ?", (course_id,))
        connection.execute("""
            INSERT INTO course_schedule (course_id, teacher_id, room_id, day, session)
            SELECT ?, ?, ?, day, session
            FROM timetable_slots
            WHERE session = ?
        """, (course_id, teacher_id, room_id, line))
        connection.commit()
        return True, "Class assignment saved."
    except sqlite3.Error:
        connection.rollback()
        raise
    finally:
        connection.close()


def get_deletion_request(student_id):
    connection = get_connection()
    deletion_request = connection.execute("""
        SELECT id, student_id, status, requested_at, reviewed_at
        FROM account_deletion_requests
        WHERE student_id = ?
    """, (student_id,)).fetchone()
    connection.close()
    return deletion_request


def submit_deletion_request(student_id):
    connection = get_connection()
    try:
        user = connection.execute("""
            SELECT is_admin FROM users WHERE student_id = ?
        """, (student_id,)).fetchone()
        if not user or user["is_admin"]:
            return False, "This account cannot submit a deletion request."
        connection.execute("""
            INSERT INTO account_deletion_requests (student_id, status, requested_at, reviewed_at, reviewed_by)
            VALUES (?, 'pending', CURRENT_TIMESTAMP, NULL, NULL)
            ON CONFLICT(student_id) DO UPDATE SET
                status = 'pending', requested_at = CURRENT_TIMESTAMP,
                reviewed_at = NULL, reviewed_by = NULL
        """, (student_id,))
        connection.commit()
        return True, "Your account deletion request was sent to an administrator."
    finally:
        connection.close()


def cancel_deletion_request(student_id):
    connection = get_connection()
    cursor = connection.execute("""
        DELETE FROM account_deletion_requests
        WHERE student_id = ? AND status = 'pending'
    """, (student_id,))
    connection.commit()
    connection.close()
    return cursor.rowcount == 1


def get_deletion_requests():
    connection = get_connection()
    requests = connection.execute("""
        SELECT account_deletion_requests.id, account_deletion_requests.student_id,
               account_deletion_requests.status, account_deletion_requests.requested_at,
               account_deletion_requests.reviewed_at,
               users.first_name, users.last_name, users.email, users.year_level, users.kainga
        FROM account_deletion_requests
        JOIN users ON users.student_id = account_deletion_requests.student_id
        ORDER BY CASE account_deletion_requests.status WHEN 'pending' THEN 0 ELSE 1 END,
                 account_deletion_requests.requested_at DESC
    """).fetchall()
    connection.close()
    return requests


def review_deletion_request(request_id, decision, admin_id):
    connection = get_connection()
    try:
        deletion_request = connection.execute("""
            SELECT student_id, status FROM account_deletion_requests WHERE id = ?
        """, (request_id,)).fetchone()
        if not deletion_request or deletion_request["status"] != "pending":
            return False, "This request is no longer pending."

        if decision == "deny":
            connection.execute("""
                UPDATE account_deletion_requests
                SET status = 'denied', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
                WHERE id = ?
            """, (admin_id, request_id))
            connection.commit()
            return True, "Deletion request denied."

        if decision != "approve":
            return False, "Select approve or deny."

        student_id = deletion_request["student_id"]
        connection.execute("DELETE FROM student_lines WHERE student_id = ?", (student_id,))
        connection.execute("DELETE FROM account_deletion_requests WHERE id = ?", (request_id,))
        connection.execute("DELETE FROM users WHERE student_id = ? AND is_admin = 0", (student_id,))
        connection.commit()
        return True, "Student account deleted."
    except sqlite3.Error:
        connection.rollback()
        raise
    finally:
        connection.close()


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
            courses.id,
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
