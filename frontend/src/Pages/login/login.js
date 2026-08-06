/*
 * LOGIN AND REGISTRATION PAGE
 * Maintains both forms, validates new passwords, calls the authentication APIs,
 * stores returned student/session details, and routes users according to their
 * administrator role and first-time setup status.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

function Login() {
  // Login/register form state
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

  // Authenticate an existing student and route them to the correct page.
  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    try {
      const response = await fetch("/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          username: studentId,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem(
          "accountType",
          data.accountType || (data.isAdmin ? "admin" : "student"),
        );
        localStorage.setItem("studentId", data.studentId);
        localStorage.setItem("firstName", data.firstName);
        localStorage.setItem("lastName", data.lastName);
        localStorage.setItem("isAdmin", String(data.isAdmin));

        if (data.accountType === "teacher") {
          localStorage.removeItem("studentId");
          localStorage.setItem("teacherId", String(data.teacherId));
          localStorage.setItem("teacherCode", data.teacherCode);
          localStorage.setItem(
            "mustChangePassword",
            String(data.mustChangePassword),
          );
          navigate(
            data.mustChangePassword ? "/teacher/change-password" : "/teacher",
          );
        } else if (data.isAdmin) {
          navigate("/admin");
        } else if (data.setupComplete) {
          navigate("/dashboard");
        } else {
          navigate("/setup");
        }
      } else {
        setError("Invalid student ID, teacher code/name, or password.");
      }
    } catch {
      setError("Cannot connect to the server.");
    }
  };

  // =====================================================
  // SIGN UP
  // =====================================================

  // Create a student account before sending them through initial setup.
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
      const response = await fetch("/signup", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          studentId: signupStudentId,
          firstName: firstName,
          lastName: lastName,
          password: signupPassword,
        }),
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

  // Authentication page layout
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
              placeholder="Student ID, teacher code, or teacher name"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}

            <button type="submit">Log In</button>
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
                setSignupStudentId(e.target.value.replace(/^st/i, ""))
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

            <button type="submit">Create Account</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
