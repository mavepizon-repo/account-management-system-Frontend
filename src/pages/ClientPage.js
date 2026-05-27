import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/Clientpage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const EMPTY_FORM = { name: '', phone: '', address: '', contactPerson: '', gstnumber: '', emailid: '' };

// ─────────────────────────────────────────────────────────────
// Receipt model: appliedInvoices: [{invoice, usedAmount}]
// A pure advance receipt has appliedInvoices = []
// ─────────────────────────────────────────────────────────────
const isAdvanceReceipt = (r) => !r.appliedInvoices || r.appliedInvoices.length === 0;

/* ── Searchable Dropdown ─────────────────────────────────────── */
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
            <button className="sd-clear" type="button"
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

/* ── Edit Modal ──────────────────────────────────────────────── */
function EditModal({ client, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    name:          client.name          || '',
    phone:         client.phone         || '',
    address:       client.address       || '',
    contactPerson: client.contactPerson || '',
    gstnumber:     client.gstnumber     || '',
    emailid:       client.emailid       || '',
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return;
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="client-code-tag" style={{ marginRight: 10 }}>{client.clientCode}</span>
            <span className="modal-title">Edit Client</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-form-grid">
            <div className="form-field">
              <label className="field-label">Client Name *</label>
              <input className="field-input" placeholder="Full name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label className="field-label">Phone Number *</label>
              <input className="field-input" placeholder="10 digit number" maxLength={10} value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} required />
            </div>
            <div className="form-field">
              <label className="field-label">Contact Person</label>
              <input className="field-input" placeholder="Contact person name" value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Email ID</label>
              <input className="field-input" type="email" placeholder="email@example.com" value={form.emailid}
                onChange={e => setForm(f => ({ ...f, emailid: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">GST Number</label>
              <input className="field-input" placeholder="22AAAAA0000A1Z5" maxLength={15} value={form.gstnumber}
                onChange={e => setForm(f => ({ ...f, gstnumber: e.target.value.toUpperCase() }))} />
            </div>
            <div className="form-field full-width">
              <label className="field-label">Address *</label>
              <textarea className="field-input" rows={3} placeholder="Full address" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-cancel-btn" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="submit-btn" disabled={loading}
              style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)', margin: 0 }}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Excel export ────────────────────────────────────────────── */
function exportClientsToExcel(clients, invoices, receipts) {
  const getStats = (clientId) => {
    const invs = invoices.filter(inv => {
      const c = inv.client;
      if (!c) return false;
      return typeof c === 'object' ? c._id === clientId : c === clientId;
    });
    const totalBilled   = invs.reduce((s, i) => s + (i.grandTotal  || 0), 0);
    const totalReceived = invs.reduce((s, i) => s + (i.cumulativePaidAmount  || 0), 0);

    // Advance receipts for this client (not linked to any invoice)
    const advanceRcpts = receipts.filter(r => {
      const rClientId = r.client?._id || (typeof r.client === 'string' ? r.client : null);
      return rClientId === clientId && isAdvanceReceipt(r);
    });
    const totalAdvance = advanceRcpts.reduce((s, r) => s + (r.paidAmountInReceipt || 0), 0);
    const unusedAdvance = advanceRcpts.reduce((s, r) => s + (r.remainingAmount || 0), 0);

    const outstanding = totalBilled - totalReceived - unusedAdvance;
    return { count: invs.length, totalBilled, totalReceived, totalAdvance, unusedAdvance, outstanding };
  };
  
  const headers = [
    'Client Code','Name','Contact Person','Phone','Email','GST Number',
    'Address','Total Invoices','Total Billed (₹)','Total Received (₹)',
    'Advance (Unused) (₹)','Outstanding (₹)'
  ];
  
  const rows = clients.map(c => {
    const s = getStats(c._id);
    return [
      c.clientCode, c.name, c.contactPerson || '', c.phone, c.emailid || '',
      c.gstnumber || '', c.address, s.count, s.totalBilled, s.totalReceived,
      s.unusedAdvance, s.outstanding
    ];
  });
  
  const escape     = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `clients_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
function ClientPage({ onLogout }) {
  const navigate = useNavigate();
  const [clients,  setClients]  = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]); // ← NEW: fetch all receipts
  const [activePanel, setPanel] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  /* ── Add form ── */
  const [addForm, setAddForm] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('client_addForm')) || EMPTY_FORM; }
    catch { return EMPTY_FORM; }
  });
  useEffect(() => { sessionStorage.setItem('client_addForm', JSON.stringify(addForm)); }, [addForm]);

  /* ── Update panel ── */
  const [updateClientId, setUpdateClientId] = useState('');
  const [updateFound,    setUpdateFound]    = useState(null);
  const [updateForm,     setUpdateForm]     = useState(EMPTY_FORM);

  /* ── Delete panel ── */
  const [deleteClientId,    setDeleteClientId]    = useState('');
  const [deleteFound,       setDeleteFound]       = useState(null);
  const [deletePreview,     setDeletePreview]     = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  /* ── Get All panel ── */
  const [statusFilter,      setStatusFilter]      = useState('All');
  const [getallSearch,      setGetallSearch]      = useState('');
  const [selectedClientId,  setSelectedClientId]  = useState('');
  const [selectedClientObj, setSelectedClientObj] = useState(null);

  /* ── Modal edit state ── */
  const [modalClient,  setModalClient]  = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ message: msg, type });
  }, []);

  /* ── Data fetch ── */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/client/getall`);
      const data = await response.json();
      setClients(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Fetch clients error:', error);
      showToast('Failed to fetch clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/invoice/getall`);
      const data = await response.json();
      setInvoices(data.data || []);
    } catch (error) {
      console.error('Fetch invoices error:', error);
    }
  };

  // ── NEW: fetch all receipts so we can include advance amounts in client stats ──
  const fetchReceipts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/receipt/getall`);
      const data = await response.json();
      setReceipts(data.receipts || []);
    } catch (error) {
      console.error('Fetch receipts error:', error);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchInvoices();
    fetchReceipts(); // ← NEW
  }, []);

  /* ── Stats helpers ── */
  const getClientInvoices = (clientId) => {
    return invoices.filter(inv => {
      const c = inv.client;
      if (!c) return false;
      return typeof c === 'object' ? c._id === clientId : c === clientId;
    });
  };

  // ── NEW: get advance receipts for a client (pure advance, no invoice linked) ──
  const getClientAdvanceReceipts = (clientId) => {
    return receipts.filter(r => {
      const rClientId = r.client?._id || (typeof r.client === 'string' ? r.client : null);
      return rClientId === clientId && isAdvanceReceipt(r);
    });
  };

  // ── UPDATED: getClientStats now includes advance receipt data ──
  const getClientStats = (clientId) => {
    const invs          = getClientInvoices(clientId);
    const totalBilled   = invs.reduce((s, i) => s + (i.grandTotal || 0), 0);
    // totalReceived from invoices = how much has been applied to invoices (includes advance auto-applied)
    const totalReceivedFromInvoices = invs.reduce((s, i) => s + (i.cumulativePaidAmount || 0), 0);

    // Advance receipts: paid but not yet linked to any invoice
    const advanceRcpts  = getClientAdvanceReceipts(clientId);
    const totalAdvancePaid   = advanceRcpts.reduce((s, r) => s + (r.paidAmountInReceipt || 0), 0);
    const unusedAdvance = advanceRcpts.reduce((s, r) => s + (r.remainingAmount || 0), 0);

    // Total received = money applied to invoices + unused advance sitting with client
    const totalReceived = totalReceivedFromInvoices + unusedAdvance;

    // Outstanding = what client still owes (billed - what's been paid toward invoices - unused advance credit)
    const outstanding   = totalBilled - totalReceivedFromInvoices - unusedAdvance;

    return {
      count: invs.length,
      totalBilled,
      totalReceivedFromInvoices,
      totalAdvancePaid,
      unusedAdvance,
      totalReceived,
      outstanding,
      invs,
      advanceRcpts,
    };
  };

  const getFilteredClients = () => {
    let list = clients;
    if (getallSearch.trim()) {
      const q = getallSearch.toLowerCase();
      list = list.filter(c =>
        c.clientCode?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.emailid?.toLowerCase().includes(q) ||
        c.gstnumber?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'All') return list;
    return list.filter(c => {
      const s = getClientStats(c._id);
      if (statusFilter === 'Paid')    return s.outstanding <= 0 && (s.count > 0 || s.totalAdvancePaid > 0);
      if (statusFilter === 'Partial') return s.outstanding > 0 && s.totalReceived > 0;
      if (statusFilter === 'Unpaid')  return s.totalReceived === 0 && s.count > 0;
      if (statusFilter === 'Advance') return s.unusedAdvance > 0 && s.count === 0;
      return true;
    });
  };

  /* ── Panel toggle ── */
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setUpdateClientId(''); setUpdateForm(EMPTY_FORM); setUpdateFound(null);
    setDeleteClientId(''); setDeleteFound(null); setDeletePreview(null); setDeleteConfirmText('');
    setSelectedClientId(''); setSelectedClientObj(null);
    setStatusFilter('All'); setGetallSearch('');
    setModalClient(null);
  };

  /* ── ADD ── */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.phone || !addForm.address) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/client/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await response.json();
      if (response.ok) {
        await fetchClients();
        setAddForm(EMPTY_FORM);
        sessionStorage.removeItem('client_addForm');
        showToast(`${data.name} added successfully!`);
      } else {
        showToast(data.message || 'Failed to add client', 'error');
      }
    } catch (error) {
      console.error('Add client error:', error);
      showToast('Error adding client', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── UPDATE panel ── */
  const handleUpdateSelect = (clientId) => {
    setUpdateClientId(clientId);
    const found = clients.find(c => c._id === clientId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        name: found.name, phone: found.phone, address: found.address,
        contactPerson: found.contactPerson || '', gstnumber: found.gstnumber || '', emailid: found.emailid || '',
      });
    } else {
      setUpdateFound(null);
      setUpdateForm(EMPTY_FORM);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a client', 'error'); return; }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/client/edit/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });
      if (response.ok) {
        await fetchClients();
        showToast(`${updateForm.name} updated successfully!`);
        setUpdateFound(null); setUpdateClientId(''); setUpdateForm(EMPTY_FORM);
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to update client', 'error');
      }
    } catch (error) {
      console.error('Update client error:', error);
      showToast('Error updating client', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════════════════
     DELETE CLIENT — Cascade
  ══════════════════════════════════════════════════════ */
  const handleDeleteSelect = async (clientId) => {
    setDeleteClientId(clientId);
    setDeleteConfirmText('');
    const found = clients.find(c => c._id === clientId);
    setDeleteFound(found || null);

    if (!found) { setDeletePreview(null); return; }

    try {
      const [invRes, rcptRes] = await Promise.all([
        fetch(`${API_BASE_URL}/invoice/getall`),
        fetch(`${API_BASE_URL}/receipt/getall`),
      ]);
      const invData  = await invRes.json();
      const rcptData = await rcptRes.json();

      const allInvoices = invData.data || [];
      const allReceipts = rcptData.receipts || [];

      const clientInvoices = allInvoices.filter(inv => {
        const c = inv.client;
        if (!c) return false;
        return typeof c === 'object' ? c._id === clientId : c === clientId;
      });
      const clientInvoiceIds = new Set(clientInvoices.map(i => i._id));

      const advanceReceipts = allReceipts.filter(r => {
        const rClientId = r.client?._id || (typeof r.client === 'string' ? r.client : null);
        return rClientId === clientId && isAdvanceReceipt(r);
      });

      const invoiceLinkedReceipts = allReceipts.filter(r => {
        if (isAdvanceReceipt(r)) return false;
        const rClientId = r.client?._id || (typeof r.client === 'string' ? r.client : null);
        if (rClientId !== clientId) return false;
        return (r.appliedInvoices || []).some(entry => {
          const invId = entry.invoice?._id || (typeof entry.invoice === 'string' ? entry.invoice : null);
          return invId && clientInvoiceIds.has(invId);
        });
      });

      const totalAdvance = advanceReceipts.reduce((s, r) => s + (r.remainingAmount || 0), 0);

      setDeletePreview({
        invoiceCount:          clientInvoices.length,
        advanceReceiptCount:   advanceReceipts.length,
        invoiceReceiptCount:   invoiceLinkedReceipts.length,
        totalReceiptCount:     advanceReceipts.length + invoiceLinkedReceipts.length,
        totalAdvance,
        advanceReceipts,
        clientInvoices,
      });
    } catch (err) {
      console.error('Preview fetch error:', err);
      setDeletePreview({ invoiceCount: '?', totalReceiptCount: '?', advanceReceiptCount: 0, invoiceReceiptCount: 0, totalAdvance: 0, advanceReceipts: [], clientInvoices: [] });
    }
  };

  /* ── Cascade Delete ── */
  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a client', 'error'); return; }

    if (deletePreview && (deletePreview.invoiceCount > 0 || deletePreview.totalReceiptCount > 0)) {
      if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
        showToast('Type "delete" to confirm cascade deletion', 'error');
        return;
      }
    }

    try {
      setLoading(true);
      const clientId = deleteFound._id;

      const [invRes, rcptRes] = await Promise.all([
        fetch(`${API_BASE_URL}/invoice/getall`),
        fetch(`${API_BASE_URL}/receipt/getall`),
      ]);
      const allInvoices = (await invRes.json()).data || [];
      const allReceipts = (await rcptRes.json()).receipts || [];

      const clientInvoices = allInvoices.filter(inv => {
        const c = inv.client;
        if (!c) return false;
        return typeof c === 'object' ? c._id === clientId : c === clientId;
      });

      const advanceReceipts = allReceipts.filter(r => {
        const rClientId = r.client?._id || (typeof r.client === 'string' ? r.client : null);
        return rClientId === clientId && isAdvanceReceipt(r);
      });

      let rcptDeleteErrors = 0;
      for (const rcpt of advanceReceipts) {
        const res = await fetch(`${API_BASE_URL}/receipt/delete/${rcpt._id}`, { method: 'DELETE' });
        if (!res.ok) rcptDeleteErrors++;
      }

      let invoiceRcptErrors = 0;
      for (const inv of clientInvoices) {
        const invRes = await fetch(`${API_BASE_URL}/invoice/delete/${inv._id}`, { method: 'DELETE' });
        if (!invRes.ok) {
          const d = await invRes.json();
          console.warn(`Invoice ${inv.invoiceNumber} delete issue:`, d.message);
          invoiceRcptErrors++;
        }
      }

      const clientRes = await fetch(`${API_BASE_URL}/client/delete/${clientId}`, { method: 'DELETE' });

      if (clientRes.ok) {
        await fetchClients();
        await fetchInvoices();
        await fetchReceipts(); // ← NEW

        let msg = `${deleteFound.name} deleted successfully!`;
        if (advanceReceipts.length > 0) {
          msg += ` (${advanceReceipts.length} advance receipt${advanceReceipts.length !== 1 ? 's' : ''} removed)`;
        }
        if (clientInvoices.length > 0) {
          msg += ` (${clientInvoices.length} invoice${clientInvoices.length !== 1 ? 's' : ''} removed)`;
        }
        if (invoiceRcptErrors > 0) {
          msg += ` ⚠️ ${invoiceRcptErrors} invoice(s) could not be deleted (had payments). Delete those invoices manually first.`;
        }

        showToast(msg, 'info');
        setDeleteFound(null);
        setDeleteClientId('');
        setDeletePreview(null);
        setDeleteConfirmText('');
      } else {
        const data = await clientRes.json();
        showToast(data.message || 'Failed to delete client', 'error');
      }
    } catch (error) {
      console.error('Cascade delete error:', error);
      showToast('Error during cascade delete', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── MODAL EDIT ── */
  const openModalEdit = (e, client) => {
    e.preventDefault();
    e.stopPropagation();
    setModalClient(client);
  };

  const handleModalSave = async (formData) => {
    if (!modalClient) return;
    try {
      setModalLoading(true);
      const response = await fetch(`${API_BASE_URL}/client/edit/${modalClient._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        await fetchClients();
        showToast(`${formData.name} updated successfully!`);
        if (selectedClientId === modalClient._id) {
          const updatedClients = await fetch(`${API_BASE_URL}/client/getall`);
          const data = await updatedClients.json();
          const clientsList = Array.isArray(data) ? data : (data.data || []);
          const updated = clientsList.find(c => c._id === modalClient._id);
          if (updated) setSelectedClientObj(updated);
        }
        setModalClient(null);
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to update client', 'error');
      }
    } catch (error) {
      console.error('Modal save error:', error);
      showToast('Error updating client', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  /* ── Row click ── */
  const handleRowClick = (client) => {
    if (modalClient) return;
    if (selectedClientId === client._id) {
      setSelectedClientId(''); setSelectedClientObj(null);
    } else {
      setSelectedClientId(client._id); setSelectedClientObj(client);
    }
  };

  /* ── Display helpers ── */
  const outstandingDisplay = (outstanding) => {
    if (outstanding < 0)  return <span className="outstanding-zero">+₹{Number(Math.abs(outstanding)).toLocaleString('en-IN')}</span>;
    if (outstanding === 0) return <span className="outstanding-zero">₹0</span>;
    return <span className="outstanding-due">₹{Number(outstanding).toLocaleString('en-IN')}</span>;
  };

  const statusBadge = (status) => {
    const map = { Paid: 'status-paid', Partial: 'status-partial', Unpaid: 'status-pending' };
    return <span className={`status-badge ${map[status] || 'status-pending'}`}>{status}</span>;
  };

  /* ── Shared form fields ── */
  const renderFormFields = (form, setForm) => (
    <div className="form-row">
      <div className="form-field">
        <label className="field-label">Client Name *</label>
        <input className="field-input" placeholder="Enter full name" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="form-field">
        <label className="field-label">Phone Number *</label>
        <input className="field-input" placeholder="10 digit number" maxLength={10} value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} required />
      </div>
      <div className="form-field">
        <label className="field-label">Contact Person</label>
        <input className="field-input" placeholder="Contact person name" value={form.contactPerson}
          onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="field-label">Email ID</label>
        <input className="field-input" type="email" placeholder="email@example.com" value={form.emailid}
          onChange={e => setForm({ ...form, emailid: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="field-label">GST Number</label>
        <input className="field-input" placeholder="22AAAAA0000A1Z5" maxLength={15} value={form.gstnumber}
          onChange={e => setForm({ ...form, gstnumber: e.target.value.toUpperCase() })} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Address *</label>
        <textarea className="field-input" placeholder="Enter full address" value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })} required />
      </div>
    </div>
  );

  /* ── Derived counts ── */
  const filteredClients  = getFilteredClients();
  const profileStats     = selectedClientObj ? getClientStats(selectedClientObj._id) : null;
  const countAll     = clients.length;
  const countPaid    = clients.filter(c => { const s = getClientStats(c._id); return s.outstanding <= 0 && (s.count > 0 || s.totalAdvancePaid > 0); }).length;
  const countPartial = clients.filter(c => { const s = getClientStats(c._id); return s.outstanding > 0 && s.totalReceived > 0; }).length;
  const countUnpaid  = clients.filter(c => { const s = getClientStats(c._id); return s.totalReceived === 0 && s.count > 0; }).length;
  const countAdvance = clients.filter(c => { const s = getClientStats(c._id); return s.unusedAdvance > 0 && s.count === 0; }).length;

  const hasCascadeData = deletePreview && (deletePreview.invoiceCount > 0 || deletePreview.totalReceiptCount > 0);

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">Client Management</h1>
          <span className="entity-page-badge" style={{ background: '#eef1ff', color: 'var(--primary)', border: '1px solid #c8d4ff' }}>
            {clients.length} Clients
          </span>
        </div>

        <div className="action-cards-grid">
          <div
            className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.ADD)}
          >
            <div className="action-card-icon">➕</div>
            <div className="action-card-title">Add Client</div>
            <div className="action-card-desc">Add a new client record</div>
          </div>

          <div
            className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.UPDATE)}
          >
            <div className="action-card-icon">✏️</div>
            <div className="action-card-title">Update Client</div>
            <div className="action-card-desc">Edit existing client info</div>
          </div>

          <div
            className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.GETALL)}
          >
            <div className="action-card-icon">📋</div>
            <div className="action-card-title">Get All Clients</div>
            <div className="action-card-desc">View all client records</div>
          </div>
          <div
            className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.DELETE)}
          >
            <div className="action-card-icon">🗑️</div>
            <div className="action-card-title">Delete Client</div>
            <div className="action-card-desc">Remove a client record</div>
          </div>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ══ ADD CLIENT ══ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Client</div>
            <form onSubmit={handleAdd}>
              {renderFormFields(addForm, setAddForm)}
              <button type="submit" className="submit-btn" disabled={loading}>Add Client</button>
            </form>
          </div>
        )}

        {/* ══ UPDATE CLIENT ══ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Client</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search &amp; Select Client *</label>
              <SearchableDropdown
                options={clients} value={updateClientId} onChange={handleUpdateSelect}
                placeholder="Type name, code or phone to search..."
                getLabel={c => `${c.clientCode} — ${c.name} (${c.phone})`}
                getId={c => c._id}
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.clientCode}</span>
                  <span className="update-found-name">{updateFound.name}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  {renderFormFields(updateForm, setUpdateForm)}
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Client
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE CLIENT ══ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Client</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Search &amp; Select Client *</label>
              <SearchableDropdown
                options={clients} value={deleteClientId} onChange={handleDeleteSelect}
                placeholder="Type name, code or phone to search..."
                getLabel={c => `${c.clientCode} — ${c.name} (${c.phone})`}
                getId={c => c._id}
              />
            </div>

            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Client Code',    deleteFound.clientCode],
                  ['Name',           deleteFound.name],
                  ['Contact Person', deleteFound.contactPerson || '—'],
                  ['Phone',          deleteFound.phone],
                  ['Email',          deleteFound.emailid || '—'],
                  ['GST Number',     deleteFound.gstnumber || '—'],
                  ['Address',        deleteFound.address],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}

                {deletePreview === null && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8faff', borderRadius: 8, fontSize: 13, color: '#666' }}>
                    ⏳ Loading linked data...
                  </div>
                )}

                {deletePreview && (
                  <div style={{ marginTop: 14 }}>
                    {deletePreview.invoiceCount === 0 && deletePreview.totalReceiptCount === 0 && (
                      <div style={{ padding: '10px 14px', background: '#e6fdf6', borderRadius: 8, border: '1px solid #a0f0d8', fontSize: 13, color: '#036b4e', fontWeight: 600 }}>
                        ✅ This client has no linked invoices or receipts. Safe to delete.
                      </div>
                    )}

                    {(deletePreview.invoiceCount > 0 || deletePreview.totalReceiptCount > 0) && (
                      <div style={{ padding: '14px 16px', background: '#fff4f7', borderRadius: 10, border: '1.5px solid #ffc8d4' }}>
                        <div style={{ fontWeight: 700, color: '#c93360', fontSize: 14, marginBottom: 10 }}>
                          ⚠️ Cascade Delete Warning
                        </div>

                        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, marginBottom: 12 }}>
                          Deleting <strong>{deleteFound.name}</strong> will permanently remove:
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                          {deletePreview.invoiceCount > 0 && (
                            <div style={{ padding: '8px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ffc8d4', fontSize: 13, fontWeight: 700, color: '#c93360' }}>
                              🧾 {deletePreview.invoiceCount} Invoice{deletePreview.invoiceCount !== 1 ? 's' : ''}
                            </div>
                          )}
                          {deletePreview.advanceReceiptCount > 0 && (
                            <div style={{ padding: '8px 14px', background: '#fff', borderRadius: 8, border: '1px solid #ffc8d4', fontSize: 13, fontWeight: 700, color: '#c93360' }}>
                              💰 {deletePreview.advanceReceiptCount} Advance Receipt{deletePreview.advanceReceiptCount !== 1 ? 's' : ''}
                            </div>
                          )}
                          {deletePreview.invoiceReceiptCount > 0 && (
                            <div style={{ padding: '8px 14px', background: '#fff8e6', borderRadius: 8, border: '1px solid #ffe08a', fontSize: 13, fontWeight: 700, color: '#7a5000' }}>
                              🧾 {deletePreview.invoiceReceiptCount} Invoice Receipt{deletePreview.invoiceReceiptCount !== 1 ? 's' : ''} (unlinked by invoice delete)
                            </div>
                          )}
                          {deletePreview.totalAdvance > 0 && (
                            <div style={{ padding: '8px 14px', background: '#fff8e6', borderRadius: 8, border: '1px solid #ffe08a', fontSize: 13, fontWeight: 700, color: '#7a5000' }}>
                              💰 ₹{Number(deletePreview.totalAdvance).toLocaleString('en-IN')} Advance
                            </div>
                          )}
                        </div>

                        {deletePreview.invoiceReceiptCount > 0 && (
                          <div style={{ padding: '10px 12px', background: '#f8faff', borderRadius: 8, border: '1px solid #c8d4ff', fontSize: 12, color: '#555', marginBottom: 12 }}>
                            ℹ️ Invoice-linked receipts cannot be deleted directly. They will be unlinked when their invoices are deleted.
                          </div>
                        )}

                        <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
                          This action <strong>cannot be undone</strong>.
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
                  style={{ marginTop: 16, opacity: (hasCascadeData && deleteConfirmText.trim().toLowerCase() !== 'delete') ? 0.5 : 1 }}
                  onClick={handleDelete}
                  disabled={loading || (hasCascadeData && deleteConfirmText.trim().toLowerCase() !== 'delete')}
                >
                  {hasCascadeData ? '🗑️ Cascade Delete Client + All Data' : 'Confirm Delete'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ GET ALL CLIENTS ══ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="getall-header-row">
              <div className="panel-title" style={{ margin: 0 }}>All Clients</div>
              <button className="excel-export-btn"
                onClick={() => exportClientsToExcel(filteredClients, invoices, receipts)}
                title="Download as CSV">
                <span>⬇</span> Export CSV
              </button>
            </div>

            <div className="form-field" style={{ marginBottom: 16, marginTop: 16 }}>
              <input className="field-input"
                placeholder="🔍 Search by name, code, phone, email or GST..."
                value={getallSearch}
                onChange={e => { setGetallSearch(e.target.value); setSelectedClientId(''); setSelectedClientObj(null); }} />
            </div>

            <div className="inv-status-filter-row" style={{ marginBottom: 22 }}>
              {[
                { label: 'All',     count: countAll,     key: 'All',     cls: 'filter-all' },
                { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'filter-paid' },
                { label: 'Partial', count: countPartial, key: 'Partial', cls: 'filter-partial' },
                { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'filter-unpaid' },
                ...(countAdvance > 0 ? [{ label: 'Advance Only', count: countAdvance, key: 'Advance', cls: 'filter-all' }] : []),
              ].map(tab => (
                <button key={tab.key}
                  className={`inv-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(tab.key); setSelectedClientId(''); setSelectedClientObj(null); }}>
                  {tab.label}<span className="inv-filter-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {filteredClients.length === 0
              ? <div className="empty-state"><div className="empty-icon">📭</div><p>No clients found.</p></div>
              : (
                <>
                  {selectedClientObj && profileStats && (
                    <div className="client-profile-card">
                      <div className="cp-header">
                        <div className="cp-avatar">{selectedClientObj.name.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div className="cp-name">{selectedClientObj.name}</div>
                          <div className="cp-meta">{selectedClientObj.clientCode} &nbsp;·&nbsp; {selectedClientObj.phone}</div>
                          {selectedClientObj.emailid && (
                            <div className="cp-meta" style={{ color: 'var(--text-secondary)' }}>{selectedClientObj.emailid}</div>
                          )}
                          <div className="cp-address">{selectedClientObj.address}</div>
                          {(selectedClientObj.contactPerson || selectedClientObj.gstnumber) && (
                            <div className="cp-extra-info">
                              {selectedClientObj.contactPerson && <span className="cp-extra-chip">👤 {selectedClientObj.contactPerson}</span>}
                              {selectedClientObj.gstnumber && <span className="cp-extra-chip">🧾 GST: {selectedClientObj.gstnumber}</span>}
                            </div>
                          )}
                        </div>
                        <button className="cp-edit-btn" onClick={e => openModalEdit(e, selectedClientObj)} title="Edit this client" type="button">✏️ Edit</button>
                        <button className="cp-close-btn" onClick={() => { setSelectedClientId(''); setSelectedClientObj(null); }} type="button">✕</button>
                      </div>

                      {/* ── UPDATED stats row: shows advance receipts too ── */}
                      <div className="cp-stats-row">
                        <div className="cp-stat cp-stat-total">
                          <span>Total Invoices</span>
                          <strong>{profileStats.count}</strong>
                        </div>
                        <div className="cp-stat cp-stat-billed">
                          <span>Total Billed</span>
                          <strong>₹{profileStats.totalBilled.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="cp-stat cp-stat-received">
                          <span>Total Received</span>
                          <strong>₹{profileStats.totalReceived.toLocaleString('en-IN')}</strong>
                        </div>
                        {/* Show unused advance separately if client has advance receipts */}
                        {profileStats.unusedAdvance > 0 && (
                          <div className="cp-stat" style={{ background: 'linear-gradient(135deg,#e6fdf6,#f0fdf9)', border: '1.5px solid #a0f0d8' }}>
                            <span style={{ color: '#036b4e' }}>Advance (Unused)</span>
                            <strong style={{ color: '#036b4e' }}>₹{profileStats.unusedAdvance.toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                        <div className="cp-stat cp-stat-due">
                          <span>Outstanding</span>
                          <strong>
                            {profileStats.outstanding < 0
                              ? `+₹${Math.abs(profileStats.outstanding).toLocaleString('en-IN')}`
                              : `₹${profileStats.outstanding.toLocaleString('en-IN')}`}
                          </strong>
                        </div>
                      </div>

                      {/* ── Advance receipts section (shown when client has advance receipts) ── */}
                      {profileStats.advanceRcpts.length > 0 && (
                        <>
                          <div className="cp-section-title" style={{ marginTop: 16 }}>
                            💰 Advance Receipts
                          </div>
                          <div className="cp-invoice-table-wrap">
                            <table className="clients-table cp-invoice-table">
                              <thead>
                                <tr>
                                  <th>Receipt No</th>
                                  <th>Date</th>
                                  <th>Amount Paid</th>
                                  <th>Remaining (Unused)</th>
                                  <th>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {profileStats.advanceRcpts.map(r => (
                                  <tr key={r._id}>
                                    <td>
                                      <span className="client-code-tag" style={{ background: '#e6fdf6', color: '#036b4e', borderColor: '#a0f0d8' }}>
                                        {r.receiptNumber}
                                      </span>
                                    </td>
                                    <td>{r.paymentDate?.split('T')[0] || '—'}</td>
                                    <td className="paid-cell">₹{Number(r.paidAmountInReceipt || 0).toLocaleString('en-IN')}</td>
                                    <td>
                                      {Number(r.remainingAmount || 0) > 0
                                        ? <span style={{ fontWeight: 700, color: '#036b4e' }}>₹{Number(r.remainingAmount).toLocaleString('en-IN')}</span>
                                        : <span style={{ color: '#aaa' }}>₹0 (Used)</span>
                                      }
                                    </td>
                                    <td style={{ color: '#666', fontSize: 12 }}>{r.description || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}

                      <div className="cp-section-title">Client Details</div>
                      <div className="cp-detail-grid">
                        {[
                          ['Client Code', selectedClientObj.clientCode],
                          ['Name',        selectedClientObj.name],
                          ['Contact Person', selectedClientObj.contactPerson || '—'],
                          ['Phone',       selectedClientObj.phone],
                          ['Email',       selectedClientObj.emailid || '—'],
                          ['GST Number',  selectedClientObj.gstnumber || '—'],
                          ['Address',     selectedClientObj.address],
                        ].map(([k, v]) => (
                          <div className="cp-detail-item" key={k}>
                            <span className="cp-detail-key">{k}</span>
                            <span className="cp-detail-val">{v}</span>
                          </div>
                        ))}
                      </div>

                      {profileStats.invs.length > 0 ? (
                        <>
                          <div className="cp-section-title" style={{ marginTop: 20 }}>Invoice List &amp; Payment History</div>
                          <div className="cp-invoice-table-wrap">
                            <table className="clients-table cp-invoice-table">
                              <thead>
                                <tr>
                                  <th>Inv No</th><th>Date</th><th>Subject</th>
                                  <th>Grand Total</th><th>Paid</th><th>Balance</th>
                                  <th>Status</th><th>Print</th>
                                </tr>
                              </thead>
                              <tbody>
                                {profileStats.invs.map(inv => {
                                  const balance = Math.max(0, (inv.grandTotal || 0) - (inv.cumulativePaidAmount || 0));
                                  return (
                                    <tr key={inv._id}>
                                      <td>
                                        <span className="client-code-tag" style={{ background: '#fffbe8', color: '#7a5000', borderColor: '#ffe08a' }}>
                                          {inv.invoiceNumber}
                                        </span>
                                      </td>
                                      <td>{inv.date?.split('T')[0]}</td>
                                      <td style={{ fontWeight: 600 }}>{inv.subject}</td>
                                      <td className="amt-cell">₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')}</td>
                                      <td className="paid-cell">₹{Number(inv.cumulativePaidAmount || 0).toLocaleString('en-IN')}</td>
                                      <td className={balance > 0 ? 'due-cell' : 'zero-cell'}>₹{Number(balance).toLocaleString('en-IN')}</td>
                                      <td>{statusBadge(inv.paymentStatus)}</td>
                                      <td>
                                        <button className="inv-print-btn" type="button"
                                          onClick={() => {
                                            const items = Array.isArray(inv.products) && inv.products.length > 0 ? inv.products : [];
                                            const itemRows = items.map((it, i) =>
                                              `<tr><td>${i+1}</td><td>${it.description||''}</td><td>${it.quantity??''}</td><td>₹${Number(it.rate||0).toLocaleString('en-IN')}</td><td>₹${Number(it.amount||0).toLocaleString('en-IN')}</td><td>${it.gst||0}%</td><td>₹${Number(it.gstAmount||0).toLocaleString('en-IN')}</td><td>₹${Number(it.netTotal||0).toLocaleString('en-IN')}</td></tr>`
                                            ).join('');
                                            const w = window.open('', '_blank', 'width=800,height=600');
                                            w.document.write(`<html><head><title>Invoice</title><style>body{font-family:Arial;padding:40px;color:#1e2a4a;}table{width:100%;border-collapse:collapse;margin-top:20px;}th{background:#5b7fff;color:white;padding:10px 14px;}td{padding:10px 14px;border-bottom:1px solid #e4eaf8;}.tr td{font-weight:bold;background:#f4f7ff;}</style></head><body><h2 style="color:#5b7fff">Tax Invoice</h2><p><strong>Invoice No:</strong> ${inv.invoiceNumber}</p><p><strong>Client:</strong> ${selectedClientObj.name} (${selectedClientObj.clientCode})</p><p><strong>Date:</strong> ${inv.date?.split('T')[0]}</p><p><strong>Subject:</strong> ${inv.subject||''}</p><table><thead><tr><th>S.No</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th>GST%</th><th>GST Amt</th><th>Net Amt</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr class="tr"><td colspan="7">Grand Total</td><td>₹${Number(inv.grandTotal||0).toLocaleString('en-IN')}</td></tr><tr><td colspan="7">Paid</td><td>₹${Number(inv.cumulativePaidAmount||0).toLocaleString('en-IN')}</td></tr><tr class="tr"><td colspan="7">Balance Due</td><td>₹${Number(balance).toLocaleString('en-IN')}</td></tr></tfoot></table></body></html>`);
                                            w.document.close();
                                            w.print();
                                          }}>
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
                      ) : (
                        profileStats.advanceRcpts.length === 0 && (
                          <div className="cp-no-invoices">No invoices found for this client.</div>
                        )
                      )}
                    </div>
                  )}

                  <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1.5px solid #dde5f8' }}>
                    <table className="clients-table">
                      <thead>
                        <tr>
                          <th>Client Code</th><th>Name</th><th>Contact Person</th>
                          <th>Phone</th><th>Email</th><th>GST</th>
                          <th>Invoices</th><th>Total Received</th><th>Outstanding</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map(c => {
                          const stats = getClientStats(c._id);
                          const isSel = selectedClientId === c._id;
                          return (
                            <tr key={c._id}
                              className={isSel ? 'client-row-selected' : ''}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleRowClick(c)}>
                              <td><span className="client-code-tag">{c.clientCode}</span></td>
                              <td style={{ fontWeight: 600 }}>{c.name}</td>
                              <td>{c.contactPerson || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                              <td>{c.phone}</td>
                              <td>{c.emailid || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                              <td>{c.gstnumber ? <span className="gst-tag">{c.gstnumber}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                              <td><span className="invoices-count-badge">{stats.count}</span></td>
                              <td>
                                {/* Show advance badge if client has unused advance */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontWeight: 600, color: '#036b4e' }}>
                                    ₹{Number(stats.totalReceived).toLocaleString('en-IN')}
                                  </span>
                                  {stats.unusedAdvance > 0 && (
                                    <span style={{ fontSize: 11, color: '#036b4e', background: '#e6fdf6', borderRadius: 4, padding: '1px 6px', border: '1px solid #a0f0d8', width: 'fit-content' }}>
                                      💰 Adv ₹{Number(stats.unusedAdvance).toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{outstandingDisplay(stats.outstanding)}</td>
                              <td>
                                <button type="button" className="table-edit-btn" onClick={e => openModalEdit(e, c)}>Edit</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </div>
        )}
      </div>

      {modalClient && (
        <EditModal
          client={modalClient}
          onSave={handleModalSave}
          onClose={() => setModalClient(null)}
          loading={modalLoading}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default ClientPage;