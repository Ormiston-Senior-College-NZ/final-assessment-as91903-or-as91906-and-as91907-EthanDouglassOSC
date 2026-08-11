"""StudentNET SQLite data-access layer.

This module owns the database connection and all parameterised reads/writes for
users, courses, student selections, teacher offerings, rooms, timetables,
deletion requests, the NZQA catalogue, and individual student results.
Functions return SQLite rows or plain values for conversion by ``app.py``.
"""

import sqlite3
import hmac
from werkzeug.security import check_password_hash, generate_password_hash
import os
from teacher_codes import NAME_CORRECTIONS, build_teacher_codes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "studentnet.db")
_teacher_codes_ready = False

def get_connection():
    global _teacher_codes_ready
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    if not _teacher_codes_ready:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(teachers)")}
        if "code" not in columns:
            connection.execute("ALTER TABLE teachers ADD COLUMN code TEXT")
        if "password" not in columns:
            connection.execute("ALTER TABLE teachers ADD COLUMN password TEXT NOT NULL DEFAULT 'osc'")
        if "must_change_password" not in columns:
            connection.execute(
                "ALTER TABLE teachers ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1"
            )
        for old_name, corrected_name in NAME_CORRECTIONS.items():
            connection.execute(
                "UPDATE teachers SET name = ? WHERE name = ?",
                (corrected_name, old_name),
            )
        rows = connection.execute("SELECT id, name FROM teachers").fetchall()
        for teacher_id, code in build_teacher_codes(rows).items():
            connection.execute("UPDATE teachers SET code = ? WHERE id = ?", (code, teacher_id))

        connection.executescript("""
            CREATE TABLE IF NOT EXISTS tutorial_offerings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tutorial_date TEXT NOT NULL,
                teacher_id INTEGER NOT NULL,
                learning_area TEXT NOT NULL,
                details TEXT NOT NULL,
                room_id INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tutorial_date, teacher_id, learning_area, room_id),
                FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
                FOREIGN KEY(room_id) REFERENCES rooms(id)
            );
            CREATE TABLE IF NOT EXISTS tutorial_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                tutorial_date TEXT NOT NULL,
                learning_area TEXT NOT NULL,
                details TEXT NOT NULL,
                room_id INTEGER NOT NULL,
                supervising_teacher_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reviewed_by INTEGER,
                reviewed_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, tutorial_date),
                FOREIGN KEY(student_id) REFERENCES users(student_id) ON DELETE CASCADE,
                FOREIGN KEY(room_id) REFERENCES rooms(id),
                FOREIGN KEY(supervising_teacher_id) REFERENCES teachers(id),
                FOREIGN KEY(reviewed_by) REFERENCES teachers(id)
            );
        """)
        booking_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(tutorial_bookings)")
        }
        if "booking_type" not in booking_columns:
            connection.execute(
                "ALTER TABLE tutorial_bookings ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'independent'"
            )
        if "offering_id" not in booking_columns:
            connection.execute(
                "ALTER TABLE tutorial_bookings ADD COLUMN offering_id INTEGER REFERENCES tutorial_offerings(id)"
            )
        connection.execute("DROP INDEX IF EXISTS one_student_per_tutorial_space")
        commons = (
            ("PapaC", "Papatūānuku Commons"),
            ("PungC", "Pūngāwerewere Commons"),
            ("KahiC", "Kahikatea Commons"),
            ("PukeC", "Pūkeko Commons"),
            ("HaraC", "Harakeke Commons"),
            ("MokoC", "Mokoroa Commons"),
            ("WakaC", "Waka Commons"),
            ("KeaC", "Kea Commons"),
        )
        connection.executemany(
            "INSERT OR IGNORE INTO rooms (code, name) VALUES (?, ?)", commons
        )
        connection.commit()
        _teacher_codes_ready = True
    return connection


# ==========================================================
# LOGIN
# ==========================================================

def _password_matches(stored_password, supplied_password):
    """Verify hashed credentials while supporting one-time legacy upgrades."""
    stored = str(stored_password or "")
    supplied = str(supplied_password or "")
    if stored.startswith(("scrypt:", "pbkdf2:")):
        return check_password_hash(stored, supplied)
    return hmac.compare_digest(stored, supplied)

