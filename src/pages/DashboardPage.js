import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/DashboardPage.css';

const CARDS = [
  // ── Core Modules ──
  { id: 'client',        label: 'Client',         icon: '🏢', desc: 'Manage client details — Add, Update, Delete & View',                cls: 'card-client',   route: '/client',           section: 'core'    },
  { id: 'vendor',        label: 'Vendor',         icon: '🛒', desc: 'View and manage vendor information',                               cls: 'card-vendor',   route: '/vendor',           section: 'core'    },
  { id: 'subcontractor', label: 'Subcontractor',  icon: '🔧', desc: 'Manage subcontractor records',                                     cls: 'card-sub',      route: '/subcontractor',    section: 'core'    },
  { id: 'labour',        label: 'Labour',         icon: '👷', desc: 'Manage labour workforce information',                              cls: 'card-labour',   route: '/labour',           section: 'core'    },

  // ── Finance Modules ──
  { id: 'invoice',       label: 'Invoice',        icon: '🧾', desc: 'Create and manage client invoices with GST calculation',           cls: 'card-invoice',  route: '/invoices',         section: 'finance' },
  { id: 'receipt',       label: 'Receipt',        icon: '📄', desc: 'Generate and track payment receipts from clients',                 cls: 'card-receipt',  route: '/receipts',         section: 'finance' },
  { id: 'purchase-bill', label: 'Purchase Bill',  icon: '📦', desc: 'Manage vendor purchase bills and GST input',                      cls: 'card-purchase', route: '/purchase-bills',   section: 'finance' },
  { id: 'voucher',       label: 'Voucher',        icon: '🗂️', desc: 'Manage payment vouchers for vendors & subcontractors',            cls: 'card-voucher',  route: '/vouchers',         section: 'finance' },

  // ── Labour Finance ──
  { id: 'labour-voucher', label: 'Labour Voucher', icon: '💰', desc: 'Generate & manage monthly labour salary vouchers with PDF',       cls: 'card-lv',       route: '/labour-voucher',   section: 'labour'  },

  // ── Reports ──
  { id: 'account-ledger', label: 'Account Ledger', icon: '📒', desc: 'View Income & Expense ledger — filter, analyze & export to Excel', cls: 'card-ledger',   route: '/account-ledger',  section: 'report'  },
];

const coreCards    = CARDS.filter(c => c.section === 'core');
const financeCards = CARDS.filter(c => c.section === 'finance');
const labourCards  = CARDS.filter(c => c.section === 'labour');
const reportCards  = CARDS.filter(c => c.section === 'report');

function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-main">

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">📊</span>
            <div>
              <div className="stat-value">10</div>
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

        {/* Header */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            Admin <span>Dashboard</span>
          </h1>
          <p className="dashboard-subtitle">Select the module you want to manage</p>
        </div>

        {/* Core Modules */}
        <div className="section-label">Core Modules</div>
        <div className="cards-grid">
          {coreCards.map((card, i) => (
            <div
              key={card.id}
              className={`dashboard-card ${card.cls}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(card.route)}
            >
              <div className="card-icon-wrap">{card.icon}</div>
              <div className="card-title">{card.label}</div>
              <div className="card-desc">{card.desc}</div>
              <span className="card-arrow">→</span>
            </div>
          ))}
        </div>

        {/* Finance Modules */}
        <div className="section-label">Finance Modules</div>
        <div className="cards-grid">
          {financeCards.map((card, i) => (
            <div
              key={card.id}
              className={`dashboard-card ${card.cls}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(card.route)}
            >
              <div className="card-icon-wrap">{card.icon}</div>
              <div className="card-title">{card.label}</div>
              <div className="card-desc">{card.desc}</div>
              <span className="card-arrow">→</span>
            </div>
          ))}
        </div>

        {/* Labour Finance */}
        <div className="section-label">Labour Finance</div>
        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {labourCards.map((card, i) => (
            <div
              key={card.id}
              className={`dashboard-card ${card.cls}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(card.route)}
            >
              <div className="card-icon-wrap">{card.icon}</div>
              <div className="card-title">{card.label}</div>
              <div className="card-desc">{card.desc}</div>
              <span className="card-arrow">→</span>
            </div>
          ))}
        </div>

        {/* Reports */}
        <div className="section-label">Reports</div>
        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {reportCards.map((card, i) => (
            <div
              key={card.id}
              className={`dashboard-card ${card.cls}`}
              style={{ animationDelay: `${i * 0.05}s` }}
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