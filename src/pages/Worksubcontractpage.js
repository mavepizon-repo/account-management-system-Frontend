import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import logo from '../logo image/logo.jpeg';
import '../styles/EntityPage.css';
import '../styles/Worksubcontractpage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

const WORK_STATUSES    = ['Pending', 'In Progress', 'Completed', 'On Hold'];
const PAYMENT_STATUSES = ['Unpaid', 'Partial', 'Paid'];

const emptyForm = {
  subcontract:  '',
  projectName:  '',
  description:  '',
  startDate:    '',
  endDate:      '',
  status:       'Pending',
  totalAmount:  '',
};

// ── Date Format Helper (dd/mm/yy) ─────────────────────────
const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

// ── Form Fields ───────────────────────────────────────────
const WorkFormFields = ({ form, setForm, subs, isUpdate = false }) => (
  <div className="form-row work-form-grid">

    <div className="form-field full-width">
      <label className="field-label">
        Subcontractor *
        {isUpdate && <span className="field-note"> (cannot change subcontractor during update)</span>}
      </label>
      {isUpdate ? (
        <div className="work-readonly-field">
          {subs.find(s => s._id === form.subcontract)
            ? (() => {
                const s = subs.find(x => x._id === form.subcontract);
                return `${s.subcontractCode} — ${s.name}${s.skillType ? ` (${s.skillType})` : ''}`;
              })()
            : form.subcontract || '—'
          }
        </div>
      ) : (
        <SearchableDropdown
          options={subs.map(s => ({
            value: s._id,
            label: `${s.subcontractCode} — ${s.name}${s.skillType ? ` (${s.skillType})` : ''}`,
          }))}
          value={form.subcontract}
          onChange={val => setForm({ ...form, subcontract: val })}
          placeholder="-- Select Subcontractor --"
        />
      )}
    </div>

    <div className="form-field full-width">
      <label className="field-label">Project Name *</label>
      <input className="field-input" placeholder="Project name" value={form.projectName}
        onChange={e => setForm({ ...form, projectName: e.target.value })} />
    </div>

    <div className="form-field full-width">
      <label className="field-label">Description</label>
      <textarea className="field-input" placeholder="Project description / scope of work"
        value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
        <select
          className="dropdown-select"
          value={form.status}
          onChange={e => setForm({ ...form, status: e.target.value })}
        >
          {WORK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="dropdown-arrow">▾</span>
      </div>
    </div>

    {!isUpdate && (
      <div className="form-field">
        <label className="field-label">Total Amount (₹) *</label>
        <input className="field-input" type="number" placeholder="0.00" min="0"
          value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} />
      </div>
    )}

  </div>
);

