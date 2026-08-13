/*
 * TIMETABLE PAGE
 * Loads generated lessons, selects the current weekday by default, filters the
 * full schedule to the chosen day, and renders LA/iTime plus subject sessions
 * with teacher, room, line, and time information.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { breakName, durationMinutes, formatTimeRange, useTimeFormat } from "../../utils/timeFormat";
import "./timetable.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function StudentTimetable() {
  // Selected day, lessons, and loading state
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(
    today >= 1 && today <= 5 ? today : 1,
  );
  const [lessons, setLessons] = useState([]);
  const [status, setStatus] = useState("loading");
  const [timeFormat] = useTimeFormat();

  // Load the signed-in student's generated timetable.
  useEffect(() => {
    const studentId = localStorage.getItem("studentId");

    if (!studentId) {
      setStatus("signed-out");
      return;
    }

    const controller = new AbortController();

    fetch(`/timetable/${encodeURIComponent(studentId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load timetable");
        return response.json();
      })
      .then((data) => {
        setLessons(data);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, []);

  // Only render lessons for the selected weekday.
  const dayLessons = useMemo(
    () => lessons.filter((lesson) => lesson.day === selectedDay),
    [lessons, selectedDay],
  );

  // Timetable page layout
  return (
    <main className="timetable-page">
      <div className="timetable-heading">
        <div>
          <h1>Timetable</h1>
          <p>Your classes, teachers, rooms and session times.</p>
        </div>
      </div>

      <div className="day-selector" role="tablist" aria-label="School days">
        {DAYS.map((day, index) => {
          const dayNumber = index + 1;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selectedDay === dayNumber}
              className={selectedDay === dayNumber ? "active" : ""}
              key={day}
              onClick={() => setSelectedDay(dayNumber)}
            >
              <span>{day}</span>
              <small>Day {dayNumber}</small>
            </button>
          );
        })}
      </div>

      <section className="timetable-card" aria-live="polite">
        <div className="selected-day-heading">
          <div>
            <div>
              <h2>{DAYS[selectedDay - 1]}</h2>
              <p>
                {dayLessons.length} scheduled{" "}
                {dayLessons.length === 1 ? "class" : "classes"}
              </p>
            </div>
          </div>
        </div>

        {status === "loading" && (
          <div className="timetable-message">Loading your timetable…</div>
        )}
        {status === "error" && (
          <div className="timetable-message error">
            Your timetable could not be loaded. Check that the backend is
            running.
          </div>
        )}
        {status === "signed-out" && (
          <div className="timetable-message">
            Log in to view your timetable.
          </div>
        )}
        {status === "ready" && dayLessons.length === 0 && (
          <div className="timetable-message">
            <strong>No classes scheduled for this day.</strong>
            <span>
              Your timetable will appear here once course scheduling is
              complete.
            </span>
          </div>
        )}

        {status === "ready" && dayLessons.length > 0 && (
          <div className="table-scroll">
            <table className="timetable-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {dayLessons.map((lesson, index) => {
                  const previousLesson = dayLessons[index - 1];
                  const breakMinutes = previousLesson
                    ? durationMinutes(previousLesson.end_time, lesson.start_time)
                    : 0;
                  const lessonMinutes = durationMinutes(lesson.start_time, lesson.end_time);
                  return <Fragment key={`${lesson.day}-${lesson.session}-${lesson.code}`}>
                  {breakMinutes > 5 && (
                    <tr className="timetable-break-row">
                      <td colSpan="5">
                        <strong>{breakName(previousLesson.end_time, lesson.start_time)}</strong>
                        <span>{formatTimeRange(previousLesson.end_time, lesson.start_time, timeFormat)} · {breakMinutes} minutes</span>
                      </td>
                    </tr>
                  )}
                  <tr className="timetable-lesson-row" style={{ height: `${Math.max(68, 40 + lessonMinutes * 0.8)}px` }}>
                    <td>
                      <span className="session-badge">{lesson.session}</span>
                    </td>
                    <td className="time-cell">
                      {formatTimeRange(lesson.start_time, lesson.end_time, timeFormat)}
                    </td>
                    <td>
                      <strong>{lesson.name}</strong>
                      <small>{lesson.code}</small>
                    </td>
                    <td>{lesson.teacher || "To be confirmed"}</td>
                    <td>{lesson.room_name || lesson.room || "TBC"}</td>
                  </tr>
                  </Fragment>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Timetable() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <Navigate to="/admin" replace />
  ) : (
    <StudentTimetable />
  );
}

export default Timetable;
