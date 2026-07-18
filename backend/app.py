from flask import Flask, request, jsonify
from flask_cors import CORS

from database import login

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({
        "message": "Flask is working"
    })


@app.route("/login", methods=["POST"])
def login_route():

    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    user = login(username, password)

    if user:

        return jsonify({
            "success": True,
            "studentId": user["student_id"],
            "firstName": user["first_name"],
            "lastName": user["last_name"]
        })

    return jsonify({
        "success": False
    })


if __name__ == "__main__":
    app.run(debug=True)