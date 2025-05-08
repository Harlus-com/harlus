import { Timestamp } from "./common_api_types";

export function timestampToDate(timestamp: Timestamp): Date {
  return new Date(
    timestamp.year,
    timestamp.month,
    timestamp.day,
    timestamp.hour,
    timestamp.minute,
    timestamp.second
  );
}

export function dateToTimestamp(date: Date): Timestamp {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

export function timestampNow(): Timestamp {
  return dateToTimestamp(new Date());
}
