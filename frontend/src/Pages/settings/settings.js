/*
 * SETTINGS PAGE
 * Loads and edits student identity, year, Kāinga, LA teacher, and five course
 * lines; signs out; and submits or cancels an
 * administrator-reviewed account-deletion request.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import ConfirmDialog from "../../Components/confirmDialog";
import "./settings.css";

const KAINGAS = ["Pūngāwerewere", "Pūkeko", "Mokoroa", "Kea"];

function StudentSettings() {
  // Profile, course, and deletion-request state
  const navigate = useNavigate();
  const studentId = localStorage.getItem("studentId");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    yearLevel: "",
    learningArea: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    subjects: ["", "", "", "", ""],
  });
  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [deletionRequest, setDeletionRequest] = useState(null);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  // Load the student's account and all editable selection options.
  useEffect(() => {
    if (!studentId) {
      setStatus("signed-out");
      return;
    }

    const controller = new AbortController();
    Promise.all([
      fetch(`/user/${encodeURIComponent(studentId)}`, {
        signal: controller.signal,
      }),
      fetch(`/subjects/${encodeURIComponent(studentId)}`, {
        signal: controller.signal,
      }),
      fetch("/courses", { signal: controller.signal }),
      fetch(`/account-deletion/${encodeURIComponent(studentId)}`, {
        signal: controller.signal,
      }),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok))
          throw new Error("Could not load account");
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([data, subjectData, courseData, deletionData]) => {
        if (!data.success) throw new Error("Student not found");
        const selectedSubjects = ["", "", "", "", ""];
        subjectData.forEach((subject) => {
          selectedSubjects[subject.line - 1] = String(subject.id);
        });
        setForm((current) => ({
          ...current,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          yearLevel: String(data.yearLevel || ""),
          learningArea: data.learningArea || "",
          subjects: selectedSubjects,
        }));
        setCourses(courseData);
        setDeletionRequest(deletionData.request);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, [studentId]);

  // Profile and timetable selection actions
  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const save = async (event) => {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      setStatus("form-error");
      setMessage("New passwords do not match.");
      return;
    }

    if (form.newPassword && !form.currentPassword) {
      setStatus("form-error");
      setMessage("Enter your current password to choose a new one.");
      return;
    }

    if (form.subjects.some((subject) => !subject)) {
      setStatus("form-error");
      setMessage("Select one subject for every timetable line.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`/user/${encodeURIComponent(studentId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          yearLevel: Number(form.yearLevel),
          learningArea: form.learningArea,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          subjects: form.subjects,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Account settings could not be saved.");
      }

      localStorage.setItem("firstName", form.firstName.trim());
      localStorage.setItem("lastName", form.lastName.trim());
      window.dispatchEvent(new Event("studentnet-profile-updated"));
      setForm((current) => ({
        ...current,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setStatus("ready");
      setMessage(data.message);
    } catch (error) {
      setStatus("form-error");
      setMessage(error.message);
    }
  };

  const updateSubject = (lineIndex, courseId) => {
    setForm((current) => {
      const subjects = [...current.subjects];
      subjects[lineIndex] = courseId;
      return { ...current, subjects };
    });
    setMessage("");
  };

  const filteredCourses = courses.filter((course) => {
    const yearLevel = Number(form.yearLevel);
    if (yearLevel === 11) return course.level === 1;
    if (yearLevel === 12)
      return course.level === 2 || course.level === 3 || course.level === 23;
    if (yearLevel === 13) return course.level === 3 || course.level === 23;
    return false;
  });

  // Account and deletion-request actions
  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("accountType");
    localStorage.removeItem("studentId");
    localStorage.removeItem("firstName");
    localStorage.removeItem("lastName");
    localStorage.removeItem("isAdmin");
    navigate("/");
  };

  const requestDeletion = () => {
    setConfirmation({
      message: "Send an account deletion request to an administrator? Your account remains active until it is approved.",
      action: async () => {
        setDeletionBusy(true);
        try {
          const response = await fetch(
            `/account-deletion/${encodeURIComponent(studentId)}`,
            { method: "POST" },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          const statusResponse = await fetch(
            `/account-deletion/${encodeURIComponent(studentId)}`,
          );
          setDeletionRequest((await statusResponse.json()).request);
          setMessage(data.message);
        } catch (error) {
          setMessage(error.message || "Could not send the deletion request.");
        } finally {
          setDeletionBusy(false);
        }
      },
    });
  };

  const cancelDeletion = async () => {
    setDeletionBusy(true);
    try {
      const response = await fetch(
        `/account-deletion/${encodeURIComponent(studentId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setDeletionRequest(null);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message || "Could not cancel the request.");
    } finally {
      setDeletionBusy(false);
    }
  };

  if (status === "loading")
    return <div className="settings-state">Loading account settings…</div>;
  if (status === "signed-out")
    return <div className="settings-state">Log in to edit your account.</div>;
  if (status === "error")
    return (
      <div className="settings-state error">
        Your account settings could not be loaded.
      </div>
    );

  // Settings page layout
  return (
    <main className="settings-page">
      <header className="settings-heading">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile and sign-in details.</p>
        </div>
        <div className="settings-avatar">
          {(form.firstName[0] || "S").toUpperCase()}
          {(form.lastName[0] || "").toUpperCase()}
        </div>
      </header>

      <form onSubmit={save}>
        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <span>Profile</span>
              <h2>Personal information</h2>
            </div>
            <p>Your name appears throughout StudentNET.</p>
          </div>
          <div className="settings-form-grid">
            <label>
              <span>First name</span>
              <input
                name="firstName"
                value={form.firstName}
                onChange={updateField}
                required
              />
            </label>
            <label>
              <span>Last name</span>
              <input
                name="lastName"
                value={form.lastName}
                onChange={updateField}
                required
              />
            </label>
            <label>
              <span>Student ID</span>
              <input value={studentId || ""} disabled />
              <small>Student IDs cannot be changed.</small>
            </label>
            <label>
              <span>School email</span>
              <input value={form.email} disabled />
            </label>
            <label>
              <span>Year level</span>
              <select
                name="yearLevel"
                value={form.yearLevel}
                onChange={updateField}
                required
              >
                <option value="">Select year</option>
                <option value="11">Year 11</option>
                <option value="12">Year 12</option>
                <option value="13">Year 13</option>
              </select>
            </label>
            <label>
              <span>Kāinga</span>
              <select
                name="learningArea"
                value={form.learningArea}
                onChange={updateField}
                required
              >
                <option value="">Select Kāinga</option>
                {KAINGAS.map((kainga) => (
                  <option value={kainga} key={kainga}>
                    {kainga}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <span>Timetable</span>
              <h2>My subjects</h2>
            </div>
            <p>Choose one different subject for each timetable line.</p>
          </div>
          <div className="settings-subject-grid">
            {[1, 2, 3, 4, 5].map((line, index) => (
              <label key={line}>
                <span className="settings-line-number">{line}</span>
                <span className="settings-line-copy">
                  <strong>Line {line}</strong>
                  <small>
                    {
                      [
                        "Mon 09:00–10:30",
                        "Mon 10:50–12:20",
                        "Mon 13:40–14:30",
                        "Mon 14:35–15:25",
                        "Tue 10:50–12:20",
                      ][index]
                    }
                  </small>
                </span>
                <select
                  value={form.subjects[index]}
                  onChange={(event) => updateSubject(index, event.target.value)}
                  required
                >
                  <option value="">Select subject</option>
                  {filteredCourses
                    .filter(
                      (course) =>
                        !form.subjects.includes(String(course.id)) ||
                        form.subjects[index] === String(course.id),
                    )
                    .map((course) => (
                      <option value={course.id} key={course.id}>
                        {course.name} ({course.code})
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <span>Security</span>
              <h2>Change password</h2>
            </div>
            <p>Leave these fields empty to keep your current password.</p>
          </div>
          <div className="settings-form-grid password-grid">
            <label>
              <span>Current password</span>
              <input
                type="password"
                name="currentPassword"
                value={form.currentPassword}
                onChange={updateField}
                autoComplete="current-password"
              />
            </label>
            <label>
              <span>New password</span>
              <input
                type="password"
                name="newPassword"
                value={form.newPassword}
                onChange={updateField}
                minLength="6"
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={updateField}
                minLength="6"
                autoComplete="new-password"
              />
            </label>
          </div>
        </section>

        <section className="settings-card danger-zone">
          <div className="settings-card-heading">
            <div>
              <span>Account deletion</span>
              <h2>Delete my account</h2>
            </div>
            <p>An administrator must approve your request.</p>
          </div>
          <div className="deletion-request-row">
            <div>
              <strong>
                {deletionRequest?.status === "pending"
                  ? "Request awaiting review"
                  : deletionRequest?.status === "denied"
                    ? "Previous request denied"
                    : "Request account deletion"}
              </strong>
              <p>
                {deletionRequest?.status === "pending"
                  ? "Your account remains active while an administrator reviews your request."
                  : deletionRequest?.status === "denied"
                    ? "An administrator denied your previous request. You may submit another if needed."
                    : "This sends a request to the admin team. Nothing is deleted immediately."}
              </p>
            </div>
            {deletionRequest?.status === "pending" ? (
              <button
                type="button"
                className="cancel-deletion-button"
                onClick={cancelDeletion}
                disabled={deletionBusy}
              >
                Cancel request
              </button>
            ) : (
              <button
                type="button"
                className="request-deletion-button"
                onClick={requestDeletion}
                disabled={deletionBusy}
              >
                {deletionBusy ? "Sending…" : "Request deletion"}
              </button>
            )}
          </div>
        </section>

        <div className="settings-actions">
          <div
            className={`settings-message ${status === "form-error" ? "error" : ""}`}
            role="status"
          >
            {message}
          </div>
          <button type="button" className="logout-button" onClick={logout}>
            Log out
          </button>
          <button
            type="submit"
            className="save-button"
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      {confirmation && (
        <ConfirmDialog
          title="Request account deletion"
          message={confirmation.message}
          confirmLabel="Send request"
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.action;
            setConfirmation(null);
            action();
          }}
        />
      )}
    </main>
  );
}

function Settings() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <Navigate to="/admin" replace />
  ) : (
    <StudentSettings />
  );
}

export default Settings;
