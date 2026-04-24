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

  const [labours, setLabours] = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '', workType: '', site: '', dailyWage: '', daysWorked: '0', advance: '0'
  });

  // UPDATE — searchable dropdown
  const [updateLabourId, setUpdateLabourId] = useState('');
  const [updateFound, setUpdateFound] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: ''
  });

  // DELETE — searchable dropdown
  const [deleteLabourId, setDeleteLabourId] = useState('');
  const [deleteFound, setDeleteFound] = useState(null);

  // GETALL
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineForm, setInlineForm] = useState({
    name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: ''
  });

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchLabours = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/getall`);
      const data = await res.json();
      setLabours(data.data || []);
    } catch {
      showToast('Failed to fetch labours', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLabours(); }, []);

  // ── Labour options for SearchableDropdown ───────────────
  const labourOptions = labours.map(l => ({
    value: l._id,
    label: `${l.labourId} — ${l.name} (${l.workType || 'Worker'})`,
  }));

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '0', advance: '0' });
    setUpdateLabourId('');
    setUpdateForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: '' });
    setUpdateFound(null);
    setDeleteLabourId('');
    setDeleteFound(null);
    setSelectedLabourId('');
    setInlineEditId(null);
  };

  const calculateTotals = (dailyWage, daysWorked, advance) => {
    const wage = parseFloat(dailyWage) || 0;
    const days = parseFloat(daysWorked) || 0;
    const adv = parseFloat(advance) || 0;
    const totalSalary = wage * days;
    const balance = totalSalary - adv;
    return { totalSalary, balance };
  };

  // ADD
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.dailyWage) {
      showToast('Name and Daily Wage are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name, workType: addForm.workType, site: addForm.site,
          dailyWage: parseFloat(addForm.dailyWage),
          daysWorked: parseFloat(addForm.daysWorked) || 0,
          advance: parseFloat(addForm.advance) || 0
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchLabours();
        setAddForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '0', advance: '0' });
        showToast(`${data.labour.name} added successfully!`);
      } else {
        showToast(data.message || 'Failed to add labour', 'error');
      }
    } catch { showToast('Error adding labour', 'error'); }
    finally { setLoading(false); }
  };

  // UPDATE — searchable dropdown select
  const handleUpdateSelect = (labourId) => {
    setUpdateLabourId(labourId);
    const found = labours.find(l => l._id === labourId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        name: found.name, workType: found.workType || '', site: found.site || '',
        dailyWage: found.dailyWage, daysWorked: found.daysWorked || 0, advance: found.advance || 0
      });
    } else {
      setUpdateFound(null);
      setUpdateForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: '' });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a labour', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/edit/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updateForm.name, workType: updateForm.workType, site: updateForm.site,
          dailyWage: parseFloat(updateForm.dailyWage),
          daysWorked: parseFloat(updateForm.daysWorked) || 0,
          advance: parseFloat(updateForm.advance) || 0
        }),
      });
      if (res.ok) {
        await fetchLabours();
        showToast(`${updateForm.name} updated successfully!`);
        setUpdateFound(null); setUpdateLabourId('');
        setUpdateForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: '' });
      } else { showToast('Failed to update labour', 'error'); }
    } catch { showToast('Error updating labour', 'error'); }
    finally { setLoading(false); }
  };

  // DELETE — searchable dropdown select
  const handleDeleteSelect = (labourId) => {
    setDeleteLabourId(labourId);
    setDeleteFound(labours.find(l => l._id === labourId) || null);
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

  // Inline edit
  const startInlineEdit = (labour) => {
    setInlineEditId(labour._id);
    setInlineForm({
      name: labour.name, workType: labour.workType || '', site: labour.site || '',
      dailyWage: labour.dailyWage, daysWorked: labour.daysWorked || 0, advance: labour.advance || 0
    });
    setSelectedLabourId('');
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: '' });
  };

  const saveInlineEdit = async (labourId) => {
    if (!inlineForm.name || !inlineForm.dailyWage) {
      showToast('Name and Daily Wage are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/labours/edit/${labourId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineForm.name, workType: inlineForm.workType, site: inlineForm.site,
          dailyWage: parseFloat(inlineForm.dailyWage),
          daysWorked: parseFloat(inlineForm.daysWorked) || 0,
          advance: parseFloat(inlineForm.advance) || 0
        }),
      });
      if (res.ok) {
        await fetchLabours();
        showToast(`${inlineForm.name} updated successfully!`);
        setInlineEditId(null);
        setInlineForm({ name: '', workType: '', site: '', dailyWage: '', daysWorked: '', advance: '' });
      }
    } catch { showToast('Error updating labour', 'error'); }
    finally { setLoading(false); }
  };

  const selectedLabourObj = labours.find(l => l._id === selectedLabourId);
  const addTotals = calculateTotals(addForm.dailyWage, addForm.daysWorked, addForm.advance);
  const updateTotals = updateForm.dailyWage ? calculateTotals(updateForm.dailyWage, updateForm.daysWorked, updateForm.advance) : null;

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
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ADD */}
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
                  <label className="field-label">Work Type</label>
                  <input className="field-input" placeholder="Mason / Carpenter"
                    value={addForm.workType} onChange={e => setAddForm({ ...addForm, workType: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Site</label>
                  <input className="field-input" placeholder="Site location"
                    value={addForm.site} onChange={e => setAddForm({ ...addForm, site: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Daily Wage (₹) *</label>
                  <input className="field-input" type="number" placeholder="0.00"
                    value={addForm.dailyWage} onChange={e => setAddForm({ ...addForm, dailyWage: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Days Worked</label>
                  <input className="field-input" type="number" placeholder="0"
                    value={addForm.daysWorked} onChange={e => setAddForm({ ...addForm, daysWorked: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Advance (₹)</label>
                  <input className="field-input" type="number" placeholder="0.00"
                    value={addForm.advance} onChange={e => setAddForm({ ...addForm, advance: e.target.value })} />
                </div>
              </div>

              {addForm.dailyWage && (
                <div className="labour-calc-preview">
                  <div className="calc-item">
                    <span>Total Salary:</span>
                    <strong>₹{addTotals.totalSalary.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="calc-item">
                    <span>Balance:</span>
                    <strong className={addTotals.balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                      ₹{addTotals.balance.toLocaleString('en-IN')}
                    </strong>
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

        {/* UPDATE — searchable dropdown */}
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
                      <label className="field-label">Work Type</label>
                      <input className="field-input" value={updateForm.workType}
                        onChange={e => setUpdateForm({ ...updateForm, workType: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Site</label>
                      <input className="field-input" value={updateForm.site}
                        onChange={e => setUpdateForm({ ...updateForm, site: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Daily Wage (₹) *</label>
                      <input className="field-input" type="number" value={updateForm.dailyWage}
                        onChange={e => setUpdateForm({ ...updateForm, dailyWage: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Days Worked</label>
                      <input className="field-input" type="number" value={updateForm.daysWorked}
                        onChange={e => setUpdateForm({ ...updateForm, daysWorked: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Advance (₹)</label>
                      <input className="field-input" type="number" value={updateForm.advance}
                        onChange={e => setUpdateForm({ ...updateForm, advance: e.target.value })} />
                    </div>
                  </div>

                  {updateTotals && (
                    <div className="labour-calc-preview">
                      <div className="calc-item">
                        <span>Total Salary:</span>
                        <strong>₹{updateTotals.totalSalary.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="calc-item">
                        <span>Balance:</span>
                        <strong className={updateTotals.balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                          ₹{updateTotals.balance.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Labour
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* DELETE — searchable dropdown */}
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
                  ['Labour ID', deleteFound.labourId],
                  ['Name', deleteFound.name],
                  ['Work Type', deleteFound.workType || '—'],
                  ['Site', deleteFound.site || '—'],
                  ['Daily Wage', `₹${Number(deleteFound.dailyWage).toLocaleString('en-IN')}`],
                  ['Days Worked', deleteFound.daysWorked],
                  ['Total Salary', `₹${Number(deleteFound.totalSalary).toLocaleString('en-IN')}`],
                  ['Advance', `₹${Number(deleteFound.advance).toLocaleString('en-IN')}`],
                  ['Balance', `₹${Number(deleteFound.balance).toLocaleString('en-IN')}`],
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

        {/* GET ALL */}
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
                        {selectedLabourObj.site && <div className="labour-cp-site">📍 {selectedLabourObj.site}</div>}
                      </div>
                      <button className="cp-close-btn" onClick={() => setSelectedLabourId('')}>✕</button>
                    </div>

                    <div className="labour-stats-row">
                      <div className="labour-stat labour-stat-wage">
                        <span>Daily Wage</span>
                        <strong>₹{Number(selectedLabourObj.dailyWage).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="labour-stat labour-stat-days">
                        <span>Days Worked</span>
                        <strong>{selectedLabourObj.daysWorked}</strong>
                      </div>
                      <div className="labour-stat labour-stat-salary">
                        <span>Total Salary</span>
                        <strong>₹{Number(selectedLabourObj.totalSalary).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="labour-stat labour-stat-advance">
                        <span>Advance</span>
                        <strong>₹{Number(selectedLabourObj.advance).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="labour-stat labour-stat-balance">
                        <span>Balance</span>
                        <strong className={selectedLabourObj.balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                          ₹{Number(selectedLabourObj.balance).toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 24 }}>
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th>Labour ID</th><th>Name</th><th>Work Type</th><th>Site</th>
                        <th>Daily Wage</th><th>Days</th><th>Total Salary</th><th>Balance</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labours.map(l => {
                        return inlineEditId === l._id ? (
                          <tr key={l._id} className="inline-edit-row">
                            <td>{l.labourId}</td>
                            <td><input className="inline-edit-input" value={inlineForm.name} onChange={e => setInlineForm({ ...inlineForm, name: e.target.value })} /></td>
                            <td><input className="inline-edit-input" value={inlineForm.workType} onChange={e => setInlineForm({ ...inlineForm, workType: e.target.value })} /></td>
                            <td><input className="inline-edit-input" value={inlineForm.site} onChange={e => setInlineForm({ ...inlineForm, site: e.target.value })} /></td>
                            <td><input className="inline-edit-input" type="number" value={inlineForm.dailyWage} onChange={e => setInlineForm({ ...inlineForm, dailyWage: e.target.value })} /></td>
                            <td><input className="inline-edit-input" type="number" value={inlineForm.daysWorked} onChange={e => setInlineForm({ ...inlineForm, daysWorked: e.target.value })} /></td>
                            <td className="amt-cell">₹{calculateTotals(inlineForm.dailyWage, inlineForm.daysWorked, inlineForm.advance).totalSalary.toLocaleString('en-IN')}</td>
                            <td className={calculateTotals(inlineForm.dailyWage, inlineForm.daysWorked, inlineForm.advance).balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                              ₹{calculateTotals(inlineForm.dailyWage, inlineForm.daysWorked, inlineForm.advance).balance.toLocaleString('en-IN')}
                            </td>
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
                            <td>{l.site || '—'}</td>
                            <td className="amt-cell">₹{Number(l.dailyWage).toLocaleString('en-IN')}</td>
                            <td>{l.daysWorked}</td>
                            <td className="amt-cell">₹{Number(l.totalSalary).toLocaleString('en-IN')}</td>
                            <td className={l.balance >= 0 ? 'balance-positive' : 'balance-negative'}>
                              ₹{Number(l.balance).toLocaleString('en-IN')}
                            </td>
                            <td>
                              <button className="table-edit-btn"
                                onClick={e => { e.stopPropagation(); startInlineEdit(l); }}>
                                Edit
                              </button>
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
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default LabourPage;