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

// ── Excel Export ──────────────────────────────────────────
function exportToExcel(voucherList, filterLabel) {
  const wb = XLSX.utils.book_new();
  const rows = [];
  rows.push([COMPANY.name, '', '', '', '', '', '', '']);
  rows.push([`Address: ${COMPANY.address}`, '', '', '', `Ph: ${COMPANY.phone}`, '', `GST: ${COMPANY.gst}`, '']);
  rows.push(['', '', '', '', '', '', '', '']);
  rows.push([`Labour Salary Voucher Report — ${filterLabel}`, '', '', '', '', '', '', '']);
  rows.push([`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, '', '', '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '', '']);
  rows.push(['Labour Name', 'Phone', 'Month', 'Year', 'Working Days', 'Working Hours', 'OT Hours', 'Total Salary (₹)', 'Advance (₹)', 'Payable (₹)', 'PDF URL']);

  voucherList.forEach(v => {
    const labour = typeof v.labour === 'object' ? v.labour : { name: '', phone: '' };
    rows.push([
      labour.name || '',
      labour.phone || '',
      MONTH_NAMES[(v.month || 1) - 1],
      v.year || '',
      v.totalWorkingDays || 0,
      v.totalWorkingHours || 0,
      v.overtimeHours || 0,
      v.totalSalary || 0,
      v.totalAdvance || 0,
      v.payableSalary || 0,
      v.voucherPdf?.url || '',
    ]);
  });

  rows.push(['', '', '', '', '', '', '', '', '', '', '']);
  const totalPayable = voucherList.reduce((s, v) => s + (v.payableSalary || 0), 0);
  rows.push(['TOTAL', '', '', '', '', '', '', '', '', totalPayable, '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 40 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Labour Vouchers');
  const filename = `LabourVouchers_${filterLabel.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── Helpers ───────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
function LabourVoucherPage({ onLogout }) {
  const navigate = useNavigate();

  const [vouchers, setVouchers]     = useState([]);
  const [labours, setLabours]       = useState([]);
  const [activePanel, setPanel]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [searchText, setSearchText] = useState('');
  const [monthFilter, setMonthFilter] = useState('All');
  const [selectedId, setSelectedId] = useState('');

  // Add form
  const [addForm, setAddForm] = useState({
    labourId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
  });

  // Delete
  const [deleteId, setDeleteId]       = useState('');
  const [deleteFound, setDeleteFound] = useState(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch ──────────────────────────────────────────────
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

  useEffect(() => {
    fetchVouchers();
    fetchLabours();
  }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm({ labourId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    setDeleteId(''); setDeleteFound(null); setSelectedId('');
    setSearchText(''); setMonthFilter('All');
  };

  // ── ADD (Generate) ─────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.labourId) { showToast('Please select a labour', 'error'); return; }
    if (!addForm.month || !addForm.year) { showToast('Month and Year are required', 'error'); return; }

    try {
      setLoading(true);
      const res = await fetch(`${API}/labourVoucher/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labourId: addForm.labourId,
          month: parseInt(addForm.month),
          year: parseInt(addForm.year),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchVouchers();
        setAddForm({ labourId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
        showToast(`✅ Voucher generated for ${MONTH_NAMES[addForm.month - 1]} ${addForm.year}!`);
      } else {
        showToast(data.message || 'Failed to generate voucher', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  // ── DELETE ─────────────────────────────────────────────
  const handleDeleteSelect = (vid) => {
    setDeleteId(vid);
    setDeleteFound(vouchers.find(v => v._id === vid) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a voucher', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/labourVoucher/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchVouchers();
        showToast(`🗑️ Voucher deleted!`, 'info');
        setDeleteFound(null); setDeleteId('');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally { setLoading(false); }
  };

  // ── Filtered ───────────────────────────────────────────
  const filteredVouchers = useMemo(() => {
    let list = vouchers;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(v =>
        (getLabourName(v)).toLowerCase().includes(q) ||
        (getLabourPhone(v)).toLowerCase().includes(q) ||
        String(v.year || '').includes(q) ||
        (MONTH_NAMES[(v.month || 1) - 1]).toLowerCase().includes(q)
      );
    }
    if (monthFilter !== 'All') {
      const mIdx = MONTH_NAMES.indexOf(monthFilter) + 1;
      list = list.filter(v => v.month === mIdx);
    }
    return list;
  }, [vouchers, searchText, monthFilter]);

  // ── Stats ──────────────────────────────────────────────
  const totalPayable   = vouchers.reduce((s, v) => s + (v.payableSalary || 0), 0);
  const totalSalary    = vouchers.reduce((s, v) => s + (v.totalSalary || 0), 0);
  const totalAdvance   = vouchers.reduce((s, v) => s + (v.totalAdvance || 0), 0);

  const labourOptions = labours.map(l => ({
    value: l._id,
    label: `${l.name} — ${l.phone} — ${l.workType}`,
  }));

  const selectedVoucher = vouchers.find(v => v._id === selectedId);

  const deleteOptions = vouchers.map(v => ({
    value: v._id,
    label: `${getLabourName(v)} — ${MONTH_NAMES[(v.month||1)-1]} ${v.year} — ₹${Number(v.payableSalary||0).toLocaleString('en-IN')}`,
  }));

  const excelLabel = monthFilter === 'All'
    ? (searchText.trim() ? `Search:${searchText.trim()}` : 'All')
    : monthFilter;

  // ── Year options ───────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // ── Unique months present in data ─────────────────────
  const presentMonths = useMemo(() => {
    const set = new Set(vouchers.map(v => v.month));
    return [...set].sort((a,b)=>a-b).map(m => MONTH_NAMES[m-1]);
  }, [vouchers]);

  return (
    <div className="entity-wrapper">
      <div className="entity-main">

        {/* Header */}
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">👷 Labour Voucher</h1>
          <span className="entity-page-badge" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            {vouchers.length} Vouchers
          </span>
        </div>

        {/* Action Buttons */}
        <div className="actions-row">
          <button className="action-btn lv-btn-add"    onClick={() => togglePanel(PANELS.ADD)}>➕ Generate Voucher</button>
          <button className="action-btn lv-btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>🗑️ Delete Voucher</button>
          <button className="action-btn lv-btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>📋 All Vouchers</button>
        </div>

        {loading && (
          <div className="loading-bar"><div className="lv-loading" /></div>
        )}

        {/* ════ GENERATE ════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Generate Labour Salary Voucher</div>
            <form onSubmit={handleAdd}>
              <div className="form-row lv-form-grid">

                <div className="form-field">
                  <label className="field-label">Select Labour *</label>
                  <SearchableDropdown
                    options={labourOptions}
                    value={addForm.labourId}
                    onChange={id => setAddForm(prev => ({ ...prev, labourId: id }))}
                    placeholder="Search labour by name, phone..."
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Month *</label>
                  <select
                    className="field-input"
                    value={addForm.month}
                    onChange={e => setAddForm(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">Year *</label>
                  <select
                    className="field-input"
                    value={addForm.year}
                    onChange={e => setAddForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Info banner */}
              <div className="lv-info-banner">
                <span className="autofill-icon">ℹ️</span>
                <span>
                  The system will automatically calculate salary from attendance records for{' '}
                  <strong>{MONTH_NAMES[addForm.month - 1]} {addForm.year}</strong>.
                  Advance payments for this period will be deducted automatically.
                  A PDF voucher will be generated and stored.
                </span>
              </div>

              <div className="lv-auto-tag">
                📄 PDF generated automatically · Advance deducted automatically
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
              <SearchableDropdown
                options={deleteOptions}
                value={deleteId}
                onChange={handleDeleteSelect}
                placeholder="Search voucher by labour name, month..."
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 16 }}>
                {[
                  ['Labour Name',    getLabourName(deleteFound)],
                  ['Phone',          getLabourPhone(deleteFound)],
                  ['Month',          MONTH_NAMES[(deleteFound.month || 1) - 1]],
                  ['Year',           deleteFound.year],
                  ['Working Days',   deleteFound.totalWorkingDays],
                  ['Working Hours',  deleteFound.totalWorkingHours],
                  ['Overtime Hours', deleteFound.overtimeHours],
                  ['Total Salary',   `₹${Number(deleteFound.totalSalary || 0).toLocaleString('en-IN')}`],
                  ['Advance Paid',   `₹${Number(deleteFound.totalAdvance || 0).toLocaleString('en-IN')}`],
                  ['Payable Salary', `₹${Number(deleteFound.payableSalary || 0).toLocaleString('en-IN')}`],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}
                <div className="vendor-delete-warn">
                  ⚠️ This will permanently delete the voucher and its PDF from cloud storage.
                </div>
                <button
                  className="delete-confirm-btn"
                  style={{ marginTop: 12 }}
                  onClick={handleDelete}
                  disabled={loading}
                >
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

            {/* Stat Cards */}
            <div className="lv-stat-cards">
              <div className="lv-sc lv-sc-total">
                <span>Total Vouchers</span>
                <strong>{vouchers.length}</strong>
              </div>
              <div className="lv-sc lv-sc-salary">
                <span>Total Gross Salary</span>
                <strong>₹{totalSalary.toLocaleString('en-IN')}</strong>
              </div>
              <div className="lv-sc lv-sc-advance">
                <span>Total Advance</span>
                <strong>₹{totalAdvance.toLocaleString('en-IN')}</strong>
              </div>
              <div className="lv-sc lv-sc-payable">
                <span>Total Payable</span>
                <strong>₹{totalPayable.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="getall-filter-bar">
              <div className="getall-search-wrap">
                <span className="getall-search-icon">🔍</span>
                <input
                  className="getall-search-input"
                  placeholder="Search by labour name, phone, month, year..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
                {searchText && (
                  <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>
                )}
              </div>

              <div className="getall-sort-wrap">
                <span className="getall-sort-label">Month</span>
                <div className="getall-sort-tabs">
                  <button
                    className={`getall-sort-tab ${monthFilter === 'All' ? 'active' : ''}`}
                    onClick={() => { setMonthFilter('All'); setSelectedId(''); }}
                  >All</button>
                  {presentMonths.map(m => (
                    <button
                      key={m}
                      className={`getall-sort-tab ${monthFilter === m ? 'active' : ''}`}
                      onClick={() => { setMonthFilter(m); setSelectedId(''); }}
                    >{m.slice(0,3)}</button>
                  ))}
                </div>
              </div>

              <span className="getall-count-chip">{filteredVouchers.length} shown</span>
            </div>

            {vouchers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No vouchers found. Generate one first!</p>
              </div>
            ) : (
              <>
                {/* Excel bar */}
                <div className="voucher-excel-bar" style={{ borderColor: '#86efac' }}>
                  <div className="voucher-excel-info">
                    <span className="voucher-excel-label">
                      📊 Showing <strong>{filteredVouchers.length}</strong> of <strong>{vouchers.length}</strong> vouchers
                      {monthFilter !== 'All' && <span className="voucher-excel-filter-tag">{monthFilter}</span>}
                      {searchText.trim() && <span className="voucher-excel-filter-tag">🔍 "{searchText.trim()}"</span>}
                    </span>
                  </div>
                  <div className="voucher-excel-actions">
                    <button
                      className="excel-download-btn excel-download-filtered"
                      onClick={() => {
                        if (!filteredVouchers.length) { showToast('No vouchers to export', 'error'); return; }
                        exportToExcel(filteredVouchers, excelLabel);
                        showToast(`📥 Downloading ${filteredVouchers.length} voucher(s)...`);
                      }}
                    >
                      <span className="excel-btn-icon">⬇️</span>
                      <span>Download Filtered</span>
                      <span className="excel-btn-count">{filteredVouchers.length}</span>
                    </button>
                    <button
                      className="excel-download-btn excel-download-all"
                      onClick={() => {
                        exportToExcel(vouchers, 'All');
                        showToast(`📥 Downloading all ${vouchers.length} voucher(s)...`);
                      }}
                    >
                      <span className="excel-btn-icon">📥</span>
                      <span>Download All</span>
                      <span className="excel-btn-count">{vouchers.length}</span>
                    </button>
                  </div>
                </div>

                {/* Select for detail view */}
                <div className="form-field" style={{ marginBottom: 20 }}>
                  <label className="field-label">Select Voucher (View Details)</label>
                  <SearchableDropdown
                    options={filteredVouchers.map(v => ({
                      value: v._id,
                      label: `${getLabourName(v)} — ${MONTH_NAMES[(v.month||1)-1]} ${v.year} — ₹${Number(v.payableSalary||0).toLocaleString('en-IN')}`,
                    }))}
                    value={selectedId}
                    onChange={setSelectedId}
                    placeholder="Search and select to view details..."
                  />
                </div>

                {/* Detail card */}
                {selectedVoucher && (
                  <div className="lv-detail-card">
                    <div className="voucher-detail-header">
                      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                        <span className="lv-no-tag">👷 {getLabourName(selectedVoucher)}</span>
                        <span className="lv-month-badge">{MONTH_NAMES[(selectedVoucher.month||1)-1]} {selectedVoucher.year}</span>
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedId('')}>✕</button>
                    </div>
                    <div className="lv-detail-grid">
                      {[
                        ['Labour Name',    getLabourName(selectedVoucher)],
                        ['Phone',          getLabourPhone(selectedVoucher)],
                        ['Month / Year',   `${MONTH_NAMES[(selectedVoucher.month||1)-1]} ${selectedVoucher.year}`],
                        ['Working Days',   selectedVoucher.totalWorkingDays ?? '—'],
                        ['Working Hours',  selectedVoucher.totalWorkingHours ?? '—'],
                        ['Overtime Hours', selectedVoucher.overtimeHours ?? '—'],
                        ['Total Salary',   `₹${Number(selectedVoucher.totalSalary||0).toLocaleString('en-IN')}`],
                        ['Advance Paid',   `₹${Number(selectedVoucher.totalAdvance||0).toLocaleString('en-IN')}`],
                        ['Payable Salary', `₹${Number(selectedVoucher.payableSalary||0).toLocaleString('en-IN')}`],
                      ].map(([k, v]) => (
                        <div className="voucher-detail-item" key={k}>
                          <span className="voucher-detail-key">{k}</span>
                          <span className={`voucher-detail-val ${k === 'Payable Salary' ? 'lv-payable-val' : ''}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {selectedVoucher.voucherPdf?.url && (
                      <a
                        href={selectedVoucher.voucherPdf.url}
                        target="_blank"
                        rel="noreferrer"
                        className="submit-btn lv-pdf-btn"
                        style={{ marginTop:16, textDecoration:'none', display:'inline-flex' }}
                      >
                        📄 View PDF Voucher
                      </a>
                    )}
                  </div>
                )}

                {/* Card list */}
                {filteredVouchers.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <p>No vouchers match your filter.</p>
                  </div>
                ) : (
                  <div className="lv-card-list">
                    {filteredVouchers.map(v => {
                      const isSelected = selectedId === v._id;
                      return (
                        <div
                          key={v._id}
                          className={`lv-row-card ${isSelected ? 'lv-row-selected' : ''}`}
                          onClick={() => setSelectedId(isSelected ? '' : v._id)}
                        >
                          <div className="lv-row-left">
                            <span className="lv-no-tag">👷 {getLabourName(v)}</span>
                            <span className="lv-month-badge">{MONTH_NAMES[(v.month||1)-1]} {v.year}</span>
                          </div>
                          <div className="lv-row-mid">
                            <div className="lv-row-name">{getLabourName(v)}</div>
                            <div className="lv-row-meta">
                              <span>📅 {v.totalWorkingDays ?? 0} days</span>
                              <span>⏱️ {v.totalWorkingHours ?? 0} hrs</span>
                              {(v.overtimeHours > 0) && <span>🕐 OT: {v.overtimeHours} hrs</span>}
                            </div>
                            <div className="lv-row-salary-row">
                              <span className="lv-row-gross">Gross: ₹{Number(v.totalSalary||0).toLocaleString('en-IN')}</span>
                              <span className="lv-row-advance">Advance: ₹{Number(v.totalAdvance||0).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                          <div className="lv-row-right">
                            <div className="lv-row-payable">₹{Number(v.payableSalary||0).toLocaleString('en-IN')}</div>
                            <div className="lv-row-payable-label">Payable</div>
                            {v.voucherPdf?.url && (
                              <a
                                href={v.voucherPdf.url}
                                target="_blank"
                                rel="noreferrer"
                                className="voucher-pdf-link"
                                onClick={e => e.stopPropagation()}
                              >
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