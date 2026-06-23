import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div style={styles.sidebar}>
      <h2 style={styles.title}>OSC StudentNET</h2>

      <nav style={styles.nav}>
        <Link style={styles.link} to="/dashboard">Dashboard</Link>
        <Link style={styles.link} to="/timetable">Timetable</Link>
        <Link style={styles.link} to="/ncea">NCEA</Link>
        <Link style={styles.link} to="/courses">Courses</Link>
        <Link style={styles.link} to="/kainga">Kāinga</Link>
        <Link style={styles.link} to="/settings">Settings</Link>
      </nav>
    </div>
  );
}

const styles = {
  sidebar: {
    width: "220px",
    height: "100vh",
    background: "#1f1f1f",
    color: "white",
    padding: "20px",
    boxSizing: "border-box"
  },
  title: {
    color: "#c8941c",
    marginBottom: "20px"
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  link: {
    color: "white",
    textDecoration: "none",
    padding: "8px",
    borderRadius: "5px"
  }
};

export default Sidebar;