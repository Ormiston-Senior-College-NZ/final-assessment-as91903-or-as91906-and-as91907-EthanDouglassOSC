import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./Components/layout";

import Dashboard from "./Pages/dashboard";
import Timetable from "./Pages/timetable";
import NCEA from "./Pages/ncea";
import Courses from "./Pages/courses";
import Kainga from "./Pages/kainga";
import Settings from "./Pages/settings";

import Login from "./Pages/login";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login WITHOUT sidebar */}
        <Route path="/" element={<Login />} />

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