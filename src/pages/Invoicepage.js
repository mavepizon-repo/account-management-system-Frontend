import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import logo from '../logo image/logo.jpeg';
import '../styles/EntityPage.css';
import '../styles/Invoicepage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  description: '',
  qty: '1',
  rate: '',
  gstPercent: '0',
  amount: '',
  gstAmount: '',
  netTotal: '',
});

const emptyAddForm = {
  clientCode: '',
  date: '',
  subject: '',
  notes: '',
  items: [emptyItem()],
};

const emptyUpdateForm = {
  clientCode: '',
  date: '',
  subject: '',
  notes: '',
  items: [emptyItem()],
};

/* ── Calc helpers ─────────────────────────────────────── */
function calcItem(item, key, value) {
  const u      = { ...item, [key]: value };
  const qty    = parseFloat(u.qty)        || 0;
  const rate   = parseFloat(u.rate)       || 0;
  const gstPct = parseFloat(u.gstPercent) || 0;
  const amount   = parseFloat((qty * rate).toFixed(2));
  const gstAmt   = parseFloat(((amount * gstPct) / 100).toFixed(2));
  const netTotal = parseFloat((amount + gstAmt).toFixed(2));
  return {
    ...u,
    amount:    amount   || '',
    gstAmount: gstAmt   || '',
    netTotal:  netTotal || '',
  };
}

function calcTotals(items) {
  let totalAmount = 0, totalGST = 0, grandTotal = 0;
  items.forEach(i => {
    totalAmount += parseFloat(i.amount)    || 0;
    totalGST    += parseFloat(i.gstAmount) || 0;
    grandTotal  += parseFloat(i.netTotal)  || 0;
  });
  return {
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    totalGST:    parseFloat(totalGST.toFixed(2)),
    grandTotal:  parseFloat(grandTotal.toFixed(2)),
  };
}

function buildProducts(items) {
  return items.map((it, i) => ({
    serialNo:    i + 1,
    description: it.description,
    quantity:    parseFloat(it.qty)        || 0,
    rate:        parseFloat(it.rate)       || 0,
    gstPercent:  parseFloat(it.gstPercent) || 0,
    amount:      parseFloat(it.amount)     || 0,
    gstAmount:   parseFloat(it.gstAmount)  || 0,
    netTotal:    parseFloat(it.netTotal)   || 0,
  }));
}

function buildAddPayload(form) {
  const totals = calcTotals(form.items);
  return {
    client:      form.clientCode,
    date:        form.date,
    subject:     form.subject,
    notes:       form.notes,
    products:    buildProducts(form.items),
    totalAmount: totals.totalAmount,
    totalGST:    totals.totalGST,
    grandTotal:  totals.grandTotal,
  };
}

function buildUpdatePayload(form) {
  return {
    date:    form.date,
    subject: form.subject,
    notes:   form.notes,
  };
}

function invoiceToUpdateForm(inv) {
  const prods = Array.isArray(inv.products) ? inv.products : [];
  const items = prods.length > 0
    ? prods.map(p => ({
        id:          Date.now() + Math.random(),
        description: p.description || '',
        qty:         p.quantity  ?? '',
        rate:        p.rate      ?? '',
        gstPercent:  String(p.gstPercent ?? 0),
        amount:      p.amount    ?? '',
        gstAmount:   p.gstAmount ?? '',
        netTotal:    p.netTotal  ?? '',
      }))
    : [emptyItem()];
  return {
    clientCode: inv.client?._id || inv.client || '',
    date:       inv.date?.split('T')[0] || '',
    subject:    inv.subject || '',
    notes:      inv.notes   || '',
    items,
  };
}

