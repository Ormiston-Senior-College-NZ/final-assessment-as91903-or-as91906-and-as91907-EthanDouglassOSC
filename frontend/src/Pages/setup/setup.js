/*
 * INITIAL SETUP WIZARD
 * Guides a new student through personal details, year/Kāinga/LA selection,
 * and five timetable-line subjects, then sends the completed setup to the API
 * before routing the student to their dashboard.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./setup.css";

// Timetable examples shown beside each subject selection.
const LINE_EXAMPLES = {
  1: "Mon 09:00–10:30",
  2: "Mon 10:50–12:20",
  3: "Mon 13:40–14:30",
  4: "Mon 14:35–15:25",
  5: "Tue 10:50–12:20",
};

function Setup() {
  // Multi-step form and reference-data state
  const navigate = useNavigate();

  const studentId = localStorage.getItem("studentId");

  const [step, setStep] = useState(1);

  const [courses, setCourses] = useState([]);

  const [teachers, setTeachers] = useState([]);

  const [yearLevel, setYearLevel] = useState("");

  const [learningArea, setLearningArea] = useState("");

  const [laTeacherId, setLaTeacherId] = useState("");

  const [subjects, setSubjects] = useState(["", "", "", "", ""]);

  // ===========================================
  // KAINGAS
  // ===========================================

  const kaingas = ["Pūngāwerewere", "Pūkeko", "Mokoroa", "Kea"];

  // ===========================================
  // LOAD COURSES
  // ===========================================

  // Load selectable courses and LA teachers.
  useEffect(() => {
    Promise.all([fetch("/courses"), fetch("/teachers")])
      .then((responses) =>
        Promise.all(responses.map((response) => response.json())),
      )
      .then(([courseData, teacherData]) => {
        setCourses(courseData);
        setTeachers(teacherData);
      });
  }, []);

  // ===========================================
  // FILTER COURSES
  // ===========================================

  // Course filtering and step navigation
  const filteredCourses = courses.filter((course) => {
    if (yearLevel === 11) {
      return course.level === 1;
    }

    if (yearLevel === 12) {
      return course.level === 2 || course.level === 3 || course.level === 23;
    }

    if (yearLevel === 13) {
      return course.level === 3 || course.level === 23;
    }

    return false;
  });

  // ===========================================
  // UPDATE SUBJECT
  // ===========================================

  const updateSubject = (index, value) => {
    const copy = [...subjects];
    copy[index] = value;
    setSubjects(copy);
  };

  // ===========================================
  // NAVIGATION
  // ===========================================

  const next = () => setStep(step + 1);

  const back = () => setStep(step - 1);

  // ===========================================
  // FINISH
  // ===========================================

  // Save the completed student profile and timetable.
  const finish = async () => {
    await fetch("/setup", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        studentId,
        yearLevel,
        learningArea,
        laTeacherId,
        subjects,
      }),
    });

    navigate("/dashboard");
  };

  // Setup wizard layout
  return (
    <div className="setup-page">
      <div className="setup-card">
        <span className="setup-eyebrow">Account setup</span>

        <h1>Welcome to StudentNET</h1>

        <p>Let's personalise your account.</p>

        <div className="progress">
          {["Year", "Kāinga", "Subjects"].map((label, index) => (
            <div
              className={
                step >= index + 1 ? "progress-step active" : "progress-step"
              }
              key={label}
            >
              <span>{index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        {/* ======================================= */}
        {/* STEP 1 */}
        {/* ======================================= */}

        {step === 1 && (
          <>
            <h2>Select your Year Level</h2>

            <div className="option-grid">
              <button
                className={yearLevel === 11 ? "selected" : ""}
                onClick={() => setYearLevel(11)}
              >
                Year 11
              </button>

              <button
                className={yearLevel === 12 ? "selected" : ""}
                onClick={() => setYearLevel(12)}
              >
                Year 12
              </button>

              <button
                className={yearLevel === 13 ? "selected" : ""}
                onClick={() => setYearLevel(13)}
              >
                Year 13
              </button>
            </div>

            <div className="buttons buttons-end">
              <button className="next" disabled={!yearLevel} onClick={next}>
                Continue
              </button>
            </div>
          </>
        )}

        {/* ======================================= */}
        {/* STEP 2 */}
        {/* ======================================= */}

        {step === 2 && (
          <>
            <h2>Select your Kāinga</h2>

            <div className="option-grid kainga-grid">
              {kaingas.map((kainga) => (
                <button
                  key={kainga}
                  className={learningArea === kainga ? "selected" : ""}
                  onClick={() => {
                    setLearningArea(kainga);
                    setLaTeacherId("");
                  }}
                >
                  {kainga}
                </button>
              ))}
            </div>

            <label className="la-teacher-field">
              <span>Who is your LA?</span>
              <select
                value={laTeacherId}
                onChange={(event) => setLaTeacherId(event.target.value)}
                disabled={!learningArea}
              >
                <option value="">
                  {learningArea
                    ? "Select your LA teacher"
                    : "Select your Kāinga first"}
                </option>
                {teachers
                  .filter((teacher) => teacher.kainga === learningArea)
                  .sort((first, second) => {
                    const order = {
                      "Deputy Principal": 0,
                      "Kāinga Leader": 1,
                      Teacher: 2,
                    };
                    return (
                      (order[first.role] ?? 3) - (order[second.role] ?? 3) ||
                      first.name.localeCompare(second.name)
                    );
                  })
                  .map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.code} — {teacher.name} — {teacher.role}
                    </option>
                  ))}
              </select>
              <small>Your LA will appear in every LA / iTime session.</small>
            </label>

            <div className="buttons">
              <button onClick={back}>Back</button>

              <button
                className="next"
                disabled={!learningArea || !laTeacherId}
                onClick={next}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* ======================================= */}
        {/* STEP 3 */}
        {/* ======================================= */}

        {step === 3 && (
          <>
            <h2>Select your Subjects</h2>

            <p>Choose the subject you have in each line.</p>

            {[1, 2, 3, 4, 5].map((line, index) => (
              <div className="subject" key={line}>
                <label>
                  <strong>Line {line}</strong>
                  <small>{LINE_EXAMPLES[line]}</small>
                </label>

                <select
                  value={subjects[index]}
                  onChange={(e) => updateSubject(index, e.target.value)}
                >
                  <option value="">Select Subject</option>

                  {filteredCourses

                    .filter(
                      (course) =>
                        !subjects.includes(String(course.id)) ||
                        String(course.id) === subjects[index],
                    )

                    .map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name} (
                        {course.level === 23
                          ? "Levels 2 & 3"
                          : `Level ${course.level}`}
                        )
                      </option>
                    ))}
                </select>
              </div>
            ))}

            <div className="buttons">
              <button onClick={back}>Back</button>

              <button
                className="next"
                disabled={subjects.some((subject) => !subject)}
                onClick={finish}
              >
                Finish Setup
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Setup;
