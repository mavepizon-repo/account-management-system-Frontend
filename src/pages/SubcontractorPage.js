import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/Subcontractorpage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

const emptyForm = { name: '', phone: '', email: '', address: '', companyName: '', skillType: '', gstNumber: '' };

const SubFormFields = ({ form, setForm }) => (
  <div className="form-row sub-form-grid">
    <div className="form-field">
      <label className="field-label">Name *</label>
      <input className="field-input" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">Phone *</label>
      <input className="field-input" placeholder="10 digit number" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
    </div>
    <div className="form-field">
      <label className="field-label">Email</label>
      <input className="field-input" placeholder="email@example.com" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">Skill / Trade</label>
      <input className="field-input" placeholder="Civil, Electrical, Plumbing..." value={form.skillType} onChange={e => setForm({ ...form, skillType: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">Company Name</label>
      <input className="field-input" placeholder="Company or firm name" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">GST Number</label>
      <input className="field-input" placeholder="GST Number" value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} />
    </div>
    <div className="form-field full-width">
      <label className="field-label">Address</label>
      <textarea className="field-input" placeholder="Enter full address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
    </div>
  </div>
);

function SubcontractorPage({ onLogout }) {
  const navigate = useNavigate();

  const [subs, setSubs]         = useState([]);
  const [works, setWorks]       = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const [addForm, setAddForm] = useState(emptyForm);

  // UPDATE — searchable dropdown
  const [updateSubId, setUpdateSubId]   = useState('');
  const [updateFound, setUpdateFound]   = useState(null);
  const [updateForm, setUpdateForm]     = useState(emptyForm);

  // DELETE — searchable dropdown
  const [deleteSubId, setDeleteSubId]   = useState('');
  const [deleteFound, setDeleteFound]   = useState(null);

  // GET ALL
  const [selectedSub, setSelectedSub]         = useState('');
  const [profileSub, setProfileSub]           = useState(null);
  const [inlineEditId, setInlineEditId]       = useState(null);
  const [inlineEditForm, setInlineEditForm]   = useState(emptyForm);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch ─────────────────────────────────────────────────
  const fetchSubs = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      setSubs(data.data || []);
    } catch { showToast('Failed to fetch subcontractors', 'error'); }
    finally { setLoading(false); }
  };

  const fetchWorks = async () => {
    try {
      const res  = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      setWorks(data.works || []);
    } catch {}
  };

  useEffect(() => { fetchSubs(); fetchWorks(); }, []);

  // ── Options for SearchableDropdown ─────────────────────────
  const subOptions = subs.map(s => ({
    value: s._id,
    label: `${s.subcontractCode} — ${s.name}${s.phone ? ` (${s.phone})` : ''}${s.skillType ? ` · ${s.skillType}` : ''}`,
  }));

  // ── Stats ─────────────────────────────────────────────────
  const getSubStats = (subId) => {
    const subWorks = works.filter(w => {
      const s = w.subcontract;
      return typeof s === 'object' ? s._id === subId : s === subId;
    });
    const totalAmt  = subWorks.reduce((s, w) => s + (w.totalAmount || 0), 0);
    const totalPaid = subWorks.reduce((s, w) => s + (w.paidAmount  || 0), 0);
    return { count: subWorks.length, totalAmt, totalPaid, outstanding: totalAmt - totalPaid, subWorks };
  };

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateSubId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteSubId(''); setDeleteFound(null);
    setSelectedSub(''); setProfileSub(null); setInlineEditId(null);
  };

  // ── ADD ───────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.phone) {
      showToast('Name and Phone are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API}/subcontract/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSubs();
        setAddForm(emptyForm);
        showToast(`${data.data?.name || 'Subcontractor'} added successfully!`);
      } else showToast(data.message || 'Failed to add', 'error');
    } catch { showToast('Error adding subcontractor', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE — searchable dropdown select ───────────────────
  const handleUpdateSelect = (subId) => {
    setUpdateSubId(subId);
    const found = subs.find(s => s._id === subId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        name:        found.name,
        phone:       found.phone       || '',
        email:       found.email       || '',
        address:     found.address     || '',
        companyName: found.companyName || '',
        skillType:   found.skillType   || '',
        gstNumber:   found.gstNumber   || '',
      });
    } else {
      setUpdateFound(null);
      setUpdateForm(emptyForm);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a subcontractor', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/subcontract/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });
      if (res.ok) {
        await fetchSubs();
        showToast(`${updateForm.name} updated!`);
        setUpdateFound(null); setUpdateSubId(''); setUpdateForm(emptyForm);
      } else showToast('Failed to update', 'error');
    } catch { showToast('Error updating', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE — searchable dropdown select ───────────────────
  const handleDeleteSelect = (subId) => {
    setDeleteSubId(subId);
    setDeleteFound(subs.find(s => s._id === subId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a subcontractor', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/subcontract/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchSubs();
        showToast(`${deleteFound.name} deleted!`, 'info');
        setDeleteFound(null); setDeleteSubId('');
      } else showToast('Failed to delete', 'error');
    } catch { showToast('Error deleting', 'error'); }
    finally { setLoading(false); }
  };

  // ── Inline edit ───────────────────────────────────────────
  const startInlineEdit = (sub) => {
    setInlineEditId(sub._id);
    setInlineEditForm({
      name:        sub.name,
      phone:       sub.phone       || '',
      email:       sub.email       || '',
      address:     sub.address     || '',
      companyName: sub.companyName || '',
      skillType:   sub.skillType   || '',
      gstNumber:   sub.gstNumber   || '',
    });
    setSelectedSub('');
  };

  const cancelInlineEdit = () => { setInlineEditId(null); setInlineEditForm(emptyForm); };

  const saveInlineEdit = async (id) => {
    if (!inlineEditForm.name) { showToast('Name is required', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/subcontract/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inlineEditForm),
      });
      if (res.ok) {
        await fetchSubs();
        showToast(`${inlineEditForm.name} updated!`);
        setInlineEditId(null); setInlineEditForm(emptyForm);
      }
    } catch { showToast('Error updating', 'error'); }
    finally { setLoading(false); }
  };

  const profileStats = profileSub ? getSubStats(profileSub._id) : null;

  const statusBadge = (status) => {
    const map = { Paid: 'status-paid', Partial: 'status-partial', Unpaid: 'status-pending' };
    return <span className={`status-badge ${map[status] || 'status-pending'}`}>{status || 'Unpaid'}</span>;
  };

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        {/* Header */}
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">Subcontractor Management</h1>
          <span className="entity-page-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
            {subs.length} Subcontractors
          </span>
        </div>

        {/* Actions */}
        <div className="actions-row">
          <button className="action-btn btn-add"         onClick={() => togglePanel(PANELS.ADD)}>Add Subcontractor</button>
          <button className="action-btn btn-update"      onClick={() => togglePanel(PANELS.UPDATE)}>Update Subcontractor</button>
          <button className="action-btn btn-delete"      onClick={() => togglePanel(PANELS.DELETE)}>Delete Subcontractor</button>
          <button className="action-btn btn-getall"      onClick={() => togglePanel(PANELS.GETALL)}>Get All Subcontractors</button>
          <button className="action-btn sub-btn-project" onClick={() => navigate('/work-subcontract')}>Project Details</button>
          <button className="action-btn sub-btn-voucher" onClick={() => navigate('/vouchers')}>🗂️ Vouchers</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner sub-loading" /></div>}

        {/* ── ADD ── */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Subcontractor</div>
            <form onSubmit={handleAdd}>
              <SubFormFields form={addForm} setForm={setAddForm} />
              <div className="sub-code-preview">
                Auto Code: <strong>SC**** (auto-generated)</strong>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>Add Subcontractor</button>
            </form>
          </div>
        )}

        {/* ── UPDATE — searchable dropdown ── */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Subcontractor</div>

            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Subcontractor *</label>
              <SearchableDropdown
                options={subOptions}
                value={updateSubId}
                onChange={handleUpdateSelect}
                placeholder="-- Select Subcontractor --"
              />
            </div>

            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.subcontractCode}</span>
                  <span className="update-found-name">{updateFound.name}</span>
                  {updateFound.skillType && (
                    <span className="sub-skill-tag" style={{ marginLeft: 6 }}>{updateFound.skillType}</span>
                  )}
                </div>
                <form onSubmit={handleUpdate}>
                  <SubFormFields form={updateForm} setForm={setUpdateForm} />
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Subcontractor
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ── DELETE — searchable dropdown ── */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Subcontractor</div>

            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Subcontractor *</label>
              <SearchableDropdown
                options={subOptions}
                value={deleteSubId}
                onChange={handleDeleteSelect}
                placeholder="-- Select Subcontractor --"
              />
            </div>

            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Code',    deleteFound.subcontractCode],
                  ['Name',    deleteFound.name],
                  ['Phone',   deleteFound.phone    || '—'],
                  ['Email',   deleteFound.email    || '—'],
                  ['Company', deleteFound.companyName || '—'],
                  ['Skill',   deleteFound.skillType   || '—'],
                  ['GST No',  deleteFound.gstNumber   || '—'],
                  ['Address', deleteFound.address     || '—'],
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

        {/* ── GET ALL ── */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Subcontractors</div>

            {subs.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No subcontractors found.</p></div>
            ) : (
              <>
                <div className="form-field" style={{ marginBottom: 24 }}>
                  <label className="field-label">Select Subcontractor (View Profile)</label>
                  <SearchableDropdown
                    options={subs.map(s => ({ value: s._id, label: `${s.subcontractCode} — ${s.name}` }))}
                    value={selectedSub}
                    onChange={(val) => {
                      setSelectedSub(val);
                      setInlineEditId(null);
                      setProfileSub(subs.find(s => s._id === val) || null);
                    }}
                    placeholder="-- Select Subcontractor --"
                  />
                </div>

                {/* Profile card */}
                {profileSub && profileStats && (
                  <div className="sub-profile-card">
                    <div className="sub-cp-header">
                      <div className="sub-cp-avatar">{profileSub.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div className="sub-cp-name">{profileSub.name}</div>
                        <div className="sub-cp-meta">{profileSub.subcontractCode} &nbsp;·&nbsp; {profileSub.phone || '—'}</div>
                        {profileSub.skillType   && <div className="sub-skill-badge">{profileSub.skillType}</div>}
                        {profileSub.companyName && <div className="sub-cp-company">{profileSub.companyName}</div>}
                        {profileSub.gstNumber   && <div className="sub-cp-gst">GST: {profileSub.gstNumber}</div>}
                        <div className="sub-cp-address">{profileSub.address || '—'}</div>
                      </div>
                      <button className="sub-project-btn" onClick={() => navigate('/work-subcontract')}>
                        View Projects →
                      </button>
                    </div>

                    <div className="sub-stats-row">
                      <div className="sub-stat sub-stat-total"><span>Total Projects</span><strong>{profileStats.count}</strong></div>
                      <div className="sub-stat sub-stat-billed"><span>Total Contract</span><strong>₹{profileStats.totalAmt.toLocaleString('en-IN')}</strong></div>
                      <div className="sub-stat sub-stat-paid"><span>Total Paid</span><strong>₹{profileStats.totalPaid.toLocaleString('en-IN')}</strong></div>
                      <div className="sub-stat sub-stat-due"><span>Outstanding</span><strong>₹{profileStats.outstanding.toLocaleString('en-IN')}</strong></div>
                    </div>

                    {profileStats.subWorks.length > 0 ? (
                      <>
                        <div className="sub-section-title">Project History</div>
                        <div className="sub-work-table-wrap">
                          <table className="clients-table sub-work-table">
                            <thead>
                              <tr>
                                <th>Project</th><th>Description</th><th>Start</th><th>End</th>
                                <th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profileStats.subWorks.map(w => {
                                const bal = (w.totalAmount || 0) - (w.paidAmount || 0);
                                return (
                                  <tr key={w._id}>
                                    <td style={{ fontWeight: 700 }}>{w.projectName}</td>
                                    <td>{w.description || '—'}</td>
                                    <td>{w.startDate?.split('T')[0] || '—'}</td>
                                    <td>{w.endDate?.split('T')[0] || '—'}</td>
                                    <td><span className={`work-status-badge ws-${(w.status || 'pending').toLowerCase().replace(' ', '-')}`}>{w.status || '—'}</span></td>
                                    <td className="amt-cell">₹{Number(w.totalAmount).toLocaleString('en-IN')}</td>
                                    <td className="paid-cell">₹{Number(w.paidAmount).toLocaleString('en-IN')}</td>
                                    <td className={bal > 0 ? 'due-cell' : 'zero-cell'}>₹{Number(bal).toLocaleString('en-IN')}</td>
                                    <td>{statusBadge(w.paymentStatus)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="sub-no-works">No projects found for this subcontractor.</div>
                    )}
                  </div>
                )}

                {/* Main table */}
                <div style={{ marginTop: 24 }}>
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th>Code</th><th>Name</th><th>Phone</th><th>Skill</th>
                        <th>Company</th><th>Projects</th><th>Outstanding</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map(s => {
                        const stats = getSubStats(s._id);
                        return inlineEditId === s._id ? (
                          <tr key={s._id} className="inline-edit-row">
                            <td><span className="sub-code-tag">{s.subcontractCode}</span></td>
                            <td><input className="inline-edit-input" value={inlineEditForm.name} onChange={e => setInlineEditForm({ ...inlineEditForm, name: e.target.value })} /></td>
                            <td><input className="inline-edit-input" value={inlineEditForm.phone} maxLength={10} onChange={e => setInlineEditForm({ ...inlineEditForm, phone: e.target.value.replace(/\D/g, '') })} /></td>
                            <td><input className="inline-edit-input" value={inlineEditForm.skillType} onChange={e => setInlineEditForm({ ...inlineEditForm, skillType: e.target.value })} /></td>
                            <td><input className="inline-edit-input" value={inlineEditForm.companyName} onChange={e => setInlineEditForm({ ...inlineEditForm, companyName: e.target.value })} /></td>
                            <td>{stats.count}</td>
                            <td className={stats.outstanding > 0 ? 'outstanding-due' : 'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                            <td>
                              <div className="inline-action-btns">
                                <button className="inline-save-btn" onClick={() => saveInlineEdit(s._id)} disabled={loading}>Save</button>
                                <button className="inline-cancel-btn" onClick={cancelInlineEdit}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedSub(s._id); setProfileSub(s); }}>
                            <td><span className="sub-code-tag">{s.subcontractCode}</span></td>
                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                            <td>{s.phone || '—'}</td>
                            <td>{s.skillType ? <span className="sub-skill-tag">{s.skillType}</span> : '—'}</td>
                            <td>{s.companyName || '—'}</td>
                            <td><span className="invoices-count-badge">{stats.count}</span></td>
                            <td className={stats.outstanding > 0 ? 'outstanding-due' : 'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                            <td><button className="table-edit-btn" onClick={e => { e.stopPropagation(); startInlineEdit(s); }}>Edit</button></td>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default SubcontractorPage;