import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/Invoicepage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const emptyForm = { clientCode:'',date:'',project:'',qty:'',rate:'',amount:'',gst:'18',gstAmount:'',grandTotal:'',paidAmount:'0' };

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
  const filtered = query.trim() ? options.filter(o => getLabel(o).toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div className="sd-wrap" ref={ref}>
      <div className={`sd-trigger ${open ? 'sd-open' : ''}`} onClick={() => setOpen(p => !p)}>
        {open
          ? <input className="sd-search-input" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Type to search..." onClick={e => e.stopPropagation()} />
          : <span className={`sd-value ${!selected ? 'sd-placeholder' : ''}`}>{selected ? getLabel(selected) : placeholder}</span>}
        <div className="sd-icons">
          {selected && !open && <button className="sd-clear" onClick={e => { e.stopPropagation(); onChange(''); setQuery(''); }} title="Clear">✕</button>}
          <span className="sd-arrow">{open ? '▴' : '▾'}</span>
        </div>
      </div>
      {open && (
        <div className="sd-dropdown">
          {filtered.length === 0
            ? <div className="sd-no-results">No results found</div>
            : filtered.map(o => (
              <div key={getId(o)} className={`sd-option ${getId(o) === value ? 'sd-option-selected' : ''}`}
                onClick={() => { onChange(getId(o)); setQuery(''); setOpen(false); }}>
                {getLabel(o)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const ClientDropdown = ({ value, onChange, clients }) => (
  <div className="dropdown-wrap">
    <select className="dropdown-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">-- Select Client --</option>
      {clients.map(c => <option key={c._id} value={c._id}>{c.clientCode} — {c.name}</option>)}
    </select>
    <span className="dropdown-arrow">▾</span>
  </div>
);

const InvoiceFormFields = ({ form, onChange, clients }) => (
  <div className="form-row invoice-form-grid">
    <div className="form-field"><label className="field-label">Client *</label><ClientDropdown value={form.clientCode} onChange={v => onChange('clientCode', v)} clients={clients} /></div>
    <div className="form-field"><label className="field-label">Date *</label><input className="field-input" type="date" value={form.date} onChange={e => onChange('date', e.target.value)} /></div>
    <div className="form-field full-width"><label className="field-label">Project *</label><input className="field-input" placeholder="Project description" value={form.project} onChange={e => onChange('project', e.target.value)} /></div>
    <div className="form-field"><label className="field-label">Quantity *</label><input className="field-input" type="number" placeholder="0" value={form.qty} onChange={e => onChange('qty', e.target.value)} /></div>
    <div className="form-field"><label className="field-label">Rate (₹) *</label><input className="field-input" type="number" placeholder="0.00" value={form.rate} onChange={e => onChange('rate', e.target.value)} /></div>
    <div className="form-field"><label className="field-label">Amount (₹)</label><input className="field-input invoice-calc-field" readOnly value={form.amount ? '₹'+Number(form.amount).toLocaleString('en-IN') : ''} /></div>
    <div className="form-field"><label className="field-label">GST (%)</label><input className="field-input" type="number" value={form.gst} onChange={e => onChange('gst', e.target.value)} /></div>
    <div className="form-field"><label className="field-label">GST Amount (₹)</label><input className="field-input invoice-calc-field" readOnly value={form.gstAmount ? '₹'+Number(form.gstAmount).toLocaleString('en-IN') : ''} /></div>
    <div className="form-field"><label className="field-label">Grand Total (₹)</label><input className="field-input invoice-grand-total" readOnly value={form.grandTotal ? '₹'+Number(form.grandTotal).toLocaleString('en-IN') : ''} /></div>
  </div>
);

function InvoicePage({ onLogout }) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients]   = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const [addForm, setAddForm] = useState(() => { try { return JSON.parse(sessionStorage.getItem('invoice_addForm')) || emptyForm; } catch { return emptyForm; } });
  useEffect(() => { sessionStorage.setItem('invoice_addForm', JSON.stringify(addForm)); }, [addForm]);

  const [updateInvoiceId, setUpdateInvoiceId] = useState('');
  const [updateFound, setUpdateFound]         = useState(null);
  const [updateForm, setUpdateForm]           = useState(emptyForm);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState('');
  const [deleteFound, setDeleteFound]         = useState(null);

  const [statusFilter, setStatusFilter]   = useState('All');
  const [searchInvNo, setSearchInvNo]     = useState('');
  const [searchClient, setSearchClient]   = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [editingId, setEditingId]                 = useState(null);
  const [inlineForm, setInlineForm]               = useState(emptyForm);
  const [invoiceReceipts, setInvoiceReceipts]     = useState({});
  const [expandedReceipts, setExpandedReceipts]   = useState({});

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const fetchClients  = async () => { try { const r = await fetch(`${API_BASE_URL}/client/getall`); const d = await r.json(); setClients(Array.isArray(d) ? d : (d.data || [])); } catch {} };
  const fetchInvoices = async () => { try { setLoading(true); const r = await fetch(`${API_BASE_URL}/invoice/getall`); const d = await r.json(); setInvoices(d.data || []); } catch { showToast('Failed to fetch invoices','error'); } finally { setLoading(false); } };
  useEffect(() => { fetchClients(); fetchInvoices(); }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setUpdateInvoiceId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteInvoiceId(''); setDeleteFound(null);
    setSelectedInvoiceId(''); setEditingId(null); setInlineForm(emptyForm);
    setStatusFilter('All'); setSearchInvNo(''); setSearchClient(''); setSearchProject(''); setDateFrom(''); setDateTo('');
    setInvoiceReceipts({}); setExpandedReceipts({});
  };

  const calcFields = (form, key, value) => {
    const u = {...form,[key]:value};
    const qty=parseFloat(u.qty)||0, rate=parseFloat(u.rate)||0, gstPct=parseFloat(u.gst)||0;
    const amount=qty*rate, gstAmount=parseFloat(((amount*gstPct)/100).toFixed(2)), grandTotal=parseFloat((amount+gstAmount).toFixed(2));
    return {...u, amount:amount||'', gstAmount:gstAmount||'', grandTotal:grandTotal||''};
  };
  const handleChange = setter => (key, value) => {
    if (['qty','rate','gst','paidAmount'].includes(key)) setter(prev => calcFields(prev,key,value));
    else setter(prev => ({...prev,[key]:value}));
  };
  const handleAddChange    = handleChange(setAddForm);
  const handleUpdateChange = handleChange(setUpdateForm);
  const handleInlineChange = handleChange(setInlineForm);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.clientCode||!addForm.date||!addForm.project||!addForm.qty||!addForm.rate) { showToast('Please fill all required fields','error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/invoice/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client:addForm.clientCode, date:addForm.date, project:addForm.project, quantity:parseFloat(addForm.qty), rate:parseFloat(addForm.rate), amount:parseFloat(addForm.amount)||0, gst:parseFloat(addForm.gst)||0, gstAmount:parseFloat(addForm.gstAmount)||0, grandTotal:parseFloat(addForm.grandTotal)||0, paidAmount:parseFloat(addForm.paidAmount)||0 }) });
      const data = await res.json();
      if (res.ok) { await fetchInvoices(); setAddForm(emptyForm); sessionStorage.removeItem('invoice_addForm'); showToast('Invoice added successfully!'); }
      else showToast(data.message||'Failed to add invoice','error');
    } catch { showToast('Error adding invoice','error'); }
    finally { setLoading(false); }
  };

  const handleUpdateSelect = (invId) => {
    setUpdateInvoiceId(invId);
    const found = invoices.find(i => i._id === invId);
    if (found) { setUpdateFound(found); setUpdateForm({ clientCode:found.client?._id||found.client||'', date:found.date?.split('T')[0]||'', project:found.project, qty:found.quantity, rate:found.rate, amount:found.amount, gst:found.gst, gstAmount:found.gstAmount, grandTotal:found.grandTotal, paidAmount:found.paidAmount }); }
    else { setUpdateFound(null); setUpdateForm(emptyForm); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select an invoice','error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/invoice/update/${updateFound._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client:updateForm.clientCode, date:updateForm.date, project:updateForm.project, quantity:parseFloat(updateForm.qty), rate:parseFloat(updateForm.rate), amount:parseFloat(updateForm.amount)||0, gst:parseFloat(updateForm.gst)||0, gstAmount:parseFloat(updateForm.gstAmount)||0, grandTotal:parseFloat(updateForm.grandTotal)||0, paidAmount:parseFloat(updateForm.paidAmount)||0 }) });
      if (res.ok) { await fetchInvoices(); showToast('Invoice updated successfully!'); setUpdateFound(null); setUpdateInvoiceId(''); setUpdateForm(emptyForm); }
      else { const d=await res.json(); showToast(d.message||'Failed to update','error'); }
    } catch { showToast('Error updating invoice','error'); }
    finally { setLoading(false); }
  };

  const handleDeleteSelect = (invId) => { setDeleteInvoiceId(invId); setDeleteFound(invoices.find(i => i._id===invId)||null); };
  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select an invoice','error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/invoice/delete/${deleteFound._id}`, { method:'DELETE' });
      if (res.ok) { await fetchInvoices(); showToast('Invoice deleted successfully!','info'); setDeleteFound(null); setDeleteInvoiceId(''); }
      else { const d=await res.json(); showToast(d.message||'Failed to delete','error'); }
    } catch { showToast('Error deleting invoice','error'); }
    finally { setLoading(false); }
  };

  const startInlineEdit = inv => { setEditingId(inv._id); setInlineForm({ clientCode:inv.client?._id||inv.client||'', date:inv.date?.split('T')[0]||'', project:inv.project, qty:inv.quantity, rate:inv.rate, amount:inv.amount, gst:inv.gst, gstAmount:inv.gstAmount, grandTotal:inv.grandTotal, paidAmount:inv.paidAmount }); };
  const saveInlineEdit = async (id) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/invoice/update/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client:inlineForm.clientCode, date:inlineForm.date, project:inlineForm.project, quantity:parseFloat(inlineForm.qty), rate:parseFloat(inlineForm.rate), amount:parseFloat(inlineForm.amount)||0, gst:parseFloat(inlineForm.gst)||0, gstAmount:parseFloat(inlineForm.gstAmount)||0, grandTotal:parseFloat(inlineForm.grandTotal)||0, paidAmount:parseFloat(inlineForm.paidAmount)||0 }) });
      if (res.ok) { await fetchInvoices(); showToast('Invoice updated!'); setEditingId(null); setInlineForm(emptyForm); }
    } catch { showToast('Error updating invoice','error'); }
    finally { setLoading(false); }
  };

  const toggleInvoiceReceipts = async (invId) => {
    if (expandedReceipts[invId]) { setExpandedReceipts(prev => ({...prev,[invId]:false})); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/receipt/get-by-invoice/${invId}`);
      if (res.status===404) { setInvoiceReceipts(prev=>({...prev,[invId]:[]})); setExpandedReceipts(prev=>({...prev,[invId]:true})); return; }
      const data = await res.json();
      setInvoiceReceipts(prev=>({...prev,[invId]:Array.isArray(data)?data:(data.receipts||[])}));
      setExpandedReceipts(prev=>({...prev,[invId]:true}));
    } catch { showToast('Failed to fetch receipts','error'); }
  };

  const getClientLabel = (inv) => {
    const c = inv.client;
    if (!c) return 'N/A';
    if (typeof c==='object' && c.name) return `${c.clientCode} — ${c.name}`;
    const found = clients.find(cl => cl._id===c);
    return found ? `${found.clientCode} — ${found.name}` : String(c);
  };
  const getInvNo = (inv) => inv.invoiceNumber || `INV-${inv._id?.toString().slice(-4)}`;

  const handlePrint = (inv) => {
    const cl=getClientLabel(inv), n=getInvNo(inv);
    const w=window.open('','_blank','width=800,height=600');
    w.document.write(`<html><head><title>Invoice ${n}</title><style>body{font-family:Arial;padding:40px;color:#1e2a4a;}table{width:100%;border-collapse:collapse;margin-top:20px;}th{background:#5b7fff;color:white;padding:10px 14px;text-align:left;}td{padding:10px 14px;border-bottom:1px solid #e4eaf8;}.tr td{font-weight:bold;background:#f4f7ff;}.hi{display:flex;justify-content:space-between;margin-bottom:20px;}.co{font-size:22px;font-weight:800;color:#5b7fff;}.ib{background:#eef1ff;color:#5b7fff;padding:6px 16px;border-radius:20px;font-weight:700;}</style></head><body><div class="hi"><div><div class="co">Account Management</div><div>Tax Invoice</div></div><div><div class="ib">${n}</div><div style="margin-top:6px">Date: ${inv.date?.split('T')[0]||''}</div></div></div><div style="margin-bottom:20px"><strong>Bill To:</strong> ${cl}<br/><strong>Project:</strong> ${inv.project}</div><table><thead><tr><th>Description</th><th>Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody><tr><td>${inv.project}</td><td>${inv.quantity||inv.qty}</td><td>₹${Number(inv.rate).toLocaleString('en-IN')}</td><td>₹${Number(inv.amount).toLocaleString('en-IN')}</td></tr><tr><td colspan="3">GST (${inv.gst}%)</td><td>₹${Number(inv.gstAmount).toLocaleString('en-IN')}</td></tr><tr><td colspan="3">Paid Amount</td><td>₹${Number(inv.paidAmount).toLocaleString('en-IN')}</td></tr><tr class="tr"><td colspan="3">Grand Total</td><td>₹${Number(inv.grandTotal).toLocaleString('en-IN')}</td></tr></tbody></table><p style="margin-top:40px;color:#6074a0;font-size:12px">Thank you for your business!</p></body></html>`);
    w.document.close(); w.print();
  };

  const statusBadge = (status) => {
    const map={Paid:'status-paid',Partial:'status-partial',Unpaid:'status-pending'};
    return <span className={`status-badge ${map[status]||'status-pending'}`}>{status}</span>;
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchStatus  = statusFilter==='All' || inv.paymentStatus===statusFilter;
    const matchInvNo   = !searchInvNo.trim()   || getInvNo(inv).toLowerCase().includes(searchInvNo.toLowerCase());
    const matchClient  = !searchClient.trim()  || getClientLabel(inv).toLowerCase().includes(searchClient.toLowerCase());
    const matchProject = !searchProject.trim() || inv.project?.toLowerCase().includes(searchProject.toLowerCase());
    const invDate      = inv.date?.split('T')[0]||'';
    const matchFrom    = !dateFrom || invDate>=dateFrom;
    const matchTo      = !dateTo   || invDate<=dateTo;
    return matchStatus&&matchInvNo&&matchClient&&matchProject&&matchFrom&&matchTo;
  });

  const selectedInvoiceObj = invoices.find(i => i._id===selectedInvoiceId);
  const countAll=invoices.length, countPaid=invoices.filter(i=>i.paymentStatus==='Paid').length, countPartial=invoices.filter(i=>i.paymentStatus==='Partial').length, countUnpaid=invoices.filter(i=>i.paymentStatus==='Unpaid').length;
  const hasFilters = searchInvNo||searchClient||searchProject||dateFrom||dateTo;
  const clearFilters = () => { setSearchInvNo(''); setSearchClient(''); setSearchProject(''); setDateFrom(''); setDateTo(''); };

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/client')}>←</button>
          <h1 className="entity-page-title">Invoice Management</h1>
          <span className="entity-page-badge" style={{ background:'#fffbe8',color:'#7a5000',border:'1px solid #ffe08a' }}>{invoices.length} Invoices</span>
        </div>
        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Invoice</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Invoice</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Invoice</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>Get All Invoices</button>
        </div>
        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {activePanel===PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Invoice</div>
            <form onSubmit={handleAdd}>
              <InvoiceFormFields form={addForm} onChange={handleAddChange} clients={clients} />
              <div style={{display:'flex',gap:12}}>
                <button type="submit" className="submit-btn" disabled={loading}>Add Invoice</button>
                {addForm.grandTotal && <button type="button" className="submit-btn invoice-print-btn" onClick={() => handlePrint({...addForm,quantity:addForm.qty,client:clients.find(c=>c._id===addForm.clientCode)})}>Print Preview</button>}
              </div>
            </form>
          </div>
        )}

        {activePanel===PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Invoice</div>
            <div className="form-field" style={{marginBottom:20}}>
              <label className="field-label">Search & Select Invoice *</label>
              <SearchableDropdown options={invoices} value={updateInvoiceId} onChange={handleUpdateSelect} placeholder="Type invoice no, client or project..." getLabel={i=>`${getInvNo(i)} — ${getClientLabel(i)} — ${i.project} — ₹${Number(i.grandTotal).toLocaleString('en-IN')} (${i.paymentStatus})`} getId={i=>i._id} />
            </div>
            {updateFound && (<>
              <div className="update-found-badge"><span className="update-found-id">{getInvNo(updateFound)}</span><span className="update-found-name">{updateFound.project}</span></div>
              <form onSubmit={handleUpdate}>
                <InvoiceFormFields form={updateForm} onChange={handleUpdateChange} clients={clients} />
                <button type="submit" className="submit-btn" disabled={loading} style={{background:'linear-gradient(135deg,#ffe08a,#ffb84a)',color:'#6b4200',boxShadow:'0 5px 18px rgba(255,184,74,0.30)'}}>Update Invoice</button>
              </form>
            </>)}
          </div>
        )}

        {activePanel===PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Invoice</div>
            <div className="form-field" style={{marginBottom:20}}>
              <label className="field-label">Search & Select Invoice *</label>
              <SearchableDropdown options={invoices} value={deleteInvoiceId} onChange={handleDeleteSelect} placeholder="Type invoice no, client or project..." getLabel={i=>`${getInvNo(i)} — ${getClientLabel(i)} — ${i.project} — ₹${Number(i.grandTotal).toLocaleString('en-IN')} (${i.paymentStatus})`} getId={i=>i._id} />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{marginTop:20}}>
                {[['Invoice No',getInvNo(deleteFound)],['Client',getClientLabel(deleteFound)],['Date',deleteFound.date?.split('T')[0]],['Project',deleteFound.project],['Quantity',deleteFound.quantity],['Rate',`₹${Number(deleteFound.rate).toLocaleString('en-IN')}`],['Amount',`₹${Number(deleteFound.amount).toLocaleString('en-IN')}`],['GST',`${deleteFound.gst}%`],['GST Amount',`₹${Number(deleteFound.gstAmount).toLocaleString('en-IN')}`],['Paid',`₹${Number(deleteFound.paidAmount).toLocaleString('en-IN')}`],['Grand Total',`₹${Number(deleteFound.grandTotal).toLocaleString('en-IN')}`],['Status',deleteFound.paymentStatus]].map(([k,v]) => (
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                ))}
                <button className="delete-confirm-btn" style={{marginTop:16}} onClick={handleDelete} disabled={loading}>Confirm Delete</button>
              </div>
            )}
          </div>
        )}

        {activePanel===PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Invoices</div>
            <div className="inv-summary-chips">
              <div className="inv-chip-card chip-total"><span>Total Invoices</span><strong>{invoices.length}</strong></div>
              <div className="inv-chip-card chip-billed"><span>Total Billed</span><strong>₹{invoices.reduce((s,i)=>s+(i.grandTotal||0),0).toLocaleString('en-IN')}</strong></div>
              <div className="inv-chip-card chip-received"><span>Total Received</span><strong>₹{invoices.reduce((s,i)=>s+(i.paidAmount||0),0).toLocaleString('en-IN')}</strong></div>
              <div className="inv-chip-card chip-due"><span>Outstanding</span><strong>₹{invoices.reduce((s,i)=>s+((i.grandTotal||0)-(i.paidAmount||0)),0).toLocaleString('en-IN')}</strong></div>
            </div>
            <div className="inv-status-filter-row">
              {[{label:'All',count:countAll,key:'All',cls:'filter-all'},{label:'Paid',count:countPaid,key:'Paid',cls:'filter-paid'},{label:'Partial',count:countPartial,key:'Partial',cls:'filter-partial'},{label:'Unpaid',count:countUnpaid,key:'Unpaid',cls:'filter-unpaid'}].map(tab => (
                <button key={tab.key} className={`inv-filter-tab ${tab.cls} ${statusFilter===tab.key?'active':''}`} onClick={() => { setStatusFilter(tab.key); setSelectedInvoiceId(''); }}>
                  {tab.label}<span className="inv-filter-count">{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="multi-filter-grid">
              <div className="form-field"><label className="field-label">Invoice No</label><input className="field-input" placeholder="INV0001..." value={searchInvNo} onChange={e=>setSearchInvNo(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Client</label><input className="field-input" placeholder="Search client..." value={searchClient} onChange={e=>setSearchClient(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Project</label><input className="field-input" placeholder="Search project..." value={searchProject} onChange={e=>setSearchProject(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Date From</label><input className="field-input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /></div>
              <div className="form-field"><label className="field-label">Date To</label><input className="field-input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /></div>
              {hasFilters && <div className="form-field" style={{justifyContent:'flex-end'}}><label className="field-label">&nbsp;</label><button className="filter-clear-btn" onClick={clearFilters}>✕ Clear</button></div>}
            </div>
            {hasFilters && <div className="filter-result-badge">Showing <strong>{filteredInvoices.length}</strong> of {invoices.length} invoices</div>}
            {filteredInvoices.length===0
              ? <div className="empty-state"><div className="empty-icon">📭</div><p>No invoices found.</p></div>
              : (<>
                {selectedInvoiceObj && (
                  <div className="inv-detail-card" style={{marginBottom:20}}>
                    <div className="inv-detail-header">
                      <div><span className="client-code-tag" style={{background:'#fffbe8',color:'#7a5000',borderColor:'#ffe08a',marginRight:10}}>{getInvNo(selectedInvoiceObj)}</span><span style={{fontWeight:700,fontSize:16}}>{selectedInvoiceObj.project}</span></div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>{statusBadge(selectedInvoiceObj.paymentStatus)}<button className="inv-detail-close" onClick={()=>setSelectedInvoiceId('')}>✕</button></div>
                    </div>
                    <div className="inv-detail-grid">
                      {[['Client',getClientLabel(selectedInvoiceObj)],['Date',selectedInvoiceObj.date?.split('T')[0]],['Quantity',selectedInvoiceObj.quantity],['Rate',`₹${Number(selectedInvoiceObj.rate).toLocaleString('en-IN')}`],['Amount',`₹${Number(selectedInvoiceObj.amount).toLocaleString('en-IN')}`],['GST',`${selectedInvoiceObj.gst}%`],['GST Amount',`₹${Number(selectedInvoiceObj.gstAmount).toLocaleString('en-IN')}`],['Grand Total',`₹${Number(selectedInvoiceObj.grandTotal).toLocaleString('en-IN')}`],['Paid Amount',`₹${Number(selectedInvoiceObj.paidAmount).toLocaleString('en-IN')}`],['Balance Due',`₹${Number(selectedInvoiceObj.grandTotal-selectedInvoiceObj.paidAmount).toLocaleString('en-IN')}`]].map(([k,v]) => (
                        <div className="inv-detail-item" key={k}><span className="inv-detail-key">{k}</span><span className="inv-detail-val">{v}</span></div>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
                      <button className="submit-btn invoice-print-btn" onClick={()=>handlePrint(selectedInvoiceObj)}>🖨️ Print Invoice</button>
                      <button className="submit-btn" style={{background:'linear-gradient(135deg,#f3e8ff,#e9d5ff)',color:'#7c3aed',boxShadow:'none',border:'1.5px solid #ddd6fe'}} onClick={()=>toggleInvoiceReceipts(selectedInvoiceObj._id)}>
                        🧾 {expandedReceipts[selectedInvoiceObj._id]?'Hide Receipts':'View Receipts'}
                      </button>
                    </div>
                    {expandedReceipts[selectedInvoiceObj._id] && (
                      <div className="receipt-subrow-inner" style={{marginTop:16}}>
                        {!invoiceReceipts[selectedInvoiceObj._id]||invoiceReceipts[selectedInvoiceObj._id].length===0
                          ? <div className="receipt-subrow-empty">No receipts found for this invoice.</div>
                          : <table className="receipt-subtable"><thead><tr><th>Receipt No</th><th>Amount Paid</th><th>Payment Date</th><th>PDF</th></tr></thead><tbody>{invoiceReceipts[selectedInvoiceObj._id].map(r => (<tr key={r._id}><td><span className="client-code-tag" style={{background:'#f3e8ff',color:'#7c3aed',borderColor:'#ddd6fe'}}>{r.receiptNumber}</span></td><td className="paid-cell">₹{Number(r.amountPaid).toLocaleString('en-IN')}</td><td>{r.paymentDate?.split('T')[0]}</td><td>{r.receiptPdf?<a href={r.receiptPdf} target="_blank" rel="noreferrer" className="inv-print-btn" style={{textDecoration:'none'}}>📄</a>:'—'}</td></tr>))}</tbody></table>}
                      </div>
                    )}
                  </div>
                )}
                <div className="inv-card-list">
                  {filteredInvoices.map(inv => {
                    const isSel=selectedInvoiceId===inv._id, bal=(inv.grandTotal||0)-(inv.paidAmount||0);
                    return editingId===inv._id ? (
                      <div key={inv._id} className="inv-edit-card">
                        <div className="inv-edit-card-header">
                          <span className="client-code-tag" style={{background:'#fffbe8',color:'#7a5000',borderColor:'#ffe08a'}}>{getInvNo(inv)}</span>
                          <div className="invoice-action-btns"><button className="inv-save-btn" onClick={()=>saveInlineEdit(inv._id)} disabled={loading}>💾</button><button className="inv-cancel-btn" onClick={()=>setEditingId(null)}>✕</button></div>
                        </div>
                        <div className="form-row invoice-form-grid" style={{marginTop:14}}>
                          <div className="form-field"><label className="field-label">Client</label><select className="field-input" value={inlineForm.clientCode} onChange={e=>handleInlineChange('clientCode',e.target.value)}><option value="">Select</option>{clients.map(c=><option key={c._id} value={c._id}>{c.clientCode} — {c.name}</option>)}</select></div>
                          <div className="form-field"><label className="field-label">Date</label><input className="field-input" type="date" value={inlineForm.date} onChange={e=>handleInlineChange('date',e.target.value)} /></div>
                          <div className="form-field full-width"><label className="field-label">Project</label><input className="field-input" value={inlineForm.project} onChange={e=>handleInlineChange('project',e.target.value)} /></div>
                          <div className="form-field"><label className="field-label">Quantity</label><input className="field-input" type="number" value={inlineForm.qty} onChange={e=>handleInlineChange('qty',e.target.value)} /></div>
                          <div className="form-field"><label className="field-label">Rate (₹)</label><input className="field-input" type="number" value={inlineForm.rate} onChange={e=>handleInlineChange('rate',e.target.value)} /></div>
                          <div className="form-field"><label className="field-label">Amount</label><input className="field-input invoice-calc-field" readOnly value={inlineForm.amount?'₹'+Number(inlineForm.amount).toLocaleString('en-IN'):''} /></div>
                          <div className="form-field"><label className="field-label">GST %</label><input className="field-input" type="number" value={inlineForm.gst} onChange={e=>handleInlineChange('gst',e.target.value)} /></div>
                          <div className="form-field"><label className="field-label">GST Amount</label><input className="field-input invoice-calc-field" readOnly value={inlineForm.gstAmount?'₹'+Number(inlineForm.gstAmount).toLocaleString('en-IN'):''} /></div>
                          <div className="form-field"><label className="field-label">Grand Total</label><input className="field-input invoice-grand-total" readOnly value={inlineForm.grandTotal?'₹'+Number(inlineForm.grandTotal).toLocaleString('en-IN'):''} /></div>
                          <div className="form-field"><label className="field-label">Paid Amount</label><input className="field-input" type="number" value={inlineForm.paidAmount} onChange={e=>handleInlineChange('paidAmount',e.target.value)} /></div>
                        </div>
                      </div>
                    ) : (
                      <div key={inv._id} className={`inv-row-card ${isSel?'inv-row-selected':''}`} onClick={()=>setSelectedInvoiceId(isSel?'':inv._id)}>
                        <div className="inv-row-left">
                          <span className="client-code-tag" style={{background:'#fffbe8',color:'#7a5000',borderColor:'#ffe08a'}}>{getInvNo(inv)}</span>
                          <div className="inv-row-project">{inv.project}</div>
                          <div className="inv-row-client">{getClientLabel(inv)}</div>
                        </div>
                        <div className="inv-row-mid">
                          <div className="inv-row-date">{inv.date?.split('T')[0]}</div>
                          <div style={{display:'flex',gap:16,marginTop:4}}>
                            <span className="inv-row-amt">₹{Number(inv.grandTotal).toLocaleString('en-IN')}</span>
                            <span className="inv-row-paid">Paid ₹{Number(inv.paidAmount).toLocaleString('en-IN')}</span>
                            {bal>0&&<span className="inv-row-bal">Bal ₹{Number(bal).toLocaleString('en-IN')}</span>}
                          </div>
                        </div>
                        <div className="inv-row-right">
                          {statusBadge(inv.paymentStatus)}
                          <div className="invoice-action-btns" onClick={e=>e.stopPropagation()} style={{marginTop:8}}>
                            <button className="inv-edit-btn" title="Edit" onClick={()=>startInlineEdit(inv)}>✏️</button>
                            <button className="inv-print-btn" title="Print" onClick={()=>handlePrint(inv)}>🖨️</button>
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
export default InvoicePage;