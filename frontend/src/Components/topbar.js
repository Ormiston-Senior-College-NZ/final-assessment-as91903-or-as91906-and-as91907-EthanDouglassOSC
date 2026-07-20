import { useEffect, useState } from "react";
import { getCurrentLesson } from "../utils/timetableHelper";

function Topbar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lesson, setLesson] = useState(getCurrentLesson());

  const firstName = localStorage.getItem("firstName") || "Student";

  useEffect(() => {
    let interval;

    const update = () => {
      setCurrentTime(new Date());
      setLesson(getCurrentLesson());
    };

    update();

    const now = new Date();

    const delay =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

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

    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div style={styles.topbar}>
      <div>
        <h2 style={styles.title}>
          {greeting()}, {firstName} 👋
        </h2>

        {lesson ? (
          <p style={styles.subtitle}>
            {lesson.subject || lesson.session}
            {lesson.session !== lesson.subject &&
              ` • Session ${lesson.session}`}
            {lesson.room && ` • ${lesson.room}`}
            {` • ${lesson.start}–${lesson.end}`}
          </p>
        ) : (
          <p style={styles.subtitle}>
            No current lesson
          </p>
        )}
      </div>

      <div style={styles.time}>
        {currentTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
      </div>
    </div>
  );
}

const styles = {
  topbar: {
    background: "white",
    borderRadius: "12px",
    padding: "25px 30px",
    marginBottom: "25px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)"
  },

  title: {
    margin: 0,
    color: "#f4901f",
    fontSize: "28px",
    fontWeight: "700"
  },

  subtitle: {
    marginTop: "12px",
    fontSize: "20px",
    color: "#666",
    fontWeight: "500"
  },

  time: {
    fontSize: "34px",
    fontWeight: "700",
    color: "#1f1f1f"
  }
};

export default Topbar;