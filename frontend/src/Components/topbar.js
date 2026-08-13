/*
 * TOPBAR COMPONENT
 * Loads the student's timetable, normalises API time fields, finds the current
 * lesson, updates the clock once per minute, and chooses a time-based greeting.
 */
import { useEffect, useMemo, useState } from "react";
import { getCurrentLesson } from "../utils/timetableHelper";
import { formatClock, formatTimeRange, useTimeFormat } from "../utils/timeFormat";
import "./topbar.css";

function Topbar() {
  // Clock and current timetable state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timetable, setTimetable] = useState([]);
  const [timeFormat] = useTimeFormat();
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const isTeacher = localStorage.getItem("accountType") === "teacher";

  const firstName = localStorage.getItem("firstName") || "Student";

  const lesson = useMemo(
    () => getCurrentLesson(timetable, currentTime),
    [timetable, currentTime],
  );

  // Load lessons used to determine what is happening now.
  useEffect(() => {
    if (isAdmin || isTeacher) return undefined;
    const studentId = localStorage.getItem("studentId");
    if (!studentId) return undefined;

    const controller = new AbortController();

    fetch(`/timetable/${encodeURIComponent(studentId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load timetable");
        return response.json();
      })
      .then((data) => {
        setTimetable(
          data.map((item) => ({
            ...item,
            subject: item.name,
            start: item.start_time,
            end: item.end_time,
          })),
        );
      })
      .catch((error) => {
        if (error.name !== "AbortError") setTimetable([]);
      });

    return () => controller.abort();
  }, [isAdmin, isTeacher]);

  // Align updates to the start of each minute.
  useEffect(() => {
    let interval;

    const update = () => {
      setCurrentTime(new Date());
    };

    update();

    const now = new Date();

    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60000);
    }, delay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const greeting = () => {
    const hour = currentTime.getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Top bar layout
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <h2>
          {greeting()}, {firstName}
        </h2>

        {isAdmin || isTeacher ? (
          <div className="topbar-lesson">
            <span className="lesson-status-dot" aria-hidden="true"></span>
            <strong>{isAdmin ? "Administration workspace" : "Teacher workspace"}</strong>
            <span>{isAdmin ? "School-wide view" : localStorage.getItem("teacherCode")}</span>
          </div>
        ) : lesson ? (
          <div className="topbar-lesson">
            <span className="lesson-status-dot" aria-hidden="true"></span>
            <span className="topbar-lesson-label">Now</span>
            <strong>{lesson.subject || lesson.session}</strong>
            <span>Line {lesson.session}</span>
            {lesson.room_name || lesson.room ? (
              <span>{lesson.room_name || lesson.room}</span>
            ) : null}
            <span>
              {formatTimeRange(lesson.start, lesson.end, timeFormat)}
            </span>
          </div>
        ) : (
          <div className="topbar-lesson muted">
            <span className="lesson-status-dot" aria-hidden="true"></span>
            <span>No current lesson</span>
          </div>
        )}
      </div>

      <div className="topbar-clock">
        <span>
          {currentTime.toLocaleDateString("en-NZ", { weekday: "short" })}
        </span>
        <strong>
          {formatClock(currentTime, timeFormat)}
        </strong>
      </div>
    </header>
  );
}

export default Topbar;
