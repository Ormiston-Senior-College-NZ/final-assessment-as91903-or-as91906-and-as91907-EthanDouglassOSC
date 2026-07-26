import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "130vh" }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          background: "#f4f4f4",
          padding: "20px",
        }}
      >
        <Topbar />

        <Outlet />
      </div>
    </div>
  );
}

export default Layout;