def login(student_id, password):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM users
        WHERE student_id = ?
    """, (student_id,))

    user = cursor.fetchone()

    if not user or not _password_matches(user["password"], password):
        connection.close()
        return None

    if not str(user["password"]).startswith(("scrypt:", "pbkdf2:")):
        connection.execute(
            "UPDATE users SET password = ? WHERE student_id = ?",
            (generate_password_hash(str(password)), student_id),
        )
        connection.commit()

    connection.close()

    return user


def teacher_login(identifier, password):
    """Authenticate a teacher by staff code or full name."""
    connection = get_connection()
    teacher = connection.execute(
        """
        SELECT id, name, code, role, kainga, must_change_password, password
        FROM teachers
        WHERE (UPPER(code) = UPPER(?) OR LOWER(name) = LOWER(?))
        """,
        (identifier, identifier),
    ).fetchone()
    if not teacher or not _password_matches(teacher["password"], password):
        connection.close()
        return None
    if not str(teacher["password"]).startswith(("scrypt:", "pbkdf2:")):
        connection.execute(
            "UPDATE teachers SET password = ? WHERE id = ?",
            (generate_password_hash(str(password)), teacher["id"]),
        )
        connection.commit()
    connection.close()
    return teacher


def change_teacher_password(teacher_id, current_password, new_password):
    """Replace a teacher password and clear the first-login requirement."""
    connection = get_connection()
    teacher = connection.execute(
        "SELECT password FROM teachers WHERE id = ?", (teacher_id,)
    ).fetchone()
    if not teacher or not _password_matches(teacher["password"], current_password):
        connection.close()
        return False
    result = connection.execute(
        "UPDATE teachers SET password = ?, must_change_password = 0 WHERE id = ?",
        (generate_password_hash(str(new_password)), teacher_id),
    )
    connection.commit()
    connection.close()
    return result.rowcount == 1


def get_teacher_dashboard(teacher_id):
    """Return a teacher profile and one row for each assigned class offering."""
    connection = get_connection()
    teacher = connection.execute(
        "SELECT id, name, code, role, kainga FROM teachers WHERE id = ?",
        (teacher_id,),
    ).fetchone()
    classes = connection.execute(
        """
        SELECT DISTINCT courses.id, courses.code, courses.name, courses.level,
               courses.category, course_schedule.session AS line
        FROM course_schedule
        JOIN courses ON courses.id = course_schedule.course_id
        WHERE course_schedule.teacher_id = ?
        ORDER BY course_schedule.session, courses.code
        """,
        (teacher_id,),
    ).fetchall()
    lessons = connection.execute(
        """
        SELECT courses.id, courses.code, courses.name, courses.category,
               course_schedule.day, course_schedule.session AS line,
               course_schedule.area, rooms.code AS room_code,
               rooms.name AS room_name, timetable_slots.start_time,
               timetable_slots.end_time
        FROM course_schedule
        JOIN courses ON courses.id = course_schedule.course_id
        JOIN timetable_slots
          ON timetable_slots.day = course_schedule.day
         AND timetable_slots.session = course_schedule.session
        LEFT JOIN rooms ON rooms.id = course_schedule.room_id
        WHERE course_schedule.teacher_id = ?
        ORDER BY course_schedule.day, timetable_slots.start_time
        """,
        (teacher_id,),
    ).fetchall()
    rooms = connection.execute(
        "SELECT id, code, name FROM rooms ORDER BY code"
    ).fetchall()
    slots = connection.execute(
        """
        SELECT day, session AS line, start_time, end_time
        FROM timetable_slots
        ORDER BY day, start_time
        """
    ).fetchall()
    connection.close()
    return teacher, classes, lessons, rooms, slots


def update_teacher_class_location(teacher_id, course_id, day, line, area, room_id):
    """Allow a teacher to move one of their weekly lessons within an area."""
    connection = get_connection()
    room = connection.execute(
        "SELECT id, name FROM rooms WHERE id = ?", (room_id,)
    ).fetchone()
    assigned = connection.execute(
        """
        SELECT 1 FROM course_schedule
        WHERE teacher_id = ? AND course_id = ? AND day = ? AND session = ?
        LIMIT 1
        """,
        (teacher_id, course_id, day, line),
    ).fetchone()
    if not room or not assigned or not area or not room["name"].startswith(area):
        connection.close()
        return False, "That class or room is not available."

    clash = connection.execute(
        """
        SELECT courses.code
        FROM course_schedule
        JOIN courses ON courses.id = course_schedule.course_id
        WHERE course_schedule.room_id = ? AND course_schedule.day = ?
          AND course_schedule.session = ?
          AND NOT (course_schedule.teacher_id = ? AND course_schedule.course_id = ?)
        LIMIT 1
        """,
        (room_id, day, line, teacher_id, course_id),
    ).fetchone()
    if clash:
        connection.close()
        return False, f"That room is already used by {clash['code']} on Line {line}."

    connection.execute(
        """
        UPDATE course_schedule SET room_id = ?, area = ?
        WHERE teacher_id = ? AND course_id = ? AND day = ? AND session = ?
        """,
        (room_id, area, teacher_id, course_id, day, line),
    )
    connection.commit()
    connection.close()
    return True, "Class location updated."


# ==========================================================
# TUTORIAL BOOKINGS
# ==========================================================

def get_student_tutorial_bookings(student_id):
    """Return every tutorial destination submitted by one student."""
    connection = get_connection()
    rows = connection.execute(
        """
        SELECT tutorial_bookings.*, rooms.code AS room_code,
               rooms.name AS room_name, teachers.name AS teacher_name,
               teachers.code AS teacher_code
        FROM tutorial_bookings
        JOIN rooms ON rooms.id = tutorial_bookings.room_id
        JOIN teachers ON teachers.id = tutorial_bookings.supervising_teacher_id
        WHERE tutorial_bookings.student_id = ?
        ORDER BY tutorial_bookings.tutorial_date
        """,
        (student_id,),
    ).fetchall()
    connection.close()
    return rows


def get_tutorial_offerings(tutorial_date=None, student_id=None):
    """Return published group tutorial spaces available to every student."""
    connection = get_connection()
    query = """
        SELECT tutorial_offerings.*, teachers.name AS teacher_name,
               teachers.code AS teacher_code, rooms.code AS room_code,
               rooms.name AS room_name
        FROM tutorial_offerings
        JOIN teachers ON teachers.id = tutorial_offerings.teacher_id
        JOIN rooms ON rooms.id = tutorial_offerings.room_id
    """
    parameters = ()
    if tutorial_date:
        query += " WHERE tutorial_offerings.tutorial_date = ?"
        parameters = (tutorial_date,)
    query += " ORDER BY tutorial_offerings.tutorial_date, tutorial_offerings.learning_area, teachers.name"
    rows = connection.execute(query, parameters).fetchall()
    connection.close()
    return rows


def create_tutorial_offering(teacher_id, tutorial_date, learning_area, details, room_id):
    """Publish a tutorial destination owned and supervised by the teacher."""
    connection = get_connection()
    room = connection.execute("SELECT id FROM rooms WHERE id = ?", (room_id,)).fetchone()
    if not room:
        connection.close()
        return False, "Select a valid location."
    try:
        connection.execute(
            """
            INSERT INTO tutorial_offerings
                (tutorial_date, teacher_id, learning_area, details, room_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tutorial_date, teacher_id, learning_area, details, room_id),
        )
        connection.commit()
    except sqlite3.IntegrityError:
        connection.close()
        return False, "That tutorial space already exists."
    connection.close()
    return True, "Tutorial space added."


