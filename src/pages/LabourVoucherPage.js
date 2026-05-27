import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/LabourVoucherPage.css';
import '../styles/SearchableDropdown.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', DELETE: 'delete', GETALL: 'getall' };

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const COMPANY = {
  name: 'DESIGN ART (INTERIOR & EXTERIOR SOLUTION)',
  address: '5-6, Indria Nagar, PM Samy Colony, Ratinapuri, Gandhipuram, Coimbatore 641012',
  phone: '+91 9677731326',
  gst: '33BNCPP2332Q1ZT',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function exportToExcel(voucherList, filterLabel) {
  const wb = XLSX.utils.book_new();
  const rows = [];
  rows.push([COMPANY.name, '', '', '', '', '', '', '', '']);
  rows.push([`Address: ${COMPANY.address}`, '', '', '', `Ph: ${COMPANY.phone}`, '', `GST: ${COMPANY.gst}`, '', '']);
  rows.push(['', '', '', '', '', '', '', '', '']);
  rows.push([`Labour Salary Voucher Report — ${filterLabel}`, '', '', '', '', '', '', '', '']);
  rows.push([`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, '', '', '', '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '', '', '']);
  rows.push(['Labour Name', 'Phone', 'From Date', 'To Date', 'Working Days', 'Working Hours', 'OT Hours', 'Total Salary (₹)', 'Advance Deducted (₹)', 'Payable (₹)', 'PDF URL']);
  voucherList.forEach(v => {
    const labour = typeof v.labour === 'object' ? v.labour : { name: '', phone: '' };
    rows.push([
      labour.name || '', labour.phone || '',
      formatDate(v.fromDate), formatDate(v.toDate),
      v.totalWorkingDays || 0, v.totalWorkingHours || 0, v.overtimeHours || 0,
      v.totalSalary || 0, v.deductedAdvanceAmount || 0, v.payableSalary || 0,
      v.voucherPdf?.url || '',
    ]);
  });
  rows.push(['', '', '', '', '', '', '', '', '', '', '']);
  const totalPayable = voucherList.reduce((s, v) => s + (v.payableSalary || 0), 0);
  rows.push(['TOTAL', '', '', '', '', '', '', '', '', totalPayable, '']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Labour Vouchers');
  XLSX.writeFile(wb, `LabourVouchers_${filterLabel.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function getLabourName(voucher) {
  if (!voucher?.labour) return '';
  if (typeof voucher.labour === 'object') return voucher.labour.name || '';
  return '';
}
function getLabourPhone(voucher) {
  if (!voucher?.labour) return '';
  if (typeof voucher.labour === 'object') return voucher.labour.phone || '';
  return '';
}

// ─── Attendance Date List inside Preview ─────────────────────────────────────
function AttendanceDateList({ attendance }) {
  if (!attendance || attendance.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#64748b', marginBottom: 8
      }}>
        📆 Attendance Records ({attendance.length} days)
      </div>
      <div style={{
        maxHeight: 200, overflowY: 'auto',
        border: '1px solid #bbf7d0', borderRadius: 8,
        background: '#fff'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f0fdf4', position: 'sticky', top: 0 }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: '#166534', fontWeight: 700 }}>Date</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>Start</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>End</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>Hours</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>OT</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a, idx) => (
              <tr key={a._id || idx} style={{ borderTop: '1px solid #dcfce7' }}>
                <td style={{ padding: '5px 10px', fontWeight: 600 }}>
                  {formatDate(a.date)}
                </td>
                <td style={{ padding: '5px 10px', textAlign: 'center' }}>{a.startTime}</td>
                <td style={{ padding: '5px 10px', textAlign: 'center' }}>{a.endTime}</td>
                <td style={{ padding: '5px 10px', textAlign: 'center', color: '#1d4ed8', fontWeight: 600 }}>
                  {a.totalHours} hrs
                </td>
                <td style={{ padding: '5px 10px', textAlign: 'center', color: a.overtimeHours > 0 ? '#d97706' : '#94a3b8' }}>
                  {a.overtimeHours > 0 ? `+${a.overtimeHours}` : '—'}
                </td>
                <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                  {a.salaryPaid
                    ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>✅ Paid</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⏳ Unpaid</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Full Preview Card ────────────────────────────────────────────────────────
function AttendancePreview({ preview, loading, labours, labourId }) {
  const selectedLabour = labours?.find(l => l._id === labourId);

  if (loading) {
    return (
      <div className="lv-preview-card lv-preview-loading">
        <div className="lv-preview-spinner" />
        <span>Calculating attendance &amp; salary…</span>
      </div>
    );
  }

  if (!preview && selectedLabour) {
    return (
      <div className="lv-preview-card" style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}>
        <div className="lv-preview-title">
          <span className="lv-preview-dot" style={{ background: '#3b82f6' }} />
          Selected Labour Info
        </div>
        <div className="lv-preview-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className="lv-preview-item">
            <span className="lv-preview-label">Name</span>
            <strong className="lv-preview-val">{selectedLabour.name}</strong>
          </div>
          <div className="lv-preview-item">
            <span className="lv-preview-label">Work Type</span>
            <strong className="lv-preview-val">{selectedLabour.workType || '—'}</strong>
          </div>
          <div className="lv-preview-item">
            <span className="lv-preview-label">Daily Wage</span>
            <strong className="lv-preview-val" style={{ color: '#166534' }}>
              ₹{Number(selectedLabour.dailyWage || 0).toLocaleString('en-IN')}
            </strong>
          </div>
          <div className="lv-preview-item">
            <span className="lv-preview-label">Per Hour</span>
            <strong className="lv-preview-val">
              ₹{((selectedLabour.dailyWage || 0) / 8).toFixed(2)}
            </strong>
          </div>
        </div>
        <div style={{
          fontSize: 12, color: '#3b82f6', marginTop: 10,
          padding: '6px 10px', background: '#dbeafe',
          border: '1px dashed #93c5fd', borderRadius: 6
        }}>
          📅 Select a date above to calculate attendance &amp; salary
        </div>
      </div>
    );
  }

  if (!preview) return null;

  if (preview.error) {
    return (
      <div className="lv-preview-card lv-preview-empty">
        <span className="lv-preview-empty-icon">📭</span>
        <span>{preview.error}</span>
      </div>
    );
  }

  const hasAdvance = (preview.totalAdvanceGiven ?? 0) > 0;

  return (
    <div className="lv-preview-card" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
      <div className="lv-preview-title">
        <span className="lv-preview-dot" />
        Attendance &amp; Salary Preview
        {preview.labour?.name && (
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#166534',
            background: '#dcfce7', borderRadius: 20,
            padding: '2px 10px', marginLeft: 8
          }}>
            👷 {preview.labour.name}
          </span>
        )}
      </div>

      {/* Work Summary */}
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#64748b', marginBottom: 8
      }}>
        📋 Work Summary
      </div>
      <div className="lv-preview-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Working Days</span>
          <strong className="lv-preview-val" style={{ color: '#1d4ed8' }}>
            {preview.totalWorkingDays ?? 0}
          </strong>
        </div>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Working Hours</span>
          <strong className="lv-preview-val">{preview.totalWorkingHours ?? 0} hrs</strong>
        </div>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Overtime Hours</span>
          <strong className="lv-preview-val lv-ot-val">{preview.overtimeHours ?? 0} hrs</strong>
        </div>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Gross Salary</span>
          <strong className="lv-preview-val lv-salary-val">
            ₹{Number(preview.totalSalary ?? 0).toLocaleString('en-IN')}
          </strong>
        </div>
      </div>

      {/* Advance Details */}
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#64748b', marginTop: 12, marginBottom: 8
      }}>
        💰 Advance Details
      </div>
      <div className="lv-preview-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Total Advance Given</span>
          <strong className="lv-preview-val" style={{ color: hasAdvance ? '#b45309' : '#64748b' }}>
            ₹{Number(preview.totalAdvanceGiven ?? 0).toLocaleString('en-IN')}
          </strong>
        </div>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Auto Deduct Amount</span>
          <strong className="lv-preview-val lv-advance-val">
            ₹{Number(preview.deductedAdvanceAmount ?? 0).toLocaleString('en-IN')}
          </strong>
        </div>
        <div className="lv-preview-item">
          <span className="lv-preview-label">Remaining After</span>
          <strong className="lv-preview-val">
            ₹{Number(preview.remainingAdvanceAmount ?? 0).toLocaleString('en-IN')}
          </strong>
        </div>
      </div>

      {hasAdvance && preview.advanceDetails && (
        <div style={{
          fontSize: 12, color: '#92400e', background: '#fffbeb',
          border: '1px solid #fde68a', borderRadius: 6,
          padding: '6px 10px', marginTop: 8
        }}>
          📌 Deduction type: <strong>{preview.advanceDetails.deductionType}</strong>
          {preview.advanceDetails.deductionType === 'Monthly Installment' && preview.advanceDetails.deductedAmount > 0 &&
            ` — ₹${Number(preview.advanceDetails.deductedAmount).toLocaleString('en-IN')} per installment`}
          {preview.advanceDetails.deductionType === 'Fixed Amount' && preview.advanceDetails.deductedAmount > 0 &&
            ` — ₹${Number(preview.advanceDetails.deductedAmount).toLocaleString('en-IN')} fixed deduction`}
        </div>
      )}
      {!hasAdvance && (
        <div style={{
          fontSize: 12, color: '#166534', background: '#dcfce7',
          border: '1px solid #bbf7d0', borderRadius: 6,
          padding: '6px 10px', marginTop: 8
        }}>
          ✅ No pending advance for this labour
        </div>
      )}

      {/* Estimated Payable */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, padding: '12px 14px',
        background: '#166534', borderRadius: 8
      }}>
        <span style={{ fontSize: 13, color: '#dcfce7', fontWeight: 600 }}>
          💵 Estimated Payable Salary
        </span>
        <strong style={{ fontSize: 20, color: '#fff', fontWeight: 800 }}>
          ₹{Number(preview.payableSalary ?? 0).toLocaleString('en-IN')}
        </strong>
      </div>

      {/* Attendance date list */}
      {preview.attendance?.length > 0 && (
        <AttendanceDateList attendance={preview.attendance} />
      )}

      {preview.attendance?.length === 0 && (
        <div style={{
          fontSize: 12, color: '#b91c1c', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 6,
          padding: '6px 10px', marginTop: 8
        }}>
          ⚠️ No unpaid attendance records found for this date range
        </div>
      )}
    </div>
  );
}

