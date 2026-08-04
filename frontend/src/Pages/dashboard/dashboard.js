import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./dashboard.css";

function toMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function Dashboard() {
  const firstName = localStorage.getItem("firstName") || "Student";
  const [user, setUser] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [status, setStatus] = useState("loading");
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const studentId = localStorage.getItem("studentId");
    if (!studentId) {
      setStatus("signed-out");
      return;
    }

    const controller = new AbortController();
    const options = { signal: controller.signal };

    Promise.all([
      fetch(`/user/${encodeURIComponent(studentId)}`, options),
      fetch(`/timetable/${encodeURIComponent(studentId)}`, options),
    ])
      .then(async ([userResponse, timetableResponse]) => {
        if (!userResponse.ok || !timetableResponse.ok) {
          throw new Error("Could not load dashboard");
        }
        return Promise.all([userResponse.json(), timetableResponse.json()]);
      })
      .then(([userData, timetableData]) => {
        if (!userData.success) throw new Error("Student not found");
        setUser(userData);
        setTimetable(timetableData);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, []);

  const todayLessons = useMemo(
    () => timetable.filter((lesson) => lesson.day === now.getDay()),
    [timetable, now]
  );

  const subjects = useMemo(() => {
    const unique = new Map();
    timetable.forEach((lesson) => {
      if (lesson.session !== 6 && !unique.has(lesson.code)) {
        unique.set(lesson.code, lesson);
      }
    });
    return [...unique.values()].sort((a, b) => a.line - b.line);
  }, [timetable]);

  const nextLesson = useMemo(() => {
    const minutes = now.getHours() * 60 + now.getMinutes();
    return todayLessons.find((lesson) => toMinutes(lesson.end_time) > minutes) || null;
  }, [todayLessons, now]);

  if (status === "loading") {
    return <div className="dashboard-state">Loading your dashboard…</div>;
  }

  if (status === "signed-out") {
    return <div className="dashboard-state">Log in to view your dashboard.</div>;
  }

  if (status === "error") {
    return <div className="dashboard-state error">Your dashboard could not be loaded. Check that the backend is running.</div>;
  }

  return (
    <main className="dashboard">
      <header className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">Student overview</span>
          <h1>Welcome back, {firstName}</h1>
          <p>{now.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="student-summary">
          <span>Year {user.yearLevel || "—"}</span>
          <strong>{user.learningArea || "Kāinga not set"}</strong>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Student summary">
        <article className="stat-card accent">
          <span>Today’s classes</span>
          <strong>{todayLessons.length}</strong>
          <small>{todayLessons.length ? "Including LA / iTime" : "No classes today"}</small>
        </article>
        <article className="stat-card">
          <span>My subjects</span>
          <strong>{subjects.length}</strong>
          <small>Across five timetable lines</small>
        </article>
        <article className="stat-card">
          <span>Next up</span>
          <strong className="stat-text">{nextLesson ? nextLesson.name : "All done"}</strong>
          <small>{nextLesson ? `${nextLesson.start_time}–${nextLesson.end_time}` : "No more classes today"}</small>
        </article>
      </section>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel schedule-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-label">Today</span>
              <h2>My schedule</h2>
            </div>
            <Link to="/timetable">Full timetable →</Link>
          </div>

          {todayLessons.length === 0 ? (
            <div className="panel-empty">No classes scheduled today.</div>
          ) : (
            <div className="lesson-list">
              {todayLessons.map((lesson) => (
                <article className="lesson-row" key={`${lesson.day}-${lesson.session}`}>
                  <div className="lesson-time">
                    <strong>{lesson.start_time}</strong>
                    <span>{lesson.end_time}</span>
                  </div>
                  <span className="lesson-line">{lesson.session}</span>
                  <div className="lesson-details">
                    <strong>{lesson.name}</strong>
                    <span>{lesson.teacher || "Teacher to be confirmed"}</span>
                  </div>
                  <div className="lesson-room">{lesson.room_name || lesson.room || "Room TBC"}</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="dashboard-side">
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-label">Courses</span>
                <h2>My subjects</h2>
              </div>
            </div>
            <div className="subject-list">
              {subjects.map((subject) => (
                <div className="subject-row" key={subject.code}>
                  <span className="subject-line-number">{subject.line}</span>
                  <div><strong>{subject.name}</strong><small>{subject.code}</small></div>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-panel notice-panel">
            <span className="panel-label">Notices</span>
            <h2>You’re all caught up</h2>
            <p>There are no new school notices at the moment.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default Dashboard;
