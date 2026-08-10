/*
 * TIMETABLE TIME HELPERS
 * Converts HH:MM strings to comparable minute values and finds the lesson whose
 * weekday/start/end range contains a supplied Date object.
 */
function toMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Return the lesson whose day/time range contains the supplied date.
export function getCurrentLesson(lessons, now = new Date()) {
  const day = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const lesson of lessons) {
    if (lesson.day !== day) continue;

    const start = toMinutes(lesson.start_time);
    const end = toMinutes(lesson.end_time);

    if (currentMinutes >= start && currentMinutes < end) {
      return lesson;
    }
  }

  return null;
}
