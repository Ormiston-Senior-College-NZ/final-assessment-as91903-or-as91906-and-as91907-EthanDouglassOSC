function Topbar() {
  return (
    <div style={styles.topbar}>
      <div>
        <h2 style={styles.title}>Good Morning, Ethan 👋</h2>
        <p style={styles.subtitle}>
          Statistics • Session 1 • 8:50 AM – 10:10 AM
        </p>
      </div>

      <div style={styles.right}>
        <div style={styles.time}>
          {new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  topbar: {
    background: "#ffffff",
    padding: "25px 30px",
    borderRadius: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "25px",
  },

  title: {
    margin: 0,
    color: "#c8941c",
  },

  subtitle: {
    marginTop: "8px",
    color: "#666",
  },

  right: {
    textAlign: "right",
  },

  time: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#1f1f1f",
  },
};

export default Topbar;