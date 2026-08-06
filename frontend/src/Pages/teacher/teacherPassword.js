/* First-login and later password-change form for teacher accounts. */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "./teacherPassword.css";

function TeacherPassword() {
  const navigate = useNavigate();
  const teacherId = localStorage.getItem("teacherId");
  const firstLogin = localStorage.getItem("mustChangePassword") === "true";
  const [currentPassword, setCurrentPassword] = useState(
    firstLogin ? "osc" : "",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  if (localStorage.getItem("accountType") !== "teacher")
    return <Navigate to="/" replace />;
  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirm) return setError("New passwords do not match.");
    const response = await fetch(`/teacher/${teacherId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword: password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success)
      return setError(data.message || "Password could not be changed.");
    localStorage.setItem("mustChangePassword", "false");
    navigate("/teacher");
  };
  return (
    <main className="teacher-password-page">
      <form onSubmit={submit}>
        <span>Teacher account security</span>
        <h1>{firstLogin ? "Create your password" : "Change password"}</h1>
        <p>
          {firstLogin
            ? "Your temporary password is osc. Choose a private password before opening your dashboard."
            : "Enter your current password and choose a replacement."}
        </p>
        {!firstLogin && (
          <label>
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
        )}
        <label>
          <span>New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength="3"
            required
          />
          <small>Use at least 3 characters.</small>
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>
        {error && <p className="teacher-password-error">{error}</p>}
        <button type="submit">Save password and continue</button>
      </form>
    </main>
  );
}
export default TeacherPassword;
