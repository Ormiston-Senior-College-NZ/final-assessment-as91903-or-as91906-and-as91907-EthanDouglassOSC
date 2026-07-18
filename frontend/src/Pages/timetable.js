import timetable from "../data/timetable";
import "./timetable.css";

function Timetable() {
  return (
    <div>
      <h1>Timetable</h1>

      <div className="day-selector">
        <button>Day 1</button>
        <button>Day 2</button>
        <button>Day 3</button>
        <button>Day 4</button>
        <button>Day 5</button>
      </div>

      <table className="timetable-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Time</th>
            <th>Subject</th>
            <th>Room</th>
          </tr>
        </thead>

        <tbody>
          {timetable.day1.map((lesson, index) => (
            <tr key={index}>
              <td>{lesson.session}</td>
              <td>{lesson.time}</td>
              <td>{lesson.subject}</td>
              <td>{lesson.room}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Timetable;