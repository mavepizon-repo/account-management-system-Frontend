import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/Worksubcontractpage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

const WORK_STATUSES = ['Pending', 'In Progress', 'Completed', 'On Hold'];
const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'];

const emptyForm = {
  subcontract: '', projectName: '', description: '',
  startDate: '', endDate: '', status: 'Pending',
  totalAmount: '', paidAmount: '0',
};

const WorkFormFields = ({ form, setForm, subs }) => (
  <div className="form-row work-form-grid">
    <div className="form-field full-width">
      <label className="field-label">Subcontractor *</label>
      <SearchableDropdown
        options={subs.map(s => ({
          value: s._id,
          label: `${s.subcontractCode} — ${s.name}${s.skillType ? ` (${s.skillType})` : ''}`,
        }))}
        value={form.subcontract}
        onChange={val => setForm({ ...form, subcontract: val })}
        placeholder="-- Select Subcontractor --"
      />
    </div>
    <div className="form-field full-width">
      <label className="field-label">Project Name *</label>
      <input className="field-input" placeholder="Project name" value={form.projectName}
        onChange={e => setForm({ ...form, projectName: e.target.value })} />
    </div>
    <div className="form-field full-width">
      <label className="field-label">Description</label>
      <textarea className="field-input" placeholder="Project description / scope of work" value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">Start Date</label>
      <input className="field-input" type="date" value={form.startDate}
        onChange={e => setForm({ ...form, startDate: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">End Date</label>
      <input className="field-input" type="date" value={form.endDate}
        onChange={e => setForm({ ...form, endDate: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">Work Status</label>
      <div className="dropdown-wrap">
        <select className="dropdown-select" value={form.status}
          onChange={e => setForm({ ...form, status: e.target.value })}>
          {WORK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="dropdown-arrow">▾</span>
      </div>
    </div>
    <div className="form-field">
      <label className="field-label">Total Amount (₹) *</label>
      <input className="field-input" type="number" placeholder="0.00" value={form.totalAmount}
        onChange={e => setForm({ ...form, totalAmount: e.target.value })} />
    </div>
    <div className="form-field">
      <label className="field-label">Paid Amount (₹)</label>
      <input className="field-input" type="number" placeholder="0.00" value={form.paidAmount}
        onChange={e => setForm({ ...form, paidAmount: e.target.value })} />
    </div>
    {form.totalAmount && (
      <div className="form-field">
        <label className="field-label">Balance (₹)</label>
        <input className="field-input work-calc-field" readOnly
          value={form.totalAmount ? `₹${(parseFloat(form.totalAmount || 0) - parseFloat(form.paidAmount || 0)).toLocaleString('en-IN')}` : ''} />
      </div>
    )}
  </div>
);

function WorkSubcontractPage({ onLogout }) {
  const navigate = useNavigate();

  const [works, setWorks]       = useState([]);
  const [subs, setSubs]         = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [statusFilter, setStatusFilter]   = useState('All');
  const [payFilter, setPayFilter]         = useState('All');
  const [subFilter, setSubFilter]         = useState('');

  const [addForm, setAddForm]       = useState(emptyForm);

  // UPDATE — searchable dropdown
  const [updateWorkId, setUpdateWorkId]   = useState('');
  const [updateFound, setUpdateFound]     = useState(null);
  const [updateForm, setUpdateForm]       = useState(emptyForm);

  // DELETE — searchable dropdown
  const [deleteWorkId, setDeleteWorkId]   = useState('');
  const [deleteFound, setDeleteFound]     = useState(null);

  // GET ALL
  const [selectedWorkId, setSelectedWorkId] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchSubs = async () => {
    try {
      const res  = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      setSubs(data.data || []);
    } catch {}
  };

  const fetchWorks = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      setWorks(data.works || []);
    } catch { showToast('Failed to fetch works', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubs(); fetchWorks(); }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateWorkId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteWorkId(''); setDeleteFound(null);
    setSelectedWorkId(''); setStatusFilter('All'); setPayFilter('All'); setSubFilter('');
  };

  const getSubLabel = (work) => {
    const s = work.subcontract;
    if (!s) return '—';
    if (typeof s === 'object' && s.name) return `${s.subcontractCode} — ${s.name}`;
    const found = subs.find(sub => sub._id === s);
    return found ? `${found.subcontractCode} — ${found.name}` : '—';
  };

  // ── Options for work SearchableDropdown ──────────────────
  const workOptions = works.map(w => ({
    value: w._id,
    label: `[${w._id.slice(-6).toUpperCase()}] ${w.projectName} — ${getSubLabel(w)} — ${w.status} — ${w.paymentStatus} — ₹${Number(w.totalAmount || 0).toLocaleString('en-IN')}`,
  }));

  // ── ADD ───────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.subcontract || !addForm.projectName || !addForm.totalAmount) {
      showToast('Subcontractor, Project Name and Total Amount are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API}/workSubcontract/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontract:  addForm.subcontract,
          projectName:  addForm.projectName,
          description:  addForm.description,
          startDate:    addForm.startDate || undefined,
          endDate:      addForm.endDate   || undefined,
          status:       addForm.status,
          totalAmount:  parseFloat(addForm.totalAmount),
          paidAmount:   parseFloat(addForm.paidAmount) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchWorks();
        setAddForm(emptyForm);
        showToast(`Project "${data.data?.projectName}" added!`);
      } else showToast(data.message || 'Failed to add', 'error');
    } catch { showToast('Error adding project', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE SELECT ─────────────────────────────────────────
  const handleUpdateSelect = (workId) => {
    setUpdateWorkId(workId);
    const found = works.find(w => w._id === workId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        subcontract:  found.subcontract?._id || found.subcontract || '',
        projectName:  found.projectName,
        description:  found.description || '',
        startDate:    found.startDate?.split('T')[0] || '',
        endDate:      found.endDate?.split('T')[0]   || '',
        status:       found.status || 'Pending',
        totalAmount:  found.totalAmount,
        paidAmount:   found.paidAmount,
      });
    } else { setUpdateFound(null); setUpdateForm(emptyForm); }
  };

  // ── UPDATE ────────────────────────────────────────────────
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API}/workSubcontract/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontract:  updateForm.subcontract,
          projectName:  updateForm.projectName,
          description:  updateForm.description,
          startDate:    updateForm.startDate || undefined,
          endDate:      updateForm.endDate   || undefined,
          status:       updateForm.status,
          totalAmount:  parseFloat(updateForm.totalAmount),
          paidAmount:   parseFloat(updateForm.paidAmount) || 0,
        }),
      });
      if (res.ok) {
        await fetchWorks();
        showToast('Project updated!');
        setUpdateFound(null); setUpdateWorkId(''); setUpdateForm(emptyForm);
      } else showToast('Failed to update', 'error');
    } catch { showToast('Error updating project', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE SELECT ─────────────────────────────────────────
  const handleDeleteSelect = (workId) => {
    setDeleteWorkId(workId);
    setDeleteFound(works.find(w => w._id === workId) || null);
  };

  // ── DELETE ────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/workSubcontract/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchWorks();
        showToast('Project deleted!', 'info');
        setDeleteFound(null); setDeleteWorkId('');
      } else showToast('Failed to delete', 'error');
    } catch { showToast('Error deleting project', 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered works ────────────────────────────────────────
  const filteredWorks = works.filter(w => {
    const matchSub  = subFilter ? (w.subcontract?._id || w.subcontract) === subFilter : true;
    const matchPay  = payFilter === 'All' ? true : w.paymentStatus === payFilter;
    const matchStat = statusFilter === 'All' ? true : w.status === statusFilter;
    return matchSub && matchPay && matchStat;
  });

  const selectedWorkObj = works.find(w => w._id === selectedWorkId);

  const totalContract = filteredWorks.reduce((s, w) => s + (w.totalAmount || 0), 0);
  const totalPaid     = filteredWorks.reduce((s, w) => s + (w.paidAmount  || 0), 0);
  const totalBal      = totalContract - totalPaid;

  const statusBadge = (status) => {
    const map = { Paid: 'status-paid', Partial: 'status-partial', Unpaid: 'status-pending' };
    return <span className={`status-badge ${map[status] || 'status-pending'}`}>{status || 'Unpaid'}</span>;
  };

  const workStatusBadge = (status) => (
    <span className={`work-status-badge ws-${(status || 'pending').toLowerCase().replace(' ', '-')}`}>{status || 'Pending'}</span>
  );

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/subcontractor')}>←</button>
          <h1 className="entity-page-title">Project Details</h1>
          <span className="entity-page-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
            {works.length} Projects
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>Add Project</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>Update Project</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>Delete Project</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>All Projects</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner sub-loading" /></div>}

        {/* ── ADD ── */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Project</div>
            <form onSubmit={handleAdd}>
              <WorkFormFields form={addForm} setForm={setAddForm} subs={subs} />
              <button type="submit" className="submit-btn" disabled={loading}>Add Project</button>
            </form>
          </div>
        )}

        {/* ── UPDATE — searchable dropdown ── */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Project</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Project *</label>
              <SearchableDropdown
                options={workOptions}
                value={updateWorkId}
                onChange={handleUpdateSelect}
                placeholder="-- Select Project --"
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.status}</span>
                  <span className="update-found-name">{updateFound.projectName}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <WorkFormFields form={updateForm} setForm={setUpdateForm} subs={subs} />
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    Update Project
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ── DELETE — searchable dropdown ── */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Project</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Project *</label>
              <SearchableDropdown
                options={workOptions}
                value={deleteWorkId}
                onChange={handleDeleteSelect}
                placeholder="-- Select Project --"
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Subcontractor', getSubLabel(deleteFound)],
                  ['Project Name',  deleteFound.projectName],
                  ['Description',   deleteFound.description || '—'],
                  ['Start Date',    deleteFound.startDate?.split('T')[0] || '—'],
                  ['End Date',      deleteFound.endDate?.split('T')[0]   || '—'],
                  ['Work Status',   deleteFound.status],
                  ['Total Amount',  `₹${(deleteFound.totalAmount || 0).toLocaleString('en-IN')}`],
                  ['Paid Amount',   `₹${(deleteFound.paidAmount  || 0).toLocaleString('en-IN')}`],
                  ['Balance',       `₹${((deleteFound.totalAmount || 0) - (deleteFound.paidAmount || 0)).toLocaleString('en-IN')}`],
                  ['Payment Status',deleteFound.paymentStatus],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
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
            <div className="panel-title">All Projects</div>

            {/* Summary cards */}
            <div className="work-summary-chips">
              <div className="work-chip-card work-chip-total"><span>Total Projects</span><strong>{filteredWorks.length}</strong></div>
              <div className="work-chip-card work-chip-contract"><span>Total Contract</span><strong>₹{totalContract.toLocaleString('en-IN')}</strong></div>
              <div className="work-chip-card work-chip-paid"><span>Total Paid</span><strong>₹{totalPaid.toLocaleString('en-IN')}</strong></div>
              <div className="work-chip-card work-chip-due"><span>Outstanding</span><strong>₹{totalBal.toLocaleString('en-IN')}</strong></div>
            </div>

            {/* Filters */}
            <div className="work-filters-row">
              {/* Subcontractor filter — searchable */}
              <div className="form-field" style={{ minWidth: 260 }}>
                <label className="field-label">Filter by Subcontractor</label>
                <SearchableDropdown
                  options={subs.map(s => ({ value: s._id, label: `${s.subcontractCode} — ${s.name}` }))}
                  value={subFilter}
                  onChange={(val) => { setSubFilter(val); setSelectedWorkId(''); }}
                  placeholder="All Subcontractors"
                />
              </div>

              {/* Work status filter tabs */}
              <div className="work-filter-tabs">
                {['All', ...WORK_STATUSES].map(s => (
                  <button key={s} className={`work-filter-tab ${statusFilter === s ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(s); setSelectedWorkId(''); }}>
                    {s}
                    <span className="work-tab-count">
                      {s === 'All' ? works.length : works.filter(w => w.status === s).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Payment filter tabs */}
              <div className="work-filter-tabs">
                {['All', 'Paid', 'Partial', 'Unpaid'].map(p => (
                  <button key={p} className={`pay-filter-tab pay-tab-${p.toLowerCase()} ${payFilter === p ? 'active' : ''}`}
                    onClick={() => { setPayFilter(p); setSelectedWorkId(''); }}>
                    {p}
                    <span className="work-tab-count">
                      {p === 'All' ? works.length : works.filter(w => w.paymentStatus === p).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {filteredWorks.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No projects found.</p></div>
            ) : (
              <>
                {/* Selected work detail card */}
                {selectedWorkObj && (
                  <div className="work-detail-card">
                    <div className="work-detail-header">
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)' }}>{selectedWorkObj.projectName}</span>
                        <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {workStatusBadge(selectedWorkObj.status)}
                          {statusBadge(selectedWorkObj.paymentStatus)}
                        </div>
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedWorkId('')}>✕</button>
                    </div>
                    <div className="work-detail-grid">
                      {[
                        ['Subcontractor', getSubLabel(selectedWorkObj)],
                        ['Description',   selectedWorkObj.description || '—'],
                        ['Start Date',    selectedWorkObj.startDate?.split('T')[0] || '—'],
                        ['End Date',      selectedWorkObj.endDate?.split('T')[0]   || '—'],
                        ['Work Status',   selectedWorkObj.status],
                        ['Total Amount',  `₹${Number(selectedWorkObj.totalAmount).toLocaleString('en-IN')}`],
                        ['Paid Amount',   `₹${Number(selectedWorkObj.paidAmount).toLocaleString('en-IN')}`],
                        ['Balance',       `₹${Number((selectedWorkObj.totalAmount || 0) - (selectedWorkObj.paidAmount || 0)).toLocaleString('en-IN')}`],
                        ['Payment Status',selectedWorkObj.paymentStatus],
                      ].map(([k, v]) => (
                        <div className="inv-detail-item" key={k}>
                          <span className="inv-detail-key">{k}</span>
                          <span className="inv-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work card list */}
                <div className="work-card-list">
                  {filteredWorks.map(w => {
                    const bal = (w.totalAmount || 0) - (w.paidAmount || 0);
                    const isSelected = selectedWorkId === w._id;
                    return (
                      <div key={w._id}
                        className={`work-row-card ${isSelected ? 'work-row-selected' : ''}`}
                        onClick={() => setSelectedWorkId(isSelected ? '' : w._id)}>
                        <div className="work-row-left">
                          <div className="work-row-project">{w.projectName}</div>
                          <div className="work-row-sub">{getSubLabel(w)}</div>
                          {w.description && <div className="work-row-desc">{w.description}</div>}
                        </div>
                        <div className="work-row-mid">
                          <div className="work-row-dates">
                            {w.startDate?.split('T')[0]} {w.endDate ? `→ ${w.endDate.split('T')[0]}` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                            <span className="work-row-amt">₹{Number(w.totalAmount).toLocaleString('en-IN')}</span>
                            <span className="work-row-paid">Paid ₹{Number(w.paidAmount).toLocaleString('en-IN')}</span>
                            {bal > 0 && <span className="work-row-bal">Bal ₹{Number(bal).toLocaleString('en-IN')}</span>}
                          </div>
                        </div>
                        <div className="work-row-right">
                          {workStatusBadge(w.status)}
                          {statusBadge(w.paymentStatus)}
                        </div>
                      </div>
                    );
                  })}
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

export default WorkSubcontractPage;