/* ── Searchable dropdown ─────────────────────────────── */
function SearchableDropdown({ options, value, onChange, placeholder, getLabel, getId }) {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => getId(o) === value);
  const filtered = query.trim()
    ? options.filter(o => getLabel(o).toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="sd-wrap" ref={ref}>
      <div className={`sd-trigger ${open ? 'sd-open' : ''}`} onClick={() => setOpen(p => !p)}>
        {open
          ? <input className="sd-search-input" autoFocus value={query}
              onChange={e => setQuery(e.target.value)} placeholder="Type to search..."
              onClick={e => e.stopPropagation()} />
          : <span className={`sd-value ${!selected ? 'sd-placeholder' : ''}`}>
              {selected ? getLabel(selected) : placeholder}
            </span>}
        <div className="sd-icons">
          {selected && !open && (
            <button className="sd-clear"
              onClick={e => { e.stopPropagation(); onChange(''); setQuery(''); }}
              title="Clear">✕</button>
          )}
          <span className="sd-arrow">{open ? '▴' : '▾'}</span>
        </div>
      </div>
      {open && (
        <div className="sd-dropdown">
          {filtered.length === 0
            ? <div className="sd-no-results">No results found</div>
            : filtered.map(o => (
              <div key={getId(o)}
                className={`sd-option ${getId(o) === value ? 'sd-option-selected' : ''}`}
                onClick={() => { onChange(getId(o)); setQuery(''); setOpen(false); }}>
                {getLabel(o)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ITEMS TABLE
══════════════════════════════════════════════════════════════ */
function ItemsTable({ items, onChange, onAdd, onRemove }) {
  const totals = calcTotals(items);

  const handleCell = (idx, key, value) => {
    const updated = items.map((item, i) => i === idx ? calcItem(item, key, value) : item);
    onChange(updated);
  };

  return (
    <div className="items-table-wrap">
      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>S.No</th>
            <th>Description</th>
            <th style={{ width: 72 }}>Qty</th>
            <th style={{ width: 110 }}>Rate (₹)</th>
            <th style={{ width: 100 }}>Amount (₹)</th>
            <th style={{ width: 80 }}>GST %</th>
            <th style={{ width: 110 }}>GST Amt (₹)</th>
            <th style={{ width: 120 }}>Net Total (₹)</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="item-row">
              <td className="sno-cell">{idx + 1}</td>
              <td>
                <input className="item-input item-desc" placeholder="Work description"
                  value={item.description}
                  onChange={e => handleCell(idx, 'description', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-num" type="number" placeholder="0" min="0"
                  value={item.qty}
                  onChange={e => handleCell(idx, 'qty', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-num" type="number" placeholder="0.00" min="0"
                  value={item.rate}
                  onChange={e => handleCell(idx, 'rate', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-calc" readOnly
                  value={item.amount !== '' ? Number(item.amount).toLocaleString('en-IN') : ''} />
              </td>
              <td>
                <div className="gst-select-wrap">
                  <select className="item-input item-gst-select"
                    value={item.gstPercent}
                    onChange={e => handleCell(idx, 'gstPercent', e.target.value)}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </td>
              <td>
                <input className="item-input item-calc" readOnly
                  value={item.gstAmount !== '' && item.gstAmount !== 0
                    ? Number(item.gstAmount).toLocaleString('en-IN')
                    : item.gstAmount === 0 ? '0' : ''} />
              </td>
              <td>
                <input className="item-input item-net" readOnly
                  value={item.netTotal !== '' ? Number(item.netTotal).toLocaleString('en-IN') : ''} />
              </td>
              <td>
                {items.length > 1 && (
                  <button className="item-remove-btn" onClick={() => onRemove(idx)} title="Remove">✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="items-totals-row">
            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: 12 }}>
              Sub Total
            </td>
            <td className="total-cell">
              {totals.totalAmount > 0 ? '₹' + Number(totals.totalAmount).toLocaleString('en-IN') : '—'}
            </td>
            <td></td>
            <td className="total-cell" style={{ color: '#7a5000' }}>
              {totals.totalGST > 0 ? '₹' + Number(totals.totalGST).toLocaleString('en-IN') : '—'}
            </td>
            <td className="total-cell grand-total-cell">
              {totals.grandTotal > 0 ? '₹' + Number(totals.grandTotal).toLocaleString('en-IN') : '—'}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <button className="add-item-btn" type="button" onClick={onAdd}>
        <span className="add-item-plus">+</span> Add Item
      </button>
    </div>
  );
}

/* ── Add form header ─────────────────────────────────── */
function InvoiceAddHeaderFields({ form, onChange, clients }) {
  return (
    <div className="form-row invoice-form-grid">
      <div className="form-field">
        <label className="field-label">Client *</label>
        <SearchableDropdown
          options={clients} value={form.clientCode}
          onChange={v => onChange('clientCode', v)}
          placeholder="Search client..."
          getLabel={c => `${c.clientCode} — ${c.name}`}
          getId={c => c._id} />
      </div>
      <div className="form-field">
        <label className="field-label">Date *</label>
        <input className="field-input" type="date" value={form.date}
          onChange={e => onChange('date', e.target.value)} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Subject *</label>
        <input className="field-input" placeholder="Invoice subject / title"
          value={form.subject} onChange={e => onChange('subject', e.target.value)} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Notes / Terms</label>
        <textarea className="field-input" rows={2}
          placeholder="Optional notes, payment terms, remarks..."
          value={form.notes} onChange={e => onChange('notes', e.target.value)} />
      </div>
    </div>
  );
}

/* ── Update form header ──────────────────────────────── */
function InvoiceUpdateHeaderFields({ form, onChange, clients }) {
  return (
    <div className="form-row invoice-form-grid">
      <div className="form-field">
        <label className="field-label">Client</label>
        <div className="dropdown-wrap">
          <select className="dropdown-select" value={form.clientCode} disabled>
            <option value="">-- Client --</option>
            {clients.map(c => (
              <option key={c._id} value={c._id}>{c.clientCode} — {c.name}</option>
            ))}
          </select>
          <span className="dropdown-arrow">▾</span>
        </div>
      </div>
      <div className="form-field">
        <label className="field-label">Date *</label>
        <input className="field-input" type="date" value={form.date}
          onChange={e => onChange('date', e.target.value)} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Subject *</label>
        <input className="field-input" placeholder="Invoice subject / title"
          value={form.subject} onChange={e => onChange('subject', e.target.value)} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Notes / Terms</label>
        <textarea className="field-input" rows={2}
          placeholder="Optional notes, payment terms, remarks..."
          value={form.notes} onChange={e => onChange('notes', e.target.value)} />
      </div>
    </div>
  );
}

/* ── CSV export ──────────────────────────────────────── */
function exportInvoicesToExcel(invoices, getClientLabel, getInvNo, getSubject) {
  const headers = [
    'Invoice No','Date','Client','Subject',
    'Total Amount (₹)','Total GST (₹)','Grand Total (₹)',
    'Advance Applied (₹)','Paid Amount (₹)','Balance (₹)',
    'Payment Status','Notes'
  ];
  const rows = invoices.map(inv => {
    const grandTotal    = Number(inv.grandTotal || 0);
    const paid          = Number(inv.cumulativePaidAmount || 0);
    const advanceApplied = Number(inv.advanceApplied || 0);
    const balance       = Math.max(0, grandTotal - paid);
    return [
      getInvNo(inv), inv.date?.split('T')[0] || '', getClientLabel(inv), getSubject(inv),
      inv.totalAmount || 0, inv.totalGST || 0, grandTotal,
      advanceApplied, paid, balance,
      inv.paymentStatus || '', inv.notes || '',
    ];
  });
  const escape     = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════
   ADVANCE PREVIEW PANEL
══════════════════════════════════════════════════════════════ */
function AdvancePreviewPanel({ clientId, grandTotal, advanceReceipts }) {
  if (!clientId || advanceReceipts.length === 0) return null;

  let invoiceRemaining = grandTotal;
  let totalWillApply   = 0;
  const receiptBreakdown = [];

  for (const r of advanceReceipts) {
    if (invoiceRemaining <= 0) break;
    const apply = Math.min(r.remainingAmount, invoiceRemaining);
    invoiceRemaining -= apply;
    totalWillApply   += apply;
    receiptBreakdown.push({
      receiptNumber:   r.receiptNumber,
      paymentDate:     r.paymentDate,
      currentRemaining: r.remainingAmount,
      willApply:       apply,
      afterApply:      r.remainingAmount - apply,
    });
  }

  const totalAdvailableAdvance = advanceReceipts.reduce((s, r) => s + r.remainingAmount, 0);
  const advanceAfterInvoice    = totalAdvailableAdvance - totalWillApply;
  const invoiceBalanceAfter    = Math.max(0, grandTotal - totalWillApply);

  return (
    <div style={{
      marginBottom: 20,
      borderRadius: 12,
      border: '1.5px solid #a0f0d8',
      background: 'linear-gradient(135deg, #e6fdf6 0%, #f0fdf9 100%)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        background: '#036b4e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            Advance Available — Auto-Apply Preview
          </span>
        </div>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          borderRadius: 20,
          padding: '2px 12px',
          fontSize: 13,
          fontWeight: 700,
        }}>
          ₹{Number(totalAdvailableAdvance).toLocaleString('en-IN')} Total Advance
        </span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {receiptBreakdown.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#036b4e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Receipts that will be used (oldest first):
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                background: '#fff',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}>
                <thead>
                  <tr style={{ background: '#f0fdf9' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left',  fontWeight: 700, color: '#036b4e', fontSize: 11, borderBottom: '1px solid #a0f0d8' }}>Receipt No</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left',  fontWeight: 700, color: '#036b4e', fontSize: 11, borderBottom: '1px solid #a0f0d8' }}>Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#036b4e', fontSize: 11, borderBottom: '1px solid #a0f0d8' }}>Current Balance</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#036b4e', fontSize: 11, borderBottom: '1px solid #a0f0d8' }}>Will Apply</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#036b4e', fontSize: 11, borderBottom: '1px solid #a0f0d8' }}>Remaining After</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptBreakdown.map((rb, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e6fdf6' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          background: '#e6fdf6', color: '#036b4e',
                          borderRadius: 6, padding: '2px 8px',
                          fontWeight: 700, fontSize: 12,
                          border: '1px solid #a0f0d8',
                        }}>
                          {rb.receiptNumber}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#555', fontSize: 12 }}>
                        {rb.paymentDate?.split('T')[0] || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#333' }}>
                        ₹{Number(rb.currentRemaining).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#036b4e' }}>
                        — ₹{Number(rb.willApply).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                        color: rb.afterApply === 0 ? '#aaa' : '#7a5000' }}>
                        {rb.afterApply === 0
                          ? <span style={{ fontSize: 11, color: '#aaa' }}>Exhausted</span>
                          : `₹${Number(rb.afterApply).toLocaleString('en-IN')}`
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          paddingTop: 10,
          borderTop: '1px solid #a0f0d8',
        }}>
          {grandTotal > 0 && (
            <>
              <div style={{ flex: 1, minWidth: 160, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #a0f0d8' }}>
                <div style={{ fontSize: 11, color: '#036b4e', fontWeight: 700, marginBottom: 4 }}>Invoice Total</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>
                  ₹{Number(grandTotal).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #a0f0d8' }}>
                <div style={{ fontSize: 11, color: '#036b4e', fontWeight: 700, marginBottom: 4 }}>Advance Will Apply</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#036b4e' }}>
                  ₹{Number(totalWillApply).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{
                flex: 1, minWidth: 160, borderRadius: 10, padding: '10px 14px',
                background: invoiceBalanceAfter > 0 ? '#fff4f7' : '#e6fdf6',
                border: `1px solid ${invoiceBalanceAfter > 0 ? '#ffc8d4' : '#a0f0d8'}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: invoiceBalanceAfter > 0 ? '#c93360' : '#036b4e' }}>
                  {invoiceBalanceAfter > 0 ? 'Balance Due After Creation' : 'Invoice Status After Creation'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: invoiceBalanceAfter > 0 ? '#c93360' : '#036b4e' }}>
                  {invoiceBalanceAfter > 0
                    ? `₹${Number(invoiceBalanceAfter).toLocaleString('en-IN')}`
                    : '✓ Fully Paid'}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160, background: '#fffbe8', borderRadius: 10, padding: '10px 14px', border: '1px solid #ffe08a' }}>
                <div style={{ fontSize: 11, color: '#7a5000', fontWeight: 700, marginBottom: 4 }}>Advance Remaining After</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7a5000' }}>
                  ₹{Number(advanceAfterInvoice).toLocaleString('en-IN')}
                </div>
              </div>
            </>
          )}
          {grandTotal <= 0 && (
            <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic' }}>
              Enter invoice items above to see advance application preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
function InvoicePage({ onLogout }) {
  const navigate = useNavigate();
  const [invoices,    setInvoices]    = useState([]);
  const [clients,     setClients]     = useState([]);
  const [activePanel, setPanel]       = useState(null);
  const [toast,       setToast]       = useState(null);
  const [loading,     setLoading]     = useState(false);

  const [clientAdvanceReceiptsMap, setClientAdvanceReceiptsMap] = useState({});

  const [addForm, setAddForm] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('invoice_addForm')) || emptyAddForm; }
    catch { return emptyAddForm; }
  });
  useEffect(() => {
    sessionStorage.setItem('invoice_addForm', JSON.stringify(addForm));
  }, [addForm]);

  const [updateInvoiceId, setUpdateInvoiceId] = useState('');
  const [updateFound,     setUpdateFound]     = useState(null);
  const [updateForm,      setUpdateForm]      = useState(emptyUpdateForm);

  const [deleteInvoiceId,   setDeleteInvoiceId]   = useState('');
  const [deleteFound,       setDeleteFound]       = useState(null);
  const [deletePreview,     setDeletePreview]     = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [statusFilter,      setStatusFilter]      = useState('All');
  const [searchInvNo,       setSearchInvNo]       = useState('');
  const [searchClient,      setSearchClient]      = useState('');
  const [searchProject,     setSearchProject]     = useState('');
  const [dateFrom,          setDateFrom]          = useState('');
  const [dateTo,            setDateTo]            = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [editingId,         setEditingId]         = useState(null);
  const [inlineForm,        setInlineForm]        = useState(emptyUpdateForm);
  const [invoiceReceipts,   setInvoiceReceipts]   = useState({});
  const [expandedReceipts,  setExpandedReceipts]  = useState({});

  const [lastCreateInfo, setLastCreateInfo] = useState(null);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const fetchClients = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/client/getall`);
      const d = await r.json();
      setClients(Array.isArray(d) ? d : (d.data || []));
    } catch {}
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API_BASE_URL}/invoice/getall`);
      const d = await r.json();
      setInvoices(d.data || []);
    } catch { showToast('Failed to fetch invoices', 'error'); }
    finally  { setLoading(false); }
  }, [showToast]);

  const fetchClientAdvances = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/receipt/getall`);
      const d = await r.json();
      const receipts = d.receipts || [];

      const map = {};
      receipts.forEach(rcpt => {
        const hasInvoice = !!(rcpt.invoice && rcpt.invoice !== '' && rcpt.invoice !== null);
        if (hasInvoice) return;
        const rem = Number(rcpt.remainingAmount ?? 0);
        if (rem <= 0) return;

        const cid = rcpt.client?._id || (typeof rcpt.client === 'string' ? rcpt.client : null);
        if (!cid) return;

        if (!map[cid]) map[cid] = [];
        map[cid].push({
          _id:           rcpt._id,
          receiptNumber: rcpt.receiptNumber,
          paymentDate:   rcpt.paymentDate,
          remainingAmount: rem,
        });
      });

      Object.keys(map).forEach(cid => {
        map[cid].sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
      });

      setClientAdvanceReceiptsMap(map);
    } catch {}
  }, []);

  useEffect(() => {
    fetchClients();
    fetchInvoices();
    fetchClientAdvances();
  }, [fetchClientAdvances, fetchInvoices]);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setUpdateInvoiceId(''); setUpdateForm(emptyUpdateForm); setUpdateFound(null);
    setDeleteInvoiceId(''); setDeleteFound(null); setDeletePreview(null); setDeleteConfirmText('');
    setSelectedInvoiceId(''); setEditingId(null); setInlineForm(emptyUpdateForm);
    setStatusFilter('All'); setSearchInvNo(''); setSearchClient('');
    setSearchProject(''); setDateFrom(''); setDateTo('');
    setInvoiceReceipts({}); setExpandedReceipts({});
    setLastCreateInfo(null);
    fetchClientAdvances();
  };

  const changeItems = setter => updated => setter(prev => ({ ...prev, items: updated }));
  const addItem     = setter => ()      => setter(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const removeItem  = setter => idx     => setter(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const handleAddFormChange = useCallback((k, v) => {
    setAddForm(prev => ({ ...prev, [k]: v }));
    if (k === 'clientCode') {
      fetchClientAdvances();
    }
  }, [fetchClientAdvances]);

  /* ── ADD ── */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.clientCode || !addForm.date || !addForm.subject) {
      showToast('Please fill client, date and subject', 'error'); return;
    }
    if (addForm.items.some(it => !it.description)) {
      showToast('Each item needs a description', 'error'); return;
    }
    try {
      setLoading(true);
      setLastCreateInfo(null);
      const payload = buildAddPayload(addForm);
      const res  = await fetch(`${API_BASE_URL}/invoice/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const inv = data.data;
        if (inv && inv.cumulativePaidAmount > 0) {
          setLastCreateInfo({
            invoiceNumber:        inv.invoiceNumber,
            grandTotal:           inv.grandTotal,
            cumulativePaidAmount: inv.cumulativePaidAmount,
            remainingBalance:     Math.max(0, inv.grandTotal - inv.cumulativePaidAmount),
            paymentStatus:        inv.paymentStatus,
          });
          showToast(`Invoice created! ₹${Number(inv.cumulativePaidAmount).toLocaleString('en-IN')} advance auto-applied.`);
        } else {
          showToast('Invoice created successfully!');
        }
        await fetchInvoices();
        await fetchClientAdvances();
        setAddForm(emptyAddForm);
        sessionStorage.removeItem('invoice_addForm');
      } else { showToast(data.message || 'Failed to create invoice', 'error'); }
    } catch { showToast('Error creating invoice', 'error'); }
    finally  { setLoading(false); }
  };

  /* ── UPDATE ── */
  const handleUpdateSelect = (invId) => {
    setUpdateInvoiceId(invId);
    const found = invoices.find(i => i._id === invId);
    if (found) { setUpdateFound(found); setUpdateForm(invoiceToUpdateForm(found)); }
    else       { setUpdateFound(null);  setUpdateForm(emptyUpdateForm); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select an invoice', 'error'); return; }
    try {
      setLoading(true);
      const basicPayload = buildUpdatePayload(updateForm);
      const res = await fetch(`${API_BASE_URL}/invoice/update/${updateFound._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basicPayload),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.message || 'Failed to update invoice', 'error'); return;
      }
      const productsRes = await fetch(`${API_BASE_URL}/invoice/update-products/${updateFound._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: buildProducts(updateForm.items) }),
      });
      if (!productsRes.ok) {
        const d = await productsRes.json();
        showToast(d.message || 'Failed to update products', 'error'); return;
      }
      await fetchInvoices();
      showToast('Invoice updated successfully!');
      setUpdateFound(null); setUpdateInvoiceId(''); setUpdateForm(emptyUpdateForm);
    } catch { showToast('Error updating invoice', 'error'); }
    finally  { setLoading(false); }
  };

  /* ── DELETE ── */
  const handleDeleteSelect = async (invId) => {
    setDeleteInvoiceId(invId);
    setDeleteConfirmText('');
    setDeletePreview(null);
    const found = invoices.find(i => i._id === invId);
    setDeleteFound(found || null);
    if (!found) return;

    try {
      const res = await fetch(`${API_BASE_URL}/receipt/getall`);
      const data = await res.json();
      const allReceipts = data.receipts || [];

      const linkedReceipts = allReceipts.filter(r => {
        const rInvId = r.invoice?._id || (typeof r.invoice === 'string' ? r.invoice : null);
        return rInvId === invId;
      });

      const totalPaid = linkedReceipts.reduce((s, r) => s + (Number(r.paidAmountInReceipt) || 0), 0);

      setDeletePreview({
        receiptCount: linkedReceipts.length,
        totalPaid,
      });
    } catch {
      setDeletePreview({ receiptCount: '?', totalPaid: 0 });
    }
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select an invoice', 'error'); return; }

    const hasCascade = deletePreview && deletePreview.receiptCount > 0;

    if (hasCascade && deleteConfirmText.trim().toLowerCase() !== 'delete') {
      showToast('Type "delete" to confirm cascade deletion', 'error');
      return;
    }

    try {
      setLoading(true);

      const rcptRes  = await fetch(`${API_BASE_URL}/receipt/getall`);
      const rcptData = await rcptRes.json();
      const allReceipts = rcptData.receipts || [];

      const linkedReceipts = allReceipts.filter(r => {
        const rInvId = r.invoice?._id || (typeof r.invoice === 'string' ? r.invoice : null);
        return rInvId === deleteFound._id;
      });

      let receiptDeleteErrors = 0;
      for (const rcpt of linkedReceipts) {
        const res = await fetch(`${API_BASE_URL}/receipt/delete/${rcpt._id}`, { method: 'DELETE' });
        if (!res.ok) receiptDeleteErrors++;
      }

      const invRes = await fetch(`${API_BASE_URL}/invoice/delete/${deleteFound._id}`, { method: 'DELETE' });

      if (invRes.ok) {
        await fetchInvoices();
        await fetchClientAdvances();

        let msg = 'Invoice deleted successfully!';
        if (linkedReceipts.length > 0) {
          msg += ` (${linkedReceipts.length} receipt${linkedReceipts.length !== 1 ? 's' : ''} also removed)`;
        }
        if (receiptDeleteErrors > 0) {
          msg += ` ⚠️ Some receipts may not have deleted cleanly.`;
        }

        showToast(msg, 'info');
        setDeleteFound(null);
        setDeleteInvoiceId('');
        setDeletePreview(null);
        setDeleteConfirmText('');
      } else {
        const d = await invRes.json();
        showToast(d.message || 'Failed to delete invoice', 'error');
      }
    } catch {
      showToast('Error during cascade delete', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Inline edit ── */
  const startInlineEdit = inv => {
    setEditingId(inv._id);
    setInlineForm(invoiceToUpdateForm(inv));
  };

  const saveInlineEdit = async (id) => {
    try {
      setLoading(true);
      const basicPayload = buildUpdatePayload(inlineForm);
      const res = await fetch(`${API_BASE_URL}/invoice/update/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basicPayload),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.message || 'Failed to update', 'error'); return; }
      await fetch(`${API_BASE_URL}/invoice/update-products/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: buildProducts(inlineForm.items) }),
      });
      await fetchInvoices();
      showToast('Invoice updated!');
      setEditingId(null); setInlineForm(emptyUpdateForm);
    } catch { showToast('Error updating invoice', 'error'); }
    finally  { setLoading(false); }
  };

  /* ── Receipts toggle ── */
  const toggleInvoiceReceipts = async (invId) => {
    if (expandedReceipts[invId]) {
      setExpandedReceipts(prev => ({ ...prev, [invId]: false })); return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/receipt/get-by-invoice/${invId}`);
      if (res.status === 404) {
        setInvoiceReceipts(prev => ({ ...prev, [invId]: [] }));
        setExpandedReceipts(prev => ({ ...prev, [invId]: true })); return;
      }
      const data  = await res.json();
      const rcpts = Array.isArray(data) ? data : (data.receipts || []);
      setInvoiceReceipts(prev => ({ ...prev, [invId]: rcpts }));
      setExpandedReceipts(prev => ({ ...prev, [invId]: true }));
    } catch { showToast('Failed to fetch receipts', 'error'); }
  };

  /* ── Display helpers ── */
  const getClientLabel = (inv) => {
    const c = inv.client;
    if (!c) return 'N/A';
    if (typeof c === 'object' && c.name) return `${c.clientCode} — ${c.name}`;
    const found = clients.find(cl => cl._id === c);
    return found ? `${found.clientCode} — ${found.name}` : String(c);
  };
  const getInvNo   = (inv) => inv.invoiceNumber || `INV-${inv._id?.toString().slice(-4)}`;
  const getSubject = (inv) => inv.subject || '';

  const getPaymentDisplay = (inv) => {
    const grandTotal     = Number(inv.grandTotal || 0);
    const paid           = Number(inv.cumulativePaidAmount || 0);
    const balance        = Math.max(0, grandTotal - paid);
    const advanceApplied = Number(inv.advanceApplied || 0);
    return { grandTotal, paid, balance, advanceApplied };
  };

  /* ── PRINT ── */
  const handlePrint = (inv) => {
    const cl         = inv.client;
    const clientObj  = (typeof cl === 'object' && cl) ? cl : clients.find(c => c._id === cl) || {};
    const clientCode = clientObj.clientCode || '';
    const clientName = clientObj.name       || '';
    const clientAddr = clientObj.address    || '';
    const clientGST  = clientObj.gstNumber  || '';

    const n     = getInvNo(inv);
    const prods = Array.isArray(inv.products) ? inv.products : [];

    const formatDate = (raw) => {
      if (!raw) return '';
      const d = new Date(raw);
      if (isNaN(d)) return raw;
      const day = d.getDate();
      const sfx = [11, 12, 13].includes(day) ? 'th'
                : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
      const mo = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
      return `${day}${sfx} ${mo[d.getMonth()]} ${d.getFullYear()}`;
    };

    const fmt = v => Number(v || 0).toLocaleString('en-IN');

    const grandTotal = Number(inv.grandTotal || 0);
    const paid       = Number(inv.cumulativePaidAmount || 0);
    const balance    = Math.max(0, grandTotal - paid);
    const displayPaid = Math.min(paid, grandTotal);

    const itemRows = prods.map((p, i) => {
      const amount = Number(p.amount   || 0);
      const rate   = Number(p.rate     || 0);
      const qty    = Number(p.quantity || 0);
      const gstPct = Number(p.gstPercent || 0);
      const gstAmt = Number(p.gstAmount  || parseFloat(((amount * gstPct) / 100).toFixed(2)));
      const total  = Number(p.netTotal   || parseFloat((amount + gstAmt).toFixed(2)));
      return `
        <tr>
          <td class="tc">${p.serialNo || i + 1}</td>
          <td>${p.description || ''}</td>
          <td class="tc">${qty}</td>
          <td class="tr">${fmt(rate)}</td>
          <td class="tr">${fmt(amount)}</td>
          <td class="tc">${gstPct > 0 ? gstPct + '%' : '—'}</td>
          <td class="tr">${gstAmt > 0 ? fmt(gstAmt) : '—'}</td>
          <td class="tr bold">${fmt(total)}</td>
        </tr>`;
    }).join('');

    const totalGST = Number(inv.totalGST    || 0);
    const totalAmt = Number(inv.totalAmount || 0);

    const w = window.open('', '_blank', 'width=1050,height=780');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Invoice ${n}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800;900&family=Open+Sans:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Open Sans',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;}
  .hdr{background:#1c1c1c;display:flex;justify-content:space-between;align-items:center;padding:18px 32px;gap:24px;}
  .hdr-brand{display:flex;align-items:center;gap:0;flex-shrink:0;}
  .logo-icon{width:80px;height:50px;margin-right:10px;flex-shrink:0;}
  .hdr-div{width:1px;height:50px;background:rgba(255,255,255,0.22);margin:0 24px;flex-shrink:0;}
  .hdr-addr{font-size:10.5px;line-height:1.85;color:#ffffff;}
  .hdr-inv-title{font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;letter-spacing:6px;color:#ffffff;text-align:right;white-space:nowrap;flex-shrink:0;}
  .body{padding:26px 32px 0;}
  .meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;}
  .cid-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .cid-lbl{font-size:12px;font-weight:700;color:#333;}
  .cid-box{border:1px solid #bbb;border-radius:4px;padding:5px 12px;font-size:12px;font-weight:700;min-width:155px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
  .c-name{font-size:13.5px;font-weight:700;color:#111;margin-bottom:3px;}
  .c-addr{font-size:11.5px;color:#444;line-height:1.7;max-width:295px;}
  .c-gst{font-size:11.5px;color:#222;font-weight:700;margin-top:5px;}
  .date-col{text-align:right;}
  .date-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:8px;}
  .date-lbl{font-size:12px;font-weight:700;}
  .date-box{border:1px solid #bbb;border-radius:4px;padding:5px 14px;font-size:12px;font-weight:700;min-width:160px;text-align:center;}
  .inv-no-row{font-size:12px;color:#333;margin-top:4px;}
  .subj{margin-bottom:16px;font-size:13px;font-weight:600;}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#1c1c1c;color:#fff;}
  thead th{padding:10px 11px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.3px;}
  tbody tr{border-bottom:1px solid #e8e8e8;}
  tbody tr:nth-child(even){background:#fafafa;}
  tbody td{padding:10px 11px;font-size:12px;}
  .totals-wrap{display:flex;justify-content:flex-end;margin-top:20px;}
  .tot-tbl{width:320px;border:1px solid #ddd;border-radius:6px;overflow:hidden;border-collapse:collapse;}
  .tot-tbl td{padding:9px 14px;font-size:12.5px;border-bottom:1px solid #eee;}
  .tot-tbl tr:last-child td{border-bottom:none;}
  .tot-lbl{color:#555;font-weight:600;}
  .tot-val{text-align:right;font-weight:700;}
  .row-grand td{background:#1c1c1c;color:#fff;font-weight:800;font-size:13px;}
  .row-bal td{color:#c93360;font-weight:700;}
  .row-paid .tot-val{color:#036b4e;}
  .row-adv td{background:#e6fdf6;}
  .row-adv .tot-lbl{color:#036b4e;}
  .row-adv .tot-val{color:#036b4e;}
  .row-gst td{background:#fffbe8;}
  .row-gst .tot-lbl{color:#7a5000;}
  .row-gst .tot-val{color:#7a5000;}
  .notes{margin-top:22px;padding:12px 16px;background:#f8f8f8;border-left:3px solid #1c1c1c;font-size:12px;color:#444;line-height:1.65;}
  .footer{margin-top:40px;padding:14px 32px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#999;}
  .tc{text-align:center;} .tr{text-align:right;} .bold{font-weight:700;}
  @media print{body{padding:0;}.page{width:100%;margin:0;}@page{margin:8mm;}}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div style="display:flex;align-items:center;flex:1;min-width:0;">
      <img src="${window.location.origin}${logo}" alt="logo" class="logo-icon"/>
      <div class="hdr-div"></div>
      <div class="hdr-addr">
        5-6, Indira Nagar, PM Samy Colony, Ratinapuri, Coimbatore 641012, India<br/>
        M : +91 9677731526 &nbsp;&nbsp;|&nbsp;&nbsp; E : info@designartindia.in<br/>
        GST No. : 33BNCPP2332Q1ZT
      </div>
    </div>
    <div class="hdr-inv-title">INVOICE</div>
  </div>
  <div class="body">
    <div class="meta">
      <div class="client-col">
        <div class="cid-row">
          <span class="cid-lbl">Client ID :</span>
          <div class="cid-box"><span>${clientCode || 'N/A'}</span><span>&#9660;</span></div>
        </div>
        ${clientName ? `<div class="c-name">${clientName}</div>` : ''}
        ${clientAddr ? `<div class="c-addr">${clientAddr.replace(/\n/g, '<br/>')}</div>` : ''}
        ${clientGST  ? `<div class="c-gst">GST No. &nbsp;${clientGST}</div>` : ''}
      </div>
      <div class="date-col">
        <div class="date-row">
          <span class="date-lbl">Date :</span>
          <div class="date-box">${formatDate(inv.date)}</div>
        </div>
        <div class="inv-no-row" style="margin-top:8px;"><strong>Invoice No :</strong>&nbsp;${n}</div>
      </div>
    </div>
    <div class="subj"><strong>Subject :</strong>&nbsp;<span>${inv.subject || ''}</span></div>
    <table>
      <thead>
        <tr>
          <th class="tc" style="width:42px">S.No.</th>
          <th style="text-align:left">Description</th>
          <th class="tc" style="width:46px">Qty.</th>
          <th class="tr" style="width:80px">Rate</th>
          <th class="tr" style="width:84px">Amount</th>
          <th class="tc" style="width:56px">GST %</th>
          <th class="tr" style="width:78px">GST Amt</th>
          <th class="tr" style="width:90px">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="8" style="text-align:center;padding:20px;color:#aaa">No items</td></tr>`}
      </tbody>
    </table>
    <div class="totals-wrap">
      <table class="tot-tbl">
        <tr><td class="tot-lbl">Sub Total (before GST)</td><td class="tot-val">&#8377;${fmt(totalAmt)}</td></tr>
        ${totalGST > 0 ? `<tr class="row-gst"><td class="tot-lbl">Total GST</td><td class="tot-val">&#8377;${fmt(totalGST)}</td></tr>` : ''}
        <tr class="row-grand"><td class="tot-lbl">Grand Total</td><td class="tot-val">&#8377;${fmt(grandTotal)}</td></tr>
        ${displayPaid > 0 ? `<tr class="row-paid"><td class="tot-lbl">Amount Paid (incl. Advance)</td><td class="tot-val">&#8377;${fmt(displayPaid)}</td></tr>` : ''}
        ${balance > 0 ? `<tr class="row-bal"><td class="tot-lbl">Balance Due</td><td class="tot-val">&#8377;${fmt(balance)}</td></tr>` : ''}
      </table>
    </div>
    ${inv.notes ? `<div class="notes"><strong>Notes / Terms :</strong>&nbsp;${inv.notes}</div>` : ''}
  </div>
  <div class="footer">
    <span>designart &nbsp;|&nbsp; 5-6, Indira Nagar, Coimbatore 641012</span>
    <span>Thank you for your business!</span>
  </div>
</div>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`);
    w.document.close();
  };

  /* ── Status badge ── */
  const statusBadge = (status) => {
    const map = {
      Paid:    'status-paid',
      Partial: 'status-partial',
      Unpaid:  'status-pending',
    };
    return <span className={`status-badge ${map[status] || 'status-pending'}`}>{status || 'Unpaid'}</span>;
  };

  const renderTotalsSummary = (form) => {
    const t = calcTotals(form.items);
    if (t.grandTotal <= 0) return null;
    return (
      <div className="invoice-totals-summary">
        {t.totalAmount > 0 && (
          <div className="inv-total-row">
            <span>Sub Total</span>
            <strong>₹{Number(t.totalAmount).toLocaleString('en-IN')}</strong>
          </div>
        )}
        {t.totalGST > 0 && (
          <div className="inv-total-row inv-gst-row">
            <span>Total GST</span>
            <strong style={{ color: '#7a5000' }}>₹{Number(t.totalGST).toLocaleString('en-IN')}</strong>
          </div>
        )}
        <div className="inv-total-row inv-grand-row">
          <span>Grand Total</span>
          <strong>₹{Number(t.grandTotal).toLocaleString('en-IN')}</strong>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════
     ✅ FIXED: renderPaymentSummaryRow
     Now shows: Grand Total → (− Advance) → Balance Due / Fully Paid
  ══════════════════════════════════════════════════════════ */
  const renderPaymentSummaryRow = (inv) => {
    const grandTotal     = Number(inv.grandTotal || 0);
    const advanceApplied = Number(inv.advanceApplied || 0);
    const paid           = Number(inv.cumulativePaidAmount || 0);
    const balance        = Math.max(0, grandTotal - paid);

    // Receipt-only paid (non-advance portion)
    const receiptPaid = Math.max(0, paid - advanceApplied);

    return (
      <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Grand Total */}
        <span className="inv-row-amt">
          ₹{Number(grandTotal).toLocaleString('en-IN')}
        </span>

        {/* Advance Applied — shown as deduction */}
        {advanceApplied > 0 && (
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#036b4e',
            background: '#e6fdf6',
            border: '1px solid #a0f0d8',
            borderRadius: 6,
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}>
            <span style={{ color: '#036b4e', fontWeight: 800 }}>−</span>
            ₹{Number(advanceApplied).toLocaleString('en-IN')}
            <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>Adv</span>
          </span>
        )}

        {/* Receipt paid (non-advance) — only show if > 0 */}
        {receiptPaid > 0 && (
          <span className="inv-row-paid">
            Paid ₹{Number(receiptPaid).toLocaleString('en-IN')}
          </span>
        )}

        {/* Balance Due or Fully Paid */}
        {balance > 0 ? (
          <span className="inv-row-bal">
            Bal ₹{Number(balance).toLocaleString('en-IN')}
          </span>
        ) : paid > 0 ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#036b4e' }}>✓ Fully Paid</span>
        ) : null}

        {/* GST pill */}
        {(inv.totalGST || 0) > 0 && (
          <span style={{ fontSize: 11, color: '#7a5000', fontWeight: 600 }}>
            GST ₹{Number(inv.totalGST).toLocaleString('en-IN')}
          </span>
        )}
      </div>
    );
  };

  /* ── Filter ── */
  const filteredInvoices = invoices.filter(inv => {
    const matchStatus  = statusFilter === 'All' || inv.paymentStatus === statusFilter;
    const matchInvNo   = !searchInvNo.trim()   || getInvNo(inv).toLowerCase().includes(searchInvNo.toLowerCase());
    const matchClient  = !searchClient.trim()  || getClientLabel(inv).toLowerCase().includes(searchClient.toLowerCase());
    const matchProject = !searchProject.trim() || getSubject(inv).toLowerCase().includes(searchProject.toLowerCase());
    const invDate      = inv.date?.split('T')[0] || '';
    const matchFrom    = !dateFrom || invDate >= dateFrom;
    const matchTo      = !dateTo   || invDate <= dateTo;
    return matchStatus && matchInvNo && matchClient && matchProject && matchFrom && matchTo;
  });

  const selectedInvoiceObj = invoices.find(i => i._id === selectedInvoiceId);
  const countAll     = invoices.length;
  const countPaid    = invoices.filter(i => i.paymentStatus === 'Paid').length;
  const countPartial = invoices.filter(i => i.paymentStatus === 'Partial').length;
  const countUnpaid  = invoices.filter(i => i.paymentStatus === 'Unpaid').length;
  const hasFilters   = searchInvNo || searchClient || searchProject || dateFrom || dateTo;
  const clearFilters = () => { setSearchInvNo(''); setSearchClient(''); setSearchProject(''); setDateFrom(''); setDateTo(''); };

  const hasCascadeData = deletePreview && deletePreview.receiptCount > 0;

  const renderDetailPaymentGrid = (inv) => {
    const { grandTotal, paid, balance, advanceApplied } = getPaymentDisplay(inv);
    const rows = [
      ['Client',      getClientLabel(inv)],
      ['Date',        inv.date?.split('T')[0]],
      ['Sub Total',   `₹${Number(inv.totalAmount || 0).toLocaleString('en-IN')}`],
      ['Total GST',   `₹${Number(inv.totalGST    || 0).toLocaleString('en-IN')}`],
      ['Grand Total', `₹${Number(grandTotal).toLocaleString('en-IN')}`],
    ];
    if (advanceApplied > 0) {
      rows.push(['Advance Applied', `− ₹${Number(advanceApplied).toLocaleString('en-IN')}`]);
    }
    rows.push(['Paid Amount', `₹${Number(Math.min(paid, grandTotal)).toLocaleString('en-IN')}`]);
    if (balance > 0) {
      rows.push(['Balance Due', `₹${Number(balance).toLocaleString('en-IN')}`]);
    } else if (paid > 0) {
      rows.push(['Balance Due', '₹0 (Fully Paid)']);
    }
    return rows;
  };

  // Derived values for the Add panel
  const selectedClientAdvanceReceipts = addForm.clientCode
    ? (clientAdvanceReceiptsMap[addForm.clientCode] || [])
    : [];
  const selectedClientAdvanceTotal = selectedClientAdvanceReceipts.reduce((s, r) => s + r.remainingAmount, 0);
  const addFormTotals = calcTotals(addForm.items);

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">Invoice Management</h1>
          <span className="entity-page-badge" style={{ background: '#fffbe8', color: '#7a5000', border: '1px solid #ffe08a' }}>
            {invoices.length} Invoices
          </span>
        </div>

        <div className="action-cards-grid">
  <div
    className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.ADD)}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Add Invoice</div>
    <div className="action-card-desc">Create a new client invoice</div>
  </div>

  <div
    className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.UPDATE)}
  >
    <div className="action-card-icon">✏️</div>
    <div className="action-card-title">Update Invoice</div>
    <div className="action-card-desc">Edit existing invoice details</div>
  </div>

 
  <div
    className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.GETALL)}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">Get All Invoices</div>
    <div className="action-card-desc">View all invoice records</div>
  </div>

   <div
    className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.DELETE)}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Invoice</div>
    <div className="action-card-desc">Remove an invoice record</div>
  </div>

</div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ══ ADD ══ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Invoice</div>

            {lastCreateInfo && (
              <div className="advance-note-bar" style={{ marginBottom: 16 }}>
                <span>💰</span>
                <div>
                  <div>
                    Invoice <strong>{lastCreateInfo.invoiceNumber}</strong> created.
                    Advance payment of <strong>₹{Number(lastCreateInfo.cumulativePaidAmount).toLocaleString('en-IN')}</strong> was
                    automatically applied. Status: <strong>{lastCreateInfo.paymentStatus}</strong>.
                  </div>
                  {lastCreateInfo.remainingBalance > 0 ? (
                    <div style={{ marginTop: 6, fontWeight: 700, color: '#c93360' }}>
                      Remaining balance to collect: ₹{Number(lastCreateInfo.remainingBalance).toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontWeight: 700, color: '#036b4e' }}>
                      ✓ Invoice fully covered by advance payment!
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAdd}>
              <InvoiceAddHeaderFields
                form={addForm}
                onChange={handleAddFormChange}
                clients={clients}
              />

              {selectedClientAdvanceTotal > 0 && (
                <AdvancePreviewPanel
                  clientId={addForm.clientCode}
                  grandTotal={addFormTotals.grandTotal}
                  advanceReceipts={selectedClientAdvanceReceipts}
                />
              )}

              <div className="items-section-label">Work Items</div>
              <ItemsTable
                items={addForm.items}
                onChange={changeItems(setAddForm)}
                onAdd={addItem(setAddForm)}
                onRemove={removeItem(setAddForm)}
              />
              {renderTotalsSummary(addForm)}
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="submit" className="submit-btn" disabled={loading}>Add Invoice</button>
                {addFormTotals.grandTotal > 0 && (
                  <button type="button" className="submit-btn invoice-print-btn"
                    onClick={() => handlePrint({
                      ...buildAddPayload(addForm),
                      products: addForm.items.map((it, i) => ({
                        serialNo: i + 1, description: it.description,
                        quantity: parseFloat(it.qty) || 0, rate: parseFloat(it.rate) || 0,
                        gstPercent: parseFloat(it.gstPercent) || 0, amount: parseFloat(it.amount) || 0,
                        gstAmount: parseFloat(it.gstAmount) || 0, netTotal: parseFloat(it.netTotal) || 0,
                      })),
                      client: clients.find(c => c._id === addForm.clientCode),
                      cumulativePaidAmount: 0,
                    })}>
                    Print Preview
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ══ UPDATE ══ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Invoice</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search & Select Invoice *</label>
              <SearchableDropdown
                options={invoices} value={updateInvoiceId} onChange={handleUpdateSelect}
                placeholder="Type invoice no, client or subject..."
                getLabel={i => `${getInvNo(i)} — ${getClientLabel(i)} — ${getSubject(i)} — ₹${Number(i.grandTotal).toLocaleString('en-IN')} (${i.paymentStatus})`}
                getId={i => i._id}
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{getInvNo(updateFound)}</span>
                  <span className="update-found-name">{getSubject(updateFound)}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <InvoiceUpdateHeaderFields
                    form={updateForm}
                    onChange={(k, v) => setUpdateForm(prev => ({ ...prev, [k]: v }))}
                    clients={clients}
                  />
                  <div className="items-section-label">Work Items</div>
                  <ItemsTable
                    items={updateForm.items}
                    onChange={changeItems(setUpdateForm)}
                    onAdd={addItem(setUpdateForm)}
                    onRemove={removeItem(setUpdateForm)}
                  />
                  {renderTotalsSummary(updateForm)}
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ marginTop: 20, background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Invoice
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE ══ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Invoice</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search & Select Invoice *</label>
              <SearchableDropdown
                options={invoices} value={deleteInvoiceId} onChange={handleDeleteSelect}
                placeholder="Type invoice no, client or subject..."
                getLabel={i => `${getInvNo(i)} — ${getClientLabel(i)} — ${getSubject(i)} — ₹${Number(i.grandTotal).toLocaleString('en-IN')} (${i.paymentStatus})`}
                getId={i => i._id}
              />
            </div>

            {deleteFound && (() => {
              const { grandTotal, paid, balance, advanceApplied } = getPaymentDisplay(deleteFound);
              return (
                <div className="detail-card" style={{ marginTop: 20 }}>
                  {[
                    ['Invoice No',     getInvNo(deleteFound)],
                    ['Client',         getClientLabel(deleteFound)],
                    ['Date',           deleteFound.date?.split('T')[0]],
                    ['Subject',        getSubject(deleteFound)],
                    ['Sub Total',      `₹${Number(deleteFound.totalAmount || 0).toLocaleString('en-IN')}`],
                    ['Total GST',      `₹${Number(deleteFound.totalGST    || 0).toLocaleString('en-IN')}`],
                    ['Grand Total',    `₹${Number(grandTotal).toLocaleString('en-IN')}`],
                    ...(advanceApplied > 0 ? [['Advance Applied', `− ₹${Number(advanceApplied).toLocaleString('en-IN')}`]] : []),
                    ['Paid Amount',    `₹${Number(paid).toLocaleString('en-IN')}`],
                    ['Balance',        `₹${Number(balance).toLocaleString('en-IN')}${balance === 0 && paid > 0 ? ' (Fully Paid)' : ''}`],
                    ['Status',         deleteFound.paymentStatus],
                    ['Notes',          deleteFound.notes || '—'],
                  ].map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span className="detail-key">{k}</span>
                      <span className="detail-val">{v}</span>
                    </div>
                  ))}

                  {deletePreview === null && (
                    <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8faff', borderRadius: 8, fontSize: 13, color: '#666' }}>
                      ⏳ Loading linked receipts...
                    </div>
                  )}

                  {deletePreview && (
                    <div style={{ marginTop: 14 }}>
                      {deletePreview.receiptCount === 0 && (
                        <div style={{ padding: '10px 14px', background: '#e6fdf6', borderRadius: 8, border: '1px solid #a0f0d8', fontSize: 13, color: '#036b4e', fontWeight: 600 }}>
                          ✅ This invoice has no linked receipts. Safe to delete.
                        </div>
                      )}

                      {deletePreview.receiptCount > 0 && (
                        <div style={{ padding: '14px 16px', background: '#fff4f7', borderRadius: 10, border: '1.5px solid #ffc8d4' }}>
                          <div style={{ fontWeight: 700, color: '#c93360', fontSize: 14, marginBottom: 10 }}>
                            ⚠️ Cascade Delete Warning
                          </div>

                          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, marginBottom: 12 }}>
                            Deleting invoice <strong>{getInvNo(deleteFound)}</strong> will permanently remove:
                          </div>

                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                            <div style={{ padding: '8px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ffc8d4', fontSize: 13, fontWeight: 700, color: '#c93360' }}>
                              🧾 {deletePreview.receiptCount} Receipt{deletePreview.receiptCount !== 1 ? 's' : ''}
                            </div>
                            {deletePreview.totalPaid > 0 && (
                              <div style={{ padding: '8px 14px', background: '#fff8e6', borderRadius: 8, border: '1px solid #ffe08a', fontSize: 13, fontWeight: 700, color: '#7a5000' }}>
                                💰 ₹{Number(deletePreview.totalPaid).toLocaleString('en-IN')} Total Paid
                              </div>
                            )}
                          </div>

                          <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
                            This action <strong>cannot be undone</strong>. All receipts and payment history for this invoice will be permanently deleted.
                          </div>

                          <div className="form-field" style={{ marginBottom: 0 }}>
                            <label className="field-label" style={{ color: '#c93360', fontWeight: 700 }}>
                              Type <strong>"delete"</strong> to confirm cascade deletion
                            </label>
                            <input
                              className="field-input"
                              placeholder='Type "delete" here...'
                              value={deleteConfirmText}
                              onChange={e => setDeleteConfirmText(e.target.value)}
                              style={{ borderColor: deleteConfirmText.trim().toLowerCase() === 'delete' ? '#10b981' : '#ffc8d4' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="delete-confirm-btn"
                    style={{
                      marginTop: 16,
                      opacity: (hasCascadeData && deleteConfirmText.trim().toLowerCase() !== 'delete') ? 0.5 : 1
                    }}
                    onClick={handleDelete}
                    disabled={loading || (hasCascadeData && deleteConfirmText.trim().toLowerCase() !== 'delete')}
                  >
                    {hasCascadeData ? '🗑️ Cascade Delete Invoice + All Receipts' : 'Confirm Delete'}
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ GET ALL ══ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="getall-header-row">
              <div className="panel-title" style={{ margin: 0 }}>All Invoices</div>
              <button className="excel-export-btn"
                onClick={() => exportInvoicesToExcel(filteredInvoices, getClientLabel, getInvNo, getSubject)}
                title="Download filtered invoices as CSV">
                <span>⬇</span> Export CSV
              </button>
            </div>

            <div className="inv-summary-chips">
              <div className="inv-chip-card chip-total">
                <span>Total Invoices</span>
                <strong>{invoices.length}</strong>
              </div>
              <div className="inv-chip-card chip-billed">
                <span>Total Billed</span>
                <strong>₹{invoices.reduce((s, i) => s + (i.grandTotal || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="inv-chip-card chip-received">
                <span>Total Received</span>
                <strong>₹{invoices.reduce((s, i) => s + Math.min(Number(i.cumulativePaidAmount || 0), Number(i.grandTotal || 0)), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="inv-chip-card chip-due">
                <span>Outstanding</span>
                <strong>₹{invoices.reduce((s, inv) => {
                  const { balance } = getPaymentDisplay(inv);
                  return s + balance;
                }, 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="inv-status-filter-row">
              {[
                { label: 'All',     count: countAll,     key: 'All',     cls: 'filter-all' },
                { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'filter-paid' },
                { label: 'Partial', count: countPartial, key: 'Partial', cls: 'filter-partial' },
                { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'filter-unpaid' },
              ].map(tab => (
                <button key={tab.key}
                  className={`inv-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(tab.key); setSelectedInvoiceId(''); }}>
                  {tab.label}<span className="inv-filter-count">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="multi-filter-grid">
              <div className="form-field">
                <label className="field-label">Invoice No</label>
                <input className="field-input" placeholder="INV0001..." value={searchInvNo} onChange={e => setSearchInvNo(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Client</label>
                <input className="field-input" placeholder="Search client..." value={searchClient} onChange={e => setSearchClient(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Subject</label>
                <input className="field-input" placeholder="Search subject..." value={searchProject} onChange={e => setSearchProject(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Date From</label>
                <input className="field-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="field-label">Date To</label>
                <input className="field-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              {hasFilters && (
                <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                  <label className="field-label">&nbsp;</label>
                  <button className="filter-clear-btn" onClick={clearFilters}>✕ Clear</button>
                </div>
              )}
            </div>

            {hasFilters && (
              <div className="filter-result-badge">
                Showing <strong>{filteredInvoices.length}</strong> of {invoices.length} invoices
              </div>
            )}

            {filteredInvoices.length === 0
              ? <div className="empty-state"><div className="empty-icon">📭</div><p>No invoices found.</p></div>
              : (
                <>
                  {selectedInvoiceObj && (() => {
                    const prods   = Array.isArray(selectedInvoiceObj.products) ? selectedInvoiceObj.products : [];
                    const { balance, advanceApplied } = getPaymentDisplay(selectedInvoiceObj);

                    return (
                      <div className="inv-detail-card" style={{ marginBottom: 20 }}>
                        <div className="inv-detail-header">
                          <div>
                            <span className="client-code-tag" style={{ background: '#fffbe8', color: '#7a5000', borderColor: '#ffe08a', marginRight: 10 }}>
                              {getInvNo(selectedInvoiceObj)}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 16 }}>{getSubject(selectedInvoiceObj)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {statusBadge(selectedInvoiceObj.paymentStatus)}
                            {advanceApplied > 0 && (
                              <span className="advance-tag">
                                💰 Adv − ₹{Number(advanceApplied).toLocaleString('en-IN')}
                              </span>
                            )}
                            <button className="inv-detail-close" onClick={() => setSelectedInvoiceId('')}>✕</button>
                          </div>
                        </div>

                        <div className="inv-detail-grid">
                          {renderDetailPaymentGrid(selectedInvoiceObj).map(([k, v]) => (
                            <div className="inv-detail-item" key={k}
                              style={
                                k === 'Balance Due' && balance > 0           ? { background: '#fff4f7', borderColor: '#ffc8d4' } :
                                k === 'Balance Due' && balance === 0         ? { background: '#e6fdf6', borderColor: '#a0f0d8' } :
                                k === 'Total GST'                            ? { background: '#fffbe8', borderColor: '#ffe08a' } :
                                k === 'Advance Applied'                      ? { background: '#e6fdf6', borderColor: '#a0f0d8' } : {}
                              }>
                              <span className="inv-detail-key">{k}</span>
                              <span className="inv-detail-val"
                                style={
                                  k === 'Balance Due' && balance > 0   ? { color: '#c93360' } :
                                  k === 'Balance Due' && balance === 0 ? { color: '#036b4e', fontWeight: 800 } :
                                  k === 'Total GST'                    ? { color: '#7a5000' } :
                                  k === 'Advance Applied'              ? { color: '#036b4e', fontWeight: 800 } :
                                  k === 'Paid Amount'                  ? { color: '#036b4e' } : {}
                                }>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>

                        {prods.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div className="cp-section-title">Work Items</div>
                            <div className="items-table-wrap" style={{ marginTop: 0 }}>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th>S.No</th><th>Description</th><th>Qty</th>
                                    <th>Rate (₹)</th><th>Amount (₹)</th><th>GST %</th>
                                    <th>GST Amt (₹)</th><th>Net Total (₹)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {prods.map((p, i) => (
                                    <tr key={p._id || i}>
                                      <td>{p.serialNo || i + 1}</td>
                                      <td>{p.description}</td>
                                      <td>{p.quantity}</td>
                                      <td>₹{Number(p.rate   || 0).toLocaleString('en-IN')}</td>
                                      <td>₹{Number(p.amount || 0).toLocaleString('en-IN')}</td>
                                      <td>{p.gstPercent > 0 ? p.gstPercent + '%' : '—'}</td>
                                      <td>{p.gstAmount  > 0 ? '₹' + Number(p.gstAmount).toLocaleString('en-IN') : '—'}</td>
                                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                        ₹{Number(p.netTotal || p.amount || 0).toLocaleString('en-IN')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {selectedInvoiceObj.notes && (
                          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', background: '#f8faff', borderRadius: 8, padding: '10px 14px', border: '1px solid #dde5f8' }}>
                            <strong>Notes:</strong> {selectedInvoiceObj.notes}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                          <button className="submit-btn invoice-print-btn" onClick={() => handlePrint(selectedInvoiceObj)}>
                            🖨️ Print Invoice
                          </button>
                          <button className="submit-btn"
                            style={{ background: 'linear-gradient(135deg,#f3e8ff,#e9d5ff)', color: '#7c3aed', boxShadow: 'none', border: '1.5px solid #ddd6fe' }}
                            onClick={() => toggleInvoiceReceipts(selectedInvoiceObj._id)}>
                            🧾 {expandedReceipts[selectedInvoiceObj._id] ? 'Hide Receipts' : 'View Receipts'}
                          </button>
                        </div>

                        {expandedReceipts[selectedInvoiceObj._id] && (
                          <div className="receipt-subrow-inner" style={{ marginTop: 16 }}>
                            {!invoiceReceipts[selectedInvoiceObj._id] || invoiceReceipts[selectedInvoiceObj._id].length === 0
                              ? <div className="receipt-subrow-empty">No receipts found for this invoice.</div>
                              : (() => {
                                  const rcpts = invoiceReceipts[selectedInvoiceObj._id];
                                  const totalRcptPaid = rcpts.reduce((s, r) => s + (Number(r.paidAmountInReceipt) || 0), 0);
                                  return (
                                    <>
                                      <div style={{ marginBottom: 8, fontSize: 13, color: '#555', fontWeight: 600 }}>
                                        Total paid via receipts: ₹{Number(totalRcptPaid).toLocaleString('en-IN')}
                                      </div>
                                      <table className="receipt-subtable">
                                        <thead>
                                          <tr>
                                            <th>Receipt No</th>
                                            <th>Amount Paid</th>
                                            <th>Payment Date</th>
                                            <th>PDF</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rcpts.map(r => (
                                            <tr key={r._id}>
                                              <td>
                                                <span className="client-code-tag" style={{ background: '#f3e8ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>
                                                  {r.receiptNumber}
                                                </span>
                                              </td>
                                              <td className="paid-cell">₹{Number(r.paidAmountInReceipt || 0).toLocaleString('en-IN')}</td>
                                              <td>{r.paymentDate?.split('T')[0]}</td>
                                              <td>
                                                {r.receiptPdf
                                                  ? <a href={r.receiptPdf} target="_blank" rel="noreferrer" className="inv-print-btn" style={{ textDecoration: 'none' }}>📄</a>
                                                  : '—'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </>
                                  );
                                })()
                            }
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="inv-card-list">
                    {filteredInvoices.map(inv => {
                      const isSel     = selectedInvoiceId === inv._id;
                      const prodCount = Array.isArray(inv.products) ? inv.products.length : 0;

                      return editingId === inv._id ? (
                        <div key={inv._id} className="inv-edit-card">
                          <div className="inv-edit-card-header">
                            <span className="client-code-tag" style={{ background: '#fffbe8', color: '#7a5000', borderColor: '#ffe08a' }}>
                              {getInvNo(inv)}
                            </span>
                            <div className="invoice-action-btns">
                              <button className="inv-save-btn" onClick={() => saveInlineEdit(inv._id)} disabled={loading}>💾</button>
                              <button className="inv-cancel-btn" onClick={() => setEditingId(null)}>✕</button>
                            </div>
                          </div>
                          <InvoiceUpdateHeaderFields
                            form={inlineForm}
                            onChange={(k, v) => setInlineForm(prev => ({ ...prev, [k]: v }))}
                            clients={clients}
                          />
                          <div className="items-section-label">Work Items</div>
                          <ItemsTable
                            items={inlineForm.items}
                            onChange={changeItems(setInlineForm)}
                            onAdd={addItem(setInlineForm)}
                            onRemove={removeItem(setInlineForm)}
                          />
                          {renderTotalsSummary(inlineForm)}
                        </div>
                      ) : (
                        <div key={inv._id}
                          className={`inv-row-card ${isSel ? 'inv-row-selected' : ''}`}
                          onClick={() => setSelectedInvoiceId(isSel ? '' : inv._id)}>
                          <div className="inv-row-left">
                            <span className="client-code-tag" style={{ background: '#fffbe8', color: '#7a5000', borderColor: '#ffe08a' }}>
                              {getInvNo(inv)}
                            </span>
                            <div className="inv-row-project">{getSubject(inv)}</div>
                            <div className="inv-row-client">{getClientLabel(inv)}</div>
                            {prodCount > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{prodCount} item{prodCount > 1 ? 's' : ''}</div>}
                          </div>
                          <div className="inv-row-mid">
                            <div className="inv-row-date">{inv.date?.split('T')[0]}</div>
                            {/* ✅ FIXED payment summary with advance deduction */}
                            {renderPaymentSummaryRow(inv)}
                          </div>
                          <div className="inv-row-right">
                            {statusBadge(inv.paymentStatus)}
                            <div className="invoice-action-btns" onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                              <button className="inv-edit-btn" title="Edit" onClick={() => startInlineEdit(inv)}>✏️</button>
                              <button className="inv-print-btn" title="Print" onClick={() => handlePrint(inv)}>🖨️</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
          </div>
        )}

      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default InvoicePage;