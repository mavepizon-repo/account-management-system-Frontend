import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/ReceiptPage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];

// ── Searchable Dropdown ──────────────────────────────────────
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
            <button className="sd-clear" onClick={e => { e.stopPropagation(); onChange(''); setQuery(''); }} title="Clear">✕</button>
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

function ReceiptPage({ onLogout }) {
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients]   = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);

  // ADD — persisted
  const [addForm, setAddForm] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('receipt_addForm')) || { invoiceId:'', amountPaid:'', paymentMethod:'Cash' }; }
    catch { return { invoiceId:'', amountPaid:'', paymentMethod:'Cash' }; }
  });
  useEffect(() => { sessionStorage.setItem('receipt_addForm', JSON.stringify(addForm)); }, [addForm]);

  // UPDATE
  const [updateReceiptId, setUpdateReceiptId] = useState('');
  const [updateFound, setUpdateFound]         = useState(null);
  const [updateForm, setUpdateForm]           = useState({ amountPaid:'', paymentDate:'', paymentMethod:'Cash' });

  // DELETE
  const [deleteReceiptId, setDeleteReceiptId] = useState('');
  const [deleteFound, setDeleteFound]         = useState(null);

  // GET ALL filters
  const [statusFilter, setStatusFilter]     = useState('All');
  const [searchRcptNo, setSearchRcptNo]     = useState('');
  const [searchClient, setSearchClient]     = useState('');
  const [searchInvNo, setSearchInvNo]       = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchReceipts = async () => {
    try { setLoading(true); const r=await fetch(`${API_BASE_URL}/receipt/getall`); const d=await r.json(); setReceipts(d.receipts||d||[]); }
    catch { showToast('Failed to fetch receipts','error'); }
    finally { setLoading(false); }
  };
  const fetchInvoices = async () => {
    try { const r=await fetch(`${API_BASE_URL}/invoice/getall`); const d=await r.json(); setInvoices(d.data||[]); }
    catch {}
  };
  const fetchClients = async () => {
    try { const r=await fetch(`${API_BASE_URL}/client/getall`); const d=await r.json(); setClients(Array.isArray(d)?d:(d.data||[])); }
    catch {}
  };

  useEffect(() => { fetchReceipts(); fetchInvoices(); fetchClients(); }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setUpdateReceiptId(''); setUpdateFound(null); setUpdateForm({ amountPaid:'', paymentDate:'', paymentMethod:'Cash' });
    setDeleteReceiptId(''); setDeleteFound(null);
    setSelectedReceiptId(''); setStatusFilter('All');
    setSearchRcptNo(''); setSearchClient(''); setSearchInvNo(''); setDateFrom(''); setDateTo('');
  };

  const getClientForInvoice = (inv) => {
    if (!inv) return null;
    if (inv.client?.name) return inv.client;
    const clientId = inv.client?._id || inv.client;
    return clients.find(c => c._id === clientId) || null;
  };

  const getInvoiceLabel = (inv) => {
    const c = getClientForInvoice(inv);
    const remaining = (inv.grandTotal||0) - (inv.paidAmount||0);
    return `${inv.invoiceNumber||''} | ${c?.clientCode||''} — ${c?.name||''} | ${inv.project} | Bal: ₹${Number(remaining).toLocaleString('en-IN')} | ${inv.paymentStatus}`;
  };

  const payableInvoices    = invoices.filter(i => i.paymentStatus !== 'Paid');
  const selectedInvObj     = invoices.find(i => i._id === addForm.invoiceId);
  const selectedInvClient  = getClientForInvoice(selectedInvObj);
  const selectedReceiptObj = receipts.find(r => r._id === selectedReceiptId);

  // Multi filter
  const filteredReceipts = receipts.filter(r => {
    const matchStatus  = statusFilter==='All' || r.invoice?.paymentStatus===statusFilter;
    const matchRcptNo  = !searchRcptNo.trim()  || r.receiptNumber?.toLowerCase().includes(searchRcptNo.toLowerCase());
    const matchClient  = !searchClient.trim()  || r.client?.name?.toLowerCase().includes(searchClient.toLowerCase()) || r.client?.clientCode?.toLowerCase().includes(searchClient.toLowerCase());
    const matchInvNo   = !searchInvNo.trim()   || r.invoice?.invoiceNumber?.toLowerCase().includes(searchInvNo.toLowerCase());
    const rDate        = r.paymentDate?.split('T')[0]||'';
    const matchFrom    = !dateFrom || rDate>=dateFrom;
    const matchTo      = !dateTo   || rDate<=dateTo;
    return matchStatus&&matchRcptNo&&matchClient&&matchInvNo&&matchFrom&&matchTo;
  });

  const countAll=receipts.length, countPaid=receipts.filter(r=>r.invoice?.paymentStatus==='Paid').length, countPartial=receipts.filter(r=>r.invoice?.paymentStatus==='Partial').length, countUnpaid=receipts.filter(r=>r.invoice?.paymentStatus==='Unpaid').length;
  const hasFilters = searchRcptNo||searchClient||searchInvNo||dateFrom||dateTo;
  const clearFilters = () => { setSearchRcptNo(''); setSearchClient(''); setSearchInvNo(''); setDateFrom(''); setDateTo(''); };

  // ADD
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.invoiceId||!addForm.amountPaid) { showToast('Please select invoice and enter amount','error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ invoiceId:addForm.invoiceId, amountPaid:parseFloat(addForm.amountPaid), paymentMethod:addForm.paymentMethod }) });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([fetchReceipts(), fetchInvoices()]);
        setAddForm({ invoiceId:'', amountPaid:'', paymentMethod:'Cash' });
        sessionStorage.removeItem('receipt_addForm');
        showToast(`Receipt ${data.receipt?.receiptNumber} generated!`);
      } else showToast(data.message||'Failed to create receipt','error');
    } catch { showToast('Error creating receipt','error'); }
    finally { setLoading(false); }
  };

  const handleUpdateSelect = (rcptId) => {
    setUpdateReceiptId(rcptId);
    const found = receipts.find(r => r._id===rcptId);
    if (found) { setUpdateFound(found); setUpdateForm({ amountPaid:found.amountPaid, paymentDate:found.paymentDate?.split('T')[0]||'', paymentMethod:found.paymentMethod||'Cash' }); }
    else { setUpdateFound(null); setUpdateForm({ amountPaid:'', paymentDate:'', paymentMethod:'Cash' }); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a receipt','error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/update/${updateFound._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ amountPaid:parseFloat(updateForm.amountPaid), paymentDate:updateForm.paymentDate, paymentMethod:updateForm.paymentMethod }) });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([fetchReceipts(), fetchInvoices()]);
        showToast('Receipt updated!');
        setUpdateFound(null); setUpdateReceiptId(''); setUpdateForm({ amountPaid:'', paymentDate:'', paymentMethod:'Cash' });
      } else showToast(data.message||'Failed to update','error');
    } catch { showToast('Error updating receipt','error'); }
    finally { setLoading(false); }
  };

  const handleDeleteSelect = (rcptId) => { setDeleteReceiptId(rcptId); setDeleteFound(receipts.find(r=>r._id===rcptId)||null); };
  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a receipt','error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/receipt/delete/${deleteFound._id}`, { method:'DELETE' });
      if (res.ok) {
        await Promise.all([fetchReceipts(), fetchInvoices()]);
        showToast('Receipt deleted!','info'); setDeleteFound(null); setDeleteReceiptId('');
      } else { const d=await res.json(); showToast(d.message||'Failed to delete','error'); }
    } catch { showToast('Error deleting receipt','error'); }
    finally { setLoading(false); }
  };

  const handlePrintReceipt = (r) => {
    const w=window.open('','_blank','width=750,height=750');
    w.document.write(`<html><head><title>Receipt ${r.receiptNumber}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:48px;color:#1e2a4a;max-width:600px;margin:auto;}h2{color:#7c3aed;font-size:24px;margin-bottom:2px;}.subtitle{color:#888;font-size:13px;margin-bottom:28px;}.divider{border:none;border-top:1.5px solid #e0d7f7;margin:16px 0;}.client-block{background:#f3e8ff;border-radius:10px;padding:14px 18px;margin-bottom:12px;}.client-name{font-size:18px;font-weight:800;color:#5b21b6;}.client-meta{font-size:13px;color:#7c3aed;margin-top:3px;}.row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0eaff;font-size:14px;}.label{font-weight:700;color:#7c3aed;}.value{color:#1e2a4a;text-align:right;}.amount-row .value{font-size:22px;font-weight:800;color:#22d3a5;}.badge{padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;}.paid{background:#e6fdf6;color:#036b4e;}.partial{background:#fffbe8;color:#7a5000;}.unpaid{background:#fff4f7;color:#c93360;}.footer{margin-top:36px;text-align:center;color:#aaa;font-size:12px;}@media print{body{padding:32px;}}</style></head><body><h2>🧾 Payment Receipt</h2><div class="subtitle">Account Management System</div><div class="client-block"><div class="client-name">${r.client?.name||'—'}</div><div class="client-meta">${r.client?.clientCode||'—'} &nbsp;·&nbsp; ${r.invoice?.project||'—'} &nbsp;·&nbsp; ${r.invoice?.invoiceNumber||'—'}</div></div><hr class="divider"/><div class="row"><span class="label">Receipt No</span><span class="value">${r.receiptNumber}</span></div><div class="row"><span class="label">Invoice ID</span><span class="value">${r.invoice?.invoiceNumber||'—'}</span></div><div class="row"><span class="label">Payment Date</span><span class="value">${r.paymentDate?.split('T')[0]||new Date().toISOString().split('T')[0]}</span></div><div class="row"><span class="label">Payment Method</span><span class="value">${r.paymentMethod||'Cash'}</span></div><hr class="divider"/><div class="row"><span class="label">Invoice Total</span><span class="value">₹${Number(r.invoice?.grandTotal||0).toLocaleString('en-IN')}</span></div><div class="row amount-row"><span class="label">Amount Paid</span><span class="value">₹${Number(r.amountPaid).toLocaleString('en-IN')}</span></div><div class="row"><span class="label">Payment Status</span><span class="value"><span class="badge ${(r.invoice?.paymentStatus||'unpaid').toLowerCase()}">${r.invoice?.paymentStatus||'—'}</span></span></div><div class="footer">Thank you for your payment! 🙏</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleShareReceipt = async (r) => {
    if (!r.receiptPdf) { showToast('No PDF available','error'); return; }
    if (navigator.share) { try { await navigator.share({ title:`Receipt ${r.receiptNumber}`, text:`Payment Receipt - ${r.client?.name||''} - ₹${Number(r.amountPaid).toLocaleString('en-IN')}`, url:r.receiptPdf }); } catch {} }
    else { try { await navigator.clipboard.writeText(r.receiptPdf); showToast('PDF link copied!'); } catch { showToast('Could not share','error'); } }
  };

  const statusBadge = (status) => {
    const map={Paid:'status-paid',Partial:'status-partial',Unpaid:'status-pending'};
    return <span className={`status-badge ${map[status]||'status-pending'}`}>{status||'—'}</span>;
  };

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/client')}>←</button>
          <h1 className="entity-page-title">🧾 Receipt Management</h1>
          <span className="entity-page-badge" style={{ background:'#f3e8ff',color:'#7c3aed',border:'1px solid #ddd6fe' }}>{receipts.length} Receipts</span>
        </div>

        <div className="actions-row">
          <button className="action-btn rcp-btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Receipt</button>
          <button className="action-btn rcp-btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Receipt</button>
          <button className="action-btn rcp-btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Receipt</button>
          <button className="action-btn rcp-btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>Get All Receipts</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ADD */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Receipt</div>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="form-field full-width">
                  <label className="field-label">Select Invoice (Unpaid / Partial) *</label>
                  <div className="dropdown-wrap">
                    <select className="dropdown-select" value={addForm.invoiceId}
                      onChange={e => setAddForm({ ...addForm, invoiceId:e.target.value, amountPaid:'' })}>
                      <option value="">-- Select Invoice --</option>
                      {payableInvoices.map(inv => <option key={inv._id} value={inv._id}>{getInvoiceLabel(inv)}</option>)}
                    </select>
                    <span className="dropdown-arrow">▾</span>
                  </div>
                </div>
                {selectedInvObj && (<>
                  <div className="form-field full-width">
                    <div className="rcp-client-info-card">
                      <div className="rcp-client-info-row">
                        <div className="rcp-client-avatar">{(selectedInvClient?.name||'?').charAt(0).toUpperCase()}</div>
                        <div style={{flex:1}}>
                          <div className="rcp-client-name">{selectedInvClient?.name||'—'}</div>
                          <div className="rcp-client-meta">{selectedInvClient?.clientCode||'—'} &nbsp;·&nbsp; {selectedInvClient?.phone||'—'}</div>
                          {selectedInvClient?.address && <div className="rcp-client-address">{selectedInvClient.address}</div>}
                        </div>
                        <div style={{textAlign:'right'}}>
                          <span className="rcp-inv-tag">{selectedInvObj.invoiceNumber}</span>
                          <div className="rcp-inv-project" style={{marginTop:6}}>{selectedInvObj.project}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="form-field full-width">
                    <div className="rcp-balance-row">
                      <div className="rcp-balance-card rcp-bc-total"><span>Grand Total</span><strong>₹{Number(selectedInvObj.grandTotal).toLocaleString('en-IN')}</strong></div>
                      <div className="rcp-balance-card rcp-bc-paid"><span>Already Paid</span><strong>₹{Number(selectedInvObj.paidAmount).toLocaleString('en-IN')}</strong></div>
                      <div className="rcp-balance-card rcp-bc-due"><span>Remaining</span><strong>₹{Number((selectedInvObj.grandTotal||0)-(selectedInvObj.paidAmount||0)).toLocaleString('en-IN')}</strong></div>
                      <div className="rcp-balance-card rcp-bc-status"><span>Status</span><strong>{statusBadge(selectedInvObj.paymentStatus)}</strong></div>
                    </div>
                  </div>
                </>)}
                <div className="form-field">
                  <label className="field-label">Amount to Pay (₹) *</label>
                  <input className="field-input" type="number" placeholder="Enter payment amount" value={addForm.amountPaid} onChange={e => setAddForm({ ...addForm, amountPaid:e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Payment Method *</label>
                  <div className="dropdown-wrap">
                    <select className="dropdown-select" value={addForm.paymentMethod} onChange={e => setAddForm({ ...addForm, paymentMethod:e.target.value })}>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="dropdown-arrow">▾</span>
                  </div>
                </div>
              </div>
              <button type="submit" className="submit-btn rcp-submit" disabled={loading}>Generate Receipt</button>
            </form>
          </div>
        )}

        {/* UPDATE */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Receipt</div>
            <div className="form-field" style={{marginBottom:20}}>
              <label className="field-label">Search & Select Receipt *</label>
              <SearchableDropdown
                options={receipts}
                value={updateReceiptId}
                onChange={handleUpdateSelect}
                placeholder="Type receipt no, client or invoice no..."
                getLabel={r => `${r.receiptNumber} — ${r.client?.name||'—'} — ${r.invoice?.invoiceNumber||'—'} — ₹${Number(r.amountPaid).toLocaleString('en-IN')}`}
                getId={r => r._id}
              />
            </div>
            {updateFound && (<>
              <div className="rcp-client-info-card" style={{marginBottom:20}}>
                <div className="rcp-client-info-row">
                  <div className="rcp-client-avatar">{(updateFound.client?.name||'?').charAt(0).toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <div className="rcp-client-name">{updateFound.client?.name||'—'}</div>
                    <div className="rcp-client-meta">{updateFound.client?.clientCode||'—'}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span className="rcp-inv-tag">{updateFound.receiptNumber}</span>
                    <div className="rcp-inv-project" style={{marginTop:6}}>{updateFound.invoice?.project||'—'}</div>
                  </div>
                </div>
              </div>
              <div className="rcp-balance-row" style={{marginBottom:20}}>
                <div className="rcp-balance-card rcp-bc-total"><span>Invoice Total</span><strong>₹{Number(updateFound.invoice?.grandTotal||0).toLocaleString('en-IN')}</strong></div>
                <div className="rcp-balance-card rcp-bc-paid"><span>Current Amt</span><strong>₹{Number(updateFound.amountPaid).toLocaleString('en-IN')}</strong></div>
                <div className="rcp-balance-card rcp-bc-status"><span>Invoice Status</span><strong>{statusBadge(updateFound.invoice?.paymentStatus)}</strong></div>
              </div>
              <form onSubmit={handleUpdate}>
                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">Amount Paid (₹)</label>
                    <input className="field-input" type="number" value={updateForm.amountPaid} onChange={e => setUpdateForm({ ...updateForm, amountPaid:e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Payment Date</label>
                    <input className="field-input" type="date" value={updateForm.paymentDate} onChange={e => setUpdateForm({ ...updateForm, paymentDate:e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Payment Method</label>
                    <div className="dropdown-wrap">
                      <select className="dropdown-select" value={updateForm.paymentMethod} onChange={e => setUpdateForm({ ...updateForm, paymentMethod:e.target.value })}>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <span className="dropdown-arrow">▾</span>
                    </div>
                  </div>
                </div>
                <button type="submit" className="submit-btn" disabled={loading}
                  style={{background:'linear-gradient(135deg,#ffe08a,#ffb84a)',color:'#6b4200',boxShadow:'0 5px 18px rgba(255,184,74,0.30)'}}>
                  Update Receipt
                </button>
              </form>
            </>)}
          </div>
        )}

        {/* DELETE */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Receipt</div>
            <div className="form-field" style={{marginBottom:20}}>
              <label className="field-label">Search & Select Receipt *</label>
              <SearchableDropdown
                options={receipts}
                value={deleteReceiptId}
                onChange={handleDeleteSelect}
                placeholder="Type receipt no, client or invoice no..."
                getLabel={r => `${r.receiptNumber} — ${r.client?.name||'—'} — ${r.invoice?.invoiceNumber||'—'} — ₹${Number(r.amountPaid).toLocaleString('en-IN')}`}
                getId={r => r._id}
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{marginTop:20}}>
                {[['Receipt No',deleteFound.receiptNumber],['Client',deleteFound.client?.name||'—'],['Client Code',deleteFound.client?.clientCode||'—'],['Project',deleteFound.invoice?.project||'—'],['Invoice ID',deleteFound.invoice?.invoiceNumber||'—'],['Invoice Total',`₹${Number(deleteFound.invoice?.grandTotal||0).toLocaleString('en-IN')}`],['Amount Paid',`₹${Number(deleteFound.amountPaid).toLocaleString('en-IN')}`],['Payment Method',deleteFound.paymentMethod||'Cash'],['Payment Date',deleteFound.paymentDate?.split('T')[0]],['Invoice Status',deleteFound.invoice?.paymentStatus||'—']].map(([k,v]) => (
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                ))}
                <p style={{marginTop:12,color:'#c93360',fontSize:13,fontWeight:600}}>⚠️ Deleting will reverse ₹{Number(deleteFound.amountPaid).toLocaleString('en-IN')} from invoice balance.</p>
                <button className="delete-confirm-btn" style={{marginTop:16}} onClick={handleDelete} disabled={loading}>Confirm Delete</button>
              </div>
            )}
          </div>
        )}

        {/* GET ALL */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Receipts</div>

            <div className="rcp-summary-chips">
              <div className="rcp-chip chip-total"><span>Total Receipts</span><strong>{receipts.length}</strong></div>
              <div className="rcp-chip chip-received"><span>Total Collected</span><strong>₹{receipts.reduce((s,r)=>s+(r.amountPaid||0),0).toLocaleString('en-IN')}</strong></div>
              <div className="rcp-chip chip-billed"><span>Paid Invoices</span><strong>{countPaid}</strong></div>
              <div className="rcp-chip chip-due"><span>Partial / Unpaid</span><strong>{countPartial+countUnpaid}</strong></div>
            </div>

            <div className="rcp-filter-row">
              {[{label:'All',count:countAll,key:'All',cls:'rcp-tab-all'},{label:'Paid',count:countPaid,key:'Paid',cls:'rcp-tab-paid'},{label:'Partial',count:countPartial,key:'Partial',cls:'rcp-tab-partial'},{label:'Unpaid',count:countUnpaid,key:'Unpaid',cls:'rcp-tab-unpaid'}].map(tab => (
                <button key={tab.key} className={`rcp-filter-tab ${tab.cls} ${statusFilter===tab.key?'active':''}`}
                  onClick={() => { setStatusFilter(tab.key); setSelectedReceiptId(''); }}>
                  {tab.label}<span className="rcp-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Multi filter */}
            <div className="multi-filter-grid">
              <div className="form-field"><label className="field-label">Receipt No</label><input className="field-input" placeholder="RC0001..." value={searchRcptNo} onChange={e=>setSearchRcptNo(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Client</label><input className="field-input" placeholder="Search client..." value={searchClient} onChange={e=>setSearchClient(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Invoice No</label><input className="field-input" placeholder="INV0001..." value={searchInvNo} onChange={e=>setSearchInvNo(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Date From</label><input className="field-input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Date To</label><input className="field-input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /></div>
              {hasFilters && <div className="form-field" style={{justifyContent:'flex-end'}}><label className="field-label">&nbsp;</label><button className="filter-clear-btn" onClick={clearFilters}>✕ Clear</button></div>}
            </div>
            {hasFilters && <div className="filter-result-badge">Showing <strong>{filteredReceipts.length}</strong> of {receipts.length} receipts</div>}

            {filteredReceipts.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No receipts found.</p></div>
            ) : (<>
              {selectedReceiptObj && (
                <div className="rcp-detail-card">
                  <div className="rcp-detail-header">
                    <div><span className="rcp-number-tag" style={{marginRight:10}}>{selectedReceiptObj.receiptNumber}</span><span style={{fontWeight:700}}>{selectedReceiptObj.invoice?.project||'—'}</span></div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>{statusBadge(selectedReceiptObj.invoice?.paymentStatus)}<button className="inv-detail-close" onClick={()=>setSelectedReceiptId('')}>✕</button></div>
                  </div>
                  <div className="rcp-client-info-card" style={{marginBottom:14}}>
                    <div className="rcp-client-info-row">
                      <div className="rcp-client-avatar">{(selectedReceiptObj.client?.name||'?').charAt(0).toUpperCase()}</div>
                      <div style={{flex:1}}><div className="rcp-client-name">{selectedReceiptObj.client?.name||'—'}</div><div className="rcp-client-meta">{selectedReceiptObj.client?.clientCode||'—'}</div></div>
                      <div style={{textAlign:'right'}}><span className="inv-number-tag">{selectedReceiptObj.invoice?.invoiceNumber||'—'}</span></div>
                    </div>
                  </div>
                  <div className="inv-detail-grid">
                    {[['Receipt No',selectedReceiptObj.receiptNumber],['Invoice ID',selectedReceiptObj.invoice?.invoiceNumber||'—'],['Project',selectedReceiptObj.invoice?.project||'—'],['Invoice Total',`₹${Number(selectedReceiptObj.invoice?.grandTotal||0).toLocaleString('en-IN')}`],['Amount Paid',`₹${Number(selectedReceiptObj.amountPaid).toLocaleString('en-IN')}`],['Payment Method',selectedReceiptObj.paymentMethod||'Cash'],['Payment Date',selectedReceiptObj.paymentDate?.split('T')[0]],['Invoice Status',selectedReceiptObj.invoice?.paymentStatus||'—']].map(([k,v]) => (
                      <div className="inv-detail-item" key={k}><span className="inv-detail-key">{k}</span><span className="inv-detail-val">{v}</span></div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:12,marginTop:14,flexWrap:'wrap'}}>
                    <button className="submit-btn rcp-submit" onClick={()=>handlePrintReceipt(selectedReceiptObj)}>🖨️ Print Receipt</button>
                    {selectedReceiptObj.receiptPdf && <a href={selectedReceiptObj.receiptPdf} target="_blank" rel="noreferrer" className="submit-btn rcp-pdf-btn" style={{textDecoration:'none'}}>📄 Download PDF</a>}
                    {selectedReceiptObj.receiptPdf && <button className="submit-btn rcp-share-btn" onClick={()=>handleShareReceipt(selectedReceiptObj)}>🔗 Share</button>}
                  </div>
                </div>
              )}
              <div className="rcp-card-list">
                {filteredReceipts.map(r => {
                  const isSel=selectedReceiptId===r._id;
                  return (
                    <div key={r._id} className={`rcp-row-card ${isSel?'rcp-row-selected':''}`} onClick={()=>setSelectedReceiptId(isSel?'':r._id)}>
                      <div className="rcp-row-left">
                        <span className="rcp-number-tag">{r.receiptNumber}</span>
                        <div className="rcp-row-project">{r.invoice?.project||'—'}</div>
                        <div className="rcp-row-client">{r.client?.name||'—'} &nbsp;·&nbsp; <span style={{color:'#7c3aed'}}>{r.client?.clientCode||''}</span></div>
                      </div>
                      <div className="rcp-row-mid">
                        <div className="rcp-row-inv"><span className="inv-number-tag">{r.invoice?.invoiceNumber||'—'}</span></div>
                        <div style={{display:'flex',gap:12,marginTop:4,flexWrap:'wrap'}}>
                          <span className="rcp-row-amt">₹{Number(r.amountPaid).toLocaleString('en-IN')}</span>
                          <span className="rcp-row-date">{r.paymentDate?.split('T')[0]}</span>
                          <span className="method-badge">{r.paymentMethod||'Cash'}</span>
                        </div>
                      </div>
                      <div className="rcp-row-right">
                        {statusBadge(r.invoice?.paymentStatus)}
                        <div className="rcp-action-btns" onClick={e=>e.stopPropagation()} style={{marginTop:8}}>
                          <button className="rcp-action-btn rcp-print" title="Print" onClick={()=>handlePrintReceipt(r)}>🖨️</button>
                          {r.receiptPdf && <a href={r.receiptPdf} target="_blank" rel="noreferrer" className="rcp-action-btn rcp-pdf" title="Download PDF" style={{textDecoration:'none'}}>📄</a>}
                          {r.receiptPdf && <button className="rcp-action-btn rcp-share" title="Share" onClick={()=>handleShareReceipt(r)}>🔗</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>)}
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default ReceiptPage;