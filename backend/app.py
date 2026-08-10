"""StudentNET HTTP API.

This module creates the Flask application, enables frontend CORS requests, and
maps JSON endpoints to the database layer. Route groups cover authentication,
student setup/settings, courses, timetable generation, administration,
account-deletion review, teachers/rooms, and NCEA standard tracking.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from secrets import token_urlsafe
from datetime import date

from database import (
    login,
    teacher_login,
    change_teacher_password,
    get_teacher_dashboard,
    update_teacher_class_location,
    signup,
    get_courses,
    get_student_subjects,
    save_setup,
    get_user,
    update_user,
    get_timetable,
    create_course,
    update_course,
    delete_course,
    get_scheduling_data,
    save_course_assignment,
    get_deletion_request,
    submit_deletion_request,
    cancel_deletion_request,
    get_deletion_requests,
    review_deletion_request,
    get_teachers,
    delete_course_assignment,
    get_student_standards,
    get_standard_catalog,
    save_student_standard,
    delete_student_standard,
    get_student_tutorial_bookings,
    get_tutorial_offerings,
    create_tutorial_offering,
    delete_tutorial_offering,
    save_tutorial_booking,
    get_la_tutorial_data,
    review_tutorial_booking,
)

app = Flask(__name__)
CORS(app)
SESSIONS = {}


def create_session(account_type, account_id):
    """Issue an opaque login token kept only by the API process and browser."""
    token = token_urlsafe(32)
    SESSIONS[token] = {"accountType": account_type, "accountId": str(account_id)}
    return token


def current_session():
    """Resolve the bearer token supplied with an authenticated API request."""
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else ""
    return SESSIONS.get(token)


def has_access(account_type, account_id=None):
    session = current_session()
    return bool(
        session
        and session["accountType"] == account_type
        and (account_id is None or session["accountId"] == str(account_id))
    )


def unauthorized():
    return jsonify({"success": False, "message": "Please log in again."}), 401


# ==========================================
# HOME
# ==========================================

@app.route("/")
def home():
    return jsonify({
        "message": "StudentNET API Running"
    })


# ==========================================
# LOGIN
# ==========================================

@app.route("/login", methods=["POST"])
def login_route():

    data = request.get_json()

    student_id = data.get("username")
    password = data.get("password")

    user = login(student_id, password)
    if not user and str(student_id).lower().startswith("st"):
        user = login(str(student_id)[2:], password)

    if not user:
        teacher = teacher_login(student_id, password)
        if not teacher:
            return jsonify({"success": False})
        first_name, _, last_name = teacher["name"].partition(" ")
        return jsonify({
            "success": True,
            "token": create_session("teacher", teacher["id"]),
            "accountType": "teacher",
            "teacherId": teacher["id"],
            "teacherCode": teacher["code"],
            "firstName": first_name,
            "lastName": last_name,
            "mustChangePassword": bool(teacher["must_change_password"]),
        })

    account_type = "admin" if bool(user["is_admin"]) else "student"
    return jsonify({
        "success": True,
        "token": create_session(account_type, user["student_id"]),
        "accountType": account_type,
        "studentId": user["student_id"],
        "firstName": user["first_name"],
        "lastName": user["last_name"],
        "isAdmin": bool(user["is_admin"]),
        "setupComplete": bool(user["setup_complete"])
    })


@app.route("/teacher/<int:teacher_id>/password", methods=["PUT"])
def teacher_password(teacher_id):
    if not has_access("teacher", teacher_id):
        return unauthorized()
    data = request.get_json(silent=True) or {}
    current_password = str(data.get("currentPassword", ""))
    new_password = str(data.get("newPassword", ""))
    if len(new_password) < 3 or new_password == "osc":
        return jsonify({
            "success": False,
            "message": "Choose at least 3 characters and do not reuse osc.",
        }), 400
    success = change_teacher_password(teacher_id, current_password, new_password)
    return jsonify({
        "success": success,
        "message": "Password updated." if success else "Current password is incorrect.",
    }), 200 if success else 401


@app.route("/teacher/<int:teacher_id>/dashboard")
def teacher_dashboard(teacher_id):
    if not has_access("teacher", teacher_id):
        return unauthorized()
    teacher, classes, lessons, rooms, slots = get_teacher_dashboard(teacher_id)
    if not teacher:
        return jsonify({"success": False, "message": "Teacher not found."}), 404
    return jsonify({
        "success": True,
        "teacher": dict(teacher),
        "classes": [dict(item) for item in classes],
        "lessons": [dict(item) for item in lessons],
        "rooms": [dict(item) for item in rooms],
        "slots": [dict(item) for item in slots],
    })


@app.route(
    "/teacher/<int:teacher_id>/classes/<int:course_id>/<int:day>/<int:line>/location",
    methods=["PUT"],
)
def teacher_class_location(teacher_id, course_id, day, line):
    if not has_access("teacher", teacher_id):
        return unauthorized()
    data = request.get_json(silent=True) or {}
    try:
        room_id = int(data.get("roomId"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Select a classroom."}), 400
    area = str(data.get("area", "")).strip()
    success, message = update_teacher_class_location(
        teacher_id, course_id, day, line, area, room_id
    )
    return jsonify({"success": success, "message": message}), 200 if success else 409


# ==========================================
# SIGN UP
# ==========================================

@app.route("/signup", methods=["POST"])
def signup_route():

    data = request.get_json()

    student_id = data.get("studentId")
    first_name = data.get("firstName")
    last_name = data.get("lastName")
    password = data.get("password")

    email = f"st{student_id}@ormiston.school.nz"

    success = signup(
        student_id,
        email,
        password,
        first_name,
        last_name
    )

    if success:
        return jsonify({
            "success": True,
            "token": create_session("student", student_id),
            "accountType": "student",
            "studentId": student_id,
            "firstName": first_name,
            "lastName": last_name,
            "isAdmin": False,
            "setupComplete": False,
        }), 201

    return jsonify({
        "success": False,
        "message": "Account already exists."
    }), 409


# ==========================================
# GET COURSES
# ==========================================

@app.route("/courses")
def courses():

    courses = get_courses()

    data = []

    for course in courses:

        data.append({
            "id": course["id"],
            "code": course["code"],
            "name": course["name"],
            "level": course["level"],
            "category": course["category"]
        })

    return jsonify(data)


@app.route("/teachers")
def teachers():
    return jsonify([dict(teacher) for teacher in get_teachers()])


def admin_course_data():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip().upper()
    name = str(data.get("name", "")).strip()
    category = str(data.get("category", "")).strip()
    try:
        level = int(data.get("level"))
    except (TypeError, ValueError):
        level = None
    if not code or not name or not category or level not in (1, 2, 3, 23):
        return None
    return code, name, level, category


@app.route("/admin/courses", methods=["POST"])
@app.route("/admin/courses/<int:course_id>", methods=["PUT", "DELETE"])
def admin_courses(course_id=None):
    if not has_access("admin"):
        return jsonify({"success": False, "message": "Admin access required."}), 403

    if request.method == "DELETE":
        success, message = delete_course(course_id)
        if success:
            return jsonify({"success": True})
        return jsonify({"success": False, "message": message or "Course not found."}), 400

    course = admin_course_data()
    if not course:
        return jsonify({"success": False, "message": "Complete every field with a valid NCEA level."}), 400

    if request.method == "POST":
        new_id = create_course(*course)
        if not new_id:
            return jsonify({"success": False, "message": "That course code is already in use."}), 409
        return jsonify({"success": True, "id": new_id}), 201

    if not update_course(course_id, *course):
        return jsonify({"success": False, "message": "Course not found or code already in use."}), 400
    return jsonify({"success": True})


@app.route("/admin/scheduling", methods=["GET"])
def admin_scheduling():
    if not has_access("admin"):
        return jsonify({"success": False, "message": "Admin access required."}), 403
    teachers, rooms, assignments = get_scheduling_data()
    return jsonify({
        "teachers": [dict(teacher) for teacher in teachers],
        "rooms": [dict(room) for room in rooms],
        "assignments": [dict(assignment) for assignment in assignments]
    })


@app.route("/admin/scheduling/<int:course_id>", methods=["PUT"])
def admin_course_assignment(course_id):
    if not has_access("admin"):
        return jsonify({"success": False, "message": "Admin access required."}), 403
    data = request.get_json(silent=True) or {}
    try:
        line = int(data.get("line"))
        teacher_id = int(data.get("teacherId"))
        room_id = int(data.get("roomId")) if data.get("roomId") else None
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Select a line, teacher, and area."}), 400
    area = str(data.get("area", "")).strip()
    try:
        original_line = int(data.get("originalLine")) if data.get("originalLine") else None
    except (TypeError, ValueError):
        original_line = None
    success, message = save_course_assignment(course_id, line, teacher_id, area, room_id, original_line)
    return jsonify({"success": success, "message": message}), 200 if success else 409


@app.route("/admin/scheduling/<int:course_id>/<int:line>", methods=["DELETE"])
def admin_course_assignment_delete(course_id, line):
    if not has_access("admin"):
        return jsonify({"success": False, "message": "Admin access required."}), 403
    if line not in (1, 2, 3, 4, 5):
        return jsonify({"success": False, "message": "Select a valid timetable line."}), 400
    success = delete_course_assignment(course_id, line)
    return jsonify({
        "success": success,
        "message": "Class offering deleted." if success else "Class offering not found."
    }), 200 if success else 404


@app.route("/ncea/<student_id>", methods=["GET", "POST"])
def ncea_standards(student_id):
    if not has_access("student", student_id):
        return unauthorized()
    if request.method == "GET":
        return jsonify([dict(item) for item in get_student_standards(student_id)])
    data = request.get_json(silent=True) or {}
    try:
        course_id = int(data.get("courseId"))
        credits = int(data.get("credits"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Choose a class and enter valid credits."}), 400
    number = str(data.get("number", "")).strip()
    title = str(data.get("title", "")).strip()
    assessment_type = data.get("assessmentType")
    grade = data.get("grade", "")
    if not number or not title or credits < 1 or credits > 30 or assessment_type not in ("Internal", "External") or grade not in ("", "NA", "A", "M", "E"):
        return jsonify({"success": False, "message": "Complete every standard field with valid values."}), 400
    success, message, saved_id = save_student_standard(
        student_id, None, course_id, number, title, credits,
        assessment_type, grade, bool(data.get("ueApproved", True))
    )
    return jsonify({"success": success, "message": message, "id": saved_id}), 201 if success else 400


@app.route("/ncea/catalog/<student_id>")
def ncea_catalog(student_id):
    if not has_access("student", student_id):
        return unauthorized()
    return jsonify([dict(item) for item in get_standard_catalog(student_id)])


@app.route("/ncea/<student_id>/<int:standard_id>", methods=["PUT", "DELETE"])
def ncea_standard(student_id, standard_id):
    if not has_access("student", student_id):
        return unauthorized()
    if request.method == "DELETE":
        success = delete_student_standard(student_id, standard_id)
        return jsonify({"success": success, "message": "Standard deleted." if success else "Standard not found."}), 200 if success else 404
    data = request.get_json(silent=True) or {}
    try:
        course_id = int(data.get("courseId"))
        credits = int(data.get("credits"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Choose a class and enter valid credits."}), 400
    number = str(data.get("number", "")).strip()
    title = str(data.get("title", "")).strip()
    assessment_type = data.get("assessmentType")
    grade = data.get("grade", "")
    if not number or not title or credits < 1 or credits > 30 or assessment_type not in ("Internal", "External") or grade not in ("", "NA", "A", "M", "E"):
        return jsonify({"success": False, "message": "Complete every standard field with valid values."}), 400
    success, message, saved_id = save_student_standard(
        student_id, standard_id, course_id, number, title, credits,
        assessment_type, grade, bool(data.get("ueApproved", True))
    )
    return jsonify({"success": success, "message": message, "id": saved_id}), 200 if success else 400


@app.route("/account-deletion/<student_id>", methods=["GET", "POST", "DELETE"])
def account_deletion(student_id):
    if not has_access("student", student_id):
        return unauthorized()
    if request.method == "GET":
        deletion_request = get_deletion_request(student_id)
        return jsonify({
            "request": dict(deletion_request) if deletion_request else None
        })
    if request.method == "DELETE":
        success = cancel_deletion_request(student_id)
        return jsonify({"success": success, "message": "Deletion request cancelled." if success else "No pending request found."}), 200 if success else 404
    success, message = submit_deletion_request(student_id)
    return jsonify({"success": success, "message": message}), 201 if success else 400


# ==========================================
# TUTORIAL BOOKINGS
# ==========================================

@app.route("/tutorials/student/<student_id>", methods=["GET", "POST"])
def student_tutorials(student_id):
    if not has_access("student", student_id):
        return unauthorized()
    if request.method == "GET":
        _, rooms, _ = get_scheduling_data()
        return jsonify({
            "bookings": [dict(item) for item in get_student_tutorial_bookings(student_id)],
            "offerings": [dict(item) for item in get_tutorial_offerings(student_id=student_id)],
            "rooms": [dict(item) for item in rooms],
        })
    data = request.get_json(silent=True) or {}
    try:
        tutorial_date = date.fromisoformat(str(data.get("tutorialDate", "")))
        booking_type = str(data.get("bookingType", ""))
        room_id = int(data.get("roomId")) if booking_type == "independent" else None
        offering_id = int(data.get("offeringId")) if booking_type == "tutorial" else None
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Choose a valid tutorial option and location."}), 400
    if tutorial_date < date.today() or tutorial_date.weekday() not in (1, 4):
        return jsonify({"success": False, "message": "Tutorial bookings must be for an upcoming Tuesday or Friday."}), 400
    if booking_type not in ("tutorial", "independent"):
        return jsonify({"success": False, "message": "Choose a tutorial or independent learning."}), 400
    learning_area = str(data.get("learningArea", "")).strip() if booking_type == "independent" else ""
    details = str(data.get("details", "")).strip() if booking_type == "independent" else ""
    if booking_type == "independent" and (
        not learning_area or not details or len(learning_area) > 80 or len(details) > 250
    ):
        return jsonify({"success": False, "message": "Enter the tutorial area and what you will work on."}), 400
    success, message = save_tutorial_booking(
        student_id, tutorial_date.isoformat(), booking_type, learning_area,
        details, room_id, offering_id
    )
    return jsonify({"success": success, "message": message}), 201 if success else 400


@app.route("/tutorials/teacher/<int:teacher_id>", methods=["GET", "POST"])
def teacher_tutorials(teacher_id):
    if not has_access("teacher", teacher_id):
        return unauthorized()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        try:
            tutorial_date = date.fromisoformat(str(data.get("tutorialDate", "")))
            room_id = int(data.get("roomId"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Choose a valid date and location."}), 400
        if tutorial_date < date.today() or tutorial_date.weekday() not in (1, 4):
            return jsonify({"success": False, "message": "Tutorial spaces must be on an upcoming Tuesday or Friday."}), 400
        learning_area = str(data.get("learningArea", "")).strip()
        details = str(data.get("details", "")).strip()
        if not learning_area or not details or len(learning_area) > 80 or len(details) > 250:
            return jsonify({"success": False, "message": "Enter a code or subject and tutorial description."}), 400
        success, message = create_tutorial_offering(
            teacher_id, tutorial_date.isoformat(), learning_area, details, room_id
        )
        return jsonify({"success": success, "message": message}), 201 if success else 400
    students, bookings, offerings, area_counts = get_la_tutorial_data(teacher_id)
    _, rooms, _ = get_scheduling_data()
    return jsonify({
        "students": [dict(item) for item in students],
        "bookings": [dict(item) for item in bookings],
        "offerings": [dict(item) for item in offerings],
        "areaCounts": [dict(item) for item in area_counts],
        "rooms": [dict(item) for item in rooms],
    })


@app.route("/tutorials/teacher/<int:teacher_id>/<int:booking_id>", methods=["PUT"])
def teacher_tutorial_review(teacher_id, booking_id):
    if not has_access("teacher", teacher_id):
        return unauthorized()
    decision = str((request.get_json(silent=True) or {}).get("decision", ""))
    if decision not in ("approved", "denied"):
        return jsonify({"success": False, "message": "Choose approve or deny."}), 400
    success = review_tutorial_booking(teacher_id, booking_id, decision)
    return jsonify({
        "success": success,
        "message": "Tutorial request updated." if success else "That request is not assigned to your LA group.",
    }), 200 if success else 404


@app.route("/tutorials/teacher/<int:teacher_id>/spaces/<int:offering_id>", methods=["DELETE"])
def teacher_tutorial_space_delete(teacher_id, offering_id):
    if not has_access("teacher", teacher_id):
        return unauthorized()
    success = delete_tutorial_offering(teacher_id, offering_id)
    return jsonify({
        "success": success,
        "message": "Tutorial space and student booking removed." if success else "Tutorial space not found.",
    }), 200 if success else 404


@app.route("/admin/account-deletions", methods=["GET"])
def admin_account_deletions():
    if not has_access("admin"):
        return jsonify({"success": False, "message": "Admin access required."}), 403
    return jsonify([dict(item) for item in get_deletion_requests()])


@app.route("/admin/account-deletions/<int:request_id>", methods=["PUT"])
def admin_account_deletion_review(request_id):
    session = current_session()
    if not session or session["accountType"] != "admin":
        return jsonify({"success": False, "message": "Admin access required."}), 403
    admin_id = session["accountId"]
    decision = (request.get_json(silent=True) or {}).get("decision")
    success, message = review_deletion_request(request_id, decision, admin_id)
    return jsonify({"success": success, "message": message}), 200 if success else 400


# ==========================================
# SAVE SETUP
# ==========================================

@app.route("/setup", methods=["POST"])
def setup():

    data = request.get_json()

    student_id = data["studentId"]
    if not has_access("student", student_id):
        return unauthorized()
    year_level = data["yearLevel"]
    learning_area = data["learningArea"]
    subjects = data["subjects"]
    la_teacher_id = data.get("laTeacherId")

    save_setup(
        student_id,
        year_level,
        learning_area,
        subjects,
        la_teacher_id
    )

    return jsonify({
        "success": True
    })


# ==========================================
# GET USER
# ==========================================

@app.route("/user/<student_id>", methods=["GET", "PUT"])
def user(student_id):
    if not has_access("student", student_id):
        return unauthorized()

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        first_name = str(data.get("firstName", "")).strip()
        last_name = str(data.get("lastName", "")).strip()
        kainga = data.get("learningArea")

        try:
            year_level = int(data.get("yearLevel"))
        except (TypeError, ValueError):
            year_level = None

        if not first_name or not last_name:
            return jsonify({"success": False, "message": "Name fields are required."}), 400

        if year_level not in (11, 12, 13):
            return jsonify({"success": False, "message": "Select a valid year level."}), 400

        if kainga not in ("Pūngāwerewere", "Pūkeko", "Mokoroa", "Kea"):
            return jsonify({"success": False, "message": "Select a valid Kāinga."}), 400

        new_password = data.get("newPassword") or None
        if new_password and len(new_password) < 6:
            return jsonify({"success": False, "message": "New password must be at least 6 characters."}), 400

        subjects = data.get("subjects")
        if not isinstance(subjects, list) or len(subjects) != 5:
            return jsonify({"success": False, "message": "Select one subject for each of the five lines."}), 400

        try:
            subjects = [int(course_id) for course_id in subjects]
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Every subject selection must be valid."}), 400

        if len(set(subjects)) != 5:
            return jsonify({"success": False, "message": "Each timetable line must use a different subject."}), 400

        success, message = update_user(
            student_id,
            first_name,
            last_name,
            year_level,
            kainga,
            subjects,
            data.get("currentPassword"),
            new_password
        )

        return jsonify({"success": success, "message": message}), 200 if success else 400

    user = get_user(student_id)

    if not user:
        return jsonify({
            "success": False
        })

    return jsonify({
        "success": True,
        "studentId": user["student_id"],
        "email": user["email"],
        "firstName": user["first_name"],
        "lastName": user["last_name"],
        "yearLevel": user["year_level"],
        "learningArea": user["kainga"],
        "setupComplete": bool(user["setup_complete"])
    })


@app.route("/subjects/<student_id>")
def subjects(student_id):
    if not has_access("student", student_id):
        return unauthorized()
    return jsonify([dict(row) for row in get_student_subjects(student_id)])

@app.route("/timetable/<student_id>")
def timetable(student_id):
    if not has_access("student", student_id):
        return unauthorized()

    timetable = get_timetable(student_id)

    return jsonify([dict(row) for row in timetable])

if __name__ == "__main__":
    app.run(debug=True)
