import { Outlet } from "react-router-dom";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import "./layout.css";

function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <div className="app-content-inner">
          <Topbar />
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Layout;
