import React, { useState } from 'react';
import { X, ClipboardPaste } from 'lucide-react';

export default function PasteModal({ isOpen, onClose, onImport }) {
  const [text, setText] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onImport(text);
    setText('');
    onClose();
  };

  return (
    <div className="modal-overlay open">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <ClipboardPaste size={16} />
            <h3>Paste Data from Excel or Google Sheets</h3>
          </div>
          <button className="ctrl-btn btn-sm" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="modal-body">
          <p>
            Copy cells directly from Excel, CSV, or Google Sheets and paste them below:
          </p>
          <textarea
            className="modal-textarea"
            placeholder={"Point\tf1\tf2\nP1\t1.0\t7.0\nP2\t3.0\t4.0\nP3\t7.0\t2.0"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <div className="modal-hint">
            Supports tab-separated, comma-separated, or whitespace-separated columns.
          </div>
        </div>
        <div className="modal-footer">
          <button className="ctrl-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="ctrl-btn btn-primary" onClick={handleConfirm}>
            Import Coordinates
          </button>
        </div>
      </div>
    </div>
  );
}
