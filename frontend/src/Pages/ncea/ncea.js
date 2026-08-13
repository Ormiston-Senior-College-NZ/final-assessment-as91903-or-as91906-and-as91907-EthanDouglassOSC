/*
 * NCEA RESULTS PAGE
 * Loads saved standards and the standards catalogue, groups results by subject,
 * calculates weighted GPA/credits/rank score, and supports adding, editing,
 * grading, and deleting each student's selected achievement standards.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import ConfirmDialog from "../../Components/confirmDialog";
import "./ncea.css";

// NCEA grade values and the blank standard editor model
const GRADE_POINTS = { NA: 0, A: 2, M: 3, E: 4 };
const GRADE_NAMES = {
  "": "Not graded",
  NA: "Not Achieved",
  A: "Achieved",
  M: "Merit",
  E: "Excellence",
};
const EMPTY_STANDARD = {
  courseId: "",
  catalogId: "",
  number: "",
  title: "",
  credits: "",
  assessmentType: "Internal",
  grade: "",
  ueApproved: true,
  manual: false,
  isAdditional: false,
  additionalSubject: "",
  additionalSubjectId: "",
  catalogSearch: "",
};

function StudentNCEA() {
  // Results, catalogue, dialog, and notification state
  const studentId = localStorage.getItem("studentId");
  const [subjects, setSubjects] = useState([]);
  const [standards, setStandards] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [status, setStatus] = useState("loading");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const expandedStorageKey = `ncea-expanded-subjects-${studentId || "guest"}`;
  const [expandedSubjects, setExpandedSubjects] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(expandedStorageKey) || "[]"));
    } catch {
      return new Set();
    }
  });

  // Subjects start closed; the student's explicit choices persist in-browser.
  const toggleSubject = (subjectKey) => {
    setExpandedSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      localStorage.setItem(expandedStorageKey, JSON.stringify([...next]));
      return next;
    });
  };

  // Load saved results and available standards together.
  const loadData = async () => {
    if (!studentId) return setStatus("signed-out");
    try {
      const [subjectResponse, standardResponse, catalogResponse, courseResponse] =
        await Promise.all([
          fetch(`/subjects/${encodeURIComponent(studentId)}`),
          fetch(`/ncea/${encodeURIComponent(studentId)}`),
          fetch(`/ncea/catalog/${encodeURIComponent(studentId)}`),
          fetch("/courses"),
        ]);
      if (!subjectResponse.ok || !standardResponse.ok || !catalogResponse.ok || !courseResponse.ok)
        throw new Error();
      setSubjects(await subjectResponse.json());
      setStandards(await standardResponse.json());
      setCatalog(await catalogResponse.json());
      setAllCourses(await courseResponse.json());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // GPA, rank score, credit totals, and subject grouping
  const calculations = useMemo(() => {
    const totalCredits = standards.reduce(
      (sum, item) => sum + item.credits,
      0,
    );
    const recorded = standards.filter((item) => item.grade);
    const attemptedCredits = recorded.reduce(
      (sum, item) => sum + item.credits,
      0,
    );
    const achieved = recorded.filter((item) => item.grade !== "NA");
    const achievedCredits = achieved.reduce(
      (sum, item) => sum + item.credits,
      0,
    );
    const gpaPoints = recorded.reduce(
      (sum, item) => sum + GRADE_POINTS[item.grade] * item.credits,
      0,
    );
    const gpa = attemptedCredits ? gpaPoints / attemptedCredits : 0;
    const targetLevel = Math.max(
      1,
      ...subjects.map((subject) => subject.level === 23 ? 3 : subject.level),
    );
    const qualificationCredits = achieved
      .filter((item) => (item.course_level === 23 ? 3 : item.course_level) >= targetLevel)
      .reduce((sum, item) => sum + item.credits, 0);
    const creditsRemaining = Math.max(0, 60 - qualificationCredits);
    const gradeCredits = ["E", "M", "A", "NA"].reduce(
      (totals, grade) => ({
        ...totals,
        [grade]: recorded
          .filter((item) => item.grade === grade)
          .reduce((sum, item) => sum + item.credits, 0),
      }),
      {},
    );
    const assessmentCredits = ["Internal", "External", "Unit Standard"].reduce(
      (totals, type) => ({
        ...totals,
        [type]: achieved
          .filter((item) => item.assessment_type === type)
          .reduce((sum, item) => sum + item.credits, 0),
      }),
      {},
    );
    const gpaEquivalent = !attemptedCredits
      ? ""
      : gpa < 1
        ? "N"
        : gpa < 2.5
          ? "A"
          : gpa < 3.5
            ? "M"
            : "E";

    const bySubject = standards
      .filter(
        (item) =>
          item.ue_approved &&
          item.assessment_type !== "Unit Standard" &&
          (item.course_level === 3 || item.course_level === 23) &&
          ["A", "M", "E"].includes(item.grade),
      )
      .reduce(
        (groups, item) => ({
          ...groups,
          [item.course_id]: [...(groups[item.course_id] || []), item],
        }),
        {},
      );
    const eligibleCredits = Object.values(bySubject)
      .flatMap((items) => {
        const creditPoints = items.flatMap((item) =>
          Array(item.credits).fill(GRADE_POINTS[item.grade]),
        );
        return creditPoints.sort((a, b) => b - a).slice(0, 24);
      })
      .sort((a, b) => b - a)
      .slice(0, 80);

    return {
      attemptedCredits,
      achievedCredits,
      totalCredits,
      targetLevel,
      qualificationCredits,
      creditsRemaining,
      gradeCredits,
      assessmentCredits,
      meritEndorsementCredits: gradeCredits.M + gradeCredits.E,
      excellenceEndorsementCredits: gradeCredits.E,
      gpa,
      gpaEquivalent,
      rankScore: eligibleCredits.reduce((sum, points) => sum + points, 0),
      rankCredits: eligibleCredits.length,
    };
  }, [standards, subjects]);

  // Standard and grade actions
  const saveStandard = async (form, id) => {
    const response = await fetch(
      id ? `/ncea/${studentId}/${id}` : `/ncea/${studentId}`,
      {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          courseId: form.isAdditional
            ? (Number(form.additionalSubjectId) || form.linkedCourseId || null)
            : Number(form.courseId),
          credits: Number(form.credits),
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    setModal(null);
    setNotice(data.message);
    await loadData();
  };

  const updateGrade = async (standard, grade) => {
    try {
      await saveStandard(
        {
          courseId: standard.course_id,
          number: standard.standard_number,
          title: standard.title,
          credits: standard.credits,
          assessmentType: standard.assessment_type,
          grade,
          ueApproved: Boolean(standard.ue_approved),
          catalogId: standard.catalog_standard_id || "",
          isAdditional: Boolean(standard.is_additional),
        },
        standard.id,
      );
    } catch (error) {
      setNotice(error.message);
    }
  };

  const deleteStandard = (standard) => {
    setConfirmation({
      message: `Remove ${standard.standard_number ? `standard ${standard.standard_number}` : standard.title}?`,
      confirmLabel: "Remove standard",
      action: async () => {
        const response = await fetch(`/ncea/${studentId}/${standard.id}`, {
          method: "DELETE",
        });
        const data = await response.json();
        setNotice(data.message);
        if (response.ok) await loadData();
      },
    });
  };

  if (status === "loading")
    return <div className="ncea-state">Loading your NCEA results…</div>;
  if (status === "signed-out")
    return <div className="ncea-state">Log in to view NCEA results.</div>;
  if (status === "error")
    return (
      <div className="ncea-state error">
        Your NCEA information could not be loaded.
      </div>
    );

  // Include records from a former class in Additional standards so a saved
  // result can never become invisible after the student's subjects change.
  const currentSubjectIds = new Set(subjects.map((subject) => String(subject.id)));
  const additionalStandards = standards.filter(
    (item) => item.is_additional || !currentSubjectIds.has(String(item.course_id)),
  );

  const revealStandard = (standard) => {
    const subjectKey = standard.is_additional || !currentSubjectIds.has(String(standard.course_id))
      ? "additional"
      : String(standard.course_id);
    setExpandedSubjects((current) => {
      const next = new Set(current);
      next.add(subjectKey);
      localStorage.setItem(expandedStorageKey, JSON.stringify([...next]));
      return next;
    });
    setModal(null);
    setNotice(`Showing ${standard.standard_number ? `standard ${standard.standard_number}` : standard.title}.`);
    window.setTimeout(() => {
      const row = document.querySelector(`[data-standard-id="${standard.id}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("standard-highlight");
      window.setTimeout(() => row.classList.remove("standard-highlight"), 2400);
    }, 100);
  };

  // NCEA results page layout
  return (
    <main className="ncea-page">
      <header className="ncea-heading">
        <div>
          <h1>NCEA results</h1>
          <p>Track standards and model your current academic progress.</p>
        </div>
      </header>
      {notice && (
        <div className="ncea-toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className="ncea-summary">
        <article className="credits-card">
          <span>Credits achieved</span>
          <strong>{calculations.achievedCredits}</strong>
          <small>
            {calculations.achievedCredits} of {calculations.totalCredits} selected credits achieved
          </small>
          <div className="credit-breakdown">
            {["E", "M", "A"].map((grade) => (
              <span key={grade}><b>{calculations.gradeCredits[grade]}</b>{GRADE_NAMES[grade]}</span>
            ))}
          </div>
        </article>
        <article className="qualification-card">
          <span>NCEA Level {calculations.targetLevel} progress</span>
          <strong>{calculations.qualificationCredits}<em>/60</em></strong>
          <small>{calculations.creditsRemaining} credits remaining at Level {calculations.targetLevel} or above</small>
          <div className="qualification-bar" aria-label={`${calculations.qualificationCredits} of 60 qualification credits`}>
            <i style={{ width: `${Math.min(100, calculations.qualificationCredits / 0.6)}%` }} />
          </div>
          <p>Literacy and numeracy co-requisite tracked separately by NZQA.</p>
        </article>
        <article className="gpa-card">
          <span>Weighted GPA</span>
          <strong>{calculations.gpa.toFixed(2)}</strong>
          <small>Estimated, credit-weighted 0–4 scale</small>
          <div className="gpa-gradient" aria-label={`GPA ${calculations.gpa.toFixed(2)} out of 4`}>
            <i style={{ left: `${Math.min(100, calculations.gpa * 25)}%` }} />
          </div>
          <div className="gpa-labels"><span>N · 0</span><span>A · 2</span><span>M · 3</span><span>E · 4</span></div>
        </article>
        <article className="rank-card">
          <span>Estimated rank score</span>
          <strong>{calculations.rankScore}</strong>
          <small>
            {calculations.rankCredits} of 80 eligible Level 3 credits counted
          </small>
          <div className="score-bar">
            <i style={{ width: `${Math.min(100, calculations.rankScore / 3.2)}%` }} />
          </div>
          <p>Maximum possible score: 320</p>
        </article>
      </section>

      <section className="ncea-visuals" aria-label="Grade and credit visualisations">
        <article>
          <header><h2>Grade credits</h2><span>{calculations.attemptedCredits} assessed</span></header>
          <div className="stacked-credit-bar">
            {["E", "M", "A", "NA"].map((grade) => (
              <i className={`segment grade-${grade}`} key={grade} style={{ width: `${calculations.attemptedCredits ? calculations.gradeCredits[grade] / calculations.attemptedCredits * 100 : 0}%` }} />
            ))}
          </div>
          <div className="visual-legend">
            {["E", "M", "A", "NA"].map((grade) => <span key={grade}><i className={`grade-${grade}`} />{GRADE_NAMES[grade]} <b>{calculations.gradeCredits[grade]}</b></span>)}
          </div>
        </article>
        <article>
          <header><h2>Achieved credit mix</h2><span>{calculations.achievedCredits} total</span></header>
          <div className="assessment-bars">
            {["Internal", "External", "Unit Standard"].map((type) => <div key={type}><span>{type}</span><i><b style={{ width: `${calculations.achievedCredits ? calculations.assessmentCredits[type] / calculations.achievedCredits * 100 : 0}%` }} /></i><strong>{calculations.assessmentCredits[type]}</strong></div>)}
          </div>
        </article>
      </section>

      <section className="ncea-explainer">
        <h2>Understanding your progress</h2>
        <div>
          <article><strong>Qualification target</strong><p>Level {calculations.targetLevel} requires 60 credits at that level or above, plus 10 literacy and 10 numeracy co-requisite credits. StudentNET currently models the 60-credit component only.</p></article>
          <article><strong>GPA estimate</strong><p>Grades are weighted by credits: Not Achieved = 0, Achieved = 2, Merit = 3 and Excellence = 4. This is a planning estimate, not an official NZQA measure.</p></article>
          <article><strong>Rank score</strong><p>Uses the best 80 eligible Level 3 credits from UE-approved subjects, capped at 24 credits per subject. Universities may apply their own programme requirements.</p></article>
          <article><strong>Endorsements</strong><p>Certificate Merit needs 50 Merit-or-Excellence credits; you have {calculations.meritEndorsementCredits}. Excellence needs 50 Excellence credits; you have {calculations.excellenceEndorsementCredits}.</p></article>
        </div>
      </section>

      <div className="ncea-subjects">
        {subjects.map((subject) => {
          const subjectKey = String(subject.id);
          const isCollapsed = !expandedSubjects.has(subjectKey);
          const items = standards.filter(
            (item) => item.course_id === subject.id,
          );
          const credits = items
            .filter((item) => ["A", "M", "E"].includes(item.grade))
            .reduce((sum, item) => sum + item.credits, 0);
          return (
            <section className={`ncea-subject-card${isCollapsed ? " collapsed" : ""}`} key={subject.id}>
              <header>
                <div>
                  <span className="subject-code">{subject.code}</span>
                  <div>
                    <h2>{subject.name}</h2>
                    <p>
                      {subject.level === 23
                        ? "NCEA Levels 2 & 3"
                        : `NCEA Level ${subject.level}`}{" "}
                      · Line {subject.line}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>{credits}</strong>
                  <span>credits</span>
                  <button
                    type="button"
                    className="subject-collapse-button"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${subject.name}`}
                    onClick={() => toggleSubject(subjectKey)}
                  >
                    {isCollapsed ? "Show" : "Hide"} <span aria-hidden="true">{isCollapsed ? "⌄" : "⌃"}</span>
                  </button>
                </div>
              </header>
              {!isCollapsed && (items.length ? (
                <div className="standards-table">
                  <div className="standard-head">
                    <span>Standard</span>
                    <span>Assessment</span>
                    <span>Credits</span>
                    <span>Grade</span>
                    <span />
                  </div>
                  {items.map((item) => (
                    <article key={item.id} data-standard-id={item.id}>
                      <div>
                        <strong>
                          {item.short_code
                            ? `${item.short_code} · ${item.standard_number}`
                            : item.standard_number}
                        </strong>
                        <span>{item.title}</span>
                        {item.ue_approved ? (
                          <small>UE approved subject</small>
                        ) : null}
                      </div>
                      <span
                        className={`assessment ${item.assessment_type.toLowerCase()}`}
                      >
                        {item.assessment_type}
                      </span>
                      <b>{item.credits}</b>
                      <select
                        className={`grade-select grade-${item.grade || "pending"}`}
                        value={item.grade}
                        onChange={(event) =>
                          updateGrade(item, event.target.value)
                        }
                      >
                        <option value="">Not graded</option>
                        <option value="NA">Not Achieved</option>
                        <option value="A">Achieved</option>
                        <option value="M">Merit</option>
                        <option value="E">Excellence</option>
                      </select>
                      <div className="standard-actions">
                        <button
                          onClick={() =>
                            setModal({
                              courseId: String(item.course_id),
                              number: item.standard_number,
                              title: item.title,
                              credits: String(item.credits),
                              assessmentType: item.assessment_type,
                              grade: item.grade,
                              ueApproved: Boolean(item.ue_approved),
                              catalogId: item.catalog_standard_id ? String(item.catalog_standard_id) : "",
                              manual: !item.catalog_standard_id,
                              isAdditional: Boolean(item.is_additional),
                              id: item.id,
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="delete"
                          onClick={() => deleteStandard(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-standards">
                  <p>No standards added for this class.</p>
                  <button
                    onClick={() =>
                      setModal({
                        ...EMPTY_STANDARD,
                        courseId: String(subject.id),
                      })
                    }
                  >
                    Add a standard
                  </button>
                </div>
              ))}
              {!isCollapsed && <footer className="subject-standard-footer">
                <button type="button" onClick={() => setModal({
                  ...EMPTY_STANDARD,
                  courseId: String(subject.id),
                })}>+ Add standard</button>
              </footer>}
            </section>
          );
        })}
        <section className={`ncea-subject-card additional-standards-card${!expandedSubjects.has("additional") ? " collapsed" : ""}`}>
          <header>
            <div><div><h2>Additional standards</h2><p>Standards not linked to one of your enrolled subjects</p></div></div>
            <div>
              <strong>{additionalStandards.filter((item) => ["A", "M", "E"].includes(item.grade)).reduce((sum, item) => sum + item.credits, 0)}</strong>
              <span>credits</span>
              <button type="button" className="subject-collapse-button" aria-expanded={expandedSubjects.has("additional")} aria-label={`${expandedSubjects.has("additional") ? "Collapse" : "Expand"} Additional standards`} onClick={() => toggleSubject("additional")}>
                {expandedSubjects.has("additional") ? "Hide" : "Show"} <span aria-hidden="true">{expandedSubjects.has("additional") ? "⌃" : "⌄"}</span>
              </button>
            </div>
          </header>
          {expandedSubjects.has("additional") && (additionalStandards.length ? (
            <div className="additional-standard-list">
              {additionalStandards.map((item) => (
                <article key={item.id} data-standard-id={item.id}>
                  <div><strong>{item.standard_number || "No NZQA number"}</strong><span>{item.title}</span><small>{!item.is_additional && item.course_name ? `${item.course_name} · ` : ""}{item.assessment_type} · {item.credits} credits</small></div>
                  <select className={`grade-select grade-${item.grade || "pending"}`} value={item.grade} onChange={(event) => updateGrade(item, event.target.value)}>
                    <option value="">Not graded</option><option value="NA">Not Achieved</option><option value="A">Achieved</option>{item.assessment_type !== "Unit Standard" && <><option value="M">Merit</option><option value="E">Excellence</option></>}
                  </select>
                  <div className="standard-actions">
                    <button onClick={() => setModal({ courseId: "additional", linkedCourseId: item.course_id, catalogId: item.catalog_standard_id ? String(item.catalog_standard_id) : "", number: item.standard_number || "", title: item.title, credits: String(item.credits), assessmentType: item.assessment_type, grade: item.grade, ueApproved: Boolean(item.ue_approved), manual: !item.catalog_standard_id, isAdditional: true, id: item.id })}>Edit</button>
                    <button className="delete" onClick={() => deleteStandard(item)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty-standards"><p>No additional standards selected.</p></div>)}
          {expandedSubjects.has("additional") && <footer className="subject-standard-footer">
            <button type="button" onClick={() => setModal({ ...EMPTY_STANDARD, courseId: "additional", isAdditional: true })}>+ Add additional standard</button>
          </footer>}
        </section>
      </div>

      {modal && (
        <StandardModal
          form={modal}
          subjects={subjects}
          catalog={catalog}
          allCourses={allCourses}
          selectedStandards={standards}
          onDuplicate={revealStandard}
          onClose={() => setModal(null)}
          onSave={saveStandard}
        />
      )}
      {confirmation && (
        <ConfirmDialog
          title="Remove standard"
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.action;
            setConfirmation(null);
            action();
          }}
        />
      )}
    </main>
  );
}

function NCEA() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <Navigate to="/admin" replace />
  ) : (
    <StudentNCEA />
  );
}

// Add/edit dialog that filters standards to the selected subject.
function StandardModal({
  form: initialForm,
  subjects,
  catalog,
  allCourses,
  selectedStandards,
  onDuplicate,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isOfficial = Boolean(form.catalogId) && !form.manual;
  const targetLevel = Math.max(1, ...subjects.map((subject) => subject.level === 23 ? 3 : subject.level));
  const additionalSubjects = allCourses
    .filter((course) => course.level === targetLevel || (targetLevel === 3 && course.level === 23))
    .sort((first, second) => first.name.localeCompare(second.name));
  const availableStandards = catalog.filter(
    (item) =>
      String(item.course_id) === String(form.isAdditional ? form.additionalSubjectId : form.courseId) &&
      (!selectedStandards.some(
        (selected) => selected.standard_number === item.standard_number,
      ) ||
        item.standard_number === form.number),
  );
  const update = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "assessmentType" && value === "Unit Standard"
        ? { ueApproved: false, grade: ["M", "E"].includes(current.grade) ? "" : current.grade }
        : {}),
      ...(name === "courseId"
        ? { catalogId: "", number: "", title: "", credits: "", manual: false,
            isAdditional: value === "additional" }
        : {}),
    }));
  };
  const chooseStandard = (event) => {
    const value = event.target.value;
    if (value === "manual")
      return setForm((current) => ({
        ...current,
        catalogId: "",
        number: "",
        title: "",
        credits: "",
        manual: true,
      }));
    const standard = catalog.find(
      (item) =>
        String(item.id) === value &&
        String(item.course_id) === String(form.isAdditional ? form.additionalSubjectId : form.courseId),
    );
    if (!standard) return setForm((current) => ({ ...current, catalogId: "" }));
    setForm((current) => ({
      ...current,
      catalogId: value,
      number: standard.standard_number,
      title: standard.title,
      credits: String(standard.credits),
      assessmentType: standard.assessment_type,
      manual: false,
    }));
  };
  const chooseAdditionalStandard = (event) => {
    const value = event.target.value;
    const standard = availableStandards.find((item) =>
      value === `${item.standard_number} — ${item.title}` ||
      value.trim() === item.standard_number,
    );
    if (!standard) {
      setForm((current) => ({
        ...current,
        catalogSearch: value,
        catalogId: "",
        number: "",
        title: "",
        credits: "",
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      catalogSearch: `${standard.standard_number} — ${standard.title}`,
      catalogId: String(standard.id),
      number: standard.standard_number,
      title: standard.title,
      credits: String(standard.credits),
      assessmentType: standard.assessment_type,
      manual: false,
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const duplicate = selectedStandards.find(
      (item) =>
        item.id !== form.id &&
        String(form.number).trim() &&
        String(item.standard_number || "").trim().toLowerCase() === String(form.number).trim().toLowerCase(),
    );
    if (duplicate) {
      onDuplicate(duplicate);
      return;
    }
    setSaving(true);
    try {
      await onSave(form, form.id);
    } catch (requestError) {
      setError(requestError.message);
      setSaving(false);
    }
  };
  return (
    <div className="standard-modal-backdrop" onMouseDown={onClose}>
      <section className="standard-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="ncea-eyebrow">
              {form.id ? "Edit standard" : "Choose standards"}
            </span>
            <h2>{form.id ? form.number : "Add an assessment"}</h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>Class</span>
            <select
              name="courseId"
              value={form.courseId}
              onChange={update}
              disabled={isOfficial}
              required
            >
              <option value="additional">Additional standards</option>
              {subjects.map((subject) => (
                <option value={subject.id} key={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </label>
          {!form.id && form.isAdditional && (
            <>
            <label>
              <span>Subject</span>
              <input
                type="text"
                list="additional-subjects"
                value={form.additionalSubject || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  const course = additionalSubjects.find((item) => value === `${item.name} (${item.code})`);
                  setForm((current) => ({ ...current, additionalSubject: value, additionalSubjectId: course ? String(course.id) : "", catalogSearch: "", catalogId: "", number: "", title: "", credits: "" }));
                }}
                placeholder="Type or select a subject"
                required={!form.isAdditional}
              />
              <datalist id="additional-subjects">
                {additionalSubjects.map((subject) => <option value={`${subject.name} (${subject.code})`} key={subject.id} />)}
              </datalist>
            </label>
            <label>
              <span>NZQA standard (optional)</span>
              <input
                type="text"
                list="additional-nzqa-standards"
                value={form.catalogSearch || ""}
                onChange={chooseAdditionalStandard}
                placeholder={form.additionalSubject ? "Search for an official match, or leave blank" : "Choose a subject first"}
                disabled={!form.additionalSubject}
              />
              <datalist id="additional-nzqa-standards">
                {availableStandards.map((standard) => (
                  <option key={standard.id} value={`${standard.standard_number} — ${standard.title}`} />
                ))}
              </datalist>
            </label>
            </>
          )}
          {!form.id && !form.isAdditional && (
            <label>
              <span>Available NZQA standards</span>
              <select
                value={form.catalogId || (form.manual ? "manual" : "")}
                onChange={chooseStandard}
                required={!form.manual}
              >
                <option value="">Select a standard</option>
                {availableStandards.map((standard) => (
                  <option value={standard.id} key={standard.id}>
                    {standard.short_code} · {standard.standard_number} —{" "}
                    {standard.title} ({standard.credits} cr,{" "}
                    {standard.assessment_type})
                  </option>
                ))}
                <option value="manual">My standard is not listed</option>
              </select>
              <small>
                {availableStandards.length} official standards available for
                this class.
              </small>
            </label>
          )}
          <div className="standard-form-row">
            <label>
              <span>Standard number</span>
              <input
                name="number"
                value={form.number}
                onChange={update}
                placeholder="e.g. 91578"
                readOnly={isOfficial}
                required
              />
            </label>
            <label>
              <span>Credits</span>
              <input
                type="number"
                name="credits"
                value={form.credits}
                onChange={update}
                min="1"
                max="30"
                readOnly={isOfficial}
                required
              />
            </label>
          </div>
          <label>
            <span>Standard title</span>
            <input
              name="title"
              value={form.title}
              onChange={update}
              placeholder="Select a standard above"
              readOnly={isOfficial}
              required
            />
          </label>
          <div className="standard-form-row">
            <label>
              <span>Assessment</span>
              <select
                name="assessmentType"
                value={form.assessmentType}
                onChange={update}
                disabled={isOfficial}
              >
                <option>Internal</option>
                <option>External</option>
                {form.isAdditional && <option>Unit Standard</option>}
              </select>
            </label>
            <label>
              <span>Estimated grade</span>
              <select name="grade" value={form.grade} onChange={update}>
                <option value="">Not graded</option>
                <option value="NA">Not Achieved</option>
                <option value="A">Achieved</option>
                {form.assessmentType !== "Unit Standard" && (
                  <>
                    <option value="M">Merit</option>
                    <option value="E">Excellence</option>
                  </>
                )}
              </select>
            </label>
          </div>
          <p className="estimate-notice">
            Student-entered grades are estimates only and never overwrite official school results.
          </p>
          {isOfficial && (
            <p className="official-standard-notice">
              Official NZQA information is read-only. Only your estimated grade can be changed.
            </p>
          )}
          <label className="ue-check">
            <input
              type="checkbox"
              name="ueApproved"
              checked={form.ueApproved}
              onChange={update}
              disabled={isOfficial || form.assessmentType === "Unit Standard"}
            />
            <span>
              Count this as a University Entrance approved subject standard
            </span>
          </label>
          {error && <p className="modal-error">{error}</p>}
          <footer>
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Add standard"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default NCEA;
