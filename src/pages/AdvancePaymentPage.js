import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/AdvancePaymentPage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

function AdvancePaymentPage({ onLogout }) {
  const navigate = useNavigate();

  const [labours, setLabours]     = useState([]);
  const [advances, setAdvances]   = useState([]);
  const [activePanel, setPanel]   = useState(null);
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(false);

  // ADD
  const [addForm, setAddForm] = useState({
    labour: '', name: '', date: new Date().toISOString().split('T')[0], advanceAmount: ''
  });

  // UPDATE
  const [updateAdvId, setUpdateAdvId]   = useState('');
  const [updateFound, setUpdateFound]   = useState(null);
  const [updateForm, setUpdateForm]     = useState({
    labour: '', name: '', date: '', advanceAmount: '', receivedStatus: false
  });

  // DELETE
  const [deleteAdvId, setDeleteAdvId]   = useState('');
  const [deleteFound, setDeleteFound]   = useState(null);

  // GETALL
  const [selectedAdvId, setSelectedAdvId] = useState('');
  const [labourFilter, setLabourFilter]   = useState('');
  const [statusFilter, setStatusFilter]   = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch labours ─────────────────────────────────────────
  // Backend: GET /api/labours/getall → returns array directly
  const fetchLabours = async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/labours/getall`);
      const data = await res.json();
      setLabours(Array.isArray(data) ? data : []);
    } catch { showToast('Failed to fetch labours', 'error'); }
  };

  // ── Fetch advances ────────────────────────────────────────
  // Backend: GET /api/advancePayment/getall → returns array with populated labour
  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/advancePayment/getall`);
      const data = await res.json();
      setAdvances(Array.isArray(data) ? data : []);
    } catch { showToast('Failed to fetch advance payments', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLabours(); fetchAdvances(); }, []);

  // ── Dropdown options ──────────────────────────────────────
  const labourOptions = labours.map(l => ({
    value: l._id,
    label: `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
  }));

  const advanceOptions = advances.map(a => {
    const labName = a.labour?.name || a.name || '—';
    const labId   = a.labour?.labourId || '—';
    return {
      value: a._id,
      label: `${labId} — ${labName} | ₹${Number(a.advanceAmount).toLocaleString('en-IN')} | ${new Date(a.date).toLocaleDateString('en-IN')}`,
    };
  });

  // ── Toggle panel ──────────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ labour: '', name: '', date: new Date().toISOString().split('T')[0], advanceAmount: '' });
    setUpdateAdvId(''); setUpdateFound(null);
    setUpdateForm({ labour: '', name: '', date: '', advanceAmount: '', receivedStatus: false });
    setDeleteAdvId(''); setDeleteFound(null);
    setSelectedAdvId(''); setLabourFilter(''); setStatusFilter('');
  };

  // ── ADD ───────────────────────────────────────────────────
  // Backend: POST /api/advancePayment/create
  // Body: { labour (MongoDB _id), name, date, advanceAmount }
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.labour || !addForm.date || !addForm.advanceAmount) {
      showToast('Labour, Date and Amount are required', 'error'); return;
    }
    const selectedLabour = labours.find(l => l._id === addForm.labour);
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/advancePayment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labour:        addForm.labour,
          name:          selectedLabour?.name || addForm.name,
          date:          addForm.date,
          advanceAmount: parseFloat(addForm.advanceAmount),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAdvances();
        setAddForm({ labour: '', name: '', date: new Date().toISOString().split('T')[0], advanceAmount: '' });
        showToast(`Advance of ₹${Number(addForm.advanceAmount).toLocaleString('en-IN')} added for ${selectedLabour?.name || ''}!`);
      } else {
        showToast(data.error || data.message || 'Failed to add advance', 'error');
      }
    } catch { showToast('Error adding advance payment', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ────────────────────────────────────────────────
  // Backend: PUT /api/advancePayment/update/:id
  // Body: { labour, name, date, advanceAmount, receivedStatus }
  const handleUpdateSelect = (advId) => {
    setUpdateAdvId(advId);
    const found = advances.find(a => a._id === advId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        labour:         found.labour?._id || found.labour || '',
        name:           found.name || '',
        date:           new Date(found.date).toISOString().split('T')[0],
        advanceAmount:  found.advanceAmount,
        receivedStatus: found.receivedStatus || false,
      });
    } else {
      setUpdateFound(null);
      setUpdateForm({ labour: '', name: '', date: '', advanceAmount: '', receivedStatus: false });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select an advance record', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/advancePayment/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labour:         updateForm.labour,
          name:           updateForm.name,
          date:           updateForm.date,
          advanceAmount:  parseFloat(updateForm.advanceAmount),
          receivedStatus: updateForm.receivedStatus,
        }),
      });
      if (res.ok) {
        await fetchAdvances();
        showToast('Advance payment updated successfully!');
        setUpdateFound(null); setUpdateAdvId('');
        setUpdateForm({ labour: '', name: '', date: '', advanceAmount: '', receivedStatus: false });
      } else { showToast('Failed to update advance payment', 'error'); }
    } catch { showToast('Error updating advance payment', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ────────────────────────────────────────────────
  // Backend: DELETE /api/advancePayment/delete/:id
  const handleDeleteSelect = (advId) => {
    setDeleteAdvId(advId);
    setDeleteFound(advances.find(a => a._id === advId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select an advance record', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/advancePayment/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAdvances();
        showToast('Advance payment deleted successfully!', 'info');
        setDeleteFound(null); setDeleteAdvId('');
      } else { showToast('Failed to delete advance payment', 'error'); }
    } catch { showToast('Error deleting advance payment', 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered advances ─────────────────────────────────────
  const filteredAdvances = advances.filter(a => {
    const matchLabour = labourFilter
      ? (a.labour?._id === labourFilter || a.labour === labourFilter)
      : true;
    const matchStatus = statusFilter === ''
      ? true
      : statusFilter === 'received'
        ? a.receivedStatus === true
        : a.receivedStatus !== true;
    return matchLabour && matchStatus;
  });

  const totalAdvanceAll    = filteredAdvances.reduce((s, a) => s + (a.advanceAmount || 0), 0);
  const totalReceivedAll   = filteredAdvances.filter(a => a.receivedStatus).reduce((s, a) => s + (a.advanceAmount || 0), 0);
  const totalPendingAll    = totalAdvanceAll - totalReceivedAll;
  const selectedAdvObj     = advances.find(a => a._id === selectedAdvId);

  const getLabourInfo = (adv) => {
    const id = adv.labour?._id || adv.labour;
    return labours.find(l => l._id === id);
  };

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/labour')}>←</button>
          <h1 className="entity-page-title">💰 Advance Payments</h1>
          <span className="entity-page-badge adv-badge">
            {advances.length} Records
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Advance</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Advance</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Advance</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>All Advances</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner adv-loading-inner" /></div>}

        {/* ══ ADD ══════════════════════════════════════════════════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add Advance Payment</div>
            <form onSubmit={handleAdd}>
              <div className="form-row adv-form-grid">
                <div className="form-field">
                  <label className="field-label">Labour *</label>
                  <SearchableDropdown
                    options={labourOptions}
                    value={addForm.labour}
                    onChange={val => setAddForm({ ...addForm, labour: val })}
                    placeholder="-- Select Labour --"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Date *</label>
                  <input className="field-input" type="date"
                    value={addForm.date}
                    onChange={e => setAddForm({ ...addForm, date: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Advance Amount (₹) *</label>
                  <input className="field-input" type="number" placeholder="0.00"
                    value={addForm.advanceAmount}
                    onChange={e => setAddForm({ ...addForm, advanceAmount: e.target.value })} />
                </div>
              </div>

              {/* Labour info preview */}
              {addForm.labour && (() => {
                const lab = labours.find(l => l._id === addForm.labour);
                return lab ? (
                  <div className="adv-labour-info">
                    <div className="adv-info-item"><span>Labour ID:</span><strong>{lab.labourId}</strong></div>
                    <div className="adv-info-item"><span>Name:</span><strong>{lab.name}</strong></div>
                    <div className="adv-info-item"><span>Work Type:</span><strong>{lab.workType || '—'}</strong></div>
                    <div className="adv-info-item"><span>Daily Wage:</span><strong>₹{Number(lab.dailyWage || 0).toLocaleString('en-IN')}</strong></div>
                  </div>
                ) : null;
              })()}

              {/* Amount preview */}
              {addForm.advanceAmount && (
                <div className="adv-amount-preview">
                  <div className="adv-preview-item">
                    <span>Advance Amount</span>
                    <strong>₹{Number(addForm.advanceAmount || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  {addForm.labour && (() => {
                    const lab = labours.find(l => l._id === addForm.labour);
                    if (!lab?.dailyWage) return null;
                    const days = (parseFloat(addForm.advanceAmount) / lab.dailyWage).toFixed(1);
                    return (
                      <div className="adv-preview-item">
                        <span>Equivalent Days</span>
                        <strong>{days} days</strong>
                      </div>
                    );
                  })()}
                </div>
              )}

              <button type="submit" className="submit-btn adv-submit-btn" disabled={loading}>
                💰 Add Advance Payment
              </button>
            </form>
          </div>
        )}

        {/* ══ UPDATE ═══════════════════════════════════════════════ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Advance Payment</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Advance Record *</label>
              <SearchableDropdown
                options={advanceOptions}
                value={updateAdvId}
                onChange={handleUpdateSelect}
                placeholder="-- Select Advance --"
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id adv-id-tag">
                    {updateFound.labour?.labourId || '—'}
                  </span>
                  <span className="update-found-name">
                    {updateFound.name} — ₹{Number(updateFound.advanceAmount).toLocaleString('en-IN')}
                  </span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row adv-form-grid">
                    <div className="form-field">
                      <label className="field-label">Labour</label>
                      <SearchableDropdown
                        options={labourOptions}
                        value={updateForm.labour}
                        onChange={val => {
                          const lab = labours.find(l => l._id === val);
                          setUpdateForm({ ...updateForm, labour: val, name: lab?.name || updateForm.name });
                        }}
                        placeholder="-- Select Labour --"
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Date *</label>
                      <input className="field-input" type="date"
                        value={updateForm.date}
                        onChange={e => setUpdateForm({ ...updateForm, date: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Advance Amount (₹) *</label>
                      <input className="field-input" type="number"
                        value={updateForm.advanceAmount}
                        onChange={e => setUpdateForm({ ...updateForm, advanceAmount: e.target.value })} />
                    </div>
                  </div>

                  {/* Received Status toggle */}
                  <div className="adv-status-toggle-wrap">
                    <span className="field-label">Payment Received Status</span>
                    <div className="adv-status-toggle-row">
                      <button type="button"
                        className={`adv-status-btn ${!updateForm.receivedStatus ? 'adv-status-pending' : ''}`}
                        onClick={() => setUpdateForm({ ...updateForm, receivedStatus: false })}>
                        ⏳ Pending
                      </button>
                      <button type="button"
                        className={`adv-status-btn ${updateForm.receivedStatus ? 'adv-status-received' : ''}`}
                        onClick={() => setUpdateForm({ ...updateForm, receivedStatus: true })}>
                        ✅ Received
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Advance
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE ═══════════════════════════════════════════════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Advance Payment</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Advance Record *</label>
              <SearchableDropdown
                options={advanceOptions}
                value={deleteAdvId}
                onChange={handleDeleteSelect}
                placeholder="-- Select Advance --"
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Labour ID',      deleteFound.labour?.labourId || '—'],
                  ['Name',           deleteFound.name || '—'],
                  ['Work Type',      (() => { const l = getLabourInfo(deleteFound); return l?.workType || '—'; })()],
                  ['Date',           new Date(deleteFound.date).toLocaleDateString('en-IN')],
                  ['Advance Amount', `₹${Number(deleteFound.advanceAmount).toLocaleString('en-IN')}`],
                  ['Status',         deleteFound.receivedStatus ? '✅ Received' : '⏳ Pending'],
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

        {/* ══ GET ALL ══════════════════════════════════════════════ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Advance Payments</div>

            {/* Summary chips */}
            <div className="adv-summary-chips">
              <div className="adv-chip adv-chip-total">
                <span>Total Records</span><strong>{filteredAdvances.length}</strong>
              </div>
              <div className="adv-chip adv-chip-amount">
                <span>Total Advanced</span><strong>₹{totalAdvanceAll.toLocaleString('en-IN')}</strong>
              </div>
              <div className="adv-chip adv-chip-received">
                <span>Received</span><strong>₹{totalReceivedAll.toLocaleString('en-IN')}</strong>
              </div>
              <div className="adv-chip adv-chip-pending">
                <span>Pending</span><strong>₹{totalPendingAll.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Filters */}
            <div className="adv-filter-row">
              <div className="form-field">
                <label className="field-label">Filter by Labour</label>
                <SearchableDropdown
                  options={labourOptions}
                  value={labourFilter}
                  onChange={val => { setLabourFilter(val); setSelectedAdvId(''); }}
                  placeholder="-- All Labours --"
                />
              </div>
              <div className="form-field">
                <label className="field-label">Filter by Status</label>
                <select className="field-input"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setSelectedAdvId(''); }}>
                  <option value="">All Status</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="received">✅ Received</option>
                </select>
              </div>
              <div className="adv-filter-actions">
                {(labourFilter || statusFilter) && (
                  <button className="adv-clear-btn"
                    onClick={() => { setLabourFilter(''); setStatusFilter(''); setSelectedAdvId(''); }}>
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>

            {filteredAdvances.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No advance payment records found.</p>
              </div>
            ) : (
              <>
                {/* Selected detail card */}
                {selectedAdvObj && (
                  <div className="adv-detail-card">
                    <div className="adv-detail-header">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="adv-id-tag">{selectedAdvObj.labour?.labourId || '—'}</span>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedAdvObj.name}</span>
                        <span className="adv-date-tag">{new Date(selectedAdvObj.date).toLocaleDateString('en-IN')}</span>
                        <span className={`adv-status-chip ${selectedAdvObj.receivedStatus ? 'adv-status-chip-received' : 'adv-status-chip-pending'}`}>
                          {selectedAdvObj.receivedStatus ? '✅ Received' : '⏳ Pending'}
                        </span>
                      </div>
                      <button className="cp-close-btn" onClick={() => setSelectedAdvId('')}>✕</button>
                    </div>
                    <div className="adv-detail-grid">
                      {[
                        ['Labour ID',      selectedAdvObj.labour?.labourId || '—'],
                        ['Name',           selectedAdvObj.name || '—'],
                        ['Work Type',      (() => { const l = getLabourInfo(selectedAdvObj); return l?.workType || '—'; })()],
                        ['Daily Wage',     (() => { const l = getLabourInfo(selectedAdvObj); return l ? `₹${Number(l.dailyWage).toLocaleString('en-IN')}` : '—'; })()],
                        ['Date',           new Date(selectedAdvObj.date).toLocaleDateString('en-IN')],
                        ['Amount',         `₹${Number(selectedAdvObj.advanceAmount).toLocaleString('en-IN')}`],
                        ['Status',         selectedAdvObj.receivedStatus ? '✅ Received' : '⏳ Pending'],
                      ].map(([k, v]) => (
                        <div className="adv-detail-item" key={k}>
                          <span className="adv-detail-key">{k}</span>
                          <span className="adv-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="adv-table-scroll">
                  <table className="clients-table adv-table">
                    <thead>
                      <tr>
                        <th>Labour ID</th><th>Name</th><th>Work Type</th>
                        <th>Date</th><th>Amount</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdvances.map(a => {
                        const lab = getLabourInfo(a);
                        const isSelected = selectedAdvId === a._id;
                        return (
                          <tr key={a._id}
                            className={isSelected ? 'adv-row-selected' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedAdvId(isSelected ? '' : a._id)}>
                            <td><span className="adv-id-tag">{a.labour?.labourId || '—'}</span></td>
                            <td style={{ fontWeight: 600 }}>{a.name || '—'}</td>
                            <td>{lab?.workType || '—'}</td>
                            <td><span className="adv-date-tag">{new Date(a.date).toLocaleDateString('en-IN')}</span></td>
                            <td className="adv-amt-cell">₹{Number(a.advanceAmount).toLocaleString('en-IN')}</td>
                            <td>
                              <span className={`adv-status-chip ${a.receivedStatus ? 'adv-status-chip-received' : 'adv-status-chip-pending'}`}>
                                {a.receivedStatus ? '✅ Received' : '⏳ Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="adv-table-footer">
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, paddingRight: 12 }}>Totals →</td>
                        <td className="adv-amt-cell" style={{ fontWeight: 800 }}>
                          ₹{totalAdvanceAll.toLocaleString('en-IN')}
                        </td>
                        <td style={{ fontWeight: 700, color: '#c93360' }}>
                          Pending: ₹{totalPendingAll.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
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

export default AdvancePaymentPage;