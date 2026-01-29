export function formatTimeAgo(date: Date | string): string {
  // Converter para timezone de Brasília (UTC-3)
  const brazilTimezone = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Get current time in Brazil timezone
  const nowFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const nowBrazil = nowFormatter.formatToParts(new Date());
  const thenBrazil = brazilTimezone.formatToParts(new Date(date));
  
  // Reconstruct dates in Brazil timezone
  const now = new Date(
    parseInt(nowBrazil.find(p => p.type === 'year')?.value || '2025') as any,
    parseInt(nowBrazil.find(p => p.type === 'month')?.value || '1') as any - 1,
    parseInt(nowBrazil.find(p => p.type === 'day')?.value || '1') as any,
    parseInt(nowBrazil.find(p => p.type === 'hour')?.value || '0') as any,
    parseInt(nowBrazil.find(p => p.type === 'minute')?.value || '0') as any,
    parseInt(nowBrazil.find(p => p.type === 'second')?.value || '0') as any
  ).getTime();
  
  const then = new Date(
    parseInt(thenBrazil.find(p => p.type === 'year')?.value || '2025') as any,
    parseInt(thenBrazil.find(p => p.type === 'month')?.value || '1') as any - 1,
    parseInt(thenBrazil.find(p => p.type === 'day')?.value || '1') as any,
    parseInt(thenBrazil.find(p => p.type === 'hour')?.value || '0') as any,
    parseInt(thenBrazil.find(p => p.type === 'minute')?.value || '0') as any,
    parseInt(thenBrazil.find(p => p.type === 'second')?.value || '0') as any
  ).getTime();
  
  const diff = Math.abs(now - then);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 5) return 'agora';
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks} sem`;
  if (months < 12) return `${months} mês${months > 1 ? 'es' : ''}`;
  return `${years} ano${years > 1 ? 's' : ''}`;
}
