/*
 * COURSES PAGE
 * Combines the student's subjects with timetable teacher/room data, supports
 * search and NCEA-level filtering, groups the catalogue by curriculum area,
 * and sends catalogue selections to exact official StudentNET information pages.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminView from "../../Components/adminView";
import "./courses.css";

// Exact StudentNET destinations for courses with published information pages.
const STUDENTNET_URL = "https://students.ormiston.school.nz";
const OFFICIAL_COURSE_PATHS = {
  ENG1: "/level-1-courses/english",
  MAT1: "/level-1-courses/level-1-mathematics",
  ESL1: "/level-1-courses/esol-level-1",
  ELL1: "/level-1-courses/esol-v2",
  MAO1: "/level-1-courses/te-reo-m%C4%81ori",
  TIK1: "/level-1-courses/tikanga",
  SCI1: "/level-1-courses/11sci/general-science",
  BIO1: "/level-1-courses/11sci/biology",
  CHE1: "/level-1-courses/11sci/chemistry",
  PHY1: "/level-1-courses/11sci/physics",
  PAS1: "/level-1-courses/pacific-studies",
  GEO1: "/level-1-courses/geo1",
  ECO1: "/level-1-courses/economics",
  HEA1: "/level-1-courses/health",
  CSC1: "/level-1-courses/technology/digital-technology",
  TEF1: "/level-1-courses/technology/food-technology",
  PDT1: "/level-1-courses/technology/product-design",
  DVC1: "/level-1-courses/technology/design-and-visual-communication",
  DAN1: "/level-1-courses/dance",
  DRA1: "/level-1-courses/dra1/drama",
  MUSL1: "/level-1-courses/music/mus1-rock-the-stage",
  MUST1: "/level-1-courses/music/mus1-beatmakers",
  MUSB1: "/level-1-courses/music/mus-1-concert-band",
  DES1: "/level-1-courses/visual-arts/design",
  PAI1: "/level-1-courses/visual-arts/painting",
  PHO1: "/level-1-courses/visual-arts/photography",
  ENG2: "/level-2-courses/english-2",
  ENP23: "/level-2-courses/english-projects-enp23",
  ESL2: "/level-2-courses/esol-level-2",
  MAO2: "/level-2-courses/osc-te-reo-m%C4%81ori",
  TAH2: "/level-2-courses/performing-arts/te-ao-haka",
  MED2: "/level-2-courses/media-studies",
  PED2: "/level-2-courses/physical-education",
  OED2: "/level-2-courses/outdoor-education",
  HEA2: "/level-2-courses/health",
  DAN2: "/level-2-courses/performing-arts/dance",
  DRA2: "/level-2-courses/performing-arts/drama",
  MUS2: "/level-2-courses/performing-arts/music-level-2",
  DES2: "/level-2-courses/visual-arts/visual-arts-design",
  PAI2: "/level-2-courses/visual-arts/visual-arts-painting",
  PHO2: "/level-2-courses/visual-arts/visua-arts-photography",
  MAT2: "/level-2-courses/mathematics-statistics/level-2-mathematics",
  STA2: "/level-2-courses/mathematics-statistics/level-2-statistics",
  PHY2: "/level-2-courses/sciences/physics",
  CHE2: "/level-2-courses/sciences/che2",
  BIO2: "/level-2-courses/sciences/idn2",
  SCI2: "/level-2-courses/sciences/general-science-l2",
  PAS2: "/level-2-courses/pacific-studies",
  GEO2: "/level-2-courses/level-2-geography",
  HIS2: "/level-2-courses/12his",
  ACC2: "/level-2-courses/accounting",
  BUS2: "/level-2-courses/business-studies-1",
  ECO2: "/level-2-courses/economics",
  FIN2: "/level-2-courses/financial-literacy",
  TRM2: "/level-2-courses/tourism-studies",
  CSC2: "/level-2-courses/technology/computer-science",
  TEF2: "/level-2-courses/technology/food-technology",
  PDT2: "/level-2-courses/technology/product-design_1",
  DVC2: "/level-2-courses/technology/design-and-visual-communication",
  HOS2: "/level-2-courses/technology/hospitality-and-culinary",
  COT2: "/level-2-courses/technology/construction-technology_1",
  ENG3: "/level-3-courses/english-3",
  MAO3: "/level-3-courses/osc-ncea-level-3-te-reo-m%C4%81ori",
  TAH3: "/level-3-courses/performing-arts/te-ao-haka",
  MED3: "/level-3-courses/media-studies",
  PED3: "/level-3-courses/physical-education",
  OED3: "/level-3-courses/outdoor-education",
  HEA3: "/level-3-courses/health",
  DAN3: "/level-3-courses/performing-arts/dance",
  DRA3: "/level-3-courses/performing-arts/drama-level-3-1",
  MUS3: "/level-3-courses/performing-arts/music",
  DES3: "/level-3-courses/visual-arts/design",
  PAI3: "/level-3-courses/visual-arts/painting",
  PHO3: "/level-3-courses/visual-arts/photography",
  MAT3: "/level-3-courses/mathematics-statistics/mathematics-3",
  CAL3: "/level-3-courses/mathematics-statistics/calculus-3",
  STA3: "/level-3-courses/mathematics-statistics/statistics-3",
  PHY3: "/level-3-courses/sciences/physics",
  CHE3: "/level-3-courses/sciences/chemistry",
  BIO3: "/level-3-courses/sciences/biology",
  SCI3: "/level-3-courses/sciences/science-level-3",
  PAS3: "/level-3-courses/pacific-studies",
  GEO3: "/level-3-courses/geography",
  HIS3: "/level-3-courses/13his",
  ACC3: "/level-3-courses/accounting",
  BUS3: "/level-3-courses/business-studies",
  ECO3: "/level-3-courses/economics-1",
  FIN3: "/level-3-courses/financial-literacy-3",
  EFS3: "/level-3-courses/education-for-sustainability",
  CSC3: "/level-3-courses/technology/computer-science",
  TEF3: "/level-3-courses/technology/food-technology_1",
  PDT3: "/level-3-courses/technology/product-design_1",
  DVC3: "/level-3-courses/technology/design-and-visual-communication_1",
  HOS3: "/level-3-courses/technology/hospitality-and-culinary_1",
};

function levelLabel(level) {
  return level === 23 ? "Levels 2 & 3" : `Level ${level}`;
}

function officialCourseUrl(course) {
  const fallbackLevel = course.level === 23 ? 2 : course.level;
  return `${STUDENTNET_URL}${OFFICIAL_COURSE_PATHS[course.code] || `/level-${fallbackLevel}-courses`}`;
}

function StudentCourses() {
  // Catalogue, timetable, and filter state
  const studentId = localStorage.getItem("studentId");
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [status, setStatus] = useState("loading");

  // Load course information and the student's current selections.
  useEffect(() => {
    if (!studentId) return setStatus("signed-out");
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      fetch("/courses", options),
      fetch(`/subjects/${encodeURIComponent(studentId)}`, options),
      fetch(`/timetable/${encodeURIComponent(studentId)}`, options),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error();
        return Promise.all(responses.map((response) => response.json()));
      })
      .then(([courseData, subjectData, timetableData]) => {
        setCourses(courseData);
        setSubjects(subjectData);
        setTimetable(timetableData);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [studentId]);

  // Search results grouped first by school year, then curriculum area.
  const selectedIds = useMemo(
    () => new Set(subjects.map((subject) => subject.id)),
    [subjects],
  );
  const visibleCourses = useMemo(
    () =>
      courses.filter((course) => {
        const search = query.trim().toLowerCase();
        const matchesSearch =
          !search ||
          `${course.code} ${course.name} ${course.category}`
            .toLowerCase()
            .includes(search);
        const matchesLevel =
          level === "all" ||
          String(course.level) === level ||
          (course.level === 23 && (level === "2" || level === "3"));
        return matchesSearch && matchesLevel;
      }),
    [courses, query, level],
  );

  const courseGroups = useMemo(
    () => [
      { year: 11, levels: [1] },
      { year: 12, levels: [2, 23] },
      { year: 13, levels: [3, 23] },
    ].map(({ year, levels }) => {
      const yearCourses = visibleCourses.filter((course) => levels.includes(course.level));
      const areas = Object.entries(
        yearCourses.reduce((groups, course) => {
          const category = course.category || "Other";
          return { ...groups, [category]: [...(groups[category] || []), course] };
        }, {}),
      ).sort(([first], [second]) => first.localeCompare(second));
      return { year, courseCount: yearCourses.length, areas };
    }).filter((group) => group.courseCount),
    [visibleCourses],
  );

  const subjectDetails = (subject) => {
    const lesson = timetable.find(
      (item) => item.session === subject.line && item.code === subject.code,
    );
    return {
      ...subject,
      teacher: lesson?.teacher,
      teacherCode: lesson?.teacher_code,
      room: lesson?.room_name || lesson?.room,
    };
  };

  if (status === "loading")
    return <div className="courses-state">Loading courses…</div>;
  if (status === "signed-out")
    return <div className="courses-state">Log in to view courses.</div>;
  if (status === "error")
    return (
      <div className="courses-state error">
        The course catalogue could not be loaded.
      </div>
    );

  // Courses page layout
  return (
    <main className="courses-page">
      <header className="courses-heading">
        <div>
          <h1>Courses</h1>
          <p>
            View your current classes and explore the StudentNET course
            catalogue.
          </p>
        </div>
      </header>

      <section className="my-courses-section">
        <div className="courses-section-heading">
          <div>
            <span className="courses-eyebrow">My timetable</span>
            <h2>My courses</h2>
          </div>
          <Link to="/settings">Change selections →</Link>
        </div>
        <div className="my-course-grid">
          {subjects.map((subject) => {
            const detail = subjectDetails(subject);
            return (
              <article
                key={subject.id}
                onClick={() =>
                  setSelectedCourse(
                    courses.find((course) => course.id === subject.id),
                  )
                }
              >
                <header>
                  <span>Line {subject.line}</span>
                  <strong>{subject.code}</strong>
                </header>
                <h3>{subject.name}</h3>
                <p>{levelLabel(subject.level)}</p>
                <dl>
                  <div>
                    <dt>Teacher</dt>
                    <dd>
                      {detail.teacher
                        ? `${detail.teacher}${detail.teacherCode ? ` (${detail.teacherCode})` : ""}`
                        : "To be confirmed"}
                    </dd>
                  </div>
                </dl>
                <button type="button">View course</button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="course-catalogue">
        <div className="catalogue-toolbar">
          <div>
            <span className="courses-eyebrow">Catalogue</span>
            <h2>Explore all courses</h2>
          </div>
          <div className="catalogue-filters">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by course, code or area"
              aria-label="Search courses"
            />
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              aria-label="Filter by NCEA level"
            >
              <option value="all">All levels</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
            </select>
          </div>
        </div>
        {courseGroups.length ? (
          <div className="catalogue-groups">
            {courseGroups.map(({ year, courseCount, areas }) => (
              <details className="catalogue-year-group" key={year} open={Boolean(query)}>
                <summary>
                  <div><h3>Year {year}</h3><span>{courseCount} {courseCount === 1 ? "course" : "courses"}</span></div>
                  <i>⌄</i>
                </summary>
                <div className="catalogue-year-areas">
                  {areas.map(([category, categoryCourses]) => (
                    <details className="catalogue-group" key={`${year}-${category}`} open={Boolean(query)}>
                      <summary>
                        <div><h4>{category}</h4><span>{categoryCourses.length} courses</span></div>
                        <i>⌄</i>
                      </summary>
                      <div className="catalogue-course-grid">
                        {categoryCourses.map((course) => (
                          <button type="button" className={selectedIds.has(course.id) ? "selected" : ""} key={course.id} onClick={() => window.location.assign(officialCourseUrl(course))} aria-label={`View official information for ${course.name}`}>
                            <span className="catalogue-code">{course.code}</span>
                            <div><strong>{course.name}</strong><small>{levelLabel(course.level)} · Official course information</small></div>
                            {selectedIds.has(course.id) && <em>My course</em>}
                            <i>→</i>
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="courses-empty">No courses match your search.</div>
        )}
      </section>

      {selectedCourse && (
        <CourseModal
          course={selectedCourse}
          selected={selectedIds.has(selectedCourse.id)}
          subject={subjects.find((item) => item.id === selectedCourse.id)}
          detail={subjectDetails(
            subjects.find((item) => item.id === selectedCourse.id) || {},
          )}
          onClose={() => setSelectedCourse(null)}
        />
      )}
    </main>
  );
}

function Courses() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <AdminView page="courses" />
  ) : (
    <StudentCourses />
  );
}

// Details popup used by cards in the student's current course list.
function CourseModal({ course, selected, subject, detail, onClose }) {
  return (
    <div className="course-modal-backdrop" onMouseDown={onClose}>
      <section className="course-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="courses-eyebrow">
              {selected ? "My course" : "Course catalogue"}
            </span>
            <h2>{course.name}</h2>
            <p>
              {course.code} · {levelLabel(course.level)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close course details">
            ×
          </button>
        </header>
        <div className="course-modal-body">
          <div className="course-area">
            <span>Curriculum area</span>
            <strong>{course.category}</strong>
          </div>
          {selected ? (
            <>
              <dl>
                <div>
                  <dt>Timetable line</dt>
                  <dd>Line {subject.line}</dd>
                </div>
                <div>
                  <dt>Teacher</dt>
                  <dd>{detail.teacher || "To be confirmed"}</dd>
                </div>
                <div>
                  <dt>Classroom</dt>
                  <dd>{detail.room || "To be confirmed"}</dd>
                </div>
              </dl>
              <p>
                This course is currently part of your timetable. Its standards
                and grades can be managed from the NCEA page.
              </p>
              <div className="course-modal-links">
                <Link to="/ncea">View NCEA standards</Link>
                <Link to="/timetable">View timetable</Link>
              </div>
            </>
          ) : (
            <>
              <p>
                Interested in this course? Course selections are managed in
                Account Settings. Check that it matches your year level before
                changing a timetable line.
              </p>
              <div className="course-modal-links">
                <Link to="/settings">Open Account Settings</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default Courses;
