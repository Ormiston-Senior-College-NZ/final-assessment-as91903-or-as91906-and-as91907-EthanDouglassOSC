/*
 * LOGIN AND REGISTRATION PAGE
 * Maintains both forms, validates new passwords, calls the authentication APIs,
 * stores returned student/session details, and routes users according to their
 * administrator role and first-time setup status.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

// Present signup names consistently before they are sent to the server.
function toNameCase(value) {
  return value
    .trim()
    .toLocaleLowerCase("en-NZ")
    .replace(/(^|[\s'-])([^\s'-])/gu, (match, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase("en-NZ")}`,
    );
}

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
        localStorage.setItem("authToken", data.token);
        localStorage.setItem(
          "accountType",
          data.accountType || (data.isAdmin ? "admin" : "student"),
        );
        localStorage.setItem("studentId", data.studentId);
        localStorage.setItem("firstName", data.firstName);
        localStorage.setItem("lastName", data.lastName);
        localStorage.setItem("isAdmin", String(data.isAdmin));
        localStorage.setItem("setupComplete", String(data.setupComplete !== false));

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
          firstName: toNameCase(firstName),
          lastName: toNameCase(lastName),
          password: signupPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("accountType", "student");
        localStorage.setItem("studentId", data.studentId);
        localStorage.setItem("firstName", data.firstName);
        localStorage.setItem("lastName", data.lastName);
        localStorage.setItem("isAdmin", "false");
        localStorage.setItem("setupComplete", "false");
        navigate("/setup");
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
        <img className="login-school-logo" src="/osc-logo.jpeg" alt="Ormiston Senior College" />


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
            <label htmlFor="login-identifier">Student ID or staff login</label>
            <input
              id="login-identifier"
              type="text"
              placeholder="Student ID or Teacher code"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />

            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
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
            <label htmlFor="signup-first-name">First name</label>
            <input
              id="signup-first-name"
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <label htmlFor="signup-last-name">Last name</label>
            <input
              id="signup-last-name"
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <label htmlFor="signup-student-id">Student ID</label>
            <input
              id="signup-student-id"
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

            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              placeholder="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
            />

            <label htmlFor="signup-confirm-password">Confirm password</label>
            <input
              id="signup-confirm-password"
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
