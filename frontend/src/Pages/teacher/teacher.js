/* Teacher dashboard variants for overview, timetable, classes, and settings. */
import { useEffect, useMemo, useState } from "react";
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
    classes: "My classes",
    settings: "Teacher settings",
  };
  return (
    <main className="teacher-page">
      <header className="teacher-heading">
        <span>
          {data.teacher.code} · {data.teacher.kainga}
        </span>
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
      {view === "classes" && <Classes classes={data.classes} />}
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

function Classes({ classes }) {
  return (
    <section className="teacher-class-grid">
      {classes.length ? (
        classes.map((item) => (
          <article key={`${item.id}-${item.line}`}>
            <header>
              <b>{item.code}</b>
              <span>Line {item.line}</span>
            </header>
            <h2>{item.name}</h2>
            <p>
              {item.category} ·{" "}
              {item.level === 23 ? "Levels 2 & 3" : `Level ${item.level}`}
            </p>
            <footer>
              <span>Locations</span>
              <strong>Managed in weekly timetable</strong>
            </footer>
          </article>
        ))
      ) : (
        <div className="teacher-state">No classes are assigned.</div>
      )}
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
