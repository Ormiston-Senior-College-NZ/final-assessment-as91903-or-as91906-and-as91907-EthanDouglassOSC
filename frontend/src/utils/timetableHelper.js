import timetable from "../data/timetable";

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getCurrentLesson(day = "day1") {
  const now = new Date();

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const lessons = timetable[day];

  for (const lesson of lessons) {
    const start = toMinutes(lesson.start);
    const end = toMinutes(lesson.end);

    if (currentMinutes >= start && currentMinutes < end) {
      return lesson;
    }
  }

  return null;
}