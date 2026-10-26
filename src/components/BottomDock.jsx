import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Plus,
  Upload,
  Clipboard,
  FileSpreadsheet,
  Download
} from 'lucide-react';

export default function BottomDock({
  activeStep,
  stepIndex,
  totalSteps,
  isPlaying,
  togglePlay,
  stepForward,
  stepBackward,
  resetPlayback,
  stepSpeed,
  setStepSpeed,
  onAddPoint,
  onFileUpload,
  onOpenPasteModal,
  onDownloadSample,
  onExportCSV,
  onExportXLSX,
  objectiveNames = []
}) {
  const [ptName, setPtName] = useState('');
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [f3, setF3] = useState('');
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const val1 = parseFloat(f1);
    const val2 = parseFloat(f2);
    if (isNaN(val1) || isNaN(val2)) return;

    const coords = [val1, val2];
    const val3 = parseFloat(f3);
    if (!isNaN(val3)) {
      coords.push(val3);
    }

    onAddPoint({
      name: ptName.trim() || undefined,
      coords
    });

    setPtName('');
    setF1('');
    setF2('');
    setF3('');
  };

  const progressPercent = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;
  const phase = activeStep?.phase?.replace(/_/g, ' ') || 'INITIALIZATION';

  return (
    <footer className="bottom-dock">
      {/* Live Step Commentary Banner */}
      <div className="step-commentary-banner">
        <div
          className="step-progress-indicator"
          style={{ width: `${progressPercent}%` }}
        />
        <div className="commentary-left">
          <span className="phase-tag">{phase}</span>
          <div className="commentary-text">
            <h4 title={activeStep?.title || 'Ready'}>{activeStep?.title || 'Ready'}</h4>
            <p title={activeStep?.explanation || 'Initialize or step through sorting.'}>
              {activeStep?.explanation || 'Initialize or step through sorting.'}
            </p>
          </div>
        </div>
        <div className="commentary-right">
          <span className="step-counter-tag">
            Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>
      </div>

      {/* Controls & Input Deck */}
      <div className="controls-dock">
        {/* Playback Controls */}
        <div className="playback-buttons">
          <button
            className="ctrl-btn"
            onClick={resetPlayback}
            title="Reset to beginning"
          >
            <RotateCcw size={14} />
          </button>

          <button
            className="ctrl-btn"
            onClick={stepBackward}
            disabled={stepIndex === 0}
            title="Step backward (←)"
          >
            <SkipBack size={14} />
          </button>

          <button
            className={`ctrl-btn btn-primary ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            className="ctrl-btn"
            onClick={stepForward}
            disabled={stepIndex >= totalSteps - 1}
            title="Step forward (→)"
          >
            <SkipForward size={14} />
          </button>

          <div className="speed-control">
            <span>Speed:</span>
            <input
              type="range"
              min="50"
              max="1200"
              value={1250 - stepSpeed}
              onChange={(e) => setStepSpeed(1250 - parseInt(e.target.value, 10))}
            />
            <span className="speed-badge">{stepSpeed}ms</span>
          </div>
        </div>

        {/* Coordinate Input Form */}
        <div className="input-dock">
          <form className="form-inline" onSubmit={handleFormSubmit}>
            <input
              type="text"
              className="input-txt"
              placeholder="Name"
              style={{ width: '55px' }}
              value={ptName}
              onChange={(e) => setPtName(e.target.value)}
            />
            <input
              type="number"
              step="any"
              className="input-txt"
              placeholder="f₁"
              required
              value={f1}
              onChange={(e) => setF1(e.target.value)}
            />
            <input
              type="number"
              step="any"
              className="input-txt"
              placeholder="f₂"
              required
              value={f2}
              onChange={(e) => setF2(e.target.value)}
            />
            <input
              type="number"
              step="any"
              className="input-txt"
              placeholder="f₃ (opt)"
              style={{ width: '65px' }}
              value={f3}
              onChange={(e) => setF3(e.target.value)}
            />
            <button type="submit" className="ctrl-btn btn-sm">
              <Plus size={12} />
              <span>Add Point</span>
            </button>
          </form>

          {/* Excel / CSV Drop Zone */}
          <label className="drop-zone-mini" title="Upload .xlsx, .xls, or .csv spreadsheet">
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  onFileUpload(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
            <Upload size={13} />
            <span>Upload Excel / CSV</span>
          </label>
        </div>

        {/* Actions Deck */}
        <div className="dock-actions">
          <button
            className="btn-action"
            onClick={onOpenPasteModal}
            title="Paste directly from Excel or Google Sheets"
          >
            <Clipboard size={13} />
            <span>Paste Excel</span>
          </button>

          {/* Sample Templates Dropdown */}
          <div className="action-dropdown-wrapper">
            <button
              className="btn-action"
              onClick={() => {
                setIsSampleMenuOpen(prev => !prev);
                setIsExportMenuOpen(false);
              }}
              title="Download official benchmark Excel templates"
            >
              <FileSpreadsheet size={13} />
              <span>Sample Excel &darr;</span>
            </button>

            {isSampleMenuOpen && (
              <div className="action-dropdown-menu">
                <button
                  onClick={() => {
                    onDownloadSample('2d');
                    setIsSampleMenuOpen(false);
                  }}
                  className="dropdown-menu-item"
                >
                  <strong>2D Benchmark Excel (.xlsx)</strong>
                  <span>Paper Fig. 1 (f1, f2)</span>
                </button>
                <button
                  onClick={() => {
                    onDownloadSample('3d');
                    setIsSampleMenuOpen(false);
                  }}
                  className="dropdown-menu-item"
                >
                  <strong>3D Surface Excel (.xlsx)</strong>
                  <span>3-Objective Spherical</span>
                </button>
                <button
                  onClick={() => {
                    onDownloadSample('5d_engineering');
                    setIsSampleMenuOpen(false);
                  }}
                  className="dropdown-menu-item"
                >
                  <strong>5D Engineering Excel (.xlsx)</strong>
                  <span>Multi-col, Mixed Min/Max &amp; Meta</span>
                </button>
              </div>
            )}
          </div>

          {/* Export Results Dropdown */}
          <div className="action-dropdown-wrapper">
            <button
              className="btn-action"
              onClick={() => {
                setIsExportMenuOpen(prev => !prev);
                setIsSampleMenuOpen(false);
              }}
              title="Export sorting results"
            >
              <Download size={13} />
              <span>Export &darr;</span>
            </button>

            {isExportMenuOpen && (
              <div className="action-dropdown-menu">
                <button
                  onClick={() => {
                    if (onExportXLSX) onExportXLSX();
                    setIsExportMenuOpen(false);
                  }}
                  className="dropdown-menu-item"
                >
                  <strong>Excel Workbook (.xlsx)</strong>
                  <span>Multi-sheet with Fronts &amp; Matrix</span>
                </button>
                <button
                  onClick={() => {
                    onExportCSV();
                    setIsExportMenuOpen(false);
                  }}
                  className="dropdown-menu-item"
                >
                  <strong>Comma-Separated (.csv)</strong>
                  <span>Standard CSV format</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
