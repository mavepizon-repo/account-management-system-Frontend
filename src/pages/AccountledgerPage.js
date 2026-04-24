import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';
import '../styles/AccountLedgerPage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ════════════════════════════════════════════════════════════
   EXCEL EXPORT UTILITY — SheetJS (xlsx) via CDN
   Produces a real .xlsx with:
   - Company header row (merged, bold, large)
   - Address row (merged, italic)
   - Report title row (merged, bold, coloured)
   - Filter summary row
   - Column headers (bold, background fill)
   - Data rows (alternating light fill)
   - Total footer row (bold, coloured)
   - Auto column widths
════════════════════════════════════════════════════════════ */

const COMPANY_NAME = 'DESIGN ART (INTERIOR & EXTERIOR SOLUTION)';
const COMPANY_ADDR = '5-6, Indria Nagar, PM Samy Colony, Ratinapuri, Gandhipuram, Coimbatore 641012 | Ph: +91 9677731326 | GST: 33BNCPP2332Q1ZT';

// Load SheetJS dynamically
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

/**
 * exportLedgerExcel
 * @param {'income'|'expense'} type
 * @param {Array} rows  — filteredIncome or filteredExpense
 * @param {Object} meta — { totalIncome, totalExpense, filterDesc }
 */
async function exportLedgerExcel(type, rows, meta) {
  const XLSX = await loadSheetJS();

  const isIncome = type === 'income';
  const sheetTitle = isIncome ? 'INCOME LEDGER' : 'EXPENSE LEDGER';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  /* ── Column definitions ── */
  const incomeColumns = [
    { key: 'sno',         label: '#',               width: 5  },
    { key: 'date',        label: 'Date',             width: 14 },
    { key: 'mode',        label: 'Mode',             width: 12 },
    { key: 'refNo',       label: 'Ref No',           width: 16 },
    { key: 'entityName',  label: 'Client Name',      width: 24 },
    { key: 'clientCode',  label: 'Client Code',      width: 14 },
    { key: 'category',    label: 'Project',          width: 22 },
    { key: 'description', label: 'Invoice Ref',      width: 20 },
    { key: 'paymentMode', label: 'Payment Mode',     width: 15 },
    { key: 'amount',      label: 'Amount (₹)',       width: 16 },
    { key: 'invoiceStatus', label: 'Invoice Status', width: 15 },
  ];

  const expenseColumns = [
    { key: 'sno',         label: '#',               width: 5  },
    { key: 'date',        label: 'Date',             width: 14 },
    { key: 'mode',        label: 'Type',             width: 12 },
    { key: 'refNo',       label: 'Ref No',           width: 16 },
    { key: 'entityName',  label: 'Name',             width: 24 },
    { key: 'category',    label: 'Category',         width: 20 },
    { key: 'description', label: 'Description/Site', width: 24 },
    { key: 'paymentMode', label: 'Payment Mode',     width: 15 },
    { key: 'amount',      label: 'Paid Amount (₹)',  width: 16 },
    { key: 'totalAmount', label: 'Total Amount (₹)', width: 16 },
    { key: 'balance',     label: 'Balance (₹)',      width: 14 },
    { key: 'status',      label: 'Status',           width: 12 },
  ];

  const columns = isIncome ? incomeColumns : expenseColumns;
  const colCount = columns.length;
  const lastColLetter = XLSX.utils.encode_col(colCount - 1);

  /* ── Build AOA (Array of Arrays) ── */
  const aoa = [];

  // Row 1 — Company name
  aoa.push([COMPANY_NAME, ...Array(colCount - 1).fill('')]);
  // Row 2 — Address
  aoa.push([COMPANY_ADDR, ...Array(colCount - 1).fill('')]);
  // Row 3 — blank
  aoa.push(Array(colCount).fill(''));
  // Row 4 — Report title
  aoa.push([`${sheetTitle} — Exported on ${today}`, ...Array(colCount - 1).fill('')]);
  // Row 5 — Filter description
  aoa.push([meta.filterDesc || 'All records', ...Array(colCount - 1).fill('')]);
  // Row 6 — blank
  aoa.push(Array(colCount).fill(''));
  // Row 7 — Column headers
  aoa.push(columns.map(c => c.label));

  const dataStartRow = aoa.length + 1; // 1-indexed Excel row

  // Data rows
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

  // Blank row before totals
  aoa.push(Array(colCount).fill(''));

  // Total row
  const totalLabel = isIncome
    ? `TOTAL INCOME (${rows.length} receipts)`
    : `TOTAL EXPENSE (${rows.length} entries)`;
  const totalRow = Array(colCount).fill('');
  totalRow[colCount - (isIncome ? 2 : 4)] = totalLabel;
  totalRow[colCount - (isIncome ? 1 : 4) + (isIncome ? 0 : 0)] = '';

  // Put total in the amount column
  const amtColIdx = columns.findIndex(c => c.key === 'amount');
  const totalRow2 = Array(colCount).fill('');
  totalRow2[0] = totalLabel;
  totalRow2[amtColIdx] = isIncome ? meta.totalIncome : meta.totalExpense;
  aoa.push(totalRow2);

  /* ── Create worksheet ── */
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  /* ── Column widths ── */
  ws['!cols'] = columns.map(c => ({ wch: c.width }));

  /* ── Merges ── */
  ws['!merges'] = [
    // Company name spans all columns — row 1
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    // Address — row 2
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    // Title — row 4
    { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
    // Filter desc — row 5
    { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } },
    // Total row label spans first (amtColIdx) cols
    { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: amtColIdx - 1 } },
  ];

  /* ── Cell styles ── */
  // Helper: set style on a cell ref
  const setStyle = (cellRef, style) => {
    if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
    ws[cellRef].s = style;
  };

  // Company name style
  const companyStyle = {
    font:      { bold: true, sz: 14, color: { rgb: '1a2560' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill:      { fgColor: { rgb: 'dce8ff' }, patternType: 'solid' },
  };
  setStyle('A1', companyStyle);

  // Address style
  const addrStyle = {
    font:      { italic: true, sz: 9, color: { rgb: '5a6a8a' } },
    alignment: { horizontal: 'center', wrapText: true },
    fill:      { fgColor: { rgb: 'dce8ff' }, patternType: 'solid' },
  };
  setStyle('A2', addrStyle);

  // Title style
  const titleFill = isIncome ? 'c8f7e0' : 'ffc8d4';
  const titleColor = isIncome ? '036b4e' : 'c93360';
  const titleStyle = {
    font:      { bold: true, sz: 13, color: { rgb: titleColor } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill:      { fgColor: { rgb: titleFill }, patternType: 'solid' },
  };
  setStyle('A4', titleStyle);

  // Filter desc style
  const filterStyle = {
    font:      { italic: true, sz: 10, color: { rgb: '666699' } },
    alignment: { horizontal: 'center' },
    fill:      { fgColor: { rgb: 'f5f7ff' }, patternType: 'solid' },
  };
  setStyle('A5', filterStyle);

  // Header row style (row 7 = index 6)
  const headerFill = isIncome ? '06d6a0' : 'e11d48';
  const headerStyle = {
    font:      { bold: true, sz: 10, color: { rgb: 'ffffff' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill:      { fgColor: { rgb: headerFill }, patternType: 'solid' },
    border: {
      bottom: { style: 'medium', color: { rgb: 'ffffff' } },
    },
  };
  for (let c = 0; c < colCount; c++) {
    const ref = XLSX.utils.encode_cell({ r: 6, c });
    if (!ws[ref]) ws[ref] = { v: columns[c].label, t: 's' };
    ws[ref].s = headerStyle;
  }

  // Data rows — alternating fill + number formatting
  const evenFill = isIncome ? 'f0fff8' : 'fff5f7';
  const oddFill  = 'ffffff';

  rows.forEach((row, idx) => {
    const excelRow = 6 + 1 + idx; // 0-indexed: header at r=6, data starts at r=7
    const isEven   = idx % 2 === 0;
    const bgFill   = isEven ? evenFill : oddFill;

    for (let c = 0; c < colCount; c++) {
      const ref = XLSX.utils.encode_cell({ r: excelRow, c });
      if (!ws[ref]) continue;

      const colKey = columns[c].key;
      const isAmtCol = ['amount', 'totalAmount', 'balance'].includes(colKey);

      ws[ref].s = {
        font:      { sz: 10 },
        alignment: { horizontal: isAmtCol ? 'right' : c === 0 ? 'center' : 'left', vertical: 'center' },
        fill:      { fgColor: { rgb: bgFill }, patternType: 'solid' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'e0e8f0' } },
        },
      };

      // Format numbers
      if (isAmtCol && typeof ws[ref].v === 'number') {
        ws[ref].t = 'n';
        ws[ref].z = '#,##0.00';
        // Colour balance red if > 0
        if (colKey === 'balance' && ws[ref].v > 0) {
          ws[ref].s.font = { ...ws[ref].s.font, color: { rgb: 'c93360' }, bold: true };
        }
        if (colKey === 'amount') {
          ws[ref].s.font = { ...ws[ref].s.font, color: { rgb: isIncome ? '036b4e' : 'c93360' }, bold: true };
        }
      }
    }
  });

  // Total footer row
  const totalRowIdx = aoa.length - 1;
  const totalStyle = {
    font:      { bold: true, sz: 11, color: { rgb: isIncome ? '036b4e' : 'c93360' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    fill:      { fgColor: { rgb: isIncome ? 'e6fdf6' : 'fff4f7' }, patternType: 'solid' },
    border: {
      top: { style: 'medium', color: { rgb: isIncome ? 'a0f0d8' : 'ffc8d4' } },
    },
  };
  for (let c = 0; c < colCount; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = totalStyle;
    if (c === amtColIdx && typeof ws[ref].v === 'number') {
      ws[ref].t = 'n';
      ws[ref].z = '#,##0.00';
    }
    if (c === 0) {
      ws[ref].s = { ...totalStyle, alignment: { horizontal: 'left' } };
    }
  }

  /* ── Row heights ── */
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 28 }; // company name
  ws['!rows'][1] = { hpt: 22 }; // address
  ws['!rows'][3] = { hpt: 24 }; // title
  ws['!rows'][6] = { hpt: 20 }; // header
  for (let i = 7; i < 7 + rows.length; i++) {
    ws['!rows'][i] = { hpt: 18 };
  }

  /* ── Workbook ── */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isIncome ? 'Income Ledger' : 'Expense Ledger');

  /* ── Download ── */
  const fileName = `DesignArt_${isIncome ? 'Income' : 'Expense'}_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
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

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [rRes, cRes, vRes, lRes] = await Promise.all([
        fetch(`${API}/receipt/getall`),
        fetch(`${API}/client/getall`),
        fetch(`${API}/vouchers/getall`),
        fetch(`${API}/labours/getall`),
      ]);
      const [rData, cData, vData, lData] = await Promise.all([
        rRes.json(), cRes.json(), vRes.json(), lRes.json(),
      ]);
      setReceipts(rData.receipts || rData || []);
      setClients(Array.isArray(cData) ? cData : (cData.data || []));
      setVouchers(vData.vouchers || vData || []);
      setLabours(lData.data || []);
    } catch {
      showToast('Failed to load ledger data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── Income rows ─────────────────────────────────────────── */
  const incomeRows = useMemo(() => receipts.map(r => ({
    id:            r._id,
    refNo:         r.receiptNumber || '—',
    mode:          'Receipt',
    date:          r.paymentDate?.split('T')[0] || '—',
    category:      r.invoice?.project || '—',
    entityName:    r.client?.name || '—',
    clientCode:    r.client?.clientCode || '',
    clientId:      r.client?._id || r.client || '',
    description:   r.invoice?.invoiceNumber ? `Invoice: ${r.invoice.invoiceNumber}` : '—',
    paymentMode:   r.paymentMethod || 'Cash',
    amount:        r.amountPaid || 0,
    invoiceTotal:  r.invoice?.grandTotal || 0,
    invoiceStatus: r.invoice?.paymentStatus || '—',
  })), [receipts]);

  /* ── Expense rows ────────────────────────────────────────── */
  const expenseRows = useMemo(() => {
    const vRows = vouchers.map(v => {
      const a      = parseFloat(v.amount)     || 0;
      const p      = parseFloat(v.paidAmount) || 0;
      const status = p <= 0 ? 'Unpaid' : p >= a ? 'Paid' : 'Partial';
      return {
        id:           v._id,
        refNo:        v.voucherNumber || '—',
        mode:         'Voucher',
        date:         v.date?.split('T')[0] || '—',
        category:     v.receiverType === 'vendor' ? 'Vendor Payment' : 'Subcontractor Payment',
        entityName:   v.receiverName || '—',
        description:  v.purpose || '—',
        paymentMode:  v.paymentMethod === 'cash'   ? 'Cash'
                    : v.paymentMethod === 'online' ? 'Online'
                    : (v.paymentMethod || '—'),
        amount:       p,
        totalAmount:  a,
        balance:      v.balanceAmount ?? (a - p),
        status,
        receiverType: v.receiverType || '—',
      };
    });

    const lRows = labours.map(l => {
      const totalSalary = parseFloat(l.totalSalary) || 0;
      const advance     = parseFloat(l.advance)     || 0;
      const balance     = parseFloat(l.balance) !== undefined ? parseFloat(l.balance) : (totalSalary - advance);
      const status      = advance <= 0 ? 'Unpaid' : advance >= totalSalary ? 'Paid' : 'Partial';
      return {
        id:          l._id,
        refNo:       l.labourId || '—',
        mode:        'Labour',
        date:        l.updatedAt?.split('T')[0] || l.createdAt?.split('T')[0] || '—',
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

    return [...vRows, ...lRows].sort((a, b) => {
      if (a.date === '—' && b.date === '—') return 0;
      if (a.date === '—') return 1;
      if (b.date === '—') return -1;
      return b.date.localeCompare(a.date);
    });
  }, [vouchers, labours]);

  /* ── Filtered Income ─────────────────────────────────────── */
  const filteredIncome = useMemo(() => {
    let rows = incomeRows;
    if (incomeSearch)
      rows = rows.filter(r =>
        r.entityName.toLowerCase().includes(incomeSearch.toLowerCase()) ||
        r.refNo.toLowerCase().includes(incomeSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(incomeSearch.toLowerCase()) ||
        r.description.toLowerCase().includes(incomeSearch.toLowerCase())
      );
    if (incomeDateFrom) rows = rows.filter(r => r.date >= incomeDateFrom);
    if (incomeDateTo)   rows = rows.filter(r => r.date <= incomeDateTo);
    if (incomeClient)   rows = rows.filter(r => r.clientId === incomeClient);
    return rows;
  }, [incomeRows, incomeSearch, incomeDateFrom, incomeDateTo, incomeClient]);

  /* ── Filtered Expense ────────────────────────────────────── */
  const filteredExpense = useMemo(() => {
    let rows = expenseRows;
    if (expenseType !== 'All') rows = rows.filter(r => r.mode === expenseType);
    if (expenseSearch)
      rows = rows.filter(r =>
        r.entityName.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        r.refNo.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        r.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(expenseSearch.toLowerCase())
      );
    if (expenseDateFrom) rows = rows.filter(r => r.date >= expenseDateFrom);
    if (expenseDateTo)   rows = rows.filter(r => r.date <= expenseDateTo);
    return rows;
  }, [expenseRows, expenseType, expenseSearch, expenseDateFrom, expenseDateTo]);

  /* ── Totals ──────────────────────────────────────────────── */
  const totalIncome  = filteredIncome.reduce((s, r) => s + r.amount, 0);
  const totalExpense = filteredExpense.reduce((s, r) => s + r.amount, 0);
  const netBalance   = totalIncome - totalExpense;

  /* ── Excel Export ────────────────────────────────────────── */
  const handleExport = async () => {
    try {
      setExporting(true);
      const isIncome = activeTab === 'income';
      const rows     = isIncome ? filteredIncome : filteredExpense;

      if (rows.length === 0) {
        showToast('No data to export', 'error');
        return;
      }

      // Build filter description string
      const parts = [];
      if (isIncome) {
        if (incomeSearch)    parts.push(`Search: "${incomeSearch}"`);
        if (incomeDateFrom)  parts.push(`From: ${incomeDateFrom}`);
        if (incomeDateTo)    parts.push(`To: ${incomeDateTo}`);
        if (incomeClient) {
          const cl = clients.find(c => c._id === incomeClient);
          if (cl) parts.push(`Client: ${cl.name}`);
        }
      } else {
        if (expenseType !== 'All') parts.push(`Type: ${expenseType}`);
        if (expenseSearch)   parts.push(`Search: "${expenseSearch}"`);
        if (expenseDateFrom) parts.push(`From: ${expenseDateFrom}`);
        if (expenseDateTo)   parts.push(`To: ${expenseDateTo}`);
      }
      const filterDesc = parts.length > 0
        ? `Filters applied — ${parts.join(' | ')}`
        : `All records — No filters applied`;

      await exportLedgerExcel(activeTab, rows, {
        totalIncome,
        totalExpense,
        filterDesc,
      });

      showToast(`📊 ${isIncome ? 'Income' : 'Expense'} Ledger exported successfully!`);
    } catch (err) {
      showToast('Export failed. Please try again.', 'error');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  const statusBadge = (s) => {
    const map = {
      Paid: 'status-paid', paid: 'status-paid',
      Partial: 'status-partial', partial: 'status-partial',
      Unpaid: 'status-pending', unpaid: 'status-pending',
    };
    const label = s ? (s.charAt(0).toUpperCase() + s.slice(1)) : '—';
    return <span className={`status-badge ${map[s] || 'status-pending'}`}>{label}</span>;
  };

  const clearIncomeFilters  = () => {
    setIncomeSearch(''); setIncomeDateFrom(''); setIncomeDateTo(''); setIncomeClient('');
  };
  const clearExpenseFilters = () => {
    setExpenseSearch(''); setExpenseDateFrom(''); setExpenseDateTo(''); setExpenseType('All');
  };

  const incomeHasFilter  = incomeSearch || incomeDateFrom || incomeDateTo || incomeClient;
  const expenseHasFilter = expenseSearch || expenseDateFrom || expenseDateTo || expenseType !== 'All';

  const voucherCount = expenseRows.filter(r => r.mode === 'Voucher').length;
  const labourCount  = expenseRows.filter(r => r.mode === 'Labour').length;

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        {/* ── Page Header ── */}
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">📒 Account Ledger</h1>
          <span className="entity-page-badge" style={{ background: '#eef1ff', color: 'var(--primary)', border: '1px solid #c8d4ff' }}>
            Master Ledger
          </span>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ── Summary Chips ── */}
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

        {/* ── Tab Toggle + Export ── */}
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
            disabled={exporting}>
            {exporting
              ? <><span className="export-spinner" />Exporting...</>
              : <>📊 Export to Excel</>
            }
          </button>
        </div>

        {/* ══ INCOME PANEL ══ */}
        {activeTab === 'income' && (
          <div className="panel-section" key="income">
            <div className="ledger-section-title">💚 Income Details — All Receipts</div>

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
                <input className="ledger-filter-input" type="date"
                  value={incomeDateFrom} onChange={e => setIncomeDateFrom(e.target.value)} />
              </div>
              <div className="ledger-filter-field">
                <label>📅 To Date</label>
                <input className="ledger-filter-input" type="date"
                  value={incomeDateTo} onChange={e => setIncomeDateTo(e.target.value)} />
              </div>
              <div className="ledger-filter-field">
                <label>👤 Filter by Client</label>
                <select className="ledger-filter-select" value={incomeClient}
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

            {/* Mini stat cards */}
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

            {/* Results badge */}
            {incomeHasFilter && (
              <div className="ledger-results-badge">
                Showing <strong>{filteredIncome.length}</strong> of <strong>{incomeRows.length}</strong> records
              </div>
            )}

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
                        <td className="col-date">{row.date}</td>
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

        {/* ══ EXPENSE PANEL ══ */}
        {activeTab === 'expense' && (
          <div className="panel-section" key="expense">
            <div className="ledger-section-title">🔴 Expense Details — Vouchers & Labour</div>

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
                <input className="ledger-filter-input" type="date"
                  value={expenseDateFrom} onChange={e => setExpenseDateFrom(e.target.value)} />
              </div>
              <div className="ledger-filter-field">
                <label>📅 To Date</label>
                <input className="ledger-filter-input" type="date"
                  value={expenseDateTo} onChange={e => setExpenseDateTo(e.target.value)} />
              </div>
              <div className="ledger-filter-field">
                <label>🏷️ Expense Type</label>
                <div className="expense-type-tabs">
                  {[
                    { key: 'All',     label: `All (${expenseRows.length})` },
                    { key: 'Voucher', label: `🗂️ Vouchers (${voucherCount})` },
                    { key: 'Labour',  label: `👷 Labour (${labourCount})` },
                  ].map(t => (
                    <button key={t.key}
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

            {/* Mini stat cards */}
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
                        <td className="col-date">{row.date}</td>
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