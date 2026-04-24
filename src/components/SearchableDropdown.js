import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchableDropdown
 * Props:
 *   options   — [{ value, label }]
 *   value     — selected value (string)
 *   onChange  — fn(value)
 *   placeholder — string
 *   disabled  — bool
 */
function SearchableDropdown({ options = [], value, onChange, placeholder = '-- Select --', disabled = false }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const wrapRef             = useRef(null);
  const inputRef            = useRef(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  return (
    <div
      ref={wrapRef}
      className={`sdd-wrap${open ? ' sdd-open' : ''}${disabled ? ' sdd-disabled' : ''}`}
    >
      {/* Trigger */}
      <div
        className="sdd-trigger"
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o); }}
      >
        <span className={`sdd-trigger-text${!selected ? ' sdd-placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="sdd-trigger-icons">
          {selected && !disabled && (
            <span className="sdd-clear" onClick={handleClear} title="Clear">✕</span>
          )}
          <span className={`sdd-arrow${open ? ' sdd-arrow-up' : ''}`}>▾</span>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="sdd-dropdown">
          <div className="sdd-search-wrap">
            <span className="sdd-search-icon">🔍</span>
            <input
              ref={inputRef}
              className="sdd-search-input"
              placeholder="Type to search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {query && (
              <span className="sdd-search-clear" onClick={() => setQuery('')}>✕</span>
            )}
          </div>

          <div className="sdd-list">
            {filtered.length === 0 ? (
              <div className="sdd-empty">No results for "{query}"</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  className={`sdd-option${opt.value === value ? ' sdd-option-selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.value === value && <span className="sdd-check">✓</span>}
                  <span className="sdd-option-label">{opt.label}</span>
                </div>
              ))
            )}
          </div>

          <div className="sdd-footer">
            {filtered.length} of {options.length} options
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableDropdown;