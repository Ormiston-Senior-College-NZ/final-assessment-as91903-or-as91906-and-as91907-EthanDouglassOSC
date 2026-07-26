import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

function Login() {

    const navigate = useNavigate();

    const [mode, setMode] = useState("login");

    // -----------------------------
    // Login
    // -----------------------------

    const [studentId, setStudentId] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // -----------------------------
    // Signup
    // -----------------------------

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [signupStudentId, setSignupStudentId] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // -----------------------------

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // =====================================================
    // LOGIN
    // =====================================================

    const handleLogin = async (e) => {

        e.preventDefault();

        setError("");
        setSuccess("");

        try {

            const response = await fetch("http://127.0.0.1:5000/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    username: studentId,
                    password: loginPassword

                })

            });

            const data = await response.json();

            if (data.success) {

                localStorage.setItem("studentId", data.studentId);
                localStorage.setItem("firstName", data.firstName);
                localStorage.setItem("lastName", data.lastName);

                if (data.setupComplete) {

                    navigate("/dashboard");

                } else {

                    navigate("/setup");

                }

            } else {

                setError("Invalid Student ID or Password.");

            }

        } catch {

            setError("Cannot connect to the server.");

        }

    };

    // =====================================================
    // SIGN UP
    // =====================================================

    const handleSignup = async (e) => {

        e.preventDefault();

        setError("");
        setSuccess("");

        if (!firstName || !lastName || !signupStudentId) {

            setError("Please complete all fields.");
            return;

        }

        if (signupPassword !== confirmPassword) {

            setError("Passwords do not match.");
            return;

        }

        try {

            const response = await fetch("http://127.0.0.1:5000/signup", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    studentId: signupStudentId,
                    firstName: firstName,
                    lastName: lastName,
                    password: signupPassword

                })

            });

            const data = await response.json();

            if (data.success) {

                setSuccess("Account created successfully! Please log in.");

                setFirstName("");
                setLastName("");
                setSignupStudentId("");
                setSignupPassword("");
                setConfirmPassword("");

                setMode("login");

            } else {

                setError(data.message);

            }

        } catch {

            setError("Cannot connect to the server.");

        }

    };

    return (

        <div className="login-page">

            <div className="login-card">

                <h1>OSC StudentNET</h1>

                <div className="tabs">

                    <button
                        className={mode === "login" ? "active" : ""}
                        onClick={() => {
                            setMode("login");
                            setError("");
                            setSuccess("");
                        }}
                    >
                        Log In
                    </button>

                    <button
                        className={mode === "signup" ? "active" : ""}
                        onClick={() => {
                            setMode("signup");
                            setError("");
                            setSuccess("");
                        }}
                    >
                        Sign Up
                    </button>

                </div>

                {mode === "login" ? (

                    <form onSubmit={handleLogin}>

                        <input
                            type="text"
                            placeholder="Student ID"
                            value={studentId}
                            onChange={(e) =>
                                setStudentId(
                                    e.target.value.replace(/^st/i, "")
                                )
                            }
                        />

                        <input
                            type="password"
                            placeholder="Password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                        />

                        {error && <p className="error">{error}</p>}
                        {success && <p className="success">{success}</p>}

                        <button type="submit">

                            Log In

                        </button>

                    </form>

                ) : (

                    <form onSubmit={handleSignup}>

                        <input
                            type="text"
                            placeholder="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />

                        <input
                            type="text"
                            placeholder="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />

                        <input
                            type="text"
                            placeholder="Student ID"
                            value={signupStudentId}
                            onChange={(e) =>
                                setSignupStudentId(
                                    e.target.value.replace(/^st/i, "")
                                )
                            }
                        />

                        <p className="email-preview">

                            School Email

                            <br />

                            <strong>

                                {signupStudentId
                                    ? `st${signupStudentId}@ormiston.school.nz`
                                    : "st12345@ormiston.school.nz"}

                            </strong>

                        </p>

                        <input
                            type="password"
                            placeholder="Password"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                        />

                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />

                        {error && <p className="error">{error}</p>}
                        {success && <p className="success">{success}</p>}

                        <button type="submit">

                            Create Account

                        </button>

                    </form>

                )}

            </div>

        </div>

    );

}

export default Login;