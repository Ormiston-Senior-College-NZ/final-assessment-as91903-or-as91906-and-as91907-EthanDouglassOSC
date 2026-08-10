/* Teacher-only application shell with navigation and shared account controls. */
import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import Topbar from "./topbar";
import "./teacherLayout.css";

const LINKS = [
  ["/teacher", "Dashboard"],
  ["/teacher/timetable", "Timetable"],
  ["/teacher/tutorials", "LA requests"],
  ["/teacher/tutorial-spaces", "Tutorial spaces"],
];

function TeacherLayout() {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
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
        <div className="teacher-account">
          {accountOpen && (
            <div className="teacher-account-menu">
              <NavLink to="/teacher/settings" onClick={() => setAccountOpen(false)}>
                Settings
              </NavLink>
              <button type="button" onClick={() => {
                localStorage.clear();
                navigate("/");
              }}>
                Log out
              </button>
            </div>
          )}
          <button
            type="button"
            className="teacher-profile"
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <b>{localStorage.getItem("teacherCode")}</b>
            <span><strong>{name}</strong><small>Teacher account</small></span>
            <i aria-hidden="true">⌃</i>
          </button>
        </div>
      </aside>
      <div className="teacher-content">
        <Topbar />
        <Outlet />
      </div>
    </div>
  );
}

export default TeacherLayout;
