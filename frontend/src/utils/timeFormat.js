/* Shared 12/24-hour preference and formatting for clocks and timetable values. */
import { useEffect, useState } from "react";

const STORAGE_KEY = "studentnet-time-format";
const CHANGE_EVENT = "studentnet-time-format-changed";

export function getTimeFormat() {
  return localStorage.getItem(STORAGE_KEY) === "12" ? "12" : "24";
}

export function saveTimeFormat(value) {
  const format = value === "12" ? "12" : "24";
  localStorage.setItem(STORAGE_KEY, format);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: format }));
}

export function useTimeFormat() {
  const [format, setFormat] = useState(getTimeFormat);
  useEffect(() => {
    const update = (event) => setFormat(event.detail || getTimeFormat());
    window.addEventListener(CHANGE_EVENT, update);
    return () => window.removeEventListener(CHANGE_EVENT, update);
  }, []);
  return [format, saveTimeFormat];
}

export function formatTime(value, format = getTimeFormat()) {
  if (!value) return "";
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  if (format === "24") return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const suffix = hours >= 12 ? "pm" : "am";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start, end, format = getTimeFormat()) {
  return `${formatTime(start, format)}–${formatTime(end, format)}`;
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

export function durationMinutes(start, end) {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

export function breakName(start, end) {
  return timeToMinutes(end) >= 12 * 60 ? "Lunch break" : "Morning break";
}

export function formatClock(date, format = getTimeFormat()) {
  return date.toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: format === "12",
  }).toLowerCase();
}
