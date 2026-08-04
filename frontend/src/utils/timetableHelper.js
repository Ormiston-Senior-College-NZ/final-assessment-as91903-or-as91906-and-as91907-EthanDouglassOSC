function toMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getCurrentLesson(lessons, now = new Date()) {
  const day = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const lesson of lessons) {
    if (lesson.day !== day) continue;

    const start = toMinutes(lesson.start);
    const end = toMinutes(lesson.end);

    if (currentMinutes >= start && currentMinutes < end) {
      return lesson;
    }
  }

  return null;
}
