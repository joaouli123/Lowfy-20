const SAO_PAULO_TZ = 'America/Sao_Paulo';
const SAO_PAULO_OFFSET_HOURS = 3;

function getSaoPauloDateParts(date: Date = new Date()): { year: number; month: number; day: number; hour: number; minute: number; second: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon';
  const weekdayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    dayOfWeek: weekdayMap[weekdayStr] ?? 0
  };
}

export function getNowSaoPaulo(): Date {
  return new Date();
}

export function startOfDaySaoPaulo(date: Date = new Date()): Date {
  const parts = getSaoPauloDateParts(date);
  const midnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day, SAO_PAULO_OFFSET_HOURS, 0, 0, 0);
  return new Date(midnightUtc);
}

export function endOfDaySaoPaulo(date: Date = new Date()): Date {
  const parts = getSaoPauloDateParts(date);
  const endOfDayUtc = Date.UTC(parts.year, parts.month - 1, parts.day, SAO_PAULO_OFFSET_HOURS + 23, 59, 59, 999);
  return new Date(endOfDayUtc);
}

export function addDaysSaoPaulo(date: Date, days: number): Date {
  const result = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}

export function subtractDaysSaoPaulo(date: Date, days: number): Date {
  return addDaysSaoPaulo(date, -days);
}

export function getWeekBoundariesSaoPaulo(): { start: Date; end: Date } {
  const now = new Date();
  const parts = getSaoPauloDateParts(now);
  const dayOfWeek = parts.dayOfWeek;
  
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const todayMidnight = startOfDaySaoPaulo(now);
  const weekStart = addDaysSaoPaulo(todayMidnight, diffToMonday);
  const weekEnd = endOfDaySaoPaulo(addDaysSaoPaulo(weekStart, 6));
  
  return { start: weekStart, end: weekEnd };
}

export function daysAgoSaoPaulo(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function hoursAgoSaoPaulo(hours: number): Date {
  const now = new Date();
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function minutesAgoSaoPaulo(minutes: number): Date {
  const now = new Date();
  return new Date(now.getTime() - minutes * 60 * 1000);
}

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TZ });
}

export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', { timeZone: SAO_PAULO_TZ });
}

export function isSameDaySaoPaulo(date1: Date, date2: Date): boolean {
  const parts1 = getSaoPauloDateParts(date1);
  const parts2 = getSaoPauloDateParts(date2);
  return parts1.year === parts2.year &&
         parts1.month === parts2.month &&
         parts1.day === parts2.day;
}

export function getDaysRemainingUntil(futureDate: Date | string | null | undefined): number {
  if (!futureDate) return 0;
  const now = new Date();
  const target = typeof futureDate === 'string' ? new Date(futureDate) : futureDate;
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDaysElapsedSince(pastDate: Date | string | null | undefined): number {
  if (!pastDate) return 0;
  const now = new Date();
  const target = typeof pastDate === 'string' ? new Date(pastDate) : pastDate;
  const diffTime = now.getTime() - target.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function isExpiredSaoPaulo(date: Date | string | null | undefined): boolean {
  if (!date) return true;
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  return target < now;
}

export function isWithinDaysSaoPaulo(date: Date | string | null | undefined, days: number): boolean {
  if (!date) return false;
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffTime = target.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

export function getTodayISOStringSaoPaulo(): string {
  const parts = getSaoPauloDateParts();
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function toSaoPauloDate(date: Date | string | null | undefined): Date {
  if (!date) return new Date();
  return typeof date === 'string' ? new Date(date) : new Date(date.getTime());
}

/**
 * Parse a date string (yyyy-MM-dd) and return the start of that day in São Paulo timezone.
 * This function correctly handles the timezone conversion regardless of the host timezone.
 * @param dateStr - Date string in yyyy-MM-dd format
 * @returns Date object representing 00:00:00 São Paulo time on the specified day
 */
export function parseDateStringToStartOfDaySaoPaulo(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create midnight UTC + São Paulo offset (3 hours for standard time)
  // This represents 00:00:00 São Paulo time
  const midnightUtc = Date.UTC(year, month - 1, day, SAO_PAULO_OFFSET_HOURS, 0, 0, 0);
  return new Date(midnightUtc);
}

/**
 * Parse a date string (yyyy-MM-dd) and return the end of that day in São Paulo timezone.
 * This function correctly handles the timezone conversion regardless of the host timezone.
 * @param dateStr - Date string in yyyy-MM-dd format
 * @returns Date object representing 23:59:59.999 São Paulo time on the specified day
 */
export function parseDateStringToEndOfDaySaoPaulo(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create 23:59:59.999 UTC + São Paulo offset (3 hours for standard time)
  // This represents 23:59:59.999 São Paulo time
  const endOfDayUtc = Date.UTC(year, month - 1, day, SAO_PAULO_OFFSET_HOURS + 23, 59, 59, 999);
  return new Date(endOfDayUtc);
}
