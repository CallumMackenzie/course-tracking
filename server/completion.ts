export function todayInCourseTimeZone(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isCompleted(
  item: { type?: string; due_date?: string | null; date?: string | null; completed?: boolean },
  today = todayInCourseTimeZone()
): boolean {
  if (item.type === "participation") {
    const scheduledDate = item.due_date ?? item.date;
    return typeof scheduledDate === "string" && scheduledDate < today;
  }
  return item.completed ?? false;
}
