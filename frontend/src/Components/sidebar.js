import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./sidebar.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/timetable", label: "Timetable" },
  { to: "/ncea", label: "NCEA" },
  { to: "/courses", label: "Courses" },
  { to: "/kainga", label: "Kāinga" },
];

function Sidebar() {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState(() => ({
    firstName: localStorage.getItem("firstName") || "Student",
    lastName: localStorage.getItem("lastName") || "",
  }));
  const { firstName, lastName } = profile;
  const initials = `${firstName[0] || "S"}${lastName[0] || ""}`.toUpperCase();

  useEffect(() => {
    const updateProfile = () => setProfile({
      firstName: localStorage.getItem("firstName") || "Student",
      lastName: localStorage.getItem("lastName") || "",
    });

    window.addEventListener("studentnet-profile-updated", updateProfile);
    return () => window.removeEventListener("studentnet-profile-updated", updateProfile);
  }, []);

  const logout = () => {
    localStorage.removeItem("studentId");
    localStorage.removeItem("firstName");
    localStorage.removeItem("lastName");
    navigate("/");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div>
          <strong>StudentNET</strong>
          <small>Ormiston Senior College</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            key={item.to}
            to={item.to}
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-account">
        {accountOpen && (
          <div className="account-menu">
            <NavLink to="/settings" onClick={() => setAccountOpen(false)}>
              Settings
            </NavLink>
            <button type="button" onClick={logout}>Log out</button>
          </div>
        )}
        <button
          type="button"
          className="sidebar-profile"
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          onClick={() => setAccountOpen((open) => !open)}
        >
          <span className="profile-initials">{initials}</span>
          <span className="profile-copy">
            <strong>{firstName} {lastName}</strong>
            <small>Student account</small>
          </span>
          <span className="account-chevron" aria-hidden="true">⌃</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
