import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/LabourAttendancePage.css';

const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall', REPORT: 'report' };

function LabourAttendancePage({ onLogout }) {
  const navigate = useNavigate();

  const [labours, setLabours]       = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activePanel, setPanel]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [loading, setLoading]       = useState(false);

  const [addForm, setAddForm] = useState({
    labourId:  '',
    date:      new Date().toISOString().split('T')[0],
    startTime: '',
    endTime:   '',
  });

  // UPDATE
  const [updateAttendanceId, setUpdateAttendanceId] = useState('');
  const [updateFound, setUpdateFound]               = useState(null);
  const [updateForm, setUpdateForm]                 = useState({ date: '', startTime: '', endTime: '' });

  // DELETE
  const [deleteAttendanceId, setDeleteAttendanceId] = useState('');
  const [deleteFound, setDeleteFound]               = useState(null);

  // GET ALL
  const [selectedAttendanceId, setSelectedAttendanceId] = useState('');
  const [dateFilter, setDateFilter]                     = useState('');
  const [labourFilter, setLabourFilter]                 = useState('');

  // REPORT
  const [reportMonth, setReportMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [reportLabourId, setReportLabourId] = useState('');
  const [reportPdfUrl, setReportPdfUrl]     = useState('');
  const [reportLoading, setReportLoading]   = useState(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchLabours = async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/labours/getall`);
      const data = await res.json();
      setLabours(Array.isArray(data) ? data : (data.data || []));
    } catch { showToast('Failed to fetch labours', 'error'); }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/attendance/all`);
      const data = await res.json();
      setAttendance(Array.isArray(data) ? data : []);
    } catch { showToast('Failed to fetch attendance', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLabours(); fetchAttendance(); }, []);

  // ── Options ───────────────────────────────────────────────
  const labourOptions = labours.map(l => ({
    value: l.labourId,
    label: `${l.labourId} — ${l.name}`,
  }));

  const labourIdOptions = labours.map(l => ({
    value: l._id,
    label: `${l.labourId} — ${l.name}`,
  }));

  // Attendance options for update/delete
  const attendanceOptions = attendance.map(a => ({
    value: a._id,
    label: `${a.date} — ${a.labourId} (${a.name}) — ${a.startTime} to ${a.endTime}`,
  }));

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ labourId: '', date: new Date().toISOString().split('T')[0], startTime: '', endTime: '' });
    setUpdateAttendanceId(''); setUpdateForm({ date: '', startTime: '', endTime: '' }); setUpdateFound(null);
    setDeleteAttendanceId(''); setDeleteFound(null);
    setSelectedAttendanceId(''); setDateFilter(''); setLabourFilter('');
    setReportMonth(new Date().toISOString().slice(0, 7));
    setReportLabourId(''); setReportPdfUrl('');
  };

  const getSelectedLabour = () => labours.find(l => l.labourId === addForm.labourId);

  const calculateHours = (start, end) => {
    if (!start || !end) return { totalHours: 0, overtime: 0 };
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let hours = (eh * 60 + em - sh * 60 - sm) / 60;
    if (hours < 0) hours += 24;
    const overtime = hours > 8 ? hours - 8 : 0;
    return { totalHours: parseFloat(hours.toFixed(2)), overtime: parseFloat(overtime.toFixed(2)) };
  };

  const selectedLabour = getSelectedLabour();
  const addHours    = calculateHours(addForm.startTime, addForm.endTime);
  const updateHours = updateForm.startTime && updateForm.endTime
    ? calculateHours(updateForm.startTime, updateForm.endTime) : null;

  // ── ADD ───────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.labourId || !addForm.date || !addForm.startTime || !addForm.endTime) {
      showToast('All fields are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labourId:  addForm.labourId,
          date:      addForm.date,
          startTime: addForm.startTime,
          endTime:   addForm.endTime,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAttendance();
        setAddForm({ labourId: '', date: new Date().toISOString().split('T')[0], startTime: '', endTime: '' });
        showToast('Attendance saved successfully!');
      } else {
        showToast(data.message || 'Failed to add attendance', 'error');
      }
    } catch { showToast('Error adding attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE SELECT ─────────────────────────────────────────
  const handleUpdateSelect = (attId) => {
    setUpdateAttendanceId(attId);
    const found = attendance.find(a => a._id === attId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({ date: found.date, startTime: found.startTime, endTime: found.endTime });
    } else { setUpdateFound(null); setUpdateForm({ date: '', startTime: '', endTime: '' }); }
  };

  // ── UPDATE ────────────────────────────────────────────────
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select attendance record', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:      updateForm.date,
          startTime: updateForm.startTime,
          endTime:   updateForm.endTime,
        }),
      });
      if (res.ok) {
        await fetchAttendance();
        showToast('Attendance updated successfully!');
        setUpdateFound(null); setUpdateAttendanceId(''); setUpdateForm({ date: '', startTime: '', endTime: '' });
      } else { showToast('Failed to update attendance', 'error'); }
    } catch { showToast('Error updating attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE SELECT ─────────────────────────────────────────
  const handleDeleteSelect = (attId) => {
    setDeleteAttendanceId(attId);
    setDeleteFound(attendance.find(a => a._id === attId) || null);
  };

  // ── DELETE ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select attendance record', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/attendance/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAttendance();
        showToast('Attendance deleted successfully!', 'info');
        setDeleteFound(null); setDeleteAttendanceId('');
      } else { showToast('Failed to delete attendance', 'error'); }
    } catch { showToast('Error deleting attendance', 'error'); }
    finally { setLoading(false); }
  };

  // ── REPORT ────────────────────────────────────────────────
  const handleLabourMonthlyReport = async () => {
    if (!reportLabourId || !reportMonth) {
      showToast('Please select labour and month', 'error'); return;
    }
    try {
      setReportLoading(true);
      setReportPdfUrl('');
      const url = `${API_BASE_URL}/attendance/report/${reportLabourId}/${reportMonth}`;
      const res = await fetch(url);
      if (!res.ok) { showToast('Failed to generate report', 'error'); return; }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setReportPdfUrl(data.pdfUrl || data.url || url);
      } else {
        setReportPdfUrl(url);
      }
      showToast('Report generated successfully!');
    } catch { showToast('Error generating report', 'error'); }
    finally { setReportLoading(false); }
  };

  const handleSharePdf = async () => {
    if (!reportPdfUrl) return;
    const labourObj = labours.find(l => l.labourId === reportLabourId);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Attendance Report — ${labourObj?.name || reportLabourId}`,
          text:  `Monthly attendance report for ${labourObj?.name || reportLabourId} (${reportMonth})`,
          url:   reportPdfUrl,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(reportPdfUrl);
        showToast('PDF link copied to clipboard!');
      } catch { showToast('Could not share. Try downloading instead.', 'error'); }
    }
  };

  // ── Filtered attendance ───────────────────────────────────
  const filteredAttendance = attendance.filter(a => {
    const matchDate   = dateFilter   ? a.date     === dateFilter   : true;
    const matchLabour = labourFilter ? a.labourId === labourFilter : true;
    return matchDate && matchLabour;
  });

  const selectedAttendanceObj = attendance.find(a => a._id === selectedAttendanceId);
  const totalHoursAll    = filteredAttendance.reduce((s, a) => s + (a.totalHours || 0), 0);
  const totalOvertimeAll = filteredAttendance.reduce((s, a) => s + (a.overtime   || 0), 0);
  const reportLabourObj  = labours.find(l => l.labourId === reportLabourId);

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
          <button className="action-btn btn-add"        onClick={() => togglePanel(PANELS.ADD)}>Add Attendance</button>
          <button className="action-btn btn-update"     onClick={() => togglePanel(PANELS.UPDATE)}>Update Attendance</button>
          <button className="action-btn btn-delete"     onClick={() => togglePanel(PANELS.DELETE)}>Delete Attendance</button>
          <button className="action-btn btn-getall"     onClick={() => togglePanel(PANELS.GETALL)}>All Attendance</button>
          <button className="action-btn att-btn-report" onClick={() => togglePanel(PANELS.REPORT)}>Monthly Report</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ── ADD ── */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add Attendance</div>
            <form onSubmit={handleAdd}>
              <div className="form-row att-form-grid">
                <div className="form-field">
                  <label className="field-label">Labour *</label>
                  <SearchableDropdown
                    options={labourOptions}
                    value={addForm.labourId}
                    onChange={val => setAddForm({ ...addForm, labourId: val })}
                    placeholder="-- Select Labour --"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Date *</label>
                  <input className="field-input" type="date" value={addForm.date}
                    onChange={e => setAddForm({ ...addForm, date: e.target.value })} />
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
                  {selectedLabour?.dailyWage && (
                    <div className="calc-item">
                      <span>Est. Wage:</span>
                      <strong>₹{(selectedLabour.dailyWage * (addHours.totalHours / 8)).toFixed(0)}</strong>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>Save Attendance</button>
            </form>
          </div>
        )}

        {/* ── UPDATE ── */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Attendance</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Attendance Record *</label>
              <SearchableDropdown
                options={attendanceOptions}
                value={updateAttendanceId}
                onChange={handleUpdateSelect}
                placeholder="-- Select Attendance --"
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.labourId}</span>
                  <span className="update-found-name">{updateFound.name} — {updateFound.date}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row att-form-grid">
                    <div className="form-field">
                      <label className="field-label">Date *</label>
                      <input className="field-input" type="date" value={updateForm.date}
                        onChange={e => setUpdateForm({ ...updateForm, date: e.target.value })} />
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

        {/* ── DELETE ── */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Attendance</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Attendance Record *</label>
              <SearchableDropdown
                options={attendanceOptions}
                value={deleteAttendanceId}
                onChange={handleDeleteSelect}
                placeholder="-- Select Attendance --"
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Labour ID',   deleteFound.labourId],
                  ['Name',        deleteFound.name],
                  ['Work Type',   deleteFound.workType || '—'],
                  ['Date',        deleteFound.date],
                  ['Start Time',  deleteFound.startTime],
                  ['End Time',    deleteFound.endTime],
                  ['Total Hours', `${deleteFound.totalHours} hrs`],
                  ['Overtime',    `${deleteFound.overtime} hrs`],
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
            <div className="panel-title">All Attendance Records</div>

            <div className="att-summary-chips">
              <div className="att-chip att-chip-total"><span>Total Records</span><strong>{filteredAttendance.length}</strong></div>
              <div className="att-chip att-chip-hours"><span>Total Hours</span><strong>{totalHoursAll.toFixed(1)} hrs</strong></div>
              <div className="att-chip att-chip-overtime"><span>Total Overtime</span><strong>{totalOvertimeAll.toFixed(1)} hrs</strong></div>
              <div className="att-chip att-chip-labour"><span>Unique Labours</span><strong>{[...new Set(filteredAttendance.map(a => a.labourId))].length}</strong></div>
            </div>

            <div className="att-filter-row">
              <div className="form-field">
                <label className="field-label">Filter by Date</label>
                <input className="field-input" type="date" value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setSelectedAttendanceId(''); }} />
              </div>
              <div className="form-field">
                <label className="field-label">Filter by Labour</label>
                <SearchableDropdown
                  options={labourOptions}
                  value={labourFilter}
                  onChange={(val) => { setLabourFilter(val); setSelectedAttendanceId(''); }}
                  placeholder="-- All Labours --"
                />
              </div>
              {(dateFilter || labourFilter) && (
                <button className="submit-btn" style={{ marginTop: 20 }}
                  onClick={() => { setDateFilter(''); setLabourFilter(''); setSelectedAttendanceId(''); }}>
                  Clear Filters
                </button>
              )}
            </div>

            {filteredAttendance.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No attendance records found.</p></div>
            ) : (
              <>
                {selectedAttendanceObj && (
                  <div className="att-detail-card">
                    <div className="att-detail-header">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="att-id-tag">{selectedAttendanceObj.labourId}</span>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedAttendanceObj.name}</span>
                        <span className="att-date-tag">{selectedAttendanceObj.date}</span>
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedAttendanceId('')}>✕</button>
                    </div>
                    <div className="att-detail-grid">
                      {[
                        ['Labour ID',   selectedAttendanceObj.labourId],
                        ['Name',        selectedAttendanceObj.name],
                        ['Work Type',   selectedAttendanceObj.workType || '—'],
                        ['Date',        selectedAttendanceObj.date],
                        ['Start Time',  selectedAttendanceObj.startTime],
                        ['End Time',    selectedAttendanceObj.endTime],
                        ['Total Hours', `${selectedAttendanceObj.totalHours} hrs`],
                        ['Overtime',    `${selectedAttendanceObj.overtime} hrs`],
                      ].map(([k, v]) => (
                        <div className="att-detail-item" key={k}>
                          <span className="att-detail-key">{k}</span>
                          <span className="att-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 24 }}>
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Labour ID</th><th>Name</th><th>Work Type</th>
                        <th>Start</th><th>End</th><th>Total Hrs</th><th>Overtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map(a => {
                        const isSelected = selectedAttendanceId === a._id;
                        return (
                          <tr key={a._id}
                            className={isSelected ? 'att-row-selected' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedAttendanceId(isSelected ? '' : a._id)}>
                            <td><span className="att-date-tag">{a.date}</span></td>
                            <td><span className="att-id-tag">{a.labourId}</span></td>
                            <td style={{ fontWeight: 600 }}>{a.name}</td>
                            <td>{a.workType || '—'}</td>
                            <td>{a.startTime}</td>
                            <td>{a.endTime}</td>
                            <td className="amt-cell">{a.totalHours} hrs</td>
                            <td className={a.overtime > 0 ? 'overtime-yes' : 'amt-cell'}>
                              {a.overtime > 0 ? `+${a.overtime} hrs` : `${a.overtime} hrs`}
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

        {/* ── MONTHLY REPORT ── */}
        {activePanel === PANELS.REPORT && (
          <div className="panel-section" key="report">
            <div className="panel-title">Monthly Attendance Report</div>

            <div className="report-card">
              <div className="report-card-title">Individual Labour Report</div>

              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="field-label">Select Labour *</label>
                <SearchableDropdown
                  options={labourOptions}
                  value={reportLabourId}
                  onChange={(val) => { setReportLabourId(val); setReportPdfUrl(''); }}
                  placeholder="-- Select Labour --"
                />
              </div>

              <div className="form-field" style={{ marginBottom: 16 }}>
                <label className="field-label">Select Month *</label>
                <input className="field-input" type="month" value={reportMonth}
                  onChange={e => { setReportMonth(e.target.value); setReportPdfUrl(''); }} />
              </div>

              <div className="report-info-box">
                <span>Generates a detailed PDF for a single labour's attendance and hours.</span>
              </div>

              <button className="submit-btn att-report-btn"
                onClick={handleLabourMonthlyReport}
                disabled={reportLoading}>
                {reportLoading ? 'Generating...' : 'Generate Labour PDF Report'}
              </button>

              {reportPdfUrl && (
                <div className="report-pdf-actions">
                  {reportLabourObj && (
                    <div className="report-generated-badge">
                      <span className="att-id-tag">{reportLabourObj.labourId}</span>
                      <span style={{ fontWeight: 700, color: '#036b4e' }}>{reportLabourObj.name}</span>
                      <span className="att-date-tag">{reportMonth}</span>
                      <span className="report-ready-dot">✓ Ready</span>
                    </div>
                  )}

                  <div className="report-action-btns">
                    <a href={reportPdfUrl} target="_blank" rel="noreferrer"
                      className="report-action-btn report-btn-view">
                      📄 View PDF
                    </a>
                    <a href={reportPdfUrl} download={`attendance_${reportLabourId}_${reportMonth}.pdf`}
                      className="report-action-btn report-btn-download">
                      ⬇️ Download
                    </a>
                    <button className="report-action-btn report-btn-share" onClick={handleSharePdf}>
                      🔗 Share
                    </button>
                  </div>
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

export default LabourAttendancePage;