// ─── Advance Deduction Control ─────────────────────────────────────────────────
function AdvanceDeductControl({ totalAdvance, deductMode, deductAmount, onChange }) {
  if (!totalAdvance || totalAdvance <= 0) return null;
  return (
    <div className="lv-advance-deduct-box">
      <div className="lv-advance-deduct-title">
        💰 Override Advance Deduction — Available: <strong>₹{Number(totalAdvance).toLocaleString('en-IN')}</strong>
      </div>
      <div className="lv-advance-deduct-modes">
        <button type="button"
          className={`lv-deduct-mode-btn ${deductMode === 'full' ? 'lv-deduct-active' : ''}`}
          onClick={() => onChange('full', totalAdvance)}>
          ✅ Deduct Full (₹{Number(totalAdvance).toLocaleString('en-IN')})
        </button>
        <button type="button"
          className={`lv-deduct-mode-btn ${deductMode === 'partial' ? 'lv-deduct-active lv-deduct-partial' : ''}`}
          onClick={() => onChange('partial', deductAmount)}>
          ✏️ Deduct Partial
        </button>
        <button type="button"
          className={`lv-deduct-mode-btn ${deductMode === 'none' ? 'lv-deduct-active lv-deduct-none' : ''}`}
          onClick={() => onChange('none', 0)}>
          🚫 Don't Deduct
        </button>
      </div>
      {deductMode === 'partial' && (
        <div className="lv-partial-input-wrap">
          <label className="field-label" style={{ marginBottom: 6 }}>
            Amount to deduct (max ₹{Number(totalAdvance).toLocaleString('en-IN')})
          </label>
          <input
            type="number" className="field-input"
            min={0} max={totalAdvance} value={deductAmount}
            onChange={e => {
              const val = Math.min(parseFloat(e.target.value) || 0, totalAdvance);
              onChange('partial', val);
            }}
            placeholder="Enter partial deduction amount"
          />
          {deductAmount > 0 && (
            <small style={{ color: '#166534', marginTop: 4, display: 'block' }}>
              Remaining advance after this voucher: ₹{Number(totalAdvance - deductAmount).toLocaleString('en-IN')}
            </small>
          )}
        </div>
      )}
    </div>
  );
}

