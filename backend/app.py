
from flask import Flask, request, jsonify
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return jsonify({"message": "Flask is working"})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    # Example login check
    if username == "test" and password == "test":
        return jsonify({
            "success": True,
            "name": "Admin"
        })

    return jsonify({
        "success": False
    })

if __name__ == "__main__":
    app.run(debug=True)