// ── Main Page ─────────────────────────────────────────────
function WorkSubcontractPage({ onLogout }) {
  const navigate = useNavigate();

  const [works, setWorks]       = useState([]);
  const [subs, setSubs]         = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const [subAdvanceMap, setSubAdvanceMap] = useState({});

  const [statusFilter, setStatusFilter] = useState('All');
  const [payFilter, setPayFilter]       = useState('All');
  const [subFilter, setSubFilter]       = useState('');

  const [addForm, setAddForm]               = useState(emptyForm);
  const [updateWorkId, setUpdateWorkId]     = useState('');
  const [updateFound, setUpdateFound]       = useState(null);
  const [updateForm, setUpdateForm]         = useState(emptyForm);
  const [deleteWorkId, setDeleteWorkId]     = useState('');
  const [deleteFound, setDeleteFound]       = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchSubs = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      setSubs(data.data || []);
    } catch {}
  }, []);

  const fetchWorks = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      setWorks(data.data || []);
    } catch { showToast('Failed to fetch projects', 'error'); }
    finally  { setLoading(false); }
  }, [showToast]);

  const fetchSubAdvances = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/vouchers/getall`);
      const data = await res.json();
      const vouchers = data.data || (Array.isArray(data) ? data : []);

      const map = {};
      vouchers.forEach(v => {
        if (v.receiverType !== 'Subcontract') return;
        const rem = Number(v.remainingAmount ?? 0);
        if (rem <= 0) return;

        const hasWork = v.appliedWorkSubcontracts && v.appliedWorkSubcontracts.length > 0;
        if (hasWork) return;

        const subId =
          (v.subcontract && typeof v.subcontract === 'object' ? v.subcontract._id : null) ||
          (typeof v.receiver === 'object' && v.receiver ? v.receiver._id : null) ||
          (typeof v.receiver === 'string' ? v.receiver : null);

        if (!subId) return;

        if (!map[subId]) map[subId] = [];
        map[subId].push({
          _id:             v._id,
          voucherNumber:   v.voucherNumber || '—',
          date:            v.date || v.createdAt,
          remainingAmount: rem,
          totalAmount:     v.amountInVoucher || v.amount || rem,
        });
      });

      Object.keys(map).forEach(sid => {
        map[sid].sort((a, b) => new Date(a.date) - new Date(b.date));
      });

      setSubAdvanceMap(map);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSubs();
    fetchWorks();
    fetchSubAdvances();
  }, [fetchSubs, fetchWorks, fetchSubAdvances]);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateWorkId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteWorkId(''); setDeleteFound(null);
    setSelectedWorkId(''); setStatusFilter('All'); setPayFilter('All'); setSubFilter('');
    fetchSubAdvances();
  };

  const getSubLabel = useCallback((work) => {
    const s = work.subcontract;
    if (!s) return '—';
    if (typeof s === 'object' && s.name) return `${s.subcontractCode} — ${s.name}`;
    const found = subs.find(sub => sub._id === s);
    return found ? `${found.subcontractCode} — ${found.name}` : '—';
  }, [subs]);

  const getSubId = useCallback((work) => {
    const s = work.subcontract;
    if (!s) return null;
    if (typeof s === 'object') return s._id;
    return s;
  }, []);

  const getAdvanceApplied = useCallback((work) => {
    const grandTotal = Number(work.grandTotal || work.totalAmount || 0);
    const paid       = Number(work.cumulativePaidAmount || 0);
    return Math.min(paid, grandTotal);
  }, []);

  const getSubPendingAdvance = useCallback((work) => {
    const subId = getSubId(work);
    if (!subId) return 0;
    const vouchers = subAdvanceMap[subId] || [];
    return vouchers.reduce((s, v) => s + v.remainingAmount, 0);
  }, [getSubId, subAdvanceMap]);

  const workOptions = works.map(w => ({
    value: w._id,
    label: `[${w._id.slice(-6).toUpperCase()}] ${w.projectName} — ${getSubLabel(w)} — ${w.status} — ${w.paymentStatus} — ₹${Number(w.grandTotal || w.totalAmount || 0).toLocaleString('en-IN')}`,
  }));

  // ── PRINT Single Project ──────────────────────────────
  const handlePrintWork = (work) => {
    const fmt        = v => Number(v || 0).toLocaleString('en-IN');
    const subLabel   = getSubLabel(work);
    const paid       = work.cumulativePaidAmount || 0;
    const bal        = work.balanceAmount ?? 0;
    const grandTotal = work.grandTotal || work.totalAmount || 0;
    const advApplied = getAdvanceApplied(work);

    const payStatusColor =
      work.paymentStatus === 'Paid'    ? '#036b4e' :
      work.paymentStatus === 'Partial' ? '#7a5000' : '#c93360';
    const workStatusColor =
      work.status === 'Completed'   ? '#036b4e' :
      work.status === 'In Progress' ? '#1d4ed8' :
      work.status === 'On Hold'     ? '#7a5000' : '#c93360';

    const pw = window.open('', '_blank', 'width=1050,height=780');
    pw.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Project — ${work.projectName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800;900&family=Open+Sans:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Open Sans',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;}
  .hdr{background:#1c1c1c;display:flex;justify-content:space-between;align-items:center;padding:18px 32px;gap:24px;}
  .logo-icon{width:80px;height:50px;margin-right:10px;flex-shrink:0;object-fit:contain;}
  .hdr-div{width:1px;height:50px;background:rgba(255,255,255,0.22);margin:0 24px;flex-shrink:0;}
  .hdr-addr{font-size:10.5px;line-height:1.85;color:#ffffff;}
  .hdr-doc-title{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:900;letter-spacing:5px;color:#ffffff;text-align:right;white-space:nowrap;flex-shrink:0;}
  .body{padding:26px 32px 0;}
  .project-title{font-size:20px;font-weight:800;color:#1a1a1a;margin-bottom:8px;font-family:'Montserrat',sans-serif;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px;margin-bottom:6px;}
  .meta-row{display:flex;gap:8px;align-items:flex-start;}
  .meta-key{font-size:11px;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:0.4px;min-width:100px;flex-shrink:0;padding-top:2px;}
  .meta-val{font-size:13px;font-weight:600;color:#1a1a1a;}
  .section-title{font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin:22px 0 14px;padding-bottom:8px;border-bottom:1.5px solid #f0f0f0;}
  .desc-block{background:#f8f8f8;border-left:3px solid #1c1c1c;padding:12px 16px;font-size:13px;color:#444;line-height:1.65;border-radius:0 6px 6px 0;margin-bottom:20px;}
  .totals-wrap{display:flex;justify-content:flex-end;margin-top:24px;}
  .tot-tbl{width:300px;border:1px solid #ddd;border-radius:6px;overflow:hidden;border-collapse:collapse;}
  .tot-tbl td{padding:9px 14px;font-size:12.5px;border-bottom:1px solid #eee;}
  .tot-tbl tr:last-child td{border-bottom:none;}
  .tot-lbl{color:#555;font-weight:600;}
  .tot-val{text-align:right;font-weight:700;}
  .row-grand td{background:#1c1c1c;color:#fff;font-weight:800;font-size:13px;}
  .row-paid .tot-val{color:#036b4e;}
  .row-bal  .tot-val{color:#c93360;}
  .row-zero .tot-val{color:#036b4e;}
  .row-adv td{background:#f3e8ff;}
  .row-adv .tot-lbl{color:#7c3aed;}
  .row-adv .tot-val{color:#7c3aed;}
  .status-chip{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;}
  .footer{margin-top:40px;padding:14px 32px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#999;}
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
    <div class="hdr-doc-title">PROJECT<br/>WORK ORDER</div>
  </div>
  <div class="body">
    <div style="margin-bottom:22px;">
      <div class="project-title">${work.projectName || ''}</div>
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-key">Subcontractor</span><span class="meta-val">${subLabel}</span></div>
        <div class="meta-row"><span class="meta-key">Print Date</span><span class="meta-val">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span></div>
        <div class="meta-row"><span class="meta-key">Start Date</span><span class="meta-val">${fmtDate(work.startDate)}</span></div>
        <div class="meta-row"><span class="meta-key">End Date</span><span class="meta-val">${fmtDate(work.endDate)}</span></div>
        <div class="meta-row">
          <span class="meta-key">Work Status</span>
          <span class="meta-val status-chip" style="color:${workStatusColor};border:1px solid ${workStatusColor};padding:3px 10px;">${work.status || 'Pending'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-key">Payment</span>
          <span class="meta-val status-chip" style="color:${payStatusColor};border:1px solid ${payStatusColor};padding:3px 10px;">${work.paymentStatus || 'Unpaid'}</span>
        </div>
      </div>
    </div>
    ${work.description ? `<div class="section-title">Scope of Work / Description</div><div class="desc-block">${work.description.replace(/\n/g, '<br/>')}</div>` : ''}
    <div class="section-title">Payment Summary</div>
    <div class="totals-wrap">
      <table class="tot-tbl">
        <tr class="row-grand"><td class="tot-lbl">Total Contract Amount</td><td class="tot-val">&#8377;${fmt(grandTotal)}</td></tr>
        ${advApplied > 0 ? `<tr class="row-adv"><td class="tot-lbl">Advance Applied</td><td class="tot-val">&#8377;${fmt(advApplied)}</td></tr>` : ''}
        <tr class="row-paid"><td class="tot-lbl">Total Paid</td><td class="tot-val">&#8377;${fmt(paid)}</td></tr>
        ${bal > 0
          ? `<tr class="row-bal"><td class="tot-lbl">Balance Due</td><td class="tot-val">&#8377;${fmt(bal)}</td></tr>`
          : `<tr class="row-zero"><td class="tot-lbl">Balance Due</td><td class="tot-val">&#8377;0 ✓</td></tr>`}
      </table>
    </div>
  </div>
  <div class="footer">
    <span>designart &nbsp;|&nbsp; 5-6, Indira Nagar, Coimbatore 641012</span>
    <span>Work Order — Confidential</span>
  </div>
