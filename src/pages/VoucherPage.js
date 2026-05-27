import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/VoucherPage.css';
import '../styles/SearchableDropdown.css';

// ══════════════════════════════════════════════════════════
// BACKEND FIELD NAME FIXES (critical):
//
// 1. Voucher CREATE/UPDATE: backend expects "amountInVoucher" NOT "amount"
//    - createVoucher: req.body.amountInVoucher
//    - updateVoucher: req.body.amountInVoucher
//
// 2. Voucher GET ALL: backend returns { count, data: [] }
//    - Frontend must read data.data or data (not plain array)
//
// 3. Voucher model stores: amountInVoucher, remainingAmount (NOT amount)
//    - Display uses v.amountInVoucher
//
// 4. Advance check: backend BLOCKS advance if pending work/purchase exists.
//    Frontend now shows a clear warning before submit.
//
// 5. WorkSubcontract: uses cumulativePaidAmount and balanceAmount (NOT paidAmount)
//
// 6. DELETE: backend BLOCKS delete if voucher is connected to purchase/work.
//    Only advance vouchers (no appliedPurchases/appliedWorkSubcontracts) can be deleted.
//
// 7. UPDATE: backend BLOCKS amount change if voucher is connected to purchase/work.
// ══════════════════════════════════════════════════════════

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const RECEIVER_TYPES  = ['vendor', 'subcontractor'];
const PAYMENT_METHODS = ['cash', 'online'];

const VENDOR_MODES = ['advance', 'against_bill'];
const SUB_MODES    = ['advance', 'against_work'];

const COMPANY = {
  name:    'DESIGN ART (INTERIOR & EXTERIOR SOLUTION)',
  address: '5-6, Indria Nagar, PM Samy Colony, Ratinapuri, Gandhipuram, Coimbatore 641012',
  phone:   '+91 9677731326',
  gst:     '33BNCPP2332Q1ZT',
};

const emptyForm = {
  receiverType:      'vendor',
  voucherMode:       'advance',
  receiverId:        '',
  receiverName:      '',
  purchaseId:        '',
  workSubcontractId: '',
  purpose:           '',
  amount:            '',   // local state field — sent as amountInVoucher to backend
  paymentMethod:     'cash',
};

