import { useEffect, useMemo, useState } from "react";
import "./ncea.css";

const GRADE_POINTS = { NA: 0, A: 2, M: 3, E: 4 };
const GRADE_NAMES = { "": "Not graded", NA: "Not Achieved", A: "Achieved", M: "Merit", E: "Excellence" };
const EMPTY_STANDARD = { courseId: "", catalogId: "", number: "", title: "", credits: "", assessmentType: "Internal", grade: "", ueApproved: true, manual: false };

function NCEA() {
  const studentId = localStorage.getItem("studentId");
  const [subjects, setSubjects] = useState([]);
  const [standards, setStandards] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState("loading");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    if (!studentId) return setStatus("signed-out");
    try {
      const [subjectResponse, standardResponse, catalogResponse] = await Promise.all([
        fetch(`/subjects/${encodeURIComponent(studentId)}`),
        fetch(`/ncea/${encodeURIComponent(studentId)}`),
        fetch(`/ncea/catalog/${encodeURIComponent(studentId)}`),
      ]);
      if (!subjectResponse.ok || !standardResponse.ok || !catalogResponse.ok) throw new Error();
      setSubjects(await subjectResponse.json());
      setStandards(await standardResponse.json());
      setCatalog(await catalogResponse.json());
      setStatus("ready");
    } catch { setStatus("error"); }
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);

  const calculations = useMemo(() => {
    const recorded = standards.filter((item) => item.grade);
    const attemptedCredits = recorded.reduce((sum, item) => sum + item.credits, 0);
    const achieved = recorded.filter((item) => item.grade !== "NA");
    const achievedCredits = achieved.reduce((sum, item) => sum + item.credits, 0);
    const gpaPoints = recorded.reduce((sum, item) => sum + GRADE_POINTS[item.grade] * item.credits, 0);
    const gpa = attemptedCredits ? gpaPoints / attemptedCredits : 0;

    const bySubject = standards.filter((item) => item.ue_approved && (item.course_level === 3 || item.course_level === 23) && ["A", "M", "E"].includes(item.grade))
      .reduce((groups, item) => ({ ...groups, [item.course_id]: [...(groups[item.course_id] || []), item] }), {});
    const eligibleCredits = Object.values(bySubject).flatMap((items) => {
      const creditPoints = items.flatMap((item) => Array(item.credits).fill(GRADE_POINTS[item.grade]));
      return creditPoints.sort((a, b) => b - a).slice(0, 24);
    }).sort((a, b) => b - a).slice(0, 80);

    return { attemptedCredits, achievedCredits, gpa, rankScore: eligibleCredits.reduce((sum, points) => sum + points, 0), rankCredits: eligibleCredits.length };
  }, [standards]);

  const saveStandard = async (form, id) => {
    const response = await fetch(id ? `/ncea/${studentId}/${id}` : `/ncea/${studentId}`, {
      method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, courseId: Number(form.courseId), credits: Number(form.credits) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    setModal(null); setNotice(data.message); await loadData();
  };

  const updateGrade = async (standard, grade) => {
    try {
      await saveStandard({ courseId: standard.course_id, number: standard.standard_number, title: standard.title, credits: standard.credits, assessmentType: standard.assessment_type, grade, ueApproved: Boolean(standard.ue_approved) }, standard.id);
    } catch (error) { setNotice(error.message); }
  };

  const deleteStandard = async (standard) => {
    if (!window.confirm(`Remove standard ${standard.standard_number}?`)) return;
    const response = await fetch(`/ncea/${studentId}/${standard.id}`, { method: "DELETE" });
    const data = await response.json();
    setNotice(data.message); if (response.ok) await loadData();
  };

  if (status === "loading") return <div className="ncea-state">Loading your NCEA results…</div>;
  if (status === "signed-out") return <div className="ncea-state">Log in to view NCEA results.</div>;
  if (status === "error") return <div className="ncea-state error">Your NCEA information could not be loaded.</div>;

  return <main className="ncea-page">
    <header className="ncea-heading"><div><span className="ncea-eyebrow">Achievement tracker</span><h1>NCEA results</h1><p>Track standards and model your current academic progress.</p></div><button onClick={() => setModal({ ...EMPTY_STANDARD, courseId: subjects[0] ? String(subjects[0].id) : "" })}>+ Add standard</button></header>
    {notice && <div className="ncea-toast" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    <section className="ncea-summary">
      <article className="rank-card"><span>Estimated rank score</span><strong>{calculations.rankScore}</strong><small>{calculations.rankCredits} of 80 eligible Level 3 credits counted</small><div className="score-bar"><i style={{ width: `${Math.min(100, calculations.rankScore / 3.2)}%` }} /></div><p>Maximum possible score: 320</p></article>
      <article><span>Weighted GPA</span><strong>{calculations.gpa.toFixed(2)}</strong><small>4.00 credit-weighted scale</small><div className="gpa-scale"><span>N</span><span>A</span><span>M</span><span>E</span></div></article>
      <article><span>Credits achieved</span><strong>{calculations.achievedCredits}</strong><small>{calculations.attemptedCredits} assessed credits recorded</small><div className="credit-breakdown">{["E", "M", "A"].map((grade) => <span key={grade}><b>{standards.filter((item) => item.grade === grade).reduce((sum, item) => sum + item.credits, 0)}</b>{GRADE_NAMES[grade]}</span>)}</div></article>
    </section>

    <section className="ncea-info"><strong>How estimates work</strong><p>GPA uses N=0, A=2, M=3 and E=4, weighted by credits. Rank score uses the best 80 eligible Level 3 credits, capped at 24 credits per approved subject. Always confirm official results and entry requirements with NZQA and your chosen provider.</p></section>

    <div className="ncea-subjects">{subjects.map((subject) => { const items = standards.filter((item) => item.course_id === subject.id); const credits = items.filter((item) => ["A", "M", "E"].includes(item.grade)).reduce((sum, item) => sum + item.credits, 0); return <section className="ncea-subject-card" key={subject.id}><header><div><span className="subject-code">{subject.code}</span><div><h2>{subject.name}</h2><p>{subject.level === 23 ? "NCEA Levels 2 & 3" : `NCEA Level ${subject.level}`} · Line {subject.line}</p></div></div><div><strong>{credits}</strong><span>credits</span></div></header>{items.length ? <div className="standards-table"><div className="standard-head"><span>Standard</span><span>Assessment</span><span>Credits</span><span>Grade</span><span /></div>{items.map((item) => <article key={item.id}><div><strong>{item.short_code ? `${item.short_code} · ${item.standard_number}` : item.standard_number}</strong><span>{item.title}</span>{item.ue_approved ? <small>UE approved subject</small> : null}</div><span className={`assessment ${item.assessment_type.toLowerCase()}`}>{item.assessment_type}</span><b>{item.credits}</b><select className={`grade-select grade-${item.grade || "pending"}`} value={item.grade} onChange={(event) => updateGrade(item, event.target.value)}><option value="">Not graded</option><option value="NA">Not Achieved</option><option value="A">Achieved</option><option value="M">Merit</option><option value="E">Excellence</option></select><div className="standard-actions"><button onClick={() => setModal({ courseId: String(item.course_id), number: item.standard_number, title: item.title, credits: String(item.credits), assessmentType: item.assessment_type, grade: item.grade, ueApproved: Boolean(item.ue_approved), id: item.id })}>Edit</button><button className="delete" onClick={() => deleteStandard(item)}>Delete</button></div></article>)}</div> : <div className="empty-standards"><p>No standards added for this class.</p><button onClick={() => setModal({ ...EMPTY_STANDARD, courseId: String(subject.id) })}>Add a standard</button></div>}</section>; })}</div>

    {modal && <StandardModal form={modal} subjects={subjects} catalog={catalog} selectedStandards={standards} onClose={() => setModal(null)} onSave={saveStandard} />}
  </main>;
}

function StandardModal({ form: initialForm, subjects, catalog, selectedStandards, onClose, onSave }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const availableStandards = catalog.filter((item) => String(item.course_id) === String(form.courseId) && (!selectedStandards.some((selected) => selected.standard_number === item.standard_number) || item.standard_number === form.number));
  const update = (event) => { const { name, value, type, checked } = event.target; setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value, ...(name === "courseId" ? { catalogId: "", number: "", title: "", credits: "", manual: false } : {}) })); };
  const chooseStandard = (event) => {
    const value = event.target.value;
    if (value === "manual") return setForm((current) => ({ ...current, catalogId: "", number: "", title: "", credits: "", manual: true }));
    const standard = catalog.find((item) => String(item.id) === value && String(item.course_id) === String(form.courseId));
    if (!standard) return setForm((current) => ({ ...current, catalogId: "" }));
    setForm((current) => ({ ...current, catalogId: value, number: standard.standard_number, title: standard.title, credits: String(standard.credits), assessmentType: standard.assessment_type, manual: false }));
  };
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); try { await onSave(form, form.id); } catch (requestError) { setError(requestError.message); setSaving(false); } };
  return <div className="standard-modal-backdrop"><section className="standard-modal" role="dialog" aria-modal="true"><header><div><span className="ncea-eyebrow">{form.id ? "Edit standard" : "Choose standards"}</span><h2>{form.id ? form.number : "Add an assessment"}</h2></div><button onClick={onClose}>×</button></header><form onSubmit={submit}><label><span>Class</span><select name="courseId" value={form.courseId} onChange={update} required>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name} ({subject.code})</option>)}</select></label>{!form.id && <label><span>Available NZQA standards</span><select value={form.catalogId || (form.manual ? "manual" : "")} onChange={chooseStandard} required={!form.manual}><option value="">Select a standard</option>{availableStandards.map((standard) => <option value={standard.id} key={standard.id}>{standard.short_code} · {standard.standard_number} — {standard.title} ({standard.credits} cr, {standard.assessment_type})</option>)}<option value="manual">My standard is not listed</option></select><small>{availableStandards.length} official standards available for this class.</small></label>}<div className="standard-form-row"><label><span>Standard number</span><input name="number" value={form.number} onChange={update} placeholder="e.g. 91578" readOnly={!form.manual && !form.id} required /></label><label><span>Credits</span><input type="number" name="credits" value={form.credits} onChange={update} min="1" max="30" readOnly={!form.manual && !form.id} required /></label></div><label><span>Standard title</span><input name="title" value={form.title} onChange={update} placeholder="Select a standard above" readOnly={!form.manual && !form.id} required /></label><div className="standard-form-row"><label><span>Assessment</span><select name="assessmentType" value={form.assessmentType} onChange={update} disabled={!form.manual && !form.id}><option>Internal</option><option>External</option></select></label><label><span>Current grade</span><select name="grade" value={form.grade} onChange={update}><option value="">Not graded</option><option value="NA">Not Achieved</option><option value="A">Achieved</option><option value="M">Merit</option><option value="E">Excellence</option></select></label></div><label className="ue-check"><input type="checkbox" name="ueApproved" checked={form.ueApproved} onChange={update} /><span>Count this as a University Entrance approved subject standard</span></label>{error && <p className="modal-error">{error}</p>}<footer><button type="button" className="cancel" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Add standard"}</button></footer></form></section></div>;
}

export default NCEA;
