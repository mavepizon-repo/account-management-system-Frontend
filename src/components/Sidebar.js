import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠', route: '/dashboard' },
    ],
  },
  {
    section: 'Core Modules',
    items: [
      { id: 'client',        label: 'Client',         icon: '🏢', route: '/client' },
      { id: 'vendor',        label: 'Vendor',         icon: '🛒', route: '/vendor' },
      { id: 'subcontractor', label: 'Subcontractor',  icon: '🔧', route: '/subcontractor' },
      { id: 'labour',        label: 'Labour',         icon: '👷', route: '/labour' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { id: 'invoice',       label: 'Invoice',        icon: '🧾', route: '/invoices' },
      { id: 'receipt',       label: 'Receipt',        icon: '📄', route: '/receipts' },
      { id: 'purchase-bill', label: 'Purchase Bill',  icon: '📦', route: '/purchase-bills' },
      { id: 'voucher',       label: 'Voucher',        icon: '🗂️', route: '/vouchers' },
    ],
  },
  {
    section: 'Labour Finance',
    items: [
      { id: 'labour-voucher', label: 'Labour Voucher', icon: '💰', route: '/labour-voucher' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { id: 'account-ledger', label: 'Account Ledger', icon: '📒', route: '/account-ledger' },
    ],
  },
];

function Sidebar({ onLogout, collapsed, setCollapsed }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const isActive = (route) => location.pathname === route;

  return (
    <>
      {/* Overlay for mobile */}
      {!collapsed && (
        <div
          className="sidebar-overlay"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🏗️</div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-title">DesignArt</span>
              <span className="sidebar-logo-sub">Admin Panel</span>
            </div>
          )}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(group => (
            <div key={group.section} className="sidebar-group">
              {!collapsed && (
                <div className="sidebar-group-label">{group.section}</div>
              )}
              {group.items.map(item => (
                <button
                  key={item.id}
                  className={`sidebar-item ${isActive(item.route) ? 'sidebar-item-active' : ''}`}
                  onClick={() => {
                    navigate(item.route);
                    if (window.innerWidth <= 768) setCollapsed(true);
                  }}
                  title={collapsed ? item.label : ''}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  {!collapsed && (
                    <span className="sidebar-item-label">{item.label}</span>
                  )}
                  {!collapsed && isActive(item.route) && (
                    <span className="sidebar-item-dot" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className={`sidebar-user ${collapsed ? 'sidebar-user-collapsed' : ''}`}>
            <div className="sidebar-avatar">A</div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">Admin</span>
                <span className="sidebar-user-role">Administrator</span>
              </div>
            )}
          </div>
          <button
            className={`sidebar-logout-btn ${collapsed ? 'sidebar-logout-collapsed' : ''}`}
            onClick={onLogout}
            title="Logout"
          >
            <span>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;