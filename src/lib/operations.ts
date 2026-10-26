export const todayLuanda = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda' }).format(new Date());
export const money = (amount: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(amount);
export function payroll(trips: { driver_id: string; status: string; completed_at: string | null }[], driver: string, rate: number, month: string) {
  return trips.filter(t => t.driver_id === driver && t.status === 'completed' && t.completed_at?.slice(0, 7) === month).length * rate;
}
export function expiryStatus(date: string, today: string) {
  const days = Math.ceil((Date.parse(date) - Date.parse(today)) / 86400000);
  return days < 0 ? 'Expirado' : days <= 30 ? 'A renovar' : 'Válido';
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = '\ufeff' + rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
export function downloadDocument(title: string, content: string) {
  const url = URL.createObjectURL(new Blob([title + '\n\n' + content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = title + '.txt'; link.click(); URL.revokeObjectURL(url);
}