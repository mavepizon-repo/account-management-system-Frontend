import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/Clientpage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

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
          {filtered.length === 0 ? <div className="sd-no-results">No results found</div>
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

function ClientPage({ onLogout }) {
  const navigate = useNavigate();
  const [clients, setClients]   = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const [addForm, setAddForm] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('client_addForm')) || { name:'', phone:'', address:'' }; }
    catch { return { name:'', phone:'', address:'' }; }
  });
  useEffect(() => { sessionStorage.setItem('client_addForm', JSON.stringify(addForm)); }, [addForm]);

  const [updateClientId, setUpdateClientId] = useState('');
  const [updateFound, setUpdateFound]       = useState(null);
  const [updateForm, setUpdateForm]         = useState({ name:'', phone:'', address:'' });
  const [deleteClientId, setDeleteClientId] = useState('');
  const [deleteFound, setDeleteFound]       = useState(null);

  const [statusFilter, setStatusFilter]         = useState('All');
  const [getallSearch, setGetallSearch]         = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientObj, setSelectedClientObj] = useState(null);
  const [inlineEditId, setInlineEditId]         = useState(null);
  const [inlineEditForm, setInlineEditForm]     = useState({ name:'', phone:'', address:'' });

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchClients = async () => {
    try { setLoading(true); const r=await fetch(`${API_BASE_URL}/client/getall`); const d=await r.json(); setClients(Array.isArray(d)?d:(d.data||[])); }
    catch { showToast('Failed to fetch clients','error'); }
    finally { setLoading(false); }
  };
  const fetchInvoices = async () => {
    try { const r=await fetch(`${API_BASE_URL}/invoice/getall`); const d=await r.json(); setInvoices(d.data||[]); }
    catch {}
  };
  useEffect(() => { fetchClients(); fetchInvoices(); }, []);

  const getClientInvoices = (clientId) => invoices.filter(inv => {
    const c=inv.client; if (!c) return false;
    return typeof c==='object' ? c._id===clientId : c===clientId;
  });
  const getClientStats = (clientId) => {
    const invs=getClientInvoices(clientId);
    const totalBilled=invs.reduce((s,i)=>s+(i.grandTotal||0),0), totalReceived=invs.reduce((s,i)=>s+(i.paidAmount||0),0);
    return { count:invs.length, totalBilled, totalReceived, outstanding:totalBilled-totalReceived, invs };
  };
  const getFilteredClients = () => {
    let list = clients;
    if (getallSearch.trim()) {
      const q=getallSearch.toLowerCase();
      list=list.filter(c=>c.clientCode?.toLowerCase().includes(q)||c.name?.toLowerCase().includes(q)||c.phone?.includes(q));
    }
    if (statusFilter==='All') return list;
    return list.filter(c => {
      const s=getClientStats(c._id);
      if (statusFilter==='Paid')    return s.outstanding===0 && s.count>0;
      if (statusFilter==='Partial') return s.outstanding>0  && s.totalReceived>0;
      if (statusFilter==='Unpaid')  return s.totalReceived===0 && s.count>0;
      return true;
    });
  };

  const togglePanel = (panel) => {
    setPanel(prev => prev===panel ? null : panel);
    setUpdateClientId(''); setUpdateForm({ name:'', phone:'', address:'' }); setUpdateFound(null);
    setDeleteClientId(''); setDeleteFound(null);
    setSelectedClientId(''); setSelectedClientObj(null);
    setInlineEditId(null); setStatusFilter('All'); setGetallSearch('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name||!addForm.phone||!addForm.address) { showToast('Please fill all fields','error'); return; }
    try {
      setLoading(true);
      const res=await fetch(`${API_BASE_URL}/client/create`,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(addForm) });
      const data=await res.json();
      if (res.ok) { await fetchClients(); setAddForm({name:'',phone:'',address:''}); sessionStorage.removeItem('client_addForm'); showToast(`${data.name} added successfully!`); }
      else showToast(data.message||'Failed to add client','error');
    } catch { showToast('Error adding client','error'); }
    finally { setLoading(false); }
  };

  const handleUpdateSelect = (clientId) => {
    setUpdateClientId(clientId);
    const found=clients.find(c=>c._id===clientId);
    if (found) { setUpdateFound(found); setUpdateForm({name:found.name,phone:found.phone,address:found.address}); }
    else { setUpdateFound(null); setUpdateForm({name:'',phone:'',address:''}); }
  };
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a client','error'); return; }
    try {
      setLoading(true);
      const res=await fetch(`${API_BASE_URL}/client/edit/${updateFound._id}`,{ method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(updateForm) });
      if (res.ok) { await fetchClients(); showToast(`${updateForm.name} updated successfully!`); setUpdateFound(null); setUpdateClientId(''); setUpdateForm({name:'',phone:'',address:''}); }
      else showToast('Failed to update client','error');
    } catch { showToast('Error updating client','error'); }
    finally { setLoading(false); }
  };

  const handleDeleteSelect = (clientId) => { setDeleteClientId(clientId); setDeleteFound(clients.find(c=>c._id===clientId)||null); };
  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a client','error'); return; }
    try {
      setLoading(true);
      const res=await fetch(`${API_BASE_URL}/client/delete/${deleteFound._id}`,{method:'DELETE'});
      if (res.ok) { await fetchClients(); showToast(`${deleteFound.name} deleted successfully!`,'info'); setDeleteFound(null); setDeleteClientId(''); }
      else showToast('Failed to delete client','error');
    } catch { showToast('Error deleting client','error'); }
    finally { setLoading(false); }
  };

  const startInlineEdit = (client) => { setInlineEditId(client._id); setInlineEditForm({name:client.name,phone:client.phone,address:client.address}); };
  const cancelInlineEdit = () => { setInlineEditId(null); setInlineEditForm({name:'',phone:'',address:''}); };
  const saveInlineEdit = async (clientId) => {
    if (!inlineEditForm.name||!inlineEditForm.phone||!inlineEditForm.address) { showToast('Please fill all fields','error'); return; }
    try {
      setLoading(true);
      const res=await fetch(`${API_BASE_URL}/client/edit/${clientId}`,{ method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(inlineEditForm) });
      if (res.ok) { await fetchClients(); showToast(`${inlineEditForm.name} updated successfully!`); setInlineEditId(null); setInlineEditForm({name:'',phone:'',address:''}); }
    } catch { showToast('Error updating client','error'); }
    finally { setLoading(false); }
  };

  const handleRowClick = (client) => {
    if (inlineEditId) return;
    if (selectedClientId===client._id) { setSelectedClientId(''); setSelectedClientObj(null); }
    else { setSelectedClientId(client._id); setSelectedClientObj(client); }
  };

  const profileStats=selectedClientObj?getClientStats(selectedClientObj._id):null;
  const filteredClients=getFilteredClients();
  const countAll=clients.length, countPaid=clients.filter(c=>{const s=getClientStats(c._id);return s.outstanding===0&&s.count>0;}).length, countPartial=clients.filter(c=>{const s=getClientStats(c._id);return s.outstanding>0&&s.totalReceived>0;}).length, countUnpaid=clients.filter(c=>{const s=getClientStats(c._id);return s.totalReceived===0&&s.count>0;}).length;

  const statusBadge = (status) => {
    const map={Paid:'status-paid',Partial:'status-partial',Unpaid:'status-pending'};
    return <span className={`status-badge ${map[status]||'status-pending'}`}>{status}</span>;
  };

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">Client Management</h1>
          <span className="entity-page-badge" style={{background:'#eef1ff',color:'var(--primary)',border:'1px solid #c8d4ff'}}>{clients.length} Clients</span>
        </div>
        <div className="actions-row">
          <button className="action-btn btn-add"         onClick={() => togglePanel(PANELS.ADD)}>Add Client</button>
          <button className="action-btn btn-update"      onClick={() => togglePanel(PANELS.UPDATE)}>Update Client</button>
          <button className="action-btn btn-delete"      onClick={() => togglePanel(PANELS.DELETE)}>Delete Client</button>
          <button className="action-btn btn-getall"      onClick={() => togglePanel(PANELS.GETALL)}>Get All Clients</button>
          <button className="action-btn btn-invoice"     onClick={() => navigate('/invoices')}>Invoice</button>
          <button className="action-btn btn-receipt-add" onClick={() => navigate('/receipts')}>Receipt</button>
        </div>
        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {activePanel===PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Client</div>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="form-field"><label className="field-label">Client Name *</label><input className="field-input" placeholder="Enter full name" value={addForm.name} onChange={e=>setAddForm({...addForm,name:e.target.value})} /></div>
                <div className="form-field"><label className="field-label">Phone Number *</label><input className="field-input" placeholder="10 digit number" maxLength={10} value={addForm.phone} onChange={e=>setAddForm({...addForm,phone:e.target.value.replace(/\D/g,'')})} /></div>
                <div className="form-field full-width"><label className="field-label">Address *</label><textarea className="field-input" placeholder="Enter full address" value={addForm.address} onChange={e=>setAddForm({...addForm,address:e.target.value})} /></div>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>Add Client</button>
            </form>
          </div>
        )}

        {activePanel===PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Client</div>
            <div className="form-field" style={{marginBottom:20}}>
              <label className="field-label">Search & Select Client *</label>
              <SearchableDropdown options={clients} value={updateClientId} onChange={handleUpdateSelect} placeholder="Type name, code or phone to search..." getLabel={c=>`${c.clientCode} — ${c.name} (${c.phone})`} getId={c=>c._id} />
            </div>
            {updateFound && (<>
              <div className="update-found-badge"><span className="update-found-id">{updateFound.clientCode}</span><span className="update-found-name">{updateFound.name}</span></div>
              <form onSubmit={handleUpdate}>
                <div className="form-row">
                  <div className="form-field"><label className="field-label">Client Name</label><input className="field-input" value={updateForm.name} onChange={e=>setUpdateForm({...updateForm,name:e.target.value})} /></div>
                  <div className="form-field"><label className="field-label">Phone Number</label><input className="field-input" value={updateForm.phone} maxLength={10} onChange={e=>setUpdateForm({...updateForm,phone:e.target.value.replace(/\D/g,'')})} /></div>
                  <div className="form-field full-width"><label className="field-label">Address</label><textarea className="field-input" value={updateForm.address} onChange={e=>setUpdateForm({...updateForm,address:e.target.value})} /></div>
                </div>
                <button type="submit" className="submit-btn" disabled={loading} style={{background:'linear-gradient(135deg,#ffe08a,#ffb84a)',color:'#6b4200',boxShadow:'0 5px 18px rgba(255,184,74,0.30)'}}>Update</button>
              </form>
            </>)}
          </div>
        )}

        {activePanel===PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Client</div>
            <div className="form-field" style={{marginBottom:20}}>
              <label className="field-label">Search & Select Client *</label>
              <SearchableDropdown options={clients} value={deleteClientId} onChange={handleDeleteSelect} placeholder="Type name, code or phone to search..." getLabel={c=>`${c.clientCode} — ${c.name} (${c.phone})`} getId={c=>c._id} />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{marginTop:20}}>
                {[['Client Code',deleteFound.clientCode],['Name',deleteFound.name],['Phone',deleteFound.phone],['Address',deleteFound.address]].map(([k,v]) => (
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                ))}
                <button className="delete-confirm-btn" style={{marginTop:16}} onClick={handleDelete} disabled={loading}>Confirm Delete</button>
              </div>
            )}
          </div>
        )}

        {activePanel===PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Clients</div>
            <div className="form-field" style={{marginBottom:16}}>
              <input className="field-input" placeholder="🔍 Search by name, code or phone..." value={getallSearch}
                onChange={e=>{setGetallSearch(e.target.value);setSelectedClientId('');setSelectedClientObj(null);}} />
            </div>
            <div className="inv-status-filter-row" style={{marginBottom:22}}>
              {[{label:'All',count:countAll,key:'All',cls:'filter-all'},{label:'Paid',count:countPaid,key:'Paid',cls:'filter-paid'},{label:'Partial',count:countPartial,key:'Partial',cls:'filter-partial'},{label:'Unpaid',count:countUnpaid,key:'Unpaid',cls:'filter-unpaid'}].map(tab => (
                <button key={tab.key} className={`inv-filter-tab ${tab.cls} ${statusFilter===tab.key?'active':''}`}
                  onClick={() => {setStatusFilter(tab.key);setSelectedClientId('');setSelectedClientObj(null);}}>
                  {tab.label}<span className="inv-filter-count">{tab.count}</span>
                </button>
              ))}
            </div>
            {filteredClients.length===0
              ? <div className="empty-state"><div className="empty-icon">📭</div><p>No clients found.</p></div>
              : (<>
                {selectedClientObj && profileStats && (
                  <div className="client-profile-card">
                    <div className="cp-header">
                      <div className="cp-avatar">{selectedClientObj.name.charAt(0).toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div className="cp-name">{selectedClientObj.name}</div>
                        <div className="cp-meta">{selectedClientObj.clientCode} &nbsp;·&nbsp; {selectedClientObj.phone}</div>
                        <div className="cp-address">{selectedClientObj.address}</div>
                      </div>
                      <button className="cp-close-btn" onClick={()=>{setSelectedClientId('');setSelectedClientObj(null);}}>✕</button>
                    </div>
                    <div className="cp-stats-row">
                      <div className="cp-stat cp-stat-total"><span>Total Invoices</span><strong>{profileStats.count}</strong></div>
                      <div className="cp-stat cp-stat-billed"><span>Total Billed</span><strong>₹{profileStats.totalBilled.toLocaleString('en-IN')}</strong></div>
                      <div className="cp-stat cp-stat-received"><span>Total Received</span><strong>₹{profileStats.totalReceived.toLocaleString('en-IN')}</strong></div>
                      <div className="cp-stat cp-stat-due"><span>Outstanding</span><strong>₹{profileStats.outstanding.toLocaleString('en-IN')}</strong></div>
                    </div>
                    <div className="cp-section-title">Client Details</div>
                    <div className="cp-detail-grid">
                      {[['Client Code',selectedClientObj.clientCode],['Name',selectedClientObj.name],['Phone',selectedClientObj.phone],['Address',selectedClientObj.address]].map(([k,v]) => (
                        <div className="cp-detail-item" key={k}><span className="cp-detail-key">{k}</span><span className="cp-detail-val">{v}</span></div>
                      ))}
                    </div>
                    {profileStats.invs.length>0 ? (<>
                      <div className="cp-section-title" style={{marginTop:20}}>Invoice List &amp; Payment History</div>
                      <div className="cp-invoice-table-wrap">
                        <table className="clients-table cp-invoice-table">
                          <thead><tr><th>Inv No</th><th>Date</th><th>Project</th><th>Grand Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Print</th></tr></thead>
                          <tbody>
                            {profileStats.invs.map(inv => {
                              const balance=(inv.grandTotal||0)-(inv.paidAmount||0);
                              return (
                                <tr key={inv._id}>
                                  <td><span className="client-code-tag" style={{background:'#fffbe8',color:'#7a5000',borderColor:'#ffe08a'}}>{inv.invoiceNumber}</span></td>
                                  <td>{inv.date?.split('T')[0]}</td>
                                  <td style={{fontWeight:600}}>{inv.project}</td>
                                  <td className="amt-cell">₹{Number(inv.grandTotal).toLocaleString('en-IN')}</td>
                                  <td className="paid-cell">₹{Number(inv.paidAmount).toLocaleString('en-IN')}</td>
                                  <td className={balance>0?'due-cell':'zero-cell'}>₹{Number(balance).toLocaleString('en-IN')}</td>
                                  <td>{statusBadge(inv.paymentStatus)}</td>
                                  <td><button className="inv-print-btn" onClick={() => {
                                    const w=window.open('','_blank','width=800,height=600');
                                    w.document.write(`<html><head><title>Invoice</title><style>body{font-family:Arial;padding:40px;color:#1e2a4a;}table{width:100%;border-collapse:collapse;margin-top:20px;}th{background:#5b7fff;color:white;padding:10px 14px;}td{padding:10px 14px;border-bottom:1px solid #e4eaf8;}.total-row td{font-weight:bold;background:#f4f7ff;}</style></head><body><h2 style="color:#5b7fff">Tax Invoice</h2><p><strong>Invoice No:</strong> ${inv.invoiceNumber}</p><p><strong>Client:</strong> ${selectedClientObj.name} (${selectedClientObj.clientCode})</p><p><strong>Date:</strong> ${inv.date?.split('T')[0]}</p><p><strong>Project:</strong> ${inv.project}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>${inv.project}</td><td>${inv.quantity}</td><td>₹${Number(inv.rate).toLocaleString('en-IN')}</td><td>₹${Number(inv.amount).toLocaleString('en-IN')}</td></tr><tr><td colspan="3">GST ${inv.gst}%</td><td>₹${Number(inv.gstAmount).toLocaleString('en-IN')}</td></tr><tr><td colspan="3">Paid</td><td>₹${Number(inv.paidAmount).toLocaleString('en-IN')}</td></tr><tr class="total-row"><td colspan="3">Grand Total</td><td>₹${Number(inv.grandTotal).toLocaleString('en-IN')}</td></tr></tbody></table></body></html>`);
                                    w.document.close(); w.print();
                                  }}>🖨️</button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>) : <div className="cp-no-invoices">No invoices found for this client.</div>}
                  </div>
                )}
                <div>
                  <table className="clients-table">
                    <thead><tr><th>Client Code</th><th>Name</th><th>Phone</th><th>Address</th><th>Invoices</th><th>Outstanding</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredClients.map(c => {
                        const stats=getClientStats(c._id), isSel=selectedClientId===c._id;
                        return inlineEditId===c._id ? (
                          <tr key={c._id} className="inline-edit-row">
                            <td>{c.clientCode}</td>
                            <td><input className="inline-edit-input" value={inlineEditForm.name} onChange={e=>setInlineEditForm({...inlineEditForm,name:e.target.value})} /></td>
                            <td><input className="inline-edit-input" value={inlineEditForm.phone} maxLength={10} onChange={e=>setInlineEditForm({...inlineEditForm,phone:e.target.value.replace(/\D/g,'')})} /></td>
                            <td><input className="inline-edit-input" value={inlineEditForm.address} onChange={e=>setInlineEditForm({...inlineEditForm,address:e.target.value})} /></td>
                            <td>{stats.count}</td>
                            <td className={stats.outstanding>0?'outstanding-due':'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                            <td><div className="inline-action-btns"><button className="inline-save-btn" onClick={()=>saveInlineEdit(c._id)} disabled={loading}>Save</button><button className="inline-cancel-btn" onClick={cancelInlineEdit}>Cancel</button></div></td>
                          </tr>
                        ) : (
                          <tr key={c._id} className={isSel?'client-row-selected':''} style={{cursor:'pointer'}} onClick={()=>handleRowClick(c)}>
                            <td><span className="client-code-tag">{c.clientCode}</span></td>
                            <td style={{fontWeight:600}}>{c.name}</td>
                            <td>{c.phone}</td>
                            <td>{c.address}</td>
                            <td><span className="invoices-count-badge">{stats.count}</span></td>
                            <td className={stats.outstanding>0?'outstanding-due':'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                            <td><button className="table-edit-btn" onClick={e=>{e.stopPropagation();startInlineEdit(c);}}>Edit</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>)}
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default ClientPage;