import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/VoucherPage.css';
import '../styles/SearchableDropdown.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const RECEIVER_TYPES = ['vendor', 'subcontractor'];
const PAYMENT_METHODS = ['cash', 'online'];

const COMPANY = {
  name: 'DESIGN ART (INTERIOR & EXTERIOR SOLUTION)',
  address: '5-6, Indria Nagar, PM Samy Colony, Ratinapuri, Gandhipuram, Coimbatore 641012',
  phone: '+91 9677731326',
  gst: '33BNCPP2332Q1ZT',
};

const emptyForm = {
  receiverType: 'vendor',
  receiverId: '',
  receiverName: '',
  purchaseId: '',
  workSubcontractId: '',
  purpose: '',
  amount: '',
  paymentMethod: 'cash',
};

// ── Excel Export ──────────────────────────────────────────
function exportVouchersToExcel(voucherList, filterLabel) {
  const wb = XLSX.utils.book_new();
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
      v.receiverType || '',
      getReceiverName(v) || '',
      v.purpose || '',
      parseFloat(v.amount) || 0,
      v.paymentMethod || '',
      v.date ? v.date.split('T')[0] : '',
      v.pdfUrl || '',
    ]);
  });

  rows.push(['', '', '', '', '', '', '', '']);
  const totalAmt = voucherList.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
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

// ── BUG FIX 1: getReceiverName ────────────────────────────
// Backend getAllVouchers populates purchase.vendor and workSubcontract.subcontract
// but does NOT populate voucher.receiver directly.
// Priority:
//   1. voucher.receiver (populated in some routes like getById)
//   2. Vendor → voucher.purchase.vendor.name
//   3. Subcontract → voucher.workSubcontract.subcontract.name
function getReceiverName(voucher) {
  // Direct receiver population (getById route)
  if (voucher.receiver && typeof voucher.receiver === 'object' && voucher.receiver.name) {
    return voucher.receiver.name;
  }

  // Vendor: derive from populated purchase.vendor
  if (voucher.receiverType === 'Vendor') {
    if (voucher.purchase && typeof voucher.purchase === 'object') {
      const vendor = voucher.purchase.vendor;
      if (vendor && typeof vendor === 'object' && vendor.name) return vendor.name;
    }
  }

  // Subcontract: derive from populated workSubcontract.subcontract
  if (voucher.receiverType === 'Subcontract') {
    if (voucher.workSubcontract && typeof voucher.workSubcontract === 'object') {
      const sub = voucher.workSubcontract.subcontract;
      if (sub && typeof sub === 'object' && sub.name) return sub.name;
    }
  }

  return '';
}

