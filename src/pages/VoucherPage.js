import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/VoucherPage.css';
import '../styles/SearchableDropdown.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const RECEIVER_TYPES  = ['vendor', 'subcontractor'];
const PAYMENT_METHODS = ['cash', 'online'];

const emptyForm = {
  receiverType:  'vendor',
  receiverId:    '',
  receiverName:  '',
  purpose:       '',
  amount:        '',
  paidAmount:    '0',
  paymentMethod: 'cash',
  date:          new Date().toISOString().split('T')[0],
};

function VoucherPage({ onLogout }) {
  const navigate = useNavigate();

  const [vouchers,  setVouchers]  = useState([]);
  const [vendors,   setVendors]   = useState([]);
  const [subs,      setSubs]      = useState([]);
  const [purchases, setPurchases] = useState([]);    // vendor purchase bills
  const [works,     setWorks]     = useState([]);    // subcontractor work bills
  const [activePanel, setPanel]   = useState(null);
  const [toast,     setToast]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchText,   setSearchText]   = useState('');

  const [addForm,     setAddForm]     = useState(emptyForm);
  const [updateId,    setUpdateId]    = useState('');
  const [updateFound, setUpdateFound] = useState(null);
  const [updateForm,  setUpdateForm]  = useState(emptyForm);
  const [deleteId,    setDeleteId]    = useState('');
  const [deleteFound, setDeleteFound] = useState(null);
  const [selectedId,  setSelectedId]  = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  // ── Fetch ────────────────────────────────────────────────
  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/vouchers/getall`);
      const data = await res.json();
      setVouchers(data.vouchers || data || []);
    } catch { showToast('Failed to fetch vouchers', 'error'); }
    finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    try {
      const res  = await fetch(`${API}/vendor/getall`);
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : (data.data || []));
    } catch {}
  };

  const fetchSubs = async () => {
    try {
      const res  = await fetch(`${API}/subcontract/getall`);
      const data = await res.json();
      setSubs(data.data || []);
    } catch {}
  };

  const fetchPurchases = async () => {
    try {
      const res  = await fetch(`${API}/purchase/getall/purchasebill`);
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchWorks = async () => {
    try {
      const res  = await fetch(`${API}/workSubcontract/getall`);
      const data = await res.json();
      setWorks(data.works || []);
    } catch {}
  };

  useEffect(() => {
    fetchVouchers(); fetchVendors(); fetchSubs(); fetchPurchases(); fetchWorks();
  }, []);

  // ── Receiver options ─────────────────────────────────────
  const receiverOptions = (type) => {
    if (type === 'vendor')        return vendors;
    if (type === 'subcontractor') return subs;
    return [];
  };

  const getReceiverLabel = (item, type) => {
    if (!item) return '—';
    if (type === 'vendor')        return `${item.vendorCode || ''} — ${item.name}`;
    if (type === 'subcontractor') return `${item.subcontractCode || ''} — ${item.name}`;
    return item.name || '—';
  };

  // ── Auto-fill from vendor purchase bills ─────────────────
  const getVendorAutoFill = (vendorId) => {
    const vendorBills = purchases.filter(p => {
      const v = p.vendor;
      if (!v) return false;
      return typeof v === 'object' ? v._id === vendorId : v === vendorId;
    });
    if (vendorBills.length === 0) return null;

    // Latest unpaid/partial bill
    const unpaid = vendorBills.filter(b => b.status !== 'paid');
    const bill   = unpaid.length > 0 ? unpaid[unpaid.length - 1] : vendorBills[vendorBills.length - 1];

    const outstanding = vendorBills.reduce((s, b) => s + ((b.netTotal || 0) - (b.paidAmount || 0)), 0);

    return {
      purpose: bill.purpose || `Purchase Bill ${bill.purchaseCode}`,
      amount:  outstanding > 0 ? String(outstanding) : String(bill.netTotal || ''),
      bills:   vendorBills,
    };
  };

  // ── Auto-fill from subcontractor work ────────────────────
  const getSubAutoFill = (subId) => {
    const subWorks = works.filter(w => {
      const s = w.subcontract;
      return typeof s === 'object' ? s._id === subId : s === subId;
    });
    if (subWorks.length === 0) return null;

    const unpaid     = subWorks.filter(w => w.paymentStatus !== 'Paid');
    const work       = unpaid.length > 0 ? unpaid[unpaid.length - 1] : subWorks[subWorks.length - 1];
    const outstanding = subWorks.reduce((s, w) => s + ((w.totalAmount || 0) - (w.paidAmount || 0)), 0);

    return {
      purpose: work.projectName || `Project ${work._id?.slice(-6)}`,
      amount:  outstanding > 0 ? String(outstanding) : String(work.totalAmount || ''),
      works:   subWorks,
    };
  };

  // ── Handle receiver selection with auto-fill ─────────────
  const handleReceiverSelect = (id, type, currentForm, setForm) => {
    const list  = receiverOptions(type);
    const found = list.find(i => i._id === id);
    if (!found) { setForm({ ...currentForm, receiverId: '', receiverName: '' }); return; }

    let autoFill = {};
    if (type === 'vendor') {
      const af = getVendorAutoFill(id);
      if (af) autoFill = { purpose: af.purpose, amount: af.amount };
    } else if (type === 'subcontractor') {
      const af = getSubAutoFill(id);
      if (af) autoFill = { purpose: af.purpose, amount: af.amount };
    }

    setForm({
      ...currentForm,
      receiverId:   id,
      receiverName: found.name,
      ...autoFill,
    });
  };

  const handleAddTypeChange = (type) => {
    setAddForm({ ...addForm, receiverType: type, receiverId: '', receiverName: '', purpose: '', amount: '' });
  };

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateId(''); setUpdateFound(null); setUpdateForm(emptyForm);
    setDeleteId(''); setDeleteFound(null);
    setSelectedId(''); setStatusFilter('All'); setSearchText('');
  };

  const calcBalance = (amount, paid) =>
    (parseFloat(amount) || 0) - (parseFloat(paid) || 0);

  const calcStatus = (amount, paid) => {
    const a = parseFloat(amount) || 0;
    const p = parseFloat(paid)   || 0;
    if (p <= 0) return 'Unpaid';
    if (p >= a) return 'Paid';
    return 'Partial';
  };

  // ── ADD ──────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.receiverType || !addForm.receiverName || !addForm.purpose || !addForm.amount) {
      showToast('Receiver Type, Name, Purpose and Amount are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API}/vouchers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverType:  addForm.receiverType,
          receiverName:  addForm.receiverName,
          purpose:       addForm.purpose,
          amount:        parseFloat(addForm.amount),
          paidAmount:    parseFloat(addForm.paidAmount) || 0,
          paymentMethod: addForm.paymentMethod,
          date:          addForm.date,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchVouchers();
        setAddForm(emptyForm);
        showToast(`✅ Voucher ${data.voucher?.voucherNumber} generated!`);
      } else showToast(data.message || 'Failed to create voucher', 'error');
    } catch { showToast('Error creating voucher', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ───────────────────────────────────────────────
  const handleUpdateSelect = (vid) => {
    setUpdateId(vid);
    const found = vouchers.find(v => v._id === vid);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        receiverType:  found.receiverType,
        receiverId:    '',
        receiverName:  found.receiverName,
        purpose:       found.purpose,
        amount:        found.amount,
        paidAmount:    found.paidAmount,
        paymentMethod: found.paymentMethod || 'cash',
        date:          found.date?.split('T')[0] || '',
      });
    } else { setUpdateFound(null); setUpdateForm(emptyForm); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a voucher', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/vouchers/update/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverType:  updateForm.receiverType,
          receiverName:  updateForm.receiverName,
          purpose:       updateForm.purpose,
          amount:        parseFloat(updateForm.amount),
          paidAmount:    parseFloat(updateForm.paidAmount) || 0,
          paymentMethod: updateForm.paymentMethod,
          date:          updateForm.date,
        }),
      });
      if (res.ok) {
        await fetchVouchers();
        showToast(`📝 Voucher ${updateFound.voucherNumber} updated!`);
        setUpdateFound(null); setUpdateId(''); setUpdateForm(emptyForm);
      } else showToast('Failed to update voucher', 'error');
    } catch { showToast('Error updating voucher', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ───────────────────────────────────────────────
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
        showToast(`🗑️ Voucher ${deleteFound.voucherNumber} deleted!`, 'info');
        setDeleteFound(null); setDeleteId('');
      } else showToast('Failed to delete voucher', 'error');
    } catch { showToast('Error deleting voucher', 'error'); }
    finally { setLoading(false); }
  };

  // ── Filtered vouchers ────────────────────────────────────
  const filteredVouchers = useMemo(() => {
    let list = vouchers;
    if (statusFilter !== 'All') {
      list = list.filter(v => calcStatus(v.amount, v.paidAmount) === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(v =>
        (v.voucherNumber || '').toLowerCase().includes(q) ||
        (v.receiverName  || '').toLowerCase().includes(q) ||
        (v.purpose       || '').toLowerCase().includes(q) ||
        (v.receiverType  || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [vouchers, statusFilter, searchText]);

  const countAll     = vouchers.length;
  const countPaid    = vouchers.filter(v => calcStatus(v.amount, v.paidAmount) === 'Paid').length;
  const countPartial = vouchers.filter(v => calcStatus(v.amount, v.paidAmount) === 'Partial').length;
  const countUnpaid  = vouchers.filter(v => calcStatus(v.amount, v.paidAmount) === 'Unpaid').length;

  const selectedVoucher = vouchers.find(v => v._id === selectedId);

  const statusBadge = (amount, paid) => {
    const s   = calcStatus(amount, paid);
    const map = { Paid: 'status-paid', Partial: 'status-partial', Unpaid: 'status-pending' };
    return <span className={`status-badge ${map[s]}`}>{s}</span>;
  };

  const typeBadge = (type) => (
    <span className={`type-badge type-${type}`}>{type === 'vendor' ? '🛒 Vendor' : '🔧 Subcontractor'}</span>
  );

  const methodBadge = (method) => (
    <span className="method-badge">{method === 'cash' ? '💵 Cash' : '💳 Online'}</span>
  );

  // ── Voucher dropdown options ─────────────────────────────
  const voucherOptions = vouchers.map(v => ({
    value: v._id,
    label: `${v.voucherNumber} — ${v.receiverType.toUpperCase()} — ${v.receiverName} — ₹${Number(v.amount).toLocaleString('en-IN')}`,
  }));

  // ── Auto-fill info banner for add form ───────────────────
  const addAutoFillInfo = useMemo(() => {
    if (!addForm.receiverId) return null;
    if (addForm.receiverType === 'vendor') {
      const af = getVendorAutoFill(addForm.receiverId);
      if (!af) return null;
      const outstanding = af.bills.reduce((s, b) => s + ((b.netTotal || 0) - (b.paidAmount || 0)), 0);
      return { label: `${af.bills.length} purchase bill(s) · Outstanding: ₹${outstanding.toLocaleString('en-IN')}` };
    }
    if (addForm.receiverType === 'subcontractor') {
      const af = getSubAutoFill(addForm.receiverId);
      if (!af) return null;
      const outstanding = af.works.reduce((s, w) => s + ((w.totalAmount || 0) - (w.paidAmount || 0)), 0);
      return { label: `${af.works.length} project(s) · Outstanding: ₹${outstanding.toLocaleString('en-IN')}` };
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addForm.receiverId, addForm.receiverType, purchases, works]);

  // ── Receiver form section (shared) ───────────────────────
  const ReceiverSection = ({ form, setForm, isAdd }) => {
    const sddOptions = receiverOptions(form.receiverType).map(item => ({
      value: item._id,
      label: getReceiverLabel(item, form.receiverType),
    }));

    return (
      <>
        <div className="form-field">
          <label className="field-label">Receiver Type *</label>
          <div className="voucher-type-toggle">
            {RECEIVER_TYPES.map(t => (
              <button key={t} type="button"
                className={`vtype-btn ${form.receiverType === t ? 'active' : ''}`}
                onClick={() => isAdd
                  ? handleAddTypeChange(t)
                  : setForm({ ...form, receiverType: t, receiverId: '', receiverName: '', purpose: '', amount: '' })
                }>
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
            onChange={id => handleReceiverSelect(id, form.receiverType, form, setForm)}
            placeholder={`Search ${form.receiverType === 'vendor' ? 'vendor' : 'subcontractor'}...`}
          />
        </div>
      </>
    );
  };

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
          <button className="action-btn voucher-btn-add"    onClick={() => togglePanel(PANELS.ADD)}>➕ Add Voucher</button>
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

                <ReceiverSection form={addForm} setForm={setAddForm} isAdd={true} />

                {/* Auto-fill info banner */}
                {addAutoFillInfo && (
                  <div className="autofill-banner full-width">
                    <span className="autofill-icon">✨</span>
                    <span>Auto-filled from existing records — <strong>{addAutoFillInfo.label}</strong></span>
                    <span className="autofill-hint">You can edit fields below</span>
                  </div>
                )}

                <div className="form-field">
                  <label className="field-label">Purpose *</label>
                  <input className="field-input" placeholder="Payment purpose / description"
                    value={addForm.purpose} onChange={e => setAddForm({ ...addForm, purpose: e.target.value })} />
                </div>

                <div className="form-field">
                  <label className="field-label">Total Amount (₹) *</label>
                  <input className="field-input" type="number" placeholder="0.00"
                    value={addForm.amount} onChange={e => setAddForm({ ...addForm, amount: e.target.value })} />
                </div>

                <div className="form-field">
                  <label className="field-label">Paid Amount (₹)</label>
                  <input className="field-input" type="number" placeholder="0.00"
                    value={addForm.paidAmount} onChange={e => setAddForm({ ...addForm, paidAmount: e.target.value })} />
                </div>

                {addForm.amount && (
                  <div className="form-field">
                    <label className="field-label">Balance (₹)</label>
                    <input className="field-input voucher-calc-field" readOnly
                      value={`₹${calcBalance(addForm.amount, addForm.paidAmount).toLocaleString('en-IN')}`} />
                  </div>
                )}

                <div className="form-field">
                  <label className="field-label">Payment Method</label>
                  <div className="voucher-type-toggle">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} type="button"
                        className={`vtype-btn ${addForm.paymentMethod === m ? 'active' : ''}`}
                        onClick={() => setAddForm({ ...addForm, paymentMethod: m })}>
                        {m === 'cash' ? '💵 Cash' : '💳 Online'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label">Date</label>
                  <input className="field-input" type="date"
                    value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} />
                </div>

              </div>

              {addForm.amount && (
                <div className="voucher-preview-bar">
                  <span>Total: <strong>₹{Number(addForm.amount || 0).toLocaleString('en-IN')}</strong></span>
                  <span>Paid: <strong>₹{Number(addForm.paidAmount || 0).toLocaleString('en-IN')}</strong></span>
                  <span>Balance: <strong>₹{calcBalance(addForm.amount, addForm.paidAmount).toLocaleString('en-IN')}</strong></span>
                  <span>Status: {statusBadge(addForm.amount, addForm.paidAmount)}</span>
                </div>
              )}

              <div className="vendor-id-preview">
                🪪 Voucher No: <strong>VO*** (auto-generated)</strong> &nbsp;·&nbsp; PDF generated automatically
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
                  <span className="update-found-name">{updateFound.receiverName}</span>
                  <span style={{ fontSize: 12, color: '#666' }}>— {updateFound.receiverType}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row voucher-form-grid">

                    <div className="form-field">
                      <label className="field-label">Receiver Type</label>
                      <div className="voucher-type-toggle">
                        {RECEIVER_TYPES.map(t => (
                          <button key={t} type="button"
                            className={`vtype-btn ${updateForm.receiverType === t ? 'active' : ''}`}
                            onClick={() => setUpdateForm({ ...updateForm, receiverType: t, receiverName: '' })}>
                            {t === 'vendor' ? '🛒 Vendor' : '🔧 Subcontractor'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="field-label">Select {updateForm.receiverType === 'vendor' ? 'Vendor' : 'Subcontractor'}</label>
                      <SearchableDropdown
                        options={receiverOptions(updateForm.receiverType).map(item => ({
                          value: item._id,
                          label: getReceiverLabel(item, updateForm.receiverType),
                        }))}
                        value={updateForm.receiverId || ''}
                        onChange={id => handleReceiverSelect(id, updateForm.receiverType, updateForm, setUpdateForm)}
                        placeholder={`Keep current: ${updateFound.receiverName}`}
                      />
                    </div>

                    <div className="form-field">
                      <label className="field-label">Purpose</label>
                      <input className="field-input" value={updateForm.purpose}
                        onChange={e => setUpdateForm({ ...updateForm, purpose: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Total Amount (₹)</label>
                      <input className="field-input" type="number" value={updateForm.amount}
                        onChange={e => setUpdateForm({ ...updateForm, amount: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Paid Amount (₹)</label>
                      <input className="field-input" type="number" value={updateForm.paidAmount}
                        onChange={e => setUpdateForm({ ...updateForm, paidAmount: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Payment Method</label>
                      <div className="voucher-type-toggle">
                        {PAYMENT_METHODS.map(m => (
                          <button key={m} type="button"
                            className={`vtype-btn ${updateForm.paymentMethod === m ? 'active' : ''}`}
                            onClick={() => setUpdateForm({ ...updateForm, paymentMethod: m })}>
                            {m === 'cash' ? '💵 Cash' : '💳 Online'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="field-label">Date</label>
                      <input className="field-input" type="date" value={updateForm.date}
                        onChange={e => setUpdateForm({ ...updateForm, date: e.target.value })} />
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
                  ['Voucher No',     deleteFound.voucherNumber],
                  ['Receiver Type',  deleteFound.receiverType],
                  ['Receiver Name',  deleteFound.receiverName],
                  ['Purpose',        deleteFound.purpose],
                  ['Total Amount',   `₹${Number(deleteFound.amount).toLocaleString('en-IN')}`],
                  ['Paid Amount',    `₹${Number(deleteFound.paidAmount   || 0).toLocaleString('en-IN')}`],
                  ['Balance',        `₹${Number(deleteFound.balanceAmount|| 0).toLocaleString('en-IN')}`],
                  ['Payment Method', deleteFound.paymentMethod],
                  ['Date',           deleteFound.date?.split('T')[0]],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                ))}
                <div className="vendor-delete-warn">⚠️ Deleting this voucher is permanent and cannot be undone.</div>
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
            <div className="panel-title">📋 All Vouchers</div>

            {/* Summary stat cards */}
            <div className="voucher-stat-cards">
              <div className="vsc vsc-total"><span>Total Vouchers</span><strong>{countAll}</strong></div>
              <div className="vsc vsc-amount"><span>Total Amount</span><strong>₹{vouchers.reduce((s, v) => s + (v.amount || 0), 0).toLocaleString('en-IN')}</strong></div>
              <div className="vsc vsc-paid"><span>Total Paid</span><strong>₹{vouchers.reduce((s, v) => s + (v.paidAmount || 0), 0).toLocaleString('en-IN')}</strong></div>
              <div className="vsc vsc-balance"><span>Total Balance</span><strong>₹{vouchers.reduce((s, v) => s + (v.balanceAmount || 0), 0).toLocaleString('en-IN')}</strong></div>
            </div>

            {/* ── Filters toolbar ── */}
            <div className="getall-filter-bar">
              {/* Search */}
              <div className="getall-search-wrap">
                <span className="getall-search-icon">🔍</span>
                <input
                  className="getall-search-input"
                  placeholder="Search by voucher no, receiver, purpose..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
                {searchText && <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>}
              </div>

              {/* Status filter tabs */}
              <div className="inv-status-filter-row" style={{ margin: 0 }}>
                {[
                  { label: 'All',     count: countAll,     key: 'All',     cls: 'filter-all'     },
                  { label: 'Paid',    count: countPaid,    key: 'Paid',    cls: 'filter-paid'    },
                  { label: 'Partial', count: countPartial, key: 'Partial', cls: 'filter-partial' },
                  { label: 'Unpaid',  count: countUnpaid,  key: 'Unpaid',  cls: 'filter-unpaid'  },
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
              <div className="empty-state"><div className="empty-icon">📭</div><p>No vouchers found.</p></div>
            ) : (
              <>
                {/* Detail dropdown */}
                <div className="form-field" style={{ marginBottom: 20 }}>
                  <label className="field-label">Select Voucher (View Details)</label>
                  <SearchableDropdown
                    options={filteredVouchers.map(v => ({
                      value: v._id,
                      label: `${v.voucherNumber} — ${v.receiverName} — ₹${Number(v.amount).toLocaleString('en-IN')}`,
                    }))}
                    value={selectedId}
                    onChange={setSelectedId}
                    placeholder="Search and select voucher to view details..."
                  />
                </div>

                {/* Result count */}
                <div style={{ marginBottom: 10, fontSize: 13, color: '#8898b0', fontWeight: 600 }}>
                  Showing {filteredVouchers.length} of {vouchers.length} vouchers
                </div>

                {/* Detail card */}
                {selectedVoucher && (
                  <div className="voucher-detail-card">
                    <div className="voucher-detail-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span className="voucher-no-tag">{selectedVoucher.voucherNumber}</span>
                        {typeBadge(selectedVoucher.receiverType)}
                        {methodBadge(selectedVoucher.paymentMethod)}
                        {statusBadge(selectedVoucher.amount, selectedVoucher.paidAmount)}
                      </div>
                      <button className="inv-detail-close" onClick={() => setSelectedId('')}>✕</button>
                    </div>
                    <div className="voucher-detail-grid">
                      {[
                        ['Receiver',        selectedVoucher.receiverName],
                        ['Type',            selectedVoucher.receiverType],
                        ['Purpose',         selectedVoucher.purpose],
                        ['Total Amount',    `₹${Number(selectedVoucher.amount).toLocaleString('en-IN')}`],
                        ['Paid Amount',     `₹${Number(selectedVoucher.paidAmount  || 0).toLocaleString('en-IN')}`],
                        ['Balance',         `₹${Number(selectedVoucher.balanceAmount|| 0).toLocaleString('en-IN')}`],
                        ['Payment Method',  selectedVoucher.paymentMethod],
                        ['Date',            selectedVoucher.date?.split('T')[0]],
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
                  <div className="empty-state"><div className="empty-icon">🔍</div><p>No vouchers match your filter.</p></div>
                ) : (
                  <div className="voucher-card-list">
                    {filteredVouchers.map(v => {
                      const balance    = (v.amount || 0) - (v.paidAmount || 0);
                      const isSelected = selectedId === v._id;
                      return (
                        <div key={v._id}
                          className={`voucher-row-card ${isSelected ? 'voucher-row-selected' : ''}`}
                          onClick={() => setSelectedId(isSelected ? '' : v._id)}>
                          <div className="voucher-row-left">
                            <span className="voucher-no-tag">{v.voucherNumber}</span>
                            {typeBadge(v.receiverType)}
                          </div>
                          <div className="voucher-row-mid">
                            <div className="voucher-row-receiver">{v.receiverName}</div>
                            <div className="voucher-row-purpose">{v.purpose}</div>
                            <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                              <span className="voucher-row-amt">₹{Number(v.amount).toLocaleString('en-IN')}</span>
                              <span className="voucher-row-paid">Paid ₹{Number(v.paidAmount || 0).toLocaleString('en-IN')}</span>
                              {balance > 0 && <span className="voucher-row-bal">Bal ₹{Number(balance).toLocaleString('en-IN')}</span>}
                            </div>
                          </div>
                          <div className="voucher-row-right">
                            {methodBadge(v.paymentMethod)}
                            {statusBadge(v.amount, v.paidAmount)}
                            <div className="voucher-row-date">{v.date?.split('T')[0]}</div>
                            {v.pdfUrl && (
                              <a href={v.pdfUrl} target="_blank" rel="noreferrer"
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

export default VoucherPage;