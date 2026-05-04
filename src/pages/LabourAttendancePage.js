import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/LabourAttendancePage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

// ─── CSV export helper ────────────────────────────────────────────────────────
function exportToCSV(rows, filename) {
  const headers = ['Date', 'Labour', 'Name', 'Work Type', 'Site', 'Start Time', 'End Time', 'Total Hours', 'Overtime (hrs)', 'Day Salary (₹)'];
  const escape  = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows = [
    headers.map(escape).join(','),
    ...rows.map(r => [
      new Date(r.date).toLocaleDateString('en-IN'),
      r.labourId, r.labourName, r.workType || '—', r.siteName || '—',
      r.startTime, r.endTime, r.totalHours, r.overtimeHours, r.daySalary ?? ''
    ].map(escape).join(','))
  ];
  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function LabourAttendancePage({ onLogout }) {
  const navigate = useNavigate();

  const [labours, setLabours]       = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activePanel, setPanel]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [loading, setLoading]       = useState(false);

  // ── ADD ────────────────────────────────────────────────────
  const [addMode, setAddMode]       = useState('single');
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);

  // Single add
  const [addForm, setAddForm] = useState({ labourMongoId: '', siteName: '', startTime: '', endTime: '' });

  // Multiple add — shared fields + selected labours list
  const [multiCommon, setMultiCommon] = useState({ siteName: '', startTime: '', endTime: '' });
  const [selectedLabourIds, setSelectedLabourIds] = useState([]);

  // UPDATE
  const [updateAttId, setUpdateAttId]   = useState('');
  const [updateFound, setUpdateFound]   = useState(null);
  const [updateForm, setUpdateForm]     = useState({ siteName: '', startTime: '', endTime: '' });

  // DELETE
  const [deleteAttId, setDeleteAttId]   = useState('');
  const [deleteFound, setDeleteFound]   = useState(null);

  // GETALL filters
  const [selectedAttId, setSelectedAttId] = useState('');
  const [dateFilter, setDateFilter]       = useState('');
  const [labourFilter, setLabourFilter]   = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch attendance (accepts a labourList to enrich immediately) ──────────
  const fetchAttendance = useCallback(async (labourList = []) => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/attendance/getall`);
      const body = await res.json();
      const raw  = Array.isArray(body) ? body : (body.data || []);
      const enriched = raw.map(a => {
        const labMongoId = a.labour?._id || a.labour;
        const lab = labourList.find(l => l._id === labMongoId);
        return {
          _id:           a._id,
          date:          a.date,
          siteName:      a.siteName      || '',
          startTime:     a.startTime,
          endTime:       a.endTime,
          totalHours:    a.totalHours    || 0,
          overtimeHours: a.overtimeHours || 0,
          labourMongoId: labMongoId,
          labourId:      lab?.labourId   || '',        // ✅ directly mapped
          labourName:    lab?.name       || a.labour?.name || '',
          workType:      lab?.workType   || '',        // ✅ directly mapped
          dailyWage:     lab?.dailyWage  || 0,
        };
      });
      setAttendance(enriched);
    } catch { showToast('Failed to fetch attendance', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  // ── Init: fetch labours first, then pass list to fetchAttendance ──────────
  useEffect(() => {
    const init = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/labours/getall`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setLabours(list);
        await fetchAttendance(list); // ✅ pass fresh list — no race condition
      } catch {
        showToast('Failed to fetch data', 'error');
      }
    };
    init();
  }, [fetchAttendance, showToast]);

  // ── Helpers ───────────────────────────────────────────────
  const calculateHours = (start, end) => {
    if (!start || !end) return { totalHours: 0, overtime: 0 };
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let hours = (eh * 60 + em - sh * 60 - sm) / 60;
    if (hours < 0) hours += 24;
    const overtime = hours > 8 ? hours - 8 : 0;
    return { totalHours: parseFloat(hours.toFixed(2)), overtime: parseFloat(overtime.toFixed(2)) };
  };

  const calcDaySalary = (rec) => {
    const lab = labours.find(l => l._id === (rec.labourMongoId?._id || rec.labourMongoId));
    const wage = lab?.dailyWage || rec.dailyWage;
    if (!wage) return '—';
    const perHour = wage / 8;
    return `₹${(rec.totalHours * perHour).toFixed(0)}`;
  };

  const calcDaySalaryNum = (rec) => {
    const lab = labours.find(l => l._id === (rec.labourMongoId?._id || rec.labourMongoId));
    const wage = lab?.dailyWage || rec.dailyWage;
    if (!wage) return 0;
    return wage / 8 * rec.totalHours;
  };

  const getLabourByMongoId = (id) => labours.find(l => l._id === id);

  // ── Dropdown options ──────────────────────────────────────
  const labourOptions = labours.map(l => ({
    value: l._id,
    label: `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
  }));

  const attendanceOptions = attendance.map(a => ({
    value: a._id,
    label: `${new Date(a.date).toLocaleDateString('en-IN')} — ${a.labourId || a.labourMongoId} (${a.labourName}) — ${a.startTime} to ${a.endTime}`,
  }));

  // ── Toggle panel ──────────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ labourMongoId: '', siteName: '', startTime: '', endTime: '' });
    setMultiCommon({ siteName: '', startTime: '', endTime: '' });
    setSelectedLabourIds([]);
    setUpdateAttId(''); setUpdateFound(null); setUpdateForm({ siteName: '', startTime: '', endTime: '' });
    setDeleteAttId(''); setDeleteFound(null);
    setSelectedAttId(''); setDateFilter(''); setLabourFilter('');
  };

  // ── Multi-select labour toggle ────────────────────────────
  const toggleLabourSelection = (mongoId) => {
    setSelectedLabourIds(prev =>
      prev.includes(mongoId) ? prev.filter(id => id !== mongoId) : [...prev, mongoId]
    );
  };

  const removeSelectedLabour = (mongoId) => {
    setSelectedLabourIds(prev => prev.filter(id => id !== mongoId));
  };

  // ── ADD — Single ──────────────────────────────────────────
  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!addForm.labourMongoId || !commonDate || !addForm.startTime || !addForm.endTime) {
      showToast('All fields are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:     commonDate,
          siteName: addForm.siteName,
          labours: [{
            labourId:  addForm.labourMongoId,
            startTime: addForm.startTime,
            endTime:   addForm.endTime,
          }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAttendance(labours);
        setAddForm({ labourMongoId: '', siteName: '', startTime: '', endTime: '' });
        showToast(`Attendance saved! (${data.count} record)`);
      } else {
        showToast(data.message || 'Failed to add attendance', 'error');
      }
    } catch { showToast('Error adding attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── ADD — Multiple ────────────────────────────────────────
  const handleAddMultiple = async () => {
    if (!selectedLabourIds.length) {
      showToast('Please select at least one labour', 'error'); return;
    }
    if (!commonDate || !multiCommon.startTime || !multiCommon.endTime) {
      showToast('Please fill date, start time and end time', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:     commonDate,
          siteName: multiCommon.siteName || '',
          labours: selectedLabourIds.map(id => ({
            labourId:  id,
            startTime: multiCommon.startTime,
            endTime:   multiCommon.endTime,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAttendance(labours);
        setSelectedLabourIds([]);
        setMultiCommon({ siteName: '', startTime: '', endTime: '' });
        showToast(`${data.count} attendance record(s) saved!`);
      } else {
        showToast(data.message || 'Failed to add attendance', 'error');
      }
    } catch { showToast('Error adding attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ────────────────────────────────────────────────
  const handleUpdateSelect = (attId) => {
    setUpdateAttId(attId);
    const found = attendance.find(a => a._id === attId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({ siteName: found.siteName || '', startTime: found.startTime, endTime: found.endTime });
    } else { setUpdateFound(null); setUpdateForm({ siteName: '', startTime: '', endTime: '' }); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select attendance record', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName:  updateForm.siteName,
          startTime: updateForm.startTime,
          endTime:   updateForm.endTime,
        }),
      });
      if (res.ok) {
        await fetchAttendance(labours);
        showToast('Attendance updated successfully!');
        setUpdateFound(null); setUpdateAttId(''); setUpdateForm({ siteName: '', startTime: '', endTime: '' });
      } else { showToast('Failed to update attendance', 'error'); }
    } catch { showToast('Error updating attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ────────────────────────────────────────────────
  const handleDeleteSelect = (attId) => {
    setDeleteAttId(attId);
    setDeleteFound(attendance.find(a => a._id === attId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select attendance record', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAttendance(labours);
        showToast('Attendance deleted successfully!', 'info');
        setDeleteFound(null); setDeleteAttId('');
      } else { showToast('Failed to delete attendance', 'error'); }
    } catch { showToast('Error deleting attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered attendance ───────────────────────────────────
  const filteredAttendance = attendance.filter(a => {
    const matchDate   = dateFilter   ? new Date(a.date).toISOString().split('T')[0] === dateFilter : true;
    const matchLabour = labourFilter ? (a.labourMongoId?._id || a.labourMongoId) === labourFilter   : true;
    return matchDate && matchLabour;
  });

  const totalHoursAll    = filteredAttendance.reduce((s, a) => s + (a.totalHours    || 0), 0);
  const totalOvertimeAll = filteredAttendance.reduce((s, a) => s + (a.overtimeHours || 0), 0);
  const totalSalaryAll   = filteredAttendance.reduce((s, a) => s + calcDaySalaryNum(a), 0);
  const selectedAttObj   = attendance.find(a => a._id === selectedAttId);

  // ── Excel download ────────────────────────────────────────
  const handleExcelDownload = () => {
    if (!filteredAttendance.length) { showToast('No records to export', 'error'); return; }
    const rows = filteredAttendance.map(a => ({ ...a, daySalary: calcDaySalaryNum(a).toFixed(0) }));
    const suffix = dateFilter ? `_${dateFilter}` : labourFilter ? `_labour` : '_all';
    exportToCSV(rows, `attendance${suffix}.csv`);
    showToast('CSV downloaded successfully!');
  };

  // ── Preview helpers ───────────────────────────────────────
  const addHours       = calculateHours(addForm.startTime, addForm.endTime);
  const selectedLabour = getLabourByMongoId(addForm.labourMongoId);
  const estSalary      = selectedLabour?.dailyWage
    ? (selectedLabour.dailyWage / 8 * addHours.totalHours).toFixed(0) : null;

  const updateHours = updateForm.startTime && updateForm.endTime
    ? calculateHours(updateForm.startTime, updateForm.endTime) : null;

  const multiHours = calculateHours(multiCommon.startTime, multiCommon.endTime);
  const multiReady = selectedLabourIds.length > 0 && commonDate && multiCommon.startTime && multiCommon.endTime;

  const unselectedLabourOptions = labourOptions.filter(o => !selectedLabourIds.includes(o.value));

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/labour')}>←</button>
          <h1 className="entity-page-title">Labour Attendance</h1>
          <span className="entity-page-badge" style={{ background: '#fff4f7', color: '#c93360', border: '1px solid #ffc8d4' }}>
            {attendance.length} Records
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Attendance</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Attendance</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Attendance</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>All Attendance</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ══ ADD ══════════════════════════════════════════════════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add Attendance</div>

            <div className="att-mode-toggle">
              <button className={`att-mode-btn ${addMode === 'single' ? 'att-mode-active' : ''}`}
                onClick={() => setAddMode('single')}>👤 Single Labour</button>
              <button className={`att-mode-btn ${addMode === 'multiple' ? 'att-mode-active' : ''}`}
                onClick={() => setAddMode('multiple')}>👥 Multiple Labours</button>
            </div>

            {/* Common Date */}
            <div className="att-common-date-bar">
              <div className="att-common-date-label">
                <span className="att-common-date-icon">📅</span>
                <span>Attendance Date</span>
              </div>
              <input className="field-input att-common-date-input" type="date"
                value={commonDate} onChange={e => setCommonDate(e.target.value)} />
            </div>

            {/* ── SINGLE ── */}
            {addMode === 'single' && (
              <form onSubmit={handleAddSingle}>
                <div className="form-row att-form-grid-4">
                  <div className="form-field">
                    <label className="field-label">Labour *</label>
                    <SearchableDropdown
                      options={labourOptions}
                      value={addForm.labourMongoId}
                      onChange={val => setAddForm({ ...addForm, labourMongoId: val })}
                      placeholder="-- Select Labour --"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Site Name</label>
                    <input className="field-input" type="text" placeholder="e.g. Site A, Block-2"
                      value={addForm.siteName}
                      onChange={e => setAddForm({ ...addForm, siteName: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Start Time *</label>
                    <input className="field-input" type="time" value={addForm.startTime}
                      onChange={e => setAddForm({ ...addForm, startTime: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label className="field-label">End Time *</label>
                    <input className="field-input" type="time" value={addForm.endTime}
                      onChange={e => setAddForm({ ...addForm, endTime: e.target.value })} />
                  </div>
                </div>

                {selectedLabour && (
                  <div className="att-labour-info">
                    <div className="att-info-item"><span>Name:</span><strong>{selectedLabour.name}</strong></div>
                    <div className="att-info-item"><span>Work Type:</span><strong>{selectedLabour.workType || '—'}</strong></div>
                    <div className="att-info-item"><span>Daily Wage:</span><strong>₹{Number(selectedLabour.dailyWage || 0).toLocaleString('en-IN')}</strong></div>
                  </div>
                )}

                {addForm.startTime && addForm.endTime && (
                  <div className="att-calc-preview">
                    <div className="calc-item"><span>Total Hours:</span><strong>{addHours.totalHours} hrs</strong></div>
                    <div className="calc-item"><span>Overtime:</span>
                      <strong className={addHours.overtime > 0 ? 'overtime-yes' : ''}>{addHours.overtime} hrs</strong>
                    </div>
                    {estSalary && (
                      <div className="calc-item"><span>Est. Salary:</span><strong className="salary-est">₹{estSalary}</strong></div>
                    )}
                  </div>
                )}

                <button type="submit" className="submit-btn" disabled={loading}>Save Attendance</button>
              </form>
            )}

            {/* ── MULTIPLE ── */}
            {addMode === 'multiple' && (
              <div>
                <div className="multi-common-fields">
                  <div className="multi-common-header">
                    <span className="multi-common-icon">⚙️</span>
                    <span className="multi-common-title">Common Settings — applies to all selected labours</span>
                  </div>
                  <div className="form-row att-form-grid-3">
                    <div className="form-field">
                      <label className="field-label">Site Name</label>
                      <input className="field-input" type="text" placeholder="e.g. Site A, Block-2"
                        value={multiCommon.siteName}
                        onChange={e => setMultiCommon({ ...multiCommon, siteName: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Start Time *</label>
                      <input className="field-input" type="time" value={multiCommon.startTime}
                        onChange={e => setMultiCommon({ ...multiCommon, startTime: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">End Time *</label>
                      <input className="field-input" type="time" value={multiCommon.endTime}
                        onChange={e => setMultiCommon({ ...multiCommon, endTime: e.target.value })} />
                    </div>
                  </div>

                  {multiCommon.startTime && multiCommon.endTime && (
                    <div className="att-calc-preview" style={{ marginTop: 0 }}>
                      <div className="calc-item"><span>Total Hours:</span><strong>{multiHours.totalHours} hrs</strong></div>
                      <div className="calc-item"><span>Overtime:</span>
                        <strong className={multiHours.overtime > 0 ? 'overtime-yes' : ''}>{multiHours.overtime} hrs</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="multi-labour-select-section">
                  <div className="multi-labour-select-header">
                    <span className="multi-labour-select-title">👷 Select Labours</span>
                    <span className="multi-labour-count-badge">
                      {selectedLabourIds.length} selected
                    </span>
                  </div>

                  <div className="form-field" style={{ marginBottom: 12 }}>
                    <SearchableDropdown
                      options={unselectedLabourOptions}
                      value=""
                      onChange={(val) => { if (val) toggleLabourSelection(val); }}
                      placeholder={unselectedLabourOptions.length === 0 ? '✓ All labours selected' : '-- Search & add labour --'}
                    />
                  </div>

                  {selectedLabourIds.length > 0 ? (
                    <div className="multi-selected-labours">
                      {selectedLabourIds.map(id => {
                        const lab = getLabourByMongoId(id);
                        if (!lab) return null;
                        const estWage = lab.dailyWage && multiCommon.startTime && multiCommon.endTime
                          ? (lab.dailyWage / 8 * multiHours.totalHours).toFixed(0) : null;
                        return (
                          <div className="multi-selected-labour-chip" key={id}>
                            <div className="multi-chip-left">
                              <span className="multi-chip-avatar">
                                {lab.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="multi-chip-info">
                                <span className="multi-chip-name">{lab.name}</span>
                                <span className="multi-chip-meta">
                                  {lab.labourId} · {lab.workType || 'Worker'}
                                  {estWage && <> · <span className="multi-chip-salary">₹{estWage}</span></>}
                                </span>
                              </div>
                            </div>
                            <button
                              className="multi-chip-remove"
                              type="button"
                              onClick={() => removeSelectedLabour(id)}
                              title="Remove"
                            >✕</button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="multi-no-labour-hint">
                      <span>☝️ Use the dropdown above to select labours</span>
                    </div>
                  )}
                </div>

                <div className="multi-submit-row">
                  <div className="multi-submit-summary">
                    {multiReady ? (
                      <>
                        <span className="multi-summary-ready">✓</span>
                        <span>
                          <strong>{selectedLabourIds.length}</strong> labour{selectedLabourIds.length > 1 ? 's' : ''} ·{' '}
                          {multiCommon.siteName ? <><strong>{multiCommon.siteName}</strong> · </> : ''}
                          <strong>{multiCommon.startTime}</strong> – <strong>{multiCommon.endTime}</strong>
                          {' · '}<strong>{multiHours.totalHours} hrs</strong>
                        </span>
                      </>
                    ) : (
                      <span className="multi-summary-pending">
                        {!selectedLabourIds.length ? 'Select at least one labour' :
                          !multiCommon.startTime || !multiCommon.endTime ? 'Set start & end time' : ''}
                      </span>
                    )}
                  </div>
                  <button
                    className="submit-btn"
                    type="button"
                    onClick={handleAddMultiple}
                    disabled={loading || !multiReady}
                  >
                    Save All ({selectedLabourIds.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ UPDATE ═══════════════════════════════════════════════ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Attendance</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Attendance Record *</label>
              <SearchableDropdown
                options={attendanceOptions}
                value={updateAttId}
                onChange={handleUpdateSelect}
                placeholder="-- Select Attendance --"
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.labourId || updateFound.labourMongoId}</span>
                  <span className="update-found-name">{updateFound.labourName} — {new Date(updateFound.date).toLocaleDateString('en-IN')}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row att-form-grid-4">
                    <div className="form-field">
                      <label className="field-label">Site Name</label>
                      <input className="field-input" type="text" placeholder="Site"
                        value={updateForm.siteName}
                        onChange={e => setUpdateForm({ ...updateForm, siteName: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Start Time *</label>
                      <input className="field-input" type="time" value={updateForm.startTime}
                        onChange={e => setUpdateForm({ ...updateForm, startTime: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">End Time *</label>
                      <input className="field-input" type="time" value={updateForm.endTime}
                        onChange={e => setUpdateForm({ ...updateForm, endTime: e.target.value })} />
                    </div>
                  </div>
                  {updateHours && (
                    <div className="att-calc-preview">
                      <div className="calc-item"><span>Total Hours:</span><strong>{updateHours.totalHours} hrs</strong></div>
                      <div className="calc-item"><span>Overtime:</span>
                        <strong className={updateHours.overtime > 0 ? 'overtime-yes' : ''}>{updateHours.overtime} hrs</strong>
                      </div>
                    </div>
                  )}
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Attendance
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE ═══════════════════════════════════════════════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Attendance</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Attendance Record *</label>
              <SearchableDropdown
                options={attendanceOptions}
                value={deleteAttId}
                onChange={handleDeleteSelect}
                placeholder="-- Select Attendance --"
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Labour ID',   deleteFound.labourId    || '—'],
                  ['Name',        deleteFound.labourName  || '—'],
                  ['Work Type',   deleteFound.workType    || '—'],
                  ['Site',        deleteFound.siteName    || '—'],
                  ['Date',        new Date(deleteFound.date).toLocaleDateString('en-IN')],
                  ['Start Time',  deleteFound.startTime],
                  ['End Time',    deleteFound.endTime],
                  ['Total Hours', `${deleteFound.totalHours} hrs`],
                  ['Overtime',    `${deleteFound.overtimeHours} hrs`],
                  ['Day Salary',  calcDaySalary(deleteFound)],
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
            <div className="panel-title">All Attendance Records</div>

            <div className="att-summary-chips">
              <div className="att-chip att-chip-total">
                <span>Total Records</span><strong>{filteredAttendance.length}</strong>
              </div>
              <div className="att-chip att-chip-hours">
                <span>Total Hours</span><strong>{totalHoursAll.toFixed(1)} hrs</strong>
              </div>
              <div className="att-chip att-chip-overtime">
                <span>Total Overtime</span><strong>{totalOvertimeAll.toFixed(1)} hrs</strong>
              </div>
              <div className="att-chip att-chip-labour">
                <span>Unique Labours</span>
                <strong>{[...new Set(filteredAttendance.map(a => a.labourMongoId?._id || a.labourMongoId))].length}</strong>
              </div>
              <div className="att-chip att-chip-salary">
                <span>Total Salary</span><strong>₹{totalSalaryAll.toFixed(0)}</strong>
              </div>
            </div>

            <div className="att-filter-row-extended">
              <div className="form-field">
                <label className="field-label">Filter by Date</label>
                <input className="field-input" type="date" value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setSelectedAttId(''); }} />
              </div>
              <div className="form-field">
                <label className="field-label">Filter by Labour</label>
                <SearchableDropdown
                  options={labourOptions}
                  value={labourFilter}
                  onChange={(val) => { setLabourFilter(val); setSelectedAttId(''); }}
                  placeholder="-- All Labours --"
                />
              </div>
              <div className="att-filter-actions">
                {(dateFilter || labourFilter) && (
                  <button className="att-clear-btn"
                    onClick={() => { setDateFilter(''); setLabourFilter(''); setSelectedAttId(''); }}>
                    ✕ Clear
                  </button>
                )}
                <button className="att-excel-btn" onClick={handleExcelDownload} disabled={!filteredAttendance.length}>
                  ⬇ CSV
                </button>
              </div>
            </div>

            {filteredAttendance.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No attendance records found.</p></div>
            ) : (
              <>
                {selectedAttObj && (
                  <div className="att-detail-card">
                    <div className="att-detail-header">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="att-id-tag">{selectedAttObj.labourId || '—'}</span>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedAttObj.labourName}</span>
                        <span className="att-date-tag">{new Date(selectedAttObj.date).toLocaleDateString('en-IN')}</span>
                        {selectedAttObj.siteName && <span className="att-site-tag">📍 {selectedAttObj.siteName}</span>}
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedAttId('')}>✕</button>
                    </div>
                    <div className="att-detail-grid">
                      {[
                        ['Labour ID',   selectedAttObj.labourId    || '—'],
                        ['Name',        selectedAttObj.labourName  || '—'],
                        ['Work Type',   selectedAttObj.workType    || '—'],
                        ['Site',        selectedAttObj.siteName    || '—'],
                        ['Date',        new Date(selectedAttObj.date).toLocaleDateString('en-IN')],
                        ['Start Time',  selectedAttObj.startTime],
                        ['End Time',    selectedAttObj.endTime],
                        ['Total Hours', `${selectedAttObj.totalHours} hrs`],
                        ['Overtime',    `${selectedAttObj.overtimeHours} hrs`],
                        ['Day Salary',  calcDaySalary(selectedAttObj)],
                      ].map(([k, v]) => (
                        <div className="att-detail-item" key={k}>
                          <span className="att-detail-key">{k}</span>
                          <span className="att-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="att-table-scroll">
                  <table className="clients-table att-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Labour ID</th><th>Name</th><th>Work Type</th>
                        <th>Site</th><th>Start</th><th>End</th>
                        <th>Total Hrs</th><th>Overtime</th><th>Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map(a => {
                        const isSelected = selectedAttId === a._id;
                        return (
                          <tr key={a._id}
                            className={isSelected ? 'att-row-selected' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedAttId(isSelected ? '' : a._id)}>
                            <td><span className="att-date-tag">{new Date(a.date).toLocaleDateString('en-IN')}</span></td>
                            <td><span className="att-id-tag">{a.labourId || '—'}</span></td>
                            <td style={{ fontWeight: 600 }}>{a.labourName || '—'}</td>
                            <td>{a.workType || '—'}</td>
                            <td>{a.siteName ? <span className="att-site-tag-sm">📍 {a.siteName}</span> : '—'}</td>
                            <td>{a.startTime}</td>
                            <td>{a.endTime}</td>
                            <td className="amt-cell">{a.totalHours} hrs</td>
                            <td className={a.overtimeHours > 0 ? 'overtime-yes' : 'amt-cell'}>
                              {a.overtimeHours > 0 ? `+${a.overtimeHours} hrs` : `${a.overtimeHours} hrs`}
                            </td>
                            <td className="salary-cell">{calcDaySalary(a)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="att-table-footer">
                        <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, paddingRight: 12 }}>Totals →</td>
                        <td className="amt-cell" style={{ fontWeight: 800 }}>{totalHoursAll.toFixed(1)} hrs</td>
                        <td className="overtime-yes" style={{ fontWeight: 800 }}>{totalOvertimeAll.toFixed(1)} hrs</td>
                        <td className="salary-cell" style={{ fontWeight: 800 }}>₹{totalSalaryAll.toFixed(0)}</td>
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

export default LabourAttendancePage;