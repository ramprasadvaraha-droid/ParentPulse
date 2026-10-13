function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) return null;
  return { year, month, day };
}

function daysAfterDeadline(joinedDate: string, today: string) {
  const joined = parseDate(joinedDate);
  const current = parseDate(today);
  if (!joined || !current) return null;

  const joinedMonth = joined.year * 12 + joined.month;
  const currentMonth = current.year * 12 + current.month;
  if (currentMonth <= joinedMonth) return null;

  const dueDay = Math.min(
    joined.day,
    new Date(Date.UTC(current.year, current.month, 0)).getUTCDate(),
  );
  const dueTime = Date.UTC(current.year, current.month - 1, dueDay);
  const currentTime = Date.UTC(current.year, current.month - 1, current.day);
  const elapsedDays = (currentTime - dueTime) / 86_400_000;
  return elapsedDays > 0 ? elapsedDays : null;
}

export function isFeeReminderDue(joinedDate: string, today: string) {
  return daysAfterDeadline(joinedDate, today) !== null;
}

export function isAlternateFeeReminderDay(joinedDate: string, today: string) {
  const elapsedDays = daysAfterDeadline(joinedDate, today);
  return elapsedDays !== null && elapsedDays % 2 === 1;
}