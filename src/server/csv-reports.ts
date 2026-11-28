const PT_JOURNEY_LABELS: Record<string, string> = {
  expected: 'Previsto',
  present: 'Presente',
  absent: 'Ausente',
  boarded: 'Embarcado',
  in_transit: 'Em trânsito',
  at_destination: 'No destino',
  handover_pending: 'Entrega pendente',
  handed_over: 'Entregue',
  verification_failed: 'Falha de verificação',
};

const PT_TRIP_STATE_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  driver_checked_in: 'Motorista em check-in',
  in_progress: 'Em curso',
  at_stop: 'Na paragem',
  boarding: 'Embarque',
  at_school: 'Na escola',
  return_in_progress: 'Regresso em curso',
  handover_pending: 'Entrega pendente',
  completed: 'Concluída',
  delayed: 'Atrasada',
  cancelled: 'Cancelada',
  incident: 'Com ocorrência',
};

const PT_INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  initiated: 'Iniciada',
  pending_provider: 'Pendente',
  confirmed: 'Pago',
  failed: 'Falhado',
  refunded: 'Reembolsado',
};

const PT_PAYMENT_METHOD_LABELS: Record<string, string> = {
  multicaixa_express: 'Multicaixa Express',
  multicaixa_express_entity: 'Multicaixa Express (Entidade/PIN)',
  transferencia: 'Transferência Bancária',
  bank_transfer: 'Transferência Bancária',
  cartao: 'Cartão',
  card: 'Cartão',
};

const PT_INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  breakdown: 'Avaria',
  traffic_delay: 'Desvio / Trânsito',
  medical: 'Emergência médica',
  pin_failure: 'Falha de PIN',
  general_sos: 'SOS Geral',
  hazard: 'Perigo na via',
  schedule_concern: 'Atraso / Horário Escolar',
  roster_issue: 'Pauta / Aluno',
  safety_report: 'Segurança',
};

const PT_INCIDENT_STATUS_LABELS: Record<string, string> = {
  new: 'Nova',
  acknowledged: 'Reconhecida',
  assigned: 'Atribuída',
  in_progress: 'Em tratamento',
  resolved: 'Resolvida',
  closed: 'Fechada',
};

export type CsvCellValue = string | number | boolean | null | undefined;

export function sanitizeCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'boolean') return `"${value ? 'Sim' : 'Não'}"`;
  if (typeof value === 'number') {
    return `"${Number.isFinite(value) ? String(value) : ''}"`;
  }

  let str = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
  const isSafeSignedNumber = /^-?\d+(\.\d+)?$/.test(str);
  const isSafePhone = /^\+\d[\d\s-]{6,}$/.test(str);
  if (str.length > 0 && /^[=+\-@\t]/.test(str) && !isSafeSignedNumber && !isSafePhone) {
    str = `'${str}`;
  }
  return `"${str.replaceAll('"', '""')}"`;
}

export function buildCsvWithBom(headers: string[], rows: CsvCellValue[][]): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(';');
  const bodyLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(';'));
  return '\ufeff' + [headerLine, ...bodyLines].join('\r\n');
}

export interface ParsedReportFilters {
  fromStr: string | null;
  toStr: string | null;
  fromDate: Date | null;
  toDate: Date | null;
  schoolId: number | null;
}

export function parseReportFilters(query: Record<string, unknown>):
  | { ok: true; filters: ParsedReportFilters }
  | { ok: false; error: string } {
  const rawFrom = String(query.from ?? query.startDate ?? '').trim();
  const rawTo = String(query.to ?? query.endDate ?? '').trim();
  const rawSchoolId = String(query.schoolId ?? '').trim();

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (rawFrom) {
    if (!datePattern.test(rawFrom)) {
      return { ok: false, error: 'Parâmetro "from" inválido. Utilize o formato YYYY-MM-DD.' };
    }
    const parsed = new Date(`${rawFrom}T00:00:00+01:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Data inicial inválida.' };
    }
    fromDate = parsed;
  }

  if (rawTo) {
    if (!datePattern.test(rawTo)) {
      return { ok: false, error: 'Parâmetro "to" inválido. Utilize o formato YYYY-MM-DD.' };
    }
    const parsed = new Date(`${rawTo}T23:59:59.999+01:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Data final inválida.' };
    }
    toDate = parsed;
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    return { ok: false, error: 'A data inicial não pode ser posterior à data final.' };
  }

  let schoolId: number | null = null;
  if (rawSchoolId) {
    const num = Number(rawSchoolId);
    if (!Number.isInteger(num) || num <= 0) {
      return { ok: false, error: 'Parâmetro "schoolId" inválido.' };
    }
    schoolId = num;
  }

  return {
    ok: true,
    filters: {
      fromStr: rawFrom || null,
      toStr: rawTo || null,
      fromDate,
      toDate,
      schoolId,
    },
  };
}

export function isWithinDateRange(
  value: Date | string | null | undefined,
  fromDate: Date | null,
  toDate: Date | null
): boolean {
  if (!fromDate && !toDate) return true;
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return false;
  if (fromDate && t < fromDate.getTime()) return false;
  if (toDate && t > toDate.getTime()) return false;
  return true;
}

export function getLuandaDayKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda' }).format(d);
}

export function formatLuandaDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-AO', {
    timeZone: 'Africa/Luanda',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatLuandaTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-AO', {
    timeZone: 'Africa/Luanda',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatLuandaDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatLuandaDate(d)} ${formatLuandaTime(d)}`;
}

export function translateJourneyPt(state: string): string {
  return PT_JOURNEY_LABELS[state] ?? state;
}

export function translateTripStatePt(state: string): string {
  return PT_TRIP_STATE_LABELS[state] ?? state;
}

export function translateInvoiceStatusPt(status: string): string {
  return PT_INVOICE_STATUS_LABELS[status] ?? status;
}

export function translatePaymentMethodPt(method: string): string {
  return PT_PAYMENT_METHOD_LABELS[method] ?? method;
}

export function translateIncidentCategoryPt(cat: string): string {
  return PT_INCIDENT_CATEGORY_LABELS[cat] ?? cat;
}

export function translateIncidentStatusPt(status: string): string {
  return PT_INCIDENT_STATUS_LABELS[status] ?? status;
}

export function translatePinPolicyPt(policy: string): string {
  if (policy === 'boarding') return 'Apenas Embarque';
  if (policy === 'dropoff') return 'Apenas Desembarque';
  return 'Embarque + Desembarque';
}

export function translateShiftPt(shift: string): string {
  if (shift === 'morning') return 'Manhã';
  if (shift === 'afternoon') return 'Tarde / Regresso';
  return 'Ida e Volta';
}

export function translateExpiryStatusPt(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Sem data';
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return 'Data inválida';
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda' }).format(new Date());
  const todayMs = Date.parse(todayStr);
  const diffDays = Math.ceil((parsed - todayMs) / 86_400_000);
  if (diffDays < 0) return 'Expirado';
  if (diffDays <= 30) return 'A renovar (<= 30 dias)';
  return 'Válido';
}
