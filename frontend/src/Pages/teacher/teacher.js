/* Teacher dashboard variants for overview, timetable, tutorials, and settings. */
import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../Components/confirmDialog";
import "./teacher.css";

function TeacherPage({ view = "dashboard" }) {
  const teacherId = localStorage.getItem("teacherId");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/teacher/${teacherId}/dashboard`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((result) => {
        setData(result);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [teacherId]);

  const lines = useMemo(
    () => new Map((data?.classes || []).map((item) => [item.line, item])),
    [data],
  );
  const changeLocation = async (lesson, area, roomId) => {
    const response = await fetch(
      `/teacher/${teacherId}/classes/${lesson.id}/${lesson.day}/${lesson.line}/location`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, roomId }),
      },
    );
    const result = await response.json();
    setMessage(result.message);
    if (!response.ok || !result.success) return false;
    const room = data.rooms.find(
      (entry) => String(entry.id) === String(roomId),
    );
    setData((current) => ({
      ...current,
      lessons: current.lessons.map((entry) =>
        entry.id === lesson.id &&
        entry.day === lesson.day &&
        entry.line === lesson.line
          ? {
              ...entry,
              room_code: room.code,
              room_name: room.name,
              area: room.name.split(" ")[0],
            }
          : entry,
      ),
    }));
    window.setTimeout(() => setMessage(""), 3000);
    return true;
  };
  if (status === "loading")
    return <div className="teacher-state">Loading teacher dashboard…</div>;
  if (status === "error")
    return (
      <div className="teacher-state error">
        Could not load teacher information.
      </div>
    );

  const titles = {
    dashboard: "Dashboard",
    timetable: "My timetable",
    tutorials: "LA requests",
    tutorialSpaces: "Tutorial spaces",
    settings: "Teacher settings",
  };
  return (
    <main className="teacher-page">
      <header className="teacher-heading">
        <h1>{titles[view]}</h1>
        <p>
          {data.teacher.role} workspace for {data.teacher.name}.
        </p>
      </header>
      {view === "dashboard" && <Dashboard data={data} lines={lines} />}
      {view === "timetable" && (
        <Timetable
          lessons={data.lessons}
          rooms={data.rooms}
          slots={data.slots}
          onLocationChange={changeLocation}
        />
      )}
      {view === "tutorials" && <TutorialApprovals teacherId={teacherId} />}
      {view === "tutorialSpaces" && <TutorialSpaces teacherId={teacherId} />}
      {view === "settings" && <Settings teacher={data.teacher} />}
      {message && <div className="teacher-toast">{message}</div>}
    </main>
  );
}

function Dashboard({ data, lines }) {
  return (
    <>
      <section className="teacher-stats">
        <article>
          <strong>{data.classes.length}</strong>
          <span>Assigned classes</span>
        </article>
        <article>
          <strong>
            {new Set(data.classes.map((item) => item.category)).size}
          </strong>
          <span>Curriculum areas</span>
        </article>
        <article>
          <strong>{data.teacher.kainga}</strong>
          <span>Kāinga</span>
        </article>
      </section>
      <section className="teacher-panel">
        <h2>Teaching lines</h2>
        <div className="teacher-line-summary">
          {[1, 2, 3, 4, 5].map((line) => (
            <div key={line}>
              <b>Line {line}</b>
              <span>{lines.get(line)?.code || "Free"}</span>
              <small>{formatRoom(lines.get(line))}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Present the short room identifier alongside its readable classroom name.
function formatRoom(room) {
  if (!room?.room_code) return "No room";
  if (!room.room_name || room.room_name === room.room_code) {
    return room.room_code;
  }
  return `${room.room_code} · ${room.room_name}`;
}

function Timetable({ lessons, rooms, slots, onLocationChange }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(
    today >= 1 && today <= 5 ? today : 1,
  );
  const [selectedLesson, setSelectedLesson] = useState(null);
  const monday = useMemo(() => {
    const date = new Date();
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1 + weekOffset * 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [weekOffset]);
  const dateForDay = (index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  };
  const label = (date) =>
    date.toLocaleDateString("en-NZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const displayTime = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(2000, 0, 1, hours, minutes)
      .toLocaleTimeString("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  };
  const minutes = (time) => {
    const [hours, value] = time.split(":").map(Number);
    return hours * 60 + value;
  };
  return (
    <section className="teacher-calendar">
      <div className="teacher-week-step">
        <strong>{weekOffset === 0 ? "Current week" : "Next week"}</strong>
        <button
          type="button"
          onClick={() => setWeekOffset(weekOffset === 0 ? 1 : 0)}
        >
          {weekOffset === 0 ? "Next week →" : "← Back to current week"}
        </button>
      </div>
      <nav className="teacher-day-selector" aria-label="School days">
        {DAYS.map((day, index) => {
          const dayNumber = index + 1;
          return (
            <button
              type="button"
              className={selectedDay === dayNumber ? "active" : ""}
              aria-pressed={selectedDay === dayNumber}
              key={day}
              onClick={() => setSelectedDay(dayNumber)}
            >
              <span>{day}</span>
              <small>Day {dayNumber}</small>
            </button>
          );
        })}
      </nav>
      <div className="teacher-time-grid">
        {DAYS.map((day, index) => ({ day, index }))
          .filter(({ index }) => index + 1 === selectedDay)
          .map(({ day, index }) => (
            <section className="teacher-time-day-column" key={day}>
              <header className="teacher-time-day-heading">
                <h2>
                  {day} – Day {index + 1}
                </h2>
                <strong>{label(dateForDay(index))}</strong>
              </header>
              <article className="teacher-time-day">
                {slots
                  .filter((slot) => slot.day === index + 1)
                  .map((slot, slotIndex, daySlots) => {
                    const lesson = lessons.find(
                      (item) =>
                        item.day === slot.day && item.line === slot.line,
                    );
                    const previousSlot = daySlots[slotIndex - 1];
                    const breakMinutes = previousSlot
                      ? minutes(slot.start_time) - minutes(previousSlot.end_time)
                      : 0;
                    return (
                      <div key={`${slot.day}-${slot.line}`}>
                        {breakMinutes > 5 && (
                          <div className="teacher-schedule-break">
                            <span>Break</span>
                            <small>{breakMinutes} minutes</small>
                          </div>
                        )}
                        <div className="teacher-time-slot">
                          {lesson ? (
                            <WeeklyLesson
                              lesson={lesson}
                              displayTime={displayTime}
                              onEdit={() => setSelectedLesson(lesson)}
                            />
                          ) : (
                            <div
                              className={`teacher-empty-slot ${slot.line === 6 ? "itime" : ""}`}
                            >
                              <header>
                                <b>
                                  {slot.line === 6
                                    ? "LA / iTime"
                                    : `Line ${slot.line}`}
                                </b>
                                <span>
                                  {displayTime(slot.start_time)}–
                                  {displayTime(slot.end_time)}
                                </span>
                              </header>
                              <strong>
                                {slot.line === 6
                                  ? "Advisory time"
                                  : "Non-contact"}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                })}
              </article>
            </section>
          ))}
      </div>
      {selectedLesson && (
        <LocationModal
          lesson={selectedLesson}
          rooms={rooms}
          onClose={() => setSelectedLesson(null)}
          onSave={async (area, roomId) => {
            const saved = await onLocationChange(selectedLesson, area, roomId);
            if (saved) setSelectedLesson(null);
            return saved;
          }}
        />
      )}
    </section>
  );
}

function WeeklyLesson({ lesson, displayTime, onEdit }) {
  return (
    <section className="teacher-week-lesson">
      <header>
        <b>Line {lesson.line}</b>
        <span>
          {displayTime(lesson.start_time)}–{displayTime(lesson.end_time)}
        </span>
      </header>
      <div className="lesson-calendar-body">
        <strong>{lesson.code}</strong>
        <small>{lesson.name}</small>
        <div>
          <span>{formatRoom(lesson)}</span>
          <button type="button" onClick={onEdit}>
            Assign Classroom
          </button>
        </div>
      </div>
    </section>
  );
}

function LocationModal({ lesson, rooms, onClose, onSave }) {
  const areas = [...new Set(rooms.map((room) => room.name.split(" ")[0]))].sort(
    (a, b) => a.localeCompare(b, "mi"),
  );
  const currentRoom = rooms.find((room) => room.code === lesson.room_code);
  const [area, setArea] = useState(lesson.area || "");
  const [roomId, setRoomId] = useState(currentRoom?.id || "");
  const [saving, setSaving] = useState(false);
  const areaRooms = rooms.filter((room) => room.name.startsWith(area));
  return (
    <div className="teacher-location-backdrop" role="presentation">
      <section
        className="teacher-location-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-title"
      >
        <header>
          <div>
            <span>Lesson location</span>
            <h2 id="location-title">{lesson.name}</h2>
            <p>
              {DAYS[lesson.day - 1]} · Line {lesson.line} · {lesson.start_time}–
              {lesson.end_time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location window"
          >
            ×
          </button>
        </header>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            await onSave(area, roomId);
            setSaving(false);
          }}
        >
          <label>
            <span>Learning area</span>
            <select
              value={area}
              onChange={(event) => {
                setArea(event.target.value);
                setRoomId("");
              }}
              required
            >
              <option value="">Select learning area</option>
              {areas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Classroom</span>
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              disabled={!area}
              required
            >
              <option value="">Select classroom</option>
              {areaRooms.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.code} — {room.name}
                </option>
              ))}
            </select>
          </label>
          <footer>
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save location"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function tutorialDateKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function nextTutorialDates(count = 6) {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (dates.length < count) {
    if (cursor.getDay() === 2 || cursor.getDay() === 5) dates.push(tutorialDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function tutorialDateLabel(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function TutorialApprovals({ teacherId }) {
  const dates = useMemo(() => nextTutorialDates(), []);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [tutorialData, setTutorialData] = useState({ students: [], bookings: [], offerings: [], areaCounts: [], rooms: [] });
  const [tutorialStatus, setTutorialStatus] = useState("loading");
  const [tutorialMessage, setTutorialMessage] = useState("");

  const loadTutorials = useCallback(async () => {
    try {
      const response = await fetch(`/tutorials/teacher/${teacherId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setTutorialData(result);
      setTutorialStatus("ready");
    } catch (error) {
      setTutorialMessage(error.message || "LA tutorial requests could not be loaded.");
      setTutorialStatus("error");
    }
  }, [teacherId]);

  useEffect(() => {
    loadTutorials();
    // loadTutorials is stable for the current teacher and intentionally triggers this refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTutorials]);

  const review = async (bookingId, decision) => {
    const response = await fetch(`/tutorials/teacher/${teacherId}/${bookingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const result = await response.json();
    setTutorialMessage(result.message);
    if (response.ok) await loadTutorials();
  };

  if (tutorialStatus === "loading") return <div className="teacher-state">Loading LA students…</div>;
  if (tutorialStatus === "error") return <div className="teacher-state error">{tutorialMessage}</div>;

  const bookings = new Map(
    tutorialData.bookings
      .filter((booking) => booking.tutorial_date === selectedDate)
      .map((booking) => [booking.student_id, booking]),
  );
  const submitted = bookings.size;

  return (
    <section className="teacher-tutorials">
      <header className="teacher-tutorial-toolbar">
        <div>
          <h2>{tutorialDateLabel(selectedDate)}</h2>
          <p>{submitted} of {tutorialData.students.length} students submitted</p>
        </div>
        <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
          {dates.map((tutorialDate) => (
            <option value={tutorialDate} key={tutorialDate}>{tutorialDateLabel(tutorialDate)}</option>
          ))}
        </select>
      </header>

      {tutorialMessage && <div className="teacher-tutorial-message" role="status">{tutorialMessage}</div>}
      <div className="teacher-tutorial-table-wrap">
        <table className="teacher-tutorial-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Year</th>
              <th>Tutorial</th>
              <th>Type and location</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {tutorialData.students.map((student) => {
              const booking = bookings.get(student.student_id);
              return (
                <tr key={student.student_id}>
                  <td><strong>{student.first_name} {student.last_name}</strong><small>{student.student_id}</small></td>
                  <td>{student.year_level || "—"}</td>
                  <td>{booking ? <><strong>{booking.learning_area}</strong><small>{booking.details}</small></> : <span className="tutorial-missing">Not submitted</span>}</td>
                  <td>{booking ? <><strong>{booking.booking_type === "tutorial" ? "Tutorial" : "Independent learning"}</strong><small>{booking.room_code} — {booking.room_name}</small></> : "—"}</td>
                  <td><span className={`teacher-tutorial-status ${booking?.status || "missing"}`}>{booking?.status || "missing"}</span></td>
                  <td>
                    {booking ? (
                      <div className="tutorial-review-buttons">
                        <button type="button" onClick={() => review(booking.id, "approved")}>Approve</button>
                        <button type="button" className="deny" onClick={() => review(booking.id, "denied")}>Deny</button>
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!tutorialData.students.length && <div className="teacher-state">No students currently have you selected as their Learning Advisor.</div>}
    </section>
  );
}

function TutorialSpaces({ teacherId }) {
  const dates = useMemo(() => nextTutorialDates(), []);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [data, setData] = useState({ offerings: [], areaCounts: [], rooms: [] });
  const [form, setForm] = useState({ learningArea: "", details: "", roomId: "" });
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [removeOffering, setRemoveOffering] = useState(null);

  const loadSpaces = useCallback(async () => {
    try {
      const response = await fetch(`/tutorials/teacher/${teacherId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result);
      setStatus("ready");
    } catch (error) {
      setMessage(error.message || "Tutorial spaces could not be loaded.");
      setStatus("error");
    }
  }, [teacherId]);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);

  const addSpace = async (event) => {
    event.preventDefault();
    const response = await fetch(`/tutorials/teacher/${teacherId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tutorialDate: selectedDate }),
    });
    const result = await response.json();
    setMessage(result.message);
    if (response.ok) {
      setForm({ learningArea: "", details: "", roomId: "" });
      await loadSpaces();
    }
  };

  const removeBookedSpace = async () => {
    const response = await fetch(`/tutorials/teacher/${teacherId}/spaces/${removeOffering.id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    setMessage(result.message);
    setRemoveOffering(null);
    if (response.ok) await loadSpaces();
  };

  if (status === "loading") return <div className="teacher-state">Loading tutorial spaces…</div>;
  if (status === "error") return <div className="teacher-state error">{message}</div>;

  const offerings = data.offerings.filter((item) => item.tutorial_date === selectedDate);
  const availableSpaces = offerings.filter((item) => !item.visitor_count);
  const bookedSpaces = offerings.filter((item) => item.visitor_count);
  const areaCounts = data.areaCounts.filter((item) => item.tutorial_date === selectedDate);

  return (
    <section className="teacher-tutorials teacher-spaces-page">
      <header className="teacher-tutorial-toolbar">
        <div><h2>{tutorialDateLabel(selectedDate)}</h2><p>Create the tutorials students can select.</p></div>
        <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
          {dates.map((value) => <option value={value} key={value}>{tutorialDateLabel(value)}</option>)}
        </select>
      </header>
      {message && <div className="teacher-tutorial-message" role="status">{message}</div>}
      <form className="teacher-offering-form" onSubmit={addSpace}>
        <label><span>Code / Subject</span><input value={form.learningArea} onChange={(event) => setForm({ ...form, learningArea: event.target.value })} placeholder="For example: CAL3 / Calculus" maxLength="80" required /></label>
        <label><span>Location</span><select value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })} required><option value="">Select location</option>{data.rooms.map((room) => <option value={room.id} key={room.id}>{room.code} — {room.name}</option>)}</select></label>
        <label className="teacher-offering-details"><span>Tutorial details</span><textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="What support or work is this tutorial for?" maxLength="250" required /></label>
        <button type="submit">Publish tutorial</button>
      </form>
      <section className="teacher-spaces-list">
        <h3>Available spaces</h3>
        {availableSpaces.length ? availableSpaces.map((offering) => <article key={offering.id}>
          <div><strong>{offering.learning_area}</strong><span>{offering.details}</span><small>{offering.room_code} — {offering.room_name}</small></div>
          <div className="booked-space-actions"><b>Open</b><button type="button" onClick={() => setRemoveOffering(offering)}>Remove</button></div>
        </article>) : <p>No unbooked tutorial spaces for this date.</p>}
      </section>
      <section className="teacher-spaces-list booked-spaces-list">
        <h3>Booked spaces</h3>
        {bookedSpaces.length ? bookedSpaces.map((offering) => <article key={offering.id}>
          <div><strong>{offering.learning_area}</strong><span>{offering.details}</span><small>{offering.room_code} — {offering.room_name}</small></div>
          <div className="booked-space-actions"><b>{offering.visitor_count} students<small>{offering.booked_students}</small></b><button type="button" onClick={() => setRemoveOffering(offering)}>Remove</button></div>
        </article>) : <p>No tutorial spaces have been booked for this date.</p>}
      </section>
      <section className="teacher-tutorial-counts" aria-label="Visitor totals by area">
        {areaCounts.map((area) => <div key={area.learning_area}><strong>{area.visitor_count}</strong><span>{area.learning_area}</span></div>)}
        {!areaCounts.length && <p>No student destinations have been submitted for this date.</p>}
      </section>
      {removeOffering && <ConfirmDialog title="Remove tutorial?" message={removeOffering.visitor_count ? `This will remove ${removeOffering.learning_area} and cancel the bookings for all ${removeOffering.visitor_count} attending students.` : `This will remove the available ${removeOffering.learning_area} tutorial space.`} confirmLabel="Remove tutorial" onConfirm={removeBookedSpace} onCancel={() => setRemoveOffering(null)} />}
    </section>
  );
}

function Settings({ teacher }) {
  return (
    <section className="teacher-panel teacher-profile-settings">
      <div>
        <span>Staff code</span>
        <strong>{teacher.code}</strong>
      </div>
      <div>
        <span>Full name</span>
        <strong>{teacher.name}</strong>
      </div>
      <div>
        <span>Role</span>
        <strong>{teacher.role}</strong>
      </div>
      <div>
        <span>Kāinga</span>
        <strong>{teacher.kainga}</strong>
      </div>
      <a href="/teacher/change-password">Change password</a>
    </section>
  );
}

export default TeacherPage;
