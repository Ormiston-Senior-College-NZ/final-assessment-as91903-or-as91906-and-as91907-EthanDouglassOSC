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
    get_timetable
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
            "level": course["level"]
        })

    return jsonify(data)


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

    save_setup(
        student_id,
        year_level,
        learning_area,
        subjects
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
