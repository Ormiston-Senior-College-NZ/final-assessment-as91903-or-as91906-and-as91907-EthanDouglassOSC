import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./Components/layout";

import Setup from "./Pages/setup/setup";
import Dashboard from "./Pages/dashboard/dashboard";
import Timetable from "./Pages/timetable/timetable";
import NCEA from "./Pages/ncea/ncea";
import Courses from "./Pages/courses/courses";
import Kainga from "./Pages/kainga/kainga";
import Settings from "./Pages/settings/settings";

import Login from "./Pages/login/login";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login WITHOUT sidebar */}
        <Route path="/" element={<Login />} />
        <Route path="/setup" element={<Setup />} />

        {/* ALL pages WITH sidebar */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/ncea" element={<NCEA />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/kainga" element={<Kainga />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