def delete_tutorial_offering(teacher_id, offering_id):
    """Remove a teacher-owned space and cancel its linked student booking."""
    connection = get_connection()
    offering = connection.execute(
        "SELECT id FROM tutorial_offerings WHERE id = ? AND teacher_id = ?",
        (offering_id, teacher_id),
    ).fetchone()
    if not offering:
        connection.close()
        return False
    connection.execute(
        "DELETE FROM tutorial_bookings WHERE offering_id = ?", (offering_id,)
    )
    connection.execute(
        "DELETE FROM tutorial_offerings WHERE id = ? AND teacher_id = ?",
        (offering_id, teacher_id),
    )
    connection.commit()
    connection.close()
    return True


def save_tutorial_booking(student_id, tutorial_date, booking_type, learning_area,
                          details, room_id, offering_id=None):
    """Create or replace a tutorial or independent-learning request."""
    connection = get_connection()
    student = connection.execute(
        "SELECT student_id, la_teacher_id FROM users WHERE student_id = ?", (student_id,)
    ).fetchone()
    if not student:
        connection.close()
        return False, "Student account could not be found."
    if booking_type == "tutorial":
        offering = connection.execute(
            """
            SELECT tutorial_offerings.id,
                   tutorial_offerings.learning_area,
                   tutorial_offerings.details,
                   tutorial_offerings.room_id,
                   tutorial_offerings.teacher_id
            FROM tutorial_offerings
            WHERE tutorial_offerings.id = ? AND tutorial_offerings.tutorial_date = ?
            """,
            (offering_id, tutorial_date),
        ).fetchone()
        if not offering:
            connection.close()
            return False, "Select an available tutorial space."
        learning_area, details = offering["learning_area"], offering["details"]
        room_id, teacher_id = offering["room_id"], offering["teacher_id"]
    else:
        room = connection.execute("SELECT id FROM rooms WHERE id = ?", (room_id,)).fetchone()
        teacher_id = student["la_teacher_id"]
        offering_id = None
        if not room or not teacher_id:
            connection.close()
            return False, "Select a valid independent-learning location."
    try:
        connection.execute(
            """
        INSERT INTO tutorial_bookings
            (student_id, tutorial_date, learning_area, details, room_id,
             supervising_teacher_id, status, booking_type, offering_id)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT(student_id, tutorial_date) DO UPDATE SET
            learning_area = excluded.learning_area,
            details = excluded.details,
            room_id = excluded.room_id,
            supervising_teacher_id = excluded.supervising_teacher_id,
            booking_type = excluded.booking_type,
            offering_id = excluded.offering_id,
            status = 'pending', reviewed_by = NULL, reviewed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
            """,
            (student_id, tutorial_date, learning_area, details, room_id, teacher_id,
             booking_type, offering_id),
        )
    except sqlite3.IntegrityError:
        connection.close()
        return False, "That tutorial booking could not be saved."
    connection.commit()
    connection.close()
    return True, "Tutorial request sent to your Learning Advisor."


