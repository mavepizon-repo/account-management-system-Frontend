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
    labour: '', name: '', date: new Date().toISOString().split('T')[0], advanceAmount: '',
    deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: ''
  });

  // UPDATE
  const [updateAdvId, setUpdateAdvId]   = useState('');
  const [updateFound, setUpdateFound]   = useState(null);
  const [updateForm, setUpdateForm]     = useState({
    labour: '', name: '', date: '', advanceAmount: '',
    deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: '',
    deductedAmount: 0, remainingAmount: 0, status: 'Pending'
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
  const fetchLabours = async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/labours/getall`);
      const data = await res.json();
      setLabours(Array.isArray(data) ? data : []);
    } catch { showToast('Failed to fetch labours', 'error'); }
  };

  // ── Fetch advances ────────────────────────────────────────
  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/advancePayment/getall`);
      const body = await res.json();
      const data = body.data || body;
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
      label: `${labId} — ${labName} | ₹${Number(a.advanceAmount).toLocaleString('en-IN')} | ${new Date(a.date).toLocaleDateString('en-IN')} | ${a.status}`,
    };
  });

  // ── Toggle panel ──────────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ 
      labour: '', name: '', date: new Date().toISOString().split('T')[0], advanceAmount: '',
      deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: ''
    });
    setUpdateAdvId(''); setUpdateFound(null);
    setUpdateForm({ 
      labour: '', name: '', date: '', advanceAmount: '',
      deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: '',
      deductedAmount: 0, remainingAmount: 0, status: 'Pending'
    });
    setDeleteAdvId(''); setDeleteFound(null);
    setSelectedAdvId(''); setLabourFilter(''); setStatusFilter('');
  };

  // ── ADD ───────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.labour || !addForm.date || !addForm.advanceAmount || !addForm.deductionType) {
      showToast('Labour, Date, Amount and Deduction Type are required', 'error'); return;
    }

    // Validate based on deduction type
    if (addForm.deductionType === 'Monthly Installment' && (!addForm.installmentMonths || Number(addForm.installmentMonths) <= 0)) {
      showToast('Installment months required for Monthly Installment', 'error'); return;
    }
    if (addForm.deductionType === 'Fixed Amount' && (!addForm.fixedDeductionAmount || Number(addForm.fixedDeductionAmount) <= 0)) {
      showToast('Fixed deduction amount required for Fixed Amount', 'error'); return;
    }

    const selectedLabour = labours.find(l => l._id === addForm.labour);
    try {
      setLoading(true);
      const payload = {
        labour:        addForm.labour,
        name:          selectedLabour?.name || addForm.name,
        date:          addForm.date,
        advanceAmount: parseFloat(addForm.advanceAmount),
        deductionType: addForm.deductionType,
      };

      if (addForm.deductionType === 'Monthly Installment') {
        payload.installmentMonths = Number(addForm.installmentMonths);
      }
      if (addForm.deductionType === 'Fixed Amount') {
        payload.fixedDeductionAmount = Number(addForm.fixedDeductionAmount);
      }

      const res = await fetch(`${API_BASE_URL}/advancePayment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAdvances();
        setAddForm({ 
          labour: '', name: '', date: new Date().toISOString().split('T')[0], advanceAmount: '',
          deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: ''
        });
        showToast(`Advance of ₹${Number(addForm.advanceAmount).toLocaleString('en-IN')} added for ${selectedLabour?.name || ''}!`);
      } else {
        showToast(data.error || data.message || 'Failed to add advance', 'error');
      }
    } catch { showToast('Error adding advance payment', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ────────────────────────────────────────────────
  const handleUpdateSelect = (advId) => {
    setUpdateAdvId(advId);
    const found = advances.find(a => a._id === advId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        labour:                found.labour?._id || found.labour || '',
        name:                  found.name || '',
        date:                  new Date(found.date).toISOString().split('T')[0],
        advanceAmount:         found.advanceAmount,
        deductionType:         found.deductionType || 'Monthly Installment',
        installmentMonths:     found.installmentMonths || '',
        fixedDeductionAmount:  found.fixedDeductionAmount || '',
        deductedAmount:        found.deductedAmount || 0,
        remainingAmount:       found.remainingAmount || found.advanceAmount,
        status:                found.status || 'Pending',
      });
    } else {
      setUpdateFound(null);
      setUpdateForm({ 
        labour: '', name: '', date: '', advanceAmount: '',
        deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: '',
        deductedAmount: 0, remainingAmount: 0, status: 'Pending'
      });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select an advance record', 'error'); return; }

    // Validate based on deduction type
    if (updateForm.deductionType === 'Monthly Installment' && (!updateForm.installmentMonths || Number(updateForm.installmentMonths) <= 0)) {
      showToast('Installment months required for Monthly Installment', 'error'); return;
    }
    if (updateForm.deductionType === 'Fixed Amount' && (!updateForm.fixedDeductionAmount || Number(updateForm.fixedDeductionAmount) <= 0)) {
      showToast('Fixed deduction amount required for Fixed Amount', 'error'); return;
    }

    try {
      setLoading(true);
      const payload = {
        labour:          updateForm.labour,
        name:            updateForm.name,
        date:            updateForm.date,
        advanceAmount:   parseFloat(updateForm.advanceAmount),
        deductionType:   updateForm.deductionType,
        deductedAmount:  parseFloat(updateForm.deductedAmount),
        remainingAmount: parseFloat(updateForm.remainingAmount),
        status:          updateForm.status,
      };

      if (updateForm.deductionType === 'Monthly Installment') {
        payload.installmentMonths = Number(updateForm.installmentMonths);
      }
      if (updateForm.deductionType === 'Fixed Amount') {
        payload.fixedDeductionAmount = Number(updateForm.fixedDeductionAmount);
      }

      const res = await fetch(`${API_BASE_URL}/advancePayment/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchAdvances();
        showToast('Advance payment updated successfully!');
        setUpdateFound(null); setUpdateAdvId('');
        setUpdateForm({ 
          labour: '', name: '', date: '', advanceAmount: '',
          deductionType: 'Monthly Installment', installmentMonths: '', fixedDeductionAmount: '',
          deductedAmount: 0, remainingAmount: 0, status: 'Pending'
        });
      } else { showToast('Failed to update advance payment', 'error'); }
    } catch { showToast('Error updating advance payment', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ────────────────────────────────────────────────
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
      : statusFilter === a.status;
    return matchLabour && matchStatus;
  });

  const totalAdvanceAll    = filteredAdvances.reduce((s, a) => s + (a.advanceAmount || 0), 0);
  const totalDeductedAll   = filteredAdvances.reduce((s, a) => s + (a.deductedAmount || 0), 0);
  const totalRemainingAll  = filteredAdvances.reduce((s, a) => s + (a.remainingAmount || 0), 0);
  const selectedAdvObj     = advances.find(a => a._id === selectedAdvId);

  const getLabourInfo = (adv) => {
    const id = adv.labour?._id || adv.labour;
    return labours.find(l => l._id === id);
  };

  // Calculate preview values for ADD form
  const calculateAddPreview = () => {
    if (!addForm.advanceAmount || !addForm.deductionType) return null;
    const amount = parseFloat(addForm.advanceAmount);
    
    if (addForm.deductionType === 'Monthly Installment' && addForm.installmentMonths) {
      const months = Number(addForm.installmentMonths);
      return {
        type: 'Monthly Installment',
        value: `₹${(amount / months).toFixed(2)} per month for ${months} months`
      };
    }
    if (addForm.deductionType === 'Fixed Amount' && addForm.fixedDeductionAmount) {
      const fixed = Number(addForm.fixedDeductionAmount);
      const months = Math.ceil(amount / fixed);
      return {
        type: 'Fixed Amount',
        value: `₹${fixed.toFixed(2)} per deduction (approx ${months} months)`
      };
    }
    if (addForm.deductionType === 'Custom') {
      return {
        type: 'Custom',
        value: 'Manual deduction tracking'
      };
    }
    return null;
  };

  const addPreview = calculateAddPreview();

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

        <div className="action-cards-grid">
  <div
    className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.ADD)}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Add Advance</div>
    <div className="action-card-desc">Add a new advance payment</div>
  </div>

  <div
    className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.UPDATE)}
  >
    <div className="action-card-icon">✏️</div>
    <div className="action-card-title">Update Advance</div>
    <div className="action-card-desc">Edit advance payment info</div>
  </div>

  <div
    className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.GETALL)}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">All Advances</div>
    <div className="action-card-desc">View all advance records</div>
  </div>

  <div
    className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.DELETE)}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Advance</div>
    <div className="action-card-desc">Remove advance record</div>
  </div>
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

              {/* Deduction Type Selection */}
              <div className="form-field" style={{ marginTop: 16 }}>
                <label className="field-label">Deduction Type *</label>
                <div className="adv-deduction-type-row">
                  <button type="button"
                    className={`adv-deduction-btn ${addForm.deductionType === 'Monthly Installment' ? 'adv-deduction-active' : ''}`}
                    onClick={() => setAddForm({ ...addForm, deductionType: 'Monthly Installment', fixedDeductionAmount: '' })}>
                    📅 Monthly Installment
                  </button>
                  <button type="button"
                    className={`adv-deduction-btn ${addForm.deductionType === 'Fixed Amount' ? 'adv-deduction-active' : ''}`}
                    onClick={() => setAddForm({ ...addForm, deductionType: 'Fixed Amount', installmentMonths: '' })}>
                    💵 Fixed Amount
                  </button>
                  <button type="button"
                    className={`adv-deduction-btn ${addForm.deductionType === 'Custom' ? 'adv-deduction-active' : ''}`}
                    onClick={() => setAddForm({ ...addForm, deductionType: 'Custom', installmentMonths: '', fixedDeductionAmount: '' })}>
                    ⚙️ Custom
                  </button>
                </div>
              </div>

              {/* Conditional Fields Based on Deduction Type */}
              {addForm.deductionType === 'Monthly Installment' && (
                <div className="form-field" style={{ marginTop: 16 }}>
                  <label className="field-label">Installment Months *</label>
                  <input className="field-input" type="number" min="1" placeholder="e.g., 5"
                    value={addForm.installmentMonths}
                    onChange={e => setAddForm({ ...addForm, installmentMonths: e.target.value })} />
                  <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Number of months to deduct the advance amount
                  </small>
                </div>
              )}

              {addForm.deductionType === 'Fixed Amount' && (
                <div className="form-field" style={{ marginTop: 16 }}>
                  <label className="field-label">Fixed Deduction Amount (₹) *</label>
                  <input className="field-input" type="number" min="0" step="0.01" placeholder="e.g., 1500"
                    value={addForm.fixedDeductionAmount}
                    onChange={e => setAddForm({ ...addForm, fixedDeductionAmount: e.target.value })} />
                  <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Amount to deduct from each salary payment
                  </small>
                </div>
              )}

              {addForm.deductionType === 'Custom' && (
                <div className="adv-info-box" style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>
                    ⚙️ Custom mode allows manual tracking of deductions. You can update the deducted amount manually when processing salary payments.
                  </span>
                </div>
              )}

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
                  {addPreview && (
                    <div className="adv-preview-item" style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 8 }}>
                      <span>{addPreview.type}</span>
                      <strong style={{ color: 'var(--primary)' }}>{addPreview.value}</strong>
                    </div>
                  )}
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
                  <span className={`adv-status-chip ${
                    updateFound.status === 'Paid' ? 'adv-status-chip-received' :
                    updateFound.status === 'Partial' ? 'adv-status-chip-partial' : 'adv-status-chip-pending'
                  }`}>
                    {updateFound.status}
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

                  {/* Deduction Type Selection */}
                  <div className="form-field" style={{ marginTop: 16 }}>
                    <label className="field-label">Deduction Type *</label>
                    <div className="adv-deduction-type-row">
                      <button type="button"
                        className={`adv-deduction-btn ${updateForm.deductionType === 'Monthly Installment' ? 'adv-deduction-active' : ''}`}
                        onClick={() => setUpdateForm({ ...updateForm, deductionType: 'Monthly Installment', fixedDeductionAmount: '' })}>
                        📅 Monthly Installment
                      </button>
                      <button type="button"
                        className={`adv-deduction-btn ${updateForm.deductionType === 'Fixed Amount' ? 'adv-deduction-active' : ''}`}
                        onClick={() => setUpdateForm({ ...updateForm, deductionType: 'Fixed Amount', installmentMonths: '' })}>
                        💵 Fixed Amount
                      </button>
                      <button type="button"
                        className={`adv-deduction-btn ${updateForm.deductionType === 'Custom' ? 'adv-deduction-active' : ''}`}
                        onClick={() => setUpdateForm({ ...updateForm, deductionType: 'Custom', installmentMonths: '', fixedDeductionAmount: '' })}>
                        ⚙️ Custom
                      </button>
                    </div>
                  </div>

                  {/* Conditional Fields */}
                  {updateForm.deductionType === 'Monthly Installment' && (
                    <div className="form-field" style={{ marginTop: 16 }}>
                      <label className="field-label">Installment Months *</label>
                      <input className="field-input" type="number" min="1"
                        value={updateForm.installmentMonths}
                        onChange={e => setUpdateForm({ ...updateForm, installmentMonths: e.target.value })} />
                    </div>
                  )}

                  {updateForm.deductionType === 'Fixed Amount' && (
                    <div className="form-field" style={{ marginTop: 16 }}>
                      <label className="field-label">Fixed Deduction Amount (₹) *</label>
                      <input className="field-input" type="number" min="0" step="0.01"
                        value={updateForm.fixedDeductionAmount}
                        onChange={e => setUpdateForm({ ...updateForm, fixedDeductionAmount: e.target.value })} />
                    </div>
                  )}

                  {/* Tracking Fields */}
                  <div className="form-row adv-form-grid" style={{ marginTop: 16 }}>
                    <div className="form-field">
                      <label className="field-label">Deducted Amount (₹)</label>
                      <input className="field-input" type="number" min="0" step="0.01"
                        value={updateForm.deductedAmount}
                        onChange={e => setUpdateForm({ ...updateForm, deductedAmount: e.target.value })} />
                      <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                        Amount already deducted from salary
                      </small>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Remaining Amount (₹)</label>
                      <input className="field-input" type="number" min="0" step="0.01"
                        value={updateForm.remainingAmount}
                        onChange={e => setUpdateForm({ ...updateForm, remainingAmount: e.target.value })} />
                      <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                        Amount still pending
                      </small>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Status</label>
                      <select className="field-input"
                        value={updateForm.status}
                        onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}>
                        <option value="Pending">Pending</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {updateForm.advanceAmount > 0 && (
                    <div style={{ marginTop: 20, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#475569' }}>
                        <span>Repayment Progress</span>
                        <span style={{ fontWeight: 700 }}>
                          {((updateForm.deductedAmount / updateForm.advanceAmount) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min((updateForm.deductedAmount / updateForm.advanceAmount) * 100, 100)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #10b981, #059669)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#64748b' }}>
                        <span>Deducted: ₹{Number(updateForm.deductedAmount).toLocaleString('en-IN')}</span>
                        <span>Remaining: ₹{Number(updateForm.remainingAmount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}

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
                  ['Labour ID',           deleteFound.labour?.labourId || '—'],
                  ['Name',                deleteFound.name || '—'],
                  ['Work Type',           (() => { const l = getLabourInfo(deleteFound); return l?.workType || '—'; })()],
                  ['Date',                new Date(deleteFound.date).toLocaleDateString('en-IN')],
                  ['Advance Amount',      `₹${Number(deleteFound.advanceAmount).toLocaleString('en-IN')}`],
                  ['Deduction Type',      deleteFound.deductionType || '—'],
                  ['Installment Months',  deleteFound.installmentMonths || '—'],
                  ['Fixed Deduction',     deleteFound.fixedDeductionAmount ? `₹${Number(deleteFound.fixedDeductionAmount).toLocaleString('en-IN')}` : '—'],
                  ['Deducted Amount',     `₹${Number(deleteFound.deductedAmount || 0).toLocaleString('en-IN')}`],
                  ['Remaining Amount',    `₹${Number(deleteFound.remainingAmount || 0).toLocaleString('en-IN')}`],
                  ['Status',              deleteFound.status || 'Pending'],
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
                <span>Deducted</span><strong>₹{totalDeductedAll.toLocaleString('en-IN')}</strong>
              </div>
              <div className="adv-chip adv-chip-pending">
                <span>Remaining</span><strong>₹{totalRemainingAll.toLocaleString('en-IN')}</strong>
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
                  <option value="Pending">⏳ Pending</option>
                  <option value="Partial">🔄 Partial</option>
                  <option value="Paid">✅ Paid</option>
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
                        <span className={`adv-status-chip ${
                          selectedAdvObj.status === 'Paid' ? 'adv-status-chip-received' :
                          selectedAdvObj.status === 'Partial' ? 'adv-status-chip-partial' : 'adv-status-chip-pending'
                        }`}>
                          {selectedAdvObj.status === 'Paid' ? '✅ Paid' : 
                           selectedAdvObj.status === 'Partial' ? '🔄 Partial' : '⏳ Pending'}
                        </span>
                      </div>
                      <button className="cp-close-btn" onClick={() => setSelectedAdvId('')}>✕</button>
                    </div>
                    <div className="adv-detail-grid">
                      {[
                        ['Labour ID',           selectedAdvObj.labour?.labourId || '—'],
                        ['Name',                selectedAdvObj.name || '—'],
                        ['Work Type',           (() => { const l = getLabourInfo(selectedAdvObj); return l?.workType || '—'; })()],
                        ['Daily Wage',          (() => { const l = getLabourInfo(selectedAdvObj); return l ? `₹${Number(l.dailyWage).toLocaleString('en-IN')}` : '—'; })()],
                        ['Date',                new Date(selectedAdvObj.date).toLocaleDateString('en-IN')],
                        ['Advance Amount',      `₹${Number(selectedAdvObj.advanceAmount).toLocaleString('en-IN')}`],
                        ['Deduction Type',      selectedAdvObj.deductionType || '—'],
                        ['Installment Months',  selectedAdvObj.installmentMonths || '—'],
                        ['Fixed Deduction',     selectedAdvObj.fixedDeductionAmount ? `₹${Number(selectedAdvObj.fixedDeductionAmount).toLocaleString('en-IN')}` : '—'],
                        ['Deducted Amount',     `₹${Number(selectedAdvObj.deductedAmount || 0).toLocaleString('en-IN')}`],
                        ['Remaining Amount',    `₹${Number(selectedAdvObj.remainingAmount || 0).toLocaleString('en-IN')}`],
                        ['Status',              selectedAdvObj.status || 'Pending'],
                      ].map(([k, v]) => (
                        <div className="adv-detail-item" key={k}>
                          <span className="adv-detail-key">{k}</span>
                          <span className="adv-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Progress Bar */}
                    {selectedAdvObj.advanceAmount > 0 && (
                      <div style={{ marginTop: 16, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#475569' }}>
                          <span>Repayment Progress</span>
                          <span style={{ fontWeight: 700 }}>
                            {(((selectedAdvObj.deductedAmount || 0) / selectedAdvObj.advanceAmount) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(((selectedAdvObj.deductedAmount || 0) / selectedAdvObj.advanceAmount) * 100, 100)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="adv-table-scroll">
                  <table className="clients-table adv-table">
                    <thead>
                      <tr>
                        <th>Labour ID</th><th>Name</th><th>Work Type</th>
                        <th>Date</th><th>Amount</th><th>Deduction Type</th>
                        <th>Deducted</th><th>Remaining</th><th>Status</th>
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
                            <td style={{ fontSize: 12 }}>
                              {a.deductionType === 'Monthly Installment' && a.installmentMonths ? 
                                `📅 ${a.installmentMonths}m` : 
                               a.deductionType === 'Fixed Amount' && a.fixedDeductionAmount ?
                                `💵 ₹${Number(a.fixedDeductionAmount).toLocaleString('en-IN')}` :
                               a.deductionType === 'Custom' ? '⚙️ Custom' : '—'}
                            </td>
                            <td className="adv-amt-cell">₹{Number(a.deductedAmount || 0).toLocaleString('en-IN')}</td>
                            <td className="adv-amt-cell">₹{Number(a.remainingAmount || 0).toLocaleString('en-IN')}</td>
                            <td>
                              <span className={`adv-status-chip ${
                                a.status === 'Paid' ? 'adv-status-chip-received' :
                                a.status === 'Partial' ? 'adv-status-chip-partial' : 'adv-status-chip-pending'
                              }`}>
                                {a.status === 'Paid' ? '✅ Paid' : 
                                 a.status === 'Partial' ? '🔄 Partial' : '⏳ Pending'}
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
                        <td></td>
                        <td className="adv-amt-cell" style={{ fontWeight: 800 }}>
                          ₹{totalDeductedAll.toLocaleString('en-IN')}
                        </td>
                        <td className="adv-amt-cell" style={{ fontWeight: 800, color: '#c93360' }}>
                          ₹{totalRemainingAll.toLocaleString('en-IN')}
                        </td>
                        <td></td>
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