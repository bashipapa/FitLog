export const r0 = (n: number) => String(Math.round(n));
export const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
export const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const md = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
};
export const signed = (n: number, digits = 0) => {
  const v = digits ? (Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits) : String(Math.round(n));
  return n > 0 ? `+${v}` : v;
};