def get_la_tutorial_data(teacher_id):
    """Return LA requests plus teacher offerings and destination totals."""
    connection = get_connection()
    students = connection.execute(
        """
        SELECT student_id, first_name, last_name, year_level, kainga
        FROM users
        WHERE la_teacher_id = ?
        ORDER BY last_name, first_name
        """,
        (teacher_id,),
    ).fetchall()
    bookings = connection.execute(
        """
        SELECT tutorial_bookings.*, users.first_name, users.last_name,
               users.year_level, rooms.code AS room_code, rooms.name AS room_name,
               teachers.name AS teacher_name, teachers.code AS teacher_code
        FROM tutorial_bookings
        JOIN users ON users.student_id = tutorial_bookings.student_id
        JOIN rooms ON rooms.id = tutorial_bookings.room_id
        JOIN teachers ON teachers.id = tutorial_bookings.supervising_teacher_id
        WHERE users.la_teacher_id = ?
        ORDER BY tutorial_bookings.tutorial_date, users.last_name, users.first_name
        """,
        (teacher_id,),
    ).fetchall()
    offerings = connection.execute(
        """
        SELECT tutorial_offerings.*, rooms.code AS room_code, rooms.name AS room_name,
               COUNT(tutorial_bookings.id) AS visitor_count,
               GROUP_CONCAT(users.first_name || ' ' || users.last_name, ', ') AS booked_students,
               GROUP_CONCAT(users.student_id, ', ') AS booked_student_ids
        FROM tutorial_offerings
        JOIN rooms ON rooms.id = tutorial_offerings.room_id
        LEFT JOIN tutorial_bookings
         ON tutorial_bookings.offering_id = tutorial_offerings.id
         AND tutorial_bookings.status != 'denied'
        LEFT JOIN users ON users.student_id = tutorial_bookings.student_id
        WHERE tutorial_offerings.teacher_id = ?
        GROUP BY tutorial_offerings.id
        ORDER BY tutorial_offerings.tutorial_date, tutorial_offerings.learning_area
        """,
        (teacher_id,),
    ).fetchall()
    area_counts = connection.execute(
        """
        SELECT tutorial_date, learning_area, COUNT(*) AS visitor_count
        FROM tutorial_bookings
        WHERE status != 'denied'
        GROUP BY tutorial_date, learning_area
        ORDER BY learning_area
        """
    ).fetchall()
    connection.close()
    return students, bookings, offerings, area_counts


