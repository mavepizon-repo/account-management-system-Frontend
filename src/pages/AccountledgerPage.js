import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/AccountLedgerPage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COMPANY_NAME = 'DESIGN ART (INTERIOR & EXTERIOR SOLUTION)';
const COMPANY_ADDR = '5-6, Indria Nagar, PM Samy Colony, Ratinapuri, Gandhipuram, Coimbatore 641012 | Ph: +91 9677731326 | GST: 33BNCPP2332Q1ZT';

// ── Load SheetJS dynamically ─────────────────────────────────
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload  = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(script);
  });
}

// ── Excel Export Helper ──────────────────────────────────────
async function exportLedgerExcel(type, rows, meta) {
  const XLSX = await loadSheetJS();

  const isIncome = type === 'income';
  const sheetTitle = isIncome ? 'INCOME LEDGER' : 'EXPENSE LEDGER';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const incomeColumns = [
    { key: 'sno',         label: '#',               width: 5  },
    { key: 'date',        label: 'Date',            width: 14 },
    { key: 'mode',        label: 'Mode',            width: 12 },
    { key: 'refNo',       label: 'Ref No',          width: 16 },
    { key: 'entityName',  label: 'Client Name',     width: 24 },
    { key: 'clientCode',  label: 'Client Code',     width: 14 },
    { key: 'category',    label: 'Project',         width: 22 },
    { key: 'description', label: 'Invoice Ref',     width: 20 },
    { key: 'paymentMode', label: 'Payment Mode',    width: 15 },
    { key: 'amount',      label: 'Amount (₹)',      width: 16 },
    { key: 'invoiceStatus', label: 'Invoice Status', width: 15 },
  ];

  const expenseColumns = [
    { key: 'sno',         label: '#',                 width: 5  },
    { key: 'date',        label: 'Date',              width: 14 },
    { key: 'mode',        label: 'Type',              width: 12 },
    { key: 'refNo',       label: 'Ref No',            width: 16 },
    { key: 'entityName',  label: 'Name',              width: 24 },
    { key: 'category',    label: 'Category',          width: 20 },
    { key: 'description', label: 'Description/Site',  width: 24 },
    { key: 'paymentMode', label: 'Payment Mode',      width: 15 },
    { key: 'amount',      label: 'Paid Amount (₹)',   width: 16 },
    { key: 'totalAmount', label: 'Total Amount (₹)',  width: 16 },
    { key: 'balance',     label: 'Balance (₹)',       width: 14 },
    { key: 'status',      label: 'Status',            width: 12 },
  ];

  const columns = isIncome ? incomeColumns : expenseColumns;
  const colCount = columns.length;

  const aoa = [];
  aoa.push([COMPANY_NAME, ...Array(colCount - 1).fill('')]);
  aoa.push([COMPANY_ADDR, ...Array(colCount - 1).fill('')]);
  aoa.push(Array(colCount).fill(''));
  aoa.push([`${sheetTitle} — Exported on ${today}`, ...Array(colCount - 1).fill('')]);
  aoa.push([meta.filterDesc || 'All records', ...Array(colCount - 1).fill('')]);
  aoa.push(Array(colCount).fill(''));
  aoa.push(columns.map(c => c.label));

  rows.forEach((row, idx) => {
    if (isIncome) {
      aoa.push([
        idx + 1,
        row.date,
        row.mode,
        row.refNo,
        row.entityName,
        row.clientCode || '',
        row.category,
        row.description,
        row.paymentMode,
        row.amount,
        row.invoiceStatus || '—',
      ]);
    } else {
      aoa.push([
        idx + 1,
        row.date,
        row.mode,
        row.refNo,
        row.entityName,
        row.category,
        row.description,
        row.paymentMode !== '—' ? row.paymentMode : '',
        row.amount,
        row.totalAmount || 0,
        row.balance || 0,
        row.status || '—',
      ]);
    }
  });

  aoa.push(Array(colCount).fill(''));
  const amtColIdx = columns.findIndex(c => c.key === 'amount');
  const totalRow = Array(colCount).fill('');
  totalRow[0] = isIncome
    ? `TOTAL INCOME (${rows.length} receipts)`
    : `TOTAL EXPENSE (${rows.length} entries)`;
  totalRow[amtColIdx] = isIncome ? meta.totalIncome : meta.totalExpense;
  aoa.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map(c => ({ wch: c.width }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } },
    { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: amtColIdx - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isIncome ? 'Income Ledger' : 'Expense Ledger');
  const fileName = `DesignArt_${isIncome ? 'Income' : 'Expense'}_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ── Format Date Helper ───────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ── Get Voucher Receiver Name ────────────────────────────────
// ✅ FIXED: Handles all possible voucher structures from backend
function getVoucherReceiverName(v) {
  // Direct receiver name (if backend sends it)
  if (v.receiverName) return v.receiverName;
  
  // Populated receiver object
  if (v.receiver && typeof v.receiver === 'object' && v.receiver.name) {
    return v.receiver.name;
  }
  
  // Vendor payment - check purchase.vendor
  if (v.receiverType === 'Vendor' || v.receiverType === 'vendor') {
    if (v.purchase && typeof v.purchase === 'object') {
      const vendor = v.purchase.vendor;
      if (typeof vendor === 'object' && vendor.name) return vendor.name;
      if (typeof vendor === 'object' && vendor.vendorCode) return vendor.vendorCode;
    }
  }
  
  // Subcontractor payment - check workSubcontract.subcontract
  if (v.receiverType === 'Subcontract' || v.receiverType === 'subcontractor' || v.receiverType === 'Subcontractor') {
    if (v.workSubcontract && typeof v.workSubcontract === 'object') {
      const sub = v.workSubcontract.subcontract;
      if (typeof sub === 'object' && sub.name) return sub.name;
    }
  }
  
  return '—';
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
function AccountLedgerPage({ onLogout }) {
  const navigate = useNavigate();

  const [activeTab,  setActiveTab]  = useState('income');
  const [toast,      setToast]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [exporting,  setExporting]  = useState(false);

  const [receipts,  setReceipts]  = useState([]);
  const [clients,   setClients]   = useState([]);
  const [vouchers,  setVouchers]  = useState([]);
  const [labours,   setLabours]   = useState([]);

  // Filters — Income
  const [incomeSearch,    setIncomeSearch]    = useState('');
  const [incomeDateFrom,  setIncomeDateFrom]  = useState('');
  const [incomeDateTo,    setIncomeDateTo]    = useState('');
  const [incomeClient,    setIncomeClient]    = useState('');

  // Filters — Expense
  const [expenseSearch,   setExpenseSearch]   = useState('');
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo,   setExpenseDateTo]   = useState('');
  const [expenseType,     setExpenseType]     = useState('All');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch All Data ───────────────────────────────────────────
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [rRes, cRes, vRes, lRes] = await Promise.all([
        fetch(`${API}/receipt/getall`),
        fetch(`${API}/client/getall`),
        fetch(`${API}/vouchers/getall`), // ✅ Correct route
        fetch(`${API}/labours/getall`),
      ]);

      if (!rRes.ok || !cRes.ok || !vRes.ok || !lRes.ok) {
        throw new Error('Failed to fetch ledger data');
      }

      const [rData, cData, vData, lData] = await Promise.all([
        rRes.json(), cRes.json(), vRes.json(), lRes.json(),
      ]);

      // ✅ FIXED: Handle receipt response structure
      setReceipts(rData.receipts || (Array.isArray(rData) ? rData : (rData.data || [])));
      
      // ✅ FIXED: Handle client response structure
      setClients(Array.isArray(cData) ? cData : (cData.data || []));

      // ✅ CRITICAL FIX: Backend /vouchers/getall returns { count, data: [...] }
      // NOT { vouchers: [...] }
      setVouchers(Array.isArray(vData) ? vData : (vData.data || []));

      // ✅ FIXED: Handle labour response structure
      setLabours(Array.isArray(lData) ? lData : (lData.data || []));

      showToast('✅ Ledger data loaded successfully');
    } catch (err) {
      showToast('Failed to load ledger data', 'error');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Income Rows ──────────────────────────────────────────────
  const incomeRows = useMemo(() => receipts.map(r => ({
    id:            r._id,
    refNo:         r.receiptNumber || '—',
    mode:          'Receipt',
    date:          r.paymentDate?.split('T')[0] || '—',
    dateObj:       r.paymentDate ? new Date(r.paymentDate) : null,
    category:      r.invoice?.subject || r.invoice?.project || '—',
    entityName:    r.client?.name || '—',
    clientCode:    r.client?.clientCode || '',
    clientId:      r.client?._id || r.client || '',
    description:   r.invoice?.invoiceNumber ? `Invoice: ${r.invoice.invoiceNumber}` : (r.description || '—'),
    paymentMode:   r.paymentMethod || 'Cash',
    amount:        r.amountPaid || 0,
    invoiceTotal:  r.invoice?.grandTotal || 0,
    invoiceStatus: r.invoice?.paymentStatus || '—',
  })), [receipts]);

  // ── Expense Rows ─────────────────────────────────────────────
  const expenseRows = useMemo(() => {
    // ✅ FIXED: Voucher rows with proper receiver name extraction
    const vRows = vouchers.map(v => {
      const a      = parseFloat(v.amount) || 0;
      const p      = parseFloat(v.amount) || 0; // voucher.amount IS the paid amount
      const status = 'Paid'; // vouchers are always paid on creation
      
      return {
        id:           v._id,
        refNo:        v.voucherNumber || '—',
        mode:         'Voucher',
        date:         v.date?.split('T')[0] || '—',
        dateObj:      v.date ? new Date(v.date) : null,
        category:     (v.receiverType === 'Vendor' || v.receiverType === 'vendor')
                        ? 'Vendor Payment'
                        : 'Subcontractor Payment',
        entityName:   getVoucherReceiverName(v),
        description:  v.purpose || '—',
        paymentMode:  v.paymentMethod === 'cash'   ? 'Cash'
                    : v.paymentMethod === 'online' ? 'Online'
                    : (v.paymentMethod || '—'),
        amount:       p,
        totalAmount:  a,
        balance:      0,
        status,
        receiverType: v.receiverType || '—',
      };
    });

    // ✅ FIXED: Labour rows with proper data extraction
    const lRows = labours.map(l => {
      const totalSalary = parseFloat(l.totalSalary) || 0;
      const advance     = parseFloat(l.advance)     || 0;
      const balance     = totalSalary - advance;
      const status      = advance <= 0 ? 'Unpaid' : advance >= totalSalary ? 'Paid' : 'Partial';
      
      return {
        id:          l._id,
        refNo:       l.labourId || '—',
        mode:        'Labour',
        date:        l.updatedAt?.split('T')[0] || l.createdAt?.split('T')[0] || '—',
        dateObj:     l.updatedAt ? new Date(l.updatedAt) : (l.createdAt ? new Date(l.createdAt) : null),
        category:    l.workType || 'Labour',
        entityName:  l.name || '—',
        description: l.site ? `Site: ${l.site}` : `Days: ${l.daysWorked || 0}`,
        paymentMode: '—',
        amount:      advance,
        totalAmount: totalSalary,
        balance,
        status,
        dailyWage:   parseFloat(l.dailyWage) || 0,
        daysWorked:  l.daysWorked || 0,
        site:        l.site || '—',
      };
    });

    // ✅ FIXED: Sort by date (newest first)
    return [...vRows, ...lRows].sort((a, b) => {
      if (!a.dateObj && !b.dateObj) return 0;
      if (!a.dateObj) return 1;
      if (!b.dateObj) return -1;
      return b.dateObj - a.dateObj;
    });
  }, [vouchers, labours]);

  // ── Filtered Income ──────────────────────────────────────────
  const filteredIncome = useMemo(() => {
    let rows = incomeRows;
    if (incomeSearch) {
      const q = incomeSearch.toLowerCase();
      rows = rows.filter(r =>
        r.entityName.toLowerCase().includes(q) ||
        r.refNo.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.clientCode.toLowerCase().includes(q)
      );
    }
    if (incomeDateFrom) rows = rows.filter(r => r.date >= incomeDateFrom);
    if (incomeDateTo)   rows = rows.filter(r => r.date <= incomeDateTo);
    if (incomeClient)   rows = rows.filter(r => r.clientId === incomeClient);
    return rows;
  }, [incomeRows, incomeSearch, incomeDateFrom, incomeDateTo, incomeClient]);

  // ── Filtered Expense ─────────────────────────────────────────
  const filteredExpense = useMemo(() => {
    let rows = expenseRows;
    if (expenseType !== 'All') rows = rows.filter(r => r.mode === expenseType);
    if (expenseSearch) {
      const q = expenseSearch.toLowerCase();
      rows = rows.filter(r =>
        r.entityName.toLowerCase().includes(q) ||
        r.refNo.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    if (expenseDateFrom) rows = rows.filter(r => r.date >= expenseDateFrom);
    if (expenseDateTo)   rows = rows.filter(r => r.date <= expenseDateTo);
    return rows;
  }, [expenseRows, expenseType, expenseSearch, expenseDateFrom, expenseDateTo]);

  // ── Totals ───────────────────────────────────────────────────
  const totalIncome  = filteredIncome.reduce((s, r) => s + r.amount, 0);
  const totalExpense = filteredExpense.reduce((s, r) => s + r.amount, 0);
  const netBalance   = totalIncome - totalExpense;

  // ── Excel Export ─────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setExporting(true);
      const isIncome = activeTab === 'income';
      const rows     = isIncome ? filteredIncome : filteredExpense;

      if (rows.length === 0) {
        showToast('No data to export', 'error');
        return;
      }

      const parts = [];
      if (isIncome) {
        if (incomeSearch)    parts.push(`Search: "${incomeSearch}"`);
        if (incomeDateFrom)  parts.push(`From: ${formatDate(incomeDateFrom)}`);
        if (incomeDateTo)    parts.push(`To: ${formatDate(incomeDateTo)}`);
        if (incomeClient) {
          const cl = clients.find(c => c._id === incomeClient);
          if (cl) parts.push(`Client: ${cl.name}`);
        }
      } else {
        if (expenseType !== 'All') parts.push(`Type: ${expenseType}`);
        if (expenseSearch)   parts.push(`Search: "${expenseSearch}"`);
        if (expenseDateFrom) parts.push(`From: ${formatDate(expenseDateFrom)}`);
        if (expenseDateTo)   parts.push(`To: ${formatDate(expenseDateTo)}`);
      }

      const filterDesc = parts.length > 0
        ? `Filters applied — ${parts.join(' | ')}`
        : `All records — No filters applied`;

      await exportLedgerExcel(activeTab, rows, { totalIncome, totalExpense, filterDesc });
      showToast(`📊 ${isIncome ? 'Income' : 'Expense'} Ledger exported successfully!`);
    } catch (err) {
      showToast('Export failed. Please try again.', 'error');
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // ── Status Badge Helper ──────────────────────────────────────
  const statusBadge = (s) => {
    const normalized = String(s || '').toLowerCase();
    const map = {
      paid: 'status-paid',
      partial: 'status-partial',
      unpaid: 'status-pending',
    };
    const label = s ? (s.charAt(0).toUpperCase() + s.slice(1)) : '—';
    return <span className={`status-badge ${map[normalized] || 'status-pending'}`}>{label}</span>;
  };

  // ── Clear Filters ────────────────────────────────────────────
  const clearIncomeFilters  = () => {
    setIncomeSearch('');
    setIncomeDateFrom('');
    setIncomeDateTo('');
    setIncomeClient('');
  };

  const clearExpenseFilters = () => {
    setExpenseSearch('');
    setExpenseDateFrom('');
    setExpenseDateTo('');
    setExpenseType('All');
  };

  // ── Filter Status ────────────────────────────────────────────
  const incomeHasFilter  = incomeSearch || incomeDateFrom || incomeDateTo || incomeClient;
  const expenseHasFilter = expenseSearch || expenseDateFrom || expenseDateTo || expenseType !== 'All';

  // ── Counts ───────────────────────────────────────────────────
  const voucherCount = expenseRows.filter(r => r.mode === 'Voucher').length;
  const labourCount  = expenseRows.filter(r => r.mode === 'Labour').length;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        {/* Header */}
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">📒 Account Ledger</h1>
          <span className="entity-page-badge" style={{ background: '#eef1ff', color: 'var(--primary)', border: '1px solid #c8d4ff' }}>
            Master Ledger
          </span>
        </div>

        {loading && (
          <div className="loading-bar">
            <div className="loading-inner" />
          </div>
        )}

        {/* Summary Chips */}
        <div className="ledger-summary-chips">
          <div className="ledger-chip lc-income">
            <span>💚 Total Income</span>
            <strong>₹{totalIncome.toLocaleString('en-IN')}</strong>
          </div>
          <div className="ledger-chip lc-expense">
            <span>🔴 Total Expense</span>
            <strong>₹{totalExpense.toLocaleString('en-IN')}</strong>
          </div>
          <div className={`ledger-chip ${netBalance >= 0 ? 'lc-balance-pos' : 'lc-balance-neg'}`}>
            <span>{netBalance >= 0 ? '📈 Net Balance' : '📉 Net Balance'}</span>
            <strong>₹{Math.abs(netBalance).toLocaleString('en-IN')}</strong>
          </div>
          <div className="ledger-chip lc-entries">
            <span>📋 Total Entries</span>
            <strong>{incomeRows.length + expenseRows.length}</strong>
          </div>
        </div>

        {/* Tab Toggle + Export */}
        <div className="ledger-topbar">
          <div className="ledger-tab-row">
            <button
              className={`ledger-tab tab-income ${activeTab === 'income' ? 'active' : ''}`}
              onClick={() => setActiveTab('income')}>
              💚 Income
              <span className="ledger-tab-count">{incomeRows.length}</span>
            </button>
            <button
              className={`ledger-tab tab-expense ${activeTab === 'expense' ? 'active' : ''}`}
              onClick={() => setActiveTab('expense')}>
              🔴 Expenses
              <span className="ledger-tab-count">{expenseRows.length}</span>
            </button>
          </div>

          <button
            className={`ledger-export-btn ${exporting ? 'exporting' : ''}`}
            onClick={handleExport}
            disabled={exporting || (activeTab === 'income' ? filteredIncome.length === 0 : filteredExpense.length === 0)}>
            {exporting
              ? <><span className="export-spinner" />Exporting...</>
              : <>📊 Export to Excel</>
            }
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* INCOME PANEL */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'income' && (
          <div className="panel-section" key="income">
            <div className="ledger-section-title">💚 Income Details — All Receipts</div>

            {/* Filters */}
            <div className="ledger-filters-row">
              <div className="ledger-filter-field" style={{ flex: 1, minWidth: 200 }}>
                <label>🔍 Search</label>
                <input
                  className="ledger-filter-input"
                  placeholder="Client, project, ref no…"
                  value={incomeSearch}
                  onChange={e => setIncomeSearch(e.target.value)}
                />
              </div>
              <div className="ledger-filter-field">
                <label>📅 From Date</label>
                <input
                  className="ledger-filter-input"
                  type="date"
                  value={incomeDateFrom}
                  onChange={e => setIncomeDateFrom(e.target.value)}
                />
              </div>
              <div className="ledger-filter-field">
                <label>📅 To Date</label>
                <input
                  className="ledger-filter-input"
                  type="date"
                  value={incomeDateTo}
                  onChange={e => setIncomeDateTo(e.target.value)}
                />
              </div>
              <div className="ledger-filter-field">
                <label>👤 Filter by Client</label>
                <select
                  className="ledger-filter-select"
                  value={incomeClient}
                  onChange={e => setIncomeClient(e.target.value)}>
                  <option value="">All Clients</option>
                  {clients.map(c => (
                    <option key={c._id} value={c._id}>{c.clientCode} — {c.name}</option>
                  ))}
                </select>
              </div>
              {incomeHasFilter && (
                <button className="ledger-filter-clear" onClick={clearIncomeFilters}>
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Mini Stats */}
            <div className="ledger-mini-stats">
              <div className="ledger-mini-card lmc-total">
                <span>Receipts</span>
                <strong>{filteredIncome.length}</strong>
              </div>
              <div className="ledger-mini-card lmc-income">
                <span>Total Income</span>
                <strong>₹{filteredIncome.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="ledger-mini-card lmc-clients">
                <span>Unique Clients</span>
                <strong>{new Set(filteredIncome.map(r => r.clientId).filter(Boolean)).size}</strong>
              </div>
              <div className="ledger-mini-card lmc-avg">
                <span>Avg Receipt</span>
                <strong>
                  ₹{filteredIncome.length
                    ? Math.round(filteredIncome.reduce((s, r) => s + r.amount, 0) / filteredIncome.length).toLocaleString('en-IN')
                    : 0}
                </strong>
              </div>
            </div>

            {incomeHasFilter && (
              <div className="ledger-results-badge">
                Showing <strong>{filteredIncome.length}</strong> of <strong>{incomeRows.length}</strong> records
              </div>
            )}

            {/* Table or Empty State */}
            {filteredIncome.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💚</div>
                <p>No income records found{incomeHasFilter ? ' for the selected filters.' : '.'}</p>
              </div>
            ) : (
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th className="col-sno">#</th>
                      <th>Date</th>
                      <th>Mode</th>
                      <th>Ref No</th>
                      <th>Client Name</th>
                      <th>Project / Category</th>
                      <th>Invoice Ref</th>
                      <th>Payment Mode</th>
                      <th className="col-amt">Amount (₹)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncome.map((row, idx) => (
                      <tr key={row.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td className="col-sno">{idx + 1}</td>
                        <td className="col-date">{formatDate(row.date)}</td>
                        <td><span className="type-badge-income">{row.mode}</span></td>
                        <td><span className="ledger-ref-tag ref-income">{row.refNo}</span></td>
                        <td>
                          <div className="entity-name">{row.entityName}</div>
                          {row.clientCode && <div className="entity-sub">{row.clientCode}</div>}
                        </td>
                        <td className="col-category">{row.category}</td>
                        <td className="col-desc">{row.description}</td>
                        <td><span className="method-badge">{row.paymentMode}</span></td>
                        <td className="income-amt">₹{row.amount.toLocaleString('en-IN')}</td>
                        <td>{statusBadge(row.invoiceStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="ledger-total-row income-total-row">
                      <td colSpan={8} className="total-label">
                        Total Income — {filteredIncome.length} receipts
                      </td>
                      <td className="total-amt income-total-amt">
                        ₹{filteredIncome.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* EXPENSE PANEL */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'expense' && (
          <div className="panel-section" key="expense">
            <div className="ledger-section-title">🔴 Expense Details — Vouchers & Labour</div>

            {/* Filters */}
            <div className="ledger-filters-row">
              <div className="ledger-filter-field" style={{ flex: 1, minWidth: 200 }}>
                <label>🔍 Search</label>
                <input
                  className="ledger-filter-input"
                  placeholder="Name, ref no, description, site…"
                  value={expenseSearch}
                  onChange={e => setExpenseSearch(e.target.value)}
                />
              </div>
              <div className="ledger-filter-field">
                <label>📅 From Date</label>
                <input
                  className="ledger-filter-input"
                  type="date"
                  value={expenseDateFrom}
                  onChange={e => setExpenseDateFrom(e.target.value)}
                />
              </div>
              <div className="ledger-filter-field">
                <label>📅 To Date</label>
                <input
                  className="ledger-filter-input"
                  type="date"
                  value={expenseDateTo}
                  onChange={e => setExpenseDateTo(e.target.value)}
                />
              </div>
              <div className="ledger-filter-field">
                <label>🏷️ Expense Type</label>
                <div className="expense-type-tabs">
                  {[
                    { key: 'All',     label: `All (${expenseRows.length})` },
                    { key: 'Voucher', label: `🗂️ Vouchers (${voucherCount})` },
                    { key: 'Labour',  label: `👷 Labour (${labourCount})` },
                  ].map(t => (
                    <button
                      key={t.key}
                      className={`expense-type-tab ${expenseType === t.key ? 'active' : ''}`}
                      onClick={() => setExpenseType(t.key)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {expenseHasFilter && (
                <button className="ledger-filter-clear" onClick={clearExpenseFilters}>
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Mini Stats */}
            <div className="ledger-mini-stats">
              <div className="ledger-mini-card lmc-total">
                <span>Total Entries</span>
                <strong>{filteredExpense.length}</strong>
              </div>
              <div className="ledger-mini-card lmc-expense">
                <span>Total Paid Out</span>
                <strong>₹{filteredExpense.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="ledger-mini-card lmc-voucher">
                <span>Vouchers</span>
                <strong>{filteredExpense.filter(r => r.mode === 'Voucher').length}</strong>
              </div>
              <div className="ledger-mini-card lmc-labour">
                <span>Labour</span>
                <strong>{filteredExpense.filter(r => r.mode === 'Labour').length}</strong>
              </div>
            </div>

            {expenseHasFilter && (
              <div className="ledger-results-badge">
                Showing <strong>{filteredExpense.length}</strong> of <strong>{expenseRows.length}</strong> records
              </div>
            )}

            {/* Table or Empty State */}
            {filteredExpense.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔴</div>
                <p>No expense records found{expenseHasFilter ? ' for the selected filters.' : '.'}</p>
              </div>
            ) : (
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th className="col-sno">#</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Ref No</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Description / Site</th>
                      <th>Payment Mode</th>
                      <th className="col-amt">Paid Amt (₹)</th>
                      <th className="col-amt">Total Amt (₹)</th>
                      <th className="col-amt">Balance (₹)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpense.map((row, idx) => (
                      <tr key={`${row.mode}-${row.id}`} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td className="col-sno">{idx + 1}</td>
                        <td className="col-date">{formatDate(row.date)}</td>
                        <td>
                          {row.mode === 'Voucher'
                            ? <span className="type-badge-expense">🗂️ Voucher</span>
                            : <span className="type-badge-labour">👷 Labour</span>
                          }
                        </td>
                        <td>
                          <span className={`ledger-ref-tag ${row.mode === 'Voucher' ? 'ref-expense' : 'ref-labour'}`}>
                            {row.refNo}
                          </span>
                        </td>
                        <td>
                          <div className="entity-name">{row.entityName}</div>
                          {row.mode === 'Voucher' && row.receiverType && (
                            <div className="entity-sub">{row.receiverType}</div>
                          )}
                          {row.mode === 'Labour' && (
                            <div className="entity-sub">
                              ₹{row.dailyWage}/day × {row.daysWorked} days
                            </div>
                          )}
                        </td>
                        <td className="col-category">{row.category}</td>
                        <td className="col-desc">{row.description}</td>
                        <td>
                          {row.paymentMode !== '—'
                            ? <span className="method-badge">{row.paymentMode}</span>
                            : <span className="col-muted">—</span>
                          }
                        </td>
                        <td className="expense-amt">₹{row.amount.toLocaleString('en-IN')}</td>
                        <td className="col-total-amt">₹{Number(row.totalAmount).toLocaleString('en-IN')}</td>
                        <td className={row.balance > 0 ? 'due-cell' : 'zero-cell'}>
                          ₹{Number(row.balance).toLocaleString('en-IN')}
                        </td>
                        <td>{statusBadge(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="ledger-total-row expense-total-row">
                      <td colSpan={8} className="total-label">
                        Total Expense — {filteredExpense.length} entries
                      </td>
                      <td className="total-amt expense-total-amt">
                        ₹{filteredExpense.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AccountLedgerPage;