/*
 * ADMINISTRATOR PAGE VARIANTS
 * Provides the administrator-specific Courses and Kāinga views that remain in
 * the role's navigation. Data comes from the existing scheduling endpoints.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./adminView.css";

const PAGE_COPY = {
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
};

function AdminView({ page }) {
  // Shared administration data and display state
  const studentId = localStorage.getItem("studentId");
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState("loading");

  // Load the school-wide datasets used across all administrator variants.
  useEffect(() => {
    const headers = { "X-Student-ID": studentId };
    const controller = new AbortController();
    const options = { headers, signal: controller.signal };

    Promise.all([
      fetch("/courses", { signal: controller.signal }),
      fetch("/admin/scheduling", options),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error();
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([courseData, schedulingData]) => {
        setCourses(courseData);
        setTeachers(schedulingData.teachers);
        setAssignments(schedulingData.assignments);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, [studentId]);

  const copy = PAGE_COPY[page] || PAGE_COPY.courses;

  if (status === "loading")
    return <div className="admin-view-state">Loading administration data…</div>;
  if (status === "error")
    return (
      <div className="admin-view-state error">
        Could not load administration data.
      </div>
    );

  return (
    <main className="admin-view-page">
      <header className="admin-view-heading">
        <div>
          <h1>{copy[1]}</h1>
          <p>{copy[2]}</p>
        </div>
        <Link to="/admin">Open admin workspace →</Link>
      </header>

      {page === "courses" && <AdminCourses courses={courses} assignments={assignments} />}
      {page === "kainga" && <AdminKainga teachers={teachers} />}
    </main>
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

export default AdminView;
