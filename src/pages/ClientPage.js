import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/Clientpage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const EMPTY_FORM = { name: '', phone: '', address: '', contactPerson: '', gstnumber: '', emailid: '' };

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

  // Prevent background scroll while modal open
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
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="client-code-tag" style={{ marginRight: 10 }}>{client.clientCode}</span>
            <span className="modal-title">Edit Client</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="modal-form-grid">
            <div className="form-field">
              <label className="field-label">Client Name *</label>
              <input className="field-input" placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Phone Number *</label>
              <input className="field-input" placeholder="10 digit number" maxLength={10}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Contact Person</label>
              <input className="field-input" placeholder="Contact person name"
                value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Email ID</label>
              <input className="field-input" type="email" placeholder="email@example.com"
                value={form.emailid}
                onChange={e => setForm(f => ({ ...f, emailid: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">GST Number</label>
              <input className="field-input" placeholder="22AAAAA0000A1Z5" maxLength={15}
                value={form.gstnumber}
                onChange={e => setForm(f => ({ ...f, gstnumber: e.target.value.toUpperCase() }))} />
            </div>
            <div className="form-field full-width">
              <label className="field-label">Address *</label>
              <textarea className="field-input" rows={3} placeholder="Full address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>

          {/* Actions */}
          <div className="modal-footer">
            <button type="button" className="modal-cancel-btn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
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
function exportClientsToExcel(clients, invoices) {
  const getStats = (clientId) => {
    const invs = invoices.filter(inv => {
      const c = inv.client; if (!c) return false;
      return typeof c === 'object' ? c._id === clientId : c === clientId;
    });
    const totalBilled   = invs.reduce((s, i) => s + (i.grandTotal  || 0), 0);
    const totalReceived = invs.reduce((s, i) => s + (i.paidAmount  || 0), 0);
    return { count: invs.length, totalBilled, totalReceived, outstanding: totalBilled - totalReceived };
  };
  const headers = [
    'Client Code','Name','Contact Person','Phone','Email','GST Number',
    'Address','Total Invoices','Total Billed (₹)','Total Received (₹)','Outstanding (₹)'
  ];
  const rows = clients.map(c => {
    const s = getStats(c._id);
    return [c.clientCode, c.name, c.contactPerson||'', c.phone, c.emailid||'',
            c.gstnumber||'', c.address, s.count, s.totalBilled, s.totalReceived, s.outstanding];
  });
  const escape     = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const csvContent = '\uFEFF' + [headers,...rows].map(r=>r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`clients_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
function ClientPage({ onLogout }) {
  const navigate = useNavigate();
  const [clients,  setClients]  = useState([]);
  const [invoices, setInvoices] = useState([]);
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
  const [deleteClientId, setDeleteClientId] = useState('');
  const [deleteFound,    setDeleteFound]    = useState(null);

  /* ── Get All panel ── */
  const [statusFilter,     setStatusFilter]     = useState('All');
  const [getallSearch,     setGetallSearch]     = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientObj,setSelectedClientObj]= useState(null);

  /* ── Modal edit state ── */
  const [modalClient,  setModalClient]  = useState(null);   // client being edited in modal
  const [modalLoading, setModalLoading] = useState(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  /* ── Data fetch ── */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API_BASE_URL}/client/getall`);
      const d = await r.json();
      setClients(Array.isArray(d) ? d : (d.data || []));
    } catch { showToast('Failed to fetch clients', 'error'); }
    finally { setLoading(false); }
  };
  const fetchInvoices = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/invoice/getall`);
      const d = await r.json();
      setInvoices(d.data || []);
    } catch {}
  };
  useEffect(() => { fetchClients(); fetchInvoices(); }, []);

  /* ── Stats helpers ── */
  const getClientInvoices = (clientId) => invoices.filter(inv => {
    const c = inv.client; if (!c) return false;
    return typeof c === 'object' ? c._id === clientId : c === clientId;
  });
  const getClientStats = (clientId) => {
    const invs          = getClientInvoices(clientId);
    const totalBilled   = invs.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalReceived = invs.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const outstanding   = totalBilled - totalReceived;
    return { count: invs.length, totalBilled, totalReceived, outstanding, invs };
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
      if (statusFilter === 'Paid')    return s.outstanding <= 0 && s.count > 0;
      if (statusFilter === 'Partial') return s.outstanding > 0 && s.totalReceived > 0;
      if (statusFilter === 'Unpaid')  return s.totalReceived === 0 && s.count > 0;
      return true;
    });
  };

  /* ── Panel toggle ── */
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setUpdateClientId(''); setUpdateForm(EMPTY_FORM); setUpdateFound(null);
    setDeleteClientId(''); setDeleteFound(null);
    setSelectedClientId(''); setSelectedClientObj(null);
    setStatusFilter('All'); setGetallSearch('');
    setModalClient(null);
  };

  /* ── ADD ── */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.phone || !addForm.address) {
      showToast('Please fill all required fields', 'error'); return;
    }
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/client/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchClients();
        setAddForm(EMPTY_FORM);
        sessionStorage.removeItem('client_addForm');
        showToast(`${data.name} added successfully!`);
      } else showToast(data.message || 'Failed to add client', 'error');
    } catch { showToast('Error adding client', 'error'); }
    finally { setLoading(false); }
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
    } else { setUpdateFound(null); setUpdateForm(EMPTY_FORM); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a client', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/client/edit/${updateFound._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });
      if (res.ok) {
        await fetchClients();
        showToast(`${updateForm.name} updated successfully!`);
        setUpdateFound(null); setUpdateClientId(''); setUpdateForm(EMPTY_FORM);
      } else showToast('Failed to update client', 'error');
    } catch { showToast('Error updating client', 'error'); }
    finally { setLoading(false); }
  };

  /* ── DELETE panel ── */
  const handleDeleteSelect = (clientId) => {
    setDeleteClientId(clientId);
    setDeleteFound(clients.find(c => c._id === clientId) || null);
  };
  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a client', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/client/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchClients();
        showToast(`${deleteFound.name} deleted successfully!`, 'info');
        setDeleteFound(null); setDeleteClientId('');
      } else showToast('Failed to delete client', 'error');
    } catch { showToast('Error deleting client', 'error'); }
    finally { setLoading(false); }
  };

  /* ── MODAL EDIT (used from Get All table) ── */
  const openModalEdit = (e, client) => {
    e.preventDefault();        // prevent any form submit
    e.stopPropagation();       // prevent row click / parent handlers
    setModalClient(client);
  };

  const handleModalSave = async (formData) => {
    if (!modalClient) return;
    try {
      setModalLoading(true);
      const res = await fetch(`${API_BASE_URL}/client/edit/${modalClient._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchClients();
        showToast(`${formData.name} updated successfully!`);
        // If the edited client was selected in profile, refresh it
        if (selectedClientId === modalClient._id) {
          const updated = clients.find(c => c._id === modalClient._id);
          if (updated) setSelectedClientObj({ ...updated, ...formData });
        }
        setModalClient(null);
      } else {
        const d = await res.json();
        showToast(d.message || 'Failed to update client', 'error');
      }
    } catch { showToast('Error updating client', 'error'); }
    finally { setModalLoading(false); }
  };

  /* ── Row click (profile view) ── */
  const handleRowClick = (client) => {
    if (modalClient) return;    // modal open — ignore row click
    if (selectedClientId === client._id) {
      setSelectedClientId(''); setSelectedClientObj(null);
    } else {
      setSelectedClientId(client._id); setSelectedClientObj(client);
    }
  };

  /* ── Display helpers ── */
  const outstandingDisplay = (outstanding) => {
    if (outstanding < 0) return <span className="outstanding-zero">+₹{Number(Math.abs(outstanding)).toLocaleString('en-IN')}</span>;
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
        <input className="field-input" placeholder="Enter full name"
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="field-label">Phone Number *</label>
        <input className="field-input" placeholder="10 digit number" maxLength={10}
          value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
      </div>
      <div className="form-field">
        <label className="field-label">Contact Person</label>
        <input className="field-input" placeholder="Contact person name"
          value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="field-label">Email ID</label>
        <input className="field-input" type="email" placeholder="email@example.com"
          value={form.emailid} onChange={e => setForm({ ...form, emailid: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="field-label">GST Number</label>
        <input className="field-input" placeholder="22AAAAA0000A1Z5" maxLength={15}
          value={form.gstnumber} onChange={e => setForm({ ...form, gstnumber: e.target.value.toUpperCase() })} />
      </div>
      <div className="form-field full-width">
        <label className="field-label">Address *</label>
        <textarea className="field-input" placeholder="Enter full address"
          value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
      </div>
    </div>
  );

  /* ── Derived counts ── */
  const filteredClients  = getFilteredClients();
  const profileStats     = selectedClientObj ? getClientStats(selectedClientObj._id) : null;
  const countAll     = clients.length;
  const countPaid    = clients.filter(c => { const s = getClientStats(c._id); return s.outstanding <= 0 && s.count > 0; }).length;
  const countPartial = clients.filter(c => { const s = getClientStats(c._id); return s.outstanding > 0 && s.totalReceived > 0; }).length;
  const countUnpaid  = clients.filter(c => { const s = getClientStats(c._id); return s.totalReceived === 0 && s.count > 0; }).length;

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

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Client</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Client</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Client</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>Get All Clients</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ══ ADD CLIENT ══════════════════════════════════════════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Client</div>
            <form onSubmit={handleAdd}>
              {renderFormFields(addForm, setAddForm)}
              <button type="submit" className="submit-btn" disabled={loading}>Add Client</button>
            </form>
          </div>
        )}

        {/* ══ UPDATE CLIENT ════════════════════════════════════════ */}
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

        {/* ══ DELETE CLIENT ════════════════════════════════════════ */}
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
                <button className="delete-confirm-btn" style={{ marginTop: 16 }} onClick={handleDelete} disabled={loading}>
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ GET ALL CLIENTS ══════════════════════════════════════ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="getall-header-row">
              <div className="panel-title" style={{ margin: 0 }}>All Clients</div>
              <button className="excel-export-btn"
                onClick={() => exportClientsToExcel(filteredClients, invoices)}
                title="Download as CSV">
                <span>⬇</span> Export CSV
              </button>
            </div>

            {/* Search */}
            <div className="form-field" style={{ marginBottom: 16, marginTop: 16 }}>
              <input className="field-input"
                placeholder="🔍 Search by name, code, phone, email or GST..."
                value={getallSearch}
                onChange={e => { setGetallSearch(e.target.value); setSelectedClientId(''); setSelectedClientObj(null); }} />
            </div>

            {/* Status tabs */}
            <div className="inv-status-filter-row" style={{ marginBottom: 22 }}>
              {[
                { label: 'All',     count: countAll,     key: 'All',     cls: 'filter-all' },
                { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'filter-paid' },
                { label: 'Partial', count: countPartial, key: 'Partial', cls: 'filter-partial' },
                { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'filter-unpaid' },
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
                  {/* ── CLIENT PROFILE CARD ── */}
                  {selectedClientObj && profileStats && (
                    <div className="client-profile-card">
                      <div className="cp-header">
                        <div className="cp-avatar">
                          {selectedClientObj.name.charAt(0).toUpperCase()}
                        </div>
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
                              {selectedClientObj.gstnumber    && <span className="cp-extra-chip">🧾 GST: {selectedClientObj.gstnumber}</span>}
                            </div>
                          )}
                        </div>
                        {/* Edit button inside profile */}
                        <button className="cp-edit-btn"
                          onClick={e => openModalEdit(e, selectedClientObj)}
                          title="Edit this client" type="button">
                          ✏️ Edit
                        </button>
                        <button className="cp-close-btn"
                          onClick={() => { setSelectedClientId(''); setSelectedClientObj(null); }}
                          type="button">✕</button>
                      </div>

                      {/* Stats */}
                      <div className="cp-stats-row">
                        <div className="cp-stat cp-stat-total"><span>Total Invoices</span><strong>{profileStats.count}</strong></div>
                        <div className="cp-stat cp-stat-billed"><span>Total Billed</span><strong>₹{profileStats.totalBilled.toLocaleString('en-IN')}</strong></div>
                        <div className="cp-stat cp-stat-received"><span>Total Received</span><strong>₹{profileStats.totalReceived.toLocaleString('en-IN')}</strong></div>
                        <div className="cp-stat cp-stat-due">
                          <span>Outstanding</span>
                          <strong>
                            {profileStats.outstanding < 0
                              ? `+₹${Math.abs(profileStats.outstanding).toLocaleString('en-IN')}`
                              : `₹${profileStats.outstanding.toLocaleString('en-IN')}`}
                          </strong>
                        </div>
                      </div>

                      {/* Detail grid */}
                      <div className="cp-section-title">Client Details</div>
                      <div className="cp-detail-grid">
                        {[
                          ['Client Code',    selectedClientObj.clientCode],
                          ['Name',           selectedClientObj.name],
                          ['Contact Person', selectedClientObj.contactPerson || '—'],
                          ['Phone',          selectedClientObj.phone],
                          ['Email',          selectedClientObj.emailid || '—'],
                          ['GST Number',     selectedClientObj.gstnumber || '—'],
                          ['Address',        selectedClientObj.address],
                        ].map(([k, v]) => (
                          <div className="cp-detail-item" key={k}>
                            <span className="cp-detail-key">{k}</span>
                            <span className="cp-detail-val">{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Invoice history */}
                      {profileStats.invs.length > 0 ? (
                        <>
                          <div className="cp-section-title" style={{ marginTop: 20 }}>
                            Invoice List &amp; Payment History
                          </div>
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
                                  const balance = Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0));
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
                                      <td className="paid-cell">₹{Number(inv.paidAmount || 0).toLocaleString('en-IN')}</td>
                                      <td className={balance > 0 ? 'due-cell' : 'zero-cell'}>
                                        ₹{Number(balance).toLocaleString('en-IN')}
                                      </td>
                                      <td>{statusBadge(inv.paymentStatus)}</td>
                                      <td>
                                        <button className="inv-print-btn" type="button"
                                          onClick={() => {
                                            const items = Array.isArray(inv.products) && inv.products.length > 0
                                              ? inv.products : [];
                                            const itemRows = items.map((it, i) =>
                                              `<tr><td>${i+1}</td><td>${it.description||''}</td><td>${it.quantity??''}</td><td>₹${Number(it.rate||0).toLocaleString('en-IN')}</td><td>₹${Number(it.amount||0).toLocaleString('en-IN')}</td><td>${it.gst||0}%</td><td>₹${Number(it.gstAmount||0).toLocaleString('en-IN')}</td><td>₹${Number(it.netAmount||0).toLocaleString('en-IN')}</td></tr>`
                                            ).join('');
                                            const w = window.open('', '_blank', 'width=800,height=600');
                                            w.document.write(`<html><head><title>Invoice</title><style>body{font-family:Arial;padding:40px;color:#1e2a4a;}table{width:100%;border-collapse:collapse;margin-top:20px;}th{background:#5b7fff;color:white;padding:10px 14px;}td{padding:10px 14px;border-bottom:1px solid #e4eaf8;}.tr td{font-weight:bold;background:#f4f7ff;}</style></head><body><h2 style="color:#5b7fff">Tax Invoice</h2><p><strong>Invoice No:</strong> ${inv.invoiceNumber}</p><p><strong>Client:</strong> ${selectedClientObj.name} (${selectedClientObj.clientCode})</p><p><strong>Date:</strong> ${inv.date?.split('T')[0]}</p><p><strong>Subject:</strong> ${inv.subject||''}</p><table><thead><tr><th>S.No</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th>GST%</th><th>GST Amt</th><th>Net Amt</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr class="tr"><td colspan="7">Grand Total</td><td>₹${Number(inv.grandTotal||0).toLocaleString('en-IN')}</td></tr><tr><td colspan="7">Paid</td><td>₹${Number(inv.paidAmount||0).toLocaleString('en-IN')}</td></tr><tr class="tr"><td colspan="7">Balance Due</td><td>₹${Number(balance).toLocaleString('en-IN')}</td></tr></tfoot></table></body></html>`);
                                            w.document.close(); w.print();
                                          }}>🖨️</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div className="cp-no-invoices">No invoices found for this client.</div>
                      )}
                    </div>
                  )}

                  {/* ── MAIN CLIENT TABLE ── */}
                  <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1.5px solid #dde5f8' }}>
                    <table className="clients-table">
                      <thead>
                        <tr>
                          <th>Client Code</th><th>Name</th><th>Contact Person</th>
                          <th>Phone</th><th>Email</th><th>GST</th>
                          <th>Invoices</th><th>Outstanding</th><th>Action</th>
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
                              <td>
                                {c.gstnumber
                                  ? <span className="gst-tag">{c.gstnumber}</span>
                                  : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                              <td><span className="invoices-count-badge">{stats.count}</span></td>
                              <td>{outstandingDisplay(stats.outstanding)}</td>
                              <td>
                                {/*
                                  KEY FIX: use type="button" to prevent any form submit,
                                  e.preventDefault() + e.stopPropagation() to block navigation,
                                  and openModalEdit opens a modal instead of inline row editing.
                                */}
                                <button
                                  type="button"
                                  className="table-edit-btn"
                                  onClick={e => openModalEdit(e, c)}>
                                  Edit
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
          </div>
        )}
      </div>

      {/* ══ EDIT MODAL ══════════════════════════════════════════════ */}
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