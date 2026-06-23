import Sidebar from "./sidebar";

function Layout({ children }) {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />

      <div style={{ flex: 1, padding: "20px", background: "#f4f4f4" }}>
        {children}
      </div>
    </div>
  );
}

export default Layout;