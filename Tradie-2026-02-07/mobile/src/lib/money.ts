/**
 * Money formatting. Done by hand rather than toLocaleString, which is unreliable
 * on Hermes (it broke number formatting in Arken).
 */
import { getRegion } from './store';

function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** £1,234.56 or $1,234.56, in the tradie's currency. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  const [whole, pence] = Math.abs(amount).toFixed(2).split('.');
  return `${sign}${getRegion().currencySymbol}${withCommas(whole)}.${pence}`;
}

/**
 * For reading on screen: £85 for whole amounts, £18.50 when there are pence. Documents,
 * exports and messages to customers use formatMoney (always with pence).
 */
export function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? formatPounds(rounded) : formatMoney(rounded);
}

/** £1,235 — for estimates where pence would be false precision. */
export function formatPounds(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${getRegion().currencySymbol}${withCommas(String(Math.round(Math.abs(amount))))}`;
}

/** Just the symbol, for input prefixes. */
export const currencySymbol = () => getRegion().currencySymbol;
