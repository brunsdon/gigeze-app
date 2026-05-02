const APP_LOCALE = "en-AU";
export const APP_TIME_ZONE = "Australia/Sydney";

type SupportedDateValue = Date | string | number;
type AppDateTimeFormatOptions = Omit<Intl.DateTimeFormatOptions, "timeZone">;

function coerceValidDate(value?: SupportedDateValue | null) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getDateParts(value: SupportedDateValue, options: AppDateTimeFormatOptions) {
  const date = coerceValidDate(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
}

function getTimeZoneOffsetMs(date: Date) {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") {
    return 0;
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * ((hours * 60) + minutes) * 60 * 1000;
}

function parseAppZonedDateTime(value: string, timeValue: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const [, yearText, monthText, dayText] = match;
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!timeMatch) {
    return undefined;
  }

  const [, hoursText, minutesText, secondsText, millisecondsText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  const milliseconds = Number(millisecondsText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    !Number.isInteger(milliseconds)
  ) {
    return undefined;
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
  if (Number.isNaN(utcGuess.getTime())) {
    return undefined;
  }

  const firstPass = new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess));
  const adjustedOffsetMs = getTimeZoneOffsetMs(firstPass);
  const resolvedDate = new Date(utcGuess.getTime() - adjustedOffsetMs);
  return Number.isNaN(resolvedDate.getTime()) ? undefined : resolvedDate;
}

export function parseAppDateTime(value?: string | null, timeValue?: string | null) {
  if (!value || !timeValue) {
    return undefined;
  }

  const trimmedDate = value.trim();
  const trimmedTime = timeValue.trim();
  if (!trimmedDate || !trimmedTime) {
    return undefined;
  }

  return parseAppZonedDateTime(trimmedDate, `${trimmedTime}:00.000`);
}

export function formatInAppTimeZone(
  value: SupportedDateValue | null | undefined,
  options: AppDateTimeFormatOptions,
  fallback = "-",
) {
  const date = coerceValidDate(value);
  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatDateInputValue(value?: SupportedDateValue | null) {
  const parts = value ? getDateParts(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) : null;
  const year = parts?.find((part) => part.type === "year")?.value;
  const month = parts?.find((part) => part.type === "month")?.value;
  const day = parts?.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

export function formatTimeInputValue(value?: SupportedDateValue | null) {
  const parts = value ? getDateParts(value, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }) : null;
  const hour = parts?.find((part) => part.type === "hour")?.value;
  const minute = parts?.find((part) => part.type === "minute")?.value;

  if (!hour || !minute) {
    return "";
  }

  return `${hour}:${minute}`;
}

export function currentDateInputValue(now = new Date()) {
  return formatDateInputValue(now);
}

export function formatAppDateKey(value?: SupportedDateValue | null) {
  return formatDateInputValue(value);
}

export function parseAppDateStart(value?: string | null) {
  if (!value) {
    return undefined;
  }

  return parseAppZonedDateTime(value, "00:00:00.000");
}

export function parseAppDateEnd(value?: string | null) {
  if (!value) {
    return undefined;
  }

  return parseAppZonedDateTime(value, "23:59:59.999");
}
