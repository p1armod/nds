import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Tag,
  EyeOff,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { parseExcelWithConfig } from '../parsers/xlsx_parser';

export default function ExcelUploadModal({
  isOpen,
  onClose,
  workbookData,
  onConfirm
}) {
  if (!isOpen || !workbookData) return null;

  const { fileName = 'dataset.xlsx', sheetNames = [], sheetsData = {}, detectedConfigs = {} } = workbookData;

  const [activeSheet, setActiveSheet] = useState(sheetNames[0] || '');
  const [columnsConfig, setColumnsConfig] = useState([]);
  const [nameColIdx, setNameColIdx] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // When sheet changes, initialize columns configuration from auto-detected config
  useEffect(() => {
    if (!activeSheet || !sheetsData[activeSheet]) return;
    const detected = detectedConfigs[activeSheet] || {
      hasHeader: true,
      headerRowIdx: 0,
      nameColIdx: 0,
      columns: []
    };

    setHasHeader(detected.hasHeader);
    setNameColIdx(detected.nameColIdx);
    setColumnsConfig(
      (detected.columns || []).map(c => ({
        ...c
      }))
    );
    setErrorMessage('');
  }, [activeSheet, workbookData]);

  const rawRows = sheetsData[activeSheet] || [];
  const previewRows = hasHeader ? rawRows.slice(1, 11) : rawRows.slice(0, 10);

  // Computed summary
  const objectiveColumns = useMemo(() => {
    return columnsConfig.filter(c => c.role === 'objective');
  }, [columnsConfig]);

  const isValid = objectiveColumns.length >= 2;

  // Change a column's role
  const handleRoleChange = (colIdx, newRole) => {
    setColumnsConfig(prev =>
      prev.map(c => {
        if (c.colIdx === colIdx) {
          if (newRole === 'name') {
            setNameColIdx(colIdx);
          }
          return { ...c, role: newRole };
        }
        // If someone selected another column as name, revert the previous name column to ignore
        if (newRole === 'name' && c.role === 'name') {
          return { ...c, role: 'ignore' };
        }
        return c;
      })
    );
  };

  // Toggle optimization direction (min vs max)
  const handleDirectionToggle = (colIdx) => {
    setColumnsConfig(prev =>
      prev.map(c => {
        if (c.colIdx === colIdx) {
          return { ...c, isMin: !c.isMin };
        }
        return c;
      })
    );
  };

  // Change column name
  const handleNameChange = (colIdx, newName) => {
    setColumnsConfig(prev =>
      prev.map(c => (c.colIdx === colIdx ? { ...c, name: newName } : c))
    );
  };

  // Auto-detect action
  const handleAutoDetect = () => {
    const detected = detectedConfigs[activeSheet];
    if (detected) {
      setHasHeader(detected.hasHeader);
      setNameColIdx(detected.nameColIdx);
      setColumnsConfig(detected.columns.map(c => ({ ...c })));
    }
  };

  // Select all numeric as minimize
  const handleSelectAllNumeric = (isMin = true) => {
    setColumnsConfig(prev =>
      prev.map((c, idx) => {
        if (idx === nameColIdx) return c;
        // Check if sample values are numeric
        const isNum = c.sampleValues?.some(v => !isNaN(parseFloat(String(v).replace(/[$,\s%]/g, ''))));
        if (isNum) {
          return { ...c, role: 'objective', isMin };
        }
        return c;
      })
    );
  };

  // Confirm and load
  const handleConfirm = () => {
    if (!isValid) {
      setErrorMessage('Please select at least 2 numerical objective columns for Non-dominated Sorting.');
      return;
    }

    try {
      const config = {
        hasHeader,
        headerRowIdx: 0,
        nameColIdx,
        columns: columnsConfig
      };

      const { points, objectiveNames, minimizeDirections } = parseExcelWithConfig(rawRows, config);

      if (points.length === 0) {
        setErrorMessage('No valid points could be extracted. Please check column mappings and data values.');
        return;
      }

      onConfirm({
        points,
        objectiveNames,
        minimizeDirections,
        fileName,
        sheetName: activeSheet
      });
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Error parsing sheet with selected configuration.');
    }
  };

  return (
    <div className="modal-overlay open" style={{ zIndex: 110 }}>
      <div className="modal-card excel-upload-modal">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FileSpreadsheet size={20} className="icon-emerald" />
            <div>
              <h3>Excel Spreadsheet Multi-Objective Importer</h3>
              <div className="modal-subtitle">
                File: <strong>{fileName}</strong> &bull; Select objectives, directions ($\min / \max$), and name column
              </div>
            </div>
          </div>
          <button className="ctrl-btn btn-sm" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body excel-modal-body">
          {/* Sheet Selector Tabs (if multiple sheets exist) */}
          {sheetNames.length > 1 && (
            <div className="sheet-selector-bar">
              <span className="sheet-label">
                <Layers size={13} />
                Worksheets:
              </span>
              <div className="sheet-tabs-list">
                {sheetNames.map(name => (
                  <button
                    key={name}
                    className={`sheet-tab-btn ${activeSheet === name ? 'active' : ''}`}
                    onClick={() => setActiveSheet(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Toolbar */}
          <div className="excel-config-toolbar">
            <div className="toolbar-left">
              <span className="summary-pill">
                <strong>{rawRows.length > 1 ? rawRows.length - (hasHeader ? 1 : 0) : 0}</strong> Rows
              </span>
              <span className="summary-pill accent">
                <strong>{objectiveColumns.length}</strong> Objectives ($M$)
              </span>
              {nameColIdx !== -1 && columnsConfig[nameColIdx] && (
                <span className="summary-pill neutral">
                  Name: <strong>{columnsConfig[nameColIdx].name}</strong>
                </span>
              )}
            </div>

            <div className="toolbar-right">
              <button className="tool-btn" onClick={handleAutoDetect} title="Re-run intelligent heuristic detection">
                <Sparkles size={12} />
                <span>Auto-Detect</span>
              </button>
              <button className="tool-btn" onClick={() => handleSelectAllNumeric(true)} title="Set all numeric columns as Min">
                <ArrowDownRight size={12} />
                <span>All Num &rarr; Min</span>
              </button>
              <button className="tool-btn" onClick={() => handleSelectAllNumeric(false)} title="Set all numeric columns as Max">
                <ArrowUpRight size={12} />
                <span>All Num &rarr; Max</span>
              </button>
            </div>
          </div>

          {/* Error / Warning Alert */}
          {errorMessage && (
            <div className="excel-alert-banner error">
              <AlertTriangle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isValid && !errorMessage && (
            <div className="excel-alert-banner warning">
              <AlertTriangle size={15} />
              <span>
                Non-dominated Sorting (NDS) requires at least <strong>2 numerical objectives</strong>. Currently {objectiveColumns.length} selected.
              </span>
            </div>
          )}

          {/* Column Mapping & Data Grid Preview */}
          <div className="excel-grid-container">
            <table className="excel-preview-table">
              <thead>
                {/* Column Role Selectors Row */}
                <tr className="column-controls-row">
                  {columnsConfig.map((col) => (
                    <th key={col.colIdx} className={`col-header-cell role-${col.role}`}>
                      <div className="col-control-box">
                        <input
                          type="text"
                          className="col-rename-input"
                          value={col.name}
                          onChange={(e) => handleNameChange(col.colIdx, e.target.value)}
                          title="Rename objective or column"
                        />

                        {/* Role Dropdown */}
                        <select
                          className={`role-select role-tag-${col.role}`}
                          value={col.role}
                          onChange={(e) => handleRoleChange(col.colIdx, e.target.value)}
                        >
                          <option value="objective">Objective</option>
                          <option value="name">Point ID / Name</option>
                          <option value="ignore">Ignore / Metadata</option>
                        </select>

                        {/* Min / Max Toggle (for objectives) */}
                        {col.role === 'objective' && (
                          <button
                            type="button"
                            className={`min-max-toggle ${col.isMin ? 'min' : 'max'}`}
                            onClick={() => handleDirectionToggle(col.colIdx)}
                            title={col.isMin ? 'Click to change to Maximize (Higher is better)' : 'Click to change to Minimize (Lower is better)'}
                          >
                            {col.isMin ? (
                              <>
                                <ArrowDownRight size={11} />
                                <span>Minimize (&darr;)</span>
                              </>
                            ) : (
                              <>
                                <ArrowUpRight size={11} />
                                <span>Maximize (&uarr;)</span>
                              </>
                            )}
                          </button>
                        )}

                        {col.role === 'name' && (
                          <div className="role-sublabel name">
                            <Tag size={10} />
                            <span>Label Identifier</span>
                          </div>
                        )}

                        {col.role === 'ignore' && (
                          <div className="role-sublabel ignore">
                            <EyeOff size={10} />
                            <span>Excluded from NDS</span>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columnsConfig.map((col) => {
                      const val = row[col.colIdx];
                      const isObj = col.role === 'objective';
                      const isName = col.role === 'name';

                      return (
                        <td
                          key={col.colIdx}
                          className={`excel-cell ${isObj ? 'cell-objective' : ''} ${isName ? 'cell-name' : ''}`}
                        >
                          {val !== undefined ? String(val) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="excel-modal-footer-hint">
            Showing first {Math.min(10, previewRows.length)} rows. All {rawRows.length - (hasHeader ? 1 : 0)} data rows will be imported and non-dominated sorted.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-footer">
          <button className="ctrl-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`ctrl-btn btn-primary ${!isValid ? 'disabled' : ''}`}
            onClick={handleConfirm}
            disabled={!isValid}
          >
            <span>Load Dataset &amp; Run NDS</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
