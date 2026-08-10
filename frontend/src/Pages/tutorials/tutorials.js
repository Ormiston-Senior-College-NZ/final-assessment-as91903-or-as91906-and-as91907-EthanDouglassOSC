/*
 * TUTORIAL BOOKING PAGE
 * Students submit their destination for each Tuesday and Friday tutorial.
 * Requests include the spreadsheet fields: area, details, location and teacher.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminView from "../../Components/adminView";
import "./tutorials.css";

function dateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function upcomingTutorialDates(count = 8) {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (dates.length < count) {
    if (cursor.getDay() === 2 || cursor.getDay() === 5) {
      dates.push(dateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function readableDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const EMPTY_FORM = {
  tutorialDate: "",
  bookingType: "tutorial",
  offeringId: "",
  learningArea: "",
  details: "",
  roomId: "",
};

function StudentTutorials() {
  const studentId = localStorage.getItem("studentId");
  const dates = useMemo(() => upcomingTutorialDates(), []);
  const [data, setData] = useState({ bookings: [], offerings: [], rooms: [] });
  const [form, setForm] = useState({ ...EMPTY_FORM, tutorialDate: dates[0] });
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch(`/tutorials/student/${encodeURIComponent(studentId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result);
      setStatus("ready");
    } catch (error) {
      setMessage(error.message || "Tutorial bookings could not be loaded.");
      setStatus("error");
    }
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectDate = (tutorialDate) => {
    const booking = data.bookings.find((item) => item.tutorial_date === tutorialDate);
    setForm(
      booking
        ? {
            tutorialDate,
            bookingType: booking.booking_type,
            offeringId: booking.offering_id ? String(booking.offering_id) : "",
            learningArea: booking.learning_area,
            details: booking.details,
            roomId: String(booking.room_id),
          }
        : { ...EMPTY_FORM, tutorialDate },
    );
    setMessage("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch(`/tutorials/student/${encodeURIComponent(studentId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await loadData();
    } catch (error) {
      setMessage(error.message || "Tutorial request could not be saved.");
      setStatus("ready");
    }
  };

  if (status === "loading") return <main><p>Loading tutorials…</p></main>;
  if (status === "error") return <main><p>{message}</p></main>;

  const dateOfferings = data.offerings.filter(
    (offering) => offering.tutorial_date === form.tutorialDate,
  );
  const selectedOffering = dateOfferings.find(
    (offering) => String(offering.id) === form.offeringId,
  );

  return (
    <main className="tutorials-page">
      <header className="tutorials-heading">
        <h1>Tutorials</h1>
        <p>Tell your Learning Advisor where you will be every Tuesday and Friday.</p>
      </header>

      <section className="tutorial-date-list" aria-label="Upcoming tutorial dates">
        {dates.map((tutorialDate) => {
          const booking = data.bookings.find((item) => item.tutorial_date === tutorialDate);
          return (
            <button
              type="button"
              className={form.tutorialDate === tutorialDate ? "active" : ""}
              onClick={() => selectDate(tutorialDate)}
              key={tutorialDate}
            >
              <strong>{readableDate(tutorialDate)}</strong>
              <span className={`tutorial-status ${booking?.status || "missing"}`}>
                {booking ? booking.status : "Not submitted"}
              </span>
            </button>
          );
        })}
      </section>

      <section className="tutorial-booking-panel">
        <header>
          <div>
            <h2>{readableDate(form.tutorialDate)}</h2>
            <p>Choose a teacher-run tutorial or tell your LA where you will work independently.</p>
          </div>
        </header>
        <form onSubmit={submit}>
          <fieldset className="tutorial-choice-field">
            <legend>What are you doing?</legend>
            <label><input type="radio" name="bookingType" value="tutorial" checked={form.bookingType === "tutorial"} onChange={(event) => setForm({ ...form, bookingType: event.target.value, offeringId: "" })} /> Tutorial</label>
            <label><input type="radio" name="bookingType" value="independent" checked={form.bookingType === "independent"} onChange={(event) => setForm({ ...form, bookingType: event.target.value, offeringId: "" })} /> Independent learning</label>
          </fieldset>

          {form.bookingType === "tutorial" ? <>
          <label className="tutorial-details-field">
            <span>Available tutorial — Code / Subject</span>
            <select
              value={form.offeringId}
              onChange={(event) => setForm({ ...form, offeringId: event.target.value })}
              required
            >
              <option value="">Select a tutorial</option>
              {dateOfferings.map((offering) => (
                <option value={offering.id} key={offering.id}>
                  {offering.learning_area} — {offering.teacher_code} — {offering.room_code}
                </option>
              ))}
            </select>
          </label>
          {selectedOffering && <div className="tutorial-offering-summary">
            <strong>{selectedOffering.learning_area}</strong>
            <span>{selectedOffering.details}</span>
            <span>{selectedOffering.teacher_code} — {selectedOffering.teacher_name}</span>
            <span>{selectedOffering.room_code} — {selectedOffering.room_name}</span>
          </div>}
          {!dateOfferings.length && <p className="tutorial-details-field tutorial-empty">No teacher-run tutorials have been added for this date yet.</p>}
          </> : <>
          <label>
            <span>Learning area or activity</span>
            <input value={form.learningArea} onChange={(event) => setForm({ ...form, learningArea: event.target.value })} placeholder="For example: Calculus or assessment catch-up" maxLength="80" required />
          </label>
          <label>
            <span>Location</span>
            <select
              value={form.roomId}
              onChange={(event) => setForm({ ...form, roomId: event.target.value })}
              required
            >
              <option value="">Select location</option>
              {data.rooms.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.code} — {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="tutorial-details-field">
            <span>What will you work on?</span>
            <textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Add the task, assessment or study goal" maxLength="250" required />
          </label>
          </>}
          <footer>
            <div className="tutorial-message" role="status">{message}</div>
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Sending…" : "Send for approval"}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}

function Tutorials() {
  return localStorage.getItem("isAdmin") === "true" ? (
    <AdminView page="kainga" />
  ) : (
    <StudentTutorials />
  );
}

export default Tutorials;
