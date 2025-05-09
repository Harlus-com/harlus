import { Timestamp } from "./common_api_types";

export function timestampToDate(timestamp: Timestamp): Date {
  return new Date(
    timestamp.year,
    timestamp.month - 1,
    timestamp.day,
    timestamp.hour,
    timestamp.minute,
    timestamp.second
  );
}

export function dateToTimestamp(date: Date): Timestamp {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

export function timestampNow(): Timestamp {
  return dateToTimestamp(new Date());
}

export function formatTimestamp(timestamp: Timestamp): string {
  const date = new Date(timestamp.year, timestamp.month - 1, timestamp.day);
  const amPm = toAmPm(timestamp.hour);
  const hour = toTwoDigit(timestamp.hour);
  const minute = toTwoDigit(timestamp.minute);
  const day = todayYesterdayOrNDaysAgo(date);
  return `${hour}:${minute} ${amPm} | ${day}`;
}

function toAmPm(hour: number): string {
  return hour < 12 ? "am" : "pm";
}

function toTwoDigit(hour: number): string {
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return twelveHour < 10 ? `0${twelveHour}` : `${twelveHour}`;
}

function todayYesterdayOrNDaysAgo(date: Date): string {
  console.log("date", date);
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Today";
  }
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1
  );
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  const n = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  return `${n} days ago`;
}
