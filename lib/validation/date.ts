const dateFieldNames = new Set(["arrival_date", "sale_date", "expense_date", "weighbridge_date"]);

export function isDateField(fieldName: string) {
  return dateFieldNames.has(fieldName);
}

export function normalizeDateString(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string") return value;

  const text = value.trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && isRealDate(text)) return text;

  const slashOrDash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!slashOrDash) return null;

  const day = Number(slashOrDash[1]);
  const month = Number(slashOrDash[2]);
  const year = Number(slashOrDash[3]);
  const iso = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  return isRealDate(iso) ? iso : null;
}

function isRealDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
