import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/LabourAttendancePage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

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

  const [addMode, setAddMode]       = useState('single');
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
  const [addForm, setAddForm] = useState({ labourMongoId: '', siteName: '', startTime: '', endTime: '' });
  const [multiCommon, setMultiCommon] = useState({ siteName: '', startTime: '', endTime: '' });
  const [selectedLabourIds, setSelectedLabourIds] = useState([]);

  const [updateAttId, setUpdateAttId]   = useState('');
  const [updateFound, setUpdateFound]   = useState(null);
  const [updateForm, setUpdateForm]     = useState({ siteName: '', startTime: '', endTime: '' });

  const [deleteAttId, setDeleteAttId]   = useState('');
  const [deleteFound, setDeleteFound]   = useState(null);

  const [selectedAttId, setSelectedAttId] = useState('');
  const [labourFilter, setLabourFilter]   = useState('');
  const [dateFilterMode, setDateFilterMode]   = useState('single');
  const [singleDateFilter, setSingleDateFilter] = useState('');
  const [fromDateFilter, setFromDateFilter]     = useState('');
  const [toDateFilter, setToDateFilter]         = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

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
          labourId:      lab?.labourId   || '',
          labourName:    lab?.name       || a.labour?.name || '',
          workType:      lab?.workType   || '',
          dailyWage:     lab?.dailyWage  || 0,
        };
      });
      setAttendance(enriched);
    } catch { showToast('Failed to fetch attendance', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    const init = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/labours/getall`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setLabours(list);
        await fetchAttendance(list);
      } catch {
        showToast('Failed to fetch data', 'error');
      }
    };
    init();
  }, [fetchAttendance, showToast]);

  // ── KEY FIX: Get labour IDs that already have attendance on commonDate ──
  const labourIdsWithAttendanceOnDate = useCallback((date) => {
    if (!date) return new Set();
    return new Set(
      attendance
        .filter(a => new Date(a.date).toISOString().split('T')[0] === date)
        .map(a => a.labourMongoId?._id || a.labourMongoId)
    );
  }, [attendance]);

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
    return `₹${(rec.totalHours * (wage / 8)).toFixed(0)}`;
  };

  const calcDaySalaryNum = (rec) => {
    const lab = labours.find(l => l._id === (rec.labourMongoId?._id || rec.labourMongoId));
    const wage = lab?.dailyWage || rec.dailyWage;
    if (!wage) return 0;
    return wage / 8 * rec.totalHours;
  };

  const getLabourByMongoId = (id) => labours.find(l => l._id === id);
  const sanitizeSiteName = (val) => (val && val.trim()) ? val.trim() : 'N/A';

  // ── Dropdown options with duplicate-date disable ──────────
  const alreadyMarkedIds = labourIdsWithAttendanceOnDate(commonDate);

  // Single mode: disable labours already marked on commonDate
  const labourOptions = labours.map(l => ({
    value: l._id,
    label: alreadyMarkedIds.has(l._id)
      ? `${l.labourId} — ${l.name} (${l.workType || 'Worker'}) ✓ Already marked`
      : `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
    disabled: alreadyMarkedIds.has(l._id),
  }));

  // For filter dropdown (no disabled)
  const labourOptionsForFilter = labours.map(l => ({
    value: l._id,
    label: `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
  }));

  const attendanceOptions = attendance.map(a => ({
    value: a._id,
    label: `${new Date(a.date).toLocaleDateString('en-IN')} — ${a.labourId || a.labourMongoId} (${a.labourName}) — ${a.startTime} to ${a.endTime}`,
  }));

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ labourMongoId: '', siteName: '', startTime: '', endTime: '' });
    setMultiCommon({ siteName: '', startTime: '', endTime: '' });
    setSelectedLabourIds([]);
    setUpdateAttId(''); setUpdateFound(null); setUpdateForm({ siteName: '', startTime: '', endTime: '' });
    setDeleteAttId(''); setDeleteFound(null);
    setSelectedAttId('');
    setLabourFilter('');
    setDateFilterMode('single');
    setSingleDateFilter('');
    setFromDateFilter('');
    setToDateFilter('');
  };

  const clearDateFilters = () => {
    setSingleDateFilter('');
    setFromDateFilter('');
    setToDateFilter('');
    setSelectedAttId('');
  };

  const clearAllFilters = () => {
    setLabourFilter('');
    clearDateFilters();
    setSelectedAttId('');
  };

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
      showToast('Labour, Date, Start Time and End Time are required', 'error'); return;
    }
    // FRONTEND DUPLICATE CHECK
    if (alreadyMarkedIds.has(addForm.labourMongoId)) {
      showToast('Attendance already marked for this labour on selected date', 'error'); return;
    }
    const { totalHours } = calculateHours(addForm.startTime, addForm.endTime);
    if (totalHours <= 0) {
      showToast('End time must be after start time', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:     commonDate,
          siteName: sanitizeSiteName(addForm.siteName),
          labours: [{
            labourId:  addForm.labourMongoId,
            startTime: addForm.startTime,
            endTime:   addForm.endTime,
          }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.count === 0) {
          showToast('Attendance already exists for this labour on this date', 'error');
        } else {
          await fetchAttendance(labours);
          setAddForm({ labourMongoId: '', siteName: '', startTime: '', endTime: '' });
          showToast(`Attendance saved! (${data.count} record)`);
        }
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
    const { totalHours } = calculateHours(multiCommon.startTime, multiCommon.endTime);
    if (totalHours <= 0) {
      showToast('End time must be after start time', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:     commonDate,
          siteName: sanitizeSiteName(multiCommon.siteName),
          labours: selectedLabourIds.map(id => ({
            labourId:  id,
            startTime: multiCommon.startTime,
            endTime:   multiCommon.endTime,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const skipped = selectedLabourIds.length - data.count;
        await fetchAttendance(labours);
        setSelectedLabourIds([]);
        setMultiCommon({ siteName: '', startTime: '', endTime: '' });
        if (skipped > 0 && data.count === 0) {
          showToast(`All ${skipped} records already exist for this date`, 'error');
        } else if (skipped > 0) {
          showToast(`${data.count} saved, ${skipped} skipped (already exist)`, 'info');
        } else {
          showToast(`${data.count} attendance record(s) saved!`);
        }
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
    const { totalHours } = calculateHours(updateForm.startTime, updateForm.endTime);
    if (totalHours <= 0) {
      showToast('End time must be after start time', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName:  sanitizeSiteName(updateForm.siteName),
          startTime: updateForm.startTime,
          endTime:   updateForm.endTime,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAttendance(labours);
        showToast('Attendance updated successfully!');
        setUpdateFound(null); setUpdateAttId(''); setUpdateForm({ siteName: '', startTime: '', endTime: '' });
      } else {
        showToast(data.message || 'Failed to update attendance', 'error');
      }
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
      const data = await res.json();
      if (res.ok) {
        await fetchAttendance(labours);
        showToast('Attendance deleted successfully!', 'info');
        setDeleteFound(null); setDeleteAttId('');
      } else {
        showToast(data.message || 'Failed to delete attendance', 'error');
      }
    } catch { showToast('Error deleting attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered attendance ───────────────────────────────────
  const filteredAttendance = attendance.filter(a => {
    const matchLabour = labourFilter
      ? (a.labourMongoId?._id || a.labourMongoId) === labourFilter
      : true;

    let matchDate = true;
    const recDate = new Date(a.date).toISOString().split('T')[0];

    if (dateFilterMode === 'single') {
      if (singleDateFilter) matchDate = recDate === singleDateFilter;
    } else {
      if (fromDateFilter && toDateFilter) {
        matchDate = recDate >= fromDateFilter && recDate <= toDateFilter;
      } else if (fromDateFilter) {
        matchDate = recDate >= fromDateFilter;
      } else if (toDateFilter) {
        matchDate = recDate <= toDateFilter;
      }
    }

    return matchLabour && matchDate;
  });

  const hasDateFilter = dateFilterMode === 'single'
    ? !!singleDateFilter
    : !!(fromDateFilter || toDateFilter);
  const hasAnyFilter = hasDateFilter || !!labourFilter;

  const totalHoursAll    = filteredAttendance.reduce((s, a) => s + (a.totalHours    || 0), 0);
  const totalOvertimeAll = filteredAttendance.reduce((s, a) => s + (a.overtimeHours || 0), 0);
  const totalSalaryAll   = filteredAttendance.reduce((s, a) => s + calcDaySalaryNum(a), 0);
  const selectedAttObj   = attendance.find(a => a._id === selectedAttId);

  const handleExcelDownload = () => {
    if (!filteredAttendance.length) { showToast('No records to export', 'error'); return; }
    const rows = filteredAttendance.map(a => ({ ...a, daySalary: calcDaySalaryNum(a).toFixed(0) }));
    let suffix = '_all';
    if (dateFilterMode === 'single' && singleDateFilter) suffix = `_${singleDateFilter}`;
    else if (dateFilterMode === 'range' && fromDateFilter) suffix = `_${fromDateFilter}_to_${toDateFilter || 'now'}`;
    else if (labourFilter) suffix = '_labour';
    exportToCSV(rows, `attendance${suffix}.csv`);
    showToast('CSV downloaded successfully!');
  };

  const addHours       = calculateHours(addForm.startTime, addForm.endTime);
  const selectedLabour = getLabourByMongoId(addForm.labourMongoId);
  const estSalary      = selectedLabour?.dailyWage
    ? (selectedLabour.dailyWage / 8 * addHours.totalHours).toFixed(0) : null;

  const updateHours = updateForm.startTime && updateForm.endTime
    ? calculateHours(updateForm.startTime, updateForm.endTime) : null;

  const multiHours = calculateHours(multiCommon.startTime, multiCommon.endTime);
  const multiReady = selectedLabourIds.length > 0 && commonDate && multiCommon.startTime && multiCommon.endTime;

  // Multiple mode: exclude already-selected AND already-marked-on-date labours
  const unselectedLabourOptions = labours
    .filter(l => !selectedLabourIds.includes(l._id))
    .map(l => ({
      value: l._id,
      label: alreadyMarkedIds.has(l._id)
        ? `${l.labourId} — ${l.name} (${l.workType || 'Worker'}) ✓ Already marked`
        : `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
      disabled: alreadyMarkedIds.has(l._id),
    }));

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

        <div className="action-cards-grid">
          <div
            className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.ADD)}
          >
            <div className="action-card-icon">➕</div>
            <div className="action-card-title">Add Attendance</div>
            <div className="action-card-desc">Record daily attendance</div>
          </div>

          <div
            className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.UPDATE)}
          >
            <div className="action-card-icon">✏️</div>
            <div className="action-card-title">Update Attendance</div>
            <div className="action-card-desc">Edit attendance record</div>
          </div>

          <div
            className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.GETALL)}
          >
            <div className="action-card-icon">📋</div>
            <div className="action-card-title">All Attendance</div>
            <div className="action-card-desc">View all attendance records</div>
          </div>

          <div
            className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.DELETE)}
          >
            <div className="action-card-icon">🗑️</div>
            <div className="action-card-title">Delete Attendance</div>
            <div className="action-card-desc">Remove attendance record</div>
          </div>
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

            <div className="att-common-date-bar">
              <div className="att-common-date-label">
                <span className="att-common-date-icon">📅</span>
                <span>Attendance Date</span>
              </div>
              <input className="field-input att-common-date-input" type="date"
                value={commonDate}
                onChange={e => {
                  setCommonDate(e.target.value);
                  // Reset labour selection when date changes
                  setAddForm(f => ({ ...f, labourMongoId: '' }));
                  setSelectedLabourIds([]);
                }} />
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
                      onChange={val => {
                        if (!alreadyMarkedIds.has(val)) {
                          setAddForm({ ...addForm, labourMongoId: val });
                        } else {
                          showToast('Attendance already marked for this labour on selected date', 'error');
                        }
                      }}
                      placeholder="-- Select Labour --"
                    />
                    {/* Info text showing how many are already marked */}
                    {alreadyMarkedIds.size > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
                        ✓ {alreadyMarkedIds.size} labour{alreadyMarkedIds.size > 1 ? 's' : ''} already marked on this date
                      </span>
                    )}
                  </div>
                  <div className="form-field">
                    <label className="field-label">Site Name <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>(optional)</span></label>
                    <input className="field-input" type="text" placeholder="e.g. Site A, Block-2 (or leave blank)"
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
                      <label className="field-label">Site Name <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>(optional)</span></label>
                      <input className="field-input" type="text" placeholder="e.g. Site A, Block-2 (or leave blank)"
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
                    <span className="multi-labour-count-badge">{selectedLabourIds.length} selected</span>
                    {/* Show how many already marked on this date */}
                    {alreadyMarkedIds.size > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                        ({alreadyMarkedIds.size} already marked on this date — hidden from list)
                      </span>
                    )}
                  </div>

                  <div className="form-field" style={{ marginBottom: 12 }}>
                    <SearchableDropdown
                      options={unselectedLabourOptions}
                      value=""
                      onChange={(val) => {
                        if (val && !alreadyMarkedIds.has(val)) toggleLabourSelection(val);
                        else if (val) showToast('Attendance already marked for this labour on selected date', 'error');
                      }}
                      placeholder={unselectedLabourOptions.filter(o => !o.disabled).length === 0
                        ? '✓ All available labours selected'
                        : '-- Search & add labour --'}
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
                              <span className="multi-chip-avatar">{lab.name.charAt(0).toUpperCase()}</span>
                              <div className="multi-chip-info">
                                <span className="multi-chip-name">{lab.name}</span>
                                <span className="multi-chip-meta">
                                  {lab.labourId} · {lab.workType || 'Worker'}
                                  {estWage && <> · <span className="multi-chip-salary">₹{estWage}</span></>}
                                </span>
                              </div>
                            </div>
                            <button className="multi-chip-remove" type="button"
                              onClick={() => removeSelectedLabour(id)} title="Remove">✕</button>
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
                  <button className="submit-btn" type="button"
                    onClick={handleAddMultiple} disabled={loading || !multiReady}>
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
                      <label className="field-label">Site Name <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>(optional)</span></label>
                      <input className="field-input" type="text" placeholder="Site (or leave blank)"
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

            <div className="att-filter-block">
              <div className="att-filter-row-top">
                <div className="att-date-filter-wrap">
                  <label className="field-label" style={{ marginBottom: 8 }}>Filter by Date</label>
                  <div className="att-date-mode-toggle">
                    <button
                      className={`att-date-mode-btn ${dateFilterMode === 'single' ? 'att-date-mode-active' : ''}`}
                      onClick={() => { setDateFilterMode('single'); clearDateFilters(); }}
                      type="button">
                      📅 Single Date
                    </button>
                    <button
                      className={`att-date-mode-btn ${dateFilterMode === 'range' ? 'att-date-mode-active' : ''}`}
                      onClick={() => { setDateFilterMode('range'); clearDateFilters(); }}
                      type="button">
                      📆 Date Range
                    </button>
                  </div>

                  {dateFilterMode === 'single' && (
                    <div className="att-date-single-input">
                      <input className="field-input" type="date" value={singleDateFilter}
                        onChange={e => { setSingleDateFilter(e.target.value); setSelectedAttId(''); }} />
                      {singleDateFilter && (
                        <button className="att-date-clear-x" onClick={() => { setSingleDateFilter(''); setSelectedAttId(''); }} type="button">✕</button>
                      )}
                    </div>
                  )}

                  {dateFilterMode === 'range' && (
                    <div className="att-date-range-inputs">
                      <div className="att-date-range-field">
                        <label className="att-range-label">From</label>
                        <div className="att-date-single-input">
                          <input className="field-input" type="date" value={fromDateFilter}
                            onChange={e => { setFromDateFilter(e.target.value); setSelectedAttId(''); }} />
                          {fromDateFilter && (
                            <button className="att-date-clear-x" onClick={() => { setFromDateFilter(''); setSelectedAttId(''); }} type="button">✕</button>
                          )}
                        </div>
                      </div>
                      <span className="att-range-arrow">→</span>
                      <div className="att-date-range-field">
                        <label className="att-range-label">To</label>
                        <div className="att-date-single-input">
                          <input className="field-input" type="date" value={toDateFilter}
                            min={fromDateFilter || undefined}
                            onChange={e => { setToDateFilter(e.target.value); setSelectedAttId(''); }} />
                          {toDateFilter && (
                            <button className="att-date-clear-x" onClick={() => { setToDateFilter(''); setSelectedAttId(''); }} type="button">✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="att-labour-filter-wrap">
                  <label className="field-label" style={{ marginBottom: 8 }}>Filter by Labour</label>
                  <SearchableDropdown
                    options={labourOptionsForFilter}
                    value={labourFilter}
                    onChange={(val) => { setLabourFilter(val); setSelectedAttId(''); }}
                    placeholder="-- All Labours --"
                  />
                  {labourFilter && (
                    <button className="att-clear-btn" style={{ marginTop: 8 }}
                      onClick={() => { setLabourFilter(''); setSelectedAttId(''); }}>
                      ✕ Clear Labour
                    </button>
                  )}
                </div>
              </div>

              <div className="att-filter-row-bottom">
                <div className="att-active-filters">
                  {dateFilterMode === 'single' && singleDateFilter && (
                    <span className="att-filter-tag">
                      📅 {new Date(singleDateFilter).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                      <button onClick={() => { setSingleDateFilter(''); setSelectedAttId(''); }}>✕</button>
                    </span>
                  )}
                  {dateFilterMode === 'range' && (fromDateFilter || toDateFilter) && (
                    <span className="att-filter-tag att-filter-tag-range">
                      📆{' '}
                      {fromDateFilter ? new Date(fromDateFilter).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '…'}
                      {' → '}
                      {toDateFilter ? new Date(toDateFilter).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '…'}
                      <button onClick={() => { setFromDateFilter(''); setToDateFilter(''); setSelectedAttId(''); }}>✕</button>
                    </span>
                  )}
                  {labourFilter && (() => {
                    const lab = labours.find(l => l._id === labourFilter);
                    return (
                      <span className="att-filter-tag att-filter-tag-labour">
                        👷 {lab?.name || 'Labour'}
                        <button onClick={() => { setLabourFilter(''); setSelectedAttId(''); }}>✕</button>
                      </span>
                    );
                  })()}
                  {!hasAnyFilter && (
                    <span className="att-no-filter-hint">No filters active — showing all {attendance.length} records</span>
                  )}
                </div>

                <div className="att-filter-actions">
                  {hasAnyFilter && (
                    <button className="att-clear-btn" onClick={clearAllFilters}>✕ Clear All</button>
                  )}
                  <button className="att-excel-btn" onClick={handleExcelDownload} disabled={!filteredAttendance.length}>
                    ⬇ CSV ({filteredAttendance.length})
                  </button>
                </div>
              </div>
            </div>

            {filteredAttendance.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No attendance records match the filter.</p></div>
            ) : (
              <>
                {selectedAttObj && (
                  <div className="att-detail-card">
                    <div className="att-detail-header">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="att-id-tag">{selectedAttObj.labourId || '—'}</span>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedAttObj.labourName}</span>
                        <span className="att-date-tag">{new Date(selectedAttObj.date).toLocaleDateString('en-IN')}</span>
                        {selectedAttObj.siteName && selectedAttObj.siteName !== 'N/A' && (
                          <span className="att-site-tag">📍 {selectedAttObj.siteName}</span>
                        )}
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedAttId('')}>✕</button>
                    </div>
                    <div className="att-detail-grid">
                      {[
                        ['Labour ID',   selectedAttObj.labourId    || '—'],
                        ['Name',        selectedAttObj.labourName  || '—'],
                        ['Work Type',   selectedAttObj.workType    || '—'],
                        ['Site',        (selectedAttObj.siteName && selectedAttObj.siteName !== 'N/A') ? selectedAttObj.siteName : '—'],
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
                        const displaySite = (a.siteName && a.siteName !== 'N/A') ? a.siteName : null;
                        return (
                          <tr key={a._id}
                            className={isSelected ? 'att-row-selected' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedAttId(isSelected ? '' : a._id)}>
                            <td><span className="att-date-tag">{new Date(a.date).toLocaleDateString('en-IN')}</span></td>
                            <td><span className="att-id-tag">{a.labourId || '—'}</span></td>
                            <td style={{ fontWeight: 600 }}>{a.labourName || '—'}</td>
                            <td>{a.workType || '—'}</td>
                            <td>{displaySite ? <span className="att-site-tag-sm">📍 {displaySite}</span> : '—'}</td>
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