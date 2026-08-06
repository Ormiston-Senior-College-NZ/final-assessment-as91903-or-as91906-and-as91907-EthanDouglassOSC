/* Teacher-only application shell with navigation separate from student/admin. */
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import "./teacherLayout.css";

const LINKS = [
  ["/teacher", "Dashboard"],
  ["/teacher/timetable", "Timetable"],
  ["/teacher/classes", "My classes"],
  ["/teacher/settings", "Settings"],
];

function TeacherLayout() {
  const navigate = useNavigate();
  if (localStorage.getItem("accountType") !== "teacher")
    return <Navigate to="/" replace />;
  const name =
    `${localStorage.getItem("firstName") || ""} ${localStorage.getItem("lastName") || ""}`.trim();
  return (
    <div className="teacher-layout">
      <aside className="teacher-sidebar">
        <header>
          <strong>TeacherNET</strong>
          <small>Ormiston Senior College</small>
        </header>
        <nav>
          {LINKS.map(([to, label]) => (
            <NavLink end={to === "/teacher"} to={to} key={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <footer>
          <b>{localStorage.getItem("teacherCode")}</b>
          <span>{name}</span>
          <button
            onClick={() => {
              localStorage.clear();
              navigate("/");
            }}
          >
            Log out
          </button>
        </footer>
      </aside>
      <div className="teacher-content">
        <header className="teacher-topbar">
          <div>
            <span>Teacher workspace</span>
            <strong>{name}</strong>
          </div>
          <div>
            <span>
              {new Date().toLocaleDateString("en-NZ", { weekday: "short" })}
            </span>
            <strong>
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </strong>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

export default TeacherLayout;
