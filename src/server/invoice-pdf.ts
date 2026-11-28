import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface PdfInvoiceRecord {
  id: number;
  invoiceNumber: string;
  schoolId: number | null;
  studentName: string;
  guardianName: string;
  payerType: string;
  phone: string;
  description: string | null;
  amountAoa: number;
  ivaPercent: number | null;
  paymentMethod: string;
  paymentEntity: string | null;
  paymentReferencePin: string | null;
  status: string;
  providerReference: string | null;
  fiscalStatus: string;
  dueDate: Date | string | null;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
}

export interface PdfPricingRecord {
  companyName: string;
  companyNif: string;
  companyAddress: string;
  ivaPercent: number;
  multicaixaEntityCode: string;
  fiscalIntegrationStatus: string;
}

export interface PdfSchoolRecord {
  id: number;
  name: string;
}

const PORTUGUESE_MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getLuandaParts(date: Date): {
  day: string;
  monthIndex: number;
  monthNumber: string;
  year: string;
  hour: string;
  minute: string;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const monthNumber = lookup('month') || '01';
  const monthIndex = Math.max(0, Math.min(11, Number(monthNumber) - 1));
  return {
    day: lookup('day') || '01',
    monthIndex,
    monthNumber,
    year: lookup('year') || '2026',
    hour: lookup('hour') || '00',
    minute: lookup('minute') || '00',
  };
}

function formatDatePt(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '-';
  const p = getLuandaParts(d);
  return `${p.day}/${p.monthNumber}/${p.year}`;
}

function formatDateTimePt(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '-';
  const p = getLuandaParts(d);
  return `${p.day}/${p.monthNumber}/${p.year} ${p.hour}:${p.minute}`;
}

