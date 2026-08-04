import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import "./admin.css";

const EMPTY_FORM = { code: "", name: "", level: "3", category: "Mathematics" };
const LINE_DAYS = { 1: "Mon, Tue, Thu, Fri", 2: "Mon, Wed, Thu, Fri", 3: "Mon, Wed, Thu, Fri", 4: "Mon, Tue, Wed, Thu", 5: "Tue, Wed, Thu, Fri" };

function Admin() {
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const studentId = localStorage.getItem("studentId");
  const adminHeaders = { "X-Student-ID": studentId };
  const [tab, setTab] = useState("scheduling");
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletionRequests, setDeletionRequests] = useState([]);

  const loadData = async () => {
    try {
      const [courseResponse, schedulingResponse, deletionResponse] = await Promise.all([
        fetch("/courses"), fetch("/admin/scheduling", { headers: adminHeaders }),
        fetch("/admin/account-deletions", { headers: adminHeaders }),
      ]);
      if (!courseResponse.ok || !schedulingResponse.ok || !deletionResponse.ok) throw new Error();
      const courseData = await courseResponse.json();
      const schedulingData = await schedulingResponse.json();
      const deletionData = await deletionResponse.json();
      const assignmentMap = Object.fromEntries(schedulingData.assignments.map((item) => [item.course_id, {
        line: String(item.line), teacherId: String(item.teacher_id), roomId: String(item.room_id),
      }]));
      setCourses(courseData);
      setTeachers(schedulingData.teachers);
      setRooms(schedulingData.rooms);
      setAssignments(assignmentMap);
      setDrafts(assignmentMap);
      setDeletionRequests(deletionData);
      setError("");
    } catch {
      setError("Could not load administration data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleCourses = useMemo(() => courses.filter((course) => {
    const matchesLevel = level === "all" || String(course.level) === level;
    const search = query.trim().toLowerCase();
    return matchesLevel && (!search || `${course.code} ${course.name} ${course.category}`.toLowerCase().includes(search));
  }), [courses, level, query]);

  const teacherCourses = useMemo(() => courses.filter((course) =>
    assignments[course.id]?.teacherId === selectedTeacher
  ), [assignments, courses, selectedTeacher]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const notify = (text, isError = false) => { setMessage(isError ? "" : text); setError(isError ? text : ""); };
  const changeField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };
  const updateDraft = (courseId, field, value) => setDrafts((current) => ({ ...current, [courseId]: { line: "", teacherId: "", roomId: "", ...current[courseId], [field]: value } }));

  const saveAssignment = async (course) => {
    const draft = drafts[course.id] || {};
    if (!draft.line || !draft.teacherId || !draft.roomId) return notify("Select a line, teacher, and room before saving.", true);
    try {
      const response = await fetch(`/admin/scheduling/${course.id}`, {
        method: "PUT", headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setAssignments((current) => ({ ...current, [course.id]: draft }));
      notify(`${course.code} assigned to Line ${draft.line}.`);
    } catch (requestError) { notify(requestError.message || "Could not save the assignment.", true); }
  };

  const saveTeacherRoom = async (course, roomId) => {
    const assignment = { ...assignments[course.id], roomId };
    setDrafts((current) => ({ ...current, [course.id]: assignment }));
    try {
      const response = await fetch(`/admin/scheduling/${course.id}`, {
        method: "PUT", headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(assignment),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setAssignments((current) => ({ ...current, [course.id]: assignment }));
      notify(`${course.code} classroom updated.`);
    } catch (requestError) { notify(requestError.message || "Could not update the classroom.", true); }
  };

  const saveCourse = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(editingId ? `/admin/courses/${editingId}` : "/admin/courses", {
        method: editingId ? "PUT" : "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, level: Number(form.level) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      notify(editingId ? "Course updated." : "Course added."); resetForm(); await loadData();
    } catch (requestError) { notify(requestError.message || "Could not save the course.", true); }
  };

  const editCourse = (course) => { setEditingId(course.id); setForm({ code: course.code, name: course.name, level: String(course.level), category: course.category }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const removeCourse = async (course) => {
    if (!window.confirm(`Delete ${course.code} — ${course.name}?`)) return;
    try {
      const response = await fetch(`/admin/courses/${course.id}`, { method: "DELETE", headers: adminHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      notify("Course deleted."); await loadData();
    } catch (requestError) { notify(requestError.message || "Could not delete the course.", true); }
  };

  const selectedTeacherData = teachers.find((teacher) => String(teacher.id) === selectedTeacher);
  const teacherName = (id) => teachers.find((teacher) => String(teacher.id) === String(id))?.name || "Not assigned";
  const roomData = (id) => rooms.find((room) => String(room.id) === String(id));
  const pendingRequests = deletionRequests.filter((item) => item.status === "pending");

  const reviewDeletion = async (item, decision) => {
    const action = decision === "approve" ? "permanently delete" : "deny the request for";
    if (!window.confirm(`${action} ${item.first_name} ${item.last_name}'s account?`)) return;
    try {
      const response = await fetch(`/admin/account-deletions/${item.id}`, {
        method: "PUT", headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      notify(data.message);
      await loadData();
    } catch (requestError) { notify(requestError.message || "Could not review the request.", true); }
  };

  return (
    <main className="admin-page">
      <header className="admin-heading"><div><span className="admin-eyebrow">Administration</span><h1>School scheduling</h1><p>Set course lines, teachers, and classroom locations.</p></div><div className="admin-total"><strong>{Object.keys(assignments).length}</strong><span>classes assigned</span></div></header>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={tab === "scheduling" ? "active" : ""} onClick={() => setTab("scheduling")}>Class scheduling</button>
        <button className={tab === "teachers" ? "active" : ""} onClick={() => setTab("teachers")}>Teacher dashboards</button>
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Deletion requests{pendingRequests.length ? ` (${pendingRequests.length})` : ""}</button>
        <button className={tab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>Course catalogue</button>
      </nav>
      {(message || error) && <p className={`admin-message ${error ? "error" : "success"}`}>{error || message}</p>}

      {tab === "scheduling" && <section className="admin-card">
        <div className="admin-toolbar"><div><span className="admin-eyebrow">Timetable setup</span><h2>Assign classes</h2><p>Choose a line, teacher, and room for each course.</p></div><AdminFilters query={query} setQuery={setQuery} level={level} setLevel={setLevel} /></div>
        {loading ? <p className="admin-state">Loading classes…</p> : <div className="schedule-list">{visibleCourses.map((course) => {
          const draft = drafts[course.id] || { line: "", teacherId: "", roomId: "" };
          return <article className="schedule-row" key={course.id}><div className="schedule-course"><strong>{course.code}</strong><div><b>{course.name}</b><small>Level {course.level} · {course.category}</small></div></div><label><span>Line</span><select value={draft.line} onChange={(event) => updateDraft(course.id, "line", event.target.value)}><option value="">Select</option>{[1,2,3,4,5].map((item) => <option key={item} value={item}>Line {item}</option>)}</select></label><label><span>Teacher</span><select value={draft.teacherId} onChange={(event) => updateDraft(course.id, "teacherId", event.target.value)}><option value="">Select teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label><label><span>Classroom</span><select value={draft.roomId} onChange={(event) => updateDraft(course.id, "roomId", event.target.value)}><option value="">Select room</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.code} — {room.name}</option>)}</select></label><button className="admin-primary schedule-save" type="button" onClick={() => saveAssignment(course)}>Save</button></article>;
        })}</div>}
      </section>}

      {tab === "teachers" && <section className="teacher-dashboard-grid">
        <aside className="admin-card teacher-picker"><div className="admin-card-heading"><div><span>Staff</span><h2>Select a teacher</h2></div></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff" /> <div className="teacher-list">{teachers.filter((teacher) => teacher.name.toLowerCase().includes(query.toLowerCase())).map((teacher) => <button className={selectedTeacher === String(teacher.id) ? "active" : ""} key={teacher.id} onClick={() => setSelectedTeacher(String(teacher.id))}><strong>{teacher.name}</strong><small>{teacher.role} · {teacher.kainga}</small></button>)}</div></aside>
        <section className="admin-card teacher-detail">{!selectedTeacherData ? <p className="admin-state">Select a teacher to view their dashboard.</p> : <><div className="teacher-profile"><span className="teacher-avatar">{selectedTeacherData.name.split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><span className="admin-eyebrow">Teacher dashboard</span><h2>{selectedTeacherData.name}</h2><p>{selectedTeacherData.role} · {selectedTeacherData.kainga}</p></div><strong>{teacherCourses.length} classes</strong></div><div className="teacher-class-grid">{teacherCourses.length ? teacherCourses.map((course) => { const assignment = assignments[course.id]; const room = roomData(assignment.roomId); return <article key={course.id}><div><span className="level-pill">Line {assignment.line}</span><strong>{course.name}</strong><small>{course.code} · Level {course.level}</small></div><dl><div><dt>Classroom</dt><dd>{room?.code}</dd></div><div><dt>Location</dt><dd>{room?.name}</dd></div><div><dt>Teaching days</dt><dd>{LINE_DAYS[assignment.line]}</dd></div></dl><label className="teacher-room-select"><span>Change classroom</span><select value={assignment.roomId} onChange={(event) => saveTeacherRoom(course, event.target.value)}>{rooms.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label></article>; }) : <p className="admin-state">No classes have been assigned to {selectedTeacherData.name}.</p>}</div></>}</section>
      </section>}

      {tab === "courses" && <><section className="admin-card admin-editor"><div className="admin-card-heading"><div><span>{editingId ? "Edit course" : "New course"}</span><h2>{editingId ? "Update catalogue entry" : "Add a subject"}</h2></div></div><form onSubmit={saveCourse}><label><span>Course code</span><input name="code" value={form.code} onChange={changeField} placeholder="e.g. CAL3" required /></label><label><span>Course name</span><input name="name" value={form.name} onChange={changeField} placeholder="e.g. Calculus" required /></label><label><span>NCEA level</span><select name="level" value={form.level} onChange={changeField}><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label><label><span>Learning area</span><input name="category" value={form.category} onChange={changeField} required /></label><div className="admin-form-actions"><button className="admin-primary" type="submit">{editingId ? "Save changes" : "Add course"}</button>{editingId && <button className="admin-secondary" type="button" onClick={resetForm}>Cancel</button>}</div></form></section><section className="admin-card"><div className="admin-toolbar"><div><span className="admin-eyebrow">Catalogue</span><h2>All courses</h2></div><AdminFilters query={query} setQuery={setQuery} level={level} setLevel={setLevel} /></div><div className="admin-table-wrap"><table><thead><tr><th>Code</th><th>Course</th><th>Area</th><th>Level</th><th>Teacher</th><th /></tr></thead><tbody>{visibleCourses.map((course) => <tr key={course.id}><td><strong className="course-code">{course.code}</strong></td><td>{course.name}</td><td>{course.category}</td><td><span className="level-pill">Level {course.level}</span></td><td>{teacherName(assignments[course.id]?.teacherId)}</td><td><div className="row-actions"><button onClick={() => editCourse(course)}>Edit</button><button className="delete" onClick={() => removeCourse(course)}>Delete</button></div></td></tr>)}</tbody></table></div></section></>}
      {tab === "requests" && <section className="admin-card">
        <div className="admin-toolbar"><div><span className="admin-eyebrow">Account review</span><h2>Deletion requests</h2><p>Approve or deny student requests. Approval permanently removes the account.</p></div><span className="request-count">{pendingRequests.length} pending</span></div>
        {deletionRequests.length === 0 ? <p className="admin-state">There are no account deletion requests.</p> : <div className="deletion-list">{deletionRequests.map((item) => <article key={item.id} className="deletion-row"><span className="request-avatar">{item.first_name[0]}{item.last_name[0]}</span><div className="request-student"><strong>{item.first_name} {item.last_name}</strong><small>{item.student_id} · {item.email}</small></div><div className="request-details"><span>Year {item.year_level || "—"}</span><span>{item.kainga || "No Kāinga"}</span><span>Requested {new Date(`${item.requested_at}Z`).toLocaleDateString("en-NZ")}</span></div><span className={`request-status ${item.status}`}>{item.status}</span>{item.status === "pending" ? <div className="request-actions"><button className="deny" type="button" onClick={() => reviewDeletion(item, "deny")}>Deny</button><button className="approve" type="button" onClick={() => reviewDeletion(item, "approve")}>Approve deletion</button></div> : <span className="reviewed-date">Reviewed {item.reviewed_at ? new Date(`${item.reviewed_at}Z`).toLocaleDateString("en-NZ") : ""}</span>}</article>)}</div>}
      </section>}
    </main>
  );
}

function AdminFilters({ query, setQuery, level, setLevel }) {
  return <div className="admin-filters"><input aria-label="Search courses" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" /><select aria-label="Filter by level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></div>;
}

export default Admin;
