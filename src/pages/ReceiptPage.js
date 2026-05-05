import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/ReceiptPage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

// ── Searchable Dropdown ─────────────────────────────────────
function SearchableDropdown({ options, value, onChange, placeholder, getLabel, getId }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

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

// ── Excel Export ────────────────────────────────────────────
function exportReceiptsToExcel(receipts, invoiceReceiptSummary, filters = {}) {
  const BOM = '\uFEFF';
  const companyHeader = [
    ['Design Art'],
    ['Payment Receipts Export'],
    [`Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`],
    filters.statusFilter && filters.statusFilter !== 'All' ? [`Filter: Status = ${filters.statusFilter}`] : [],
    filters.searchRcptNo ? [`Filter: Receipt No = ${filters.searchRcptNo}`] : [],
    filters.searchClient ? [`Filter: Client = ${filters.searchClient}`] : [],
    filters.searchInvNo  ? [`Filter: Invoice No = ${filters.searchInvNo}`] : [],
    filters.dateFrom     ? [`Filter: From = ${filters.dateFrom}`] : [],
    filters.dateTo       ? [`Filter: To = ${filters.dateTo}`] : [],
    [''],
    ['Receipt No','Invoice No','Client Name','Client Code','Project','Amount Paid (₹)','Payment Date','Invoice Total (₹)','Balance (₹)','Advance (₹)','Invoice Status'],
  ].filter(r => r.length > 0);

  const rows = receipts.map(r => {
    const invId    = r.invoice?._id || r.invoice;
    const summary  = invId ? invoiceReceiptSummary[invId] : null;
    const total    = Number(r.invoice?.grandTotal || 0);
    const invStatus = r.invoice?.paymentStatus;
    // Advance = totalReceiptsForInvoice - grandTotal (if positive)
    const advance  = summary && summary.totalPaid > summary.grandTotal
      ? summary.totalPaid - summary.grandTotal : 0;
    const balance  = advance > 0 ? 0 : Math.max(0, total - Number(r.invoice?.paidAmount || 0));
    return [
      r.receiptNumber || '',
      r.invoice?.invoiceNumber || '',
      r.client?.name || '',
      r.client?.clientCode || '',
      r.invoice?.subject || '',
      r.amountPaid || 0,
      r.paymentDate?.split('T')[0] || '',
      total,
      balance,
      advance,
      invStatus || '',
    ];
  });

  const totalCollected = receipts.reduce((s, r) => s + (r.amountPaid || 0), 0);
  const summaryRows = [
    [''],
    ['SUMMARY'],
    ['Total Receipts', receipts.length],
    ['Total Collected (₹)', totalCollected],
    [''],
    ['Designed by Mavepizon Technologies Pvt Ltd'],
  ];

  const allRows = [...companyHeader, ...rows, ...summaryRows];
  const csv = BOM + allRows.map(row =>
    row.map(cell => {
      const val = String(cell).replace(/"/g, '""');
      return val.includes(',') || val.includes('\n') || val.includes('"') ? `"${val}"` : val;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `DesignArt_Receipts_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ──────────────────────────────────────────
function ReceiptPage({ onLogout }) {
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients,  setClients]  = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast,   setToast]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const [addForm, setAddForm] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('receipt_addForm')) ||
        { invoiceId: '', amountPaid: '', description: '' };
    } catch {
      return { invoiceId: '', amountPaid: '', description: '' };
    }
  });
  useEffect(() => {
    sessionStorage.setItem('receipt_addForm', JSON.stringify(addForm));
  }, [addForm]);

  const [updateReceiptId, setUpdateReceiptId] = useState('');
  const [updateFound,     setUpdateFound]     = useState(null);
  const [updateForm, setUpdateForm] = useState({ amountPaid: '', paymentDate: '', description: '' });

  const [deleteReceiptId, setDeleteReceiptId] = useState('');
  const [deleteFound,     setDeleteFound]     = useState(null);

  const [statusFilter,      setStatusFilter]      = useState('All');
  const [searchRcptNo,      setSearchRcptNo]      = useState('');
  const [searchClient,      setSearchClient]      = useState('');
  const [searchInvNo,       setSearchInvNo]       = useState('');
  const [dateFrom,          setDateFrom]          = useState('');
  const [dateTo,            setDateTo]            = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');

  // Store advance amounts returned from backend on receipt creation
  // Key: receiptId, Value: advanceAmount
  const [receiptAdvanceMap, setReceiptAdvanceMap] = useState({});

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API_BASE_URL}/receipt/getall`);
      const d = await r.json();
      setReceipts(d.receipts || []);
    } catch {
      showToast('Failed to fetch receipts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/invoice/getall`);
      const d = await r.json();
      setInvoices(d.data || []);
    } catch {}
  };

  const fetchClients = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/client/getall`);
      const d = await r.json();
      setClients(Array.isArray(d) ? d : (d.data || []));
    } catch {}
  };

  useEffect(() => {
    fetchReceipts();
    fetchInvoices();
    fetchClients();
  }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setUpdateReceiptId(''); setUpdateFound(null);
    setUpdateForm({ amountPaid: '', paymentDate: '', description: '' });
    setDeleteReceiptId(''); setDeleteFound(null);
    setSelectedReceiptId('');
    setStatusFilter('All');
    setSearchRcptNo(''); setSearchClient(''); setSearchInvNo('');
    setDateFrom(''); setDateTo('');
  };

  const getClientForInvoice = (inv) => {
    if (!inv) return null;
    if (inv.client?.name) return inv.client;
    const clientId = inv.client?._id || inv.client;
    return clients.find(c => c._id === clientId) || null;
  };

  const getInvoiceLabel = (inv) => {
    const c = getClientForInvoice(inv);
    const remaining = Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0));
    return `${inv.invoiceNumber || ''} | ${c?.clientCode || ''} — ${c?.name || ''} | ${inv.subject || ''} | Bal: ₹${Number(remaining).toLocaleString('en-IN')} | ${inv.paymentStatus}`;
  };

  // Only show invoices that still have remaining balance
  const payableInvoices = invoices.filter(i =>
    i.paymentStatus === 'Unpaid' || i.paymentStatus === 'Partial'
  );

  const selectedInvObj    = invoices.find(i => i._id === addForm.invoiceId);
  const selectedInvClient = getClientForInvoice(selectedInvObj);
  const selectedReceiptObj = receipts.find(r => r._id === selectedReceiptId);

  /* ──────────────────────────────────────────────────────────
     KEY FIX: Build a per-invoice summary from ALL receipts.
     invoiceReceiptSummary[invoiceId] = { totalPaid, grandTotal }
     Advance = totalPaid - grandTotal  (if positive)
     This works regardless of paymentStatus field.
  ────────────────────────────────────────────────────────── */
  const invoiceReceiptSummary = receipts.reduce((acc, r) => {
    const invId = r.invoice?._id || (typeof r.invoice === 'string' ? r.invoice : null);
    if (!invId) return acc;
    if (!acc[invId]) {
      acc[invId] = {
        totalPaid:  0,
        grandTotal: Number(r.invoice?.grandTotal || 0),
      };
    }
    acc[invId].totalPaid += Number(r.amountPaid || 0);
    return acc;
  }, {});

  /* ──────────────────────────────────────────────────────────
     Get advance amount for a receipt's invoice.
     Returns advance > 0 if clients paid more than grandTotal.
     Also checks receiptAdvanceMap for freshly created receipts.
  ────────────────────────────────────────────────────────── */
  const getAdvanceForReceipt = useCallback((r) => {
    // If we stored the advance from the create API response, use it
    if (receiptAdvanceMap[r._id] !== undefined && receiptAdvanceMap[r._id] > 0) {
      return receiptAdvanceMap[r._id];
    }
    // Compute from all receipts for that invoice
    const invId = r.invoice?._id || (typeof r.invoice === 'string' ? r.invoice : null);
    if (!invId) return 0;
    const summary = invoiceReceiptSummary[invId];
    if (!summary) return 0;
    const advance = summary.totalPaid - summary.grandTotal;
    return advance > 0 ? advance : 0;
  }, [invoiceReceiptSummary, receiptAdvanceMap]);

  /* ──────────────────────────────────────────────────────────
     Check if an invoice has advance payment (math-based, not status).
  ────────────────────────────────────────────────────────── */
  const isAdvanceInvoice = useCallback((r) => {
    return getAdvanceForReceipt(r) > 0;
  }, [getAdvanceForReceipt]);

  /* ──────────────────────────────────────────────────────────
     BALANCE DISPLAY FIX:
     - If totalPaid >= grandTotal → balance = 0
     - Otherwise → balance = grandTotal - totalPaid
  ────────────────────────────────────────────────────────── */
  const getBalanceForReceipt = useCallback((r) => {
    const invId = r.invoice?._id || (typeof r.invoice === 'string' ? r.invoice : null);
    if (!invId) return 0;
    const summary = invoiceReceiptSummary[invId];
    if (!summary) {
      // Fallback to invoice status fields
      const status = r.invoice?.paymentStatus;
      if (status === 'Paid' || status === 'AdvancePayment') return 0;
      return Math.max(0, (r.invoice?.grandTotal || 0) - (r.invoice?.paidAmount || 0));
    }
    if (summary.totalPaid >= summary.grandTotal) return 0;
    return summary.grandTotal - summary.totalPaid;
  }, [invoiceReceiptSummary]);

  /* ── Advance amount preview during ADD ── */
  const getPreviewAdvance = () => {
    if (!selectedInvObj || !addForm.amountPaid) return 0;
    const paying    = parseFloat(addForm.amountPaid) || 0;
    const remaining = Math.max(0, (selectedInvObj.grandTotal || 0) - (selectedInvObj.paidAmount || 0));
    return paying > remaining ? paying - remaining : 0;
  };
  const previewAdvance = getPreviewAdvance();

  /* ── Status filter — use math-based advance detection ── */
  const getInvoiceStatusForFilter = (r) => {
    const invId = r.invoice?._id || (typeof r.invoice === 'string' ? r.invoice : null);
    const summary = invId ? invoiceReceiptSummary[invId] : null;
    if (summary && summary.totalPaid > summary.grandTotal) return 'AdvancePayment';
    if (summary && summary.totalPaid >= summary.grandTotal) return 'Paid';
    if (summary && summary.totalPaid > 0) return 'Partial';
    return r.invoice?.paymentStatus || 'Unpaid';
  };

  const filteredReceipts = receipts.filter(r => {
    const computedStatus = getInvoiceStatusForFilter(r);
    const matchStatus = statusFilter === 'All'
      || computedStatus === statusFilter
      || (statusFilter === 'Paid' && computedStatus === 'AdvancePayment');
    const matchRcptNo = !searchRcptNo.trim() || r.receiptNumber?.toLowerCase().includes(searchRcptNo.toLowerCase());
    const matchClient = !searchClient.trim() ||
      r.client?.name?.toLowerCase().includes(searchClient.toLowerCase()) ||
      r.client?.clientCode?.toLowerCase().includes(searchClient.toLowerCase());
    const matchInvNo  = !searchInvNo.trim()  || r.invoice?.invoiceNumber?.toLowerCase().includes(searchInvNo.toLowerCase());
    const rDate  = r.paymentDate?.split('T')[0] || '';
    const matchFrom = !dateFrom || rDate >= dateFrom;
    const matchTo   = !dateTo   || rDate <= dateTo;
    return matchStatus && matchRcptNo && matchClient && matchInvNo && matchFrom && matchTo;
  });

  const countAll     = receipts.length;
  const countPaid    = receipts.filter(r => {
    const s = getInvoiceStatusForFilter(r);
    return s === 'Paid' || s === 'AdvancePayment';
  }).length;
  const countPartial = receipts.filter(r => getInvoiceStatusForFilter(r) === 'Partial').length;
  const countUnpaid  = receipts.filter(r => getInvoiceStatusForFilter(r) === 'Unpaid').length;
  const hasFilters   = searchRcptNo || searchClient || searchInvNo || dateFrom || dateTo;
  const clearFilters = () => { setSearchRcptNo(''); setSearchClient(''); setSearchInvNo(''); setDateFrom(''); setDateTo(''); };

  /* ── ADD ── */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.invoiceId || !addForm.amountPaid) {
      showToast('Please select invoice and enter amount', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId:   addForm.invoiceId,
          amountPaid:  parseFloat(addForm.amountPaid),
          description: addForm.description
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Store advanceAmount from backend response
        if (data.receipt?._id && data.advanceAmount > 0) {
          setReceiptAdvanceMap(prev => ({
            ...prev,
            [data.receipt._id]: data.advanceAmount
          }));
        }
        await Promise.all([fetchReceipts(), fetchInvoices()]);
        setAddForm({ invoiceId: '', amountPaid: '', description: '' });
        sessionStorage.removeItem('receipt_addForm');
        const advMsg = (data.advanceAmount && data.advanceAmount > 0)
          ? ` 💰 Advance Credit: ₹${Number(data.advanceAmount).toLocaleString('en-IN')}`
          : '';
        showToast(`Receipt ${data.receipt?.receiptNumber} generated!${advMsg}`);
      } else {
        showToast(data.message || 'Failed to create receipt', 'error');
      }
    } catch {
      showToast('Error creating receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── UPDATE ── */
  const handleUpdateSelect = (rcptId) => {
    setUpdateReceiptId(rcptId);
    const found = receipts.find(r => r._id === rcptId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        amountPaid:  found.amountPaid,
        paymentDate: found.paymentDate?.split('T')[0] || '',
        description: found.description || ''
      });
    } else {
      setUpdateFound(null);
      setUpdateForm({ amountPaid: '', paymentDate: '', description: '' });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a receipt', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaid:  parseFloat(updateForm.amountPaid),
          paymentDate: updateForm.paymentDate,
          description: updateForm.description
        })
      });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([fetchReceipts(), fetchInvoices()]);
        showToast('Receipt updated!');
        setUpdateFound(null); setUpdateReceiptId('');
        setUpdateForm({ amountPaid: '', paymentDate: '', description: '' });
      } else {
        showToast(data.message || 'Failed to update', 'error');
      }
    } catch {
      showToast('Error updating receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── DELETE ── */
  const handleDeleteSelect = (rcptId) => {
    setDeleteReceiptId(rcptId);
    setDeleteFound(receipts.find(r => r._id === rcptId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a receipt', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await Promise.all([fetchReceipts(), fetchInvoices()]);
        showToast('Receipt deleted!', 'info');
        setDeleteFound(null); setDeleteReceiptId('');
      } else {
        const d = await res.json();
        showToast(d.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Error deleting receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Print ── */
  const handlePrintReceipt = (r) => {
    if (!r.receiptPdf) {
      showToast('PDF not available for this receipt', 'error');
      return;
    }
    window.open(r.receiptPdf, '_blank');
  };

  /* ── Share ── */
  const handleShareReceipt = async (r) => {
    if (!r.receiptPdf) {
      showToast('No PDF available to share', 'error');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${r.receiptNumber}`,
          text: `Payment Receipt — ${r.client?.name || ''} — ₹${Number(r.amountPaid).toLocaleString('en-IN')}`,
          url: r.receiptPdf
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(r.receiptPdf);
        showToast('PDF link copied to clipboard!');
      } catch {
        showToast('Could not share', 'error');
      }
    }
  };

  /* ── Status badge — use computed status ── */
  const statusBadge = (r) => {
    const computed = getInvoiceStatusForFilter(r);
    const map = {
      Paid:           'status-paid',
      Partial:        'status-partial',
      Unpaid:         'status-pending',
      AdvancePayment: 'status-advance',
    };
    const label = computed === 'AdvancePayment' ? 'Advance Paid' : (computed || '—');
    return <span className={`status-badge ${map[computed] || 'status-pending'}`}>{label}</span>;
  };

  /* ── Render ── */
  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">🧾 Receipt Management</h1>
          <span className="entity-page-badge"
            style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            {receipts.length} Receipts
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn rcp-btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Receipt</button>
          <button className="action-btn rcp-btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Receipt</button>
          <button className="action-btn rcp-btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Receipt</button>
          <button className="action-btn rcp-btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>Get All Receipts</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ── ADD ── */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Receipt</div>
            <form onSubmit={handleAdd}>
              <div className="form-row">

                <div className="form-field full-width">
                  <label className="field-label">Select Invoice (Unpaid / Partial) *</label>
                  <SearchableDropdown
                    options={payableInvoices}
                    value={addForm.invoiceId}
                    onChange={id => setAddForm({ ...addForm, invoiceId: id, amountPaid: '' })}
                    placeholder="Search by invoice no, client, subject..."
                    getLabel={getInvoiceLabel}
                    getId={inv => inv._id}
                  />
                </div>

                {selectedInvObj && (
                  <>
                    <div className="form-field full-width">
                      <div className="rcp-client-info-card">
                        <div className="rcp-client-info-row">
                          <div className="rcp-client-avatar">
                            {(selectedInvClient?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="rcp-client-name">{selectedInvClient?.name || '—'}</div>
                            <div className="rcp-client-meta">
                              {selectedInvClient?.clientCode || '—'} &nbsp;·&nbsp; {selectedInvClient?.phone || '—'}
                            </div>
                            {selectedInvClient?.address && (
                              <div className="rcp-client-address">{selectedInvClient.address}</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="rcp-inv-tag">{selectedInvObj.invoiceNumber}</span>
                            <div className="rcp-inv-project" style={{ marginTop: 6 }}>{selectedInvObj.subject}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="form-field full-width">
                      <div className="rcp-balance-row">
                        <div className="rcp-balance-card rcp-bc-total">
                          <span>Grand Total</span>
                          <strong>₹{Number(selectedInvObj.grandTotal).toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="rcp-balance-card rcp-bc-paid">
                          <span>Already Paid</span>
                          <strong>₹{Number(selectedInvObj.paidAmount).toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="rcp-balance-card rcp-bc-due">
                          <span>Remaining</span>
                          <strong>₹{Number(Math.max(0, (selectedInvObj.grandTotal || 0) - (selectedInvObj.paidAmount || 0))).toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="rcp-balance-card rcp-bc-status">
                          <span>Status</span>
                          <strong>
                            <span className={`status-badge ${
                              selectedInvObj.paymentStatus === 'Paid' ? 'status-paid' :
                              selectedInvObj.paymentStatus === 'Partial' ? 'status-partial' : 'status-pending'
                            }`}>{selectedInvObj.paymentStatus}</span>
                          </strong>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="form-field">
                  <label className="field-label">Amount to Pay (₹) *</label>
                  <input
                    className="field-input"
                    type="number"
                    placeholder="Enter payment amount"
                    value={addForm.amountPaid}
                    onChange={e => setAddForm({ ...addForm, amountPaid: e.target.value })}
                  />
                </div>

                {/* Advance preview banner */}
                {previewAdvance > 0 && (
                  <div className="form-field full-width">
                    <div className="advance-preview-banner">
                      <div className="advance-preview-icon">💰</div>
                      <div>
                        <div className="advance-preview-title">Advance Payment Detected</div>
                        <div className="advance-preview-body">
                          You are paying <strong>₹{Number(parseFloat(addForm.amountPaid)||0).toLocaleString('en-IN')}</strong> but
                          only <strong>₹{Number(Math.max(0,(selectedInvObj?.grandTotal||0)-(selectedInvObj?.paidAmount||0))).toLocaleString('en-IN')}</strong> is
                          remaining. The extra <strong>₹{Number(previewAdvance).toLocaleString('en-IN')}</strong> will be
                          recorded as an <strong>Advance Payment</strong>.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-field full-width">
                  <label className="field-label">Description / Notes</label>
                  <textarea
                    className="field-input rcp-textarea"
                    placeholder="Add payment notes, reference, or description (optional)..."
                    rows={3}
                    value={addForm.description}
                    onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="submit-btn rcp-submit" disabled={loading}>
                {previewAdvance > 0
                  ? `Generate Receipt + Advance ₹${Number(previewAdvance).toLocaleString('en-IN')}`
                  : 'Generate Receipt'
                }
              </button>
            </form>
          </div>
        )}

        {/* ── UPDATE ── */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Receipt</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search & Select Receipt *</label>
              <SearchableDropdown
                options={receipts}
                value={updateReceiptId}
                onChange={handleUpdateSelect}
                placeholder="Type receipt no, client or invoice no..."
                getLabel={r => `${r.receiptNumber} — ${r.client?.name || '—'} — ${r.invoice?.invoiceNumber || '—'} — ₹${Number(r.amountPaid).toLocaleString('en-IN')}`}
                getId={r => r._id}
              />
            </div>

            {updateFound && (() => {
              const advAmt  = getAdvanceForReceipt(updateFound);
              const balance = getBalanceForReceipt(updateFound);
              const computedStatus = getInvoiceStatusForFilter(updateFound);
              return (
                <>
                  <div className="rcp-client-info-card" style={{ marginBottom: 20 }}>
                    <div className="rcp-client-info-row">
                      <div className="rcp-client-avatar">
                        {(updateFound.client?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="rcp-client-name">{updateFound.client?.name || '—'}</div>
                        <div className="rcp-client-meta">{updateFound.client?.clientCode || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="rcp-inv-tag">{updateFound.receiptNumber}</span>
                        <div className="rcp-inv-project" style={{ marginTop: 6 }}>{updateFound.invoice?.subject || '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rcp-balance-row" style={{ marginBottom: 20 }}>
                    <div className="rcp-balance-card rcp-bc-total">
                      <span>Invoice Total</span>
                      <strong>₹{Number(updateFound.invoice?.grandTotal || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="rcp-balance-card rcp-bc-paid">
                      <span>This Receipt</span>
                      <strong>₹{Number(updateFound.amountPaid).toLocaleString('en-IN')}</strong>
                    </div>
                    {advAmt > 0 ? (
                      <div className="rcp-balance-card rcp-bc-advance">
                        <span>Advance Credit</span>
                        <strong>+₹{Number(advAmt).toLocaleString('en-IN')}</strong>
                      </div>
                    ) : (
                      <div className="rcp-balance-card rcp-bc-due">
                        <span>Balance</span>
                        <strong>₹{Number(balance).toLocaleString('en-IN')}</strong>
                      </div>
                    )}
                    <div className="rcp-balance-card rcp-bc-status">
                      <span>Invoice Status</span>
                      <strong>{statusBadge(updateFound)}</strong>
                    </div>
                  </div>

                  {/* Show advance info */}
                  {advAmt > 0 && (
                    <div className="advance-note-bar" style={{ marginBottom: 16 }}>
                      <span>💰</span>
                      <span>
                        This invoice has an <strong>Advance Credit of ₹{Number(advAmt).toLocaleString('en-IN')}</strong>.
                        Updating this receipt amount will recalculate the advance.
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleUpdate}>
                    <div className="form-row">
                      <div className="form-field">
                        <label className="field-label">Amount Paid (₹)</label>
                        <input className="field-input" type="number"
                          value={updateForm.amountPaid}
                          onChange={e => setUpdateForm({ ...updateForm, amountPaid: e.target.value })} />
                      </div>
                      <div className="form-field">
                        <label className="field-label">Payment Date</label>
                        <input className="field-input" type="date"
                          value={updateForm.paymentDate}
                          onChange={e => setUpdateForm({ ...updateForm, paymentDate: e.target.value })} />
                      </div>
                      <div className="form-field full-width">
                        <label className="field-label">Description / Notes</label>
                        <textarea className="field-input rcp-textarea" rows={3}
                          placeholder="Add payment notes, reference, or description..."
                          value={updateForm.description}
                          onChange={e => setUpdateForm({ ...updateForm, description: e.target.value })} />
                      </div>
                    </div>
                    <button type="submit" className="submit-btn" disabled={loading}
                      style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                      Update Receipt
                    </button>
                  </form>
                </>
              );
            })()}
          </div>
        )}

        {/* ── DELETE ── */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Receipt</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search & Select Receipt *</label>
              <SearchableDropdown
                options={receipts}
                value={deleteReceiptId}
                onChange={handleDeleteSelect}
                placeholder="Type receipt no, client or invoice no..."
                getLabel={r => `${r.receiptNumber} — ${r.client?.name || '—'} — ${r.invoice?.invoiceNumber || '—'} — ₹${Number(r.amountPaid).toLocaleString('en-IN')}`}
                getId={r => r._id}
              />
            </div>

            {deleteFound && (() => {
              const advAmt = getAdvanceForReceipt(deleteFound);
              return (
                <div className="detail-card" style={{ marginTop: 20 }}>
                  {[
                    ['Receipt No',    deleteFound.receiptNumber],
                    ['Client',        deleteFound.client?.name || '—'],
                    ['Client Code',   deleteFound.client?.clientCode || '—'],
                    ['Invoice No',    deleteFound.invoice?.invoiceNumber || '—'],
                    ['Invoice Total', `₹${Number(deleteFound.invoice?.grandTotal || 0).toLocaleString('en-IN')}`],
                    ['Amount Paid',   `₹${Number(deleteFound.amountPaid).toLocaleString('en-IN')}`],
                    ['Payment Date',  deleteFound.paymentDate?.split('T')[0] || '—'],
                    ['Invoice Status', (() => {
                      const s = getInvoiceStatusForFilter(deleteFound);
                      return s === 'AdvancePayment' ? 'Advance Paid' : (s || '—');
                    })()],
                    ['Description',   deleteFound.description || '—'],
                  ].map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span className="detail-key">{k}</span>
                      <span className="detail-val">{v}</span>
                    </div>
                  ))}
                  {advAmt > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#e6fdf6', borderRadius: 8, border: '1px solid #a0f0d8', color: '#036b4e', fontSize: 13, fontWeight: 600 }}>
                      💰 This invoice has Advance Payment — Advance Credit: ₹{Number(advAmt).toLocaleString('en-IN')}. Deleting will reverse ₹{Number(deleteFound.amountPaid).toLocaleString('en-IN')} and may remove the advance.
                    </div>
                  )}
                  <p style={{ marginTop: 12, color: '#c93360', fontSize: 13, fontWeight: 600 }}>
                    ⚠️ Deleting will reverse ₹{Number(deleteFound.amountPaid).toLocaleString('en-IN')} from invoice balance.
                  </p>
                  <button className="delete-confirm-btn" style={{ marginTop: 16 }}
                    onClick={handleDelete} disabled={loading}>
                    Confirm Delete
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── GET ALL ── */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="rcp-getall-header">
              <div className="panel-title" style={{ margin: 0 }}>All Receipts</div>
              <button
                className="rcp-excel-btn"
                onClick={() => exportReceiptsToExcel(filteredReceipts, invoiceReceiptSummary, { statusFilter, searchRcptNo, searchClient, searchInvNo, dateFrom, dateTo })}
                title="Download filtered receipts as CSV">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <path d="M14 2H6C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 15L12 18L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 12V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Export Excel
              </button>
            </div>

            {/* Summary chips */}
            <div className="rcp-summary-chips">
              <div className="rcp-chip chip-total">
                <span>Total Receipts</span>
                <strong>{receipts.length}</strong>
              </div>
              <div className="rcp-chip chip-received">
                <span>Total Collected</span>
                <strong>₹{receipts.reduce((s, r) => s + (r.amountPaid || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="rcp-chip chip-billed">
                <span>Paid Invoices</span>
                <strong>{countPaid}</strong>
              </div>
              <div className="rcp-chip chip-due">
                <span>Partial / Unpaid</span>
                <strong>{countPartial + countUnpaid}</strong>
              </div>
            </div>

            {/* Status filter tabs */}
            <div className="rcp-filter-row">
              {[
                { label: 'All',     count: countAll,     key: 'All',     cls: 'rcp-tab-all' },
                { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'rcp-tab-paid' },
                { label: 'Partial', count: countPartial, key: 'Partial', cls: 'rcp-tab-partial' },
                { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'rcp-tab-unpaid' },
              ].map(tab => (
                <button key={tab.key}
                  className={`rcp-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(tab.key); setSelectedReceiptId(''); }}>
                  {tab.label}<span className="rcp-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Multi-filter row */}
            <div className="multi-filter-grid">
              <div className="form-field">
                <label className="field-label">Receipt No</label>
                <input className="field-input" placeholder="RC0001..."
                  value={searchRcptNo}
                  onChange={e => { setSearchRcptNo(e.target.value); setSelectedReceiptId(''); }} />
              </div>
              <div className="form-field">
                <label className="field-label">Client</label>
                <input className="field-input" placeholder="Search client..."
                  value={searchClient}
                  onChange={e => { setSearchClient(e.target.value); setSelectedReceiptId(''); }} />
              </div>
              <div className="form-field">
                <label className="field-label">Invoice No</label>
                <input className="field-input" placeholder="INV0001..."
                  value={searchInvNo}
                  onChange={e => { setSearchInvNo(e.target.value); setSelectedReceiptId(''); }} />
              </div>
              <div className="form-field">
                <label className="field-label">Date From</label>
                <input className="field-input" type="date" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setSelectedReceiptId(''); }} />
              </div>
              <div className="form-field">
                <label className="field-label">Date To</label>
                <input className="field-input" type="date" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setSelectedReceiptId(''); }} />
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
                Showing <strong>{filteredReceipts.length}</strong> of {receipts.length} receipts
              </div>
            )}

            {filteredReceipts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No receipts found.</p>
              </div>
            ) : (
              <>
                {/* Selected receipt detail card */}
                {selectedReceiptObj && (() => {
                  const advAmt     = getAdvanceForReceipt(selectedReceiptObj);
                  const hasAdv     = advAmt > 0;
                  const grandTotal = Number(selectedReceiptObj.invoice?.grandTotal || 0);
                  const balance    = getBalanceForReceipt(selectedReceiptObj);

                  return (
                    <div className="rcp-detail-card">
                      <div className="rcp-detail-header">
                        <div>
                          <span className="rcp-number-tag" style={{ marginRight: 10 }}>{selectedReceiptObj.receiptNumber}</span>
                          <span style={{ fontWeight: 700 }}>{selectedReceiptObj.invoice?.subject || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {statusBadge(selectedReceiptObj)}
                          {hasAdv && (
                            <span className="advance-tag">💰 Advance +₹{Number(advAmt).toLocaleString('en-IN')}</span>
                          )}
                          <button className="inv-detail-close" onClick={() => setSelectedReceiptId('')}>✕</button>
                        </div>
                      </div>

                      <div className="rcp-client-info-card" style={{ marginBottom: 14 }}>
                        <div className="rcp-client-info-row">
                          <div className="rcp-client-avatar">
                            {(selectedReceiptObj.client?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="rcp-client-name">{selectedReceiptObj.client?.name || '—'}</div>
                            <div className="rcp-client-meta">{selectedReceiptObj.client?.clientCode || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="inv-number-tag">{selectedReceiptObj.invoice?.invoiceNumber || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment breakdown */}
                      <div className="rcp-balance-row" style={{ marginBottom: 14 }}>
                        <div className="rcp-balance-card rcp-bc-total">
                          <span>Invoice Total</span>
                          <strong>₹{Number(grandTotal).toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="rcp-balance-card rcp-bc-paid">
                          <span>This Receipt</span>
                          <strong>₹{Number(selectedReceiptObj.amountPaid).toLocaleString('en-IN')}</strong>
                        </div>
                        {hasAdv ? (
                          <div className="rcp-balance-card rcp-bc-advance">
                            <span>Advance Credit</span>
                            <strong>+₹{Number(advAmt).toLocaleString('en-IN')}</strong>
                          </div>
                        ) : (
                          <div className="rcp-balance-card rcp-bc-due">
                            <span>Balance Remaining</span>
                            <strong>₹{Number(balance).toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                        <div className="rcp-balance-card rcp-bc-status">
                          <span>Status</span>
                          <strong>{statusBadge(selectedReceiptObj)}</strong>
                        </div>
                      </div>

                      {/* Advance note banner */}
                      {hasAdv && (
                        <div className="advance-note-bar" style={{ marginBottom: 14 }}>
                          <span>💰</span>
                          <span>
                            Invoice fully paid. Client paid an extra <strong>₹{Number(advAmt).toLocaleString('en-IN')}</strong> recorded as <strong>Advance Credit</strong>.
                          </span>
                        </div>
                      )}

                      <div className="inv-detail-grid">
                        {[
                          ['Receipt No',    selectedReceiptObj.receiptNumber],
                          ['Invoice No',    selectedReceiptObj.invoice?.invoiceNumber || '—'],
                          ['Invoice Total', `₹${Number(grandTotal).toLocaleString('en-IN')}`],
                          ['Amount Paid',   `₹${Number(selectedReceiptObj.amountPaid).toLocaleString('en-IN')}`],
                          ['Balance',       hasAdv ? '₹0 (Fully Paid)' : `₹${Number(balance).toLocaleString('en-IN')}`],
                          ['Payment Date',  selectedReceiptObj.paymentDate?.split('T')[0] || '—'],
                          ...(hasAdv ? [['Advance Credit', `+₹${Number(advAmt).toLocaleString('en-IN')}`]] : []),
                        ].map(([k, v]) => (
                          <div className="inv-detail-item" key={k}
                            style={
                              k === 'Advance Credit' ? { background: '#e6fdf6', borderColor: '#a0f0d8' } :
                              k === 'Balance' && !hasAdv && balance > 0 ? { background: '#fff4f7', borderColor: '#ffc8d4' } : {}
                            }>
                            <span className="inv-detail-key">{k}</span>
                            <span className="inv-detail-val"
                              style={
                                k === 'Advance Credit' ? { color: '#036b4e' } :
                                k === 'Balance' && !hasAdv && balance > 0 ? { color: '#c93360' } : {}
                              }>
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>

                      {selectedReceiptObj.description && (
                        <div className="rcp-desc-display">
                          <span className="rcp-desc-label">Description</span>
                          <p className="rcp-desc-text">{selectedReceiptObj.description}</p>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                        {selectedReceiptObj.receiptPdf ? (
                          <>
                            <button className="submit-btn rcp-submit"
                              onClick={() => handlePrintReceipt(selectedReceiptObj)}>
                              🖨️ Print Receipt
                            </button>
                            <a href={selectedReceiptObj.receiptPdf} target="_blank" rel="noreferrer"
                              className="submit-btn rcp-pdf-btn" style={{ textDecoration: 'none' }}>
                              📄 Download PDF
                            </a>
                            <button className="submit-btn rcp-share-btn"
                              onClick={() => handleShareReceipt(selectedReceiptObj)}>
                              🔗 Share
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: '#9ca3af' }}>PDF not available</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Receipt card list */}
                <div className="rcp-card-list">
                  {filteredReceipts.map(r => {
                    const isSel   = selectedReceiptId === r._id;
                    const advAmt  = getAdvanceForReceipt(r);
                    const hasAdv  = advAmt > 0;
                    const balance = getBalanceForReceipt(r);

                    return (
                      <div key={r._id}
                        className={`rcp-row-card ${isSel ? 'rcp-row-selected' : ''}`}
                        onClick={() => setSelectedReceiptId(isSel ? '' : r._id)}>

                        <div className="rcp-row-left">
                          <span className="rcp-number-tag">{r.receiptNumber}</span>
                          <div className="rcp-row-project">{r.invoice?.subject || '—'}</div>
                          <div className="rcp-row-client">
                            {r.client?.name || '—'} &nbsp;·&nbsp;
                            <span style={{ color: '#7c3aed' }}>{r.client?.clientCode || ''}</span>
                          </div>
                        </div>

                        <div className="rcp-row-mid">
                          <div className="rcp-row-inv">
                            <span className="inv-number-tag">{r.invoice?.invoiceNumber || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="rcp-row-amt">₹{Number(r.amountPaid).toLocaleString('en-IN')}</span>
                            <span className="rcp-row-date">{r.paymentDate?.split('T')[0]}</span>
                            {/* Show advance OR balance — math-based, always correct */}
                            {hasAdv ? (
                              <span className="rcp-advance-chip">💰 Adv +₹{Number(advAmt).toLocaleString('en-IN')}</span>
                            ) : balance > 0 ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#c93360' }}>Bal ₹{Number(balance).toLocaleString('en-IN')}</span>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#036b4e' }}>Fully Paid ✓</span>
                            )}
                          </div>
                          {r.description && (
                            <div className="rcp-row-desc">
                              📝 {r.description.length > 60 ? r.description.slice(0, 60) + '…' : r.description}
                            </div>
                          )}
                        </div>

                        <div className="rcp-row-right">
                          {statusBadge(r)}
                          <div className="rcp-action-btns" onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                            {r.receiptPdf ? (
                              <>
                                <button className="rcp-action-btn rcp-print" title="Print"
                                  onClick={() => handlePrintReceipt(r)}>🖨️</button>
                                <a href={r.receiptPdf} target="_blank" rel="noreferrer"
                                  className="rcp-action-btn rcp-pdf" title="Download PDF"
                                  style={{ textDecoration: 'none' }}>📄</a>
                                <button className="rcp-action-btn rcp-share" title="Share"
                                  onClick={() => handleShareReceipt(r)}>🔗</button>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>No PDF</span>
                            )}
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

export default ReceiptPage;