/* Teacher-only application shell with navigation and shared account controls. */
import { useEffect, useRef, useState } from "react";
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
  const accountRef = useRef(null);
  const name =
    `${localStorage.getItem("firstName") || ""} ${localStorage.getItem("lastName") || ""}`.trim();
  useEffect(() => {
    if (!accountOpen) return undefined;
    const closeOutside = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [accountOpen]);
  if (localStorage.getItem("accountType") !== "teacher")
    return <Navigate to="/" replace />;
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
        <div className="teacher-account" ref={accountRef}>
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
