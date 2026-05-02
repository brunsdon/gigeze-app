const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function formatLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnlyParts(value: string | null | undefined) {
  const match = value?.match(ISO_DATE_PREFIX);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return { year, month, day };
}

export function toDateInputValue(value: string | null | undefined) {
  const dateOnlyParts = parseDateOnlyParts(value);
  if (dateOnlyParts) {
    const { year, month, day } = dateOnlyParts;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (!value) {
    return formatLocalDateInputValue(new Date());
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? formatLocalDateInputValue(new Date()) : formatLocalDateInputValue(date);
}

export function formatDateOnlyLabel(value: string | null | undefined, fallback = "Not set") {
  const dateOnlyParts = parseDateOnlyParts(value);
  if (!dateOnlyParts) {
    return fallback;
  }

  const { year, month, day } = dateOnlyParts;
  return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
