import React, { useEffect } from 'react';
import '../styles/EntityPage.css';

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  return (
    <div className={`toast ${type}`}>
      {icons[type]} {message}
    </div>
  );
}

export default Toast;
