/**
 * Formats whole cents as "CAD 2,000.00". Deterministic on server and browser
 * (no `toLocaleString`), so it is safe in rendered output.
 */
export function formatMoney(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${sign}${currency.toUpperCase()} ${whole}.${fraction}`;
}
