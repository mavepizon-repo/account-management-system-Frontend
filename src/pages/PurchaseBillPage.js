import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import * as XLSX from 'xlsx';
import logo from '../logo image/logo.jpeg';
import '../styles/EntityPage.css';
import '../styles/PurchaseBillPage.css';
import '../styles/SearchableDropdown.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

const emptyItem = () => ({
  id:          Date.now() + Math.random(),
  description: '',
  qty:         '1',
  rate:        '',
  gstPercent:  '0',
  amount:      '',
  gstAmount:   '',
  netTotal:    '',
});

const emptyBill = {
  vendor:      '',
  invoiceNo:   '',
  date:        new Date().toISOString().split('T')[0],
  invoiceDate: new Date().toISOString().split('T')[0],
  notes:       '',
  items:       [emptyItem()],
};

function calcItem(item, key, value) {
  const u         = { ...item, [key]: value };
  const qty       = parseFloat(u.qty)        || 0;
  const rate      = parseFloat(u.rate)       || 0;
  const gstPct    = parseFloat(u.gstPercent) || 0;
  const amount    = parseFloat((qty * rate).toFixed(2));
  const gstAmount = parseFloat(((amount * gstPct) / 100).toFixed(2));
  const netTotal  = parseFloat((amount + gstAmount).toFixed(2));
  return { ...u, amount: amount || '', gstAmount: amount ? gstAmount : '', netTotal: amount ? netTotal : '' };
}

function calcTotals(items) {
  const totalAmount = items.reduce((s, i) => s + (parseFloat(i.amount)    || 0), 0);
  const totalGST    = items.reduce((s, i) => s + (parseFloat(i.gstAmount) || 0), 0);
  const grandTotal  = items.reduce((s, i) => s + (parseFloat(i.netTotal)  || 0), 0);
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
  }));
}

