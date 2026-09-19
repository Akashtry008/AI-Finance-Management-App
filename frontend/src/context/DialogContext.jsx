import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, Info, CheckCircle2, Trash2, X } from 'lucide-react';
import './DialogContext.css';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: 'confirm', // 'confirm' | 'alert'
    iconType: 'warning', // 'warning' | 'danger' | 'info' | 'success'
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDanger: false,
  });

  const resolverRef = useRef(null);

  const showConfirm = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false,
    iconType = isDanger ? 'danger' : 'warning',
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        type: 'confirm',
        iconType,
        title,
        message,
        confirmText,
        cancelText,
        isDanger,
      });
    });
  }, []);

  const showAlert = useCallback(({
    title = 'Notice',
    message = '',
    type = 'info',
    confirmText = 'OK',
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        type: 'alert',
        iconType: type,
        title,
        message,
        confirmText,
        cancelText: '',
        isDanger: type === 'danger',
      });
    });
  }, []);

  const handleClose = (result) => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  const renderIcon = () => {
    const { iconType } = dialogState;
    if (iconType === 'danger') {
      return (
        <div className="dialog-icon-wrap dialog-icon-danger">
          <Trash2 size={22} />
        </div>
      );
    }
    if (iconType === 'warning') {
      return (
        <div className="dialog-icon-wrap dialog-icon-warning">
          <AlertTriangle size={22} />
        </div>
      );
    }
    if (iconType === 'success') {
      return (
        <div className="dialog-icon-wrap dialog-icon-success">
          <CheckCircle2 size={22} />
        </div>
      );
    }
    return (
      <div className="dialog-icon-wrap dialog-icon-info">
        <Info size={22} />
      </div>
    );
  };

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {dialogState.isOpen &&
        ReactDOM.createPortal(
          <div
            className="dialog-overlay"
            onClick={() => handleClose(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleClose(false);
              if (e.key === 'Enter') handleClose(true);
            }}
            tabIndex={-1}
          >
            <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-header">
                {renderIcon()}
                <div className="dialog-content-area">
                  <h3 className="dialog-title">{dialogState.title}</h3>
                  <p className="dialog-message">{dialogState.message}</p>
                </div>
              </div>
              <div className="dialog-actions">
                {dialogState.type === 'confirm' && (
                  <button
                    type="button"
                    className="dialog-btn dialog-btn-cancel"
                    onClick={() => handleClose(false)}
                  >
                    {dialogState.cancelText}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  className={`dialog-btn ${
                    dialogState.isDanger
                      ? 'dialog-btn-danger'
                      : 'dialog-btn-confirm'
                  }`}
                  onClick={() => handleClose(true)}
                >
                  {dialogState.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