</div>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`);
    pw.document.close();
  };

  // ── PRINT All Projects ────────────────────────────────
  const handlePrintAllWorks = (worksToprint) => {
    const fmt           = v => Number(v || 0).toLocaleString('en-IN');
    const totalContract = worksToprint.reduce((s, w) => s + (w.grandTotal || w.totalAmount || 0), 0);
    const totalPaid     = worksToprint.reduce((s, w) => s + (w.cumulativePaidAmount || 0), 0);
    const totalBal      = worksToprint.reduce((s, w) => s + (w.balanceAmount ?? 0), 0);
    const totalAdv      = worksToprint.reduce((s, w) => s + getAdvanceApplied(w), 0);

    const rows = worksToprint.map((w, i) => {
      const paid     = w.cumulativePaidAmount || 0;
      const bal      = w.balanceAmount ?? 0;
      const total    = w.grandTotal || w.totalAmount || 0;
      const adv      = getAdvanceApplied(w);
      const payColor  = w.paymentStatus === 'Paid' ? '#036b4e' : w.paymentStatus === 'Partial' ? '#7a5000' : '#c93360';
      const workColor = w.status === 'Completed' ? '#036b4e' : w.status === 'In Progress' ? '#1d4ed8' : w.status === 'On Hold' ? '#7a5000' : '#c93360';
      return `<tr>
        <td class="tc">${i + 1}</td>
        <td style="font-weight:700">${w.projectName || ''}</td>
        <td>${getSubLabel(w)}</td>
        <td class="tc">${fmtDate(w.startDate)}</td>
        <td class="tc">${fmtDate(w.endDate)}</td>
        <td class="tc"><span style="color:${workColor};font-weight:700;">${w.status || 'Pending'}</span></td>
        <td class="tr">₹${fmt(total)}</td>
        <td class="tr" style="color:#7c3aed;font-weight:700;">${adv > 0 ? `₹${fmt(adv)}` : '—'}</td>
        <td class="tr" style="color:#036b4e;font-weight:700;">₹${fmt(paid)}</td>
        <td class="tr" style="color:${bal > 0 ? '#c93360' : '#036b4e'};font-weight:700;">₹${fmt(bal)}</td>
        <td class="tc"><span style="color:${payColor};font-weight:700;">${w.paymentStatus || 'Unpaid'}</span></td>
      </tr>`;
    }).join('');

    const pw = window.open('', '_blank', 'width=1200,height=860');
    pw.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>All Projects Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800;900&family=Open+Sans:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Open Sans',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;}
  .page{width:297mm;min-height:210mm;margin:0 auto;background:#fff;}
  .hdr{background:#1c1c1c;display:flex;justify-content:space-between;align-items:center;padding:18px 32px;gap:24px;}
  .logo-icon{width:80px;height:50px;margin-right:10px;flex-shrink:0;object-fit:contain;}
  .hdr-div{width:1px;height:50px;background:rgba(255,255,255,0.22);margin:0 24px;flex-shrink:0;}
  .hdr-addr{font-size:10.5px;line-height:1.85;color:#ffffff;}
  .hdr-doc-title{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:900;letter-spacing:5px;color:#ffffff;text-align:right;white-space:nowrap;flex-shrink:0;}
  .body{padding:26px 32px 0;}
  .summary-row{display:flex;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
  .sum-card{flex:1;min-width:130px;border-radius:8px;padding:14px 18px;display:flex;flex-direction:column;gap:5px;border:1.5px solid transparent;}
  .sum-card span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.75;}
  .sum-card strong{font-size:19px;font-weight:800;font-family:'Montserrat',sans-serif;}
  .s-total   {background:#fef9c3;color:#92400e;border-color:#fcd34d;}
  .s-contract{background:#fffbe8;color:#7a5000;border-color:#ffe08a;}
  .s-adv     {background:#f3e8ff;color:#7c3aed;border-color:#ddd6fe;}
  .s-paid    {background:#e6fdf6;color:#036b4e;border-color:#a0f0d8;}
  .s-due     {background:#fff4f7;color:#c93360;border-color:#ffc8d4;}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#1c1c1c;color:#fff;}
  thead th{padding:9px 10px;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.3px;text-align:left;}
  tbody tr{border-bottom:1px solid #e8e8e8;}
  tbody tr:nth-child(even){background:#fafafa;}
  tbody td{padding:9px 10px;font-size:12px;}
  tfoot td{background:#1c1c1c;color:#fff;padding:10px 10px;font-weight:800;font-size:12px;}
  .footer{margin-top:40px;padding:14px 32px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#999;}
  .tc{text-align:center;} .tr{text-align:right;}
  @media print{body{padding:0;}.page{width:100%;margin:0;}@page{margin:8mm;size:A4 landscape;}}
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
    <div class="hdr-doc-title">PROJECTS<br/>REPORT</div>
  </div>
  <div class="body">
    <div class="summary-row">
      <div class="sum-card s-total">   <span>Total Projects</span><strong>${worksToprint.length}</strong></div>
      <div class="sum-card s-contract"><span>Total Contract</span><strong>₹${fmt(totalContract)}</strong></div>
      <div class="sum-card s-adv">     <span>Total Advance Applied</span><strong>₹${fmt(totalAdv)}</strong></div>
      <div class="sum-card s-paid">    <span>Total Paid</span>    <strong>₹${fmt(totalPaid)}</strong></div>
      <div class="sum-card s-due">     <span>Outstanding</span>   <strong>₹${fmt(totalBal)}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="tc" style="width:36px">S.No</th>
          <th>Project Name</th>
          <th>Subcontractor</th>
          <th class="tc" style="width:80px">Start</th>
          <th class="tc" style="width:80px">End</th>
          <th class="tc" style="width:80px">Work Status</th>
          <th class="tr" style="width:90px">Total (₹)</th>
          <th class="tr" style="width:90px">Advance (₹)</th>
          <th class="tr" style="width:90px">Paid (₹)</th>
          <th class="tr" style="width:90px">Balance (₹)</th>
          <th class="tc" style="width:80px">Payment</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="11" style="text-align:center;padding:20px;color:#aaa">No projects</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td colspan="6" style="text-align:right;">TOTAL</td>
          <td class="tr">₹${fmt(totalContract)}</td>
          <td class="tr" style="color:#c8b4fa;">₹${fmt(totalAdv)}</td>
          <td class="tr" style="color:#5de8c8;">₹${fmt(totalPaid)}</td>
          <td class="tr" style="color:#ff8fab;">₹${fmt(totalBal)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="footer">
    <span>designart &nbsp;|&nbsp; 5-6, Indira Nagar, Coimbatore 641012</span>
    <span>Projects Report — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })} — Confidential</span>
  </div>
</div>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`);
    pw.document.close();
  };

  // ── ADD ───────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.subcontract)                 { showToast('Please select a subcontractor', 'error'); return; }
    if (!addForm.projectName.trim())          { showToast('Project Name is required', 'error');       return; }
    if (!addForm.totalAmount)                 { showToast('Total Amount is required', 'error');        return; }
    if (parseFloat(addForm.totalAmount) <= 0) { showToast('Total Amount must be greater than 0', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/workSubcontract/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontract: addForm.subcontract,
          projectName: addForm.projectName.trim(),
          description: addForm.description.trim(),
          startDate:   addForm.startDate || undefined,
          endDate:     addForm.endDate   || undefined,
          status:      addForm.status,
          totalAmount: parseFloat(addForm.totalAmount),
          gstPercent:  0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const saved = data.data;
        const paid  = saved?.cumulativePaidAmount || 0;
        await fetchWorks();
        await fetchSubAdvances();
        setAddForm(emptyForm);
        if (paid > 0) {
          showToast(`✅ Project "${saved.projectName}" added! ₹${paid.toLocaleString('en-IN')} advance auto-applied.`);
        } else {
          showToast(`Project "${data.data?.projectName || addForm.projectName}" added!`);
        }
      } else { showToast(data.message || data.error || 'Failed to add project', 'error'); }
    } catch { showToast('Network error while adding project', 'error'); }
    finally  { setLoading(false); }
  };

  // ── UPDATE select ─────────────────────────────────────
  const handleUpdateSelect = (workId) => {
    setUpdateWorkId(workId);
    const found = works.find(w => w._id === workId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        subcontract: typeof found.subcontract === 'object' ? found.subcontract._id : (found.subcontract || ''),
        projectName: found.projectName  || '',
        description: found.description  || '',
        startDate:   found.startDate ? found.startDate.split('T')[0] : '',
        endDate:     found.endDate   ? found.endDate.split('T')[0]   : '',
        status:      found.status        || 'Pending',
        totalAmount: found.grandTotal    ?? found.totalAmount ?? '',
      });
    } else { setUpdateFound(null); setUpdateForm(emptyForm); }
  };

  // ── UPDATE submit ─────────────────────────────────────
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound)                   { showToast('Please select a project', 'error');  return; }
    if (!updateForm.projectName.trim()) { showToast('Project Name is required', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/workSubcontract/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: updateForm.projectName.trim(),
          description: updateForm.description.trim(),
          startDate:   updateForm.startDate || undefined,
          endDate:     updateForm.endDate   || undefined,
          status:      updateForm.status,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchWorks();
        showToast(`Project "${data.data?.projectName || updateForm.projectName}" updated!`);
        setUpdateFound(null); setUpdateWorkId(''); setUpdateForm(emptyForm);
      } else { showToast(data.message || data.error || 'Failed to update project', 'error'); }
    } catch { showToast('Network error while updating project', 'error'); }
    finally  { setLoading(false); }
  };

  // ── DELETE ────────────────────────────────────────────
  const handleDeleteSelect = (workId) => {
    setDeleteWorkId(workId);
    setDeleteFound(works.find(w => w._id === workId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a project', 'error'); return; }
    if ((deleteFound.cumulativePaidAmount || 0) > 0) {
      showToast('Cannot delete a project that has existing payments. Delete the linked vouchers first.', 'error');
      return;
    }
    try {
      setLoading(true);
      const res  = await fetch(`${API}/workSubcontract/delete/${deleteFound._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        await fetchWorks();
        await fetchSubAdvances();
        if (selectedWorkId === deleteFound._id) setSelectedWorkId('');
        showToast(`Project "${deleteFound.projectName}" deleted!`, 'info');
        setDeleteFound(null); setDeleteWorkId('');
      } else { showToast(data.message || data.error || 'Failed to delete project', 'error'); }
    } catch { showToast('Network error while deleting project', 'error'); }
    finally  { setLoading(false); }
  };

  // ── Filters ───────────────────────────────────────────
  const filteredWorks = works.filter(w => {
    const subId     = typeof w.subcontract === 'object' ? w.subcontract?._id : w.subcontract;
    const matchSub  = subFilter          ? subId === subFilter             : true;
    const matchPay  = payFilter !== 'All'    ? w.paymentStatus === payFilter  : true;
    const matchStat = statusFilter !== 'All' ? w.status === statusFilter      : true;
    return matchSub && matchPay && matchStat;
  });

  const selectedWorkObj = works.find(w => w._id === selectedWorkId);
  const totalContract   = filteredWorks.reduce((s, w) => s + (w.grandTotal || w.totalAmount || 0), 0);
  const totalPaid       = filteredWorks.reduce((s, w) => s + (w.cumulativePaidAmount || 0), 0);
  const totalBal        = filteredWorks.reduce((s, w) => s + (w.balanceAmount ?? 0), 0);
  const totalAdvApplied = filteredWorks.reduce((s, w) => s + getAdvanceApplied(w), 0);

  // ── Badges ────────────────────────────────────────────
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
          <button className="back-btn" onClick={() => navigate('/subcontractor')}>←</button>
          <h1 className="entity-page-title">Project Details</h1>
          <span className="entity-page-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
            {works.length} Projects
          </span>
        </div>

        <div className="action-cards-grid">
          <div
            className={`action-card action-card-add ${activePanel === PANELS.ADD ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.ADD)}
          >
            <div className="action-card-icon">➕</div>
            <div className="action-card-title">Add Project</div>
            <div className="action-card-desc">Add a new project work</div>
          </div>

          <div
            className={`action-card action-card-update ${activePanel === PANELS.UPDATE ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.UPDATE)}
          >
            <div className="action-card-icon">✏️</div>
            <div className="action-card-title">Update Project</div>
            <div className="action-card-desc">Edit existing project info</div>
          </div>

          <div
            className={`action-card action-card-getall ${activePanel === PANELS.GETALL ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.GETALL)}
          >
            <div className="action-card-icon">📋</div>
            <div className="action-card-title">All Projects</div>
            <div className="action-card-desc">View all project records</div>
          </div>

          <div
            className={`action-card action-card-delete ${activePanel === PANELS.DELETE ? 'action-card-active' : ''}`}
            onClick={() => togglePanel(PANELS.DELETE)}
          >
            <div className="action-card-icon">🗑️</div>
            <div className="action-card-title">Delete Project</div>
            <div className="action-card-desc">Remove a project record</div>
          </div>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner sub-loading" /></div>}

        {/* ══ ADD ══ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">Add New Project</div>

            <div className="autofill-banner full-width" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 16 }}>
              <span className="autofill-icon">💡</span>
              <span style={{ color: '#1e40af', fontSize: 13 }}>
                If this subcontractor has any <strong>advance vouchers</strong> with remaining balance,
                the system will automatically deduct them from this project upon creation.
              </span>
            </div>

            <div className="work-info-note">
              ℹ️ Payments are recorded via <strong>Vouchers</strong>. Enter only the contract total here.
            </div>

            <form onSubmit={handleAdd}>
              <WorkFormFields form={addForm} setForm={setAddForm} subs={subs} isUpdate={false} />

              {addForm.subcontract && (() => {
                const advVouchers = subAdvanceMap[addForm.subcontract] || [];
                const advTotal    = advVouchers.reduce((s, v) => s + v.remainingAmount, 0);
                if (advTotal > 0) {
                  return (
                    <div style={{
                      marginBottom: 16,
                      borderRadius: 12,
                      border: '1.5px solid #c4b5fd',
                      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '10px 16px',
                        background: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>💰</span>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                            Subcontractor Advance Available — Will Auto-Apply on Creation
                          </span>
                        </div>
                        <span style={{
                          background: 'rgba(255,255,255,0.2)', color: '#fff',
                          borderRadius: 20, padding: '2px 12px', fontSize: 13, fontWeight: 700,
                        }}>
                          ₹{Number(advTotal).toLocaleString('en-IN')} Total
                        </span>
                      </div>
                      <div style={{ padding: '10px 16px', fontSize: 13, color: '#555' }}>
                        {advVouchers.map((v, i) => (
                          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: i < advVouchers.length - 1 ? 4 : 0 }}>
                            <span style={{
                              background: '#f3e8ff', color: '#7c3aed', borderRadius: 6,
                              padding: '2px 8px', fontWeight: 700, fontSize: 12,
                              border: '1px solid #ddd6fe',
                            }}>{v.voucherNumber}</span>
                            <span style={{ color: '#888', fontSize: 12 }}>
                              {fmtDate(v.date)}
                            </span>
                            <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                              ₹{Number(v.remainingAmount).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{
                    marginBottom: 16, padding: '10px 14px',
                    background: '#f8faff', borderRadius: 8,
                    border: '1px solid #dde5f8', fontSize: 13, color: '#888',
                  }}>
                    ℹ️ This subcontractor has no pending advance vouchers.
                  </div>
                );
              })()}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Adding...' : 'Add Project'}
              </button>
            </form>
          </div>
        )}

        {/* ══ UPDATE ══ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">Update Project</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Project *</label>
              <SearchableDropdown options={workOptions} value={updateWorkId} onChange={handleUpdateSelect} placeholder="-- Select Project --" />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.status}</span>
                  <span className="update-found-name">{updateFound.projectName}</span>
                  {statusBadge(updateFound.paymentStatus)}
                  {getAdvanceApplied(updateFound) > 0 && (
                    <span style={{
                      fontSize: 12, background: '#f3e8ff', color: '#7c3aed',
                      padding: '2px 8px', borderRadius: 6, marginLeft: 8,
                      fontWeight: 700, border: '1px solid #ddd6fe',
                    }}>
                      💰 Adv − ₹{getAdvanceApplied(updateFound).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div className="work-info-note">
                  ℹ️ Subcontractor and total amount cannot be changed during update. Payments tracked via Vouchers.
                </div>
                <form onSubmit={handleUpdate}>
                  <WorkFormFields form={updateForm} setForm={setUpdateForm} subs={subs} isUpdate={true} />
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    {loading ? 'Updating...' : 'Update Project'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ══ DELETE ══ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">Delete Project</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Project *</label>
              <SearchableDropdown options={workOptions} value={deleteWorkId} onChange={handleDeleteSelect} placeholder="-- Select Project --" />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Subcontractor',   getSubLabel(deleteFound)],
                  ['Project Name',    deleteFound.projectName],
                  ['Description',     deleteFound.description || '—'],
                  ['Start Date',      fmtDate(deleteFound.startDate)],
                  ['End Date',        fmtDate(deleteFound.endDate)],
                  ['Work Status',     deleteFound.status],
                  ['Total Amount',    `₹${(deleteFound.grandTotal || deleteFound.totalAmount || 0).toLocaleString('en-IN')}`],
                  ['Advance Applied', `₹${getAdvanceApplied(deleteFound).toLocaleString('en-IN')}`],
                  ['Paid Amount',     `₹${(deleteFound.cumulativePaidAmount || 0).toLocaleString('en-IN')}`],
                  ['Balance',         `₹${(deleteFound.balanceAmount ?? 0).toLocaleString('en-IN')}`],
                  ['Payment Status',  deleteFound.paymentStatus],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}
                    style={k === 'Advance Applied' && getAdvanceApplied(deleteFound) > 0
                      ? { background: '#f3e8ff', borderColor: '#ddd6fe' } : {}}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val"
                      style={k === 'Advance Applied' ? { color: '#7c3aed', fontWeight: 800 } : {}}>
                      {v}
                    </span>
                  </div>
                ))}
                {(deleteFound.cumulativePaidAmount || 0) > 0 && (
                  <div className="work-info-note" style={{ marginTop: 12, background: '#fff4f7', borderColor: '#ffc8d4', color: '#c93360' }}>
                    ⚠️ This project has existing payments (₹{(deleteFound.cumulativePaidAmount || 0).toLocaleString('en-IN')} paid).
                    Backend will reject this delete. Remove linked vouchers first.
                  </div>
                )}
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
            <div className="getall-header-row">
              <div className="panel-title" style={{ margin: 0 }}>All Projects</div>
              <button className="excel-export-btn" onClick={() => handlePrintAllWorks(filteredWorks)} title="Print all filtered projects">
                <span>🖨️</span> Print Report
              </button>
            </div>

            <div className="work-summary-chips">
              <div className="work-chip-card work-chip-total">   <span>Total Projects</span><strong>{filteredWorks.length}</strong></div>
              <div className="work-chip-card work-chip-contract"><span>Total Contract</span> <strong>₹{totalContract.toLocaleString('en-IN')}</strong></div>
              <div className="work-chip-card" style={{ background: '#f3e8ff', border: '1.5px solid #ddd6fe' }}>
                <span style={{ color: '#7c3aed' }}>Advance Applied</span>
                <strong style={{ color: '#7c3aed' }}>₹{totalAdvApplied.toLocaleString('en-IN')}</strong>
              </div>
              <div className="work-chip-card work-chip-paid">    <span>Total Paid</span>     <strong>₹{totalPaid.toLocaleString('en-IN')}</strong></div>
              <div className="work-chip-card work-chip-due">     <span>Outstanding</span>    <strong>₹{totalBal.toLocaleString('en-IN')}</strong></div>
            </div>

            <div className="work-filters-row">
              <div className="form-field" style={{ minWidth: 260 }}>
                <label className="field-label">Filter by Subcontractor</label>
                <SearchableDropdown
                  options={subs.map(s => ({ value: s._id, label: `${s.subcontractCode} — ${s.name}` }))}
                  value={subFilter}
                  onChange={(val) => { setSubFilter(val); setSelectedWorkId(''); }}
                  placeholder="All Subcontractors"
                />
              </div>
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
              <div className="work-filter-tabs">
                {['All', ...PAYMENT_STATUSES].map(p => (
                  <button key={p}
                    className={`pay-filter-tab pay-tab-${p.toLowerCase()} ${payFilter === p ? 'active' : ''}`}
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
                {selectedWorkObj && (
                  <div className="work-detail-card">
                    <div className="work-detail-header">
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)' }}>{selectedWorkObj.projectName}</span>
                        <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {workStatusBadge(selectedWorkObj.status)}
                          {statusBadge(selectedWorkObj.paymentStatus)}
                          {getAdvanceApplied(selectedWorkObj) > 0 && (
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: '#7c3aed',
                              background: '#f3e8ff', border: '1px solid #ddd6fe',
                              borderRadius: 6, padding: '2px 8px',
                            }}>
                              💰 Adv − ₹{Number(getAdvanceApplied(selectedWorkObj)).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className="submit-btn invoice-print-btn" style={{ padding: '8px 16px', fontSize: 13 }}
                          onClick={() => handlePrintWork(selectedWorkObj)}>
                          🖨️ Print
                        </button>
                        <button className="inv-detail-close" onClick={() => setSelectedWorkId('')}>✕</button>
                      </div>
                    </div>
                    <div className="work-detail-grid">
                      {[
                        ['Subcontractor',   getSubLabel(selectedWorkObj)],
                        ['Description',     selectedWorkObj.description || '—'],
                        ['Start Date',      fmtDate(selectedWorkObj.startDate)],
                        ['End Date',        fmtDate(selectedWorkObj.endDate)],
                        ['Work Status',     selectedWorkObj.status],
                        ['Total Amount',    `₹${Number(selectedWorkObj.grandTotal || selectedWorkObj.totalAmount || 0).toLocaleString('en-IN')}`],
                        ['Advance Applied', `₹${Number(getAdvanceApplied(selectedWorkObj)).toLocaleString('en-IN')}`],
                        ['Paid Amount',     `₹${Number(selectedWorkObj.cumulativePaidAmount || 0).toLocaleString('en-IN')}`],
                        ['Balance',         `₹${Number(selectedWorkObj.balanceAmount ?? 0).toLocaleString('en-IN')}`],
                        ['Payment Status',  selectedWorkObj.paymentStatus],
                      ].map(([k, v]) => (
                        <div className="inv-detail-item" key={k}
                          style={k === 'Advance Applied' && getAdvanceApplied(selectedWorkObj) > 0
                            ? { background: '#f3e8ff', borderColor: '#ddd6fe' } : {}}>
                          <span className="inv-detail-key">{k}</span>
                          <span className="inv-detail-val"
                            style={k === 'Advance Applied' ? { color: '#7c3aed', fontWeight: 800 } : {}}>
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="work-card-list">
                  {filteredWorks.map(w => {
                    const paid       = w.cumulativePaidAmount || 0;
                    const bal        = w.balanceAmount ?? 0;
                    const total      = w.grandTotal || w.totalAmount || 0;
                    const advApplied = getAdvanceApplied(w);
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
                            {fmtDate(w.startDate)}
                            {w.endDate ? ` → ${fmtDate(w.endDate)}` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="work-row-amt">₹{Number(total).toLocaleString('en-IN')}</span>
                            {advApplied > 0 && (
                              <span style={{
                                fontSize: 12, fontWeight: 700, color: '#7c3aed',
                                background: '#f3e8ff', border: '1px solid #ddd6fe',
                                borderRadius: 6, padding: '1px 7px',
                              }}>
                                💰 Adv ₹{Number(advApplied).toLocaleString('en-IN')}
                              </span>
                            )}
                            <span className="work-row-paid">Paid ₹{Number(paid).toLocaleString('en-IN')}</span>
                            {bal > 0 && <span className="work-row-bal">Bal ₹{Number(bal).toLocaleString('en-IN')}</span>}
                          </div>
                        </div>
                        <div className="work-row-right">
                          {workStatusBadge(w.status)}
                          {statusBadge(w.paymentStatus)}
                          <button className="inv-print-btn" title="Print Work Order" style={{ marginTop: 6 }}
                            onClick={e => { e.stopPropagation(); handlePrintWork(w); }}>
                            🖨️
                          </button>
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