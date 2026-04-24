import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/DashboardPage.css';

const CARDS = [
  {
    id: 'client',
    label: 'Client',
    icon: '🏢',
    desc: 'Manage client details — Add, Update, Delete & View',
    cls: 'card-client',
    route: '/client',
  },
  {
    id: 'vendor',
    label: 'Vendor',
    icon: '🛒',
    desc: 'View and manage vendor information',
    cls: 'card-vendor',
    route: '/vendor',
  },
  {
    id: 'subcontractor',
    label: 'Subcontractor',
    icon: '🔧',
    desc: 'Manage subcontractor records',
    cls: 'card-sub',
    route: '/subcontractor',
  },
  {
    id: 'labour',
    label: 'Labour',
    icon: '👷',
    desc: 'Manage labour workforce information',
    cls: 'card-labour',
    route: '/labour',
  },
  {
    id: 'account-ledger',
    label: 'Account Ledger',
    icon: '📒',
    desc: 'View Income & Expense ledger — filter, analyze & export to Excel',
    cls: 'card-ledger',
    route: '/account-ledger',
  },
];

function DashboardPage({ onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="dashboard-wrapper">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-icon">🏗️</div>
          <span className="navbar-title">Account Managements</span>
        </div>
        <div className="navbar-right">
          <div className="navbar-user">
            <div className="navbar-avatar">A</div>
            <span className="navbar-username">Admin</span>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="dashboard-main">
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">📊</span>
            <div>
              <div className="stat-value">5</div>
              <div className="stat-label">Total Modules</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <div>
              <div className="stat-value">Active</div>
              <div className="stat-label">System Status</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🕐</span>
            <div>
              <div className="stat-value">{new Date().toLocaleDateString('en-IN')}</div>
              <div className="stat-label">Today's Date</div>
            </div>
          </div>
        </div>

        <div className="dashboard-header">
          <h1 className="dashboard-title">
            Admin <span>Dashboard</span>
          </h1>
          <p className="dashboard-subtitle">
            Select the module you want to manage
          </p>
        </div>

        <div className="cards-grid">
          {CARDS.map(card => (
            <div
              key={card.id}
              className={`dashboard-card ${card.cls}`}
              onClick={() => navigate(card.route)}
            >
              <div className="card-icon-wrap">{card.icon}</div>
              <div className="card-title">{card.label}</div>
              <div className="card-desc">{card.desc}</div>
              <span className="card-arrow">→</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;