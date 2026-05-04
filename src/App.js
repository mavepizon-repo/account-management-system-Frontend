import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage            from './pages/LoginPage';
import DashboardPage        from './pages/DashboardPage';
import ClientPage           from './pages/ClientPage';
import VendorPage           from './pages/VendorPage';
import PurchaseBillPage     from './pages/PurchaseBillPage';
import SubcontractorPage    from './pages/SubcontractorPage';
import LabourPage           from './pages/LabourPage';
import InvoicePage          from './pages/Invoicepage';
import ReceiptPage          from './pages/ReceiptPage';
import WorksubcontractPage  from './pages/Worksubcontractpage';
import VoucherPage          from './pages/VoucherPage';
import AccountLedgerPage    from './pages/AccountledgerPage';
import LabourAttendancePage from './pages/LabourAttendancePage';
import AdvancePaymentPage   from './pages/AdvancePaymentPage';
import LabourVoucherPage    from './pages/LabourVoucherPage'; // ← NEW

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = (username, password) => {
    if (username === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => setIsAuthenticated(false);

  const Protected = ({ children }) =>
    isAuthenticated
      ? <Layout onLogout={handleLogout}>{children}</Layout>
      : <Navigate to="/" replace />;

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/"
        element={
          isAuthenticated
            ? <Navigate to="/dashboard" replace />
            : <LoginPage onLogin={handleLogin} />
        }
      />

      {/* Protected */}
      <Route path="/dashboard"         element={<Protected><DashboardPage        onLogout={handleLogout} /></Protected>} />
      <Route path="/client"            element={<Protected><ClientPage           onLogout={handleLogout} /></Protected>} />
      <Route path="/vendor"            element={<Protected><VendorPage           onLogout={handleLogout} /></Protected>} />
      <Route path="/purchase-bills"    element={<Protected><PurchaseBillPage     onLogout={handleLogout} /></Protected>} />
      <Route path="/subcontractor"     element={<Protected><SubcontractorPage    onLogout={handleLogout} /></Protected>} />
      <Route path="/labour"            element={<Protected><LabourPage           onLogout={handleLogout} /></Protected>} />
      <Route path="/invoices"          element={<Protected><InvoicePage          onLogout={handleLogout} /></Protected>} />
      <Route path="/receipts"          element={<Protected><ReceiptPage          onLogout={handleLogout} /></Protected>} />
      <Route path="/work-subcontract"  element={<Protected><WorksubcontractPage  onLogout={handleLogout} /></Protected>} />
      <Route path="/vouchers"          element={<Protected><VoucherPage          onLogout={handleLogout} /></Protected>} />
      <Route path="/account-ledger"    element={<Protected><AccountLedgerPage    onLogout={handleLogout} /></Protected>} />
      <Route path="/labour-attendance" element={<Protected><LabourAttendancePage onLogout={handleLogout} /></Protected>} />
      <Route path="/advance-payment"   element={<Protected><AdvancePaymentPage   onLogout={handleLogout} /></Protected>} />
      <Route path="/labour-voucher"    element={<Protected><LabourVoucherPage    onLogout={handleLogout} /></Protected>} /> {/* ← NEW */}
    </Routes>
  );
}

export default App;