// ── Items Table ───────────────────────────────────────────
function ItemsTable({ items, onChange, onAdd, onRemove }) {
  const handleCell = (idx, key, value) => {
    const updated = items.map((item, i) => i === idx ? calcItem(item, key, value) : item);
    onChange(updated);
  };
  return (
    <div className="items-table-wrap">
      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>S.No</th>
            <th>Description</th>
            <th style={{ width: 75 }}>Qty</th>
            <th style={{ width: 115 }}>Rate (₹)</th>
            <th style={{ width: 75 }}>GST %</th>
            <th style={{ width: 115 }}>Amount (₹)</th>
            <th style={{ width: 100 }}>GST Amt (₹)</th>
            <th style={{ width: 130 }}>Net Total (₹)</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="item-row">
              <td className="sno-cell">{idx + 1}</td>
              <td>
                <input className="item-input item-desc" placeholder="Item description"
                  value={item.description}
                  onChange={e => handleCell(idx, 'description', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-num" type="number" placeholder="0"
                  value={item.qty}
                  onChange={e => handleCell(idx, 'qty', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-num" type="number" placeholder="0.00"
                  value={item.rate}
                  onChange={e => handleCell(idx, 'rate', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-num" type="number" placeholder="0"
                  value={item.gstPercent}
                  onChange={e => handleCell(idx, 'gstPercent', e.target.value)} />
              </td>
              <td>
                <input className="item-input item-calc" readOnly
                  value={item.amount !== '' ? Number(item.amount).toLocaleString('en-IN') : ''} />
              </td>
              <td>
                <input className="item-input item-calc" readOnly
                  value={item.gstAmount !== '' ? Number(item.gstAmount).toLocaleString('en-IN') : ''} />
              </td>
              <td>
                <input className="item-input item-calc" readOnly
                  style={{ color: '#036b4e', fontWeight: 800 }}
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
      </table>
      <button className="add-item-btn" type="button" onClick={onAdd}>
        <span className="add-item-plus">+</span> Add Item
      </button>
    </div>
  );
}

function TotalsSummary({ items }) {
  const { totalAmount, totalGST, grandTotal } = calcTotals(items);
  if (totalAmount <= 0) return null;
  return (
    <div className="bill-totals-summary">
      <div className="bill-total-row">
        <span>Sub Total (before GST)</span>
        <strong>₹{Number(totalAmount).toLocaleString('en-IN')}</strong>
      </div>
      <div className="bill-total-row">
        <span>Total GST</span>
        <strong>₹{Number(totalGST).toLocaleString('en-IN')}</strong>
      </div>
      <div className="bill-total-row bill-grand-row">
        <span>Grand Total</span>
        <strong>₹{Number(grandTotal).toLocaleString('en-IN')}</strong>
      </div>
    </div>
  );
}

function BillHeaderFields({ form, setForm, vendorOpts }) {
  return (
    <div className="form-row bill-form-grid">
      <div className="form-field">
        <label className="field-label">Vendor *</label>
        <SearchableDropdown
          options={vendorOpts}
          value={form.vendor}
          onChange={val => setForm(prev => ({ ...prev, vendor: val }))}
          placeholder="Search and select vendor..."
        />
      </div>
      <div className="form-field">
        <label className="field-label">Subject / Invoice No *</label>
        <input className="field-input" placeholder="e.g. INV-001 or subject"
          value={form.invoiceNo}
          onChange={e => setForm(prev => ({ ...prev, invoiceNo: e.target.value }))} />
      </div>
      <div className="form-field">
        <label className="field-label">Purchase Date *</label>
        <input className="field-input" type="date" value={form.date}
          onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
      </div>
      <div className="form-field">
        <label className="field-label">Invoice Date *</label>
        <input className="field-input" type="date" value={form.invoiceDate}
          onChange={e => setForm(prev => ({ ...prev, invoiceDate: e.target.value }))} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Notes</label>
        <input className="field-input" placeholder="Additional notes"
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
      </div>
    </div>
  );
}

// ── Advance Preview Panel (same as InvoicePage but for vendors/vouchers) ──
function AdvancePreviewPanel({ vendorId, grandTotal, advanceVouchers }) {
  if (!vendorId || advanceVouchers.length === 0) return null;

  let billRemaining  = grandTotal;
  let totalWillApply = 0;
  const breakdown    = [];

  for (const v of advanceVouchers) {
    if (billRemaining <= 0) break;
    const apply = Math.min(v.remainingAmount, billRemaining);
    billRemaining  -= apply;
    totalWillApply += apply;
    breakdown.push({
      voucherNumber:    v.voucherNumber || v.sno || '—',
      date:             v.date || v.createdAt,
      currentRemaining: v.remainingAmount,
      willApply:        apply,
      afterApply:       v.remainingAmount - apply,
    });
  }

  const totalAvailable        = advanceVouchers.reduce((s, v) => s + v.remainingAmount, 0);
  const advanceAfterBill      = totalAvailable - totalWillApply;
  const billBalanceAfter      = Math.max(0, grandTotal - totalWillApply);

  return (
    <div style={{
      marginBottom: 20,
      borderRadius: 12,
      border: '1.5px solid #c4b5fd',
      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: '#7c3aed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            Vendor Advance Available — Auto-Apply Preview
          </span>
        </div>
        <span style={{
          background: 'rgba(255,255,255,0.2)', color: '#fff',
          borderRadius: 20, padding: '2px 12px', fontSize: 13, fontWeight: 700,
        }}>
          ₹{Number(totalAvailable).toLocaleString('en-IN')} Total Advance
        </span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Voucher breakdown table */}
        {breakdown.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Vouchers that will be used (oldest first):
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 13,
                background: '#fff', borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              }}>
                <thead>
                  <tr style={{ background: '#faf5ff' }}>
                    {['Voucher No', 'Date', 'Current Balance', 'Will Apply', 'Remaining After'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px',
                        textAlign: h === 'Voucher No' || h === 'Date' ? 'left' : 'right',
                        fontWeight: 700, color: '#7c3aed', fontSize: 11,
                        borderBottom: '1px solid #ddd6fe',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          background: '#f3e8ff', color: '#7c3aed', borderRadius: 6,
                          padding: '2px 8px', fontWeight: 700, fontSize: 12,
                          border: '1px solid #ddd6fe',
                        }}>
                          {row.voucherNumber}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#555', fontSize: 12 }}>
                        {row.date ? new Date(row.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#333' }}>
                        ₹{Number(row.currentRemaining).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>
                        − ₹{Number(row.willApply).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: row.afterApply === 0 ? '#aaa' : '#7a5000' }}>
                        {row.afterApply === 0
                          ? <span style={{ fontSize: 11, color: '#aaa' }}>Exhausted</span>
                          : `₹${Number(row.afterApply).toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #ddd6fe' }}>
          {grandTotal > 0 ? (
            <>
              <div style={{ flex: 1, minWidth: 150, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #ddd6fe' }}>
                <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>Bill Total</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>₹{Number(grandTotal).toLocaleString('en-IN')}</div>
              </div>
              <div style={{ flex: 1, minWidth: 150, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #ddd6fe' }}>
                <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>Advance Will Apply</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>₹{Number(totalWillApply).toLocaleString('en-IN')}</div>
              </div>
              <div style={{
                flex: 1, minWidth: 150, borderRadius: 10, padding: '10px 14px',
                background: billBalanceAfter > 0 ? '#fff4f7' : '#e6fdf6',
                border: `1px solid ${billBalanceAfter > 0 ? '#ffc8d4' : '#a0f0d8'}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: billBalanceAfter > 0 ? '#c93360' : '#036b4e' }}>
                  {billBalanceAfter > 0 ? 'Balance After Creation' : 'Status After Creation'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: billBalanceAfter > 0 ? '#c93360' : '#036b4e' }}>
                  {billBalanceAfter > 0
                    ? `₹${Number(billBalanceAfter).toLocaleString('en-IN')}`
                    : '✓ Fully Paid'}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 150, background: '#fffbe8', borderRadius: 10, padding: '10px 14px', border: '1px solid #ffe08a' }}>
                <div style={{ fontSize: 11, color: '#7a5000', fontWeight: 700, marginBottom: 4 }}>Advance Remaining After</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7a5000' }}>₹{Number(advanceAfterBill).toLocaleString('en-IN')}</div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic' }}>
              Enter purchase items above to see advance application preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
function PurchaseBillPage({ onLogout }) {
  const navigate = useNavigate();

  const [vendors,     setVendors]     = useState([]);
  const [bills,       setBills]       = useState([]);
  const [activePanel, setPanel]       = useState(null);
  const [toast,       setToast]       = useState(null);
  const [loading,     setLoading]     = useState(false);

  // Voucher advance map: { vendorId: [{ voucherNumber, remainingAmount, date, ... }] }
  const [vendorAdvanceMap, setVendorAdvanceMap] = useState({});

  const [addForm,      setAddForm]      = useState(emptyBill);
  const [updateBillId, setUpdateBillId] = useState('');
  const [updateFound,  setUpdateFound]  = useState(null);
  const [updateForm,   setUpdateForm]   = useState(emptyBill);
  const [deleteBillId, setDeleteBillId] = useState('');
  const [deleteFound,  setDeleteFound]  = useState(null);

  const [selectedBillId, setSelectedBillId] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [vendorFilter,   setVendorFilter]   = useState('');
  const [searchText,     setSearchText]     = useState('');

  const [lastCreateInfo, setLastCreateInfo] = useState(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch vendors ─────────────────────────────────────
  const fetchVendors = async () => {
    try {
      const res  = await fetch(`${API}/vendor/getall`);
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : (data.data || []));
    } catch { showToast('Failed to fetch vendors', 'error'); }
  };

  // ── Fetch bills ───────────────────────────────────────
  const fetchBills = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/purchase/all`);
      const data = await res.json();
      setBills(Array.isArray(data) ? data : (data.data || []));
    } catch { showToast('Failed to fetch bills', 'error'); }
    finally { setLoading(false); }
  };

  // ── Fetch vendor advance vouchers ─────────────────────
  // Vouchers with remainingAmount > 0 and not fully consumed
  const fetchVendorAdvances = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/voucher/getall`);
      const data = await res.json();
      const vouchers = Array.isArray(data) ? data : (data.data || data.vouchers || []);

      // Build map: vendorId → sorted vouchers with remaining balance
      const map = {};
      vouchers.forEach(v => {
        const rem = Number(v.remainingAmount ?? 0);
        if (rem <= 0) return; // skip exhausted vouchers

        const vid = v.vendor?._id || (typeof v.vendor === 'string' ? v.vendor : null);
        if (!vid) return;

        if (!map[vid]) map[vid] = [];
        map[vid].push({
          _id:             v._id,
          voucherNumber:   v.voucherNumber || v.sno || '—',
          date:            v.date || v.createdAt,
          remainingAmount: rem,
          totalAmount:     v.totalAmount || v.amount || rem,
        });
      });

      // Sort each vendor's vouchers oldest first (FIFO — same as backend)
      Object.keys(map).forEach(vid => {
        map[vid].sort((a, b) => new Date(a.date) - new Date(b.date));
      });

      setVendorAdvanceMap(map);
    } catch {
      // Silently fail — advance preview just won't show
    }
  }, []);

  useEffect(() => { fetchVendors(); fetchBills(); fetchVendorAdvances(); }, [fetchVendorAdvances]);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyBill);
    setUpdateBillId(''); setUpdateForm(emptyBill); setUpdateFound(null);
    setDeleteBillId(''); setDeleteFound(null);
    setSelectedBillId('');
    setStatusFilter('All'); setVendorFilter(''); setSearchText('');
    setLastCreateInfo(null);
    fetchVendorAdvances();
  };

  // ── Helpers ───────────────────────────────────────────
  const getVendorLabel = (bill) => {
    if (bill.vendor?.name) return `${bill.vendor.vendorCode || ''} — ${bill.vendor.name}`;
    const found = vendors.find(v => v._id === (bill.vendor?._id || bill.vendor));
    return found ? `${found.vendorCode || ''} — ${found.name}` : '—';
  };

  const getFullVendor = (bill) => {
    const vendorId = bill.vendor?._id || (typeof bill.vendor === 'string' ? bill.vendor : null);
    if (!vendorId) return bill.vendor || {};
    return vendors.find(v => v._id === vendorId) || bill.vendor || {};
  };

  const getGst = (vendor) => vendor?.gstNo || vendor?.gstNumber || '';

  const statusBadge = (status) => {
    const s = status || 'Unpaid';
    const map = { 'Paid': 'status-paid', 'Partial': 'status-partial', 'Unpaid': 'status-pending' };
    return <span className={`status-badge ${map[s] || 'status-pending'}`}>{s}</span>;
  };

  const changeItems = setter => updated => setter(prev => ({ ...prev, items: updated }));
  const addItemRow  = setter => ()      => setter(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const removeItem  = setter => idx     => setter(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  function buildPayload(form) {
    return {
      vendor:      form.vendor,
      date:        form.date        || new Date().toISOString(),
      invoiceDate: form.invoiceDate || new Date().toISOString(),
      subject:     form.invoiceNo,
      notes:       form.notes || '',
      products:    buildProducts(form.items),
    };
  }

  function billToForm(b) {
    const prods = Array.isArray(b.products) ? b.products : [];
    const items = prods.length > 0
      ? prods.map(p => {
          const qty       = p.quantity   ?? 1;
          const rate      = p.rate       ?? 0;
          const gstPct    = p.gstPercent ?? 0;
          const amount    = parseFloat((qty * rate).toFixed(2));
          const gstAmount = parseFloat(((amount * gstPct) / 100).toFixed(2));
          const netTotal  = parseFloat((amount + gstAmount).toFixed(2));
          return {
            id:          Date.now() + Math.random(),
            description: p.description || '',
            qty:         String(qty),
            rate:        String(rate),
            gstPercent:  String(gstPct),
            amount:      amount || '',
            gstAmount:   amount ? gstAmount : '',
            netTotal:    amount ? netTotal  : '',
          };
        })
      : [emptyItem()];
    return {
      vendor:      b.vendor?._id || (typeof b.vendor === 'string' ? b.vendor : '') || '',
      invoiceNo:   b.subject     || '',
      date:        b.date        ? b.date.split('T')[0]        : new Date().toISOString().split('T')[0],
      invoiceDate: b.invoiceDate ? b.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0],
      notes:       b.notes       || '',
      items,
    };
  }

  // ── Dropdown options ──────────────────────────────────
  const vendorOptions = vendors.map(v => ({
    value: v._id,
    label: `${v.vendorCode || ''} — ${v.name}${v.phone ? ` (${v.phone})` : ''}`,
  }));

  const billOptions = bills.map(b => ({
    value: b._id,
    label: `${b.sno} — ${getVendorLabel(b)} — ${b.subject || '—'} — ${(b.paymentStatus || 'Unpaid').toUpperCase()} — ₹${Number(b.grandTotal || 0).toLocaleString('en-IN')}`,
  }));

  const vendorFilterOptions = [
    { value: '', label: 'All Vendors' },
    ...vendors.map(v => ({ value: v._id, label: `${v.vendorCode || ''} — ${v.name}` })),
  ];

  // ── Filtered bills ────────────────────────────────────
  const filteredBills = useMemo(() => {
    let list = bills;
    if (statusFilter !== 'All')
      list = list.filter(b => (b.paymentStatus || 'Unpaid') === statusFilter);
    if (vendorFilter)
      list = list.filter(b => (b.vendor?._id || b.vendor) === vendorFilter);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(b =>
        (b.sno     || '').toLowerCase().includes(q) ||
        (b.subject || '').toLowerCase().includes(q) ||
        (b.notes   || '').toLowerCase().includes(q) ||
        getVendorLabel(b).toLowerCase().includes(q)
      );
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, statusFilter, vendorFilter, searchText]);

  const countAll     = bills.length;
  const countPaid    = bills.filter(b => b.paymentStatus === 'Paid').length;
  const countPartial = bills.filter(b => b.paymentStatus === 'Partial').length;
  const countUnpaid  = bills.filter(b => !b.paymentStatus || b.paymentStatus === 'Unpaid').length;

  // ── Derived: selected vendor's advance vouchers ───────
  const selectedVendorAdvances     = addForm.vendor ? (vendorAdvanceMap[addForm.vendor] || []) : [];
  const selectedVendorAdvanceTotal = selectedVendorAdvances.reduce((s, v) => s + v.remainingAmount, 0);
  const addFormTotals              = calcTotals(addForm.items);

  // ✅ NEW: Helper to calculate advance applied for display
  const getAdvanceApplied = (bill) => {
    const grandTotal = Number(bill.grandTotal || 0);
    const paid       = Number(bill.cumulativePaidAmount || 0);
    // Advance = paid amount (assuming backend auto-applied advance during creation)
    return Math.min(paid, grandTotal);
  };

  // ── Excel Download ────────────────────────────────────
  const downloadExcel = (billsToExport, filename = 'Purchase_Bills') => {
    if (billsToExport.length === 0) { showToast('No bills to export', 'error'); return; }

    const mainData = billsToExport.map((b, idx) => {
      const paid         = b.cumulativePaidAmount || 0;
      const balance      = (b.grandTotal || 0) - paid;
      const advApplied   = getAdvanceApplied(b);
      return {
        'S.No':            idx + 1,
        'Purchase SNO':    b.sno     || '—',
        'Subject':         b.subject || '—',
        'Vendor Code':     b.vendor?.vendorCode || '—',
        'Vendor Name':     b.vendor?.name       || '—',
        'Date':            b.date        ? new Date(b.date).toLocaleDateString('en-IN')        : '—',
        'Invoice Date':    b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString('en-IN') : '—',
        'Notes':           b.notes || '—',
        'Sub Total (₹)':   Number(b.totalAmount || 0).toFixed(2),
        'Total GST (₹)':   Number(b.totalGST    || 0).toFixed(2),
        'Grand Total (₹)': Number(b.grandTotal   || 0).toFixed(2),
        'Advance Applied (₹)': Number(advApplied).toFixed(2),
        'Paid Amount (₹)': Number(paid).toFixed(2),
        'Balance (₹)':     Number(balance).toFixed(2),
        'Status':          (b.paymentStatus || 'Unpaid').toUpperCase(),
        'Created Date':    b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : '—',
      };
    });

    const productsData = [];
    billsToExport.forEach(b => {
      if (Array.isArray(b.products) && b.products.length > 0) {
        b.products.forEach(p => {
          productsData.push({
            'Purchase SNO':  b.sno     || '—',
            'Subject':       b.subject || '—',
            'Vendor':        b.vendor?.name || '—',
            'Serial No':     p.serialNo    || '—',
            'Description':   p.description || '—',
            'Quantity':      p.quantity    || 0,
            'Rate (₹)':      Number(p.rate       || 0).toFixed(2),
            'GST %':         p.gstPercent  || 0,
            'Amount (₹)':    Number(p.amount      || 0).toFixed(2),
            'GST Amt (₹)':   Number(p.gstAmount   || 0).toFixed(2),
            'Net Total (₹)': Number(p.netTotal    || 0).toFixed(2),
          });
        });
      }
    });

    const wb  = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Purchase Bills');
    if (productsData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(productsData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Products Details');
    }

    const totalGrand = billsToExport.reduce((s, b) => s + (b.grandTotal            || 0), 0);
    const totalPaid  = billsToExport.reduce((s, b) => s + (b.cumulativePaidAmount  || 0), 0);
    const summaryData = [
      { 'Description': 'Total Bills',            'Value': billsToExport.length },
      { 'Description': 'Paid Bills',             'Value': billsToExport.filter(b => b.paymentStatus === 'Paid').length },
      { 'Description': 'Partial Paid Bills',     'Value': billsToExport.filter(b => b.paymentStatus === 'Partial').length },
      { 'Description': 'Unpaid Bills',           'Value': billsToExport.filter(b => !b.paymentStatus || b.paymentStatus === 'Unpaid').length },
      { 'Description': '', 'Value': '' },
      { 'Description': 'Total Grand Amount (₹)', 'Value': Number(totalGrand).toFixed(2) },
      { 'Description': 'Total Paid Amount (₹)',  'Value': Number(totalPaid).toFixed(2) },
      { 'Description': 'Total Due Amount (₹)',   'Value': Number(totalGrand - totalPaid).toFixed(2) },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
    showToast(`Excel downloaded: ${billsToExport.length} bill(s)`, 'success');
  };

  // ── PRINT ─────────────────────────────────────────────
  const handlePrint = (bill) => {
    const vendorObj  = getFullVendor(bill);
    const vendorCode = vendorObj.vendorCode || '';
    const vendorName = vendorObj.name       || '';
    const vendorAddr = vendorObj.address    || '';
    const vendorGST  = getGst(vendorObj);

    const sno   = bill.sno || 'PUR—';
    const prods = Array.isArray(bill.products) ? bill.products : [];

    const formatDate = (raw) => {
      if (!raw) return '';
      const d = new Date(raw);
      if (isNaN(d)) return raw;
      const day = d.getDate();
      const sfx = [11,12,13].includes(day) ? 'th'
                : day%10===1 ? 'st' : day%10===2 ? 'nd' : day%10===3 ? 'rd' : 'th';
      const mo  = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
      return `${day}${sfx} ${mo[d.getMonth()]} ${d.getFullYear()}`;
    };

    const fmt = v => Number(v || 0).toLocaleString('en-IN');

    const itemRows = prods.map((p, i) => {
      const qty    = Number(p.quantity   || 0);
      const rate   = Number(p.rate       || 0);
      const gstPct = Number(p.gstPercent || 0);
      const amount = Number(p.amount    ?? parseFloat((qty * rate).toFixed(2)));
      const gstAmt = Number(p.gstAmount ?? parseFloat(((amount * gstPct) / 100).toFixed(2)));
      const total  = Number(p.netTotal  ?? parseFloat((amount + gstAmt).toFixed(2)));
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

    const grandTotal = Number(bill.grandTotal  || 0);
    const totalGST   = Number(bill.totalGST    || 0);
    const totalAmt   = Number(bill.totalAmount  || 0);
    const paidAmt    = Number(bill.cumulativePaidAmount || 0);
    const balance    = Math.max(0, grandTotal - paidAmt);

    // ✅ NEW: Display advance applied
    const advanceApplied = getAdvanceApplied(bill);

    const w = window.open('', '_blank', 'width=1050,height=780');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Purchase Bill ${sno}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800;900&family=Open+Sans:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Open Sans',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;}
  .hdr{background:#1c1c1c;display:flex;justify-content:space-between;align-items:center;padding:18px 32px;gap:24px;}
  .logo-icon{width:50px;height:44px;margin-right:10px;flex-shrink:0;}
  .hdr-div{width:1px;height:50px;background:rgba(255,255,255,0.22);margin:0 24px;flex-shrink:0;}
  .hdr-addr{font-size:10.5px;line-height:1.85;color:#ffffff;}
  .hdr-inv-title{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:900;letter-spacing:4px;color:#ffffff;text-align:right;white-space:nowrap;flex-shrink:0;}
  .body{padding:26px 32px 0;}
  .meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;}
  .cid-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .cid-lbl{font-size:12px;font-weight:700;color:#333;}
  .cid-box{border:1px solid #bbb;border-radius:4px;padding:5px 12px;font-size:12px;font-weight:700;min-width:155px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
  .v-name{font-size:13.5px;font-weight:700;color:#111;margin-bottom:3px;}
  .v-addr{font-size:11.5px;color:#444;line-height:1.7;max-width:295px;}
  .v-gst{font-size:11.5px;color:#222;font-weight:700;margin-top:5px;}
  .date-col{text-align:right;}
  .date-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:8px;}
  .date-lbl{font-size:12px;font-weight:700;}
  .date-box{border:1px solid #bbb;border-radius:4px;padding:5px 14px;font-size:12px;font-weight:700;min-width:160px;text-align:center;}
  .inv-no-row{font-size:12px;color:#333;margin-top:4px;}
  .subj-row{margin-bottom:6px;font-size:13px;font-weight:600;}
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
  .row-adv td{background:#f3e8ff;}
  .row-adv .tot-lbl{color:#7c3aed;}
  .row-adv .tot-val{color:#7c3aed;}
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
    <div class="hdr-inv-title">PURCHASE BILL</div>
  </div>
  <div class="body">
    <div class="meta">
      <div class="vendor-col">
        <div class="cid-row">
          <span class="cid-lbl">Vendor ID :</span>
          <div class="cid-box"><span>${vendorCode || 'N/A'}</span><span class="cid-arr">&#9660;</span></div>
        </div>
        ${vendorName ? `<div class="v-name">${vendorName}</div>` : ''}
        ${vendorAddr ? `<div class="v-addr">${vendorAddr.replace(/\n/g, '<br/>')}</div>` : ''}
        ${vendorGST  ? `<div class="v-gst">GST No. &nbsp;${vendorGST}</div>` : ''}
      </div>
      <div class="date-col">
        <div class="date-row">
          <span class="date-lbl">Purchase Date :</span>
          <div class="date-box">${formatDate(bill.date)}</div>
        </div>
        <div class="date-row" style="margin-top:8px;">
          <span class="date-lbl">Invoice Date :</span>
          <div class="date-box">${formatDate(bill.invoiceDate)}</div>
        </div>
        <div class="inv-no-row" style="margin-top:8px;"><strong>Purchase No :</strong>&nbsp;${sno}</div>
      </div>
    </div>
    ${bill.subject ? `<div class="subj-row"><strong>Subject :</strong>&nbsp;<span>${bill.subject}</span></div>` : ''}
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
        ${advanceApplied > 0 ? `<tr class="row-adv"><td class="tot-lbl">Advance Applied</td><td class="tot-val">&#8377;${fmt(advanceApplied)}</td></tr>` : ''}
        ${balance > 0 ? `<tr class="row-bal"><td class="tot-lbl">Balance Due</td><td class="tot-val">&#8377;${fmt(balance)}</td></tr>` : ''}
      </table>
    </div>
    ${bill.notes ? `<div class="notes"><strong>Notes :</strong>&nbsp;${bill.notes}</div>` : ''}
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

  // ── ADD ───────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.vendor || !addForm.invoiceNo) {
      showToast('Vendor and Subject/Invoice No are required', 'error'); return;
    }
    if (!addForm.date || !addForm.invoiceDate) {
      showToast('Date and Invoice Date are required', 'error'); return;
    }
    if (addForm.items.some(it => !it.description)) {
      showToast('Each item needs a description', 'error'); return;
    }
    if (addForm.items.some(it => !it.rate || parseFloat(it.rate) <= 0)) {
      showToast('Each item needs a valid rate', 'error'); return;
    }
    try {
      setLoading(true);
      setLastCreateInfo(null);
      const res  = await fetch(`${API}/purchase/add`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload(addForm)),
      });
      const data = await res.json();
      if (res.ok) {
        const saved = data.data;
        const paid  = saved?.cumulativePaidAmount || 0;

        if (paid > 0) {
          setLastCreateInfo({
            sno:                  saved.sno,
            grandTotal:           saved.grandTotal,
            cumulativePaidAmount: paid,
            remainingBalance:     Math.max(0, saved.grandTotal - paid),
            paymentStatus:        saved.paymentStatus,
          });
          showToast(`✅ Purchase ${saved.sno} added! ₹${paid.toLocaleString('en-IN')} advance auto-applied.`);
        } else {
          showToast(`✅ Purchase ${saved?.sno || ''} added!`);
        }

        await fetchBills();
        await fetchVendorAdvances(); // refresh advance map after creation
        setAddForm(emptyBill);
      } else {
        showToast(data.message || data.error || 'Failed to add bill', 'error');
      }
    } catch { showToast('Error adding bill', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ────────────────────────────────────────────
  const handleUpdateSelect = (billId) => {
    setUpdateBillId(billId);
    const found = bills.find(b => b._id === billId);
    if (found) { setUpdateFound(found); setUpdateForm(billToForm(found)); }
    else       { setUpdateFound(null);  setUpdateForm(emptyBill); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a bill', 'error'); return; }

    const newTotals   = calcTotals(updateForm.items);
    const alreadyPaid = updateFound.cumulativePaidAmount || 0;
    if (alreadyPaid > 0 && newTotals.grandTotal < alreadyPaid) {
      showToast(
        `Cannot reduce Grand Total to ₹${newTotals.grandTotal.toLocaleString('en-IN')} — already paid ₹${alreadyPaid.toLocaleString('en-IN')}.`,
        'error'
      );
      return;
    }

    try {
      setLoading(true);
      const [res1, res2] = await Promise.all([
        fetch(`${API}/purchase/update/${updateFound._id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date:        updateForm.date,
            invoiceDate: updateForm.invoiceDate,
            subject:     updateForm.invoiceNo,
            notes:       updateForm.notes || '',
          }),
        }),
        fetch(`${API}/purchase/update-products/${updateFound._id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: buildProducts(updateForm.items) }),
        }),
      ]);
      const d2 = await res2.json();
      if (res1.ok && res2.ok) {
        await fetchBills();
        showToast(`📝 Purchase ${updateFound.sno} updated!`);
        setUpdateFound(null); setUpdateBillId(''); setUpdateForm(emptyBill);
      } else {
        showToast(d2.message || 'Failed to update bill', 'error');
      }
    } catch { showToast('Error updating bill', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ────────────────────────────────────────────
  const handleDeleteSelect = (billId) => {
    setDeleteBillId(billId);
    setDeleteFound(bills.find(b => b._id === billId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a bill', 'error'); return; }
    if ((deleteFound.cumulativePaidAmount || 0) > 0) {
      showToast(
        `Cannot delete — ₹${deleteFound.cumulativePaidAmount.toLocaleString('en-IN')} already paid on this bill.`,
        'error'
      );
      return;
    }
    try {
      setLoading(true);
      const res  = await fetch(`${API}/purchase/delete/${deleteFound._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        await fetchBills();
        showToast(`🗑️ Purchase ${deleteFound.sno} deleted!`, 'info');
        setDeleteFound(null); setDeleteBillId('');
      } else {
        showToast(data.message || data.error || 'Failed to delete bill', 'error');
      }
    } catch { showToast('Error deleting bill', 'error'); }
    finally { setLoading(false); }
  };

  const selectedBillObj = bills.find(b => b._id === selectedBillId);

  // ── RENDER ────────────────────────────────────────────
  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">🧾 Purchase Bill Management</h1>
          <span className="entity-page-badge" style={{ background: '#f0f4ff', color: '#5b7fff', border: '1px solid #c8d4ff' }}>
            {bills.length} Bills
          </span>
        </div>

        <div className="action-cards-grid">
  <div
    className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.ADD)}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Add Purchase Bill</div>
    <div className="action-card-desc">Create a new purchase bill</div>
  </div>

  <div
    className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.UPDATE)}
  >
    <div className="action-card-icon">✏️</div>
    <div className="action-card-title">Update Purchase Bill</div>
    <div className="action-card-desc">Edit existing bill details</div>
  </div>

  <div
    className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.GETALL)}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">All Purchase Bills</div>
    <div className="action-card-desc">View all purchase bills</div>
  </div>

   <div
    className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.DELETE)}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Purchase Bill</div>
    <div className="action-card-desc">Remove a purchase bill record</div>
  </div>
</div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ════ ADD ════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Add New Purchase Bill</div>

            {/* Advance auto-apply result banner */}
            {lastCreateInfo && (
              <div className="autofill-banner full-width" style={{ background: '#f3e8ff', borderColor: '#ddd6fe', marginBottom: 16 }}>
                <span className="autofill-icon">💰</span>
                <div>
                  <div>
                    Purchase <strong>{lastCreateInfo.sno}</strong> created.
                    Advance of <strong>₹{Number(lastCreateInfo.cumulativePaidAmount).toLocaleString('en-IN')}</strong> was
                    automatically applied. Status: <strong>{lastCreateInfo.paymentStatus}</strong>.
                  </div>
                  {lastCreateInfo.remainingBalance > 0 ? (
                    <div style={{ marginTop: 6, fontWeight: 700, color: '#c93360' }}>
                      Remaining balance: ₹{Number(lastCreateInfo.remainingBalance).toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontWeight: 700, color: '#036b4e' }}>
                      ✓ Bill fully covered by advance!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info banner */}
            <div className="autofill-banner full-width" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 16 }}>
              <span className="autofill-icon">💡</span>
              <span style={{ color: '#1e40af', fontSize: 13 }}>
                If this vendor has any <strong>advance vouchers</strong> with remaining balance,
                the system will automatically deduct them from this bill upon creation.
              </span>
            </div>

            <form onSubmit={handleAdd}>
              <BillHeaderFields form={addForm} setForm={setAddForm} vendorOpts={vendorOptions} />

              {/* ✅ Advance preview — shows when vendor is selected and has advance */}
              {selectedVendorAdvanceTotal > 0 && (
                <AdvancePreviewPanel
                  vendorId={addForm.vendor}
                  grandTotal={addFormTotals.grandTotal}
                  advanceVouchers={selectedVendorAdvances}
                />
              )}

              {/* Show "no advance" message when vendor selected but has no advance */}
              {addForm.vendor && selectedVendorAdvanceTotal === 0 && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px',
                  background: '#f8faff', borderRadius: 8,
                  border: '1px solid #dde5f8', fontSize: 13, color: '#888',
                }}>
                  ℹ️ This vendor has no pending advance vouchers.
                </div>
              )}

              <div className="items-section-label">Purchase Items (GST per item)</div>
              <ItemsTable
                items={addForm.items}
                onChange={changeItems(setAddForm)}
                onAdd={addItemRow(setAddForm)}
                onRemove={removeItem(setAddForm)}
              />
              <TotalsSummary items={addForm.items} />

              <div className="vendor-id-preview" style={{ marginTop: 12 }}>
                🪪 Auto SNO: <strong>PUR**** (auto-generated)</strong>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? '⏳ Adding...' : '➕ Add Bill'}
                </button>
                {addFormTotals.grandTotal > 0 && (
                  <button type="button" className="submit-btn invoice-print-btn"
                    onClick={() => {
                      const totals = calcTotals(addForm.items);
                      handlePrint({
                        sno:                  'PREVIEW',
                        vendor:               vendors.find(v => v._id === addForm.vendor),
                        date:                 addForm.date,
                        invoiceDate:          addForm.invoiceDate,
                        subject:              addForm.invoiceNo,
                        notes:                addForm.notes,
                        products:             addForm.items.map((it, i) => ({
                          serialNo:    i + 1,
                          description: it.description,
                          quantity:    parseFloat(it.qty)        || 0,
                          rate:        parseFloat(it.rate)       || 0,
                          gstPercent:  parseFloat(it.gstPercent) || 0,
                          amount:      parseFloat(it.amount)     || 0,
                          gstAmount:   parseFloat(it.gstAmount)  || 0,
                          netTotal:    parseFloat(it.netTotal)   || 0,
                        })),
                        totalAmount:          totals.totalAmount,
                        totalGST:             totals.totalGST,
                        grandTotal:           totals.grandTotal,
                        cumulativePaidAmount: 0,
                      });
                    }}>
                    🖨️ Print Preview
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ════ UPDATE ════ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">✏️ Update Purchase Bill</div>
            <div className="autofill-banner full-width" style={{ background: '#fff7ed', borderColor: '#fed7aa', marginBottom: 16 }}>
              <span className="autofill-icon">⚠️</span>
              <span style={{ color: '#92400e', fontSize: 13 }}>
                Vendor cannot be changed after creation.
                Updates apply to <strong>date, subject, notes</strong> and <strong>products</strong> only.<br/>
                <strong>Note:</strong> New Grand Total cannot be less than already paid amount.
              </span>
            </div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Purchase Bill *</label>
              <SearchableDropdown
                options={billOptions}
                value={updateBillId}
                onChange={handleUpdateSelect}
                placeholder="Search purchase bill by SNO, vendor or subject..."
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.sno}</span>
                  <span className="update-found-name">{getVendorLabel(updateFound)}</span>
                  {(updateFound.cumulativePaidAmount || 0) > 0 && (
                    <span style={{ fontSize: 12, background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 6, marginLeft: 8, fontWeight: 700, border: '1px solid #ddd6fe' }}>
                      💰 Adv − ₹{updateFound.cumulativePaidAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <form onSubmit={handleUpdate}>
                  <BillHeaderFields form={updateForm} setForm={setUpdateForm} vendorOpts={vendorOptions} />
                  <div className="items-section-label">Purchase Items (GST per item)</div>
                  <ItemsTable
                    items={updateForm.items}
                    onChange={changeItems(setUpdateForm)}
                    onAdd={addItemRow(setUpdateForm)}
                    onRemove={removeItem(setUpdateForm)}
                  />
                  <TotalsSummary items={updateForm.items} />
                  <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                    <button type="submit" className="submit-btn" disabled={loading}
                      style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                      {loading ? '⏳ Updating...' : '✏️ Update Bill'}
                    </button>
                    {calcTotals(updateForm.items).grandTotal > 0 && (
                      <button type="button" className="submit-btn invoice-print-btn"
                        onClick={() => {
                          const totals = calcTotals(updateForm.items);
                          handlePrint({
                            ...updateFound,
                            date:        updateForm.date,
                            invoiceDate: updateForm.invoiceDate,
                            subject:     updateForm.invoiceNo,
                            notes:       updateForm.notes,
                            products:    updateForm.items.map((it, i) => ({
                              serialNo:    i + 1,
                              description: it.description,
                              quantity:    parseFloat(it.qty)        || 0,
                              rate:        parseFloat(it.rate)       || 0,
                              gstPercent:  parseFloat(it.gstPercent) || 0,
                              amount:      parseFloat(it.amount)     || 0,
                              gstAmount:   parseFloat(it.gstAmount)  || 0,
                              netTotal:    parseFloat(it.netTotal)   || 0,
                            })),
                            totalAmount: totals.totalAmount,
                            totalGST:    totals.totalGST,
                            grandTotal:  totals.grandTotal,
                          });
                        }}>
                        🖨️ Print Preview
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* ════ DELETE ════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">🗑️ Delete Purchase Bill</div>
            <div className="autofill-banner full-width" style={{ background: '#fff7ed', borderColor: '#fed7aa', marginBottom: 16 }}>
              <span className="autofill-icon">⚠️</span>
              <span style={{ color: '#92400e', fontSize: 13 }}>
                <strong>Bills with existing payments cannot be deleted.</strong> Only bills with zero paid amount can be deleted.
              </span>
            </div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Purchase Bill *</label>
              <SearchableDropdown
                options={billOptions}
                value={deleteBillId}
                onChange={handleDeleteSelect}
                placeholder="Search purchase bill to delete..."
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Purchase SNO',  deleteFound.sno],
                  ['Vendor',        getVendorLabel(deleteFound)],
                  ['Subject',       deleteFound.subject || '—'],
                  ['Notes',         deleteFound.notes   || '—'],
                  ['Date',          deleteFound.date        ? new Date(deleteFound.date).toLocaleDateString('en-IN')        : '—'],
                  ['Invoice Date',  deleteFound.invoiceDate ? new Date(deleteFound.invoiceDate).toLocaleDateString('en-IN') : '—'],
                  ['Sub Total',     `₹${(deleteFound.totalAmount || 0).toLocaleString('en-IN')}`],
                  ['Total GST',     `₹${(deleteFound.totalGST    || 0).toLocaleString('en-IN')}`],
                  ['Grand Total',   `₹${(deleteFound.grandTotal  || 0).toLocaleString('en-IN')}`],
                  ['Advance Applied', `₹${getAdvanceApplied(deleteFound).toLocaleString('en-IN')}`],
                  ['Paid Amount',   `₹${(deleteFound.cumulativePaidAmount || 0).toLocaleString('en-IN')}`],
                  ['Balance',       `₹${Math.max(0, (deleteFound.grandTotal || 0) - (deleteFound.cumulativePaidAmount || 0)).toLocaleString('en-IN')}`],
                  ['Status',        statusBadge(deleteFound.paymentStatus)],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}
                    style={k === 'Advance Applied' && getAdvanceApplied(deleteFound) > 0 ? { background: '#f3e8ff', borderColor: '#ddd6fe' } : {}}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val"
                      style={k === 'Advance Applied' ? { color: '#7c3aed', fontWeight: 800 } : {}}>
                      {v}
                    </span>
                  </div>
                ))}

                {(deleteFound.cumulativePaidAmount || 0) > 0 ? (
                  <div className="vendor-delete-warn" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
                    ❌ This bill has <strong>₹{deleteFound.cumulativePaidAmount.toLocaleString('en-IN')}</strong> already paid. Cannot delete.
                  </div>
                ) : (
                  <>
                    <div className="vendor-delete-warn">
                      ⚠️ Deleting this purchase bill is permanent and cannot be undone.
                    </div>
                    <button className="delete-confirm-btn" style={{ marginTop: 12 }} onClick={handleDelete} disabled={loading}>
                      {loading ? '⏳ Deleting...' : '🗑️ Confirm Delete'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ GET ALL ════ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">📋 All Purchase Bills</div>

            <div className="bill-stat-cards">
              <div className="bill-stat-card bsc-total"><span>Total Bills</span><strong>{countAll}</strong></div>
              <div className="bill-stat-card bsc-net"><span>Total Grand</span><strong>₹{bills.reduce((s, b) => s + (b.grandTotal || 0), 0).toLocaleString('en-IN')}</strong></div>
              <div className="bill-stat-card bsc-paid"><span>Total Paid</span><strong>₹{bills.reduce((s, b) => s + (b.cumulativePaidAmount || 0), 0).toLocaleString('en-IN')}</strong></div>
              <div className="bill-stat-card bsc-due"><span>Total Due</span><strong>₹{bills.reduce((s, b) => s + Math.max(0, (b.grandTotal || 0) - (b.cumulativePaidAmount || 0)), 0).toLocaleString('en-IN')}</strong></div>
            </div>

            {bills.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No purchase bills found.</p></div>
            ) : (
              <>
                <div className="excel-download-section">
                  <button className="excel-download-btn excel-btn-all"
                    onClick={() => downloadExcel(bills, 'All_Purchase_Bills')}
                    disabled={bills.length === 0}>
                    📊 Download All Bills Excel
                  </button>
                  <button className="excel-download-btn excel-btn-filtered"
                    onClick={() => downloadExcel(filteredBills, 'Filtered_Purchase_Bills')}
                    disabled={filteredBills.length === 0}>
                    📥 Download Filtered Bills Excel
                  </button>
                </div>

                <div className="getall-filter-bar">
                  <div className="getall-search-wrap">
                    <span className="getall-search-icon">🔍</span>
                    <input className="getall-search-input"
                      placeholder="Search by SNO, vendor, subject, notes..."
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)} />
                    {searchText && <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>}
                  </div>
                  <div className="inv-status-filter-row" style={{ margin: 0 }}>
                    {[
                      { label: 'All',     count: countAll,     key: 'All',     cls: 'filter-all'     },
                      { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'filter-paid'    },
                      { label: 'Partial', count: countPartial, key: 'Partial', cls: 'filter-partial' },
                      { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'filter-unpaid'  },
                    ].map(tab => (
                      <button key={tab.key}
                        className={`inv-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                        onClick={() => { setStatusFilter(tab.key); setSelectedBillId(''); }}>
                        {tab.label}<span className="inv-filter-count">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-field" style={{ marginBottom: 16, maxWidth: 400 }}>
                  <label className="field-label">Filter by Vendor</label>
                  <SearchableDropdown
                    options={vendorFilterOptions}
                    value={vendorFilter}
                    onChange={(val) => { setVendorFilter(val); setSelectedBillId(''); }}
                    placeholder="All Vendors"
                  />
                </div>

                <div style={{ marginBottom: 10, fontSize: 13, color: '#8898b0', fontWeight: 600 }}>
                  Showing {filteredBills.length} of {bills.length} bills
                </div>

                {filteredBills.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">🔍</div><p>No bills match your filter.</p></div>
                ) : (
                  <>
                    {/* Selected bill detail */}
                    {selectedBillObj && (
                      <div className="bill-detail-card">
                        <div className="bill-detail-header">
                          <div>
                            <span className="bill-no-tag" style={{ marginRight: 10 }}>{selectedBillObj.sno}</span>
                            <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedBillObj.subject || 'Purchase'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {statusBadge(selectedBillObj.paymentStatus)}
                            {getAdvanceApplied(selectedBillObj) > 0 && (
                              <span style={{
                                fontSize: 12, fontWeight: 700, color: '#7c3aed',
                                background: '#f3e8ff', border: '1px solid #ddd6fe',
                                borderRadius: 6, padding: '2px 8px',
                              }}>
                                💰 Adv − ₹{Number(getAdvanceApplied(selectedBillObj)).toLocaleString('en-IN')}
                              </span>
                            )}
                            <button className="inv-detail-close" onClick={() => setSelectedBillId('')}>✕</button>
                          </div>
                        </div>
                        <div className="bill-detail-grid">
                          {[
                            ['Purchase SNO', selectedBillObj.sno],
                            ['Vendor',       getVendorLabel(selectedBillObj)],
                            ['Subject',      selectedBillObj.subject || '—'],
                            ['Notes',        selectedBillObj.notes   || '—'],
                            ['Date',         selectedBillObj.date        ? new Date(selectedBillObj.date).toLocaleDateString('en-IN')        : '—'],
                            ['Invoice Date', selectedBillObj.invoiceDate ? new Date(selectedBillObj.invoiceDate).toLocaleDateString('en-IN') : '—'],
                            ['Sub Total',    `₹${(selectedBillObj.totalAmount || 0).toLocaleString('en-IN')}`],
                            ['Total GST',    `₹${(selectedBillObj.totalGST    || 0).toLocaleString('en-IN')}`],
                            ['Grand Total',  `₹${(selectedBillObj.grandTotal  || 0).toLocaleString('en-IN')}`],
                            ['Advance Applied', `₹${getAdvanceApplied(selectedBillObj).toLocaleString('en-IN')}`],
                            ['Balance',      `₹${Math.max(0, (selectedBillObj.grandTotal || 0) - (selectedBillObj.cumulativePaidAmount || 0)).toLocaleString('en-IN')}`],
                          ].map(([k, v]) => (
                            <div className="bill-detail-item" key={k}
                              style={
                                k === 'Advance Applied' && getAdvanceApplied(selectedBillObj) > 0
                                  ? { background: '#f3e8ff', borderColor: '#ddd6fe' } : {}
                              }>
                              <span className="bill-detail-key">{k}</span>
                              <span className="bill-detail-val"
                                style={
                                  k === 'Advance Applied' ? { color: '#7c3aed', fontWeight: 800 } :
                                  k === 'Balance' && Math.max(0, (selectedBillObj.grandTotal || 0) - (selectedBillObj.cumulativePaidAmount || 0)) > 0
                                    ? { color: '#c93360' } : {}
                                }>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>

                        {Array.isArray(selectedBillObj.products) && selectedBillObj.products.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div className="items-section-label" style={{ marginBottom: 8 }}>Purchase Items</div>
                            <div className="items-table-wrap" style={{ marginTop: 0 }}>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: 40 }}>S.No</th>
                                    <th>Description</th>
                                    <th style={{ width: 60 }}>Qty</th>
                                    <th style={{ width: 100 }}>Rate (₹)</th>
                                    <th style={{ width: 70 }}>GST %</th>
                                    <th style={{ width: 100 }}>Amount (₹)</th>
                                    <th style={{ width: 100 }}>GST Amt (₹)</th>
                                    <th style={{ width: 120 }}>Net Total (₹)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedBillObj.products.map((p, i) => (
                                    <tr key={p._id || i}>
                                      <td className="sno-cell">{p.serialNo || i + 1}</td>
                                      <td>{p.description || '—'}</td>
                                      <td>{p.quantity}</td>
                                      <td>₹{Number(p.rate || 0).toLocaleString('en-IN')}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        <span className="gst-pct-tag">{p.gstPercent || 0}%</span>
                                      </td>
                                      <td className="amt-cell">₹{Number(p.amount || 0).toLocaleString('en-IN')}</td>
                                      <td style={{ color: '#7a5000', fontWeight: 700, textAlign: 'right' }}>₹{Number(p.gstAmount || 0).toLocaleString('en-IN')}</td>
                                      <td style={{ color: '#036b4e', fontWeight: 800, textAlign: 'right' }}>₹{Number(p.netTotal  || 0).toLocaleString('en-IN')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                          <button className="submit-btn invoice-print-btn"
                            onClick={() => handlePrint(selectedBillObj)}>
                            🖨️ Print Purchase Bill
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bills Table */}
                    <div className="bill-table-wrap" style={{ marginTop: 16, overflowX: 'auto' }}>
                      <table className="clients-table bill-list-table">
                        <thead>
                          <tr>
                            <th style={{ width: 50 }}>S.No</th>
                            <th>Purchase SNO</th>
                            <th>Vendor</th>
                            <th>Subject</th>
                            <th>Date</th>
                            <th>Sub Total</th>
                            <th>Total GST</th>
                            <th>Grand Total</th>
                            <th>Advance Applied</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th style={{ width: 80 }}>Print</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBills.map((b, idx) => {
                            const paid       = b.cumulativePaidAmount || 0;
                            const balance    = Math.max(0, (b.grandTotal || 0) - paid);
                            const advApplied = getAdvanceApplied(b);
                            const isSelected = selectedBillId === b._id;
                            return (
                              <tr key={b._id}
                                className={isSelected ? 'bill-row-selected-tr' : ''}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedBillId(isSelected ? '' : b._id)}>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#8898b0' }}>{idx + 1}</td>
                                <td><span className="bill-no-tag">{b.sno}</span></td>
                                <td style={{ fontWeight: 600 }}>{getVendorLabel(b)}</td>
                                <td style={{ color: '#5b7fff', fontWeight: 500 }}>{b.subject || '—'}</td>
                                <td style={{ fontSize: 12, color: '#8898b0' }}>
                                  {b.date ? new Date(b.date).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td className="amt-cell">₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}</td>
                                <td style={{ textAlign: 'right', color: '#7a5000', fontWeight: 700 }}>
                                  ₹{Number(b.totalGST || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="amt-cell" style={{ fontWeight: 800 }}>
                                  ₹{Number(b.grandTotal || 0).toLocaleString('en-IN')}
                                </td>
                                {/* ✅ Advance Applied column */}
                                <td style={{
                                  textAlign: 'right', fontWeight: 700,
                                  color: advApplied > 0 ? '#7c3aed' : '#aaa',
                                }}>
                                  {advApplied > 0 ? `₹${Number(advApplied).toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className={balance > 0 ? 'outstanding-due' : 'outstanding-zero'}>
                                  ₹{Number(balance).toLocaleString('en-IN')}
                                </td>
                                <td>{statusBadge(b.paymentStatus)}</td>
                                <td onClick={e => e.stopPropagation()}>
                                  <button
                                    className="inv-print-btn"
                                    title="Print"
                                    onClick={() => handlePrint(b)}
                                    style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e6fdf6', border: '1.5px solid #a0f0d8', color: '#036b4e', cursor: 'pointer' }}>
                                    🖨️
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default PurchaseBillPage;