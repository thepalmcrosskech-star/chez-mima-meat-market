// Horaires de prise de commande par jour (heure du Maroc).
export type DayHours = { closed: boolean; open: string; close: string; breakStart: string; breakEnd: string };
export type WeeklyHours = DayHours[]; // index 0 = lundi ... 6 = dimanche

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TZ = "Africa/Casablanca";

export const defaultWeeklyHours = (open = "10:00", close = "20:30"): WeeklyHours =>
  WD.map((d) => ({ closed: false, open, close, breakStart: d === "Fri" ? "13:00" : "", breakEnd: d === "Fri" ? "14:30" : "" }));

export const parseWeeklyHours = (raw: unknown, fallbackOpen?: string, fallbackClose?: string): WeeklyHours => {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(v) && v.length === 7) return v as WeeklyHours;
  } catch { /* ignore */ }
  return defaultWeeklyHours(fallbackOpen || "10:00", fallbackClose || "20:30");
};

const toMin = (t: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };

const casa = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, mins: (+p.hour % 24) * 60 + +p.minute, day: WD.indexOf(p.weekday) };
};

const inBreak = (h: DayHours, mins: number) => {
  const bs = toMin(h.breakStart), be = toMin(h.breakEnd);
  return bs !== null && be !== null && be > bs && mins >= bs && mins < be;
};

export const isOpenAt = (w: WeeklyHours, now = new Date()) => {
  const c = casa(now); const h = w[c.day];
  if (!h || h.closed) return false;
  const o = toMin(h.open), cl = toMin(h.close);
  if (o === null || cl === null) return false;
  return c.mins >= o && c.mins < cl && !inBreak(h, c.mins);
};

const casaToUtc = (y: number, mo: number, d: number, mins: number) => {
  const guess = new Date(Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60));
  const g = casa(guess);
  const offset = Date.UTC(g.y, g.mo - 1, g.d, Math.floor(g.mins / 60), g.mins % 60) - guess.getTime();
  return new Date(guess.getTime() - offset);
};

/** Prochain moment où les commandes sont ouvertes (fin de pause, ouverture du jour ou d'un jour suivant). */
export const nextOpening = (w: WeeklyHours, now = new Date()): Date | null => {
  const c = casa(now);
  for (let i = 0; i < 8; i++) {
    const h = w[(c.day + i) % 7];
    if (!h || h.closed) continue;
    const o = toMin(h.open), cl = toMin(h.close);
    if (o === null || cl === null) continue;
    const candidates = [o];
    const be = toMin(h.breakEnd); if (be !== null && toMin(h.breakStart) !== null) candidates.push(be);
    for (const m of candidates.sort((a, b) => a - b)) {
      if (m >= cl) continue;
      if (i === 0 && m <= c.mins) continue;
      return casaToUtc(c.y, c.mo, c.d + i, m);
    }
  }
  return null;
};
