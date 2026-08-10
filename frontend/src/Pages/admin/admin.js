/*
 * ADMINISTRATION PAGE
 * Loads all administration datasets and provides course CRUD, timetable-line
 * assignments, multiple offerings, teacher dashboards grouped by Kāinga,
 * room placement, class deletion, and account-deletion request review.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import ConfirmDialog from "../../Components/confirmDialog";
import "./admin.css";

// Configuration and timetable labels
const EMPTY_FORM = { code: "", name: "", level: "3", category: "Mathematics" };
const LINE_DAYS = {
  1: "Mon, Tue, Thu, Fri",
  2: "Mon, Wed, Thu, Fri",
  3: "Mon, Wed, Thu, Fri",
  4: "Mon, Tue, Wed, Thu",
  5: "Tue, Wed, Thu, Fri",
};

function Admin() {
  // Session, page state, and editor state
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const studentId = localStorage.getItem("studentId");
  const adminHeaders = { "X-Student-ID": studentId };
  const [tab, setTab] = useState("scheduling");
  const [scheduleMode, setScheduleMode] = useState("class");
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [assignmentCourse, setAssignmentCourse] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  // Load every dataset used by the administration workspace.
  const loadData = async () => {
    try {
      const [courseResponse, schedulingResponse, deletionResponse] =
        await Promise.all([
          fetch("/courses"),
          fetch("/admin/scheduling", { headers: adminHeaders }),
          fetch("/admin/account-deletions", { headers: adminHeaders }),
        ]);
      if (!courseResponse.ok || !schedulingResponse.ok || !deletionResponse.ok)
        throw new Error();
      const courseData = await courseResponse.json();
      const schedulingData = await schedulingResponse.json();
      const deletionData = await deletionResponse.json();
      const assignmentMap = schedulingData.assignments.reduce(
        (groups, item) => ({
          ...groups,
          [item.course_id]: [
            ...(groups[item.course_id] || []),
            {
              line: String(item.line),
              teacherId: String(item.teacher_id),
              roomId: item.room_id ? String(item.room_id) : "",
              area: item.area || "",
            },
          ],
        }),
        {},
      );
      setCourses(courseData);
      setTeachers(schedulingData.teachers);
      setRooms(schedulingData.rooms);
      setAssignments(assignmentMap);
      setDeletionRequests(deletionData);
      setError("");
    } catch {
      setError("Could not load administration data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!message && !error) return undefined;
    const timer = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  // Filtered and grouped data used by the admin tabs.
  const visibleCourses = useMemo(
    () =>
      courses.filter((course) => {
        const matchesLevel =
          level === "all" ||
          String(course.level) === level ||
          (course.level === 23 && (level === "2" || level === "3"));
        const search = query.trim().toLowerCase();
        return (
          matchesLevel &&
          (!search ||
            `${course.code} ${course.name} ${course.category}`
              .toLowerCase()
              .includes(search))
        );
      }),
    [courses, level, query],
  );

  const scheduleGroups = useMemo(
    () =>
      [1, 2, 3]
        .map((courseLevel) => ({
          level: courseLevel,
          year: courseLevel + 10,
          categories: Object.entries(
            visibleCourses
              .filter(
                (course) =>
                  course.level === courseLevel ||
                  (course.level === 23 &&
                    (courseLevel === 2 || courseLevel === 3)),
              )
              .reduce(
                (groups, course) => ({
                  ...groups,
                  [course.category]: [
                    ...(groups[course.category] || []),
                    course,
                  ],
                }),
                {},
              ),
          ).sort(([first], [second]) => first.localeCompare(second)),
        }))
        .filter((group) => group.categories.length),
    [visibleCourses],
  );

  const roomAreas = useMemo(
    () =>
      [...new Set(rooms.map((room) => room.name.split(" ")[0]))].sort(
        (first, second) => first.localeCompare(second, "mi"),
      ),
    [rooms],
  );

  const teacherOfferings = useMemo(
    () =>
      courses.flatMap((course) =>
        (assignments[course.id] || [])
          .filter((assignment) => assignment.teacherId === selectedTeacher)
          .map((assignment) => ({ course, assignment })),
      ),
    [assignments, courses, selectedTeacher],
  );

  const teacherGroups = useMemo(() => {
    const roleOrder = { "Deputy Principal": 0, "Kāinga Leader": 1, Teacher: 2 };
    return Object.entries(
      teachers
        .filter((teacher) =>
          `${teacher.code || ""} ${teacher.name}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort(
          (first, second) =>
            (roleOrder[first.role] ?? 3) - (roleOrder[second.role] ?? 3) ||
            first.name.localeCompare(second.name),
        )
        .reduce((groups, teacher) => {
          const kainga = teacher.kainga || "Other staff";
          return { ...groups, [kainga]: [...(groups[kainga] || []), teacher] };
        }, {}),
    ).sort(([first], [second]) => first.localeCompare(second, "mi"));
  }, [teachers, query]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  // Course, scheduling, room, and deletion-request actions
  const notify = (text, isError = false) => {
    setMessage(isError ? "" : text);
    setError(isError ? text : "");
  };
  const changeField = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };
  const saveAssignment = async (course, draft, originalLine) => {
    if (!draft.line || !draft.teacherId || !draft.area)
      return notify(
        "Select a line, teacher, and common area before saving.",
        true,
      );
    try {
      const response = await fetch(`/admin/scheduling/${course.id}`, {
        method: "PUT",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, originalLine }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      notify(`${course.code} assigned to Line ${draft.line}.`);
      setAssignmentCourse(null);
      await loadData();
    } catch (requestError) {
      notify(requestError.message || "Could not save the assignment.", true);
    }
  };

  const saveTeacherRoom = async (course, offering, roomId) => {
    const assignment = { ...offering, roomId };
    try {
      const response = await fetch(`/admin/scheduling/${course.id}`, {
        method: "PUT",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...assignment, originalLine: offering.line }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      notify(`${course.code} classroom updated.`);
      await loadData();
    } catch (requestError) {
      notify(requestError.message || "Could not update the classroom.", true);
    }
  };

  const deleteTeacherClass = (course, offering) => {
    setConfirmation({
      title: "Delete class offering",
      message: `Delete ${course.code} from Line ${offering.line}? This removes only this class offering.`,
      confirmLabel: "Delete class",
      action: async () => {
        try {
          const response = await fetch(
            `/admin/scheduling/${course.id}/${offering.line}`,
            { method: "DELETE", headers: adminHeaders },
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          notify(data.message);
          await loadData();
        } catch (requestError) {
          notify(requestError.message || "Could not delete the class.", true);
        }
      },
    });
  };

  const saveCourse = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(
        editingId ? `/admin/courses/${editingId}` : "/admin/courses",
        {
          method: editingId ? "PUT" : "POST",
          headers: { ...adminHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, level: Number(form.level) }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      notify(editingId ? "Course updated." : "Course added.");
      resetForm();
      await loadData();
    } catch (requestError) {
      notify(requestError.message || "Could not save the course.", true);
    }
  };

  const editCourse = (course) => {
    setEditingId(course.id);
    setForm({
      code: course.code,
      name: course.name,
      level: String(course.level),
      category: course.category,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const removeCourse = (course) => {
    setConfirmation({
      title: "Delete course",
      message: `Delete ${course.code} — ${course.name}?`,
      confirmLabel: "Delete course",
      action: async () => {
        try {
          const response = await fetch(`/admin/courses/${course.id}`, {
            method: "DELETE",
            headers: adminHeaders,
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          notify("Course deleted.");
          await loadData();
        } catch (requestError) {
          notify(requestError.message || "Could not delete the course.", true);
        }
      },
    });
  };

  const selectedTeacherData = teachers.find(
    (teacher) => String(teacher.id) === selectedTeacher,
  );
  const teacherName = (id) =>
    teachers.find((teacher) => String(teacher.id) === String(id))?.name ||
    "Not assigned";
  const roomData = (id) => rooms.find((room) => String(room.id) === String(id));
  const pendingRequests = deletionRequests.filter(
    (item) => item.status === "pending",
  );

  const reviewDeletion = (item, decision) => {
    const action =
      decision === "approve" ? "permanently delete" : "deny the request for";
    setConfirmation({
      title: decision === "approve" ? "Approve deletion" : "Deny deletion",
      message: `${action} ${item.first_name} ${item.last_name}'s account?`,
      confirmLabel: decision === "approve" ? "Delete account" : "Deny request",
      action: async () => {
        try {
          const response = await fetch(`/admin/account-deletions/${item.id}`, {
            method: "PUT",
            headers: { ...adminHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ decision }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          notify(data.message);
          await loadData();
        } catch (requestError) {
          notify(requestError.message || "Could not review the request.", true);
        }
      },
    });
  };

  // Administration page layout
  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>School scheduling</h1>
          <p>Set course lines, teachers, and classroom locations.</p>
        </div>
        <div className="admin-total">
          <strong>{Object.keys(assignments).length}</strong>
          <span>classes assigned</span>
        </div>
      </header>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button
          className={tab === "scheduling" ? "active" : ""}
          onClick={() => setTab("scheduling")}
        >
          Class scheduling
        </button>
        <button
          className={tab === "teachers" ? "active" : ""}
          onClick={() => setTab("teachers")}
        >
          Teacher dashboards
        </button>
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          Deletion requests
          {pendingRequests.length ? ` (${pendingRequests.length})` : ""}
        </button>
        <button
          className={tab === "courses" ? "active" : ""}
          onClick={() => setTab("courses")}
        >
          Course catalogue
        </button>
      </nav>
      {(message || error) && (
        <div
          className={`admin-message ${error ? "error" : "success"}`}
          role="status"
        >
          <span>{error || message}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => {
              setMessage("");
              setError("");
            }}
          >
            ×
          </button>
        </div>
      )}

      {tab === "scheduling" && (
        <section className="admin-card">
          <div className="admin-toolbar">
            <div>
              <span className="admin-eyebrow">Timetable setup</span>
              <h2>Assign classes</h2>
              <p>Use Edit to choose a line, teacher, and common area.</p>
            </div>
            <div className="schedule-toolbar-actions">
              <div
                className="schedule-mode-switch"
                aria-label="Scheduling workflow"
              >
                <button
                  className={scheduleMode === "class" ? "active" : ""}
                  onClick={() => setScheduleMode("class")}
                >
                  By class
                </button>
                <button
                  className={scheduleMode === "teacher" ? "active" : ""}
                  onClick={() => setScheduleMode("teacher")}
                >
                  By teacher
                </button>
              </div>
              <AdminFilters
                query={query}
                setQuery={setQuery}
                level={level}
                setLevel={setLevel}
              />
            </div>
          </div>
          {loading ? (
            <p className="admin-state">Loading classes…</p>
          ) : scheduleMode === "teacher" ? (
            <TeacherFirstScheduler
              courses={visibleCourses}
              teachers={teachers}
              selectedTeacher={selectedTeacher}
              setSelectedTeacher={setSelectedTeacher}
              assignments={assignments}
              onChoose={(course) =>
                setAssignmentCourse({
                  course,
                  assignment: null,
                  initialTeacherId: selectedTeacher,
                })
              }
            />
          ) : scheduleGroups.length === 0 ? (
            <p className="admin-state">No matching courses.</p>
          ) : (
            <div className="schedule-groups">
              {scheduleGroups.map((group) => (
                <section className="schedule-year" key={group.level}>
                  <header>
                    <div>
                      <span>Year {group.year}</span>
                      <h3>NCEA Level {group.level}</h3>
                    </div>
                    <strong>
                      {group.categories.reduce(
                        (total, [, items]) => total + items.length,
                        0,
                      )}{" "}
                      courses
                    </strong>
                  </header>
                  {group.categories.map(([category, categoryCourses]) => (
                    <details className="schedule-category" key={category}>
                      <summary className="schedule-category-heading">
                        <h4>{category}</h4>
                        <span>
                          {categoryCourses.length}{" "}
                          {categoryCourses.length === 1 ? "course" : "courses"}
                          <i aria-hidden="true">⌄</i>
                        </span>
                      </summary>
                      <div className="schedule-list">
                        {categoryCourses.map((course) => (
                          <ScheduleCourseRow
                            key={course.id}
                            course={course}
                            offerings={assignments[course.id] || []}
                            teachers={teachers}
                            onAdd={() =>
                              setAssignmentCourse({ course, assignment: null })
                            }
                            onEdit={(assignment) =>
                              setAssignmentCourse({ course, assignment })
                            }
                          />
                        ))}
                      </div>
                    </details>
                  ))}
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "teachers" && (
        <section className="teacher-dashboard-grid">
          <aside className="admin-card teacher-picker">
            <div className="admin-card-heading">
              <div>
                <span>Staff by Kāinga</span>
                <h2>Select a teacher</h2>
              </div>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search staff"
            />{" "}
            <div className="teacher-list">
              {teacherGroups.length ? (
                teacherGroups.map(([kainga, groupTeachers]) => (
                  <section className="teacher-kainga-group" key={kainga}>
                    <header>
                      <strong>{kainga}</strong>
                      <span>{groupTeachers.length}</span>
                    </header>
                    {groupTeachers.map((teacher) => (
                      <button
                        className={
                          selectedTeacher === String(teacher.id) ? "active" : ""
                        }
                        key={teacher.id}
                        onClick={() => setSelectedTeacher(String(teacher.id))}
                      >
                        <strong>{teacher.name}</strong>
                        <small>
                          {teacher.code} · {teacher.role}
                        </small>
                      </button>
                    ))}
                  </section>
                ))
              ) : (
                <p className="teacher-empty">No matching teachers.</p>
              )}
            </div>
          </aside>
          <section className="admin-card teacher-detail">
            {!selectedTeacherData ? (
              <p className="admin-state">
                Select a teacher to view their dashboard.
              </p>
            ) : (
              <>
                <div className="teacher-profile">
                  <span className="teacher-avatar">
                    {selectedTeacherData.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <span className="admin-eyebrow">Teacher dashboard</span>
                    <h2>{selectedTeacherData.name}</h2>
                    <p>
                      {selectedTeacherData.code} · {selectedTeacherData.role} ·{" "}
                      {selectedTeacherData.kainga}
                    </p>
                  </div>
                  <strong>{teacherOfferings.length} classes</strong>
                </div>
                <div className="teacher-class-grid">
                  {teacherOfferings.length ? (
                    teacherOfferings.map(({ course, assignment }) => {
                      const room = roomData(assignment.roomId);
                      const areaRooms = rooms.filter((item) =>
                        item.name.startsWith(assignment.area),
                      );
                      return (
                        <article key={`${course.id}-${assignment.line}`}>
                          <div>
                            <span className="level-pill">
                              Line {assignment.line}
                            </span>
                            <strong>{course.name}</strong>
                            <small>
                              {course.code} ·{" "}
                              {course.level === 23
                                ? "Levels 2 & 3"
                                : `Level ${course.level}`}
                            </small>
                          </div>
                          <dl>
                            <div>
                              <dt>Common area</dt>
                              <dd>{assignment.area}</dd>
                            </div>
                            <div>
                              <dt>Classroom</dt>
                              <dd>{room?.code || "Not selected"}</dd>
                            </div>
                            <div>
                              <dt>Teaching days</dt>
                              <dd>{LINE_DAYS[assignment.line]}</dd>
                            </div>
                          </dl>
                          <label className="teacher-room-select">
                            <span>Select classroom in {assignment.area}</span>
                            <select
                              value={assignment.roomId}
                              onChange={(event) =>
                                saveTeacherRoom(
                                  course,
                                  assignment,
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Select specific room</option>
                              {areaRooms.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.code} — {item.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="delete-teacher-class"
                            type="button"
                            onClick={() =>
                              deleteTeacherClass(course, assignment)
                            }
                          >
                            Delete class
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <p className="admin-state">
                      No classes have been assigned to{" "}
                      {selectedTeacherData.name}.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </section>
      )}

      {tab === "courses" && (
        <>
          <section className="admin-card admin-editor">
            <div className="admin-card-heading">
              <div>
                <span>{editingId ? "Edit course" : "New course"}</span>
                <h2>
                  {editingId ? "Update catalogue entry" : "Add a subject"}
                </h2>
              </div>
            </div>
            <form onSubmit={saveCourse}>
              <label>
                <span>Course code</span>
                <input
                  name="code"
                  value={form.code}
                  onChange={changeField}
                  placeholder="e.g. CAL3"
                  required
                />
              </label>
              <label>
                <span>Course name</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={changeField}
                  placeholder="e.g. Calculus"
                  required
                />
              </label>
              <label>
                <span>NCEA level</span>
                <select name="level" value={form.level} onChange={changeField}>
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                  <option value="3">Level 3</option>
                </select>
              </label>
              <label>
                <span>Learning area</span>
                <input
                  name="category"
                  value={form.category}
                  onChange={changeField}
                  required
                />
              </label>
              <div className="admin-form-actions">
                <button className="admin-primary" type="submit">
                  {editingId ? "Save changes" : "Add course"}
                </button>
                {editingId && (
                  <button
                    className="admin-secondary"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="admin-card">
            <div className="admin-toolbar">
              <div>
                <span className="admin-eyebrow">Catalogue</span>
                <h2>All courses</h2>
              </div>
              <AdminFilters
                query={query}
                setQuery={setQuery}
                level={level}
                setLevel={setLevel}
              />
            </div>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course</th>
                    <th>Area</th>
                    <th>Level</th>
                    <th>Teacher</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleCourses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <strong className="course-code">{course.code}</strong>
                      </td>
                      <td>{course.name}</td>
                      <td>{course.category}</td>
                      <td>
                        <span className="level-pill">Level {course.level}</span>
                      </td>
                      <td>{teacherName(assignments[course.id]?.teacherId)}</td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => editCourse(course)}>
                            Edit
                          </button>
                          <button
                            className="delete"
                            onClick={() => removeCourse(course)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === "requests" && (
        <section className="admin-card">
          <div className="admin-toolbar">
            <div>
              <span className="admin-eyebrow">Account review</span>
              <h2>Deletion requests</h2>
              <p>
                Approve or deny student requests. Approval permanently removes
                the account.
              </p>
            </div>
            <span className="request-count">
              {pendingRequests.length} pending
            </span>
          </div>
          {deletionRequests.length === 0 ? (
            <p className="admin-state">
              There are no account deletion requests.
            </p>
          ) : (
            <div className="deletion-list">
              {deletionRequests.map((item) => (
                <article key={item.id} className="deletion-row">
                  <span className="request-avatar">
                    {item.first_name[0]}
                    {item.last_name[0]}
                  </span>
                  <div className="request-student">
                    <strong>
                      {item.first_name} {item.last_name}
                    </strong>
                    <small>
                      {item.student_id} · {item.email}
                    </small>
                  </div>
                  <div className="request-details">
                    <span>Year {item.year_level || "—"}</span>
                    <span>{item.kainga || "No Kāinga"}</span>
                    <span>
                      Requested{" "}
                      {new Date(`${item.requested_at}Z`).toLocaleDateString(
                        "en-NZ",
                      )}
                    </span>
                  </div>
                  <span className={`request-status ${item.status}`}>
                    {item.status}
                  </span>
                  {item.status === "pending" ? (
                    <div className="request-actions">
                      <button
                        className="deny"
                        type="button"
                        onClick={() => reviewDeletion(item, "deny")}
                      >
                        Deny
                      </button>
                      <button
                        className="approve"
                        type="button"
                        onClick={() => reviewDeletion(item, "approve")}
                      >
                        Approve deletion
                      </button>
                    </div>
                  ) : (
                    <span className="reviewed-date">
                      Reviewed{" "}
                      {item.reviewed_at
                        ? new Date(`${item.reviewed_at}Z`).toLocaleDateString(
                            "en-NZ",
                          )
                        : ""}
                    </span>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {assignmentCourse && (
        <AssignmentModal
          course={assignmentCourse.course}
          assignment={assignmentCourse.assignment}
          initialTeacherId={assignmentCourse.initialTeacherId}
          teachers={teachers}
          roomAreas={roomAreas}
          onSave={saveAssignment}
          onClose={() => setAssignmentCourse(null)}
        />
      )}
      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
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

// Alternative scheduling workflow that starts with a teacher, then a course.
function TeacherFirstScheduler({
  courses,
  teachers,
  selectedTeacher,
  setSelectedTeacher,
  assignments,
  onChoose,
}) {
  const teacher = teachers.find((item) => String(item.id) === selectedTeacher);
  const grouped = Object.entries(
    courses.reduce(
      (result, course) => ({
        ...result,
        [course.category]: [...(result[course.category] || []), course],
      }),
      {},
    ),
  ).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="teacher-first-scheduler">
      <aside>
        <label>
          <span>1. Select teacher</span>
          <select
            value={selectedTeacher}
            onChange={(event) => setSelectedTeacher(event.target.value)}
          >
            <option value="">Choose a teacher</option>
            {teachers.map((item) => (
              <option value={item.id} key={item.id}>
                {item.code} — {item.name}
              </option>
            ))}
          </select>
        </label>
        {teacher && (
          <div className="teacher-first-profile">
            <b>{teacher.code}</b>
            <div>
              <strong>{teacher.name}</strong>
              <span>
                {teacher.role} · {teacher.kainga}
              </span>
            </div>
          </div>
        )}
      </aside>
      <section>
        <header>
          <div>
            <span className="admin-eyebrow">2. Choose classes</span>
            <h3>
              {teacher
                ? `Assign classes to ${teacher.name}`
                : "Select a teacher first"}
            </h3>
          </div>
        </header>
        {teacher ? (
          <div className="teacher-course-groups">
            {grouped.map(([category, items]) => (
              <section key={category}>
                <h4>{category}</h4>
                <div>
                  {items.map((course) => {
                    const existing = (assignments[course.id] || []).filter(
                      (assignment) => assignment.teacherId === selectedTeacher,
                    );
                    return (
                      <button
                        type="button"
                        key={course.id}
                        onClick={() => onChoose(course)}
                      >
                        <b>{course.code}</b>
                        <span>{course.name}</span>
                        <small>
                          {course.level === 23
                            ? "Levels 2 & 3"
                            : `Level ${course.level}`}
                          {existing.length
                            ? ` · Already Line ${existing.map((item) => item.line).join(", ")}`
                            : ""}
                        </small>
                        <i>+ Assign</i>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="admin-state">
            Choose a teacher to see the available course catalogue.
          </p>
        )}
      </section>
    </div>
  );
}

// A single course and all of its scheduled offerings.
function ScheduleCourseRow({ course, offerings, teachers, onAdd, onEdit }) {
  return (
    <article className="schedule-offering-row">
      <div className="schedule-course">
        <strong>{course.code}</strong>
        <div>
          <b>{course.name}</b>
          <small>
            {course.level === 23 ? "Levels 2 & 3" : `Level ${course.level}`} ·{" "}
            {course.category}
          </small>
        </div>
      </div>
      <div className="offering-list">
        {offerings.length ? (
          [...offerings]
            .sort((first, second) => Number(first.line) - Number(second.line))
            .map((offering) => {
              const teacher = teachers.find(
                (item) => String(item.id) === offering.teacherId,
              );
              return (
                <button
                  type="button"
                  key={offering.line}
                  onClick={() => onEdit(offering)}
                >
                  <span>Line {offering.line}</span>
                  <strong>{teacher?.name || "No teacher"}</strong>
                  <small>{offering.area || "No area"}</small>
                  <i>Edit</i>
                </button>
              );
            })
        ) : (
          <span className="no-offerings">No classes assigned yet.</span>
        )}
      </div>
      <button className="schedule-edit" type="button" onClick={onAdd}>
        + Add class
      </button>
    </article>
  );
}

// Popup editor for assigning a timetable line, teacher, and room.
function AssignmentModal({
  course,
  assignment,
  initialTeacherId,
  teachers,
  roomAreas,
  onSave,
  onClose,
}) {
  const [draft, setDraft] = useState(
    assignment || {
      line: "",
      teacherId: initialTeacherId || "",
      roomId: "",
      area: "",
    },
  );
  const update = (field, value) =>
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "area" ? { roomId: "" } : {}),
    }));
  return (
    <div className="assignment-modal-backdrop" role="presentation">
      <section
        className="assignment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-title"
      >
        <header>
          <div>
            <span className="admin-eyebrow">
              {assignment ? "Edit class offering" : "New class offering"}
            </span>
            <h2 id="assignment-title">{course.name}</h2>
            <p>
              {course.code} ·{" "}
              {course.level === 23 ? "Levels 2 & 3" : `Level ${course.level}`} ·{" "}
              {course.category}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close assignment window"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(course, draft, assignment?.line);
          }}
        >
          <label>
            <span>Timetable line</span>
            <select
              value={draft.line}
              onChange={(event) => update("line", event.target.value)}
              required
            >
              <option value="">Select line</option>
              {[1, 2, 3, 4, 5].map((item) => (
                <option key={item} value={item}>
                  Line {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Teacher</span>
            <select
              value={draft.teacherId}
              onChange={(event) => update("teacherId", event.target.value)}
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.code} — {teacher.name} — {teacher.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Common area</span>
            <select
              value={draft.area}
              onChange={(event) => update("area", event.target.value)}
              required
            >
              <option value="">Select area</option>
              {roomAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <small>
              The exact classroom is selected from the teacher dashboard.
            </small>
          </label>
          <footer>
            <button className="admin-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-primary" type="submit">
              Save class
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// Shared search and level filters used by course-management views.
function AdminFilters({ query, setQuery, level, setLevel }) {
  return (
    <div className="admin-filters">
      <input
        aria-label="Search courses"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search courses"
      />
      <select
        aria-label="Filter by level"
        value={level}
        onChange={(event) => setLevel(event.target.value)}
      >
        <option value="all">All levels</option>
        <option value="1">Level 1</option>
        <option value="2">Level 2</option>
        <option value="3">Level 3</option>
      </select>
    </div>
  );
}

export default Admin;