// ── ReceiverSection ───────────────────────────────────────
function ReceiverSection({ form, setForm, vendors, subs, onTypeChange, onReceiverSelect }) {
  const receiverList = form.receiverType === 'vendor' ? vendors : subs;
  const sddOptions = receiverList.map(item => ({
    value: item._id,
    label: form.receiverType === 'vendor'
      ? `${item.vendorCode || ''} — ${item.name}`
      : `${item.subcontractCode || ''} — ${item.name}`,
  }));

  return (
    <>
      <div className="form-field">
        <label className="field-label">Receiver Type *</label>
        <div className="voucher-type-toggle">
          {RECEIVER_TYPES.map(t => (
            <button key={t} type="button"
              className={`vtype-btn ${form.receiverType === t ? 'active' : ''}`}
              onClick={() => onTypeChange(t)}>
              {t === 'vendor' ? '🛒 Vendor' : '🔧 Subcontractor'}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label className="field-label">
          Select {form.receiverType === 'vendor' ? 'Vendor' : 'Subcontractor'} *
          {form.receiverId && <span className="autofill-badge">✨ Auto-fill enabled</span>}
        </label>
        <SearchableDropdown
          options={sddOptions}
          value={form.receiverId || ''}
          onChange={id => onReceiverSelect(id)}
          placeholder={`Search ${form.receiverType === 'vendor' ? 'vendor' : 'subcontractor'}...`}
        />
      </div>
    </>
  );
}

// ── PurchaseBillSelector ──────────────────────────────────
function PurchaseBillSelector({ vendorId, purchases, selectedPurchaseId, onSelect }) {
  const vendorBills = purchases.filter(p => {
    const v = p.vendor;
    if (!v) return false;
    return typeof v === 'object' ? v._id === vendorId : v === vendorId;
  });

  if (vendorBills.length === 0) return (
    <div className="autofill-banner full-width" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
      <span className="autofill-icon">ℹ️</span>
      <span style={{ color: '#92400e' }}>No purchase bills found for this vendor.</span>
    </div>
  );

  const options = vendorBills.map(b => ({
    value: b._id,
    label: `${b.sno || b._id.slice(-6)} — ${b.subject || 'Bill'} — Grand: ₹${Number(b.grandTotal || 0).toLocaleString('en-IN')} — Paid: ₹${Number(b.paidAmount || 0).toLocaleString('en-IN')} — Due: ₹${Number((b.grandTotal || 0) - (b.paidAmount || 0)).toLocaleString('en-IN')} — [${b.paymentStatus}]`,
  }));

  return (
    <div className="form-field full-width">
      <label className="field-label">Select Purchase Bill (optional)</label>
      <SearchableDropdown
        options={options}
        value={selectedPurchaseId}
        onChange={onSelect}
        placeholder="Select purchase bill to pay..."
      />
    </div>
  );
}

// ── WorkSubcontractSelector ───────────────────────────────
function WorkSubcontractSelector({ subcontractorId, workSubcontracts, selectedWorkSubId, onSelect }) {
  const subWorks = workSubcontracts.filter(w => {
    const s = w.subcontract;
    if (!s) return false;
    return typeof s === 'object' ? s._id === subcontractorId : s === subcontractorId;
  });

  if (subWorks.length === 0) return (
    <div className="autofill-banner full-width" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
      <span className="autofill-icon">ℹ️</span>
      <span style={{ color: '#92400e' }}>No work subcontracts found for this subcontractor.</span>
    </div>
  );

  const options = subWorks.map(w => ({
    value: w._id,
    label: `${w.workName || w.projectName || 'Work'} — Total: ₹${Number(w.totalAmount || 0).toLocaleString('en-IN')} — Paid: ₹${Number(w.paidAmount || 0).toLocaleString('en-IN')} — Balance: ₹${Number(w.balanceAmount || 0).toLocaleString('en-IN')} — [${w.paymentStatus}]`,
  }));

  return (
    <div className="form-field full-width">
      <label className="field-label">Select Work Subcontract (optional)</label>
      <SearchableDropdown
        options={options}
        value={selectedWorkSubId}
        onChange={onSelect}
        placeholder="Select work subcontract to pay..."
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
function VoucherPage({ onLogout }) {
  const navigate = useNavigate();

  const [vouchers, setVouchers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [subs, setSubs] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [workSubcontracts, setWorkSubcontracts] = useState([]);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  const [addForm, setAddForm] = useState(emptyForm);
  const [updateId, setUpdateId] = useState('');
  const [updateFound, setUpdateFound] = useState(null);
  const [updateForm, setUpdateForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState('');
  const [deleteFound, setDeleteFound] = useState(null);
  const [selectedId, setSelectedId] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch ──────────────────────────────────────────────
  // BUG FIX 2: Backend returns { count, data: [] } — not a plain array
  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/vouchers/getall`);
      const data = await res.json();
      setVouchers(Array.isArray(data) ? data : (data.data || []));
    } catch { showToast('Failed to fetch vouchers', 'error'); }
    finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(`${API}/vendor/getall`);
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  const fetchSubs = async () => {
    try {
      const res = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      setSubs(data.data || data || []);
    } catch {}
  };

  const fetchPurchases = async () => {
    try {
      const res = await fetch(`${API}/purchase/all`);
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  // BUG FIX 3: Was calling /workSubcontract/all (404s silently).
  // Backend route is /workSubcontract/getall → returns { works: [...] }
  const fetchWorkSubcontracts = async () => {
    try {
      const res = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      setWorkSubcontracts(data.works || (Array.isArray(data) ? data : (data.data || [])));
    } catch {}
  };

  useEffect(() => {
    fetchVouchers();
    fetchVendors();
    fetchSubs();
    fetchPurchases();
    fetchWorkSubcontracts();
  }, []);

  // ── Purchase bill remaining ────────────────────────────
  const getPurchaseRemaining = (bill) =>
    Math.max(0, (bill.grandTotal || 0) - (bill.paidAmount || 0));

  const getWorkSubRemaining = (work) =>
    Math.max(0, (work.totalAmount || 0) - (work.paidAmount || 0));

  // ── Auto-fill when purchase bill selected ─────────────
  const handlePurchaseSelect = useCallback((purchaseId, setForm) => {
    const bill = purchases.find(p => p._id === purchaseId);
    if (!bill) return;
    const remaining = getPurchaseRemaining(bill);
    setForm(prev => ({
      ...prev,
      purchaseId,
      workSubcontractId: '',
      purpose: bill.subject
        ? `Payment for ${bill.subject}`
        : bill.sno
          ? `Payment for Purchase Bill ${bill.sno}`
          : 'Purchase Bill Payment',
      amount: remaining > 0 ? String(remaining) : String(bill.grandTotal || ''),
    }));
  }, [purchases]);

  // ── Auto-fill when work subcontract selected ──────────
  const handleWorkSubSelect = useCallback((workSubId, setForm) => {
    const work = workSubcontracts.find(w => w._id === workSubId);
    if (!work) return;
    const remaining = getWorkSubRemaining(work);
    setForm(prev => ({
      ...prev,
      workSubcontractId: workSubId,
      purchaseId: '',
      purpose: work.workName
        ? `Payment for ${work.workName}`
        : work.projectName
          ? `Payment for ${work.projectName}`
          : 'Work Subcontract Payment',
      amount: remaining > 0 ? String(remaining) : String(work.totalAmount || ''),
    }));
  }, [workSubcontracts]);

  // ── Receiver selection with subcontractor auto-fill ──
  const handleReceiverSelect = useCallback((id, currentForm, setForm) => {
    if (!id) {
      setForm(prev => ({
        ...prev,
        receiverId: '',
        receiverName: '',
        purchaseId: '',
        workSubcontractId: '',
        purpose: '',
        amount: '',
      }));
      return;
    }

    const list = currentForm.receiverType === 'vendor' ? vendors : subs;
    const found = list.find(i => i._id === id);
    if (!found) {
      setForm(prev => ({
        ...prev,
        receiverId: '',
        receiverName: '',
        purchaseId: '',
        workSubcontractId: '',
        purpose: '',
        amount: '',
      }));
      return;
    }

    const baseUpdate = {
      receiverId: id,
      receiverName: found.name,
      purchaseId: '',
      workSubcontractId: '',
      purpose: '',
      amount: '',
    };

    // ── SUBCONTRACTOR AUTO-FILL ────────────────────────
    if (currentForm.receiverType === 'subcontractor') {
      const subWorks = workSubcontracts.filter(w => {
        const s = w.subcontract;
        if (!s) return false;
        return typeof s === 'object' ? s._id === id : s === id;
      });

      if (subWorks.length === 1) {
        const work = subWorks[0];
        const remaining = getWorkSubRemaining(work);
        setForm(prev => ({
          ...prev,
          ...baseUpdate,
          workSubcontractId: work._id,
          purpose: work.workName
            ? `Payment for ${work.workName}`
            : work.projectName
              ? `Payment for ${work.projectName}`
              : 'Work Subcontract Payment',
          amount: remaining > 0 ? String(remaining) : String(work.totalAmount || ''),
        }));
        return;
      }

      setForm(prev => ({ ...prev, ...baseUpdate }));
      return;
    }

    // ── VENDOR: set receiver only ──────────────────────
    setForm(prev => ({ ...prev, ...baseUpdate }));
  }, [vendors, subs, workSubcontracts]);

  // ── Type change ────────────────────────────────────────
  const handleTypeChange = useCallback((type, setForm) => {
    setForm(prev => ({
      ...prev,
      receiverType: type,
      receiverId: '',
      receiverName: '',
      purchaseId: '',
      workSubcontractId: '',
      purpose: '',
      amount: '',
    }));
  }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateId('');
    setUpdateFound(null);
    setUpdateForm(emptyForm);
    setDeleteId('');
    setDeleteFound(null);
    setSelectedId('');
    setStatusFilter('All');
    setSearchText('');
  };

  // ── ADD ────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.receiverType || !addForm.receiverId) {
      showToast('Please select a receiver', 'error');
      return;
    }
    if (!addForm.purpose || !addForm.amount) {
      showToast('Purpose and Amount are required', 'error');
      return;
    }
    if (parseFloat(addForm.amount) <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        receiverType: addForm.receiverType === 'vendor' ? 'Vendor' : 'Subcontract',
        receiver: addForm.receiverId,
        purpose: addForm.purpose,
        amount: parseFloat(addForm.amount),
        paymentMethod: addForm.paymentMethod,
      };

      if (addForm.receiverType === 'vendor' && addForm.purchaseId) {
        payload.purchaseId = addForm.purchaseId;
      }
      if (addForm.receiverType === 'subcontractor' && addForm.workSubcontractId) {
        payload.workSubcontractId = addForm.workSubcontractId;
      }

      const res = await fetch(`${API}/vouchers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        await fetchVouchers();
        await fetchPurchases();
        await fetchWorkSubcontracts();
        setAddForm(emptyForm);
        showToast(`✅ Voucher ${data.voucher?.voucherNumber} generated!`);
      } else {
        showToast(data.message || 'Failed to create voucher', 'error');
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
    if (found) {
      setUpdateFound(found);

      let receiverType = 'vendor';
      let receiverId = '';
      let receiverName = '';

      if (found.receiverType === 'Vendor') {
        receiverType = 'vendor';
        if (typeof found.receiver === 'object' && found.receiver) {
          receiverId = found.receiver._id;
          receiverName = found.receiver.name;
        } else if (found.purchase && typeof found.purchase === 'object' && found.purchase.vendor) {
          // BUG FIX 4: receiver not populated, fall back to purchase.vendor
          const v = found.purchase.vendor;
          receiverId = typeof v === 'object' ? v._id : v;
          receiverName = typeof v === 'object' ? (v.name || '') : '';
        } else {
          receiverId = typeof found.receiver === 'string' ? found.receiver : '';
        }
      } else if (found.receiverType === 'Subcontract') {
        receiverType = 'subcontractor';
        if (typeof found.receiver === 'object' && found.receiver) {
          receiverId = found.receiver._id;
          receiverName = found.receiver.name;
        } else if (found.workSubcontract && typeof found.workSubcontract === 'object' && found.workSubcontract.subcontract) {
          // BUG FIX 4: receiver not populated, fall back to workSubcontract.subcontract
          const s = found.workSubcontract.subcontract;
          receiverId = typeof s === 'object' ? s._id : s;
          receiverName = typeof s === 'object' ? (s.name || '') : '';
        } else {
          receiverId = typeof found.receiver === 'string' ? found.receiver : '';
        }
      }

      setUpdateForm({
        receiverType,
        receiverId,
        receiverName,
        purchaseId: found.purchase?._id || (typeof found.purchase === 'string' ? found.purchase : '') || '',
        workSubcontractId: found.workSubcontract?._id || (typeof found.workSubcontract === 'string' ? found.workSubcontract : '') || '',
        purpose: found.purpose,
        amount: String(found.amount || ''),
        paymentMethod: found.paymentMethod || 'cash',
      });
    } else {
      setUpdateFound(null);
      setUpdateForm(emptyForm);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) {
      showToast('Please select a voucher', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        receiverType: updateForm.receiverType === 'vendor' ? 'Vendor' : 'Subcontract',
        receiver: updateForm.receiverId,
        purpose: updateForm.purpose,
        amount: parseFloat(updateForm.amount),
        paymentMethod: updateForm.paymentMethod,
      };

      const res = await fetch(`${API}/vouchers/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchVouchers();
        await fetchPurchases();
        await fetchWorkSubcontracts();
        showToast(`📝 Voucher ${updateFound.voucherNumber} updated!`);
        setUpdateFound(null);
        setUpdateId('');
        setUpdateForm(emptyForm);
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to update voucher', 'error');
      }
    } catch (err) {
      showToast('Error updating voucher: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── DELETE ─────────────────────────────────────────────
  const handleDeleteSelect = (vid) => {
    setDeleteId(vid);
    setDeleteFound(vouchers.find(v => v._id === vid) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) {
      showToast('Please select a voucher', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API}/vouchers/delete/${deleteFound._id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchVouchers();
        await fetchPurchases();
        await fetchWorkSubcontracts();
        showToast(`🗑️ Voucher ${deleteFound.voucherNumber} deleted!`, 'info');
        setDeleteFound(null);
        setDeleteId('');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to delete voucher', 'error');
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

  const countAll = vouchers.length;
  const countCash = vouchers.filter(v => v.paymentMethod === 'cash').length;
  const countOnline = vouchers.filter(v => v.paymentMethod === 'online').length;

  const selectedVoucher = vouchers.find(v => v._id === selectedId);

  const selectedPurchaseBill = useMemo(() => {
    if (!addForm.purchaseId) return null;
    return purchases.find(p => p._id === addForm.purchaseId) || null;
  }, [addForm.purchaseId, purchases]);

  const selectedWorkSub = useMemo(() => {
    if (!addForm.workSubcontractId) return null;
    return workSubcontracts.find(w => w._id === addForm.workSubcontractId) || null;
  }, [addForm.workSubcontractId, workSubcontracts]);

  const excelFilterLabel = useMemo(() => {
    let label = statusFilter === 'All' ? 'All Vouchers' : `${statusFilter} Vouchers`;
    if (searchText.trim()) label += ` (Search: ${searchText.trim()})`;
    return label;
  }, [statusFilter, searchText]);

  // BUG FIX 5: Full addForm/updateForm in deps (not just .receiverType)
  const handleAddReceiverSelect = useCallback(
    (id) => handleReceiverSelect(id, addForm, setAddForm),
    [addForm, vendors, subs, workSubcontracts, handleReceiverSelect]
  );

  const handleAddTypeChange = useCallback(
    (type) => handleTypeChange(type, setAddForm),
    [handleTypeChange]
  );

  const handleUpdateReceiverSelect = useCallback(
    (id) => handleReceiverSelect(id, updateForm, setUpdateForm),
    [updateForm, vendors, subs, workSubcontracts, handleReceiverSelect]
  );

  const handleUpdateTypeChange = useCallback(
    (type) => handleTypeChange(type, setUpdateForm),
    [handleTypeChange]
  );

  const typeBadge = (type) => (
    <span className={`type-badge type-${type === 'Vendor' ? 'vendor' : 'subcontractor'}`}>
      {type === 'Vendor' ? '🛒 Vendor' : '🔧 Subcontractor'}
    </span>
  );

  const methodBadge = (method) => (
    <span className="method-badge">{method === 'cash' ? '💵 Cash' : '💳 Online'}</span>
  );

  const voucherOptions = vouchers.map(v => ({
    value: v._id,
    label: `${v.voucherNumber} — ${v.receiverType?.toUpperCase()} — ${getReceiverName(v)} — ₹${Number(v.amount).toLocaleString('en-IN')}`,
  }));

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

        <div className="actions-row">
          <button className="action-btn voucher-btn-add" onClick={() => togglePanel(PANELS.ADD)}>➕ Add Voucher</button>
          <button className="action-btn voucher-btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>✏️ Update Voucher</button>
          <button className="action-btn voucher-btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>🗑️ Delete Voucher</button>
          <button className="action-btn voucher-btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>📋 All Vouchers</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner voucher-loading" /></div>}

        {/* ════ ADD ════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Generate New Voucher</div>
            <form onSubmit={handleAdd}>
              <div className="form-row voucher-form-grid">

                <ReceiverSection
                  form={addForm}
                  setForm={setAddForm}
                  vendors={vendors}
                  subs={subs}
                  onTypeChange={handleAddTypeChange}
                  onReceiverSelect={handleAddReceiverSelect}
                />

                {addForm.receiverType === 'vendor' && addForm.receiverId && (
                  <PurchaseBillSelector
                    vendorId={addForm.receiverId}
                    purchases={purchases}
                    selectedPurchaseId={addForm.purchaseId}
                    onSelect={(id) => handlePurchaseSelect(id, setAddForm)}
                  />
                )}

                {addForm.receiverType === 'subcontractor' && addForm.receiverId && (
                  <WorkSubcontractSelector
                    subcontractorId={addForm.receiverId}
                    workSubcontracts={workSubcontracts}
                    selectedWorkSubId={addForm.workSubcontractId}
                    onSelect={(id) => handleWorkSubSelect(id, setAddForm)}
                  />
                )}

                {selectedPurchaseBill && (
                  <div className="autofill-banner full-width">
                    <span className="autofill-icon">✨</span>
                    <span>
                      Bill: <strong>{selectedPurchaseBill.sno}</strong>
                      {' · '}Grand Total: <strong>₹{Number(selectedPurchaseBill.grandTotal || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Already Paid: <strong>₹{Number(selectedPurchaseBill.paidAmount || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Remaining: <strong>₹{Number(getPurchaseRemaining(selectedPurchaseBill)).toLocaleString('en-IN')}</strong>
                      {' · '}Status: <strong>{selectedPurchaseBill.paymentStatus}</strong>
                    </span>
                  </div>
                )}

                {selectedWorkSub && (
                  <div className="autofill-banner full-width" style={{ background: '#fefce8', borderColor: '#fcd34d' }}>
                    <span className="autofill-icon">✨</span>
                    <span style={{ color: '#92400e' }}>
                      Work: <strong>{selectedWorkSub.workName || selectedWorkSub.projectName}</strong>
                      {' · '}Total: <strong>₹{Number(selectedWorkSub.totalAmount || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Paid: <strong>₹{Number(selectedWorkSub.paidAmount || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Balance: <strong>₹{Number(getWorkSubRemaining(selectedWorkSub)).toLocaleString('en-IN')}</strong>
                      {' · '}Status: <strong>{selectedWorkSub.paymentStatus}</strong>
                    </span>
                  </div>
                )}

                <div className="form-field">
                  <label className="field-label">Purpose *</label>
                  <input
                    className="field-input"
                    placeholder="Payment purpose / description"
                    value={addForm.purpose}
                    onChange={e => setAddForm(prev => ({ ...prev, purpose: e.target.value }))}
                  />
                </div>

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

                <div className="form-field">
                  <label className="field-label">Payment Method</label>
                  <div className="voucher-type-toggle">
                    {PAYMENT_METHODS.map(m => (
                      <button
                        key={m}
                        type="button"
                        className={`vtype-btn ${addForm.paymentMethod === m ? 'active' : ''}`}
                        onClick={() => setAddForm(prev => ({ ...prev, paymentMethod: m }))}>
                        {m === 'cash' ? '💵 Cash' : '💳 Online'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {addForm.amount && (
                <div className="voucher-preview-bar">
                  <span>Voucher Amount: <strong>₹{Number(addForm.amount || 0).toLocaleString('en-IN')}</strong></span>
                  <span>Method: <strong>{addForm.paymentMethod}</strong></span>
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
        {activePanel === PANELS.UPDATE && (
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
                </div>
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
                      <label className="field-label">Amount (₹)</label>
                      <input
                        className="field-input"
                        type="number"
                        value={updateForm.amount}
                        onChange={e => setUpdateForm(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>

                    <div className="form-field">
                      <label className="field-label">Payment Method</label>
                      <div className="voucher-type-toggle">
                        {PAYMENT_METHODS.map(m => (
                          <button
                            key={m}
                            type="button"
                            className={`vtype-btn ${updateForm.paymentMethod === m ? 'active' : ''}`}
                            onClick={() => setUpdateForm(prev => ({ ...prev, paymentMethod: m }))}>
                            {m === 'cash' ? '💵 Cash' : '💳 Online'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="autofill-banner full-width" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                      <span className="autofill-icon">⚠️</span>
                      <span style={{ color: '#92400e' }}>
                        Changing the amount will automatically update the linked bill's paid amount.
                      </span>
                    </div>

                  </div>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    ✏️ Update Voucher
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ════ DELETE ════ */}
        {activePanel === PANELS.DELETE && (
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
                  ['Voucher No', deleteFound.voucherNumber],
                  ['Receiver Type', deleteFound.receiverType],
                  ['Receiver Name', getReceiverName(deleteFound)],
                  ['Purpose', deleteFound.purpose],
                  ['Amount', `₹${Number(deleteFound.amount || 0).toLocaleString('en-IN')}`],
                  ['Payment Method', deleteFound.paymentMethod],
                  ['Date', deleteFound.date?.split('T')[0]],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}
                <div className="vendor-delete-warn">
                  ⚠️ Deleting this voucher will reverse the payment on the linked bill.
                </div>
                <button
                  className="delete-confirm-btn"
                  style={{ marginTop: 12 }}
                  onClick={handleDelete}
                  disabled={loading}>
                  🗑️ Confirm Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════ GET ALL ════ */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">📋 All Vouchers</div>

            <div className="voucher-stat-cards">
              <div className="vsc vsc-total">
                <span>Total Vouchers</span>
                <strong>{countAll}</strong>
              </div>
              <div className="vsc vsc-amount">
                <span>Total Amount</span>
                <strong>₹{vouchers.reduce((s, v) => s + (v.amount || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="vsc vsc-paid">
                <span>Cash Vouchers</span>
                <strong>{countCash}</strong>
              </div>
              <div className="vsc vsc-balance">
                <span>Online Vouchers</span>
                <strong>{countOnline}</strong>
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
                  { label: 'All', count: countAll, key: 'All', cls: 'filter-all' },
                  { label: '💵 Cash', count: countCash, key: 'Cash', cls: 'filter-paid' },
                  { label: '💳 Online', count: countOnline, key: 'Online', cls: 'filter-partial' },
                ].map(tab => (
                  <button
                    key={tab.key}
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
                    <button
                      className="excel-download-btn excel-download-filtered"
                      onClick={() => {
                        if (filteredVouchers.length === 0) {
                          showToast('No vouchers to export', 'error');
                          return;
                        }
                        exportVouchersToExcel(filteredVouchers, excelFilterLabel);
                        showToast(`📥 Downloading ${filteredVouchers.length} voucher(s)...`);
                      }}>
                      <span className="excel-btn-icon">⬇️</span>
                      <span>Download Filtered</span>
                      <span className="excel-btn-count">{filteredVouchers.length}</span>
                    </button>
                    <button
                      className="excel-download-btn excel-download-all"
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
                      label: `${v.voucherNumber} — ${getReceiverName(v)} — ₹${Number(v.amount).toLocaleString('en-IN')}`,
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
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedId('')}>✕</button>
                    </div>
                    <div className="voucher-detail-grid">
                      {[
                        ['Receiver', getReceiverName(selectedVoucher)],
                        ['Type', selectedVoucher.receiverType],
                        ['Purpose', selectedVoucher.purpose],
                        ['Amount', `₹${Number(selectedVoucher.amount || 0).toLocaleString('en-IN')}`],
                        ['Payment Method', selectedVoucher.paymentMethod],
                        ['Date', selectedVoucher.date?.split('T')[0]],
                      ].map(([k, v]) => (
                        <div className="voucher-detail-item" key={k}>
                          <span className="voucher-detail-key">{k}</span>
                          <span className="voucher-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                    {selectedVoucher.pdfUrl && (
                      <a
                        href={selectedVoucher.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
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
                      return (
                        <div
                          key={v._id}
                          className={`voucher-row-card ${isSelected ? 'voucher-row-selected' : ''}`}
                          onClick={() => setSelectedId(isSelected ? '' : v._id)}>
                          <div className="voucher-row-left">
                            <span className="voucher-no-tag">{v.voucherNumber}</span>
                            {typeBadge(v.receiverType)}
                          </div>
                          <div className="voucher-row-mid">
                            <div className="voucher-row-receiver">{getReceiverName(v)}</div>
                            <div className="voucher-row-purpose">{v.purpose}</div>
                            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                              <span className="voucher-row-amt">₹{Number(v.amount).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                          <div className="voucher-row-right">
                            {methodBadge(v.paymentMethod)}
                            <div className="voucher-row-date">{v.date?.split('T')[0]}</div>
                            {v.pdfUrl && (
                              <a
                                href={v.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
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