function LabourVoucherPage({ onLogout }) {
  const navigate = useNavigate();

  const [vouchers, setVouchers]       = useState([]);
  const [labours, setLabours]         = useState([]);
  const [activePanel, setPanel]       = useState(null);
  const [toast, setToast]             = useState(null);
  const [loading, setLoading]         = useState(false);
  const [searchText, setSearchText]   = useState('');
  const [monthFilter, setMonthFilter] = useState('All');
  const [selectedId, setSelectedId]   = useState('');

  // ── ADD form state ─────────────────────────────────────────
  const [addForm, setAddForm] = useState({
    labourId: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: '',
    useDateRange: false,
  });
  const [addPreview, setAddPreview]               = useState(null);
  const [addPreviewLoading, setAddPreviewLoading] = useState(false);
  const [addDeductMode, setAddDeductMode]         = useState('full');
  const [addDeductAmount, setAddDeductAmount]     = useState(0);

  // ── DELETE ─────────────────────────────────────────────────
  const [deleteId, setDeleteId]       = useState('');
  const [deleteFound, setDeleteFound] = useState(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch helpers ──────────────────────────────────────────
  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/labourVoucher/getall`);
      const data = await res.json();
      setVouchers(Array.isArray(data) ? data : (data.data || []));
    } catch { showToast('Failed to fetch vouchers', 'error'); }
    finally { setLoading(false); }
  };

  const fetchLabours = async () => {
    try {
      const res  = await fetch(`${API}/labours/getall`);
      const data = await res.json();
      setLabours(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  useEffect(() => { fetchVouchers(); fetchLabours(); }, []);

  // ── Preview fetch: POST /api/labourVoucher/calculate ──
  const fetchPreview = useCallback(async ({ labourId, fromDate, toDate, useDateRange }, setter, loadSetter) => {
    if (!labourId || !fromDate) { setter(null); return; }
    const effectiveTo = useDateRange && toDate ? toDate : fromDate;
    try {
      loadSetter(true);
      setter(null);
      const res = await fetch(`${API}/labourVoucher/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labourId, fromDate, toDate: effectiveTo, deductedAdvanceAmount: 0 }),
      });
      if (res.ok) {
        const data = await res.json();
        setter(data);
      } else if (res.status === 404) {
        setter({ error: 'Labour not found or no records for this date range.' });
      } else {
        const err = await res.json().catch(() => ({}));
        setter({ error: err.message || 'Could not load preview.' });
      }
    } catch {
      setter({ error: 'Could not connect to server for preview.' });
    } finally {
      loadSetter(false);
    }
  }, []);

  // ── Debounced preview trigger ──────────────────────────────
  useEffect(() => {
    if (!addForm.labourId || !addForm.fromDate) { setAddPreview(null); return; }
    const timer = setTimeout(() => fetchPreview(addForm, setAddPreview, setAddPreviewLoading), 400);
    return () => clearTimeout(timer);
  }, [addForm.labourId, addForm.fromDate, addForm.toDate, addForm.useDateRange, fetchPreview]);

  // ── Sync deduction defaults from preview ──────────────────
  useEffect(() => {
    if (!addPreview || addPreview.error) return;
    const autoDeduct = addPreview.deductedAdvanceAmount ?? 0;
    const totalGiven = addPreview.totalAdvanceGiven ?? 0;
    if (totalGiven > 0) {
      if (autoDeduct >= totalGiven) { setAddDeductMode('full'); setAddDeductAmount(totalGiven); }
      else if (autoDeduct > 0)     { setAddDeductMode('partial'); setAddDeductAmount(autoDeduct); }
      else                          { setAddDeductMode('none'); setAddDeductAmount(0); }
    } else { setAddDeductMode('none'); setAddDeductAmount(0); }
  }, [addPreview]);

  // ── Toggle panel ───────────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ labourId: '', fromDate: new Date().toISOString().split('T')[0], toDate: '', useDateRange: false });
    setAddPreview(null); setAddDeductMode('full'); setAddDeductAmount(0);
    setDeleteId(''); setDeleteFound(null); setSelectedId('');
    setSearchText(''); setMonthFilter('All');
  };

  const resolveDeductAmount = (mode, amount, totalAvailable) => {
    if (mode === 'full') return totalAvailable;
    if (mode === 'partial') return amount;
    return 0;
  };

  // ── ADD ────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.labourId) { showToast('Please select a labour', 'error'); return; }
    if (!addForm.fromDate) { showToast('Please select a from date', 'error'); return; }
    if (addForm.useDateRange && addForm.toDate && new Date(addForm.toDate) < new Date(addForm.fromDate)) {
      showToast('To date cannot be before from date', 'error'); return;
    }
    if (addPreview && !addPreview.error && addPreview.attendance?.length === 0) {
      showToast('No unpaid attendance records found for this date range', 'error'); return;
    }
    try {
      setLoading(true);
      const totalAvailable = addPreview?.totalAdvanceGiven ?? 0;
      const deductedAmount = resolveDeductAmount(addDeductMode, addDeductAmount, totalAvailable);
      const payload = {
        labourId:    addForm.labourId,
        fromDate:    addForm.fromDate,
        toDate:      addForm.useDateRange && addForm.toDate ? addForm.toDate : addForm.fromDate,
        deductedAmount,
      };
      const res = await fetch(`${API}/labourVoucher/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchVouchers();
        setAddForm({ labourId: '', fromDate: new Date().toISOString().split('T')[0], toDate: '', useDateRange: false });
        setAddPreview(null); setAddDeductMode('full'); setAddDeductAmount(0);
        const dateRange = addForm.useDateRange && addForm.toDate
          ? `${formatDate(addForm.fromDate)} to ${formatDate(addForm.toDate)}`
          : formatDate(addForm.fromDate);
        showToast(`✅ Voucher generated for ${dateRange}!`);
      } else {
        // Handle duplicate voucher message clearly
        const errMsg = data.message || data.error || 'Failed to generate voucher';
        if (errMsg.toLowerCase().includes('already exists')) {
          showToast(`⚠️ Voucher already exists for this date range. Please choose a different date.`, 'error');
        } else {
          showToast(errMsg, 'error');
        }
      }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ─────────────────────────────────────────────────
  const handleDeleteSelect = (vid) => {
    setDeleteId(vid);
    setDeleteFound(vouchers.find(v => v._id === vid) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a voucher', 'error'); return; }
    if (!window.confirm(`Delete voucher for ${getLabourName(deleteFound)}? This will restore advance amount and mark attendance as unpaid.`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/labourVoucher/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchVouchers();
        showToast(`🗑️ Voucher deleted! Advance amount restored & attendance marked unpaid.`, 'info');
        setDeleteFound(null); setDeleteId('');
      } else { const data = await res.json(); showToast(data.message || 'Failed to delete', 'error'); }
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered list ──────────────────────────────────────────
  const filteredVouchers = useMemo(() => {
    let list = vouchers;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(v =>
        getLabourName(v).toLowerCase().includes(q) ||
        getLabourPhone(v).toLowerCase().includes(q) ||
        formatDate(v.fromDate).toLowerCase().includes(q) ||
        formatDate(v.toDate).toLowerCase().includes(q)
      );
    }
    if (monthFilter !== 'All') {
      const mIdx = MONTH_NAMES.indexOf(monthFilter) + 1;
      list = list.filter(v => new Date(v.fromDate).getMonth() + 1 === mIdx);
    }
    return list;
  }, [vouchers, searchText, monthFilter]);

  const totalPayable = vouchers.reduce((s, v) => s + (v.payableSalary || 0), 0);
  const totalSalary  = vouchers.reduce((s, v) => s + (v.totalSalary   || 0), 0);
  const totalAdvance = vouchers.reduce((s, v) => s + (v.deductedAdvanceAmount || 0), 0);

  const labourOptions = labours.map(l => ({
    value: l._id,
    label: `${l.name} — ${l.phone} — ${l.workType}`,
  }));

  const selectedVoucher = vouchers.find(v => v._id === selectedId);
  const deleteOptions   = vouchers.map(v => ({
    value: v._id,
    label: `${getLabourName(v)} — ${formatDate(v.fromDate)} to ${formatDate(v.toDate)} — ₹${Number(v.payableSalary||0).toLocaleString('en-IN')}`,
  }));

  const excelLabel = monthFilter === 'All'
    ? (searchText.trim() ? `Search:${searchText.trim()}` : 'All') : monthFilter;

  const addPreviewPayable = useMemo(() => {
    if (!addPreview || addPreview.error) return null;
    const adv = resolveDeductAmount(addDeductMode, addDeductAmount, addPreview.totalAdvanceGiven ?? 0);
    return Math.max(0, (addPreview.totalSalary ?? 0) - adv);
  }, [addPreview, addDeductMode, addDeductAmount]);

  const presentMonths = useMemo(() => {
    const set = new Set(vouchers.map(v => new Date(v.fromDate).getMonth() + 1));
    return [...set].sort((a,b)=>a-b).map(m => MONTH_NAMES[m-1]);
  }, [vouchers]);

  return (
    <div className="entity-wrapper">
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">👷 Labour Voucher</h1>
          <span className="entity-page-badge" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            {vouchers.length} Vouchers
          </span>
        </div>

        {/* ── 3 buttons only (Update removed) ── */}
        <div className="action-cards-grid">

  <div
    className={`action-card action-card-add ${
      activePanel === PANELS.ADD ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel(PANELS.ADD)}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Generate Voucher</div>
    <div className="action-card-desc">
      Create a new voucher instantly
    </div>
  </div>

  <div
    className={`action-card action-card-getall ${
      activePanel === PANELS.GETALL ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel(PANELS.GETALL)}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">All Vouchers</div>
    <div className="action-card-desc">
      View all generated vouchers
    </div>
  </div>

   <div
    className={`action-card action-card-delete ${
      activePanel === PANELS.DELETE ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel(PANELS.DELETE)}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Voucher</div>
    <div className="action-card-desc">
      Remove voucher records safely
    </div>
  </div>

</div>

        {loading && <div className="loading-bar"><div className="lv-loading" /></div>}

        {/* ════ GENERATE ════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Generate Labour Salary Voucher</div>
            <form onSubmit={handleAdd}>

              <div className="form-row lv-form-grid">
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Select Labour *</label>
                  <SearchableDropdown
                    options={labourOptions}
                    value={addForm.labourId}
                    onChange={id => {
                      setAddPreview(null);
                      setAddForm(prev => ({ ...prev, labourId: id }));
                    }}
                    placeholder="Search labour by name, phone..."
                  />
                </div>
              </div>

              {/* Date Range Toggle */}
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={addForm.useDateRange}
                    onChange={e => setAddForm(prev => ({ ...prev, useDateRange: e.target.checked, toDate: '' }))}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span>Use Date Range (From - To)</span>
                </label>
              </div>

              <div className="form-row lv-form-grid" style={{ gridTemplateColumns: addForm.useDateRange ? '1fr 1fr' : '1fr' }}>
                <div className="form-field">
                  <label className="field-label">{addForm.useDateRange ? 'From Date *' : 'Date *'}</label>
                  <input type="date" className="field-input" value={addForm.fromDate}
                    onChange={e => setAddForm(prev => ({ ...prev, fromDate: e.target.value }))} required />
                </div>
                {addForm.useDateRange && (
                  <div className="form-field">
                    <label className="field-label">To Date *</label>
                    <input type="date" className="field-input" value={addForm.toDate}
                      onChange={e => setAddForm(prev => ({ ...prev, toDate: e.target.value }))}
                      min={addForm.fromDate} required={addForm.useDateRange} />
                  </div>
                )}
              </div>

              {/* Full Preview with attendance date list */}
              <AttendancePreview
                preview={addPreview}
                loading={addPreviewLoading}
                labours={labours}
                labourId={addForm.labourId}
              />

              {/* Advance Deduction Override */}
              {addPreview && !addPreview.error && (addPreview.totalAdvanceGiven ?? 0) > 0 && (
                <AdvanceDeductControl
                  totalAdvance={addPreview.totalAdvanceGiven ?? 0}
                  deductMode={addDeductMode}
                  deductAmount={addDeductAmount}
                  onChange={(mode, amt) => { setAddDeductMode(mode); setAddDeductAmount(amt); }}
                />
              )}

              {/* Final payable after user deduction choice */}
              {addPreviewPayable !== null && (addPreview?.totalAdvanceGiven ?? 0) > 0 && (
                <div className="lv-final-payable-banner">
                  <span>💵 Final Payable (after your deduction choice):</span>
                  <strong>₹{Number(addPreviewPayable).toLocaleString('en-IN')}</strong>
                </div>
              )}

              <div className="lv-info-banner">
                <span className="autofill-icon">ℹ️</span>
                <span>
                  Unpaid attendance records for <strong>
                    {addForm.useDateRange && addForm.toDate
                      ? `${formatDate(addForm.fromDate)} to ${formatDate(addForm.toDate)}`
                      : formatDate(addForm.fromDate)}
                  </strong> will be used. PDF will be generated automatically. Once generated, attendance dates are marked as <strong>Paid</strong>.
                </span>
              </div>

              <button type="submit" className="submit-btn lv-submit" disabled={loading}>
                {loading ? '⏳ Generating...' : '👷 Generate Voucher'}
              </button>
            </form>
          </div>
        )}

        {/* ════ DELETE ════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">🗑️ Delete Labour Voucher</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Voucher *</label>
              <SearchableDropdown options={deleteOptions} value={deleteId}
                onChange={handleDeleteSelect} placeholder="Search voucher by labour name, date..." />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 16 }}>
                {[
                  ['Labour Name',       getLabourName(deleteFound)],
                  ['Phone',             getLabourPhone(deleteFound)],
                  ['From Date',         formatDate(deleteFound.fromDate)],
                  ['To Date',           formatDate(deleteFound.toDate)],
                  ['Working Days',      deleteFound.totalWorkingDays  ?? '—'],
                  ['Working Hours',     deleteFound.totalWorkingHours ?? '—'],
                  ['Overtime Hours',    deleteFound.overtimeHours     ?? '—'],
                  ['Total Salary',      `₹${Number(deleteFound.totalSalary  || 0).toLocaleString('en-IN')}`],
                  ['Advance Deducted',  `₹${Number(deleteFound.deductedAdvanceAmount || 0).toLocaleString('en-IN')}`],
                  ['Remaining Advance', `₹${Number(deleteFound.remainingAdvanceAmount || 0).toLocaleString('en-IN')}`],
                  ['Payable Salary',    `₹${Number(deleteFound.payableSalary || 0).toLocaleString('en-IN')}`],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}

                {/* Restore info notice */}
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: '#fffbeb', border: '1px solid #fde68a',
                  borderRadius: 8, fontSize: 12, color: '#92400e'
                }}>
                  <strong>⚠️ What will happen on delete:</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                    <li>Voucher PDF removed from cloud storage</li>
                    <li>Advance deducted (₹{Number(deleteFound.deductedAdvanceAmount || 0).toLocaleString('en-IN')}) will be <strong>restored</strong> to remaining advance</li>
                    <li>All attendance dates in this range will be marked as <strong>Unpaid</strong> again</li>
                  </ul>
                </div>

                <button className="delete-confirm-btn" style={{ marginTop: 12 }} onClick={handleDelete} disabled={loading}>
                  🗑️ Confirm Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ GET ALL ════ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">📋 All Labour Vouchers</div>

            <div className="lv-stat-cards">
              <div className="lv-sc lv-sc-total"><span>Total Vouchers</span><strong>{vouchers.length}</strong></div>
              <div className="lv-sc lv-sc-salary"><span>Total Gross Salary</span><strong>₹{totalSalary.toLocaleString('en-IN')}</strong></div>
              <div className="lv-sc lv-sc-advance"><span>Total Advance Deducted</span><strong>₹{totalAdvance.toLocaleString('en-IN')}</strong></div>
              <div className="lv-sc lv-sc-payable"><span>Total Payable</span><strong>₹{totalPayable.toLocaleString('en-IN')}</strong></div>
            </div>

            <div className="getall-filter-bar">
              <div className="getall-search-wrap">
                <span className="getall-search-icon">🔍</span>
                <input className="getall-search-input" placeholder="Search by labour name, phone, date..."
                  value={searchText} onChange={e => setSearchText(e.target.value)} />
                {searchText && <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>}
              </div>
              <div className="getall-sort-wrap">
                <span className="getall-sort-label">Month</span>
                <div className="getall-sort-tabs">
                  <button className={`getall-sort-tab ${monthFilter === 'All' ? 'active' : ''}`}
                    onClick={() => { setMonthFilter('All'); setSelectedId(''); }}>All</button>
                  {presentMonths.map(m => (
                    <button key={m} className={`getall-sort-tab ${monthFilter === m ? 'active' : ''}`}
                      onClick={() => { setMonthFilter(m); setSelectedId(''); }}>{m.slice(0,3)}</button>
                  ))}
                </div>
              </div>
              <span className="getall-count-chip">{filteredVouchers.length} shown</span>
            </div>

            {vouchers.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No vouchers found. Generate one first!</p></div>
            ) : (
              <>
                <div className="voucher-excel-bar" style={{ borderColor: '#86efac' }}>
                  <div className="voucher-excel-info">
                    <span className="voucher-excel-label">
                      📊 Showing <strong>{filteredVouchers.length}</strong> of <strong>{vouchers.length}</strong> vouchers
                      {monthFilter !== 'All' && <span className="voucher-excel-filter-tag">{monthFilter}</span>}
                      {searchText.trim() && <span className="voucher-excel-filter-tag">🔍 "{searchText.trim()}"</span>}
                    </span>
                  </div>
                  <div className="voucher-excel-actions">
                    <button className="excel-download-btn excel-download-filtered"
                      onClick={() => { if (!filteredVouchers.length) { showToast('No vouchers to export', 'error'); return; } exportToExcel(filteredVouchers, excelLabel); showToast(`📥 Downloading ${filteredVouchers.length} voucher(s)...`); }}>
                      <span className="excel-btn-icon">⬇️</span><span>Download Filtered</span>
                      <span className="excel-btn-count">{filteredVouchers.length}</span>
                    </button>
                    <button className="excel-download-btn excel-download-all"
                      onClick={() => { exportToExcel(vouchers, 'All'); showToast(`📥 Downloading all ${vouchers.length} voucher(s)...`); }}>
                      <span className="excel-btn-icon">📥</span><span>Download All</span>
                      <span className="excel-btn-count">{vouchers.length}</span>
                    </button>
                  </div>
                </div>

                <div className="form-field" style={{ marginBottom: 20 }}>
                  <label className="field-label">Select Voucher (View Details)</label>
                  <SearchableDropdown
                    options={filteredVouchers.map(v => ({
                      value: v._id,
                      label: `${getLabourName(v)} — ${formatDate(v.fromDate)} to ${formatDate(v.toDate)} — ₹${Number(v.payableSalary||0).toLocaleString('en-IN')}`,
                    }))}
                    value={selectedId} onChange={setSelectedId}
                    placeholder="Search and select to view details..." />
                </div>

                {selectedVoucher && (
                  <div className="lv-detail-card">
                    <div className="voucher-detail-header">
                      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                        <span className="lv-no-tag">👷 {getLabourName(selectedVoucher)}</span>
                        <span className="lv-month-badge">{formatDate(selectedVoucher.fromDate)} to {formatDate(selectedVoucher.toDate)}</span>
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedId('')}>✕</button>
                    </div>
                    <div className="lv-detail-grid">
                      {[
                        ['Labour Name',        getLabourName(selectedVoucher)],
                        ['Phone',              getLabourPhone(selectedVoucher)],
                        ['From Date',          formatDate(selectedVoucher.fromDate)],
                        ['To Date',            formatDate(selectedVoucher.toDate)],
                        ['Working Days',       selectedVoucher.totalWorkingDays  ?? '—'],
                        ['Working Hours',      selectedVoucher.totalWorkingHours ?? '—'],
                        ['Overtime Hours',     selectedVoucher.overtimeHours     ?? '—'],
                        ['Total Salary',       `₹${Number(selectedVoucher.totalSalary       ||0).toLocaleString('en-IN')}`],
                        ['Total Advance Given',`₹${Number(selectedVoucher.totalAdvanceGiven  ||0).toLocaleString('en-IN')}`],
                        ['Advance Deducted',   `₹${Number(selectedVoucher.deductedAdvanceAmount||0).toLocaleString('en-IN')}`],
                        ['Remaining Advance',  `₹${Number(selectedVoucher.remainingAdvanceAmount||0).toLocaleString('en-IN')}`],
                        ['Payable Salary',     `₹${Number(selectedVoucher.payableSalary      ||0).toLocaleString('en-IN')}`],
                      ].map(([k, v]) => (
                        <div className="voucher-detail-item" key={k}>
                          <span className="voucher-detail-key">{k}</span>
                          <span className={`voucher-detail-val ${k === 'Payable Salary' ? 'lv-payable-val' : ''}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {selectedVoucher.voucherPdf?.url && (
                      <a href={selectedVoucher.voucherPdf.url} target="_blank" rel="noreferrer"
                        className="submit-btn lv-pdf-btn"
                        style={{ marginTop:16, textDecoration:'none', display:'inline-flex' }}>
                        📄 View PDF Voucher
                      </a>
                    )}
                  </div>
                )}

                {filteredVouchers.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">🔍</div><p>No vouchers match your filter.</p></div>
                ) : (
                  <div className="lv-card-list">
                    {filteredVouchers.map(v => {
                      const isSelected = selectedId === v._id;
                      return (
                        <div key={v._id}
                          className={`lv-row-card ${isSelected ? 'lv-row-selected' : ''}`}
                          onClick={() => setSelectedId(isSelected ? '' : v._id)}>
                          <div className="lv-row-left">
                            <span className="lv-no-tag">👷 {getLabourName(v)}</span>
                            <span className="lv-month-badge">{formatDate(v.fromDate)} → {formatDate(v.toDate)}</span>
                          </div>
                          <div className="lv-row-mid">
                            <div className="lv-row-name">{getLabourName(v)}</div>
                            <div className="lv-row-meta">
                              <span>📅 {v.totalWorkingDays ?? 0} days</span>
                              <span>⏱️ {v.totalWorkingHours ?? 0} hrs</span>
                              {(v.overtimeHours > 0) && <span className="lv-ot-chip">🕐 OT: {v.overtimeHours} hrs</span>}
                            </div>
                            <div className="lv-row-salary-row">
                              <span className="lv-row-gross">Gross: ₹{Number(v.totalSalary||0).toLocaleString('en-IN')}</span>
                              <span className="lv-row-advance">Advance: ₹{Number(v.deductedAdvanceAmount||0).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                          <div className="lv-row-right">
                            <div className="lv-row-payable">₹{Number(v.payableSalary||0).toLocaleString('en-IN')}</div>
                            <div className="lv-row-payable-label">Payable</div>
                            {v.voucherPdf?.url && (
                              <a href={v.voucherPdf.url} target="_blank" rel="noreferrer"
                                className="voucher-pdf-link" onClick={e => e.stopPropagation()}>
                                📄 PDF
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default LabourVoucherPage;