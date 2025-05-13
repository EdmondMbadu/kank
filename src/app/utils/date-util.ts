/**
 * Return our canonical key:  M‑D‑YYYY‑HH‑mm‑ss   (all LOCAL time)
 *
 * • Accepts a JS Date, an ISO string (YYYY‑MM‑DD or full ISO),
 *   or an existing M‑D‑YYYY(‑HH‑mm‑ss) string.
 * • Leading zeros are suppressed on M and D but kept on HH & mm.
 */
export const toAppDateFull = (d: string | Date): string => {
  /* ---------- If we already have a Date object ---------- */
  if (d instanceof Date) {
    return toKeyFromDate(d);
  }

  const raw = d.trim();

  /* ---------- Already in our app format? ---------- */
  // 3 or 6 parts, first chunk ≤ 2 chars  → keep (add zeros if only 3 parts)
  const parts = raw.split('-');
  if (parts[0].length <= 2) {
    if (parts.length === 6) return raw; // full key
    // add "00-00-00" for time
    return `${raw}-00-00-00`;
  }

  /* ---------- ISO input (YYYY‑MM‑DD or full ISO) ---------- */
  let dateObj: Date;
  if (raw.includes('T')) {
    // full ISO with time
    dateObj = new Date(raw);
  } else {
    // date‑only ISO -> build local Date  (avoid UTC shift)
    const [y, m, d2] = raw.split('-').map(Number);
    dateObj = new Date(y, m - 1, d2);
  }

  return toKeyFromDate(dateObj);
};

/* helper that extracts LOCAL parts */
function toKeyFromDate(dt: Date): string {
  const month = dt.getMonth() + 1; // 0‑based → 1‑based
  const day = dt.getDate();
  const year = dt.getFullYear();
  const hour = dt.getHours().toString().padStart(2, '0');
  const minute = dt.getMinutes().toString().padStart(2, '0');
  const second = dt.getSeconds().toString().padStart(2, '0');
  return `${month}-${day}-${year}-${hour}-${minute}-${second}`;
}

/**
 * Convert a JS Date or an ISO string to our M‑D‑YYYY format
 * using **local time**.  If the string is already M‑D‑YYYY,
 * return it untouched.
 */
export const toAppDate = (d: string | Date): string => {
  /* ----- If we get an actual Date, extract LOCAL parts ----- */
  if (d instanceof Date) {
    const month = d.getMonth() + 1; // 0‑based -> 1‑based
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month}-${day}-${year}`;
  }

  const asString = d.trim();

  /* already M‑D‑YYYY ? */
  if (asString.split('-')[0].length <= 2) {
    return asString;
  }

  /* assume YYYY‑MM‑DD */
  const [year, month, day] = asString.split('-');
  return `${parseInt(month, 10)}-${parseInt(day, 10)}-${year}`;
};
