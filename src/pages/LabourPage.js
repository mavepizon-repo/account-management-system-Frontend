import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/LabourPage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

function LabourPage({ onLogout }) {
  const navigate = useNavigate();

  const [labours, setLabours]     = useState([]);
  const [activePanel, setPanel]   = useState(null);
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(false);

  // ADD
  const [addForm, setAddForm] = useState({
    name: '', workType: '', phone: '', address: '', dailyWage: '', description: ''
  });

  // UPDATE
  const [updateLabourId, setUpdateLabourId] = useState('');
  const [updateFound, setUpdateFound]       = useState(null);
  const [updateForm, setUpdateForm]         = useState({
    name: '', workType: '', phone: '', address: '', dailyWage: '', description: ''
  });

  // DELETE
  const [deleteLabourId, setDeleteLabourId] = useState('');
  const [deleteFound, setDeleteFound]       = useState(null);

  // GETALL
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [inlineEditId, setInlineEditId]         = useState(null);
  const [inlineForm, setInlineForm]             = useState({
    name: '', workType: '', phone: '', address: '', dailyWage: '', description: ''
  });

  // MONTHLY REPORT
  const [showReport, setShowReport]         = useState(false);
  const [reportMonth, setReportMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [reportLabourId, setReportLabourId] = useState('');
  const [reportData, setReportData]         = useState(null);
  const [reportLoading, setReportLoading]   = useState(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch labours ─────────────────────────────────────────
  // Backend: GET /api/labours/getall → returns array directly
  const fetchLabours = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/labours/getall`);
      const data = await res.json();
      setLabours(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to fetch labours', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLabours(); }, []);

  const labourOptions = labours.map(l => ({
    value: l._id,
    label: `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
  }));

  // ── Toggle panel ──────────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setShowReport(false);
    setAddForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
    setUpdateLabourId(''); setUpdateFound(null);
    setUpdateForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
    setDeleteLabourId(''); setDeleteFound(null);
    setSelectedLabourId(''); setInlineEditId(null);
  };

  const toggleReport = () => {
    setShowReport(prev => !prev);
    setPanel(null);
    setReportLabourId(''); setReportData(null);
    setReportMonth(new Date().toISOString().slice(0, 7));
  };

  // ── ADD ───────────────────────────────────────────────────
  // Backend: POST /api/labours/add
  // Body: { name, phone, address, workType, dailyWage, description }
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.dailyWage || !addForm.phone || !addForm.address || !addForm.workType) {
      showToast('Name, Phone, Address, Work Type and Daily Wage are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        addForm.name,
          phone:       addForm.phone,
          address:     addForm.address,
          workType:    addForm.workType,
          dailyWage:   parseFloat(addForm.dailyWage),
          description: addForm.description,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchLabours();
        setAddForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
        showToast(`${data.name} added successfully!`);
      } else {
        showToast(data.message || 'Failed to add labour', 'error');
      }
    } catch { showToast('Error adding labour', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ────────────────────────────────────────────────
  // Backend: PUT /api/labours/update/:id
  const handleUpdateSelect = (labourMongoId) => {
    setUpdateLabourId(labourMongoId);
    const found = labours.find(l => l._id === labourMongoId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        name:        found.name,
        workType:    found.workType    || '',
        phone:       found.phone       || '',
        address:     found.address     || '',
        dailyWage:   found.dailyWage,
        description: found.description || '',
      });
    } else {
      setUpdateFound(null);
      setUpdateForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a labour', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        updateForm.name,
          phone:       updateForm.phone,
          address:     updateForm.address,
          workType:    updateForm.workType,
          dailyWage:   parseFloat(updateForm.dailyWage),
          description: updateForm.description,
        }),
      });
      if (res.ok) {
        await fetchLabours();
        showToast(`${updateForm.name} updated successfully!`);
        setUpdateFound(null); setUpdateLabourId('');
        setUpdateForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
      } else { showToast('Failed to update labour', 'error'); }
    } catch { showToast('Error updating labour', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ────────────────────────────────────────────────
  // Backend: DELETE /api/labours/delete/:id
  const handleDeleteSelect = (labourMongoId) => {
    setDeleteLabourId(labourMongoId);
    setDeleteFound(labours.find(l => l._id === labourMongoId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a labour', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchLabours();
        showToast(`${deleteFound.name} deleted successfully!`, 'info');
        setDeleteFound(null); setDeleteLabourId('');
      } else { showToast('Failed to delete labour', 'error'); }
    } catch { showToast('Error deleting labour', 'error'); }
    finally { setLoading(false); }
  };

  // ── Inline edit (GETALL table) ────────────────────────────
  const startInlineEdit = (labour) => {
    setInlineEditId(labour._id);
    setInlineForm({
      name:        labour.name,
      workType:    labour.workType    || '',
      phone:       labour.phone       || '',
      address:     labour.address     || '',
      dailyWage:   labour.dailyWage,
      description: labour.description || '',
    });
    setSelectedLabourId('');
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
  };

  const saveInlineEdit = async (labourMongoId) => {
    if (!inlineForm.name || !inlineForm.dailyWage) {
      showToast('Name and Daily Wage are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/update/${labourMongoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        inlineForm.name,
          phone:       inlineForm.phone,
          address:     inlineForm.address,
          workType:    inlineForm.workType,
          dailyWage:   parseFloat(inlineForm.dailyWage),
          description: inlineForm.description,
        }),
      });
      if (res.ok) {
        await fetchLabours();
        showToast(`${inlineForm.name} updated successfully!`);
        setInlineEditId(null);
        setInlineForm({ name: '', workType: '', phone: '', address: '', dailyWage: '', description: '' });
      }
    } catch { showToast('Error updating labour', 'error'); }
    finally { setLoading(false); }
  };

  // ── Monthly Report ────────────────────────────────────────
  // Backend: GET /api/attendance/monthly/:labourId/:year/:month
  // labourId here is MongoDB _id (backend uses Labour.findById)
  const handleLabourMonthlyReport = async () => {
    if (!reportLabourId || !reportMonth) {
      showToast('Please select labour and month', 'error'); return;
    }
    const [year, month] = reportMonth.split('-');
    try {
      setReportLoading(true);
      setReportData(null);
      const res = await fetch(`${API_BASE_URL}/attendance/monthly/${reportLabourId}/${year}/${month}`);
      if (!res.ok) { showToast('Failed to generate report', 'error'); return; }
      const data = await res.json();
      setReportData(data);
      showToast('Report generated successfully!');
    } catch { showToast('Error generating report', 'error'); }
    finally { setReportLoading(false); }
  };

  // ── Excel Download ─────────────────────────────────────────
  // Backend: GET /api/attendance/report-excel/:month/:year
  const handleExcelDownload = async () => {
    if (!reportLabourId || !reportMonth) {
      showToast('Please select labour and month first', 'error'); return;
    }
    const [year, month] = reportMonth.split('-');
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/report-excel/${month}/${year}`);
      if (!res.ok) { showToast('Failed to download Excel', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `attendance_${month}_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Excel downloaded!');
    } catch { showToast('Error downloading Excel', 'error'); }
  };

  const selectedLabourObj  = labours.find(l => l._id === selectedLabourId);
  const reportLabourObj    = labours.find(l => l._id === reportLabourId);

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">👷 Labour Management</h1>
          <span className="entity-page-badge" style={{ background: '#e6fdf6', color: '#04a87f', border: '1px solid #a0f0d8' }}>
            {labours.length} Labours
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Labour</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Labour</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Labour</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>Get All Labours</button>
          <button className="action-btn labour-btn-attendance" onClick={() => navigate('/labour-attendance')}>Labour Attendance</button>
          {/* ✅ NEW: Advance Payment navigation button */}
          <button className="action-btn labour-btn-advance" onClick={() => navigate('/advance-payment')}>Advance Payment</button>
          <button className="action-btn labour-btn-report" onClick={toggleReport}>Monthly Report</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ══ ADD ══════════════════════════════════════════════════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Labour</div>
            <form onSubmit={handleAdd}>
              <div className="form-row labour-form-grid">
                <div className="form-field">
                  <label className="field-label">Name *</label>
                  <input className="field-input" placeholder="Enter labour name"
                    value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Work Type *</label>
                  <input className="field-input" placeholder="Mason / Carpenter"
                    value={addForm.workType} onChange={e => setAddForm({ ...addForm, workType: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Phone *</label>
                  <input className="field-input" placeholder="Phone number"
                    value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Address *</label>
                  <input className="field-input" placeholder="Address"
                    value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Daily Wage (₹) *</label>
                  <input className="field-input" type="number" placeholder="0.00"
                    value={addForm.dailyWage} onChange={e => setAddForm({ ...addForm, dailyWage: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Description</label>
                  <input className="field-input" placeholder="Optional notes"
                    value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} />
                </div>
              </div>

              {addForm.dailyWage && (
                <div className="labour-calc-preview">
                  <div className="calc-item">
                    <span>Daily Wage:</span>
                    <strong>₹{Number(addForm.dailyWage || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="calc-item">
                    <span>Per Hour (8hr day):</span>
                    <strong>₹{(Number(addForm.dailyWage || 0) / 8).toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div className="labour-id-preview">
                Auto ID: <strong>LB*** (auto-generated)</strong>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>Add Labour</button>
            </form>
          </div>
        )}

        {/* ══ UPDATE ═══════════════════════════════════════════════ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Labour</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Labour *</label>
              <SearchableDropdown
                options={labourOptions}
                value={updateLabourId}
                onChange={handleUpdateSelect}
                placeholder="-- Select Labour --"
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.labourId}</span>
                  <span className="update-found-name">{updateFound.name}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row labour-form-grid">
                    <div className="form-field">
                      <label className="field-label">Name *</label>
                      <input className="field-input" value={updateForm.name}
                        onChange={e => setUpdateForm({ ...updateForm, name: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Work Type *</label>
                      <input className="field-input" value={updateForm.workType}
                        onChange={e => setUpdateForm({ ...updateForm, workType: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Phone *</label>
                      <input className="field-input" value={updateForm.phone}
                        onChange={e => setUpdateForm({ ...updateForm, phone: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Address *</label>
                      <input className="field-input" value={updateForm.address}
                        onChange={e => setUpdateForm({ ...updateForm, address: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Daily Wage (₹) *</label>
                      <input className="field-input" type="number" value={updateForm.dailyWage}
                        onChange={e => setUpdateForm({ ...updateForm, dailyWage: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Description</label>
                      <input className="field-input" value={updateForm.description}
                        onChange={e => setUpdateForm({ ...updateForm, description: e.target.value })} />
                    </div>
                  </div>
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Labour
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE ═══════════════════════════════════════════════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Labour</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Labour *</label>
              <SearchableDropdown
                options={labourOptions}
                value={deleteLabourId}
                onChange={handleDeleteSelect}
                placeholder="-- Select Labour --"
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Labour ID',  deleteFound.labourId],
                  ['Name',       deleteFound.name],
                  ['Work Type',  deleteFound.workType  || '—'],
                  ['Phone',      deleteFound.phone     || '—'],
                  ['Address',    deleteFound.address   || '—'],
                  ['Daily Wage', `₹${Number(deleteFound.dailyWage).toLocaleString('en-IN')}`],
                  ['Description',deleteFound.description || '—'],
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
            <div className="panel-title">All Labours</div>
            {labours.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No labours found.</p>
              </div>
            ) : (
              <>
                <div className="form-field" style={{ marginBottom: 24 }}>
                  <label className="field-label">Select Labour (View Details)</label>
                  <SearchableDropdown
                    options={labours.map(l => ({ value: l._id, label: `${l.labourId} — ${l.name}` }))}
                    value={selectedLabourId}
                    onChange={(val) => { setSelectedLabourId(val); setInlineEditId(null); }}
                    placeholder="-- Select Labour --"
                  />
                </div>

                {selectedLabourObj && (
                  <div className="labour-profile-card">
                    <div className="labour-cp-header">
                      <div className="labour-cp-avatar">👷</div>
                      <div style={{ flex: 1 }}>
                        <div className="labour-cp-name">{selectedLabourObj.name}</div>
                        <div className="labour-cp-meta">{selectedLabourObj.labourId} &nbsp;·&nbsp; {selectedLabourObj.workType || 'Worker'}</div>
                        {selectedLabourObj.phone   && <div className="labour-cp-site">📞 {selectedLabourObj.phone}</div>}
                        {selectedLabourObj.address && <div className="labour-cp-site">📍 {selectedLabourObj.address}</div>}
                      </div>
                      <button className="cp-close-btn" onClick={() => setSelectedLabourId('')}>✕</button>
                    </div>
                    <div className="labour-stats-row">
                      <div className="labour-stat labour-stat-wage">
                        <span>Daily Wage</span>
                        <strong>₹{Number(selectedLabourObj.dailyWage).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="labour-stat labour-stat-days">
                        <span>Per Hour</span>
                        <strong>₹{(Number(selectedLabourObj.dailyWage) / 8).toFixed(2)}</strong>
                      </div>
                      <div className="labour-stat labour-stat-salary">
                        <span>Work Type</span>
                        <strong style={{ fontSize: 14 }}>{selectedLabourObj.workType || '—'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 24 }}>
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th>Labour ID</th><th>Name</th><th>Work Type</th>
                        <th>Phone</th><th>Daily Wage</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labours.map(l => (
                        inlineEditId === l._id ? (
                          <tr key={l._id} className="inline-edit-row">
                            <td>{l.labourId}</td>
                            <td><input className="inline-edit-input" value={inlineForm.name}
                              onChange={e => setInlineForm({ ...inlineForm, name: e.target.value })} /></td>
                            <td><input className="inline-edit-input" value={inlineForm.workType}
                              onChange={e => setInlineForm({ ...inlineForm, workType: e.target.value })} /></td>
                            <td><input className="inline-edit-input" value={inlineForm.phone}
                              onChange={e => setInlineForm({ ...inlineForm, phone: e.target.value })} /></td>
                            <td><input className="inline-edit-input" type="number" value={inlineForm.dailyWage}
                              onChange={e => setInlineForm({ ...inlineForm, dailyWage: e.target.value })} /></td>
                            <td>
                              <div className="inline-action-btns">
                                <button className="inline-save-btn" onClick={() => saveInlineEdit(l._id)} disabled={loading}>Save</button>
                                <button className="inline-cancel-btn" onClick={cancelInlineEdit}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={l._id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLabourId(l._id)}>
                            <td><span className="labour-id-tag">{l.labourId}</span></td>
                            <td style={{ fontWeight: 600 }}>{l.name}</td>
                            <td>{l.workType || '—'}</td>
                            <td>{l.phone || '—'}</td>
                            <td className="amt-cell">₹{Number(l.dailyWage).toLocaleString('en-IN')}</td>
                            <td>
                              <button className="table-edit-btn"
                                onClick={e => { e.stopPropagation(); startInlineEdit(l); }}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ MONTHLY REPORT ════════════════════════════════════════ */}
        {showReport && (
          <div className="panel-section" key="report">
            <div className="panel-title">Monthly Attendance Report</div>
            <div className="report-card">
              <div className="report-card-title">Individual Labour Report</div>

              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="field-label">Select Labour *</label>
                {/* value is MongoDB _id — backend uses Labour.findById */}
                <SearchableDropdown
                  options={labourOptions}
                  value={reportLabourId}
                  onChange={(val) => { setReportLabourId(val); setReportData(null); }}
                  placeholder="-- Select Labour --"
                />
              </div>

              <div className="form-field" style={{ marginBottom: 16 }}>
                <label className="field-label">Select Month *</label>
                <input className="field-input" type="month" value={reportMonth}
                  onChange={e => { setReportMonth(e.target.value); setReportData(null); }} />
              </div>

              <div className="report-info-box">
                <span>Generates a detailed attendance summary for the selected labour and month.</span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
                <button className="submit-btn att-report-btn" style={{ flex: 1 }}
                  onClick={handleLabourMonthlyReport}
                  disabled={reportLoading}>
                  {reportLoading ? 'Generating...' : '📊 Generate Report'}
                </button>
                <button className="att-excel-btn" style={{ minWidth: 120 }}
                  onClick={handleExcelDownload}
                  disabled={reportLoading}>
                  ⬇ Excel (All)
                </button>
              </div>

              {/* ── Report Data Display ── */}
              {reportData && (
                <div className="report-pdf-actions">
                  {reportLabourObj && (
                    <div className="report-generated-badge">
                      <span className="labour-id-tag">{reportLabourObj.labourId}</span>
                      <span style={{ fontWeight: 700, color: '#036b4e' }}>{reportLabourObj.name}</span>
                      <span className="att-date-tag">{reportMonth}</span>
                      <span className="report-ready-dot">✓ Ready</span>
                    </div>
                  )}

                  {/* Summary stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '14px 0' }}>
                    {[
                      ['Total Days',    reportData.summary?.totalDays,                          '#fff4f7', '#c93360', '#ffc8d4'],
                      ['Total Hours',   `${reportData.summary?.totalHours} hrs`,                '#eef1ff', 'var(--primary)', '#c8d4ff'],
                      ['Overtime',      `${reportData.summary?.totalOvertime} hrs`,             '#fffbe8', '#7a5000', '#ffe08a'],
                      ['Total Salary',  `₹${Number(reportData.summary?.totalSalary||0).toLocaleString('en-IN')}`, '#e6fdf6', '#04a87f', '#a0f0d8'],
                    ].map(([label, val, bg, color, border]) => (
                      <div key={label} style={{ background: bg, border: `1.5px solid ${border}`, color, borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.75, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Attendance table */}
                  {reportData.attendance?.length > 0 && (
                    <div className="att-table-scroll" style={{ marginTop: 0 }}>
                      <table className="clients-table att-table">
                        <thead>
                          <tr>
                            <th>Date</th><th>Start</th><th>End</th>
                            <th>Total Hrs</th><th>Overtime</th><th>Day Salary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.attendance.map((a, i) => (
                            <tr key={i}>
                              <td><span className="att-date-tag">{new Date(a.date).toLocaleDateString('en-IN')}</span></td>
                              <td>{a.startTime}</td>
                              <td>{a.endTime}</td>
                              <td className="amt-cell">{a.totalHours} hrs</td>
                              <td className={a.overtimeHours > 0 ? 'overtime-yes' : 'amt-cell'}>
                                {a.overtimeHours > 0 ? `+${a.overtimeHours} hrs` : `${a.overtimeHours} hrs`}
                              </td>
                              <td className="salary-cell">₹{Number(a.daySalary).toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default LabourPage;