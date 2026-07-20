import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, formatPrice } from '../../api/client';
import { SHOP } from '../../config/shop';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import './admin-counter-bill.css';

const COUNTER_BILL_DRAFT_KEY = 'asfix_counter_bill_draft_v1';
export const THERMAL_RECEIPT_WIDTH_KEY = 'asfix_counter_thermal_width_v1';
const ALL_CATEGORIES = 'all';
const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'easypaisa', label: 'EasyPaisa' },
  { id: 'jazzcash', label: 'JazzCash' },
];
const THERMAL_WIDTH_OPTIONS = ['58mm', '80mm'];
const RECEIPT_SITE = 'asfixgear.com';
const THERMAL_PAGE_STYLE_ID = 'thermal-page-size';

export function readThermalReceiptWidth() {
  if (typeof window === 'undefined') return '58mm';
  try {
    const width = window.localStorage.getItem(THERMAL_RECEIPT_WIDTH_KEY);
    return THERMAL_WIDTH_OPTIONS.includes(width) ? width : '58mm';
  } catch {
    return '58mm';
  }
}

function writeThermalReceiptWidth(width) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THERMAL_RECEIPT_WIDTH_KEY, width);
  } catch {
    // Local storage is a convenience only; the current React state still applies.
  }
}

function readCounterBillDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(COUNTER_BILL_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return {
      ...draft,
      lines: Array.isArray(draft.lines) ? draft.lines : [],
    };
  } catch {
    return null;
  }
}

function writeCounterBillDraft(draft) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(COUNTER_BILL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private mode; React state still protects this session.
  }
}

function clearCounterBillDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(COUNTER_BILL_DRAFT_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function salePrice(product) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) return 0;
  const discount = Math.min(90, Math.max(0, Number(product.discount_percent) || 0));
  return Math.round(price * (1 - discount / 100));
}

