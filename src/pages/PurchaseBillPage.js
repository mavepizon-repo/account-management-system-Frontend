import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableDropdown from '../components/SearchableDropdown';
import '../styles/EntityPage.css';
import '../styles/PurchaseBillPage.css';
import '../styles/SearchableDropdown.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };
const emptyBill = { vendor: '', invoiceNo: '', purpose: '', totalPayment: '', gstInput: '0' };

function PurchaseBillPage({ onLogout }) {
  const navigate = useNavigate();

  const [vendors,   setVendors]   = useState([]);
  const [bills,     setBills]     = useState([]);
  const [activePanel, setPanel]   = useState(null);
  const [toast,     setToast]     = useState(null);
  const [loading,   setLoading]   = useState(false);

  const [addForm,      setAddForm]      = useState(emptyBill);
  const [updateBillId, setUpdateBillId] = useState('');
  const [updateFound,  setUpdateFound]  = useState(null);
  const [updateForm,   setUpdateForm]   = useState(emptyBill);
  const [deleteBillId, setDeleteBillId] = useState('');
  const [deleteFound,  setDeleteFound]  = useState(null);

  // GETALL filters
  const [selectedBillId, setSelectedBillId] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [vendorFilter,   setVendorFilter]   = useState('');
  const [searchText,     setSearchText]     = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);

  const fetchVendors = async () => {
    try {
      const res  = await fetch(`${API}/vendor/getall`);
      const data = await res.json();
      setVendors(data || []);
    } catch { showToast('Failed to fetch vendors', 'error'); }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/purchase/getall/purchasebill`);
      const data = await res.json();
      setBills(data || []);
    } catch { showToast('Failed to fetch bills', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVendors(); fetchBills(); }, []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyBill);
    setUpdateBillId(''); setUpdateForm(emptyBill); setUpdateFound(null);
    setDeleteBillId(''); setDeleteFound(null);
    setSelectedBillId('');
    setStatusFilter('All'); setVendorFilter(''); setSearchText('');
  };

  const getVendorLabel = (bill) => {
    if (bill.vendor?.name) return `${bill.vendor.vendorCode} — ${bill.vendor.name}`;
    const found = vendors.find(v => v._id === (bill.vendor?._id || bill.vendor));
    return found ? `${found.vendorCode} — ${found.name}` : '—';
  };

  const statusBadge = (status) => {
    const map = {
      paid:    { cls: 'status-paid',    label: 'Paid' },
      partial: { cls: 'status-partial', label: 'Partial' },
      unpaid:  { cls: 'status-pending', label: 'Unpaid' },
    };
    const s = map[status?.toLowerCase()] || map.unpaid;
    return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
  };

  const calcNetTotal = (tp, gst) => (parseFloat(tp) || 0) + (parseFloat(gst) || 0);

  // ── Dropdown options ─────────────────────────────────────
  const vendorOptions = vendors.map(v => ({
    value: v._id,
    label: `${v.vendorCode} — ${v.name}${v.phone ? ` (${v.phone})` : ''}`,
  }));

  const billOptions = bills.map(b => ({
    value: b._id,
    label: `${b.purchaseCode} — ${getVendorLabel(b)} — Inv: ${b.invoiceNo} — ${(b.status || 'unpaid').toUpperCase()} — ₹${Number(b.netTotal || 0).toLocaleString('en-IN')}`,
  }));

  const vendorFilterOptions = [
    { value: '', label: 'All Vendors' },
    ...vendors.map(v => ({ value: v._id, label: `${v.vendorCode} — ${v.name}` })),
  ];

  // ── Filtered bills ───────────────────────────────────────
  const filteredBills = useMemo(() => {
    let list = bills;
    if (statusFilter !== 'All')
      list = list.filter(b => (b.status || 'unpaid').toLowerCase() === statusFilter.toLowerCase());
    if (vendorFilter)
      list = list.filter(b => (b.vendor?._id || b.vendor) === vendorFilter);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(b =>
        (b.purchaseCode || '').toLowerCase().includes(q) ||
        (b.invoiceNo    || '').toLowerCase().includes(q) ||
        (b.purpose      || '').toLowerCase().includes(q) ||
        getVendorLabel(b).toLowerCase().includes(q)
      );
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, statusFilter, vendorFilter, searchText]);

  const countAll     = bills.length;
  const countPaid    = bills.filter(b => b.status === 'paid').length;
  const countPartial = bills.filter(b => b.status === 'partial').length;
  const countUnpaid  = bills.filter(b => !b.status || b.status === 'unpaid').length;

  // ── ADD ──────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.vendor || !addForm.invoiceNo || !addForm.totalPayment) {
      showToast('Vendor, Invoice No and Total Payment are required', 'error'); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API}/purchase/add/purchasebill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor:       addForm.vendor,
          invoiceNo:    addForm.invoiceNo,
          purpose:      addForm.purpose,
          totalPayment: parseFloat(addForm.totalPayment),
          gstInput:     parseFloat(addForm.gstInput) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) { await fetchBills(); setAddForm(emptyBill); showToast(`Bill ${data.purchaseCode} added!`); }
      else showToast(data.message || 'Failed to add bill', 'error');
    } catch { showToast('Error adding bill', 'error'); }
    finally { setLoading(false); }
  };

  // ── UPDATE ───────────────────────────────────────────────
  const handleUpdateSelect = (billId) => {
    setUpdateBillId(billId);
    const found = bills.find(b => b._id === billId);
    if (found) {
      setUpdateFound(found);
      setUpdateForm({
        vendor:       found.vendor?._id || found.vendor,
        invoiceNo:    found.invoiceNo,
        purpose:      found.purpose || '',
        totalPayment: found.totalPayment,
        gstInput:     found.gstInput || 0,
      });
    } else { setUpdateFound(null); setUpdateForm(emptyBill); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updateFound) { showToast('Please select a bill', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/purchase/edit/purchasebill/${updateFound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor:       updateForm.vendor,
          invoiceNo:    updateForm.invoiceNo,
          purpose:      updateForm.purpose,
          totalPayment: parseFloat(updateForm.totalPayment),
          gstInput:     parseFloat(updateForm.gstInput) || 0,
        }),
      });
      if (res.ok) {
        await fetchBills(); showToast(`Bill ${updateFound.purchaseCode} updated!`);
        setUpdateFound(null); setUpdateBillId(''); setUpdateForm(emptyBill);
      } else showToast('Failed to update bill', 'error');
    } catch { showToast('Error updating bill', 'error'); }
    finally { setLoading(false); }
  };

  // ── DELETE ───────────────────────────────────────────────
  const handleDeleteSelect = (billId) => {
    setDeleteBillId(billId);
    setDeleteFound(bills.find(b => b._id === billId) || null);
  };

  const handleDelete = async () => {
    if (!deleteFound) { showToast('Please select a bill', 'error'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${API}/purchase/delete/purchasebill/${deleteFound._id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchBills(); showToast(`Bill ${deleteFound.purchaseCode} deleted!`, 'info');
        setDeleteFound(null); setDeleteBillId('');
      } else showToast('Failed to delete bill', 'error');
    } catch { showToast('Error deleting bill', 'error'); }
    finally { setLoading(false); }
  };

  const selectedBillObj = bills.find(b => b._id === selectedBillId);

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">

        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/vendor')}>←</button>
          <h1 className="entity-page-title">🧾 Purchase Bill Management</h1>
          <span className="entity-page-badge" style={{ background: '#f0f4ff', color: '#5b7fff', border: '1px solid #c8d4ff' }}>
            {bills.length} Bills
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>➕ Add Purchase Bill</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>✏️ Update Purchase Bill</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>🗑️ Delete Purchase Bill</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>📋 All Purchase Bills</button>
        </div>

        {loading && <div className="loading-bar"><div className="loading-inner" /></div>}

        {/* ════ ADD ════ */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Add New Purchase Bill</div>
            <form onSubmit={handleAdd}>
              <div className="form-row bill-form-grid">
                <div className="form-field">
                  <label className="field-label">Vendor *</label>
                  <SearchableDropdown
                    options={vendorOptions}
                    value={addForm.vendor}
                    onChange={val => setAddForm({ ...addForm, vendor: val })}
                    placeholder="Search and select vendor..."
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">Invoice No *</label>
                  <input className="field-input" placeholder="INV-001" value={addForm.invoiceNo}
                    onChange={e => setAddForm({ ...addForm, invoiceNo: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">Total Payment (₹) *</label>
                  <input className="field-input" type="number" placeholder="0.00" value={addForm.totalPayment}
                    onChange={e => setAddForm({ ...addForm, totalPayment: e.target.value })} />
                </div>
                <div className="form-field">
                  <label className="field-label">GST Input (₹)</label>
                  <input className="field-input" type="number" placeholder="0.00" value={addForm.gstInput}
                    onChange={e => setAddForm({ ...addForm, gstInput: e.target.value })} />
                </div>
                <div className="form-field full-width">
                  <label className="field-label">Purpose</label>
                  <input className="field-input" placeholder="Items / services purchased" value={addForm.purpose}
                    onChange={e => setAddForm({ ...addForm, purpose: e.target.value })} />
                </div>
              </div>
              {addForm.totalPayment && (
                <div className="bill-net-preview">
                  Net Total: <strong>₹{calcNetTotal(addForm.totalPayment, addForm.gstInput).toLocaleString('en-IN')}</strong>
                </div>
              )}
              <div className="vendor-id-preview">
                🪪 Auto Code: <strong>PC*** (auto-generated)</strong>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>➕ Add Bill</button>
            </form>
          </div>
        )}

        {/* ════ UPDATE ════ */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">✏️ Update Purchase Bill</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Purchase Bill *</label>
              <SearchableDropdown
                options={billOptions}
                value={updateBillId}
                onChange={handleUpdateSelect}
                placeholder="Search purchase bill by code, vendor or invoice..."
              />
            </div>
            {updateFound && (
              <>
                <div className="update-found-badge">
                  <span className="update-found-id">{updateFound.purchaseCode}</span>
                  <span className="update-found-name">{getVendorLabel(updateFound)}</span>
                </div>
                <form onSubmit={handleUpdate}>
                  <div className="form-row bill-form-grid">
                    <div className="form-field">
                      <label className="field-label">Vendor *</label>
                      <SearchableDropdown
                        options={vendorOptions}
                        value={updateForm.vendor}
                        onChange={val => setUpdateForm({ ...updateForm, vendor: val })}
                        placeholder="Search and select vendor..."
                      />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Invoice No *</label>
                      <input className="field-input" value={updateForm.invoiceNo}
                        onChange={e => setUpdateForm({ ...updateForm, invoiceNo: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">Total Payment (₹) *</label>
                      <input className="field-input" type="number" value={updateForm.totalPayment}
                        onChange={e => setUpdateForm({ ...updateForm, totalPayment: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label className="field-label">GST Input (₹)</label>
                      <input className="field-input" type="number" value={updateForm.gstInput}
                        onChange={e => setUpdateForm({ ...updateForm, gstInput: e.target.value })} />
                    </div>
                    <div className="form-field full-width">
                      <label className="field-label">Purpose</label>
                      <input className="field-input" value={updateForm.purpose}
                        onChange={e => setUpdateForm({ ...updateForm, purpose: e.target.value })} />
                    </div>
                  </div>
                  {updateForm.totalPayment && (
                    <div className="bill-net-preview">
                      Net Total: <strong>₹{calcNetTotal(updateForm.totalPayment, updateForm.gstInput).toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                  <button type="submit" className="submit-btn" disabled={loading}
                    style={{ background: 'linear-gradient(135deg,#ffe08a,#ffb84a)', color: '#6b4200', boxShadow: '0 5px 18px rgba(255,184,74,0.30)' }}>
                    ✏️ Update Bill
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* ════ DELETE ════ */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">🗑️ Delete Purchase Bill</div>
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label className="field-label">Select Purchase Bill *</label>
              <SearchableDropdown
                options={billOptions}
                value={deleteBillId}
                onChange={handleDeleteSelect}
                placeholder="Search purchase bill to delete..."
              />
            </div>
            {deleteFound && (
              <div className="detail-card" style={{ marginTop: 20 }}>
                {[
                  ['Purchase Bill', deleteFound.purchaseCode],
                  ['Vendor',        getVendorLabel(deleteFound)],
                  ['Invoice No',    deleteFound.invoiceNo],
                  ['Purpose',       deleteFound.purpose || '—'],
                  ['Total Payment', `₹${(deleteFound.totalPayment || 0).toLocaleString('en-IN')}`],
                  ['GST Input',     `₹${(deleteFound.gstInput    || 0).toLocaleString('en-IN')}`],
                  ['Net Total',     `₹${(deleteFound.netTotal    || 0).toLocaleString('en-IN')}`],
                  ['Paid Amount',   `₹${(deleteFound.paidAmount  || 0).toLocaleString('en-IN')}`],
                  ['Balance',       `₹${((deleteFound.netTotal || 0) - (deleteFound.paidAmount || 0)).toLocaleString('en-IN')}`],
                  ['Status',        statusBadge(deleteFound.status)],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span className="detail-key">{k}</span>
                    <span className="detail-val">{v}</span>
                  </div>
                ))}
                <div className="vendor-delete-warn">⚠️ Deleting this purchase bill is permanent and cannot be undone.</div>
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
            <div className="panel-title">📋 All Purchase Bills</div>

            {/* Summary stat cards */}
            <div className="bill-stat-cards">
              <div className="bill-stat-card bsc-total">
                <span>Total Bills</span>
                <strong>{countAll}</strong>
              </div>
              <div className="bill-stat-card bsc-net">
                <span>Total Net</span>
                <strong>₹{bills.reduce((s, b) => s + (b.netTotal || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="bill-stat-card bsc-paid">
                <span>Total Paid</span>
                <strong>₹{bills.reduce((s, b) => s + (b.paidAmount || 0), 0).toLocaleString('en-IN')}</strong>
              </div>
              <div className="bill-stat-card bsc-due">
                <span>Total Due</span>
                <strong>₹{bills.reduce((s, b) => s + ((b.netTotal || 0) - (b.paidAmount || 0)), 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {bills.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📭</div><p>No purchase bills found.</p></div>
            ) : (
              <>
                {/* ── Filters toolbar ── */}
                <div className="getall-filter-bar">
                  <div className="getall-search-wrap">
                    <span className="getall-search-icon">🔍</span>
                    <input
                      className="getall-search-input"
                      placeholder="Search by code, invoice, vendor, purpose..."
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                    />
                    {searchText && <button className="getall-search-clear" onClick={() => setSearchText('')}>✕</button>}
                  </div>

                  <div className="inv-status-filter-row" style={{ margin: 0 }}>
                    {[
                      { label: 'All',     count: countAll,     key: 'All',     cls: 'filter-all'     },
                      { label: 'Paid',    count: countPaid,    key: 'paid',    cls: 'filter-paid'    },
                      { label: 'Partial', count: countPartial, key: 'partial', cls: 'filter-partial' },
                      { label: 'Unpaid',  count: countUnpaid,  key: 'unpaid',  cls: 'filter-unpaid'  },
                    ].map(tab => (
                      <button key={tab.key}
                        className={`inv-filter-tab ${tab.cls} ${statusFilter === tab.key ? 'active' : ''}`}
                        onClick={() => { setStatusFilter(tab.key); setSelectedBillId(''); }}>
                        {tab.label}<span className="inv-filter-count">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vendor filter */}
                <div className="form-field" style={{ marginBottom: 16, maxWidth: 400 }}>
                  <label className="field-label">Filter by Vendor</label>
                  <SearchableDropdown
                    options={vendorFilterOptions}
                    value={vendorFilter}
                    onChange={(val) => { setVendorFilter(val); setSelectedBillId(''); }}
                    placeholder="All Vendors"
                  />
                </div>

                {/* Results count */}
                <div style={{ marginBottom: 10, fontSize: 13, color: '#8898b0', fontWeight: 600 }}>
                  Showing {filteredBills.length} of {bills.length} bills
                </div>

                {filteredBills.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">🔍</div><p>No bills match your filter.</p></div>
                ) : (
                  <>
                    {/* Selected bill detail card */}
                    {selectedBillObj && (
                      <div className="bill-detail-card">
                        <div className="bill-detail-header">
                          <div>
                            <span className="bill-no-tag" style={{ marginRight: 10 }}>{selectedBillObj.purchaseCode}</span>
                            <span style={{ fontWeight: 700, fontSize: 16 }}>{selectedBillObj.purpose || 'Purchase'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {statusBadge(selectedBillObj.status)}
                            <button className="inv-detail-close" onClick={() => setSelectedBillId('')}>✕</button>
                          </div>
                        </div>
                        <div className="bill-detail-grid">
                          {[
                            ['Purchase Bill', selectedBillObj.purchaseCode],
                            ['Vendor',        getVendorLabel(selectedBillObj)],
                            ['Invoice No',    selectedBillObj.invoiceNo],
                            ['Purpose',       selectedBillObj.purpose || '—'],
                            ['Total Payment', `₹${(selectedBillObj.totalPayment || 0).toLocaleString('en-IN')}`],
                            ['GST Input',     `₹${(selectedBillObj.gstInput    || 0).toLocaleString('en-IN')}`],
                            ['Net Total',     `₹${(selectedBillObj.netTotal    || 0).toLocaleString('en-IN')}`],
                            ['Paid Amount',   `₹${(selectedBillObj.paidAmount  || 0).toLocaleString('en-IN')}`],
                            ['Balance',       `₹${((selectedBillObj.netTotal || 0) - (selectedBillObj.paidAmount || 0)).toLocaleString('en-IN')}`],
                          ].map(([k, v]) => (
                            <div className="bill-detail-item" key={k}>
                              <span className="bill-detail-key">{k}</span>
                              <span className="bill-detail-val">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bill card list — NO pay button */}
                    <div className="bill-card-list">
                      {filteredBills.map(b => {
                        const balance    = (b.netTotal || 0) - (b.paidAmount || 0);
                        const isSelected = selectedBillId === b._id;
                        return (
                          <div key={b._id}
                            className={`bill-row-card ${isSelected ? 'bill-row-selected' : ''}`}
                            onClick={() => setSelectedBillId(isSelected ? '' : b._id)}>
                            <div className="bill-row-left">
                              <span className="bill-no-tag">{b.purchaseCode}</span>
                              <div className="bill-row-vendor">{getVendorLabel(b)}</div>
                              <div className="bill-row-invoice">Invoice: {b.invoiceNo}</div>
                            </div>
                            <div className="bill-row-mid">
                              <div className="bill-row-purpose">{b.purpose || '—'}</div>
                              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                                <span className="bill-row-amt">₹{Number(b.netTotal).toLocaleString('en-IN')}</span>
                                <span className="bill-row-paid">Paid ₹{Number(b.paidAmount).toLocaleString('en-IN')}</span>
                                {balance > 0 && <span className="bill-row-bal">Bal ₹{Number(balance).toLocaleString('en-IN')}</span>}
                              </div>
                            </div>
                            <div className="bill-row-right">
                              {statusBadge(b.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
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

export default PurchaseBillPage;