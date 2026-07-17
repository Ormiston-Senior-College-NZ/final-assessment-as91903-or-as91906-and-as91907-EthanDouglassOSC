import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          background: "#f4f4f4",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        <Topbar />

        <Outlet />
      </div>
    </div>
  );
}

export default Layout;