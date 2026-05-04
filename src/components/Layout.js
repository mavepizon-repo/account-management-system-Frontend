import React, { useState } from 'react';
import Sidebar from './Sidebar';
import '../styles/Sidebar.css';
import '../styles/Layout.css';

function Layout({ children, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`app-layout ${collapsed ? 'layout-collapsed' : ''}`}>
      {/* Sidebar — fixed left panel */}
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* Right content — margin-left matches sidebar width */}
      <div className="app-content">

        {/* Mobile hamburger top bar (hidden on desktop) */}
        <div className="mobile-topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setCollapsed(false)}
          >
            ☰
          </button>
          <div className="mobile-topbar-brand">
            <span>🏗️</span>
            <span>AccoMgmt</span>
          </div>
        </div>

        {/* Page content */}
        <main className="app-main">
          {children}
        </main>

      </div>
    </div>
  );
}

export default Layout;