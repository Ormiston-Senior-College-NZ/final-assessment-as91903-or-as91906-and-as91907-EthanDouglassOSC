/*
 * ADMINISTRATOR PAGE VARIANTS
 * Provides school-wide versions of the shared Dashboard, Timetable, NCEA,
 * Courses, Kāinga, and Settings routes. Data comes from the existing admin
 * scheduling endpoints and is presented differently for each requested page.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./adminView.css";

const PAGE_COPY = {
  dashboard: [
    "Administration overview",
    "Dashboard",
    "A school-wide view of courses, staffing, spaces, and requests.",
  ],
  timetable: [
    "Master schedule",
    "Timetable",
    "Review every scheduled class by timetable line.",
  ],
  ncea: [
    "NCEA administration",
    "NCEA",
    "Review the curriculum catalogue available for student achievement tracking.",
  ],
  courses: [
    "Curriculum management",
    "Courses",
    "Review the complete course catalogue by curriculum area and level.",
  ],
  kainga: [
    "Staff communities",
    "Kāinga",
    "View teaching staff grouped by their Kāinga.",
  ],
  settings: [
    "Administrator account",
    "Settings",
    "Manage your local appearance and administration shortcuts.",
  ],
};

function AdminView({ page }) {
  // Shared administration data and display state
  const navigate = useNavigate();
  const studentId = localStorage.getItem("studentId");
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  const [status, setStatus] = useState("loading");

  // Load the school-wide datasets used across all administrator variants.
  useEffect(() => {
    const headers = { "X-Student-ID": studentId };
    const controller = new AbortController();
    const options = { headers, signal: controller.signal };

    Promise.all([
      fetch("/courses", { signal: controller.signal }),
      fetch("/admin/scheduling", options),
      fetch("/admin/account-deletions", options),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error();
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([courseData, schedulingData, requestData]) => {
        setCourses(courseData);
        setTeachers(schedulingData.teachers);
        setRooms(schedulingData.rooms);
        setAssignments(schedulingData.assignments);
        setRequests(requestData);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, [studentId]);

  // Lookup maps and grouped records shared by the page variants.
  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const teacherMap = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  );
  const roomMap = useMemo(
    () => new Map(rooms.map((room) => [room.id, room])),
    [rooms],
  );
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  );
  const copy = PAGE_COPY[page] || PAGE_COPY.dashboard;

  if (status === "loading")
    return <div className="admin-view-state">Loading administration data…</div>;
  if (status === "error")
    return (
      <div className="admin-view-state error">
        Could not load administration data.
      </div>
    );

  const context = {
    courses,
    teachers,
    rooms,
    assignments,
    pendingRequests,
    courseMap,
    teacherMap,
    roomMap,
  };

  return (
    <main className="admin-view-page">
      <header className="admin-view-heading">
        <div>
          <span>{copy[0]}</span>
          <h1>{copy[1]}</h1>
          <p>{copy[2]}</p>
        </div>
        <Link to="/admin">Open admin workspace →</Link>
      </header>

      {page === "dashboard" && <AdminDashboard {...context} />}
      {page === "timetable" && <AdminTimetable {...context} />}
      {page === "ncea" && <AdminNcea {...context} />}
      {page === "courses" && <AdminCourses {...context} />}
      {page === "kainga" && <AdminKainga {...context} />}
      {page === "settings" && (
        <AdminSettings
          darkMode={darkMode}
          onThemeChange={() => {
            const next = !darkMode;
            setDarkMode(next);
            document.body.classList.toggle("dark-mode", next);
            localStorage.setItem("theme", next ? "dark" : "light");
          }}
          onLogout={() => {
            localStorage.clear();
            navigate("/");
          }}
        />
      )}
    </main>
  );
}

function AdminDashboard({
  courses,
  teachers,
  rooms,
  assignments,
  pendingRequests,
}) {
  const stats = [
    [courses.length, "Courses"],
    [assignments.length, "Scheduled classes"],
    [teachers.length, "Teachers"],
    [rooms.length, "Learning spaces"],
  ];
  return (
    <>
      <section className="admin-view-stats">
        {stats.map(([value, label]) => (
          <article key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      <section className="admin-view-panel">
        <h2>Attention needed</h2>
        <p>
          {pendingRequests.length
            ? `${pendingRequests.length} account deletion request${pendingRequests.length === 1 ? "" : "s"} waiting for review.`
            : "There are no pending account deletion requests."}
        </p>
        <Link to="/admin">Review administration tasks</Link>
      </section>
    </>
  );
}

function AdminTimetable({ assignments, courseMap, teacherMap, roomMap }) {
  return (
    <section className="admin-line-grid">
      {[1, 2, 3, 4, 5].map((line) => {
        const items = assignments.filter((item) => item.line === line);
        return (
          <article key={line}>
            <header>
              <span>Timetable</span>
              <strong>Line {line}</strong>
              <small>{items.length} classes</small>
            </header>
            <div>
              {items.length ? (
                items.map((item) => {
                  const course = courseMap.get(item.course_id);
                  return (
                    <div className="admin-line-class" key={item.course_id}>
                      <b>{course?.code || "—"}</b>
                      <span>{course?.name || "Unknown course"}</span>
                      <small>
                        {teacherMap.get(item.teacher_id)?.name || "No teacher"}{" "}
                        ·{" "}
                        {roomMap.get(item.room_id)?.code ||
                          item.area ||
                          "No room"}
                      </small>
                    </div>
                  );
                })
              ) : (
                <p>No classes assigned.</p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AdminNcea({ courses }) {
  const levels = [1, 2, 3].map((level) => ({
    level,
    count: courses.filter(
      (course) => course.level === level || (course.level === 23 && level > 1),
    ).length,
  }));
  return (
    <>
      <section className="admin-view-stats">
        {levels.map(({ level, count }) => (
          <article key={level}>
            <strong>{count}</strong>
            <span>Level {level} courses</span>
          </article>
        ))}
      </section>
      <section className="admin-view-panel">
        <h2>Student achievement records</h2>
        <p>
          Students select standards and record grades from their own NCEA page.
          Administrators manage the courses those standards are connected to.
        </p>
        <Link to="/admin">Manage the course catalogue</Link>
      </section>
    </>
  );
}

function AdminCourses({ courses, assignments }) {
  const groups = Object.entries(
    courses.reduce(
      (result, course) => ({
        ...result,
        [course.category]: [...(result[course.category] || []), course],
      }),
      {},
    ),
  ).sort(([a], [b]) => a.localeCompare(b));
  const scheduled = new Set(assignments.map((item) => item.course_id));
  return (
    <section className="admin-category-grid">
      {groups.map(([category, items]) => (
        <article key={category}>
          <header>
            <h2>{category}</h2>
            <span>{items.length} courses</span>
          </header>
          <div>
            {items.map((course) => (
              <div key={course.id}>
                <b>{course.code}</b>
                <span>{course.name}</span>
                <small>
                  {course.level === 23
                    ? "Levels 2 & 3"
                    : `Level ${course.level}`}{" "}
                  · {scheduled.has(course.id) ? "Scheduled" : "Not scheduled"}
                </small>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function AdminKainga({ teachers }) {
  const roleOrder = { "Deputy Principal": 0, "Kāinga Leader": 1, Teacher: 2 };
  const groups = Object.entries(
    teachers.reduce(
      (result, teacher) => ({
        ...result,
        [teacher.kainga || "Other staff"]: [
          ...(result[teacher.kainga || "Other staff"] || []),
          teacher,
        ],
      }),
      {},
    ),
  ).sort(([a], [b]) => a.localeCompare(b, "mi"));

  const StaffRow = ({ teacher }) => (
    <div className="kainga-staff-row">
      <b>{teacher.code}</b>
      <div>
        <strong>{teacher.name}</strong>
        <small>{teacher.role}</small>
      </div>
    </div>
  );

  return (
    <>
      <section className="kainga-overview" aria-label="Kāinga staff summary">
        <div>
          <strong>{groups.length}</strong>
          <span>Kāinga groups</span>
        </div>
        <div>
          <strong>{teachers.length}</strong>
          <span>Total staff</span>
        </div>
        <div>
          <strong>
            {teachers.filter((teacher) => teacher.role !== "Teacher").length}
          </strong>
          <span>Leadership staff</span>
        </div>
      </section>

      <section className="kainga-admin-grid">
        {groups.map(([kainga, unsortedStaff]) => {
          const staff = [...unsortedStaff].sort(
            (a, b) =>
              (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3) ||
              a.name.localeCompare(b.name),
          );
          const leaders = staff.filter((teacher) => teacher.role !== "Teacher");
          const teachingStaff = staff.filter(
            (teacher) => teacher.role === "Teacher",
          );

          return (
            <article className="kainga-card" key={kainga}>
              <header>
                <div>
                  <span>Kāinga</span>
                  <h2>{kainga}</h2>
                </div>
                <strong>
                  {staff.length}
                  <small> staff</small>
                </strong>
              </header>

              {leaders.length > 0 && (
                <section className="kainga-staff-section leadership">
                  <h3>Leadership</h3>
                  <div>
                    {leaders.map((teacher) => (
                      <StaffRow teacher={teacher} key={teacher.id} />
                    ))}
                  </div>
                </section>
              )}

              <section className="kainga-staff-section">
                <h3>
                  Teaching staff <span>{teachingStaff.length}</span>
                </h3>
                <div>
                  {teachingStaff.map((teacher) => (
                    <StaffRow teacher={teacher} key={teacher.id} />
                  ))}
                </div>
              </section>
            </article>
          );
        })}
      </section>
    </>
  );
}

function AdminSettings({ darkMode, onThemeChange, onLogout }) {
  return (
    <section className="admin-view-panel admin-settings-panel">
      <div>
        <h2>Appearance</h2>
        <p>
          Use the same saved light or dark appearance across every administrator
          page.
        </p>
      </div>
      <button type="button" onClick={onThemeChange}>
        {darkMode ? "Use light mode" : "Use dark mode"}
      </button>
      <div>
        <h2>Administration</h2>
        <p>
          Course, scheduling, staffing, room, and deletion-request controls are
          kept in the dedicated workspace.
        </p>
      </div>
      <Link to="/admin">Open admin workspace</Link>
      <div>
        <h2>Session</h2>
        <p>Sign out of this administrator account on this device.</p>
      </div>
      <button type="button" className="danger" onClick={onLogout}>
        Log out
      </button>
    </section>
  );
}

export default AdminView;
