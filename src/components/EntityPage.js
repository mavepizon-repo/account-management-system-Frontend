import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import '../styles/EntityPage.css';

const PANELS = { ADD: 'add', UPDATE: 'update', DELETE: 'delete', GETALL: 'getall' };

function EntityPage({ onLogout, entityName, icon, color, accentBg, fields, initialData }) {
  const navigate = useNavigate();

  const [items, setItems]       = useState(initialData || []);
  const [activePanel, setPanel] = useState(null);
  const [toast, setToast]       = useState(null);

  // Dynamic form state
  const emptyForm = fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});
  const [addForm, setAddForm]         = useState(emptyForm);
  const [updateId, setUpdateId]       = useState('');
  const [updateForm, setUpdateForm]   = useState(emptyForm);
  const [updateFound, setUpdateFound] = useState(null);
  const [deleteId, setDeleteId]       = useState('');
  const [deleteFound, setDeleteFound] = useState(null);
  const [selectedItem, setSelectedItem] = useState('');

  let nextIdRef = React.useRef((initialData || []).length + 1);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const togglePanel = (panel) => {
    setPanel(prev => prev === panel ? null : panel);
    setAddForm(emptyForm);
    setUpdateId(''); setUpdateForm(emptyForm); setUpdateFound(null);
    setDeleteId(''); setDeleteFound(null); setSelectedItem('');
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const missing = fields.find(f => f.required && !addForm[f.key]);
    if (missing) { showToast(`${missing.label} is required`, 'error'); return; }
    const newItem = { id: nextIdRef.current++, ...addForm };
    setItems(prev => [...prev, newItem]);
    setAddForm(emptyForm);
    showToast(`✨ ${addForm[fields[0].key]} added successfully!`);
  };

  const handleUpdateSearch = () => {
    const found = items.find(i => i.id === parseInt(updateId));
    if (found) {
      setUpdateFound(found);
      const form = fields.reduce((acc, f) => ({ ...acc, [f.key]: found[f.key] }), {});
      setUpdateForm(form);
    } else {
      showToast('ID not found', 'error'); setUpdateFound(null);
    }
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    setItems(prev => prev.map(i => i.id === updateFound.id ? { ...i, ...updateForm } : i));
    showToast(`📝 Updated successfully!`);
    setUpdateFound(null); setUpdateId(''); setUpdateForm(emptyForm);
  };

  const handleDeleteSearch = () => {
    const found = items.find(i => i.id === parseInt(deleteId));
    if (found) { setDeleteFound(found); }
    else { showToast('ID not found', 'error'); setDeleteFound(null); }
  };

  const handleDelete = () => {
    setItems(prev => prev.filter(i => i.id !== deleteFound.id));
    showToast(`🗑️ Deleted successfully!`, 'info');
    setDeleteFound(null); setDeleteId('');
  };

  const selectedItemObj = items.find(i => i.id === parseInt(selectedItem));
  const firstName = fields[0];

  return (
    <div className="entity-wrapper">
      <Navbar onLogout={onLogout} />
      <div className="entity-main">
        <div className="entity-page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
          <h1 className="entity-page-title">{icon} {entityName} Management</h1>
          <span className="entity-page-badge" style={{ background: accentBg, color }}>
            {items.length} {entityName}s
          </span>
        </div>

        <div className="actions-row">
          <button className="action-btn btn-add"    onClick={() => togglePanel(PANELS.ADD)}>➕ Add {entityName}</button>
          <button className="action-btn btn-update" onClick={() => togglePanel(PANELS.UPDATE)}>✏️ Update {entityName}</button>
          <button className="action-btn btn-delete" onClick={() => togglePanel(PANELS.DELETE)}>🗑️ Delete {entityName}</button>
          <button className="action-btn btn-getall" onClick={() => togglePanel(PANELS.GETALL)}>📋 Get All {entityName}s</button>
        </div>

        {/* ADD */}
        {activePanel === PANELS.ADD && (
          <div className="panel-section" key="add">
            <div className="panel-title">➕ Add New {entityName}</div>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                {fields.map(f => (
                  <div key={f.key} className={`form-field ${f.fullWidth ? 'full-width' : ''}`}>
                    <label className="field-label">{f.label} {f.required ? '*' : ''}</label>
                    {f.type === 'textarea' ? (
                      <textarea
                        className="field-input"
                        placeholder={f.placeholder}
                        value={addForm[f.key]}
                        onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })}
                      />
                    ) : (
                      <input
                        className="field-input"
                        type={f.inputType || 'text'}
                        placeholder={f.placeholder}
                        maxLength={f.maxLength}
                        value={addForm[f.key]}
                        onChange={e => setAddForm({ ...addForm, [f.key]: f.numbersOnly ? e.target.value.replace(/\D/, '') : e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button type="submit" className="submit-btn">➕ Add {entityName}</button>
            </form>
          </div>
        )}

        {/* UPDATE */}
        {activePanel === PANELS.UPDATE && (
          <div className="panel-section" key="update">
            <div className="panel-title">✏️ Update {entityName}</div>
            <div className="delete-input-row" style={{ marginBottom: 20 }}>
              <div className="form-field" style={{ flex: 1 }}>
                <label className="field-label">Enter ID</label>
                <input className="field-input" type="number" placeholder="ID" value={updateId} onChange={e => setUpdateId(e.target.value)} />
              </div>
              <button className="submit-btn" type="button" onClick={handleUpdateSearch} style={{ marginTop: 20 }}>🔍 Search</button>
            </div>
            {updateFound && (
              <form onSubmit={handleUpdate}>
                <div className="form-row">
                  {fields.map(f => (
                    <div key={f.key} className={`form-field ${f.fullWidth ? 'full-width' : ''}`}>
                      <label className="field-label">{f.label}</label>
                      {f.type === 'textarea' ? (
                        <textarea className="field-input" value={updateForm[f.key]} onChange={e => setUpdateForm({ ...updateForm, [f.key]: e.target.value })} />
                      ) : (
                        <input className="field-input" type={f.inputType || 'text'} maxLength={f.maxLength} value={updateForm[f.key]} onChange={e => setUpdateForm({ ...updateForm, [f.key]: f.numbersOnly ? e.target.value.replace(/\D/, '') : e.target.value })} />
                      )}
                    </div>
                  ))}
                </div>
                <button type="submit" className="submit-btn" style={{ background: 'linear-gradient(135deg,#ffd166,#ffa500)', color: '#3d2000', boxShadow: '0 6px 20px rgba(255,209,102,0.4)' }}>✏️ Update</button>
              </form>
            )}
          </div>
        )}

        {/* DELETE */}
        {activePanel === PANELS.DELETE && (
          <div className="panel-section" key="delete">
            <div className="panel-title">🗑️ Delete {entityName}</div>
            <div className="delete-input-row">
              <div className="form-field" style={{ flex: 1 }}>
                <label className="field-label">Enter ID</label>
                <input className="field-input" type="number" placeholder="ID" value={deleteId} onChange={e => setDeleteId(e.target.value)} />
              </div>
              <button className="submit-btn" type="button" onClick={handleDeleteSearch} style={{ marginTop: 20 }}>🔍 Search</button>
            </div>
            {deleteFound && (
              <div className="detail-card">
                {fields.map(f => (
                  <div className="detail-row" key={f.key}>
                    <span className="detail-key">{f.label}</span>
                    <span className="detail-val">{deleteFound[f.key]}</span>
                  </div>
                ))}
                <button className="delete-confirm-btn" style={{ marginTop: 16 }} onClick={handleDelete}>🗑️ Confirm Delete</button>
              </div>
            )}
          </div>
        )}

        {/* GET ALL */}
        {activePanel === PANELS.GETALL && (
          <div className="panel-section" key="getall">
            <div className="panel-title">📋 All {entityName}s</div>
            {items.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>No {entityName} found. Please add new!</p>
              </div>
            ) : (
              <>
                <div className="form-field" style={{ marginBottom: 24 }}>
                  <label className="field-label">Select {entityName}</label>
                  <div className="dropdown-wrap">
                    <select className="dropdown-select" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                      <option value="">-- Select {entityName} --</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>#{i.id} — {i[firstName.key]}</option>
                      ))}
                    </select>
                    <span className="dropdown-arrow">▾</span>
                  </div>
                </div>

                {selectedItemObj && (
                  <div className="detail-card">
                    <div className="detail-row"><span className="detail-key">ID</span><span className="detail-val">#{selectedItemObj.id}</span></div>
                    {fields.map(f => (
                      <div className="detail-row" key={f.key}>
                        <span className="detail-key">{f.label}</span>
                        <span className="detail-val">{selectedItemObj[f.key]}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 24 }}>
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        {fields.map(f => <th key={f.key}>{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(i => (
                        <tr key={i.id} onClick={() => setSelectedItem(String(i.id))} style={{ cursor: 'pointer' }}>
                          <td>#{i.id}</td>
                          {fields.map((f, idx) => (
                            <td key={f.key} style={idx === 0 ? { fontWeight: 600 } : {}}>{i[f.key]}</td>
                          ))}
                        </tr>
                      ))}
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

export default EntityPage;