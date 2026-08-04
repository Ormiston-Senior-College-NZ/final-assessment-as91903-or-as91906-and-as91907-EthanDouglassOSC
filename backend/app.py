from flask import Flask, request, jsonify
from flask_cors import CORS

from database import (
    login,
    signup,
    get_courses,
    save_setup,
    get_user,
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

@app.route("/user/<student_id>")
def user(student_id):

    user = get_user(student_id)

    if not user:
        return jsonify({
            "success": False
        })

    return jsonify({
        "success": True,
        "studentId": user["student_id"],
        "firstName": user["first_name"],
        "lastName": user["last_name"],
        "yearLevel": user["year_level"],
        "learningArea": user["kainga"],
        "setupComplete": bool(user["setup_complete"])
    })

@app.route("/timetable/<student_id>")
def timetable(student_id):

    timetable = get_timetable(student_id)

    return jsonify([dict(row) for row in timetable])

if __name__ == "__main__":
    app.run(debug=True)