// ── Excel Export ──────────────────────────────────────────
function exportVouchersToExcel(voucherList, filterLabel) {
  const wb   = XLSX.utils.book_new();
  const rows = [];
  rows.push([COMPANY.name, '', '', '', '', '', '', '']);
  rows.push([`Address: ${COMPANY.address}`, '', '', '', '', `Ph: ${COMPANY.phone}`, '', `GST: ${COMPANY.gst}`]);
  rows.push(['', '', '', '', '', '', '', '']);
  rows.push([`Voucher Report — ${filterLabel}`, '', '', '', '', '', '', '']);
  rows.push([`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, '', '', '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '', '']);
  rows.push(['Voucher No', 'Receiver Type', 'Receiver Name', 'Purpose', 'Amount (₹)', 'Payment Method', 'Date', 'PDF URL']);

  voucherList.forEach(v => {
    rows.push([
      v.voucherNumber || '',
      v.receiverType  || '',
      getReceiverName(v) || '',
      v.purpose       || '',
      // FIX: backend stores amountInVoucher not amount
      parseFloat(v.amountInVoucher || v.amount || 0),
      v.paymentMethod || '',
      v.date ? v.date.split('T')[0] : '',
      v.pdfUrl || '',
    ]);
  });

  rows.push(['', '', '', '', '', '', '', '']);
  const totalAmt = voucherList.reduce((s, v) => s + (parseFloat(v.amountInVoucher || v.amount || 0)), 0);
  rows.push(['TOTAL', '', '', '', totalAmt, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 34 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 40 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 7 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
  const filename = `Vouchers_${filterLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── getReceiverName ───────────────────────────────────────
function getReceiverName(voucher) {
  if (voucher.receiver && typeof voucher.receiver === 'object' && voucher.receiver.name) {
    return voucher.receiver.name;
  }
  // FIX: backend populates voucher.vendor and voucher.subcontract directly
  if (voucher.receiverType === 'Vendor') {
    if (voucher.vendor && typeof voucher.vendor === 'object' && voucher.vendor.name) return voucher.vendor.name;
    const v = voucher.appliedPurchases?.[0]?.purchase?.vendor;
    if (v && typeof v === 'object' && v.name) return v.name;
  }
  if (voucher.receiverType === 'Subcontract') {
    if (voucher.subcontract && typeof voucher.subcontract === 'object' && voucher.subcontract.name) return voucher.subcontract.name;
    const s = voucher.appliedWorkSubcontracts?.[0]?.workSubcontract?.subcontract;
    if (s && typeof s === 'object' && s.name) return s.name;
  }
  return '';
}

// ── isAdvanceVoucher ──────────────────────────────────────
// FIX: backend uses appliedPurchases[] and appliedWorkSubcontracts[]
// An advance voucher has empty arrays for both
function isAdvanceVoucher(voucher) {
  const hasPurchase     = voucher.appliedPurchases && voucher.appliedPurchases.length > 0;
  const hasWorkSub      = voucher.appliedWorkSubcontracts && voucher.appliedWorkSubcontracts.length > 0;
  return !hasPurchase && !hasWorkSub;
}

// ── isConnectedVoucher ────────────────────────────────────
// Connected vouchers cannot be deleted or have amount changed
function isConnectedVoucher(voucher) {
  return !isAdvanceVoucher(voucher);
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
function VoucherPage({ onLogout }) {
  const navigate = useNavigate();

  const [vouchers,         setVouchers]         = useState([]);
  const [vendors,          setVendors]          = useState([]);
  const [subs,             setSubs]             = useState([]);
  const [purchases,        setPurchases]        = useState([]);
  const [workSubcontracts, setWorkSubcontracts] = useState([]);
  const [activePanel,      setPanel]            = useState(null);
  const [toast,            setToast]            = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [statusFilter,     setStatusFilter]     = useState('All');
  const [searchText,       setSearchText]       = useState('');

  const [addForm,     setAddForm]     = useState(emptyForm);
  const [updateId,    setUpdateId]    = useState('');
  const [updateFound, setUpdateFound] = useState(null);
  const [updateForm,  setUpdateForm]  = useState(emptyForm);
  const [deleteId,    setDeleteId]    = useState('');
  const [deleteFound, setDeleteFound] = useState(null);
  const [selectedId,  setSelectedId]  = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch ──────────────────────────────────────────────
  // FIX: backend GET /api/vouchers/getall returns { count, data: [] }
  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/vouchers/getall`);
      const data = await res.json();
      // Backend returns { count, data: [...] }
      setVouchers(data.data || (Array.isArray(data) ? data : []));
    } catch { showToast('Failed to fetch vouchers', 'error'); }
    finally  { setLoading(false); }
  };

  const fetchVendors = async () => {
    try {
      const res  = await fetch(`${API}/vendor/getall`);
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  // FIX: backend GET /api/subcontract/getall returns { count, data: [] }
  const fetchSubs = async () => {
    try {
      const res  = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      setSubs(data.data || (Array.isArray(data) ? data : []));
    } catch {}
  };

  const fetchPurchases = async () => {
    try {
      const res  = await fetch(`${API}/purchase/all`);
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  // FIX: backend GET /api/workSubcontract/getall returns { count, data: [] }
  const fetchWorkSubcontracts = async () => {
    try {
      const res  = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      // Backend getAllWorks returns { count, data: [...] }
      setWorkSubcontracts(data.data || (Array.isArray(data) ? data : []));
    } catch {}
  };

  useEffect(() => {
    fetchVouchers();
    fetchVendors();
    fetchSubs();
    fetchPurchases();
    fetchWorkSubcontracts();
  }, []);

  // ── Remaining helpers ──────────────────────────────────
  const getPurchaseRemaining = (bill) =>
    Math.max(0, (bill.grandTotal || 0) - (bill.cumulativePaidAmount || 0));

  // FIX: WorkSubcontract uses balanceAmount (not balanceAmount from paidAmount calculation)
  const getWorkSubRemaining = (work) =>
    work.balanceAmount ?? Math.max(0, (work.grandTotal || work.totalAmount || 0) - (work.cumulativePaidAmount || 0));

  // ── Toggle panel ───────────────────────────────────────
  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateId(''); setUpdateFound(null); setUpdateForm(emptyForm);
    setDeleteId(''); setDeleteFound(null);
    setSelectedId(''); setStatusFilter('All'); setSearchText('');
  };

  // ── BUILD CREATE PAYLOAD ───────────────────────────────
  // FIX: backend expects "amountInVoucher" NOT "amount"
  function buildCreatePayload(form) {
    const payload = {
      receiverType:    form.receiverType === 'vendor' ? 'Vendor' : 'Subcontract',
      receiver:        form.receiverId,
      purpose:         form.purpose,
      amountInVoucher: parseFloat(form.amount),   // FIX: key name is amountInVoucher
      paymentMethod:   form.paymentMethod,
    };

    if (form.receiverType === 'vendor') {
      if (form.voucherMode === 'against_bill' && form.purchaseId) {
        payload.purchaseId = form.purchaseId;
      } else {
        payload.vendorId = form.receiverId;
      }
    } else {
      if (form.voucherMode === 'against_work' && form.workSubcontractId) {
        payload.workSubcontractId = form.workSubcontractId;
      } else {
        payload.subcontractId = form.receiverId;
      }
    }

    return payload;
  }

  // ── Handle receiver type change ────────────────────────
  const handleTypeChange = useCallback((type, setForm) => {
    setForm(prev => ({
      ...prev,
      receiverType:      type,
      voucherMode:       'advance',
      receiverId:        '',
      receiverName:      '',
      purchaseId:        '',
      workSubcontractId: '',
      purpose:           '',
      amount:            '',
    }));
  }, []);

  // ── Handle voucher mode change ─────────────────────────
  const handleModeChange = useCallback((mode, setForm) => {
    setForm(prev => ({
      ...prev,
      voucherMode:       mode,
      purchaseId:        '',
      workSubcontractId: '',
      purpose:           '',
      amount:            '',
    }));
  }, []);

  // ── Handle receiver selection ──────────────────────────
  const handleReceiverSelect = useCallback((id, currentForm, setForm) => {
    if (!id) {
      setForm(prev => ({
        ...prev,
        receiverId: '', receiverName: '',
        purchaseId: '', workSubcontractId: '',
        purpose: '', amount: '',
      }));
      return;
    }

    const list  = currentForm.receiverType === 'vendor' ? vendors : subs;
    const found = list.find(i => i._id === id);
    if (!found) return;

    setForm(prev => ({
      ...prev,
      receiverId:        id,
      receiverName:      found.name,
      purchaseId:        '',
      workSubcontractId: '',
      purpose:           '',
      amount:            '',
    }));
  }, [vendors, subs]);

  // ── Handle purchase bill selection ─────────────────────
  const handlePurchaseSelect = useCallback((purchaseId, setForm) => {
    const bill = purchases.find(p => p._id === purchaseId);
    if (!bill) return;
    const remaining = getPurchaseRemaining(bill);
    setForm(prev => ({
      ...prev,
      purchaseId,
      purpose: bill.subject
        ? `Payment for ${bill.subject}`
        : bill.sno ? `Payment for Purchase Bill ${bill.sno}` : 'Purchase Bill Payment',
      amount: remaining > 0 ? String(remaining) : String(bill.grandTotal || ''),
    }));
  }, [purchases]);

  // ── Handle work subcontract selection ─────────────────
  const handleWorkSubSelect = useCallback((workSubId, setForm) => {
    const work = workSubcontracts.find(w => w._id === workSubId);
    if (!work) return;
    const remaining = getWorkSubRemaining(work);
    setForm(prev => ({
      ...prev,
      workSubcontractId: workSubId,
      purpose: work.projectName
        ? `Payment for ${work.projectName}`
        : 'Work Subcontract Payment',
      amount: remaining > 0 ? String(remaining) : String(work.grandTotal || work.totalAmount || ''),
    }));
  }, [workSubcontracts]);

  // ── ADD ────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.receiverId) {
      showToast('Please select a receiver', 'error'); return;
    }
    if (addForm.receiverType === 'vendor' && addForm.voucherMode === 'against_bill' && !addForm.purchaseId) {
      showToast('Please select a purchase bill', 'error'); return;
    }
    if (addForm.receiverType === 'subcontractor' && addForm.voucherMode === 'against_work' && !addForm.workSubcontractId) {
      showToast('Please select a work subcontract', 'error'); return;
    }
    if (!addForm.purpose || !addForm.amount) {
      showToast('Purpose and Amount are required', 'error'); return;
    }
    if (parseFloat(addForm.amount) <= 0) {
      showToast('Amount must be greater than 0', 'error'); return;
    }

    try {
      setLoading(true);
      const payload = buildCreatePayload(addForm);
      const res = await fetch(`${API}/vouchers/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchVouchers();
        await fetchPurchases();
        await fetchWorkSubcontracts();
        setAddForm(emptyForm);
        showToast(`✅ Voucher ${data.voucher?.voucherNumber} generated!`);
      } else {
        // FIX: backend returns descriptive error for advance-when-pending-exists
        showToast(data.message || data.error || 'Failed to create voucher', 'error');
      }
    } catch (err) {
      showToast('Error creating voucher: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── UPDATE ─────────────────────────────────────────────
  const handleUpdateSelect = (vid) => {
    setUpdateId(vid);
    const found = vouchers.find(v => v._id === vid);
    if (!found) { setUpdateFound(null); setUpdateForm(emptyForm); return; }

    setUpdateFound(found);

    let receiverType = 'vendor';
    let voucherMode  = 'advance';
    let receiverId   = '';
    let receiverName = '';

    if (found.receiverType === 'Vendor') {
      receiverType = 'vendor';
      voucherMode  = isAdvanceVoucher(found) ? 'advance' : 'against_bill';
      // FIX: backend populates voucher.vendor directly
      if (found.vendor && typeof found.vendor === 'object') {
        receiverId = found.vendor._id; receiverName = found.vendor.name;
      } else if (typeof found.receiver === 'object' && found.receiver) {
        receiverId = found.receiver._id; receiverName = found.receiver.name || '';
      } else {
        receiverId = typeof found.receiver === 'string' ? found.receiver : '';
      }
    } else if (found.receiverType === 'Subcontract') {
      receiverType = 'subcontractor';
      voucherMode  = isAdvanceVoucher(found) ? 'advance' : 'against_work';
      // FIX: backend populates voucher.subcontract directly
      if (found.subcontract && typeof found.subcontract === 'object') {
        receiverId = found.subcontract._id; receiverName = found.subcontract.name;
      } else if (typeof found.receiver === 'object' && found.receiver) {
        receiverId = found.receiver._id; receiverName = found.receiver.name || '';
      } else {
        receiverId = typeof found.receiver === 'string' ? found.receiver : '';
      }
    }

    setUpdateForm({
      receiverType,
      voucherMode,
      receiverId,
      receiverName,
      purchaseId:        found.appliedPurchases?.[0]?.purchase?._id         || '',
      workSubcontractId: found.appliedWorkSubcontracts?.[0]?.workSubcontract?._id || '',
      purpose:           found.purpose       || '',
      // FIX: backend stores amountInVoucher not amount
      amount:            String(found.amountInVoucher || found.amount || ''),
      paymentMethod:     found.paymentMethod || 'cash',
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a voucher', 'error'); return; }
    if (!updateForm.purpose || !updateForm.amount) { showToast('Purpose and Amount are required', 'error'); return; }
    if (parseFloat(updateForm.amount) <= 0) { showToast('Amount must be greater than 0', 'error'); return; }

    // FIX: backend BLOCKS amount change for connected vouchers
    if (isConnectedVoucher(updateFound) && updateForm.amount !== String(updateFound.amountInVoucher || updateFound.amount)) {
      showToast('Amount cannot be changed for a connected voucher (linked to purchase/work). Only purpose and payment method can be updated.', 'error');
      return;
    }

    try {
      setLoading(true);
      // FIX: backend updateVoucher only accepts: date, purpose, notes, paymentMethod, amountInVoucher
      // It does NOT re-link purchases/works on update
      const payload = {
        purpose:         updateForm.purpose,
        paymentMethod:   updateForm.paymentMethod,
        // FIX: key name is amountInVoucher
        amountInVoucher: parseFloat(updateForm.amount),
      };

      const res = await fetch(`${API}/vouchers/update/${updateFound._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchVouchers();
        await fetchPurchases();
        await fetchWorkSubcontracts();
        showToast(`📝 Voucher ${updateFound.voucherNumber} updated!`);
        setUpdateFound(null); setUpdateId(''); setUpdateForm(emptyForm);
      } else {
        const data = await res.json();
        showToast(data.message || data.error || 'Failed to update voucher', 'error');
      }
    } catch (err) {
      showToast('Error updating voucher: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── DELETE ─────────────────────────────────────────────
  // FIX: backend BLOCKS delete if voucher is connected to purchase/work
  const handleDeleteSelect = (vid) => {
    setDeleteId(vid);
    setDeleteFound(vouchers.find(v => v._id === vid) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a voucher', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/vouchers/delete/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchVouchers();
        await fetchPurchases();
        await fetchWorkSubcontracts();
        showToast(`🗑️ Voucher ${deleteFound.voucherNumber} deleted!`, 'info');
        setDeleteFound(null); setDeleteId('');
      } else {
        const data = await res.json();
        showToast(data.message || data.error || 'Failed to delete voucher', 'error');
      }
    } catch (err) {
      showToast('Error deleting voucher: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered vouchers ──────────────────────────────────
  const filteredVouchers = useMemo(() => {
    let list = vouchers;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(v =>
        (v.voucherNumber || '').toLowerCase().includes(q) ||
        (getReceiverName(v) || '').toLowerCase().includes(q) ||
        (v.purpose || '').toLowerCase().includes(q) ||
        (v.receiverType || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      list = list.filter(v => (v.paymentMethod || 'cash') === statusFilter.toLowerCase());
    }
    return list;
  }, [vouchers, statusFilter, searchText]);

  const countAll    = vouchers.length;
  const countCash   = vouchers.filter(v => v.paymentMethod === 'cash').length;
  const countOnline = vouchers.filter(v => v.paymentMethod === 'online').length;

  const selectedVoucher = vouchers.find(v => v._id === selectedId);

  const selectedPurchaseBill = useMemo(() =>
    addForm.purchaseId ? purchases.find(p => p._id === addForm.purchaseId) || null : null,
  [addForm.purchaseId, purchases]);

  const selectedWorkSub = useMemo(() =>
    addForm.workSubcontractId ? workSubcontracts.find(w => w._id === addForm.workSubcontractId) || null : null,
  [addForm.workSubcontractId, workSubcontracts]);

  const excelFilterLabel = useMemo(() => {
    let label = statusFilter === 'All' ? 'All Vouchers' : `${statusFilter} Vouchers`;
    if (searchText.trim()) label += ` (Search: ${searchText.trim()})`;
    return label;
  }, [statusFilter, searchText]);

  // Filtered purchases for selected vendor (unpaid/partial only)
  const vendorBills = useMemo(() => {
    if (!addForm.receiverId || addForm.receiverType !== 'vendor') return [];
    return purchases.filter(p => {
      const v = p.vendor;
      if (!v) return false;
      const vid = typeof v === 'object' ? v._id : v;
      return vid === addForm.receiverId && p.paymentStatus !== 'Paid';
    });
  }, [addForm.receiverId, addForm.receiverType, purchases]);

  // Filtered work subcontracts for selected subcontractor (unpaid/partial only)
  const subWorks = useMemo(() => {
    if (!addForm.receiverId || addForm.receiverType !== 'subcontractor') return [];
    return workSubcontracts.filter(w => {
      const s = w.subcontract;
      if (!s) return false;
      const sid = typeof s === 'object' ? s._id : s;
      return sid === addForm.receiverId && w.paymentStatus !== 'Paid';
    });
  }, [addForm.receiverId, addForm.receiverType, workSubcontracts]);

  const receiverOptions = useMemo(() => {
    const list = addForm.receiverType === 'vendor' ? vendors : subs;
    return list.map(item => ({
      value: item._id,
      label: addForm.receiverType === 'vendor'
        ? `${item.vendorCode || ''} — ${item.name}`
        : `${item.subcontractCode || ''} — ${item.name}`,
    }));
  }, [addForm.receiverType, vendors, subs]);

  const updateReceiverOptions = useMemo(() => {
    const list = updateForm.receiverType === 'vendor' ? vendors : subs;
    return list.map(item => ({
      value: item._id,
      label: updateForm.receiverType === 'vendor'
        ? `${item.vendorCode || ''} — ${item.name}`
        : `${item.subcontractCode || ''} — ${item.name}`,
    }));
  }, [updateForm.receiverType, vendors, subs]);

  const voucherOptions = vouchers.map(v => ({
    value: v._id,
    // FIX: display amountInVoucher
    label: `${v.voucherNumber} — ${v.receiverType?.toUpperCase()} — ${getReceiverName(v)} — ₹${Number(v.amountInVoucher || v.amount || 0).toLocaleString('en-IN')}${isAdvanceVoucher(v) ? ' [ADVANCE]' : ''}`,
  }));

  const typeBadge = (type) => (
    <span className={`type-badge type-${type === 'Vendor' ? 'vendor' : 'subcontractor'}`}>
      {type === 'Vendor' ? '🛒 Vendor' : '🔧 Subcontractor'}
    </span>
  );

  const methodBadge = (method) => (
    <span className="method-badge">{method === 'cash' ? '💵 Cash' : '💳 Online'}</span>
  );

  const advanceBadge = (voucher) => isAdvanceVoucher(voucher)
    ? <span className="advance-badge">⚡ Advance</span>
    : null;

  // ── RENDER ─────────────────────────────────────────────
  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">🗂️ Voucher Management</h1>
          <span className="entity-page-badge" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
            {vouchers.length} Vouchers
          </span>
        </div>

        <div className="action-cards-grid">
  
  <div
    className={`action-card action-card-add ${
      activePanel === 'add' ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel('add')}
  >
    <div className="action-card-icon">➕</div>
    <div className="action-card-title">Add Voucher</div>
    <div className="action-card-desc">
      Create a new voucher record
    </div>
  </div>

  <div
    className={`action-card action-card-update ${
      activePanel === 'update' ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel('update')}
  >
    <div className="action-card-icon">✏️</div>
    <div className="action-card-title">Update Voucher</div>
    <div className="action-card-desc">
      Edit existing voucher details
    </div>
  </div>

  <div
    className={`action-card action-card-getall ${
      activePanel === 'getall' ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel('getall')}
  >
    <div className="action-card-icon">📋</div>
    <div className="action-card-title">All Vouchers</div>
    <div className="action-card-desc">
      View all voucher records
    </div>
  </div>

  <div
    className={`action-card action-card-delete ${
      activePanel === 'delete' ? 'action-card-active' : ''
    }`}
    onClick={() => togglePanel('delete')}
  >
    <div className="action-card-icon">🗑️</div>
    <div className="action-card-title">Delete Voucher</div>
    <div className="action-card-desc">
      Remove a voucher record
    </div>
  </div>

</div>

        {loading && <div className="loading-bar"><div className="loading-inner voucher-loading" /></div>}

        {/* ════ ADD ════ */}
        {activePanel === 'add' && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Generate New Voucher</div>

            <div className="autofill-banner full-width" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 18 }}>
              <span className="autofill-icon">💡</span>
              <span style={{ color: '#1e40af', fontSize: 13 }}>
                <strong>Advance Voucher:</strong> Pay a vendor/subcontractor without a bill.
                When you later create a purchase bill for that vendor, the system
                automatically deducts this advance. <strong>Note:</strong> Advance is only allowed
                if the vendor/subcontractor has NO pending unpaid bills.
              </span>
            </div>

            <form onSubmit={handleAdd}>
              <div className="form-row voucher-form-grid">

                {/* ── Step 1: Receiver Type ── */}
                <div className="form-field">
                  <label className="field-label">Step 1: Receiver Type *</label>
                  <div className="voucher-type-toggle">
                    {RECEIVER_TYPES.map(t => (
                      <button key={t} type="button"
                        className={`vtype-btn ${addForm.receiverType === t ? 'active' : ''}`}
                        onClick={() => handleTypeChange(t, setAddForm)}>
                        {t === 'vendor' ? '🛒 Vendor' : '🔧 Subcontractor'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Step 2: Voucher Mode ── */}
                <div className="form-field">
                  <label className="field-label">Step 2: Voucher Type *</label>
                  <div className="voucher-type-toggle">
                    {(addForm.receiverType === 'vendor' ? VENDOR_MODES : SUB_MODES).map(m => (
                      <button key={m} type="button"
                        className={`vtype-btn ${addForm.voucherMode === m ? 'active' : ''}`}
                        onClick={() => handleModeChange(m, setAddForm)}>
                        {m === 'advance'
                          ? '⚡ Advance Payment'
                          : addForm.receiverType === 'vendor'
                            ? '🧾 Against Purchase Bill'
                            : '🔧 Against Work Contract'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Mode description ── */}
                <div className="full-width" style={{ marginBottom: 4 }}>
                  {addForm.voucherMode === 'advance' ? (
                    <div className="autofill-banner" style={{ background: '#fefce8', borderColor: '#fcd34d' }}>
                      <span className="autofill-icon">⚡</span>
                      <span style={{ color: '#92400e', fontSize: 12 }}>
                        <strong>Advance Mode:</strong> Payment without a bill. The backend will
                        reject this if there are any unpaid/partial
                        {addForm.receiverType === 'vendor' ? ' purchase bills' : ' work subcontracts'} for this
                        {addForm.receiverType === 'vendor' ? ' vendor' : ' subcontractor'}.
                        {addForm.receiverType === 'vendor'
                          ? ' When you add a purchase bill later, the advance is automatically adjusted.'
                          : ' When you add a work subcontract later, the advance is automatically adjusted.'}
                      </span>
                    </div>
                  ) : (
                    <div className="autofill-banner" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                      <span className="autofill-icon">🧾</span>
                      <span style={{ color: '#166534', fontSize: 12 }}>
                        <strong>Against Bill Mode:</strong> Payment linked directly to a
                        {addForm.receiverType === 'vendor' ? ' purchase bill' : ' work subcontract'}.
                        The bill's paid amount updates immediately.
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Step 3: Select Receiver ── */}
                <div className="form-field">
                  <label className="field-label">
                    Step 3: Select {addForm.receiverType === 'vendor' ? 'Vendor' : 'Subcontractor'} *
                  </label>
                  <SearchableDropdown
                    options={receiverOptions}
                    value={addForm.receiverId || ''}
                    onChange={id => handleReceiverSelect(id, addForm, setAddForm)}
                    placeholder={`Search ${addForm.receiverType === 'vendor' ? 'vendor' : 'subcontractor'}...`}
                  />
                </div>

                {/* ── Step 4: Select Bill/Work (if against_bill or against_work) ── */}
                {addForm.receiverId && addForm.voucherMode === 'against_bill' && (
                  <div className="form-field full-width">
                    <label className="field-label">Step 4: Select Purchase Bill *</label>
                    {vendorBills.length === 0 ? (
                      <div className="autofill-banner" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                        <span className="autofill-icon">ℹ️</span>
                        <span style={{ color: '#92400e' }}>
                          No unpaid/partial purchase bills found for this vendor.
                          You can create an <strong>Advance Payment</strong> instead.
                        </span>
                      </div>
                    ) : (
                      <SearchableDropdown
                        options={vendorBills.map(b => {
                          const remaining = getPurchaseRemaining(b);
                          return {
                            value: b._id,
                            label: `${b.sno || b._id.slice(-6)} — ${b.subject || 'Bill'} — Grand: ₹${Number(b.grandTotal || 0).toLocaleString('en-IN')} — Paid: ₹${Number(b.cumulativePaidAmount || 0).toLocaleString('en-IN')} — Due: ₹${Number(remaining).toLocaleString('en-IN')} — [${b.paymentStatus}]`,
                          };
                        })}
                        value={addForm.purchaseId}
                        onChange={(id) => handlePurchaseSelect(id, setAddForm)}
                        placeholder="Select purchase bill to pay..."
                      />
                    )}
                  </div>
                )}

                {addForm.receiverId && addForm.voucherMode === 'against_work' && (
                  <div className="form-field full-width">
                    <label className="field-label">Step 4: Select Work Subcontract *</label>
                    {subWorks.length === 0 ? (
                      <div className="autofill-banner" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                        <span className="autofill-icon">ℹ️</span>
                        <span style={{ color: '#92400e' }}>
                          No unpaid/partial work subcontracts found for this subcontractor.
                          You can create an <strong>Advance Payment</strong> instead.
                        </span>
                      </div>
                    ) : (
                      <SearchableDropdown
                        options={subWorks.map(w => {
                          // FIX: use correct backend field names
                          const balance = getWorkSubRemaining(w);
                          const total   = w.grandTotal || w.totalAmount || 0;
                          const paid    = w.cumulativePaidAmount || 0;
                          return {
                            value: w._id,
                            label: `${w.projectName || 'Work'} — Total: ₹${Number(total).toLocaleString('en-IN')} — Paid: ₹${Number(paid).toLocaleString('en-IN')} — Balance: ₹${Number(balance).toLocaleString('en-IN')} — [${w.paymentStatus}]`,
                          };
                        })}
                        value={addForm.workSubcontractId}
                        onChange={(id) => handleWorkSubSelect(id, setAddForm)}
                        placeholder="Select work subcontract to pay..."
                      />
                    )}
                  </div>
                )}

                {/* Info banner for selected purchase bill */}
                {selectedPurchaseBill && (
                  <div className="autofill-banner full-width">
                    <span className="autofill-icon">✨</span>
                    <span>
                      Bill: <strong>{selectedPurchaseBill.sno}</strong>
                      {' · '}Grand Total: <strong>₹{Number(selectedPurchaseBill.grandTotal || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Already Paid: <strong>₹{Number(selectedPurchaseBill.cumulativePaidAmount || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Remaining: <strong>₹{Number(getPurchaseRemaining(selectedPurchaseBill)).toLocaleString('en-IN')}</strong>
                      {' · '}Status: <strong>{selectedPurchaseBill.paymentStatus}</strong>
                    </span>
                  </div>
                )}

                {selectedWorkSub && (
                  <div className="autofill-banner full-width" style={{ background: '#fefce8', borderColor: '#fcd34d' }}>
                    <span className="autofill-icon">✨</span>
                    <span style={{ color: '#92400e' }}>
                      Work: <strong>{selectedWorkSub.projectName}</strong>
                      {' · '}Total: <strong>₹{Number(selectedWorkSub.grandTotal || selectedWorkSub.totalAmount || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Paid: <strong>₹{Number(selectedWorkSub.cumulativePaidAmount || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Balance: <strong>₹{Number(getWorkSubRemaining(selectedWorkSub)).toLocaleString('en-IN')}</strong>
                      {' · '}Status: <strong>{selectedWorkSub.paymentStatus}</strong>
                    </span>
                  </div>
                )}

                {/* ── Purpose ── */}
                <div className="form-field">
                  <label className="field-label">Purpose *</label>
                  <input
                    className="field-input"
                    placeholder={
                      addForm.voucherMode === 'advance'
                        ? 'e.g. Advance payment for materials'
                        : 'Payment purpose / description'
                    }
                    value={addForm.purpose}
                    onChange={e => setAddForm(prev => ({ ...prev, purpose: e.target.value }))}
                  />
                </div>

                {/* ── Amount ── */}
                <div className="form-field">
                  <label className="field-label">Amount (₹) *</label>
                  <input
                    className="field-input"
                    type="number"
                    placeholder="0.00"
                    value={addForm.amount}
                    onChange={e => setAddForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                {/* ── Payment Method ── */}
                <div className="form-field">
                  <label className="field-label">Payment Method</label>
                  <div className="voucher-type-toggle">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} type="button"
                        className={`vtype-btn ${addForm.paymentMethod === m ? 'active' : ''}`}
                        onClick={() => setAddForm(prev => ({ ...prev, paymentMethod: m }))}>
                        {m === 'cash' ? '💵 Cash' : '💳 Online'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Preview bar */}
              {addForm.amount && (
                <div className="voucher-preview-bar">
                  <span>
                    {addForm.voucherMode === 'advance' ? '⚡ Advance' : '🧾 Bill Payment'}:
                    {' '}<strong>₹{Number(addForm.amount || 0).toLocaleString('en-IN')}</strong>
                  </span>
                  <span>Method: <strong>{addForm.paymentMethod}</strong></span>
                  {addForm.receiverName && <span>To: <strong>{addForm.receiverName}</strong></span>}
                  {selectedPurchaseBill && (
                    <span>
                      After payment, Remaining: <strong>₹{Math.max(0, getPurchaseRemaining(selectedPurchaseBill) - parseFloat(addForm.amount || 0)).toLocaleString('en-IN')}</strong>
                    </span>
                  )}
                  {selectedWorkSub && (
                    <span>
                      After payment, Balance: <strong>₹{Math.max(0, getWorkSubRemaining(selectedWorkSub) - parseFloat(addForm.amount || 0)).toLocaleString('en-IN')}</strong>
                    </span>
                  )}
                  {addForm.voucherMode === 'advance' && (
                    <span style={{ color: '#92400e', background: '#fefce8', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>
                      ⚡ Will auto-adjust when bill is created
                    </span>
                  )}
                </div>
              )}

              <div className="vendor-id-preview">
                🪪 Voucher No: <strong>VCH**** (auto-generated)</strong> &nbsp;·&nbsp; PDF generated automatically
              </div>
              <button type="submit" className="submit-btn voucher-submit" disabled={loading}>
                {loading ? '⏳ Generating...' : '🗂️ Generate Voucher'}
              </button>
            </form>
          </div>
        )}

        {/* ════ UPDATE ════ */}
        {activePanel === 'update' && (
          <div className="panel-section" key="update">
            <div className="panel-title">✏️ Update Voucher</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Voucher *</label>
              <SearchableDropdown
                options={voucherOptions}
                value={updateId}
                onChange={handleUpdateSelect}
                placeholder="Search voucher by number, receiver, purpose..."
              />
            </div>

            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.voucherNumber}</span>
                  <span className="update-found-name">{getReceiverName(updateFound)}</span>
                  <span style={{ fontSize: 12, color: '#666' }}>— {updateFound.receiverType}</span>
                  {isAdvanceVoucher(updateFound) && (
                    <span style={{ fontSize: 11, background: '#fefce8', color: '#92400e', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>
                      ⚡ Advance Voucher
                    </span>
                  )}
                </div>

                {isConnectedVoucher(updateFound) && (
                  <div className="autofill-banner full-width" style={{ background: '#fff7ed', borderColor: '#fed7aa', marginBottom: 16 }}>
                    <span className="autofill-icon">⚠️</span>
                    <span style={{ color: '#92400e' }}>
                      This voucher is <strong>connected to a purchase/work</strong>.
                      Backend will not allow changing the amount.
                      Only <strong>Purpose</strong> and <strong>Payment Method</strong> can be updated.
                    </span>
                  </div>
                )}

                {isAdvanceVoucher(updateFound) && (
                  <div className="autofill-banner full-width" style={{ background: '#fefce8', borderColor: '#fcd34d', marginBottom: 16 }}>
                    <span className="autofill-icon">⚡</span>
                    <span style={{ color: '#92400e' }}>
                      This is an <strong>advance voucher</strong> — not linked to any bill.
                      You can update the amount, purpose, and payment method.
                    </span>
                  </div>
                )}

                <form onSubmit={handleUpdate}>
                  <div className="form-row voucher-form-grid">

                    <div className="form-field">
                      <label className="field-label">Purpose</label>
                      <input
                        className="field-input"
                        value={updateForm.purpose}
                        onChange={e => setUpdateForm(prev => ({ ...prev, purpose: e.target.value }))}
                      />
                    </div>

                    <div className="form-field">
                      <label className="field-label">
                        Amount (₹)
                        {isConnectedVoucher(updateFound) && (
                          <span className="field-note"> (locked — connected voucher)</span>
                        )}
                      </label>
                      <input
                        className="field-input"
                        type="number"
                        value={updateForm.amount}
                        // FIX: disable amount edit for connected vouchers
                        disabled={isConnectedVoucher(updateFound)}
                        style={isConnectedVoucher(updateFound) ? { background: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed' } : {}}
                        onChange={e => setUpdateForm(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>

                    <div className="form-field">
                      <label className="field-label">Payment Method</label>
                      <div className="voucher-type-toggle">
                        {PAYMENT_METHODS.map(m => (
                          <button key={m} type="button"
                            className={`vtype-btn ${updateForm.paymentMethod === m ? 'active' : ''}`}
                            onClick={() => setUpdateForm(prev => ({ ...prev, paymentMethod: m }))}>
                            {m === 'cash' ? '💵 Cash' : '💳 Online'}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    ✏️ Update Voucher
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ════ DELETE ════ */}
        {activePanel === 'delete' && (
          <div className="panel-section" key="delete">
            <div className="panel-title">🗑️ Delete Voucher</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Voucher *</label>
              <SearchableDropdown
                options={voucherOptions}
                value={deleteId}
                onChange={handleDeleteSelect}
                placeholder="Search voucher to delete..."
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Voucher No',      deleteFound.voucherNumber],
                  ['Receiver Type',   deleteFound.receiverType],
                  ['Receiver Name',   getReceiverName(deleteFound)],
                  ['Voucher Type',    isAdvanceVoucher(deleteFound) ? '⚡ Advance' : '🧾 Connected to Bill'],
                  ['Purpose',         deleteFound.purpose],
                  // FIX: display amountInVoucher
                  ['Amount',          `₹${Number(deleteFound.amountInVoucher || deleteFound.amount || 0).toLocaleString('en-IN')}`],
                  ['Payment Method',  deleteFound.paymentMethod],
                  ['Date',            deleteFound.date?.split('T')[0]],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}
                <div className="vendor-delete-warn">
                  {isAdvanceVoucher(deleteFound)
                    ? '⚠️ Deleting this advance voucher will remove the advance payment. If a bill was already auto-adjusted with this advance, it will be reverted.'
                    : '🚫 This voucher is connected to a purchase/work bill. Backend will REJECT this delete. You must delete the linked purchase/work entry first to free the voucher, or contact your administrator.'}
                </div>
                <button className="delete-confirm-btn" style={{ marginTop: 12 }} onClick={handleDelete} disabled={loading}>
                  🗑️ Confirm Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ GET ALL ════ */}
        {activePanel === 'getall' && (
          <div className="panel-section" key="getall">
            <div className="panel-title">📋 All Vouchers</div>

            <div className="voucher-stat-cards">
              <div className="vsc vsc-total">
                <span>Total Vouchers</span>
                <strong>{countAll}</strong>
              </div>
              <div className="vsc vsc-amount">
                <span>Total Amount</span>
                {/* FIX: sum amountInVoucher */}
                <strong>₹{vouchers.reduce((s, v) => s + (v.amountInVoucher || v.amount || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="vsc vsc-paid">
                <span>Cash Vouchers</span>
                <strong>{countCash}</strong>
              </div>
              <div className="vsc vsc-balance">
                <span>Online Vouchers</span>
                <strong>{countOnline}</strong>
              </div>
              <div className="vsc" style={{ background: '#fefce8', border: '1.5px solid #fcd34d' }}>
                <span style={{ color: '#92400e' }}>Advance Vouchers</span>
                <strong style={{ color: '#92400e' }}>{vouchers.filter(isAdvanceVoucher).length}</strong>
              </div>
            </div>

            <div className="getall-filter-bar">
              <div className="getall-search-wrap">
                <span className="getall-search-icon">🔍</span>
                <input
                  className="getall-search-input"
                  placeholder="Search by voucher no, receiver, purpose..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
                {searchText && (
                  <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>
                )}
              </div>

              <div className="inv-status-filter-row" style={{ margin: 0 }}>
                {[
                  { label: 'All',      count: countAll,    key: 'All',    cls: 'filter-all'     },
                  { label: '💵 Cash',  count: countCash,   key: 'Cash',   cls: 'filter-paid'    },
                  { label: '💳 Online',count: countOnline, key: 'Online', cls: 'filter-partial' },
                ].map(tab => (
                  <button key={tab.key}
                    className={`inv-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(tab.key); setSelectedId(''); }}>
                    {tab.label}<span className="inv-filter-count">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {vouchers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No vouchers found.</p>
              </div>
            ) : (
              <>
                <div className="voucher-excel-bar">
                  <div className="voucher-excel-info">
                    <span className="voucher-excel-label">
                      📊 Showing <strong>{filteredVouchers.length}</strong> of <strong>{vouchers.length}</strong> vouchers
                      {statusFilter !== 'All' && <span className="voucher-excel-filter-tag">{statusFilter}</span>}
                      {searchText.trim() && <span className="voucher-excel-filter-tag">🔍 "{searchText.trim()}"</span>}
                    </span>
                  </div>
                  <div className="voucher-excel-actions">
                    <button className="excel-download-btn excel-download-filtered"
                      onClick={() => {
                        if (filteredVouchers.length === 0) { showToast('No vouchers to export', 'error'); return; }
                        exportVouchersToExcel(filteredVouchers, excelFilterLabel);
                        showToast(`📥 Downloading ${filteredVouchers.length} voucher(s)...`);
                      }}>
                      <span className="excel-btn-icon">⬇️</span>
                      <span>Download Filtered</span>
                      <span className="excel-btn-count">{filteredVouchers.length}</span>
                    </button>
                    <button className="excel-download-btn excel-download-all"
                      onClick={() => {
                        exportVouchersToExcel(vouchers, 'All Vouchers');
                        showToast(`📥 Downloading all ${vouchers.length} voucher(s)...`);
                      }}>
                      <span className="excel-btn-icon">📥</span>
                      <span>Download All</span>
                      <span className="excel-btn-count">{vouchers.length}</span>
                    </button>
                  </div>
                </div>

                <div className="form-field" style={{ marginBottom: 20 }}>
                  <label className="field-label">Select Voucher (View Details)</label>
                  <SearchableDropdown
                    options={filteredVouchers.map(v => ({
                      value: v._id,
                      label: `${v.voucherNumber} — ${getReceiverName(v)} — ₹${Number(v.amountInVoucher || v.amount || 0).toLocaleString('en-IN')}${isAdvanceVoucher(v) ? ' [ADVANCE]' : ''}`,
                    }))}
                    value={selectedId}
                    onChange={setSelectedId}
                    placeholder="Search and select voucher to view details..."
                  />
                </div>

                {selectedVoucher && (
                  <div className="voucher-detail-card">
                    <div className="voucher-detail-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span className="voucher-no-tag">{selectedVoucher.voucherNumber}</span>
                        {typeBadge(selectedVoucher.receiverType)}
                        {methodBadge(selectedVoucher.paymentMethod)}
                        {advanceBadge(selectedVoucher)}
                        {isConnectedVoucher(selectedVoucher) && (
                          <span style={{ fontSize: 11, background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                            🔗 Linked
                          </span>
                        )}
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedId('')}>✕</button>
                    </div>
                    <div className="voucher-detail-grid">
                      {[
                        ['Receiver',       getReceiverName(selectedVoucher)],
                        ['Type',           selectedVoucher.receiverType],
                        ['Voucher Type',   isAdvanceVoucher(selectedVoucher) ? '⚡ Advance Payment' : '🧾 Against Bill'],
                        ['Purpose',        selectedVoucher.purpose],
                        // FIX: display amountInVoucher
                        ['Amount',         `₹${Number(selectedVoucher.amountInVoucher || selectedVoucher.amount || 0).toLocaleString('en-IN')}`],
                        ['Remaining',      `₹${Number(selectedVoucher.remainingAmount || 0).toLocaleString('en-IN')}`],
                        ['Payment Method', selectedVoucher.paymentMethod],
                        ['Date',           selectedVoucher.date?.split('T')[0]],
                      ].map(([k, v]) => (
                        <div className="voucher-detail-item" key={k}>
                          <span className="voucher-detail-key">{k}</span>
                          <span className="voucher-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                    {selectedVoucher.pdfUrl && (
                      <a href={selectedVoucher.pdfUrl} target="_blank" rel="noreferrer"
                        className="submit-btn voucher-pdf-btn"
                        style={{ marginTop: 16, textDecoration: 'none', display: 'inline-flex' }}>
                        📄 View PDF Voucher
                      </a>
                    )}
                  </div>
                )}

                {filteredVouchers.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <p>No vouchers match your filter.</p>
                  </div>
                ) : (
                  <div className="voucher-card-list">
                    {filteredVouchers.map(v => {
                      const isSelected = selectedId === v._id;
                      const isAdv      = isAdvanceVoucher(v);
                      return (
                        <div key={v._id}
                          className={`voucher-row-card ${isSelected ? 'voucher-row-selected' : ''}`}
                          onClick={() => setSelectedId(isSelected ? '' : v._id)}>
                          <div className="voucher-row-left">
                            <span className="voucher-no-tag">{v.voucherNumber}</span>
                            {typeBadge(v.receiverType)}
                            {isAdv && (
                              <span style={{ fontSize: 11, background: '#fefce8', color: '#92400e', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                                ⚡ Advance
                              </span>
                            )}
                            {!isAdv && (
                              <span style={{ fontSize: 11, background: '#f0fdf4', color: '#166534', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                                🔗 Linked
                              </span>
                            )}
                          </div>
                          <div className="voucher-row-mid">
                            <div className="voucher-row-receiver">{getReceiverName(v)}</div>
                            <div className="voucher-row-purpose">{v.purpose}</div>
                            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                              {/* FIX: display amountInVoucher */}
                              <span className="voucher-row-amt">₹{Number(v.amountInVoucher || v.amount || 0).toLocaleString('en-IN')}</span>
                              {(v.remainingAmount > 0) && (
                                <span style={{ fontSize: 12, color: '#92400e' }}>
                                  Remaining: ₹{Number(v.remainingAmount).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="voucher-row-right">
                            {methodBadge(v.paymentMethod)}
                            <div className="voucher-row-date">{v.date?.split('T')[0]}</div>
                            {v.pdfUrl && (
                              <a href={v.pdfUrl} target="_blank" rel="noreferrer"
                                className="voucher-pdf-link"
                                onClick={e => e.stopPropagation()}>
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

export default VoucherPage;