import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./dashboard.css";

function toMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const GRADE_POINTS = { NA: 0, A: 2, M: 3, E: 4 };

function Dashboard() {
  const firstName = localStorage.getItem("firstName") || "Student";
  const [user, setUser] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [standards, setStandards] = useState([]);
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
      fetch(`/ncea/${encodeURIComponent(studentId)}`, options),
    ])
      .then(async ([userResponse, timetableResponse, standardsResponse]) => {
        if (!userResponse.ok || !timetableResponse.ok || !standardsResponse.ok) {
          throw new Error("Could not load dashboard");
        }
        return Promise.all([userResponse.json(), timetableResponse.json(), standardsResponse.json()]);
      })
      .then(([userData, timetableData, standardData]) => {
        if (!userData.success) throw new Error("Student not found");
        setUser(userData);
        setTimetable(timetableData);
        setStandards(standardData);
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

  const nceaScores = useMemo(() => {
    const recorded = standards.filter((standard) => standard.grade);
    const attemptedCredits = recorded.reduce((sum, standard) => sum + standard.credits, 0);
    const weightedPoints = recorded.reduce((sum, standard) => sum + GRADE_POINTS[standard.grade] * standard.credits, 0);
    const gpa = attemptedCredits ? weightedPoints / attemptedCredits : 0;
    const grouped = standards
      .filter((standard) => standard.ue_approved && (standard.course_level === 3 || standard.course_level === 23) && ["A", "M", "E"].includes(standard.grade))
      .reduce((groups, standard) => ({ ...groups, [standard.course_id]: [...(groups[standard.course_id] || []), standard] }), {});
    const rankCredits = Object.values(grouped).flatMap((items) => items
      .flatMap((standard) => Array(standard.credits).fill(GRADE_POINTS[standard.grade]))
      .sort((first, second) => second - first)
      .slice(0, 24))
      .sort((first, second) => second - first)
      .slice(0, 80);
    return { gpa, attemptedCredits, rankScore: rankCredits.reduce((sum, points) => sum + points, 0), rankCredits: rankCredits.length };
  }, [standards]);

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
          <span>Estimated rank score</span>
          <strong className="score-number">{nceaScores.rankScore}</strong>
          <small>{nceaScores.rankCredits} of 80 eligible credits counted</small>
        </article>
        <article className="stat-card">
          <span>Current GPA</span>
          <strong className="score-number">{nceaScores.gpa.toFixed(2)}</strong>
          <small>{nceaScores.attemptedCredits ? `Across ${nceaScores.attemptedCredits} assessed credits` : "Add grades on the NCEA page"}</small>
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
