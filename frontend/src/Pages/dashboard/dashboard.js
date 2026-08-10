/*
 * DASHBOARD PAGE
 * Loads timetable and NCEA records, derives today's/next lessons, calculates
 * weighted GPA and rank score, groups subject information, and renders the
 * student's high-level academic overview.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import "./dashboard.css";

function toMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const GRADE_POINTS = { NA: 0, A: 2, M: 3, E: 4 };

function StudentDashboard() {
  // Student data and loading state
  const [user, setUser] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [standards, setStandards] = useState([]);
  const [tutorialBookings, setTutorialBookings] = useState([]);
  const [status, setStatus] = useState("loading");
  const now = useMemo(() => new Date(), []);

  // Load the timetable and NCEA results shown in the overview.
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
      fetch(`/tutorials/student/${encodeURIComponent(studentId)}`, options),
    ])
      .then(async ([userResponse, timetableResponse, standardsResponse, tutorialsResponse]) => {
        if (
          !userResponse.ok ||
          !timetableResponse.ok ||
          !standardsResponse.ok ||
          !tutorialsResponse.ok
        ) {
          throw new Error("Could not load dashboard");
        }
        return Promise.all([
          userResponse.json(),
          timetableResponse.json(),
          standardsResponse.json(),
          tutorialsResponse.json(),
        ]);
      })
      .then(([userData, timetableData, standardData, tutorialData]) => {
        if (!userData.success) throw new Error("Student not found");
        setUser(userData);
        setTimetable(timetableData);
        setStandards(standardData);
        setTutorialBookings(tutorialData.bookings || []);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, []);

  // Timetable and achievement summaries
  const todayLessons = useMemo(
    () => timetable.filter((lesson) => lesson.day === now.getDay()),
    [timetable, now],
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
    return (
      todayLessons.find((lesson) => toMinutes(lesson.start_time) > minutes) ||
      null
    );
  }, [todayLessons, now]);

  const nceaScores = useMemo(() => {
    const recorded = standards.filter((standard) => standard.grade);
    const attemptedCredits = recorded.reduce(
      (sum, standard) => sum + standard.credits,
      0,
    );
    const weightedPoints = recorded.reduce(
      (sum, standard) => sum + GRADE_POINTS[standard.grade] * standard.credits,
      0,
    );
    const gpa = attemptedCredits ? weightedPoints / attemptedCredits : 0;
    const grouped = standards
      .filter(
        (standard) =>
          standard.ue_approved &&
          (standard.course_level === 3 || standard.course_level === 23) &&
          ["A", "M", "E"].includes(standard.grade),
      )
      .reduce(
        (groups, standard) => ({
          ...groups,
          [standard.course_id]: [
            ...(groups[standard.course_id] || []),
            standard,
          ],
        }),
        {},
      );
    const rankCredits = Object.values(grouped)
      .flatMap((items) =>
        items
          .flatMap((standard) =>
            Array(standard.credits).fill(GRADE_POINTS[standard.grade]),
          )
          .sort((first, second) => second - first)
          .slice(0, 24),
      )
      .sort((first, second) => second - first)
      .slice(0, 80);
    return {
      gpa,
      attemptedCredits,
      rankScore: rankCredits.reduce((sum, points) => sum + points, 0),
      rankCredits: rankCredits.length,
    };
  }, [standards]);

  // Find the student's nearest upcoming Tuesday or Friday tutorial booking.
  const nextTutorial = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return tutorialBookings
      .filter((booking) => new Date(`${booking.tutorial_date}T12:00:00`) >= today)
      .sort((first, second) => first.tutorial_date.localeCompare(second.tutorial_date))[0] || null;
  }, [tutorialBookings, now]);

  const nextTutorialDate = useMemo(() => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (date.getDay() !== 2 && date.getDay() !== 5) date.setDate(date.getDate() + 1);
    return date;
  }, [now]);

  if (status === "loading") {
    return <div className="dashboard-state">Loading your dashboard…</div>;
  }

  if (status === "signed-out") {
    return (
      <div className="dashboard-state">Log in to view your dashboard.</div>
    );
  }

  if (status === "error") {
    return (
      <div className="dashboard-state error">
        Your dashboard could not be loaded. Check that the backend is running.
      </div>
    );
  }

  // Dashboard layout
  return (
    <main className="dashboard">
      <header className="dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>
            {now.toLocaleDateString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
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
          <small>
            {nceaScores.attemptedCredits
              ? `Across ${nceaScores.attemptedCredits} assessed credits`
              : "Add grades on the NCEA page"}
          </small>
        </article>
        <article className="stat-card">
          <span>Next up</span>
          <strong className="stat-text">
            {nextLesson ? nextLesson.name : "All done"}
          </strong>
          <small>
            {nextLesson
              ? `${nextLesson.start_time}–${nextLesson.end_time}`
              : "No more classes today"}
          </small>
        </article>
        <article className="stat-card tutorial-summary-card">
          <div className="tutorial-summary-heading">
            <span>Next tutorial</span>
            <Link to="/tutorials">View →</Link>
          </div>
          <strong className="stat-text">
            {nextTutorial ? nextTutorial.learning_area : "Not booked"}
          </strong>
          <small>
            {nextTutorial
              ? `${new Date(`${nextTutorial.tutorial_date}T12:00:00`).toLocaleDateString("en-NZ", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })} · ${nextTutorial.status}`
              : `${nextTutorialDate.toLocaleDateString("en-NZ", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })} · Submit your destination`}
          </small>
          {nextTutorial?.status === "denied" && (
            <small className="tutorial-denied-note">
              Please talk to your Learning Advisor.
            </small>
          )}
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
                <article
                  className="lesson-row"
                  key={`${lesson.day}-${lesson.session}`}
                >
                  <div className="lesson-time">
                    <strong>{lesson.start_time}</strong>
                    <span>{lesson.end_time}</span>
                  </div>
                  <div className="lesson-details">
                    <strong>{lesson.name}</strong>
                    <span>{lesson.teacher || "Teacher to be confirmed"}</span>
                  </div>
                  <div className="lesson-room">
                    {lesson.room_name || lesson.room || "Room TBC"}
                  </div>
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
                  <div>
                    <strong>{subject.name}</strong>
                    <small>
                      {subject.code}
                      {subject.teacher_code
                        ? ` · ${subject.teacher_code}`
                        : " · Teacher TBC"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Dashboard() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <Navigate to="/admin" replace />
  ) : (
    <StudentDashboard />
  );
}

export default Dashboard;
