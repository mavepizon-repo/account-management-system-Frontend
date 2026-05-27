import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/ReceiptPage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const isAdvanceReceipt = (r) =>
  !r.appliedInvoices || r.appliedInvoices.length === 0;

const getPrimaryInvoice = (r) => {
  if (!r.appliedInvoices || r.appliedInvoices.length === 0) return null;
  return r.appliedInvoices[0].invoice || null;
};

const getPrimaryInvoiceId = (r) => {
  const inv = getPrimaryInvoice(r);
  if (!inv) return null;
  return typeof inv === 'object' ? inv._id : inv;
};

/* ── Searchable Dropdown ─────────────────────────────────── */
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

/* ── CSV Export ──────────────────────────────────────────── */
function exportReceiptsToExcel(receipts, invoices, filters = {}) {
  const BOM = '\uFEFF';
  const companyHeader = [
    ['Design Art'],
    ['Payment Receipts Export'],
    [`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`],
    filters.statusFilter && filters.statusFilter !== 'All' ? [`Filter: Status = ${filters.statusFilter}`] : [],
    filters.searchRcptNo ? [`Filter: Receipt No = ${filters.searchRcptNo}`] : [],
    filters.searchClient ? [`Filter: Client = ${filters.searchClient}`] : [],
    filters.searchInvNo  ? [`Filter: Invoice No = ${filters.searchInvNo}`] : [],
    filters.dateFrom     ? [`Filter: From = ${filters.dateFrom}`] : [],
    filters.dateTo       ? [`Filter: To = ${filters.dateTo}`] : [],
    [''],
    ['Receipt No', 'Invoice No', 'Client Name', 'Client Code', 'Subject', 'Amount Paid (₹)', 'Payment Date', 'Invoice Total (₹)', 'Remaining (₹)', 'Invoice Status'],
  ].filter(r => r.length > 0);

  const rows = receipts.map(r => {
    const invObj    = getPrimaryInvoice(r);
    const subject   = invObj?.subject || '—';
    const invTotal  = Number(invObj?.grandTotal || 0);
    const remaining = Number(r.remainingAmount ?? 0);
    return [
      r.receiptNumber || '',
      invObj?.invoiceNumber || (isAdvanceReceipt(r) ? 'Advance' : '—'),
      r.client?.name || '',
      r.client?.clientCode || '',
      subject,
      r.paidAmountInReceipt || 0,
      r.paymentDate?.split('T')[0] || '',
      invTotal,
      remaining,
      invObj?.paymentStatus || (isAdvanceReceipt(r) ? 'Advance' : '—'),
    ];
  });

  const totalCollected = receipts.reduce((s, r) => s + (r.paidAmountInReceipt || 0), 0);
  const summaryRows = [
    [''],
    ['SUMMARY'],
    ['Total Receipts', receipts.length],
    ['Total Collected (₹)', totalCollected],
    [''],
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

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
function ReceiptPage({ onLogout }) {
  const navigate = useNavigate();

  const [receipts,    setReceipts]    = useState([]);
  const [invoices,    setInvoices]    = useState([]);
  const [clients,     setClients]     = useState([]);
  const [activePanel, setPanel]       = useState(null);
  const [toast,       setToast]       = useState(null);
  const [loading,     setLoading]     = useState(false);

  /* ── ADD form ──
     Backend accepts: invoiceId OR clientId, paidAmountInReceipt, description
     Mode toggles between "Invoice Receipt" and "Advance Receipt (Client)"
  */
  const emptyAddForm = { mode: 'invoice', invoiceId: '', clientId: '', paidAmountInReceipt: '', description: '' };
  const [addForm, setAddForm] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('receipt_addForm')) || emptyAddForm; }
    catch { return emptyAddForm; }
  });
  useEffect(() => {
    sessionStorage.setItem('receipt_addForm', JSON.stringify(addForm));
  }, [addForm]);

  /* ── UPDATE ── */
  const [updateReceiptId, setUpdateReceiptId] = useState('');
  const [updateFound,     setUpdateFound]     = useState(null);
  const [updateForm, setUpdateForm] = useState({ paidAmountInReceipt: '', paymentDate: '', description: '' });

  /* ── DELETE ── */
  const [deleteReceiptId,   setDeleteReceiptId]   = useState('');
  const [deleteFound,       setDeleteFound]       = useState(null);
  const [deleteImpact,      setDeleteImpact]      = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  /* ── GETALL filters ── */
  const [statusFilter,      setStatusFilter]      = useState('All');
  const [searchRcptNo,      setSearchRcptNo]      = useState('');
  const [searchClient,      setSearchClient]      = useState('');
  const [searchInvNo,       setSearchInvNo]       = useState('');
  const [dateFrom,          setDateFrom]          = useState('');
  const [dateTo,            setDateTo]            = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [rcptRes, invRes, cliRes] = await Promise.all([
        fetch(`${API_BASE_URL}/receipt/getall`),
        fetch(`${API_BASE_URL}/invoice/getall`),
        fetch(`${API_BASE_URL}/client/getall`),
      ]);
      const rcptData = await rcptRes.json();
      const invData  = await invRes.json();
      const cliData  = await cliRes.json();

      const invList  = invData.data || [];
      const cliList  = Array.isArray(cliData) ? cliData : (cliData.data || []);
      const rcptList = rcptData.receipts || [];

      setInvoices(invList);
      setClients(cliList);

      // Enrich receipts: resolve client + appliedInvoices[].invoice refs
      const enriched = rcptList.map(r => {
        const clientId  = r.client?._id || (typeof r.client === 'string' ? r.client : null);
        const clientObj = clientId ? (cliList.find(c => c._id === clientId) || r.client) : r.client;

        const enrichedApplied = (r.appliedInvoices || []).map(entry => {
          const invId   = entry.invoice?._id || (typeof entry.invoice === 'string' ? entry.invoice : null);
          const invFull = invId ? invList.find(i => i._id === invId) : null;
          return {
            ...entry,
            invoice: invFull
              ? { ...invFull, ...(entry.invoice && typeof entry.invoice === 'object' ? entry.invoice : {}) }
              : entry.invoice,
          };
        });

        return { ...r, client: clientObj || r.client, appliedInvoices: enrichedApplied };
      });

      setReceipts(enriched);
    } catch {
      showToast('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetPanelState = () => {
    setUpdateReceiptId(''); setUpdateFound(null);
    setUpdateForm({ paidAmountInReceipt: '', paymentDate: '', description: '' });
    setDeleteReceiptId(''); setDeleteFound(null); setDeleteImpact(null); setDeleteConfirmText('');
    setSelectedReceiptId('');
    setStatusFilter('All');
    setSearchRcptNo(''); setSearchClient(''); setSearchInvNo('');
    setDateFrom(''); setDateTo('');
  };

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    resetPanelState();
  };

  /* ── Helpers ── */
  const getClientForInvoice = (inv) => {
    if (!inv) return null;
    if (inv.client?.name) return inv.client;
    const clientId = inv.client?._id || inv.client;
    return clients.find(c => c._id === clientId) || null;
  };

  const getInvoiceNumber = (r) => {
    if (isAdvanceReceipt(r)) return 'Advance';
    const inv = getPrimaryInvoice(r);
    if (inv?.invoiceNumber) return inv.invoiceNumber;
    const invId = getPrimaryInvoiceId(r);
    if (invId) {
      const found = invoices.find(i => i._id === invId);
      if (found?.invoiceNumber) return found.invoiceNumber;
    }
    return '—';
  };

  const getInvoiceLabel = (inv) => {
    const c         = getClientForInvoice(inv);
    const remaining = Math.max(0, (inv.grandTotal || 0) - (inv.cumulativePaidAmount || 0));
    return `${inv.invoiceNumber || ''} | ${c?.clientCode || ''} — ${c?.name || ''} | ${inv.subject || ''} | Bal: ₹${Number(remaining).toLocaleString('en-IN')} | ${inv.paymentStatus}`;
  };

  // Invoices that can still receive payment
  const payableInvoices = invoices.filter(i =>
    i.paymentStatus === 'Unpaid' || i.paymentStatus === 'Partial'
  );

  // Selected invoice object (for ADD form invoice mode)
  const selectedInvObj    = invoices.find(i => i._id === addForm.invoiceId);
  const selectedInvClient = getClientForInvoice(selectedInvObj);

  // Preview advance amount if overpaying an invoice
  const getPreviewAdvance = () => {
    if (!selectedInvObj || !addForm.paidAmountInReceipt) return 0;
    const paying    = parseFloat(addForm.paidAmountInReceipt) || 0;
    const remaining = Math.max(0, (selectedInvObj.grandTotal || 0) - (selectedInvObj.cumulativePaidAmount || 0));
    return paying > remaining ? paying - remaining : 0;
  };
  const previewAdvance = getPreviewAdvance();

  // Selected client for advance mode
  const selectedAdvClient = clients.find(c => c._id === addForm.clientId);

  const selectedReceiptObj = receipts.find(r => r._id === selectedReceiptId);

  /* ── Status helpers ── */
  const getReceiptDisplayStatus = (r) => {
    if (isAdvanceReceipt(r)) return 'Advance';
    const inv    = getPrimaryInvoice(r);
    const invObj = inv || invoices.find(i => i._id === getPrimaryInvoiceId(r));
    if (r.remainingAmount > 0 && invObj?.paymentStatus === 'Paid') return 'AdvancePaid';
    return invObj?.paymentStatus || 'Unpaid';
  };

  const getBalanceForReceipt = (r) => {
    if (isAdvanceReceipt(r)) return 0;
    const inv    = getPrimaryInvoice(r);
    const invObj = inv || invoices.find(i => i._id === getPrimaryInvoiceId(r));
    return Math.max(0, (invObj?.grandTotal || 0) - (invObj?.cumulativePaidAmount || 0));
  };

  const getAdvanceForReceipt = (r) => {
    if (isAdvanceReceipt(r)) return 0;
    return Number(r.remainingAmount || 0);
  };

  /* ── Filter ── */
  const filteredReceipts = receipts.filter(r => {
    const ds = getReceiptDisplayStatus(r);
    const matchStatus =
      statusFilter === 'All'
      || statusFilter === ds
      || (statusFilter === 'Paid' && (ds === 'Paid' || ds === 'AdvancePaid'));
    const matchRcptNo = !searchRcptNo.trim() || r.receiptNumber?.toLowerCase().includes(searchRcptNo.toLowerCase());
    const matchClient = !searchClient.trim() ||
      r.client?.name?.toLowerCase().includes(searchClient.toLowerCase()) ||
      r.client?.clientCode?.toLowerCase().includes(searchClient.toLowerCase());
    const invNo       = getInvoiceNumber(r);
    const matchInvNo  = !searchInvNo.trim() || invNo.toLowerCase().includes(searchInvNo.toLowerCase());
    const rDate       = r.paymentDate?.split('T')[0] || '';
    const matchFrom   = !dateFrom || rDate >= dateFrom;
    const matchTo     = !dateTo   || rDate <= dateTo;
    return matchStatus && matchRcptNo && matchClient && matchInvNo && matchFrom && matchTo;
  });

  const countAll     = receipts.length;
  const countPaid    = receipts.filter(r => { const s = getReceiptDisplayStatus(r); return s === 'Paid' || s === 'AdvancePaid'; }).length;
  const countPartial = receipts.filter(r => getReceiptDisplayStatus(r) === 'Partial').length;
  const countUnpaid  = receipts.filter(r => getReceiptDisplayStatus(r) === 'Unpaid').length;
  const countAdv     = receipts.filter(r => getReceiptDisplayStatus(r) === 'Advance').length;

  const hasFilters   = searchRcptNo || searchClient || searchInvNo || dateFrom || dateTo;
  const clearFilters = () => { setSearchRcptNo(''); setSearchClient(''); setSearchInvNo(''); setDateFrom(''); setDateTo(''); };

  /* ─────────────────────────────────────────────────────────
     ADD — single handler for both modes
     Backend: POST /receipt/create
       { invoiceId, paidAmountInReceipt, description }   → invoice receipt
       { clientId,  paidAmountInReceipt, description }   → advance receipt
  ───────────────────────────────────────────────────────── */
  const handleAdd = async (e) => {
    e.preventDefault();

    if (addForm.mode === 'invoice') {
      if (!addForm.invoiceId || !addForm.paidAmountInReceipt) {
        showToast('Please select an invoice and enter amount', 'error'); return;
      }
    } else {
      if (!addForm.clientId || !addForm.paidAmountInReceipt) {
        showToast('Please select a client and enter amount', 'error'); return;
      }
    }

    try {
      setLoading(true);

      const body = {
        paidAmountInReceipt: parseFloat(addForm.paidAmountInReceipt),
        description:         addForm.description,
      };

      if (addForm.mode === 'invoice') {
        body.invoiceId = addForm.invoiceId;
      } else {
        body.clientId = addForm.clientId;
      }

      const res  = await fetch(`${API_BASE_URL}/receipt/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        await fetchAll();
        sessionStorage.removeItem('receipt_addForm');
        setAddForm(emptyAddForm);
        const advMsg = data.advanceAmount > 0
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
        paidAmountInReceipt: found.paidAmountInReceipt,
        paymentDate:         found.paymentDate?.split('T')[0] || '',
        description:         found.description || '',
      });
    } else {
      setUpdateFound(null);
      setUpdateForm({ paidAmountInReceipt: '', paymentDate: '', description: '' });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a receipt', 'error'); return; }
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/receipt/update/${updateFound._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          paidAmountInReceipt: parseFloat(updateForm.paidAmountInReceipt),
          paymentDate:         updateForm.paymentDate,
          description:         updateForm.description,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAll();
        showToast('Receipt updated!');
        setUpdateFound(null); setUpdateReceiptId('');
        setUpdateForm({ paidAmountInReceipt: '', paymentDate: '', description: '' });
      } else {
        showToast(data.message || 'Failed to update', 'error');
      }
    } catch {
      showToast('Error updating receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── DELETE — with impact analysis ── */
  const handleDeleteSelect = (rcptId) => {
    setDeleteReceiptId(rcptId);
    setDeleteConfirmText('');
    const found = receipts.find(r => r._id === rcptId);
    setDeleteFound(found || null);
    if (!found) { setDeleteImpact(null); return; }

    const isAdv  = isAdvanceReceipt(found);
    const paidAmt = Number(found.paidAmountInReceipt || 0);

    if (isAdv) {
      setDeleteImpact({
        type:          'advance',
        advanceAmount: paidAmt,
        clientName:    found.client?.name || '—',
      });
    } else {
      const inv    = getPrimaryInvoice(found);
      const invObj = inv || invoices.find(i => i._id === getPrimaryInvoiceId(found));
      setDeleteImpact({
        type:          'invoice',
        invoiceNumber: invObj?.invoiceNumber || '—',
        paidAmt,
        isBlocked:     true,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a receipt', 'error'); return; }

    if (deleteImpact?.isBlocked) {
      showToast('Cannot delete: this receipt is connected to an invoice. Delete the invoice first.', 'error');
      return;
    }

    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      showToast('Type "delete" to confirm', 'error'); return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAll();
        showToast(`Advance receipt deleted. ₹${Number(deleteImpact.advanceAmount).toLocaleString('en-IN')} advance credit removed.`, 'info');
        setDeleteFound(null); setDeleteReceiptId(''); setDeleteImpact(null); setDeleteConfirmText('');
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

  /* ── Print / Share ── */
  const handlePrintReceipt = (r) => {
    if (!r.receiptPdf) { showToast('PDF not available for this receipt', 'error'); return; }
    window.open(r.receiptPdf, '_blank');
  };

  const handleShareReceipt = async (r) => {
    if (!r.receiptPdf) { showToast('No PDF available to share', 'error'); return; }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${r.receiptNumber}`,
          text:  `Payment Receipt — ${r.client?.name || ''} — ₹${Number(r.paidAmountInReceipt).toLocaleString('en-IN')}`,
          url:   r.receiptPdf,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(r.receiptPdf);
        showToast('PDF link copied to clipboard!');
      } catch { showToast('Could not share', 'error'); }
    }
  };

  /* ── Status badge ── */
  const statusBadge = (r) => {
    const s = getReceiptDisplayStatus(r);
    const map = {
      Paid:        'status-paid',
      Partial:     'status-partial',
      Unpaid:      'status-pending',
      Advance:     'status-advance',
      AdvancePaid: 'status-advance',
    };
    const label = { Paid: 'Paid', Partial: 'Partial', Unpaid: 'Unpaid', Advance: 'Advance', AdvancePaid: 'Advance Paid' }[s] || s;
    return <span className={`status-badge ${map[s] || 'status-pending'}`}>{label}</span>;
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
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

        <div className="action-cards-grid">
  <div
    className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.ADD)}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Add Receipt</div>
    <div className="action-card-desc">Generate a new payment receipt</div>
  </div>

  <div
    className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.UPDATE)}
  >
    <div className="action-card-icon">✏️</div>
    <div className="action-card-title">Update Receipt</div>
    <div className="action-card-desc">Edit existing receipt details</div>
  </div>

  <div
    className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.GETALL)}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">Get All Receipts</div>
    <div className="action-card-desc">View all receipt records</div>
  </div>

  <div
    className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.DELETE)}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Receipt</div>
    <div className="action-card-desc">Remove a receipt record</div>
  </div>
