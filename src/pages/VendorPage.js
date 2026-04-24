import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/Vendorpage.css';
import '../styles/SearchableDropdown.css';

const API_BASE_URL =`${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const emptyForm = { name: '', phone: '', address: '', gstNo: '', notes: '' };

function VendorPage({ onLogout }) {
  const navigate = useNavigate();

  const [vendors,   setVendors]   = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [activePanel, setPanel]   = useState(null);
  const [toast,     setToast]     = useState(null);
  const [loading,   setLoading]   = useState(false);

  // ADD
  const [addForm, setAddForm] = useState(emptyForm);

  // UPDATE
  const [updateVendorId, setUpdateVendorId] = useState('');
  const [updateFound,    setUpdateFound]    = useState(null);
  const [updateForm,     setUpdateForm]     = useState(emptyForm);

  // DELETE
  const [deleteVendorId, setDeleteVendorId] = useState('');
  const [deleteFound,    setDeleteFound]    = useState(null);

  // GET ALL
  const [selectedVendor, setSelectedVendor]   = useState('');
  const [profileVendor,  setProfileVendor]    = useState(null);
  const [inlineEditId,   setInlineEditId]     = useState(null);
  const [inlineEditForm, setInlineEditForm]   = useState(emptyForm);

  // GET ALL filters
  const [searchText,      setSearchText]      = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [sortBy,          setSortBy]          = useState('name'); // name | outstanding | bills

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch ────────────────────────────────────────────────
  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/vendor/getall`);
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : (data.data || []));
    } catch { showToast('Failed to fetch vendors', 'error'); }
    finally { setLoading(false); }
  };

  const fetchPurchases = async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/purchase/getall/purchasebill`);
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { fetchVendors(); fetchPurchases(); }, []);

  // ── Stats helpers ────────────────────────────────────────
  const getVendorPurchases = (vendorId) =>
    purchases.filter(p => {
      const v = p.vendor;
      if (!v) return false;
      return typeof v === 'object' ? v._id === vendorId : v === vendorId;
    });

  const getVendorStats = (vendorId) => {
    const bills     = getVendorPurchases(vendorId);
    const totalNet  = bills.reduce((s, b) => s + (b.netTotal   || 0), 0);
    const totalPaid = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
    return { count: bills.length, totalNet, totalPaid, outstanding: totalNet - totalPaid, bills };
  };

  // ── Dropdown options for SearchableDropdown ──────────────
  const vendorOptions = vendors.map(v => ({
    value: v._id,
    label: `${v.vendorCode} — ${v.name}${v.phone ? ` (${v.phone})` : ''}`,
  }));

  // ── Toggle panel ─────────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateVendorId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteVendorId(''); setDeleteFound(null);
    setSelectedVendor(''); setInlineEditId(null); setProfileVendor(null);
    setSearchText(''); setOutstandingOnly(false); setSortBy('name');
  };

  // ── ADD ──────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name) { showToast('Please enter vendor name', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/vendor/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchVendors();
        setAddForm(emptyForm);
        showToast(`${data.name} added successfully!`);
      } else showToast(data.message || 'Failed to add vendor', 'error');
    } catch { showToast('Error adding vendor', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ───────────────────────────────────────────────
  const handleUpdateSelect = (vendorId) => {
    setUpdateVendorId(vendorId);
    const found = vendors.find(v => v._id === vendorId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({ name: found.name, phone: found.phone || '', address: found.address || '', gstNo: found.gstNo || '', notes: found.notes || '' });
    } else { setUpdateFound(null); setUpdateForm(emptyForm); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a vendor', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/vendor/edit/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });
      if (res.ok) {
        await fetchVendors();
        showToast(`${updateForm.name} updated successfully!`);
        setUpdateFound(null); setUpdateVendorId(''); setUpdateForm(emptyForm);
      } else showToast('Failed to update vendor', 'error');
    } catch { showToast('Error updating vendor', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ───────────────────────────────────────────────
  const handleDeleteSelect = (vendorId) => {
    setDeleteVendorId(vendorId);
    setDeleteFound(vendors.find(v => v._id === vendorId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a vendor', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/vendor/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchVendors();
        showToast(`${deleteFound.name} deleted successfully!`, 'info');
        setDeleteFound(null); setDeleteVendorId('');
      } else showToast('Failed to delete vendor', 'error');
    } catch { showToast('Error deleting vendor', 'error'); }
    finally { setLoading(false); }
  };

  // ── Inline edit ──────────────────────────────────────────
  const startInlineEdit = (vendor) => {
    setInlineEditId(vendor._id);
    setInlineEditForm({ name: vendor.name, phone: vendor.phone || '', address: vendor.address || '', gstNo: vendor.gstNo || '', notes: vendor.notes || '' });
    setSelectedVendor('');
  };
  const cancelInlineEdit = () => { setInlineEditId(null); setInlineEditForm(emptyForm); };

  const saveInlineEdit = async (vendorId) => {
    if (!inlineEditForm.name) { showToast('Please enter vendor name', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/vendor/edit/${vendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineEditForm),
      });
      if (res.ok) {
        await fetchVendors();
        showToast(`${inlineEditForm.name} updated successfully!`);
        setInlineEditId(null); setInlineEditForm(emptyForm);
      }
    } catch { showToast('Error updating vendor', 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered & sorted vendors ────────────────────────────
  const filteredVendors = useMemo(() => {
    let list = vendors.map(v => ({ ...v, _stats: getVendorStats(v._id) }));

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.vendorCode || '').toLowerCase().includes(q) ||
        (v.phone || '').includes(q) ||
        (v.gstNo || '').toLowerCase().includes(q)
      );
    }

    if (outstandingOnly) list = list.filter(v => v._stats.outstanding > 0);

    list.sort((a, b) => {
      if (sortBy === 'outstanding') return b._stats.outstanding - a._stats.outstanding;
      if (sortBy === 'bills')       return b._stats.count - a._stats.count;
      return a.name.localeCompare(b.name);
    });

    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors, purchases, searchText, outstandingOnly, sortBy]);

  // ── Summary totals for GETALL ────────────────────────────
  const totalOutstanding = vendors.reduce((s, v) => s + getVendorStats(v._id).outstanding, 0);
  const totalBills       = purchases.length;
  const totalPaid        = purchases.reduce((s, b) => s + (b.paidAmount || 0), 0);
  const totalNet         = purchases.reduce((s, b) => s + (b.netTotal   || 0), 0);

  const profileStats = profileVendor ? getVendorStats(profileVendor._id) : null;

  const statusBadge = (status) => {
    const map = { paid: 'status-paid', partial: 'status-partial', unpaid: 'status-pending' };
    return <span className={`status-badge ${map[status] || 'status-pending'}`}>{status}</span>;
  };

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">Vendor Management</h1>
          <span className="entity-page-badge" style={{ background: '#fdf4ff', color: '#9333ea', border: '1px solid #e9d5ff' }}>
            {vendors.length} Vendors
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"          onClick={() => togglePanel(PANELS.ADD)}>Add Vendor</button>
          <button className="action-btn btn-update"       onClick={() => togglePanel(PANELS.UPDATE)}>Update Vendor</button>
          <button className="action-btn btn-delete"       onClick={() => togglePanel(PANELS.DELETE)}>Delete Vendor</button>
          <button className="action-btn btn-getall"       onClick={() => togglePanel(PANELS.GETALL)}>Get All Vendors</button>
          <button className="action-btn vnd-btn-purchase" onClick={() => navigate('/purchase-bills')}>Purchase Bills</button>
          <button className="action-btn vnd-btn-voucher"  onClick={() => navigate('/vouchers')}>🗂️ Vouchers</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ════ ADD ════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Vendor</div>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="form-field">
                  <label className="field-label">Vendor Name *</label>
                  <input className="field-input" placeholder="Enter vendor name"
                    value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Phone</label>
                  <input className="field-input" placeholder="10 digit number" maxLength={10}
                    value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="form-field">
                  <label className="field-label">GST No</label>
                  <input className="field-input" placeholder="GST Number"
                    value={addForm.gstNo} onChange={e => setAddForm({ ...addForm, gstNo: e.target.value })} />
                </div>
                <div className="form-field full-width">
                  <label className="field-label">Address</label>
                  <textarea className="field-input" placeholder="Enter full address"
                    value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} />
                </div>
                <div className="form-field full-width">
                  <label className="field-label">Notes</label>
                  <textarea className="field-input" placeholder="Additional notes (optional)"
                    value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>Add Vendor</button>
            </form>
          </div>
        )}

        {/* ════ UPDATE ════ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Vendor</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Vendor *</label>
              <SearchableDropdown
                options={vendorOptions}
                value={updateVendorId}
                onChange={handleUpdateSelect}
                placeholder="Search vendor by name, code or phone..."
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.vendorCode}</span>
                  <span className="update-found-name">{updateFound.name}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="field-label">Vendor Name</label>
                      <input className="field-input" value={updateForm.name} onChange={e => setUpdateForm({ ...updateForm, name: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Phone</label>
                      <input className="field-input" value={updateForm.phone} maxLength={10} onChange={e => setUpdateForm({ ...updateForm, phone: e.target.value.replace(/\D/g, '') })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">GST No</label>
                      <input className="field-input" value={updateForm.gstNo} onChange={e => setUpdateForm({ ...updateForm, gstNo: e.target.value })} />
                    </div>
                    <div className="form-field full-width">
                      <label className="field-label">Address</label>
                      <textarea className="field-input" value={updateForm.address} onChange={e => setUpdateForm({ ...updateForm, address: e.target.value })} />
                    </div>
                    <div className="form-field full-width">
                      <label className="field-label">Notes</label>
                      <textarea className="field-input" value={updateForm.notes} onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ════ DELETE ════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Vendor</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Vendor *</label>
              <SearchableDropdown
                options={vendorOptions}
                value={deleteVendorId}
                onChange={handleDeleteSelect}
                placeholder="Search vendor to delete..."
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Vendor Code', deleteFound.vendorCode],
                  ['Name',        deleteFound.name],
                  ['Phone',       deleteFound.phone   || '—'],
                  ['GST No',      deleteFound.gstNo   || '—'],
                  ['Address',     deleteFound.address || '—'],
                  ['Notes',       deleteFound.notes   || '—'],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                ))}
                <div className="vendor-delete-warn">⚠️ Deleting this vendor is permanent and cannot be undone.</div>
                <button className="delete-confirm-btn" style={{ marginTop: 16 }} onClick={handleDelete} disabled={loading}>
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ GET ALL ════ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Vendors</div>

            {/* Summary cards */}
            <div className="vnd-stats-row" style={{ marginBottom: 20 }}>
              <div className="vnd-stat vnd-stat-total"><span>Total Vendors</span><strong>{vendors.length}</strong></div>
              <div className="vnd-stat vnd-stat-billed"><span>Total Billed</span><strong>₹{totalNet.toLocaleString('en-IN')}</strong></div>
              <div className="vnd-stat vnd-stat-received"><span>Total Paid</span><strong>₹{totalPaid.toLocaleString('en-IN')}</strong></div>
              <div className="vnd-stat vnd-stat-due"><span>Outstanding</span><strong>₹{totalOutstanding.toLocaleString('en-IN')}</strong></div>
            </div>

            {vendors.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No vendors found. Please add new!</p></div>
            ) : (
              <>
                {/* Profile dropdown */}
                <div className="form-field" style={{ marginBottom: 24 }}>
                  <label className="field-label">Select Vendor (View Profile)</label>
                  <SearchableDropdown
                    options={vendors.map(v => ({ value: v._id, label: `${v.vendorCode} — ${v.name}` }))}
                    value={selectedVendor}
                    onChange={(val) => {
                      setSelectedVendor(val);
                      setInlineEditId(null);
                      setProfileVendor(vendors.find(v => v._id === val) || null);
                    }}
                    placeholder="Search and select a vendor to view profile..."
                  />
                </div>

                {/* Profile card */}
                {profileVendor && profileStats && (
                  <div className="vnd-profile-card">
                    <div className="vnd-cp-header">
                      <div className="vnd-cp-avatar">{profileVendor.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="vnd-cp-name">{profileVendor.name}</div>
                        <div className="vnd-cp-meta">{profileVendor.vendorCode} &nbsp;·&nbsp; {profileVendor.phone || '—'}</div>
                        {profileVendor.gstNo && <div className="vnd-cp-gst">GST: {profileVendor.gstNo}</div>}
                        <div className="vnd-cp-address">{profileVendor.address || '—'}</div>
                      </div>
                    </div>
                    <div className="vnd-stats-row">
                      <div className="vnd-stat vnd-stat-total"><span>Total Bills</span><strong>{profileStats.count}</strong></div>
                      <div className="vnd-stat vnd-stat-billed"><span>Net Total</span><strong>₹{profileStats.totalNet.toLocaleString('en-IN')}</strong></div>
                      <div className="vnd-stat vnd-stat-received"><span>Total Paid</span><strong>₹{profileStats.totalPaid.toLocaleString('en-IN')}</strong></div>
                      <div className="vnd-stat vnd-stat-due"><span>Outstanding</span><strong>₹{profileStats.outstanding.toLocaleString('en-IN')}</strong></div>
                    </div>
                    {profileStats.bills.length > 0 ? (
                      <>
                        <div className="vnd-section-title">Purchase Bill History</div>
                        <div className="vnd-bill-table-wrap">
                          <table className="clients-table vnd-bill-table">
                            <thead>
                              <tr><th>Bill Code</th><th>Invoice No</th><th>Purpose</th><th>Total</th><th>GST</th><th>Net Total</th><th>Paid</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                              {profileStats.bills.map(b => (
                                <tr key={b._id}>
                                  <td><span className="vnd-code-tag">{b.purchaseCode}</span></td>
                                  <td>{b.invoiceNo}</td>
                                  <td style={{ fontWeight: 600 }}>{b.purpose || '—'}</td>
                                  <td className="amt-cell">₹{Number(b.totalPayment).toLocaleString('en-IN')}</td>
                                  <td>₹{Number(b.gstInput || 0).toLocaleString('en-IN')}</td>
                                  <td className="amt-cell">₹{Number(b.netTotal).toLocaleString('en-IN')}</td>
                                  <td className="paid-cell">₹{Number(b.paidAmount).toLocaleString('en-IN')}</td>
                                  <td>{statusBadge(b.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="vnd-no-bills">No purchase bills found for this vendor.</div>
                    )}
                  </div>
                )}

                {/* ── Filters toolbar ── */}
                <div className="getall-filter-bar">
                  <div className="getall-search-wrap">
                    <span className="getall-search-icon">🔍</span>
                    <input
                      className="getall-search-input"
                      placeholder="Search vendors by name, code, phone, GST..."
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                    />
                    {searchText && (
                      <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>
                    )}
                  </div>

                  <label className="getall-toggle">
                    <input type="checkbox" checked={outstandingOnly} onChange={e => setOutstandingOnly(e.target.checked)} />
                    <span>Outstanding only</span>
                  </label>

                  <div className="getall-sort-wrap">
                    <span className="getall-sort-label">Sort:</span>
                    <div className="getall-sort-tabs">
                      {[['name', 'Name'], ['outstanding', 'Outstanding'], ['bills', 'Bills']].map(([k, l]) => (
                        <button key={k} className={`getall-sort-tab${sortBy === k ? ' active' : ''}`} onClick={() => setSortBy(k)}>{l}</button>
                      ))}
                    </div>
                  </div>

                  <span className="getall-count-chip">{filteredVendors.length} vendors</span>
                </div>

                {/* Table */}
                {filteredVendors.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">🔍</div><p>No vendors match your filter.</p></div>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <table className="clients-table">
                      <thead>
                        <tr><th>Vendor Code</th><th>Name</th><th>Phone</th><th>GST No</th><th>Bills</th><th>Outstanding</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {filteredVendors.map(v => {
                          const stats = v._stats;
                          return inlineEditId === v._id ? (
                            <tr key={v._id} className="inline-edit-row">
                              <td>{v.vendorCode}</td>
                              <td><input className="inline-edit-input" value={inlineEditForm.name} onChange={e => setInlineEditForm({ ...inlineEditForm, name: e.target.value })} /></td>
                              <td><input className="inline-edit-input" value={inlineEditForm.phone} maxLength={10} onChange={e => setInlineEditForm({ ...inlineEditForm, phone: e.target.value.replace(/\D/g, '') })} /></td>
                              <td><input className="inline-edit-input" value={inlineEditForm.gstNo} onChange={e => setInlineEditForm({ ...inlineEditForm, gstNo: e.target.value })} /></td>
                              <td>{stats.count}</td>
                              <td className={stats.outstanding > 0 ? 'outstanding-due' : 'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                              <td>
                                <div className="inline-action-btns">
                                  <button className="inline-save-btn" onClick={() => saveInlineEdit(v._id)} disabled={loading}>Save</button>
                                  <button className="inline-cancel-btn" onClick={cancelInlineEdit}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={v._id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedVendor(v._id); setProfileVendor(v); }}>
                              <td><span className="vnd-code-tag">{v.vendorCode}</span></td>
                              <td style={{ fontWeight: 600 }}>{v.name}</td>
                              <td>{v.phone || '—'}</td>
                              <td>{v.gstNo || '—'}</td>
                              <td><span className="invoices-count-badge">{stats.count}</span></td>
                              <td className={stats.outstanding > 0 ? 'outstanding-due' : 'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                              <td><button className="table-edit-btn" onClick={e => { e.stopPropagation(); startInlineEdit(v); }}>Edit</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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

export default VendorPage;