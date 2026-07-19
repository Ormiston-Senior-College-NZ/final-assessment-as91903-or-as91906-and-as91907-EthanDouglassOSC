from flask import Flask, request, jsonify
from flask_cors import CORS

from database import login, signup

app = Flask(__name__)
CORS(app)


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

    if user:
        return jsonify({
            "success": True,
            "studentId": user["student_id"],
            "firstName": user["first_name"],
            "lastName": user["last_name"]
        })

    return jsonify({
        "success": False,
        "message": "Invalid Student ID or Password."
    })


# ==========================================
# SIGN UP
# ==========================================

@app.route("/signup", methods=["POST"])
def signup_route():

    data = request.get_json()

    email = data.get("email", "").lower().strip()
    password = data.get("password")

    first_name = data.get("firstName", "").strip()
    last_name = data.get("lastName", "").strip()

    if not email.endswith("@ormiston.school.nz"):
        return jsonify({
            "success": False,
            "message": "Please use your school email."
        })

    username = email.split("@")[0]

    if not username.startswith("st"):
        return jsonify({
            "success": False,
            "message": "Invalid school email."
        })

    student_id = username.replace("st", "")

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


if __name__ == "__main__":
    app.run(debug=True)