function matchesQuery(product, query) {
  const term = query.trim().toLowerCase();
  if (!term) return false;
  return [
    product.name,
    product.brand,
    product.category,
    product.compatible_models,
    String(product.id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
}

function paymentLabel(mode) {
  const labels = {
    cash: 'Cash',
    card: 'Card',
    jazzcash: 'JazzCash',
    easypaisa: 'EasyPaisa',
    bank: 'Bank',
    cod: 'Cash',
    other: 'Other',
  };
  return labels[mode] || mode;
}

function counterPaymentNote(order) {
  return String(order?.notes || '').startsWith('Counter sale payment note:')
    ? String(order.notes).replace('Counter sale payment note:', '').trim()
    : '';
}

function receiptTotals(order) {
  const subtotal = (order?.items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * (Number(item.qty) || 1),
    0
  );
  const grandTotal = Number(order?.total_amount ?? subtotal) || 0;
  return {
    subtotal,
    grandTotal,
    discount: Math.max(0, subtotal - grandTotal),
  };
}

function receiptNumber(order) {
  return order?.order_id || order?.id || 'DRAFT';
}

function receiptFilename(order) {
  return `asfix-${String(receiptNumber(order)).replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-invoice.pdf`;
}

function amountText(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function buildThermalReceiptText(order) {
  if (!order) return '';
  const { subtotal, discount, grandTotal } = receiptTotals(order);
  const line = '-'.repeat(32);
  const itemLines = (order.items || []).flatMap((item) => {
    const qty = Number(item.qty) || 1;
    const unit = Number(item.price) || 0;
    const total = unit * qty;
    const name = String(item.name || 'Item').slice(0, 30);
    return [
      name,
      `  ${qty} x ${amountText(unit)} = ${amountText(total)}`,
    ];
  });
  return [
    'ASFIX & GEAR',
    SHOP.addressLine1,
    `${SHOP.addressLine2} | ${SHOP.phone}`,
    line,
    `Bill: ${receiptNumber(order)}`,
    `Date: ${order.created_at ? new Date(order.created_at).toLocaleString('en-PK') : '-'}`,
    `Staff: ${order.created_by_staff_name || 'Counter staff'}`,
    line,
    ...itemLines,
    line,
    `Subtotal: ${amountText(subtotal)}`,
    ...(discount ? [`Discount: ${amountText(discount)}`] : []),
    `TOTAL: ${amountText(grandTotal)}`,
    `Payment: ${paymentLabel(order.payment_mode)}`,
    counterPaymentNote(order) ? `Note: ${counterPaymentNote(order)}` : '',
    line,
    'Thank you for shopping!',
    RECEIPT_SITE,
  ].filter(Boolean).join('\n');
}

function rawBtHref(order) {
  const text = buildThermalReceiptText(order);
  const encoded = encodeURIComponent(text);
  return `intent:${encoded}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapPdfText(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function createCounterInvoicePdfBlob(order) {
  const { subtotal, discount, grandTotal } = receiptTotals(order);
  const width = 595.28;
  const height = 841.89;
  const left = 42;
  const right = width - 42;
  const rows = order?.items || [];
  const commands = [];

  const color = (r, g, b) => `${r} ${g} ${b} rg`;
  const text = (value, x, y, size = 10, font = 'F1', fill = '0.08 0.08 0.08 rg') => {
    commands.push(`BT /${font} ${size} Tf ${fill} ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  };
  const rect = (x, y, w, h, fill) => {
    commands.push(`${fill} ${x} ${y} ${w} ${h} re f`);
  };
  const strokeRect = (x, y, w, h, stroke = '0.78 0.62 0.15 RG') => {
    commands.push(`${stroke} ${x} ${y} ${w} ${h} re S`);
  };
  const line = (x1, y1, x2, y2, stroke = '0.82 0.82 0.82 RG') => {
    commands.push(`${stroke} ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  rect(0, 764, width, 78, color(0.04, 0.04, 0.04));
  rect(0, 758, width, 6, color(0.79, 0.64, 0.15));
  text('ASFIX & GEAR', left, 807, 22, 'F2', color(1, 0.94, 0.72));
  text(SHOP.tagline || 'Mobile Repair & Accessories', left, 786, 10, 'F1', color(1, 1, 1));
  text(SHOP.fullAddress, 310, 808, 9, 'F1', color(1, 1, 1));
  text(`Phone: ${SHOP.phone}`, 310, 790, 9, 'F1', color(1, 1, 1));
  text(RECEIPT_SITE, 310, 772, 9, 'F1', color(1, 0.94, 0.72));

  text('INVOICE / RECEIPT', left, 724, 18, 'F2', color(0.05, 0.05, 0.05));
  text(`Receipt #: ${receiptNumber(order)}`, left, 700, 10);
  text(`Date: ${order?.created_at ? new Date(order.created_at).toLocaleString('en-PK') : '-'}`, left, 684, 10);
  text(`Customer: ${order?.customer_name || 'Walk-in Customer'}`, 325, 700, 10);
  text(`Phone: ${order?.phone || '-'}`, 325, 684, 10);
  text(`Staff: ${order?.created_by_staff_name || 'Counter staff'}`, 325, 668, 10);

  const tableTop = 632;
  const rowHeight = 28;
  rect(left, tableTop, right - left, 28, color(0.04, 0.04, 0.04));
  text('Item', left + 10, tableTop + 10, 10, 'F2', color(1, 0.94, 0.72));
  text('Qty', 330, tableTop + 10, 10, 'F2', color(1, 0.94, 0.72));
  text('Rate', 385, tableTop + 10, 10, 'F2', color(1, 0.94, 0.72));
  text('Amount', 470, tableTop + 10, 10, 'F2', color(1, 0.94, 0.72));
  strokeRect(left, tableTop - Math.max(1, rows.length) * rowHeight, right - left, 28 + Math.max(1, rows.length) * rowHeight);

  let y = tableTop - rowHeight;
  if (!rows.length) {
    text('No items', left + 10, y + 10, 10);
    line(left, y, right, y);
  } else {
    rows.forEach((item) => {
      const qty = Number(item.qty) || 1;
      const unit = Number(item.price) || 0;
      const itemLines = wrapPdfText(item.name || 'Item', 36).slice(0, 2);
      text(itemLines[0], left + 10, y + 12, 9);
      if (itemLines[1]) text(itemLines[1], left + 10, y + 2, 8, 'F1', color(0.35, 0.35, 0.35));
      text(String(qty), 336, y + 10, 10);
      text(amountText(unit), 385, y + 10, 10);
      text(amountText(unit * qty), 470, y + 10, 10, 'F2');
      line(left, y, right, y);
      y -= rowHeight;
    });
  }

  const totalsY = Math.max(150, y - 36);
  text('Subtotal', 360, totalsY + 54, 11);
  text(amountText(subtotal), 470, totalsY + 54, 11, 'F2');
  if (discount) {
    text('Discount', 360, totalsY + 34, 11);
    text(amountText(discount), 470, totalsY + 34, 11, 'F2');
  }
  rect(350, totalsY - 2, 188, 30, color(0.98, 0.92, 0.73));
  text('Grand Total', 360, totalsY + 8, 13, 'F2', color(0.04, 0.04, 0.04));
  text(amountText(grandTotal), 470, totalsY + 8, 13, 'F2', color(0.04, 0.04, 0.04));

  text(`Payment: ${paymentLabel(order?.payment_mode)}`, left, totalsY + 26, 11, 'F2');
  const note = counterPaymentNote(order);
  if (note) text(`Payment note: ${note}`, left, totalsY + 8, 9);

  rect(0, 0, width, 70, color(0.04, 0.04, 0.04));
  text('Thank you for shopping at AsFix & Gear.', left, 42, 12, 'F2', color(1, 0.94, 0.72));
  text('Repairs, accessories, and mobile care with honest service.', left, 24, 9, 'F1', color(1, 1, 1));
  text(`${SHOP.phone} | ${RECEIPT_SITE}`, 365, 33, 9, 'F1', color(1, 1, 1));

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function receiptHasPrintableContent(element) {
  return Boolean(element?.children?.length && element.textContent?.trim());
}

function waitForNextPaint() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function setThermalPageSize(thermalWidth) {
  if (typeof document === 'undefined') return () => {};

  const pageWidth = thermalWidth === '80mm' ? '80mm' : '58mm';
  document.getElementById(THERMAL_PAGE_STYLE_ID)?.remove();

  const style = document.createElement('style');
  style.id = THERMAL_PAGE_STYLE_ID;
  style.textContent = `@media print { @page { size: ${pageWidth} auto; margin: 0; } }`;
  document.head.appendChild(style);
  document.body.classList.toggle('receipt-thermal-80mm', pageWidth === '80mm');

  return () => {
    style.remove();
    document.body.classList.remove('receipt-thermal-80mm');
  };
}

export async function printActiveCounterReceipt({ thermalWidth = '58mm', inFlightRef } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (inFlightRef?.current) return false;

  if (inFlightRef) inFlightRef.current = true;
  try {
    await waitForNextPaint();

    let receipt = document.querySelector('.counter-bill-print--active');
    if (!receiptHasPrintableContent(receipt)) {
      await waitForNextPaint();
      receipt = document.querySelector('.counter-bill-print--active');
    }
    if (!receiptHasPrintableContent(receipt)) {
      if (inFlightRef) inFlightRef.current = false;
      return false;
    }

    const cleanupPageSize = setThermalPageSize(thermalWidth);
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      cleanupPageSize();
      window.removeEventListener('afterprint', cleanup);
      if (inFlightRef) inFlightRef.current = false;
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
    return true;
  } catch {
    if (inFlightRef) inFlightRef.current = false;
    return false;
  }
}

export function downloadCounterInvoicePdf(order) {
  if (!order) return;
  downloadBlob(createCounterInvoicePdfBlob(order), receiptFilename(order));
}

export async function shareCounterInvoicePdf(order) {
  if (!order) return false;
  const blob = createCounterInvoicePdfBlob(order);
  const file = new File([blob], receiptFilename(order), { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `${SHOP.name} ${receiptNumber(order)}`,
      text: `${SHOP.name} receipt ${receiptNumber(order)}`,
      files: [file],
    });
    return true;
  }
  downloadBlob(blob, file.name);
  return false;
}

export function CounterBillReceipt({ order, printable = false, thermalWidth = '58mm' }) {
  const { t } = useTranslation();
  if (!order) return null;

  const paymentNote = counterPaymentNote(order);
  const { subtotal, discount, grandTotal } = receiptTotals(order);

  return (
    <div
      className={`counter-bill-print${printable ? ' counter-bill-print--active' : ''}`}
      style={{ '--thermal-receipt-width': thermalWidth }}
      aria-label={t('admin.counterBillReceipt')}
    >
      <div className="counter-bill-print__shop">
        <h2>ASFIX &amp; GEAR</h2>
        <p>{SHOP.addressLine1}</p>
        <p>{SHOP.addressLine2} | {SHOP.phone}</p>
      </div>
      <div className="counter-bill-print__meta">
        <span>{t('admin.counterBillNo')}: {order.order_id || order.id}</span>
        <span>{t('admin.counterBillDate')}: {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</span>
        <span>{t('admin.counterBillStaff')}: {order.created_by_staff_name || 'Counter staff'}</span>
        <span>
          {t('admin.counterBillPayment')}: {paymentLabel(order.payment_mode)}
          {paymentNote ? ` (${paymentNote})` : ''}
        </span>
        <span>{t('admin.counterBillCustomer')}: {order.customer_name || 'Walk-in Customer'}</span>
        {order.phone ? <span>{t('admin.counterBillPhone')}: {order.phone}</span> : null}
      </div>
      <div className="counter-bill-print__rule" />
      <div className="counter-bill-print__items">
        {(order.items || []).map((item, index) => {
          const qty = Number(item.qty) || 1;
          const unit = Number(item.price) || 0;
          return (
            <div className="counter-bill-print__item" key={`${item.product_id}-${index}`}>
              <strong>{item.name}</strong>
              <span>{qty} x {formatPrice(unit)}</span>
              <b>{formatPrice(unit * qty)}</b>
            </div>
          );
        })}
      </div>
      <div className="counter-bill-print__rule" />
      <div className="counter-bill-print__totals">
        <span>{t('admin.counterBillSubtotal')}</span>
        <strong>{formatPrice(subtotal)}</strong>
        {discount ? (
          <>
            <span>{t('admin.counterBillDiscount')}</span>
            <strong>{formatPrice(discount)}</strong>
          </>
        ) : null}
        <span className="counter-bill-print__grand-label">{t('admin.counterBillGrandTotal')}</span>
        <strong className="counter-bill-print__grand">{formatPrice(grandTotal)}</strong>
      </div>
      <p className="counter-bill-print__thanks">{t('admin.counterBillThanks')}</p>
      <p className="counter-bill-print__site">{RECEIPT_SITE}</p>
    </div>
  );
}

export default function AdminCounterBill({ products, onBillCreated, onPrintOrder, onThermalWidthChange }) {
  const { t } = useTranslation();
  const searchRef = useRef(null);
  const printInFlightRef = useRef(false);
  const autoPrintedOrderRef = useRef(null);
  const [draftSeed] = useState(() => readCounterBillDraft());
  const [thermalWidth, setThermalWidth] = useState(() => readThermalReceiptWidth());
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [lines, setLines] = useState(() => draftSeed?.lines || []);
  const [customerName, setCustomerName] = useState(() => draftSeed?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => draftSeed?.customerPhone || '');
  const [showCustomerDetails, setShowCustomerDetails] = useState(() => Boolean(draftSeed?.customerName || draftSeed?.customerPhone));
  const [paymentMode, setPaymentMode] = useState(() =>
    PAYMENT_OPTIONS.some((option) => option.id === draftSeed?.paymentMode) ? draftSeed.paymentMode : 'cash'
  );
  const [paymentNote, setPaymentNote] = useState(() => draftSeed?.paymentNote || '');
  const [cashReceived, setCashReceived] = useState('');
  const [cartFlashKey, setCartFlashKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const showRawBtLink = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const availableProducts = useMemo(() => {
    return products
      .filter((p) => (p.status || 'published') === 'published' && Number(p.stock) > 0)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products]);

  const categories = useMemo(() => {
    return [...new Set(availableProducts.map((product) => product.category).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [availableProducts]);

  const filteredProducts = useMemo(() => {
    const hasQuery = query.trim().length > 0;
    return availableProducts.filter((product) => {
      const inCategory = selectedCategory === ALL_CATEGORIES || product.category === selectedCategory;
      const inSearch = !hasQuery || matchesQuery(product, query);
      return inCategory && inSearch;
    });
  }, [availableProducts, query, selectedCategory]);

  const total = lines.reduce((sum, line) => sum + salePrice(line.product) * line.qty, 0);
  const cashReceivedValue = Number(cashReceived);
  const changeDue = paymentMode === 'cash' && Number.isFinite(cashReceivedValue) ? Math.max(0, cashReceivedValue - total) : 0;

  useEffect(() => {
    if (!lines.length) return;
    setLines((prev) =>
      prev.map((line) => {
        const latest = products.find((product) => product.id === line.product.id);
        if (!latest) return line;
        const max = Math.max(1, Number(latest.stock) || 1);
        return {
          ...line,
          product: latest,
          qty: Math.min(max, Math.max(1, Number(line.qty) || 1)),
        };
      })
    );
  }, [products]);

  useEffect(() => {
    writeThermalReceiptWidth(thermalWidth);
    onThermalWidthChange?.(thermalWidth);
  }, [thermalWidth, onThermalWidthChange]);

  useEffect(() => {
    if (!cartFlashKey) return undefined;
    const timer = window.setTimeout(() => setCartFlashKey(0), 450);
    return () => window.clearTimeout(timer);
  }, [cartFlashKey]);

  useEffect(() => {
    const hasDraft = lines.length || customerName || customerPhone || paymentMode !== 'cash' || paymentNote;
    if (!hasDraft) {
      clearCounterBillDraft();
      return;
    }

    writeCounterBillDraft({
      lines: lines.map((line) => ({
        product: line.product,
        qty: line.qty,
      })),
      customerName,
      customerPhone,
      paymentMode,
      paymentNote,
      updatedAt: new Date().toISOString(),
    });
  }, [lines, customerName, customerPhone, paymentMode, paymentNote]);

  const addProduct = (product) => {
    setReceiptOrder(null);
    setFeedback(null);
    setCartFlashKey(Date.now());
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, qty: Math.min(Number(product.stock) || 1, line.qty + 1) }
            : line
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setQuery('');
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter' || !query.trim() || !filteredProducts[0]) return;
    e.preventDefault();
    addProduct(filteredProducts[0]);
  };

  const adjustQty = (productId, delta) => {
    const line = lines.find((item) => item.product.id === productId);
    if (!line) return;
    setQty(productId, line.qty + delta);
  };

  const setQty = (productId, value) => {
    setReceiptOrder(null);
    const raw = Number(value);
    setLines((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId) return line;
        const max = Math.max(1, Number(line.product.stock) || 1);
        const qty = Number.isFinite(raw) ? Math.min(max, Math.max(1, Math.floor(raw))) : 1;
        return { ...line, qty };
      })
    );
  };

  const removeLine = (productId) => {
    setReceiptOrder(null);
    setLines((prev) => prev.filter((line) => line.product.id !== productId));
  };

  const resetBill = () => {
    clearCounterBillDraft();
    setLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setShowCustomerDetails(false);
    setPaymentMode('cash');
    setPaymentNote('');
    setCashReceived('');
    setFeedback(null);
    setReceiptOrder(null);
  };

  const printReceipt = useCallback(async (order = receiptOrder) => {
    if (!order) return;
    if (onPrintOrder) {
      onPrintOrder(order);
      return;
    }
    await printActiveCounterReceipt({ thermalWidth, inFlightRef: printInFlightRef });
  }, [onPrintOrder, receiptOrder, thermalWidth]);

  useEffect(() => {
    if (!receiptOrder || onPrintOrder) return;
    const orderNumber = receiptNumber(receiptOrder);
    if (autoPrintedOrderRef.current === orderNumber) return;
    autoPrintedOrderRef.current = orderNumber;
    void printReceipt(receiptOrder);
  }, [onPrintOrder, printReceipt, receiptOrder]);

  const confirmBill = async () => {
    if (!lines.length) {
      setFeedback({ type: 'error', text: t('admin.counterBillEmpty') });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await api.createCounterSale({
        customer_name: customerName,
        phone: customerPhone,
        payment_mode: paymentMode,
        payment_note: paymentNote,
        items: lines.map((line) => ({
          product_id: line.product.id,
          qty: line.qty,
        })),
      });
      setReceiptOrder(result.order);
      setFeedback({ type: 'success', text: t('admin.counterBillCreated') });
      clearCounterBillDraft();
      setLines([]);
      setCustomerName('');
      setCustomerPhone('');
      setShowCustomerDetails(false);
      setPaymentMode('cash');
      setPaymentNote('');
      setCashReceived('');
      onBillCreated?.(result.order);
      if (onPrintOrder) {
        onPrintOrder(result.order);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || t('admin.counterBillFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadInvoice = (order = receiptOrder) => {
    if (!order) return;
    downloadCounterInvoicePdf(order);
  };

  const shareInvoice = async (order = receiptOrder) => {
    if (!order) return;
    try {
      const shared = await shareCounterInvoicePdf(order);
      if (!shared) {
        setFeedback({ type: 'success', text: t('admin.counterBillPdfDownloaded') });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setFeedback({ type: 'error', text: err.message || t('admin.counterBillPdfFailed') });
      }
    }
  };

  return (
    <div className="counter-bill">
      <div className="counter-bill__head">
        <div>
          <h3>{t('admin.counterBillTitle')}</h3>
          <p>{t('admin.counterBillSub')}</p>
        </div>
        <div className="counter-bill__shop">
          <strong>{SHOP.name}</strong>
          <span>{SHOP.fullAddress}</span>
          <span>{SHOP.phone}</span>
        </div>
      </div>

      {feedback ? (
        <div className={`counter-bill__feedback counter-bill__feedback--${feedback.type}`} role="status">
          {feedback.text}
        </div>
      ) : null}

      <div className="counter-bill__grid">
        <section className="counter-bill__panel counter-bill__panel--products">
          <div className="counter-bill__panel-head">
            <h4>{t('admin.counterBillProducts')}</h4>
            <span>{filteredProducts.length} / {availableProducts.length}</span>
          </div>

          <div className="counter-bill__categories" role="tablist" aria-label="Product categories">
            <button
              type="button"
              className={`counter-bill__category${selectedCategory === ALL_CATEGORIES ? ' counter-bill__category--active' : ''}`}
              onClick={() => setSelectedCategory(ALL_CATEGORIES)}
            >
              {t('admin.counterBillAllCategories')}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`counter-bill__category${selectedCategory === category ? ' counter-bill__category--active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="counter-bill__search">
            <span>{t('admin.counterBillSearch')}</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('admin.counterBillSearchPh')}
              autoComplete="off"
            />
            <small>{t('admin.counterBillSearchHint')}</small>
          </label>

          <div className="counter-bill__products">
            {filteredProducts.length === 0 ? (
              <p className="counter-bill__empty">{t('admin.counterBillNoMatch')}</p>
            ) : null}
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="counter-bill__product-tile"
                onClick={() => addProduct(product)}
              >
                <span className="counter-bill__product-media">
                  {product.image ? (
                    <img src={product.image} alt="" loading="lazy" />
                  ) : (
                    <img src={getDefaultImage(product.category)} alt="" loading="lazy" />
                  )}
                </span>
                <span className="counter-bill__product-info">
                  <strong>{product.name}</strong>
                  <small>{product.category || product.brand || `#${product.id}`}</small>
                </span>
                <span className="counter-bill__product-price">
                  <strong>{formatPrice(salePrice(product))}</strong>
                  <small>{t('admin.stockLabel', { count: Number(product.stock) || 0 })}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={`counter-bill__panel counter-bill__panel--cart${cartFlashKey ? ' counter-bill__panel--flash' : ''}`}>
          <div className="counter-bill__panel-head">
            <h4>{t('admin.counterBillCart')}</h4>
            <span>{lines.length} {t('admin.counterBillCartItems')}</span>
          </div>

          <div className="counter-bill__thermal-setting">
            <span>{t('admin.counterBillThermalWidth')}</span>
            <div role="group" aria-label={t('admin.counterBillThermalWidth')}>
              {THERMAL_WIDTH_OPTIONS.map((width) => (
                <button
                  key={width}
                  type="button"
                  className={thermalWidth === width ? 'counter-bill__thermal-active' : ''}
                  onClick={() => setThermalWidth(width)}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>

          <div className="counter-bill__cart-lines">
            {lines.length === 0 ? (
              <p className="counter-bill__empty counter-bill__empty--cart">{t('admin.counterBillEmptyState')}</p>
            ) : (
              lines.map((line, index) => {
                const unit = salePrice(line.product);
                const stock = Number(line.product.stock) || 1;
                return (
                  <article className="counter-bill__cart-row" key={line.product.id}>
                    <span className="counter-bill__cart-index">{index + 1}</span>
                    <div className="counter-bill__cart-item">
                      <strong>{line.product.name}</strong>
                      <small>{formatPrice(unit)} each · {t('admin.stockLabel', { count: stock })}</small>
                    </div>
                    <div className="counter-bill__qty-stepper">
                      <button type="button" onClick={() => adjustQty(line.product.id, -1)} disabled={line.qty <= 1}>
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={stock}
                        step="1"
                        value={line.qty}
                        onChange={(e) => setQty(line.product.id, e.target.value)}
                        aria-label={`${line.product.name} quantity`}
                      />
                      <button type="button" onClick={() => adjustQty(line.product.id, 1)} disabled={line.qty >= stock}>
                        +
                      </button>
                    </div>
                    <strong className="counter-bill__cart-line-total">{formatPrice(unit * line.qty)}</strong>
                    <button type="button" className="counter-bill__remove" onClick={() => removeLine(line.product.id)}>
                      {t('admin.counterBillRemove')}
                    </button>
                  </article>
                );
              })
            )}
          </div>

          <div className="counter-bill__customer-toggle">
            <button type="button" onClick={() => setShowCustomerDetails((value) => !value)}>
              {showCustomerDetails ? t('admin.counterBillHideCustomer') : t('admin.counterBillAddCustomer')}
            </button>
          </div>

          {showCustomerDetails ? (
            <div className="counter-bill__customer">
              <label>
                <span>{t('admin.counterBillCustomer')}</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('admin.counterBillCustomerPh')}
                  maxLength={120}
                />
              </label>
              <label>
                <span>{t('admin.counterBillPhone')}</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t('admin.counterBillPhonePh')}
                  maxLength={30}
                />
              </label>
            </div>
          ) : null}

          <div className="counter-bill__payment">
            <span>{t('admin.counterBillPayment')}</span>
            <div className="counter-bill__payment-grid">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`counter-bill__pay counter-bill__pay--${option.id}${paymentMode === option.id ? ' counter-bill__pay--active' : ''}`}
                  onClick={() => setPaymentMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'cash' ? (
            <div className="counter-bill__cash-box">
              <label>
                <span>{t('admin.counterBillAmountReceived')}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0"
                />
              </label>
              <div className="counter-bill__change">
                <span>{t('admin.counterBillChangeReturn')}</span>
                <strong>{formatPrice(changeDue)}</strong>
              </div>
            </div>
          ) : null}

          <label className="counter-bill__note">
            <span>{t('admin.counterBillPaymentNote')}</span>
            <input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder={t('admin.counterBillPaymentNotePh')}
              maxLength={500}
            />
          </label>

          <div className="counter-bill__footer">
            <div className="counter-bill__total">
              <span>{t('admin.counterBillTotal')}</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            <div className="counter-bill__actions">
              <button type="button" className="counter-bill__button counter-bill__button--secondary" onClick={resetBill}>
                {t('admin.counterBillReset')}
              </button>
              <button type="button" className="counter-bill__button counter-bill__button--primary" onClick={confirmBill} disabled={submitting || !lines.length}>
                {submitting ? t('common.saving') : t('admin.counterBillConfirm')}
              </button>
              {receiptOrder ? (
                <>
                  <button type="button" className="wp-button counter-bill__print-cta" onClick={() => printReceipt()}>
                    {t('admin.counterBillPrintNow')}
                  </button>
                  <button type="button" className="wp-button counter-bill__pdf-cta" onClick={() => downloadInvoice()}>
                    {t('admin.counterBillDownloadPdf')}
                  </button>
                  <button type="button" className="wp-button counter-bill__share-cta" onClick={() => shareInvoice()}>
                    {t('admin.counterBillSharePdf')}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {receiptOrder ? (
        <section className="counter-bill__receipt">
          <div className="counter-bill__receipt-head">
            <strong>{t('admin.counterBillSavedReady')}</strong>
            <div className="counter-bill__receipt-actions">
              <button type="button" className="wp-button counter-bill__print-cta" onClick={() => printReceipt()}>
                {t('admin.counterBillPrintNow')}
              </button>
              <button type="button" className="wp-button counter-bill__pdf-cta" onClick={() => downloadInvoice()}>
                {t('admin.counterBillDownloadPdf')}
              </button>
              <button type="button" className="wp-button counter-bill__share-cta" onClick={() => shareInvoice()}>
                {t('admin.counterBillSharePdf')}
              </button>
              {showRawBtLink ? (
                <a className="wp-button counter-bill__rawbt-cta" href={rawBtHref(receiptOrder)}>
                  {t('admin.counterBillOpenRawBt')}
                </a>
              ) : null}
            </div>
          </div>
          <p className="counter-bill__receipt-note">{t('admin.counterBillThermalHint')}</p>
          <CounterBillReceipt order={receiptOrder} printable={!onPrintOrder} thermalWidth={thermalWidth} />
        </section>
      ) : null}
    </div>
  );
}
