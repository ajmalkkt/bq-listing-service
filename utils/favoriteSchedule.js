const formatParts = (date, timezone) => {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(values.map(({ type, value }) => [type, Number(value)]));
};

const localToUtc = (parts, timezone) => {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = formatParts(new Date(candidate), timezone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const difference = target - represented;
    if (difference === 0) break;
    candidate += difference;
  }
  return new Date(candidate);
};

export const nextFavoriteDigestAt = (preference, from = new Date()) => {
  const timezone = preference.timezone || "Asia/Qatar";
  const localNow = formatParts(from, timezone);
  const currentLocal = Date.UTC(localNow.year, localNow.month - 1, localNow.day, localNow.hour, localNow.minute, localNow.second);
  let target = { year: localNow.year, month: localNow.month, day: localNow.day, hour: 9 };

  if (preference.cadence === "once") {
    if (!preference.oneTimeDate) return null;
    const oneTime = new Date(preference.oneTimeDate);
    const datePart = typeof preference.oneTimeDate === "string"
      ? preference.oneTimeDate.slice(0, 10).split("-").map(Number)
      : [oneTime.getUTCFullYear(), oneTime.getUTCMonth() + 1, oneTime.getUTCDate()];
    target = { year: datePart[0], month: datePart[1], day: datePart[2], hour: 9 };
  } else if (preference.cadence === "monthly") {
    const isDueToday = localNow.day === 1 && localNow.hour < 9;
    if (!isDueToday) {
      const month = new Date(Date.UTC(localNow.year, localNow.month, 1));
      target = { year: month.getUTCFullYear(), month: month.getUTCMonth() + 1, day: 1, hour: 9 };
    }
  } else if (preference.cadence === "weekly") {
    const weekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay();
    const daysUntilMonday = (8 - weekday) % 7;
    const isDueToday = weekday === 1 && localNow.hour < 9;
    if (!isDueToday) {
      const next = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day + (daysUntilMonday || 7)));
      target = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 9 };
    }
  } else if (localNow.hour >= 9) {
    const next = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day + 1));
    target = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 9 };
  }

  const scheduled = localToUtc(target, timezone);
  if (preference.cadence === "once" && scheduled.getTime() <= from.getTime()) return null;
  if (preference.cadence !== "once" && Date.UTC(target.year, target.month - 1, target.day, 9) <= currentLocal && target.year === localNow.year && target.month === localNow.month && target.day === localNow.day) {
    target.hour = 9;
    const next = new Date(Date.UTC(target.year, target.month - 1, target.day + 1));
    return localToUtc({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 9 }, timezone);
  }
  return scheduled;
};

export const favoriteDateEndAt = (date, timezone) => {
  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) throw new TypeError("Date must use YYYY-MM-DD format");
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() + 1 !== month || parsedDate.getUTCDate() !== day) {
    throw new TypeError("Date must be a valid calendar date");
  }
  const followingDay = new Date(Date.UTC(year, month - 1, day + 1));
  return new Date(localToUtc({
    year: followingDay.getUTCFullYear(),
    month: followingDay.getUTCMonth() + 1,
    day: followingDay.getUTCDate(),
    hour: 0,
  }, timezone).getTime() - 1);
};
