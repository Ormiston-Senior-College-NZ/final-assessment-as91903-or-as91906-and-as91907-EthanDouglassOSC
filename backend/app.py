from flask import Flask, request, jsonify
from flask_cors import CORS

from database import (
    login,
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
    is_admin,
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
    delete_student_standard
)

app = Flask(__name__)
CORS(app)


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

    if not user:
        return jsonify({
            "success": False
        })

    return jsonify({
        "success": True,
        "studentId": user["student_id"],
        "firstName": user["first_name"],
        "lastName": user["last_name"],
        "isAdmin": bool(user["is_admin"]),
        "setupComplete": bool(user["setup_complete"])
    })


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
            "success": True
        })

    return jsonify({
        "success": False,
        "message": "Account already exists."
    })


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
    if not is_admin(request.headers.get("X-Student-ID")):
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
    if not is_admin(request.headers.get("X-Student-ID")):
        return jsonify({"success": False, "message": "Admin access required."}), 403
    teachers, rooms, assignments = get_scheduling_data()
    return jsonify({
        "teachers": [dict(teacher) for teacher in teachers],
        "rooms": [dict(room) for room in rooms],
        "assignments": [dict(assignment) for assignment in assignments]
    })


@app.route("/admin/scheduling/<int:course_id>", methods=["PUT"])
def admin_course_assignment(course_id):
    if not is_admin(request.headers.get("X-Student-ID")):
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
    if not is_admin(request.headers.get("X-Student-ID")):
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
    return jsonify([dict(item) for item in get_standard_catalog(student_id)])


@app.route("/ncea/<student_id>/<int:standard_id>", methods=["PUT", "DELETE"])
def ncea_standard(student_id, standard_id):
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


@app.route("/admin/account-deletions", methods=["GET"])
def admin_account_deletions():
    if not is_admin(request.headers.get("X-Student-ID")):
        return jsonify({"success": False, "message": "Admin access required."}), 403
    return jsonify([dict(item) for item in get_deletion_requests()])


@app.route("/admin/account-deletions/<int:request_id>", methods=["PUT"])
def admin_account_deletion_review(request_id):
    admin_id = request.headers.get("X-Student-ID")
    if not is_admin(admin_id):
        return jsonify({"success": False, "message": "Admin access required."}), 403
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
    return jsonify([dict(row) for row in get_student_subjects(student_id)])

@app.route("/timetable/<student_id>")
def timetable(student_id):

    timetable = get_timetable(student_id)

    return jsonify([dict(row) for row in timetable])

if __name__ == "__main__":
    app.run(debug=True)