function formatAoaPdf(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const rounded = Math.abs(Math.round(Number(amount) || 0));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped} Kz`;
}

function formatPaymentMethodPt(method: string): string {
  const normalized = (method || '').trim().toLowerCase();
  if (normalized === 'transferencia' || normalized === 'bank_transfer' || normalized === 'transfer') {
    return 'Transferência';
  }
  if (normalized === 'cartao' || normalized === 'card') {
    return 'Cartão';
  }
  return 'Multicaixa Express';
}

function formatInvoiceStatusPt(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Pago';
    case 'failed':
      return 'Falhado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return 'Pendente';
  }
}

function buildDefaultDescription(createdAt: Date): string {
  const parts = getLuandaParts(createdAt);
  const monthName = PORTUGUESE_MONTHS[parts.monthIndex] ?? 'mês corrente';
  return `Transporte escolar – mês de ${monthName} de ${parts.year}`;
}

export async function generateInvoicePdfBuffer(params: {
  invoice: PdfInvoiceRecord;
  pricing: PdfPricingRecord;
  school: PdfSchoolRecord | null;
}): Promise<Buffer> {
  const { invoice, pricing, school } = params;

  const isPaid = invoice.status === 'confirmed';
  const isFiscalValidated =
    pricing.fiscalIntegrationStatus === 'certified_agt' && invoice.fiscalStatus === 'verified_fiscal';

  const issueDate = toDate(invoice.createdAt) ?? new Date();
  const dueDate =
    toDate(invoice.dueDate) ?? new Date(issueDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const ivaPercent = Math.max(0, Number(invoice.ivaPercent ?? pricing.ivaPercent ?? 14));
  const totalAmount = Math.max(0, Math.round(Number(invoice.amountAoa) || 0));
  const ivaRate = ivaPercent / 100;
  const subtotalAmount = ivaRate > 0 ? Math.round(totalAmount / (1 + ivaRate)) : totalAmount;
  const ivaAmount = Math.max(0, totalAmount - subtotalAmount);

  const descriptionText =
    invoice.description && invoice.description.trim().length > 0
      ? invoice.description.trim()
      : buildDefaultDescription(issueDate);

  const entityValue = invoice.paymentEntity?.trim() || pricing.multicaixaEntityCode?.trim() || '-';
  const refValue = invoice.paymentReferencePin?.trim() || '-';
  const paymentDateText = isPaid && invoice.confirmedAt ? formatDateTimePt(invoice.confirmedAt) : '-';
  const providerRefText = invoice.providerReference?.trim() || '-';

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      info: {
        Title: `${isPaid ? 'Recibo de Pagamento' : 'Fatura Proforma'} ${invoice.invoiceNumber}`,
        Author: pricing.companyName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const marginLeft = 44;
    const pageWidth = doc.page.width; // 595.28
    const pageHeight = doc.page.height; // 841.89
    const contentWidth = pageWidth - marginLeft * 2; // 507.28

    // Palette
    const inkDark = '#111827';
    const inkMuted = '#4B5563';
    const inkSoft = '#6B7280';
    const borderLight = '#E5E7EB';
    const bgPanel = '#F9FAFB';
    const accentAmber = '#D97706';
    const emerald = '#059669';

    // -----------------------------------------------------------------------
    // 1. HEADER: Logo, Company Name, NIF, Address
    // -----------------------------------------------------------------------
    let cursorY = 44;
    const logoPath = path.resolve(
      process.cwd(),
      'public/assets/aistudio/20261117_030824_57b8de0b.jpg'
    );
    let textStartX = marginLeft;
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, marginLeft, cursorY, { width: 52, height: 52 });
        textStartX = marginLeft + 64;
      } catch {
        textStartX = marginLeft;
      }
    }

    doc
      .fillColor(inkDark)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(pricing.companyName, textStartX, cursorY + 2, {
        width: contentWidth - (textStartX - marginLeft),
      });

    doc
      .fillColor(inkMuted)
      .font('Helvetica')
      .fontSize(9.5)
      .text(`NIF: ${pricing.companyNif}`, textStartX, cursorY + 22, {
        width: contentWidth - (textStartX - marginLeft),
      });

    doc
      .fillColor(inkMuted)
      .font('Helvetica')
      .fontSize(9.5)
      .text(pricing.companyAddress || 'Luanda, Angola', textStartX, cursorY + 36, {
        width: contentWidth - (textStartX - marginLeft),
      });

    cursorY += 68;
    doc
      .moveTo(marginLeft, cursorY)
      .lineTo(marginLeft + contentWidth, cursorY)
      .strokeColor(borderLight)
      .lineWidth(1)
      .stroke();

    // -----------------------------------------------------------------------
    // 2. TITLE: RECIBO DE PAGAMENTO (paid) | FATURA PROFORMA (pending)
    // -----------------------------------------------------------------------
    cursorY += 18;
    const docTitle = isPaid ? 'RECIBO DE PAGAMENTO' : 'FATURA PROFORMA';
    doc
      .fillColor(inkDark)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(docTitle, marginLeft, cursorY);

    // PAID stamp ONLY when invoice status is paid ('confirmed')
    if (isPaid) {
      doc.save();
      const stampCenterX = marginLeft + contentWidth - 68;
      const stampCenterY = cursorY + 12;
      doc.translate(stampCenterX, stampCenterY);
      doc.rotate(-12);
      doc
        .roundedRect(-46, -16, 92, 32, 4)
        .lineWidth(2.2)
        .strokeColor(emerald)
        .stroke();
      doc
        .fillColor(emerald)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text('PAGO', -46, -7, { width: 92, align: 'center' });
      doc.restore();
    }

    cursorY += 34;

    // -----------------------------------------------------------------------
    // 3. TWO INFO BLOCKS: Invoice Meta & Payer/Student Info
    // -----------------------------------------------------------------------
    const colGap = 14;
    const boxWidth = (contentWidth - colGap) / 2;
    const boxHeight = 104;

    // Left Box: Document Metadata
    doc
      .roundedRect(marginLeft, cursorY, boxWidth, boxHeight, 6)
      .fillAndStroke(bgPanel, borderLight);

    doc
      .fillColor(inkSoft)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('DADOS DO DOCUMENTO', marginLeft + 12, cursorY + 10);

    const drawMetaRow = (x: number, y: number, w: number, label: string, value: string, valueColor = inkDark) => {
      doc
        .fillColor(inkMuted)
        .font('Helvetica')
        .fontSize(9)
        .text(label, x, y, { width: 92 });
      doc
        .fillColor(valueColor)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(value, x + 94, y, { width: w - 94, align: 'right' });
    };

    drawMetaRow(marginLeft + 12, cursorY + 28, boxWidth - 24, 'Nº da fatura:', invoice.invoiceNumber);
    drawMetaRow(marginLeft + 12, cursorY + 46, boxWidth - 24, 'Data de emissão:', formatDatePt(issueDate));
    drawMetaRow(marginLeft + 12, cursorY + 64, boxWidth - 24, 'Data de vencimento:', formatDatePt(dueDate));
    drawMetaRow(
      marginLeft + 12,
      cursorY + 82,
      boxWidth - 24,
      'Estado:',
      formatInvoiceStatusPt(invoice.status),
      isPaid ? emerald : accentAmber
    );

    // Right Box: Payer / Student / School / Phone
    const rightBoxX = marginLeft + boxWidth + colGap;
    doc
      .roundedRect(rightBoxX, cursorY, boxWidth, boxHeight, 6)
      .fillAndStroke(bgPanel, borderLight);

    doc
      .fillColor(inkSoft)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('DADOS DO PAGADOR E EDUCANDO', rightBoxX + 12, cursorY + 10);

    const drawClientRow = (y: number, label: string, value: string) => {
      doc
        .fillColor(inkMuted)
        .font('Helvetica')
        .fontSize(9)
        .text(label, rightBoxX + 12, y, { width: 70 });
      doc
        .fillColor(inkDark)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(value, rightBoxX + 82, y, { width: boxWidth - 94, align: 'right' });
    };

    drawClientRow(cursorY + 28, 'Pagador:', invoice.guardianName || '-');
    drawClientRow(cursorY + 46, 'Educando:', invoice.studentName || '-');
    drawClientRow(cursorY + 64, 'Escola:', school?.name || '-');
    drawClientRow(cursorY + 82, 'Telefone:', invoice.phone || '-');

    cursorY += boxHeight + 22;

    // -----------------------------------------------------------------------
    // 4. LINE ITEMS TABLE
    // -----------------------------------------------------------------------
    const colDescW = 230;
    const colQtyW = 44;
    const colUnitW = 86;
    const colIvaW = 54;
    const colTotalW = contentWidth - colDescW - colQtyW - colUnitW - colIvaW;

    const colDescX = marginLeft;
    const colQtyX = colDescX + colDescW;
    const colUnitX = colQtyX + colQtyW;
    const colIvaX = colUnitX + colUnitW;
    const colTotalX = colIvaX + colIvaW;

    // Table Header
    doc
      .rect(marginLeft, cursorY, contentWidth, 26)
      .fill('#1F2937');

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    doc.text('DESCRIÇÃO', colDescX + 10, cursorY + 8, { width: colDescW - 14 });
    doc.text('QTD.', colQtyX, cursorY + 8, { width: colQtyW - 6, align: 'right' });
    doc.text('PREÇO UNIT.', colUnitX, cursorY + 8, { width: colUnitW - 8, align: 'right' });
    doc.text('IVA %', colIvaX, cursorY + 8, { width: colIvaW - 8, align: 'right' });
    doc.text('TOTAL', colTotalX, cursorY + 8, { width: colTotalW - 10, align: 'right' });

    cursorY += 26;

    // Table Row
    const rowHeight = 36;
    doc
      .rect(marginLeft, cursorY, contentWidth, rowHeight)
      .fillAndStroke('#FFFFFF', borderLight);

    doc.fillColor(inkDark).font('Helvetica').fontSize(9.5);
    doc.text(descriptionText, colDescX + 10, cursorY + 12, { width: colDescW - 14 });
    doc.text('1', colQtyX, cursorY + 12, { width: colQtyW - 6, align: 'right' });
    doc.text(formatAoaPdf(subtotalAmount), colUnitX, cursorY + 12, { width: colUnitW - 8, align: 'right' });
    doc.text(`${ivaPercent}%`, colIvaX, cursorY + 12, { width: colIvaW - 8, align: 'right' });
    doc.font('Helvetica-Bold').text(formatAoaPdf(totalAmount), colTotalX, cursorY + 12, {
      width: colTotalW - 10,
      align: 'right',
    });

    cursorY += rowHeight + 16;

    // -----------------------------------------------------------------------
    // 5. TOTALS BLOCK (Right Aligned)
    // -----------------------------------------------------------------------
    const totalsW = 220;
    const totalsX = marginLeft + contentWidth - totalsW;
    doc
      .roundedRect(totalsX, cursorY, totalsW, 74, 6)
      .fillAndStroke(bgPanel, borderLight);

    doc.fillColor(inkMuted).font('Helvetica').fontSize(9.5);
    doc.text('Subtotal:', totalsX + 12, cursorY + 11, { width: 95 });
    doc.fillColor(inkDark).font('Helvetica-Bold').text(formatAoaPdf(subtotalAmount), totalsX + 105, cursorY + 11, {
      width: totalsW - 117,
      align: 'right',
    });

    doc.fillColor(inkMuted).font('Helvetica').fontSize(9.5);
    doc.text(`IVA (${ivaPercent}%):`, totalsX + 12, cursorY + 29, { width: 95 });
    doc.fillColor(inkDark).font('Helvetica-Bold').text(formatAoaPdf(ivaAmount), totalsX + 105, cursorY + 29, {
      width: totalsW - 117,
      align: 'right',
    });

    doc
      .moveTo(totalsX + 12, cursorY + 46)
      .lineTo(totalsX + totalsW - 12, cursorY + 46)
      .strokeColor(borderLight)
      .lineWidth(1)
      .stroke();

    doc.fillColor(inkDark).font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', totalsX + 12, cursorY + 53, { width: 80 });
    doc.text(formatAoaPdf(totalAmount), totalsX + 92, cursorY + 53, {
      width: totalsW - 104,
      align: 'right',
    });

    cursorY += 96;

    // -----------------------------------------------------------------------
    // 6. PAYMENT BLOCK
    // -----------------------------------------------------------------------
    const paymentBoxH = 98;
    doc
      .roundedRect(marginLeft, cursorY, contentWidth, paymentBoxH, 6)
      .fillAndStroke(bgPanel, borderLight);

    doc
      .fillColor(inkSoft)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('INFORMAÇÕES DE PAGAMENTO', marginLeft + 14, cursorY + 10);

    const drawPayRow = (y: number, label: string, value: string) => {
      doc
        .fillColor(inkMuted)
        .font('Helvetica')
        .fontSize(9.5)
        .text(label, marginLeft + 14, y, { width: 165 });
      doc
        .fillColor(inkDark)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(value, marginLeft + 185, y, { width: contentWidth - 199 });
    };

    drawPayRow(cursorY + 28, 'Método de pagamento:', formatPaymentMethodPt(invoice.paymentMethod));
    drawPayRow(cursorY + 45, 'Entidade e referência:', `Entidade ${entityValue} · Ref. ${refValue}`);
    drawPayRow(cursorY + 62, 'Data de pagamento:', paymentDateText);
    drawPayRow(cursorY + 79, 'Referência do provedor:', providerRefText);

    // -----------------------------------------------------------------------
    // 7. FOOTER
    // -----------------------------------------------------------------------
    const footerY = pageHeight - 76;
    doc
      .moveTo(marginLeft, footerY)
      .lineTo(marginLeft + contentWidth, footerY)
      .strokeColor(borderLight)
      .lineWidth(1)
      .stroke();

    if (!isFiscalValidated) {
      doc
        .fillColor(inkMuted)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          'Documento sem valor fiscal. Não certificado pela AGT.',
          marginLeft,
          footerY + 12,
          { width: contentWidth, align: 'center' }
        );
    }

    doc
      .fillColor(inkSoft)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `Gerado em: ${formatDateTimePt(new Date())} (Hora de Luanda)`,
        marginLeft,
        footerY + 28,
        { width: contentWidth, align: 'center' }
      );

    doc.end();
  });
}