def review_tutorial_booking(teacher_id, booking_id, decision):
    """Approve or deny a request only when the student belongs to the teacher's LA."""
    connection = get_connection()
    result = connection.execute(
        """
        UPDATE tutorial_bookings
        SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
            offering_id = CASE WHEN ? = 'denied' THEN NULL ELSE offering_id END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND student_id IN (
            SELECT student_id FROM users WHERE la_teacher_id = ?
        )
        """,
        (decision, teacher_id, decision, booking_id, teacher_id),
    )
    connection.commit()
    connection.close()
    return result.rowcount == 1


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
            generate_password_hash(str(password)),
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

        if new_password and not _password_matches(user["password"], current_password):
            return False, "Current password is incorrect."

        selected_courses = connection.execute("""
            SELECT id, level
            FROM courses
            WHERE id IN (?, ?, ?, ?, ?)
        """, tuple(subjects)).fetchall()

        allowed_levels = {
            11: {1},
            12: {2, 3, 23},
            13: {3, 23}
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
                generate_password_hash(str(new_password)),
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
        SELECT id, name, code, role, email, kainga
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
            course_schedule.session AS line,
            MIN(course_schedule.teacher_id) AS teacher_id,
            MIN(course_schedule.room_id) AS room_id,
            MIN(course_schedule.area) AS area
        FROM course_schedule
        GROUP BY course_schedule.course_id, course_schedule.session
    """).fetchall()
    connection.close()
    return teachers, rooms, assignments


def save_course_assignment(course_id, line, teacher_id, area, room_id=None, original_line=None):
    connection = get_connection()
    try:
        course = connection.execute(
            "SELECT id FROM courses WHERE id = ?", (course_id,)
        ).fetchone()
        teacher = connection.execute(
            "SELECT id FROM teachers WHERE id = ?", (teacher_id,)
        ).fetchone()
        room = None
        if room_id:
            room = connection.execute(
                "SELECT id, name FROM rooms WHERE id = ?", (room_id,)
            ).fetchone()
        if not course or not teacher or not area or line not in (1, 2, 3, 4, 5):
            return False, "Select a valid course, line, teacher, and area."
        if room_id and (not room or not room["name"].startswith(area)):
            return False, "Select a classroom inside the assigned area."

        editing_line = original_line
        target_offering = connection.execute("""
            SELECT id FROM course_schedule
            WHERE course_id = ? AND session = ?
              AND (? IS NULL OR session != ?)
            LIMIT 1
        """, (course_id, line, editing_line, editing_line)).fetchone()
        if target_offering:
            return False, f"This course already has a Line {line} class."
        original_line = editing_line or line

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

        room_clash = room_id and connection.execute("""
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

        connection.execute("""
            DELETE FROM course_schedule WHERE course_id = ? AND session = ?
        """, (course_id, original_line))
        connection.execute("""
            INSERT INTO course_schedule (course_id, teacher_id, room_id, area, day, session)
            SELECT ?, ?, ?, ?, day, session
            FROM timetable_slots
            WHERE session = ?
        """, (course_id, teacher_id, room_id, area, line))
        connection.commit()
        return True, "Class assignment saved."
    except sqlite3.Error:
        connection.rollback()
        raise
    finally:
        connection.close()


def delete_course_assignment(course_id, line):
    connection = get_connection()
    cursor = connection.execute("""
        DELETE FROM course_schedule
        WHERE course_id = ? AND session = ?
    """, (course_id, line))
    connection.commit()
    connection.close()
    return cursor.rowcount > 0


def get_student_standards(student_id):
    connection = get_connection()
    standards = connection.execute("""
        WITH numbered_catalog AS (
            SELECT course_standard_catalog.course_id, assessment_catalog.standard_number,
                   assessment_catalog.level || '.' || ROW_NUMBER() OVER (
                       PARTITION BY course_standard_catalog.course_id, assessment_catalog.level
                       ORDER BY CAST(assessment_catalog.standard_number AS INTEGER)
                   ) AS short_code
            FROM course_standard_catalog
            JOIN assessment_catalog ON assessment_catalog.id = course_standard_catalog.standard_id
        )
        SELECT student_standards.*, courses.code AS course_code,
               courses.name AS course_name, courses.level AS course_level
               , numbered_catalog.short_code
        FROM student_standards
        JOIN courses ON courses.id = student_standards.course_id
        LEFT JOIN numbered_catalog
            ON numbered_catalog.course_id = student_standards.course_id
            AND numbered_catalog.standard_number = student_standards.standard_number
        WHERE student_standards.student_id = ?
        ORDER BY courses.name, student_standards.standard_number
    """, (student_id,)).fetchall()
    connection.close()
    return standards


def get_standard_catalog(student_id):
    connection = get_connection()
    standards = connection.execute("""
        WITH numbered_catalog AS (
            SELECT course_standard_catalog.course_id, assessment_catalog.*,
                   assessment_catalog.level || '.' || ROW_NUMBER() OVER (
                       PARTITION BY course_standard_catalog.course_id, assessment_catalog.level
                       ORDER BY CAST(assessment_catalog.standard_number AS INTEGER)
                   ) AS short_code
            FROM course_standard_catalog
            JOIN assessment_catalog ON assessment_catalog.id = course_standard_catalog.standard_id
        )
        SELECT numbered_catalog.*
        FROM numbered_catalog
        JOIN student_lines ON student_lines.course_id = numbered_catalog.course_id
        WHERE student_lines.student_id = ?
        ORDER BY numbered_catalog.course_id, numbered_catalog.level,
                 CAST(numbered_catalog.standard_number AS INTEGER)
    """, (student_id,)).fetchall()
    connection.close()
    return standards


def save_student_standard(student_id, standard_id, course_id, number, title, credits, assessment_type, grade, ue_approved):
    connection = get_connection()
    try:
        selected_course = connection.execute("""
            SELECT courses.id
            FROM student_lines
            JOIN courses ON courses.id = student_lines.course_id
            WHERE student_lines.student_id = ? AND courses.id = ?
        """, (student_id, course_id)).fetchone()
        if not selected_course:
            return False, "Choose one of your enrolled classes.", None

        if standard_id:
            cursor = connection.execute("""
                UPDATE student_standards
                SET course_id = ?, standard_number = ?, title = ?, credits = ?,
                    assessment_type = ?, grade = ?, ue_approved = ?
                WHERE id = ? AND student_id = ?
            """, (course_id, number, title, credits, assessment_type, grade, ue_approved, standard_id, student_id))
            saved_id = standard_id
        else:
            cursor = connection.execute("""
                INSERT INTO student_standards
                    (student_id, course_id, standard_number, title, credits, assessment_type, grade, ue_approved)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (student_id, course_id, number, title, credits, assessment_type, grade, ue_approved))
            saved_id = cursor.lastrowid
        if cursor.rowcount != 1:
            return False, "Standard not found.", None
        connection.commit()
        return True, "Standard saved.", saved_id
    except sqlite3.IntegrityError:
        connection.rollback()
        return False, "That standard number is already in your results.", None
    finally:
        connection.close()


def delete_student_standard(student_id, standard_id):
    connection = get_connection()
    cursor = connection.execute("""
        DELETE FROM student_standards WHERE id = ? AND student_id = ?
    """, (standard_id, student_id))
    connection.commit()
    connection.close()
    return cursor.rowcount == 1


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

def save_setup(student_id, year_level, kainga, subjects, la_teacher_id):

    if len(subjects) != 5 or any(not course_id for course_id in subjects):
        raise ValueError("Exactly five subjects must be selected")

    connection = get_connection()
    try:
        la_teacher = connection.execute("""
            SELECT id FROM teachers WHERE id = ? AND kainga = ?
        """, (la_teacher_id, kainga)).fetchone()
        if not la_teacher:
            raise ValueError("Select a valid LA teacher from your Kāinga")

        cursor = connection.execute("""
            UPDATE users
            SET
                year_level = ?,
                kainga = ?,
                la_teacher_id = ?,
                setup_complete = 1
            WHERE student_id = ?
        """, (
            year_level,
            kainga,
            la_teacher_id,
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


def get_teachers():
    connection = get_connection()
    teachers = connection.execute("""
        SELECT id, name, code, role, kainga
        FROM teachers
        ORDER BY kainga, name
    """).fetchall()
    connection.close()
    return teachers

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
            CASE WHEN timetable_slots.session = 6 THEN la_teacher.name ELSE teachers.name END AS teacher,
            CASE WHEN timetable_slots.session = 6 THEN la_teacher.code ELSE teachers.code END AS teacher_code,
            CASE WHEN timetable_slots.session = 6 THEN '-' ELSE rooms.code END AS room,
            CASE WHEN timetable_slots.session = 6 THEN '-' ELSE rooms.name END AS room_name,
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

        LEFT JOIN users AS timetable_user
            ON timetable_user.student_id = ?

        LEFT JOIN teachers AS la_teacher
            ON timetable_user.la_teacher_id = la_teacher.id

        WHERE timetable_slots.session = 6
            OR student_lines.course_id IS NOT NULL

        ORDER BY timetable_slots.day, timetable_slots.start_time
    """, (student_id, student_id))

    timetable = cursor.fetchall()

    connection.close()

    return timetable
