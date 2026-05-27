import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import logo from '../logo image/logo.jpeg';
import '../styles/EntityPage.css';
import '../styles/Subcontractorpage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  companyName: '',
  skillType: '',
  gstNumber: '',
};

// ── Form Fields Component ─────────────────────────────
const SubFormFields = ({ form, setForm }) => (
  <div className="form-row sub-form-grid">
    <div className="form-field">
      <label className="field-label">Name *</label>
      <input
        className="field-input"
        placeholder="Full name"
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
      />
    </div>

    <div className="form-field">
      <label className="field-label">Phone *</label>
      <input
        className="field-input"
        placeholder="10 digit number"
        maxLength={10}
        value={form.phone}
        onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
      />
    </div>

    <div className="form-field">
      <label className="field-label">Email</label>
      <input
        className="field-input"
        placeholder="email@example.com"
        type="email"
        value={form.email}
        onChange={e => setForm({ ...form, email: e.target.value })}
      />
    </div>

    <div className="form-field">
      <label className="field-label">Skill / Trade</label>
      <input
        className="field-input"
        placeholder="Civil, Electrical, Plumbing..."
        value={form.skillType}
        onChange={e => setForm({ ...form, skillType: e.target.value })}
      />
    </div>

    <div className="form-field">
      <label className="field-label">Company Name</label>
      <input
        className="field-input"
        placeholder="Company or firm name"
        value={form.companyName}
        onChange={e => setForm({ ...form, companyName: e.target.value })}
      />
    </div>

    <div className="form-field">
      <label className="field-label">GST Number</label>
      <input
        className="field-input"
        placeholder="GST Number"
        value={form.gstNumber}
        onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
      />
    </div>

    <div className="form-field full-width">
      <label className="field-label">Address</label>
      <textarea
        className="field-input"
        placeholder="Enter full address"
        value={form.address}
        onChange={e => setForm({ ...form, address: e.target.value })}
      />
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────
function SubcontractorPage({ onLogout }) {
  const navigate = useNavigate();

  const [subs, setSubs]         = useState([]);
  const [works, setWorks]       = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);

  // ADD
  const [addForm, setAddForm] = useState(emptyForm);

  // UPDATE
  const [updateSubId, setUpdateSubId] = useState('');
  const [updateFound, setUpdateFound] = useState(null);
  const [updateForm, setUpdateForm]   = useState(emptyForm);

  // DELETE
  const [deleteSubId, setDeleteSubId] = useState('');
  const [deleteFound, setDeleteFound] = useState(null);

  // GET ALL
  const [selectedSub, setSelectedSub]       = useState('');
  const [profileSub, setProfileSub]         = useState(null);
  const [inlineEditId, setInlineEditId]     = useState(null);
  const [inlineEditForm, setInlineEditForm] = useState(emptyForm);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── FIX: backend GET /api/subcontract/getall returns { count, data: [] }
  const fetchSubs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      // Backend returns { count, data: [...] }
      const list = data.data || [];
      setSubs(list);
      return list;
    } catch {
      showToast('Failed to fetch subcontractors', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // ── FIX: backend GET /api/workSubcontract/getall returns { count, data: [] }
  // NOT { works: [] } — backend getAllWorks returns { count, data: works }
  const fetchWorks = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      // Backend getAllWorks: res.status(200).json({ count: works.length, data: works })
      setWorks(data.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSubs();
    fetchWorks();
  }, [fetchSubs, fetchWorks]);

  const subOptions = subs.map(s => ({
    value: s._id,
    label: `${s.subcontractCode} — ${s.name}${s.phone ? ` (${s.phone})` : ''}${s.skillType ? ` · ${s.skillType}` : ''}`,
  }));

  const getSubStats = useCallback((subId) => {
    const subWorks = works.filter(w => {
      const s = w.subcontract;
      if (!s) return false;
      if (typeof s === 'object') return s._id === subId;
      return s === subId;
    });
    const totalAmt    = subWorks.reduce((acc, w) => acc + (w.grandTotal  || w.totalAmount || 0), 0);
    const totalPaid   = subWorks.reduce((acc, w) => acc + (w.cumulativePaidAmount || 0), 0);
    const outstanding = subWorks.reduce((acc, w) => acc + (w.balanceAmount ?? 0), 0);
    return { count: subWorks.length, totalAmt, totalPaid, outstanding, subWorks };
  }, [works]);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateSubId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteSubId(''); setDeleteFound(null);
    setSelectedSub(''); setProfileSub(null); setInlineEditId(null);
  };

  // ── PRINT Subcontractor Profile ───────────────────────
  const handlePrintSubcontractor = (sub, stats) => {
    const fmt = v => Number(v || 0).toLocaleString('en-IN');

    const workRows = stats.subWorks.map((w, i) => {
      // FIX: use cumulativePaidAmount and balanceAmount from backend model
      const paid = w.cumulativePaidAmount || 0;
      const bal  = w.balanceAmount ?? ((w.grandTotal || w.totalAmount || 0) - paid);
      const total = w.grandTotal || w.totalAmount || 0;
      const payStatusColor =
        w.paymentStatus === 'Paid'    ? '#036b4e' :
        w.paymentStatus === 'Partial' ? '#7a5000' : '#c93360';
      const workStatusColor =
        w.status === 'Completed'   ? '#036b4e' :
        w.status === 'In Progress' ? '#1d4ed8' :
        w.status === 'On Hold'     ? '#7a5000' : '#c93360';
      return `
        <tr>
          <td class="tc">${i + 1}</td>
          <td style="font-weight:700">${w.projectName || ''}</td>
          <td>${w.description || '—'}</td>
          <td class="tc">${w.startDate ? w.startDate.split('T')[0] : '—'}</td>
          <td class="tc">${w.endDate   ? w.endDate.split('T')[0]   : '—'}</td>
          <td class="tc"><span style="color:${workStatusColor};font-weight:700;">${w.status || 'Pending'}</span></td>
          <td class="tr">₹${fmt(total)}</td>
          <td class="tr" style="color:#036b4e;font-weight:700;">₹${fmt(paid)}</td>
          <td class="tr" style="color:${bal > 0 ? '#c93360' : '#036b4e'};font-weight:700;">₹${fmt(bal)}</td>
          <td class="tc"><span style="color:${payStatusColor};font-weight:700;">${w.paymentStatus || 'Unpaid'}</span></td>
        </tr>`;
    }).join('');

    const w = window.open('', '_blank', 'width=1150,height=820');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Subcontractor Profile — ${sub.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800;900&family=Open+Sans:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Open Sans',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;}
  .hdr{background:#1c1c1c;display:flex;justify-content:space-between;align-items:center;padding:18px 32px;gap:24px;}
  .hdr-brand{display:flex;align-items:center;gap:0;flex-shrink:0;}
  .logo-icon{width:80px;height:50px;margin-right:10px;flex-shrink:0;object-fit:contain;}
  .hdr-div{width:1px;height:50px;background:rgba(255,255,255,0.22);margin:0 24px;flex-shrink:0;}
  .hdr-addr{font-size:10.5px;line-height:1.85;color:#ffffff;}
  .hdr-doc-title{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;letter-spacing:4px;color:#ffffff;text-align:right;white-space:nowrap;flex-shrink:0;}
  .body{padding:26px 32px 0;}
  .profile-meta{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;gap:24px;}
  .profile-left{}
  .sc-code-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .sc-code-lbl{font-size:12px;font-weight:700;color:#333;}
  .sc-code-box{border:1px solid #bbb;border-radius:4px;padding:5px 12px;font-size:12px;font-weight:700;min-width:140px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
  .sc-name{font-size:16px;font-weight:800;color:#111;margin-bottom:4px;}
  .sc-detail{font-size:12px;color:#444;line-height:1.8;margin-bottom:2px;}
  .sc-gst{font-size:12px;color:#222;font-weight:700;margin-top:4px;}
  .sc-skill{display:inline-block;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:6px;}
  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
  .stat-card{border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:5px;border:1.5px solid transparent;}
  .stat-card span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.75;}
  .stat-card strong{font-size:20px;font-weight:800;font-family:'Montserrat',sans-serif;}
  .sc-total    {background:#fef9c3;color:#92400e;border-color:#fcd34d;}
  .sc-billed   {background:#fffbe8;color:#7a5000;border-color:#ffe08a;}
  .sc-paid     {background:#e6fdf6;color:#036b4e;border-color:#a0f0d8;}
  .sc-due      {background:#fff4f7;color:#c93360;border-color:#ffc8d4;}
  .section-title{font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;padding-bottom:8px;border-bottom:1.5px solid #f0f0f0;}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#1c1c1c;color:#fff;}
  thead th{padding:9px 10px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.3px;text-align:left;}
  tbody tr{border-bottom:1px solid #e8e8e8;}
  tbody tr:nth-child(even){background:#fafafa;}
  tbody td{padding:9px 10px;font-size:12px;}
  .no-projects{text-align:center;padding:28px;color:#aaa;font-size:13px;background:#fafafa;border-radius:8px;border:1.5px dashed #e0e0e0;}
  .footer{margin-top:40px;padding:14px 32px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#999;}
  .tc{text-align:center;} .tr{text-align:right;}
  @media print{body{padding:0;}.page{width:100%;margin:0;}@page{margin:8mm;}}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div style="display:flex;align-items:center;flex:1;min-width:0;">
      <img src="${window.location.origin}${logo}" alt="logo" class="logo-icon"/>
      <div class="hdr-div"></div>
      <div class="hdr-addr">
        5-6, Indira Nagar, PM Samy Colony, Ratinapuri, Coimbatore 641012, India<br/>
        M : +91 9677731526 &nbsp;&nbsp;|&nbsp;&nbsp; E : info@designartindia.in<br/>
        GST No. : 33BNCPP2332Q1ZT
      </div>
    </div>
    <div class="hdr-doc-title">SUBCONTRACTOR<br/>PROFILE</div>
  </div>
  <div class="body">
    <div class="profile-meta">
      <div class="profile-left">
        <div class="sc-code-row">
          <span class="sc-code-lbl">Sub Code :</span>
          <div class="sc-code-box"><span>${sub.subcontractCode || 'N/A'}</span><span>&#9660;</span></div>
        </div>
        <div class="sc-name">${sub.name || ''}</div>
        ${sub.phone       ? `<div class="sc-detail">📞 ${sub.phone}</div>` : ''}
        ${sub.email       ? `<div class="sc-detail">✉️ ${sub.email}</div>` : ''}
        ${sub.companyName ? `<div class="sc-detail">🏢 ${sub.companyName}</div>` : ''}
        ${sub.address     ? `<div class="sc-detail">📍 ${sub.address.replace(/\n/g, ', ')}</div>` : ''}
        ${sub.gstNumber   ? `<div class="sc-gst">GST No. &nbsp;${sub.gstNumber}</div>` : ''}
        ${sub.skillType   ? `<span class="sc-skill">${sub.skillType}</span>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;font-weight:700;color:#333;margin-bottom:6px;">Print Date :</div>
        <div style="border:1px solid #bbb;border-radius:4px;padding:5px 14px;font-size:12px;font-weight:700;min-width:160px;text-align:center;">
          ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card sc-total">
        <span>Total Projects</span>
        <strong>${stats.count}</strong>
      </div>
      <div class="stat-card sc-billed">
        <span>Total Contract</span>
        <strong>₹${fmt(stats.totalAmt)}</strong>
      </div>
      <div class="stat-card sc-paid">
        <span>Total Paid</span>
        <strong>₹${fmt(stats.totalPaid)}</strong>
      </div>
      <div class="stat-card sc-due">
        <span>Outstanding</span>
        <strong>₹${fmt(stats.outstanding)}</strong>
      </div>
    </div>
    <div class="section-title">Project History</div>
    ${stats.subWorks.length === 0
      ? `<div class="no-projects">No projects found for this subcontractor.</div>`
      : `<table>
          <thead>
            <tr>
              <th class="tc" style="width:36px">S.No</th>
              <th>Project Name</th>
              <th>Description</th>
              <th class="tc" style="width:82px">Start</th>
              <th class="tc" style="width:82px">End</th>
              <th class="tc" style="width:80px">Work Status</th>
              <th class="tr" style="width:90px">Total (₹)</th>
              <th class="tr" style="width:90px">Paid (₹)</th>
              <th class="tr" style="width:90px">Balance (₹)</th>
              <th class="tc" style="width:80px">Payment</th>
            </tr>
          </thead>
          <tbody>
            ${workRows || `<tr><td colspan="10" style="text-align:center;padding:20px;color:#aaa">No projects</td></tr>`}
          </tbody>
        </table>`
    }
  </div>
  <div class="footer">
    <span>designart &nbsp;|&nbsp; 5-6, Indira Nagar, Coimbatore 641012</span>
    <span>Subcontractor Report — Confidential</span>
  </div>
</div>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`);
    w.document.close();
  };

  // ── ADD ───────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim())  { showToast('Name is required', 'error');           return; }
    if (!addForm.phone.trim()) { showToast('Phone is required', 'error');          return; }
    if (addForm.phone.length !== 10) { showToast('Phone must be 10 digits', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/subcontract/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        addForm.name.trim(),
          phone:       addForm.phone.trim(),
          email:       addForm.email.trim(),
          address:     addForm.address.trim(),
          companyName: addForm.companyName.trim(),
          skillType:   addForm.skillType.trim(),
          gstNumber:   addForm.gstNumber.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSubs();
        setAddForm(emptyForm);
        showToast(`${data.data?.name || 'Subcontractor'} (${data.data?.subcontractCode || ''}) added successfully!`);
      } else {
        showToast(data.message || 'Failed to add subcontractor', 'error');
      }
    } catch { showToast('Network error while adding', 'error'); }
    finally  { setLoading(false); }
  };

  const handleUpdateSelect = (subId) => {
    setUpdateSubId(subId);
    const found = subs.find(s => s._id === subId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        name:        found.name        || '',
        phone:       found.phone       || '',
        email:       found.email       || '',
        address:     found.address     || '',
        companyName: found.companyName || '',
        skillType:   found.skillType   || '',
        gstNumber:   found.gstNumber   || '',
      });
    } else { setUpdateFound(null); setUpdateForm(emptyForm); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound)              { showToast('Please select a subcontractor', 'error'); return; }
    if (!updateForm.name.trim())   { showToast('Name is required', 'error');              return; }
    if (!updateForm.phone.trim())  { showToast('Phone is required', 'error');             return; }
    try {
      setLoading(true);
      // FIX: backend route is PUT /api/subcontract/update/:id
      const res = await fetch(`${API}/subcontract/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        updateForm.name.trim(),
          phone:       updateForm.phone.trim(),
          email:       updateForm.email.trim(),
          address:     updateForm.address.trim(),
          companyName: updateForm.companyName.trim(),
          skillType:   updateForm.skillType.trim(),
          gstNumber:   updateForm.gstNumber.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const fresh = await fetchSubs();
        if (profileSub?._id === updateFound._id) {
          const refreshed = fresh.find(s => s._id === updateFound._id);
          if (refreshed) setProfileSub(refreshed);
        }
        showToast(`${data.data?.name || updateForm.name} updated successfully!`);
        setUpdateFound(null); setUpdateSubId(''); setUpdateForm(emptyForm);
      } else { showToast(data.message || 'Failed to update', 'error'); }
    } catch { showToast('Network error while updating', 'error'); }
    finally  { setLoading(false); }
  };

  const handleDeleteSelect = (subId) => {
    setDeleteSubId(subId);
    setDeleteFound(subs.find(s => s._id === subId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a subcontractor', 'error'); return; }
    try {
      setLoading(true);
      // FIX: backend route is DELETE /api/subcontract/delete/:id
      const res  = await fetch(`${API}/subcontract/delete/${deleteFound._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        await fetchSubs();
        if (profileSub?._id === deleteFound._id) { setProfileSub(null); setSelectedSub(''); }
        showToast(`${deleteFound.name} deleted successfully!`, 'info');
        setDeleteFound(null); setDeleteSubId('');
      } else { showToast(data.message || 'Failed to delete', 'error'); }
    } catch { showToast('Network error while deleting', 'error'); }
    finally  { setLoading(false); }
  };

  const startInlineEdit = (sub) => {
    setInlineEditId(sub._id);
    setInlineEditForm({
      name:        sub.name        || '',
      phone:       sub.phone       || '',
      email:       sub.email       || '',
      address:     sub.address     || '',
      companyName: sub.companyName || '',
      skillType:   sub.skillType   || '',
      gstNumber:   sub.gstNumber   || '',
    });
    setSelectedSub(''); setProfileSub(null);
  };

  const cancelInlineEdit = () => { setInlineEditId(null); setInlineEditForm(emptyForm); };

  const saveInlineEdit = async (id) => {
    if (!inlineEditForm.name.trim()) { showToast('Name is required', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/subcontract/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        inlineEditForm.name.trim(),
          phone:       inlineEditForm.phone.trim(),
          email:       inlineEditForm.email.trim(),
          address:     inlineEditForm.address.trim(),
          companyName: inlineEditForm.companyName.trim(),
          skillType:   inlineEditForm.skillType.trim(),
          gstNumber:   inlineEditForm.gstNumber.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const fresh = await fetchSubs();
        if (profileSub?._id === id) {
          const refreshed = fresh.find(s => s._id === id);
          if (refreshed) setProfileSub(refreshed);
        }
        showToast(`${data.data?.name || inlineEditForm.name} updated!`);
        setInlineEditId(null); setInlineEditForm(emptyForm);
      } else { showToast(data.message || 'Failed to update', 'error'); }
    } catch { showToast('Network error while updating', 'error'); }
    finally  { setLoading(false); }
  };

  const profileStats = profileSub ? getSubStats(profileSub._id) : null;

  const statusBadge = (status) => {
    const map = { Paid: 'status-paid', Partial: 'status-partial', Unpaid: 'status-pending' };
    return <span className={`status-badge ${map[status] || 'status-pending'}`}>{status || 'Unpaid'}</span>;
  };

  const workStatusBadge = (status) => (
    <span className={`work-status-badge ws-${(status || 'pending').toLowerCase().replace(' ', '-')}`}>
      {status || 'Pending'}
    </span>
  );

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">Subcontractor Management</h1>
          <span className="entity-page-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
            {subs.length} Subcontractors
          </span>
        </div>

       <div className="action-cards-grid">
  <div
    className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.ADD)}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Add Subcontractor</div>
    <div className="action-card-desc">Add a new subcontractor record</div>
  </div>

  <div
    className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.UPDATE)}
  >
    <div className="action-card-icon">✏️</div>
    <div className="action-card-title">Update Subcontractor</div>
    <div className="action-card-desc">Edit existing subcontractor info</div>
  </div>

  <div
    className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.GETALL)}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">Get All Subcontractors</div>
    <div className="action-card-desc">View all subcontractor records</div>
  </div>

   <div
    className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
    onClick={() => togglePanel(PANELS.DELETE)}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Subcontractor</div>
    <div className="action-card-desc">Remove a subcontractor record</div>
  </div>

  <div
    className="action-card action-card-project"
    onClick={() => navigate('/work-subcontract')}
  >
    <div className="action-card-icon">🏗️</div>
    <div className="action-card-title">Project Details</div>
    <div className="action-card-desc">View all project works</div>
  </div>
</div>
        {loading && <div className="loading-bar"><div className="loading-inner sub-loading" /></div>}

        {/* ══ ADD ══ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Subcontractor</div>
            <form onSubmit={handleAdd}>
              <SubFormFields form={addForm} setForm={setAddForm} />
              <div className="sub-code-preview">
                Auto Code: <strong>SC**** (auto-generated by server)</strong>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Adding...' : 'Add Subcontractor'}
              </button>
            </form>
          </div>
        )}

        {/* ══ UPDATE ══ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Subcontractor</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Subcontractor *</label>
              <SearchableDropdown options={subOptions} value={updateSubId} onChange={handleUpdateSelect} placeholder="-- Select Subcontractor --" />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.subcontractCode}</span>
                  <span className="update-found-name">{updateFound.name}</span>
                  {updateFound.skillType && <span className="sub-skill-tag" style={{ marginLeft: 6 }}>{updateFound.skillType}</span>}
                </div>
                <form onSubmit={handleUpdate}>
                  <SubFormFields form={updateForm} setForm={setUpdateForm} />
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    {loading ? 'Updating...' : 'Update Subcontractor'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE ══ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Subcontractor</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Subcontractor *</label>
              <SearchableDropdown options={subOptions} value={deleteSubId} onChange={handleDeleteSelect} placeholder="-- Select Subcontractor --" />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Code',    deleteFound.subcontractCode],
                  ['Name',    deleteFound.name],
                  ['Phone',   deleteFound.phone       || '—'],
                  ['Email',   deleteFound.email       || '—'],
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
                  {loading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ GET ALL ══ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">All Subcontractors</div>

            {subs.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No subcontractors found.</p></div>
            ) : (
              <>
                <div className="form-field" style={{ marginBottom: 24 }}>
                  <label className="field-label">Select Subcontractor to View Profile</label>
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

                {/* ── Profile Card ── */}
                {profileSub && profileStats && (
                  <div className="sub-profile-card">
                    <div className="sub-cp-header">
                      <div className="sub-cp-avatar">
                        {profileSub.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="sub-cp-name">{profileSub.name}</div>
                        <div className="sub-cp-meta">{profileSub.subcontractCode}&nbsp;·&nbsp;{profileSub.phone || '—'}</div>
                        {profileSub.skillType   && <div className="sub-skill-badge">{profileSub.skillType}</div>}
                        {profileSub.companyName && <div className="sub-cp-company">{profileSub.companyName}</div>}
                        {profileSub.gstNumber   && <div className="sub-cp-gst">GST: {profileSub.gstNumber}</div>}
                        {profileSub.email       && <div className="sub-cp-gst">{profileSub.email}</div>}
                        <div className="sub-cp-address">{profileSub.address || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <button
                          className="submit-btn invoice-print-btn"
                          style={{ whiteSpace: 'nowrap' }}
                          onClick={() => handlePrintSubcontractor(profileSub, profileStats)}
                        >
                          🖨️ Print Profile
                        </button>
                        <button className="sub-project-btn" onClick={() => navigate('/work-subcontract')}>
                          View Projects →
                        </button>
                      </div>
                    </div>

                    <div className="sub-stats-row">
                      {/* FIX: use correct field names from backend model */}
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
                                // FIX: use correct backend field names
                                const paid  = w.cumulativePaidAmount || 0;
                                const bal   = w.balanceAmount ?? 0;
                                const total = w.grandTotal || w.totalAmount || 0;
                                return (
                                  <tr key={w._id}>
                                    <td style={{ fontWeight: 700 }}>{w.projectName}</td>
                                    <td>{w.description || '—'}</td>
                                    <td>{w.startDate ? w.startDate.split('T')[0] : '—'}</td>
                                    <td>{w.endDate   ? w.endDate.split('T')[0]   : '—'}</td>
                                    <td>{workStatusBadge(w.status)}</td>
                                    <td className="amt-cell">₹{Number(total).toLocaleString('en-IN')}</td>
                                    <td className="paid-cell">₹{Number(paid).toLocaleString('en-IN')}</td>
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

                {/* ── Main Table ── */}
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
                        if (inlineEditId === s._id) {
                          return (
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
                          );
                        }
                        return (
                          <tr key={s._id} style={{ cursor: 'pointer' }}
                            onClick={() => { setSelectedSub(s._id); setProfileSub(s); setInlineEditId(null); }}>
                            <td><span className="sub-code-tag">{s.subcontractCode}</span></td>
                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                            <td>{s.phone || '—'}</td>
                            <td>{s.skillType ? <span className="sub-skill-tag">{s.skillType}</span> : '—'}</td>
                            <td>{s.companyName || '—'}</td>
                            <td><span className="invoices-count-badge">{stats.count}</span></td>
                            <td className={stats.outstanding > 0 ? 'outstanding-due' : 'outstanding-zero'}>₹{stats.outstanding.toLocaleString('en-IN')}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="table-edit-btn" onClick={e => { e.stopPropagation(); startInlineEdit(s); }}>Edit</button>
                                <button
                                  className="inv-print-btn"
                                  title="Print Profile"
                                  onClick={e => { e.stopPropagation(); handlePrintSubcontractor(s, getSubStats(s._id)); }}
                                >
                                  🖨️
                                </button>
                              </div>
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

export default SubcontractorPage;