</div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ══ ADD ══ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add Receipt</div>

            {/* Mode Toggle */}
            <div className="rcp-mode-toggle" style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setAddForm({ ...emptyAddForm, mode: 'invoice' })}
                style={{
                  padding: '9px 22px',
                  fontWeight: 700,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  background: addForm.mode === 'invoice' ? '#1c1c1c' : '#fff',
                  color:      addForm.mode === 'invoice' ? '#fff'    : '#555',
                  transition: 'all 0.2s',
                }}>
                🧾 Invoice Receipt
              </button>
              <button
                type="button"
                onClick={() => setAddForm({ ...emptyAddForm, mode: 'advance' })}
                style={{
                  padding: '9px 22px',
                  fontWeight: 700,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  background: addForm.mode === 'advance' ? '#065f46' : '#fff',
                  color:      addForm.mode === 'advance' ? '#fff'    : '#555',
                  transition: 'all 0.2s',
                }}>
                💰 Advance Receipt
              </button>
            </div>

            {/* ── Invoice Mode ── */}
            {addForm.mode === 'invoice' && (
              <form onSubmit={handleAdd}>
                <div className="form-row">

                  {/* Invoice selector */}
                  <div className="form-field full-width">
                    <label className="field-label">Select Invoice (Unpaid / Partial) *</label>
                    <SearchableDropdown
                      options={payableInvoices}
                      value={addForm.invoiceId}
                      onChange={id => setAddForm(f => ({ ...f, invoiceId: id, paidAmountInReceipt: '' }))}
                      placeholder="Search by invoice no, client, subject..."
                      getLabel={getInvoiceLabel}
                      getId={inv => inv._id}
                    />
                  </div>

                  {/* Client card once invoice selected */}
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
                            <strong>₹{Number(selectedInvObj.cumulativePaidAmount).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="rcp-balance-card rcp-bc-due">
                            <span>Remaining</span>
                            <strong>₹{Number(Math.max(0, (selectedInvObj.grandTotal || 0) - (selectedInvObj.cumulativePaidAmount || 0))).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="rcp-balance-card rcp-bc-status">
                            <span>Status</span>
                            <strong>
                              <span className={`status-badge ${
                                selectedInvObj.paymentStatus === 'Paid'    ? 'status-paid' :
                                selectedInvObj.paymentStatus === 'Partial' ? 'status-partial' : 'status-pending'
                              }`}>{selectedInvObj.paymentStatus}</span>
                            </strong>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Amount */}
                  <div className="form-field">
                    <label className="field-label">Amount to Pay (₹) *</label>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      placeholder="Enter payment amount"
                      value={addForm.paidAmountInReceipt}
                      onChange={e => setAddForm(f => ({ ...f, paidAmountInReceipt: e.target.value }))}
                    />
                  </div>

                  {/* Advance preview if overpaying */}
                  {previewAdvance > 0 && (
                    <div className="form-field full-width">
                      <div className="advance-preview-banner">
                        <div className="advance-preview-icon">💰</div>
                        <div>
                          <div className="advance-preview-title">Advance Payment Detected</div>
                          <div className="advance-preview-body">
                            You are paying <strong>₹{Number(parseFloat(addForm.paidAmountInReceipt) || 0).toLocaleString('en-IN')}</strong> but
                            only <strong>₹{Number(Math.max(0, (selectedInvObj?.grandTotal || 0) - (selectedInvObj?.cumulativePaidAmount || 0))).toLocaleString('en-IN')}</strong> is
                            remaining. The extra <strong>₹{Number(previewAdvance).toLocaleString('en-IN')}</strong> will be stored
                            as an <strong>Advance Credit</strong> on this receipt.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="form-field full-width">
                    <label className="field-label">Description / Notes</label>
                    <textarea
                      className="field-input rcp-textarea"
                      placeholder="Add payment notes, reference, or description (optional)..."
                      rows={3}
                      value={addForm.description}
                      onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn rcp-submit" disabled={loading}>
                  {previewAdvance > 0
                    ? `Generate Receipt + Advance ₹${Number(previewAdvance).toLocaleString('en-IN')}`
                    : 'Generate Receipt'}
                </button>
              </form>
            )}

            {/* ── Advance Mode ── */}
            {addForm.mode === 'advance' && (
              <form onSubmit={handleAdd}>
                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                  Use this when a client pays <strong>before any invoice is raised</strong>.
                  The amount is stored as <em>remainingAmount</em> and will auto-apply when the next invoice is created for this client.
                  <br />
                  <span style={{ color: '#c93360', fontWeight: 600 }}>
                    Note: If this client has pending unpaid/partial invoices, use "Invoice Receipt" instead.
                  </span>
                </p>
                <div className="form-row">

                  {/* Client selector */}
                  <div className="form-field full-width">
                    <label className="field-label">Select Client *</label>
                    <SearchableDropdown
                      options={clients}
                      value={addForm.clientId}
                      onChange={id => setAddForm(f => ({ ...f, clientId: id }))}
                      placeholder="Search client by name or code..."
                      getLabel={c => `${c.clientCode || ''} — ${c.name || ''}`}
                      getId={c => c._id}
                    />
                  </div>

                  {/* Client card */}
                  {selectedAdvClient && (
                    <div className="form-field full-width">
                      <div className="rcp-client-info-card">
                        <div className="rcp-client-info-row">
                          <div className="rcp-client-avatar">
                            {selectedAdvClient.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="rcp-client-name">{selectedAdvClient.name}</div>
                            <div className="rcp-client-meta">
                              {selectedAdvClient.clientCode || '—'} &nbsp;·&nbsp; {selectedAdvClient.phone || '—'}
                            </div>
                            {selectedAdvClient.address && (
                              <div className="rcp-client-address">{selectedAdvClient.address}</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="status-badge status-advance">Advance</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="form-field">
                    <label className="field-label">Advance Amount (₹) *</label>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      placeholder="Enter advance amount"
                      value={addForm.paidAmountInReceipt}
                      onChange={e => setAddForm(f => ({ ...f, paidAmountInReceipt: e.target.value }))}
                    />
                  </div>

                  {/* Description */}
                  <div className="form-field full-width">
                    <label className="field-label">Description / Notes</label>
                    <textarea
                      className="field-input rcp-textarea"
                      placeholder="Add notes about this advance payment (optional)..."
                      rows={3}
                      value={addForm.description}
                      onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                </div>

                <button type="submit" className="submit-btn rcp-submit" disabled={loading}
                  style={{ background: 'linear-gradient(135deg,#d1fae5,#6ee7b7)', color: '#065f46', boxShadow: '0 5px 18px rgba(16,185,129,0.25)' }}>
                  Generate Advance Receipt
                </button>
              </form>
            )}
          </div>
        )}

        {/* ══ UPDATE ══ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Receipt</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search &amp; Select Receipt *</label>
              <SearchableDropdown
                options={receipts}
                value={updateReceiptId}
                onChange={handleUpdateSelect}
                placeholder="Type receipt no, client or invoice no..."
                getLabel={r => `${r.receiptNumber || '—'} — ${r.client?.name || '—'} — ${getInvoiceNumber(r)} — ₹${Number(r.paidAmountInReceipt).toLocaleString('en-IN')}`}
                getId={r => r._id}
              />
            </div>

            {updateFound && (() => {
              const advAmt  = getAdvanceForReceipt(updateFound);
              const balance = getBalanceForReceipt(updateFound);
              const inv     = getPrimaryInvoice(updateFound);
              const invObj  = inv || invoices.find(i => i._id === getPrimaryInvoiceId(updateFound));
              const isAdv   = isAdvanceReceipt(updateFound);
              // Backend blocks editing amount/client if appliedInvoices is non-empty
              const isConnected = !isAdv;

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
                        {!isAdv && (
                          <>
                            <div style={{ marginTop: 4, fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>
                              {getInvoiceNumber(updateFound)}
                            </div>
                            <div className="rcp-inv-project" style={{ marginTop: 4 }}>{invObj?.subject || '—'}</div>
                          </>
                        )}
                        {isAdv && (
                          <span className="status-badge status-advance" style={{ marginTop: 6, display: 'inline-block' }}>Advance</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isConnected && (
                    <div style={{ padding: '10px 14px', background: '#fff8e6', borderRadius: 8, border: '1px solid #ffe08a', marginBottom: 16, fontSize: 13, color: '#7a5000' }}>
                      ⚠️ This receipt is connected to invoice <strong>{getInvoiceNumber(updateFound)}</strong>.
                      Amount cannot be edited — only date and description can be changed.
                    </div>
                  )}

                  {!isAdv && (
                    <div className="rcp-balance-row" style={{ marginBottom: 20 }}>
                      <div className="rcp-balance-card rcp-bc-total">
                        <span>Invoice Total</span>
                        <strong>₹{Number(invObj?.grandTotal || 0).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="rcp-balance-card rcp-bc-paid">
                        <span>This Receipt</span>
                        <strong>₹{Number(updateFound.paidAmountInReceipt).toLocaleString('en-IN')}</strong>
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
                  )}

                  <form onSubmit={handleUpdate}>
                    <div className="form-row">
                      {/* Amount — locked for invoice-connected receipts */}
                      <div className="form-field">
                        <label className="field-label">
                          Amount Paid (₹){isConnected ? ' — locked' : ''}
                        </label>
                        <input
                          className="field-input"
                          type="number"
                          value={updateForm.paidAmountInReceipt}
                          disabled={isConnected}
                          style={isConnected ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                          onChange={e => setUpdateForm({ ...updateForm, paidAmountInReceipt: e.target.value })}
                        />
                      </div>
                      <div className="form-field">
                        <label className="field-label">Payment Date</label>
                        <input
                          className="field-input"
                          type="date"
                          value={updateForm.paymentDate}
                          onChange={e => setUpdateForm({ ...updateForm, paymentDate: e.target.value })}
                        />
                      </div>
                      <div className="form-field full-width">
                        <label className="field-label">Description / Notes</label>
                        <textarea
                          className="field-input rcp-textarea"
                          rows={3}
                          placeholder="Add payment notes, reference, or description..."
                          value={updateForm.description}
                          onChange={e => setUpdateForm({ ...updateForm, description: e.target.value })}
                        />
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

        {/* ══ DELETE ══ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Receipt</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search &amp; Select Receipt *</label>
              <SearchableDropdown
                options={receipts}
                value={deleteReceiptId}
                onChange={handleDeleteSelect}
                placeholder="Type receipt no, client or invoice no..."
                getLabel={r => `${r.receiptNumber || '—'} — ${r.client?.name || '—'} — ${getInvoiceNumber(r)} — ₹${Number(r.paidAmountInReceipt).toLocaleString('en-IN')}`}
                getId={r => r._id}
              />
            </div>

            {deleteFound && (() => {
              const inv    = getPrimaryInvoice(deleteFound);
              const invObj = inv || invoices.find(i => i._id === getPrimaryInvoiceId(deleteFound));
              const isAdv  = isAdvanceReceipt(deleteFound);

              return (
                <div className="detail-card" style={{ marginTop: 20 }}>
                  {[
                    ['Receipt No',       deleteFound.receiptNumber],
                    ['Client',           deleteFound.client?.name || '—'],
                    ['Client Code',      deleteFound.client?.clientCode || '—'],
                    ['Invoice No',       isAdv ? 'N/A (Advance Receipt)' : getInvoiceNumber(deleteFound)],
                    ...(!isAdv ? [
                      ['Invoice Total',  `₹${Number(invObj?.grandTotal || 0).toLocaleString('en-IN')}`],
                      ['Subject',        invObj?.subject || '—'],
                    ] : []),
                    ['Amount Paid',      `₹${Number(deleteFound.paidAmountInReceipt).toLocaleString('en-IN')}`],
                    ['Remaining Amount', `₹${Number(deleteFound.remainingAmount || 0).toLocaleString('en-IN')}`],
                    ['Payment Date',     deleteFound.paymentDate?.split('T')[0] || '—'],
                    ['Type',             isAdv ? 'Advance (No Invoice)' : 'Invoice Payment'],
                    ['Description',      deleteFound.description || '—'],
                  ].map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span className="detail-key">{k}</span>
                      <span className="detail-val">{v}</span>
                    </div>
                  ))}

                  {deleteImpact && (
                    <div style={{ marginTop: 16 }}>

                      {/* ADVANCE — deletable */}
                      {deleteImpact.type === 'advance' && (
                        <>
                          <div style={{ padding: '14px 16px', background: '#fff8e6', borderRadius: 10, border: '1.5px solid #ffe08a', marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, color: '#7a5000', fontSize: 14, marginBottom: 8 }}>
                              💰 Impact: Advance Receipt Deletion
                            </div>
                            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
                              Deleting this receipt will remove <strong>₹{Number(deleteImpact.advanceAmount).toLocaleString('en-IN')}</strong> advance
                              credit from <strong>{deleteImpact.clientName}</strong>'s account.
                              Future invoices for this client will no longer auto-apply this advance.
                            </div>
                          </div>

                          <div className="form-field" style={{ marginBottom: 0 }}>
                            <label className="field-label" style={{ color: '#c93360', fontWeight: 700 }}>
                              Type <strong>"delete"</strong> to confirm
                            </label>
                            <input
                              className="field-input"
                              placeholder='Type "delete" here...'
                              value={deleteConfirmText}
                              onChange={e => setDeleteConfirmText(e.target.value)}
                              style={{ borderColor: deleteConfirmText.trim().toLowerCase() === 'delete' ? '#10b981' : '#ffc8d4' }}
                            />
                          </div>

                          <button
                            className="delete-confirm-btn"
                            style={{ marginTop: 16, opacity: deleteConfirmText.trim().toLowerCase() !== 'delete' ? 0.5 : 1 }}
                            onClick={handleDelete}
                            disabled={loading || deleteConfirmText.trim().toLowerCase() !== 'delete'}>
                            Confirm Delete Advance Receipt
                          </button>
                        </>
                      )}

                      {/* INVOICE-CONNECTED — blocked */}
                      {deleteImpact.type === 'invoice' && (
                        <div style={{ padding: '14px 16px', background: '#fff4f7', borderRadius: 10, border: '1.5px solid #ffc8d4' }}>
                          <div style={{ fontWeight: 700, color: '#c93360', fontSize: 14, marginBottom: 10 }}>
                            🚫 Cannot Delete — Invoice-Connected Receipt
                          </div>
                          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>
                            This receipt is connected to invoice <strong>{deleteImpact.invoiceNumber}</strong>.
                            The backend does not allow deleting receipts that are linked to invoices.
                          </div>
                          <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff', borderRadius: 8, border: '1px solid #ffc8d4', fontSize: 13 }}>
                            <strong>To remove this receipt:</strong> Go to <em>Delete Invoice</em> and delete
                            invoice <strong>{deleteImpact.invoiceNumber}</strong>. The cascade delete will remove all linked receipts automatically.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ GET ALL ══ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="rcp-getall-header">
              <div className="panel-title" style={{ margin: 0 }}>All Receipts</div>
              <button
                className="rcp-excel-btn"
                onClick={() => exportReceiptsToExcel(filteredReceipts, invoices, { statusFilter, searchRcptNo, searchClient, searchInvNo, dateFrom, dateTo })}
                title="Download filtered receipts as CSV">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <path d="M14 2H6C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 15L12 18L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 12V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Export CSV
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
                <strong>₹{receipts.reduce((s, r) => s + (r.paidAmountInReceipt || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="rcp-chip chip-billed">
                <span>Paid Invoices</span>
                <strong>{countPaid}</strong>
              </div>
              <div className="rcp-chip chip-due">
                <span>Partial / Unpaid</span>
                <strong>{countPartial + countUnpaid}</strong>
              </div>
              {countAdv > 0 && (
                <div className="rcp-chip" style={{ background: '#e6fdf6', color: '#036b4e' }}>
                  <span>Advance Only</span>
                  <strong>{countAdv}</strong>
                </div>
              )}
            </div>

            {/* Status filter tabs */}
            <div className="rcp-filter-row">
              {[
                { label: 'All',     count: countAll,     key: 'All',     cls: 'rcp-tab-all' },
                { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'rcp-tab-paid' },
                { label: 'Partial', count: countPartial, key: 'Partial', cls: 'rcp-tab-partial' },
                { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'rcp-tab-unpaid' },
                { label: 'Advance', count: countAdv,     key: 'Advance', cls: 'rcp-tab-all' },
              ].map(tab => (
                <button key={tab.key}
                  className={`rcp-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(tab.key); setSelectedReceiptId(''); }}>
                  {tab.label}<span className="rcp-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Search filters */}
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
                {/* Detail card for selected receipt */}
                {selectedReceiptObj && (() => {
                  const advAmt     = getAdvanceForReceipt(selectedReceiptObj);
                  const hasAdv     = advAmt > 0;
                  const inv        = getPrimaryInvoice(selectedReceiptObj);
                  const invObj     = inv || invoices.find(i => i._id === getPrimaryInvoiceId(selectedReceiptObj));
                  const grandTotal = Number(invObj?.grandTotal || 0);
                  const balance    = getBalanceForReceipt(selectedReceiptObj);
                  const invNo      = getInvoiceNumber(selectedReceiptObj);
                  const isAdv      = isAdvanceReceipt(selectedReceiptObj);

                  return (
                    <div className="rcp-detail-card">
                      <div className="rcp-detail-header">
                        <div>
                          <span className="rcp-number-tag" style={{ marginRight: 10 }}>{selectedReceiptObj.receiptNumber}</span>
                          {!isAdv && (
                            <span className="inv-number-tag" style={{ marginRight: 10, background: '#f3e8ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>{invNo}</span>
                          )}
                          <span style={{ fontWeight: 700 }}>
                            {isAdv ? 'Advance Payment' : (invObj?.subject || '—')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {statusBadge(selectedReceiptObj)}
                          {hasAdv && (
                            <span className="advance-tag">💰 Advance Credit +₹{Number(advAmt).toLocaleString('en-IN')}</span>
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
                          {!isAdv && (
                            <div style={{ textAlign: 'right' }}>
                              <span className="inv-number-tag">{invNo}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!isAdv && (
                        <div className="rcp-balance-row" style={{ marginBottom: 14 }}>
                          <div className="rcp-balance-card rcp-bc-total">
                            <span>Invoice Total</span>
                            <strong>₹{Number(grandTotal).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="rcp-balance-card rcp-bc-paid">
                            <span>This Receipt</span>
                            <strong>₹{Number(selectedReceiptObj.paidAmountInReceipt).toLocaleString('en-IN')}</strong>
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
                            <span>Invoice Status</span>
                            <strong>{statusBadge(selectedReceiptObj)}</strong>
                          </div>
                        </div>
                      )}

                      {isAdv && (
                        <div className="rcp-balance-row" style={{ marginBottom: 14 }}>
                          <div className="rcp-balance-card rcp-bc-paid">
                            <span>Advance Paid</span>
                            <strong>₹{Number(selectedReceiptObj.paidAmountInReceipt).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="rcp-balance-card rcp-bc-due">
                            <span>Remaining (Unused)</span>
                            <strong>₹{Number(selectedReceiptObj.remainingAmount || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="rcp-balance-card rcp-bc-status">
                            <span>Type</span>
                            <strong><span className="status-badge status-advance">Advance</span></strong>
                          </div>
                        </div>
                      )}

                      {hasAdv && !isAdv && (
                        <div className="advance-note-bar" style={{ marginBottom: 14 }}>
                          <span>💰</span>
                          <span>
                            Invoice fully paid. Client paid an extra <strong>₹{Number(advAmt).toLocaleString('en-IN')}</strong> — recorded
                            as <strong>Advance Credit</strong> (remainingAmount on this receipt).
                          </span>
                        </div>
                      )}

                      <div className="inv-detail-grid">
                        {[
                          ['Receipt No',      selectedReceiptObj.receiptNumber],
                          ['Invoice No',      isAdv ? 'N/A (Advance)' : invNo],
                          ...(!isAdv ? [
                            ['Invoice Total', `₹${Number(grandTotal).toLocaleString('en-IN')}`],
                            ['Subject',       invObj?.subject || '—'],
                          ] : []),
                          ['Amount Paid',     `₹${Number(selectedReceiptObj.paidAmountInReceipt).toLocaleString('en-IN')}`],
                          ['Remaining Amount', `₹${Number(selectedReceiptObj.remainingAmount || 0).toLocaleString('en-IN')}`],
                          ...(!isAdv ? [
                            ['Balance', hasAdv ? '₹0 (Fully Paid)' : `₹${Number(balance).toLocaleString('en-IN')}`],
                            ...(hasAdv ? [['Advance Credit', `+₹${Number(advAmt).toLocaleString('en-IN')}`]] : []),
                          ] : []),
                          ['Payment Date',    selectedReceiptObj.paymentDate?.split('T')[0] || '—'],
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
                                k === 'Balance' && !hasAdv && balance > 0 ? { color: '#c93360' } :
                                k === 'Invoice No' && !isAdv ? { color: '#7c3aed', fontWeight: 700 } : {}
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
                            <button className="submit-btn rcp-submit" onClick={() => handlePrintReceipt(selectedReceiptObj)}>
                              🖨️ Print Receipt
                            </button>
                            <a href={selectedReceiptObj.receiptPdf} target="_blank" rel="noreferrer"
                              className="submit-btn rcp-pdf-btn" style={{ textDecoration: 'none' }}>
                              📄 Download PDF
                            </a>
                            <button className="submit-btn rcp-share-btn" onClick={() => handleShareReceipt(selectedReceiptObj)}>
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

                {/* Receipt list */}
                <div className="rcp-card-list">
                  {filteredReceipts.map(r => {
                    const isSel   = selectedReceiptId === r._id;
                    const advAmt  = getAdvanceForReceipt(r);
                    const hasAdv  = advAmt > 0;
                    const balance = getBalanceForReceipt(r);
                    const invNo   = getInvoiceNumber(r);
                    const isAdv   = isAdvanceReceipt(r);

                    return (
                      <div key={r._id}
                        className={`rcp-row-card ${isSel ? 'rcp-row-selected' : ''}`}
                        onClick={() => setSelectedReceiptId(isSel ? '' : r._id)}>

                        <div className="rcp-row-left">
                          <span className="rcp-number-tag">{r.receiptNumber}</span>
                          <div className="rcp-row-project">
                            {isAdv ? 'Advance Payment' : (getPrimaryInvoice(r)?.subject || invNo || '—')}
                          </div>
                          <div className="rcp-row-client">
                            {r.client?.name || '—'} &nbsp;·&nbsp;
                            <span style={{ color: '#7c3aed' }}>{r.client?.clientCode || ''}</span>
                          </div>
                        </div>

                        <div className="rcp-row-mid">
                          <div className="rcp-row-inv">
                            {isAdv
                              ? <span className="status-badge status-advance" style={{ fontSize: 11 }}>No Invoice</span>
                              : <span className="inv-number-tag">{invNo}</span>
                            }
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="rcp-row-amt">₹{Number(r.paidAmountInReceipt).toLocaleString('en-IN')}</span>
                            <span className="rcp-row-date">{r.paymentDate?.split('T')[0]}</span>
                            {isAdv ? (
                              <span className="rcp-advance-chip">💰 Advance (Unused: ₹{Number(r.remainingAmount || 0).toLocaleString('en-IN')})</span>
                            ) : hasAdv ? (
                              <span className="rcp-advance-chip">💰 Credit +₹{Number(advAmt).toLocaleString('en-IN')}</span>
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
                                <button className="rcp-action-btn rcp-print" title="Print" onClick={() => handlePrintReceipt(r)}>🖨️</button>
                                <a href={r.receiptPdf} target="_blank" rel="noreferrer"
                                  className="rcp-action-btn rcp-pdf" title="Download PDF" style={{ textDecoration: 'none' }}>📄</a>
                                <button className="rcp-action-btn rcp-share" title="Share" onClick={() => handleShareReceipt(r)}>🔗</button>
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