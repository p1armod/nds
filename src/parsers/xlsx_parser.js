/**
 * Enterprise-Grade Client-Side Excel (.xlsx, .xls) & Spreadsheet Parser
 * Powered by SheetJS (xlsx) with intelligent column/objective detection,
 * multi-sheet support, and custom mapping for multi-objective optimization.
 */

import * as XLSX from 'xlsx';

/**
 * Common keyword heuristics for column role auto-detection
 */
const ID_NAME_KEYWORDS = [
  'point', 'name', 'id', 'solution', 'design', 'candidate', 'sample',
  'label', 'ind', 'individual', 'node', 'item', 'model', 'run'
];

const MAXIMIZE_KEYWORDS = [
  'profit', 'revenue', 'throughput', 'accuracy', 'speed', 'efficiency',
  'score', 'reliability', 'gain', 'max', 'utility', 'quality', 'yield',
  'performance', 'bandwidth', 'safety', 'upside', 'benefit'
];

const MINIMIZE_KEYWORDS = [
  'cost', 'latency', 'delay', 'time', 'loss', 'error', 'weight', 'mass',
  'power', 'consumption', 'emission', 'risk', 'min', 'penalty', 'jitter',
  'overhead', 'drag', 'defect', 'drop', 'f1', 'f2', 'f3', 'f4', 'f5'
];

const IGNORE_METADATA_KEYWORDS = [
  'note', 'comment', 'category', 'type', 'cluster', 'author', 'date',
  'timestamp', 'year', 'description', 'version', 'tag', 'status', 'group'
];

/**
 * Inspect an Excel or spreadsheet binary buffer and extract its sheets,
 * raw cell grid, and intelligent column suggestions.
 *
 * @param {ArrayBuffer | Uint8Array} arrayBuffer
 * @param {string} [fileName]
 * @returns {{ sheetNames: string[], sheetsData: Record<string, any[][]>, detectedConfig: Record<string, object> }}
 */
export function inspectExcelWorkbook(arrayBuffer, fileName = 'dataset.xlsx') {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: true,
    raw: false // formatted strings for clean display
  });

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('The uploaded Excel file does not contain any worksheets.');
  }

  const sheetsData = {};
  const detectedConfigs = {};

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to 2D array with blank cell filling
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    sheetsData[sheetName] = rawRows;
    detectedConfigs[sheetName] = autoDetectSheetConfig(rawRows);
  }

  return {
    sheetNames,
    sheetsData,
    detectedConfigs,
    fileName
  };
}

/**
 * Intelligent auto-detection of column roles from a 2D sheet grid
 */
export function autoDetectSheetConfig(rows) {
  if (!rows || rows.length === 0) {
    return {
      hasHeader: false,
      headerRowIdx: 0,
      nameColIdx: 0,
      columns: []
    };
  }

  // Find header row: typically row 0 or 1
  let headerRowIdx = 0;
  let hasHeader = false;

  for (let r = 0; r < Math.min(rows.length, 3); r++) {
    const row = rows[r];
    const nonNumericCount = row.filter(cell => {
      const s = String(cell).trim();
      return s !== '' && isNaN(Number(s));
    }).length;

    if (nonNumericCount >= Math.max(1, Math.floor(row.length * 0.4))) {
      headerRowIdx = r;
      hasHeader = true;
      break;
    }
  }

  const headerRow = hasHeader ? rows[headerRowIdx] : [];
  const dataRows = hasHeader ? rows.slice(headerRowIdx + 1) : rows;

  // Determine max number of columns
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);

  // Analyze each column
  const columns = [];
  let nameColIdx = -1;

  for (let c = 0; c < maxCols; c++) {
    const rawHeader = headerRow[c] !== undefined ? String(headerRow[c]).trim() : '';
    const colName = rawHeader || `Col_${c + 1}`;
    const lowerHeader = colName.toLowerCase();

    // Sample data values in this column
    let numericValuesCount = 0;
    let textValuesCount = 0;
    let sampleValues = [];

    for (let r = 0; r < Math.min(dataRows.length, 15); r++) {
      const cell = dataRows[r][c];
      if (cell !== undefined && String(cell).trim() !== '') {
        sampleValues.push(cell);
        const num = parseFloat(String(cell).replace(/,/g, ''));
        if (!isNaN(num)) {
          numericValuesCount++;
        } else {
          textValuesCount++;
        }
      }
    }

    const isPredominantlyNumeric = numericValuesCount > 0 && numericValuesCount >= textValuesCount;
    const isPredominantlyText = textValuesCount > numericValuesCount;

    // Detect column role
    let role = 'ignore';
    let isMin = true;

    // Check if it's the Name/ID column
    const matchesIdKeyword = ID_NAME_KEYWORDS.some(k => lowerHeader.includes(k));
    const matchesIgnoreKeyword = IGNORE_METADATA_KEYWORDS.some(k => lowerHeader.includes(k));

    if (nameColIdx === -1 && (matchesIdKeyword || (c === 0 && isPredominantlyText))) {
      role = 'name';
      nameColIdx = c;
    } else if (matchesIgnoreKeyword) {
      role = 'ignore';
    } else if (isPredominantlyNumeric) {
      role = 'objective';
      // Determine if maximize or minimize
      const hasMaxKeyword = MAXIMIZE_KEYWORDS.some(k => lowerHeader.includes(k));
      const hasMinKeyword = MINIMIZE_KEYWORDS.some(k => lowerHeader.includes(k));

      if (hasMaxKeyword && !hasMinKeyword) {
        isMin = false;
      } else {
        isMin = true; // Default in Pareto multi-objective optimization
      }
    } else if (nameColIdx === -1) {
      role = 'name';
      nameColIdx = c;
    }

    columns.push({
      colIdx: c,
      name: colName,
      role, // 'name', 'objective', 'ignore'
      isMin, // true = minimize, false = maximize
      sampleValues: sampleValues.slice(0, 3)
    });
  }

  // If no name column was detected, default to column 0 if ignored or make an auto-generator
  if (nameColIdx === -1 && columns.length > 0) {
    if (columns[0].role === 'ignore') {
      columns[0].role = 'name';
      nameColIdx = 0;
    }
  }

  return {
    hasHeader,
    headerRowIdx,
    nameColIdx,
    columns
  };
}

/**
 * Extract clean population points and objective metadata from raw 2D sheet rows
 * according to user-selected or auto-detected column configuration.
 *
 * @param {any[][]} rows
 * @param {object} config
 * @returns {{ points: Array<{ id: string, name: string, coords: number[], metadata: Record<string, any> }>, objectiveNames: string[], minimizeDirections: boolean[] }}
 */
export function parseExcelWithConfig(rows, config) {
  if (!rows || rows.length === 0) {
    return { points: [], objectiveNames: [], minimizeDirections: [] };
  }

  const {
    hasHeader = true,
    headerRowIdx = 0,
    nameColIdx = 0,
    columns = []
  } = config;

  const dataRows = hasHeader ? rows.slice(headerRowIdx + 1) : rows;

  // Extract objective columns and their directions
  const objectiveCols = columns.filter(c => c.role === 'objective');
  if (objectiveCols.length === 0) {
    throw new Error('No objective columns were selected. Please select at least 2 numerical objective columns.');
  }

  const objectiveNames = objectiveCols.map(c => c.name || `Obj_${c.colIdx + 1}`);
  const minimizeDirections = objectiveCols.map(c => c.isMin !== false);

  const points = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    if (!row || row.length === 0) continue;

    // Check if entire row is empty
    const isEmpty = row.every(cell => cell === undefined || String(cell).trim() === '');
    if (isEmpty) continue;

    // Extract Point Name
    let pointName = `P${r + 1}`;
    if (nameColIdx !== -1 && row[nameColIdx] !== undefined) {
      const nameVal = String(row[nameColIdx]).trim();
      if (nameVal !== '') {
        pointName = nameVal;
      }
    }

    // Extract Objective Coordinates
    const coords = [];
    let validRow = true;

    for (const objCol of objectiveCols) {
      const rawVal = row[objCol.colIdx];
      if (rawVal === undefined || String(rawVal).trim() === '') {
        validRow = false;
        break;
      }

      // Handle numbers, strings with commas/currency, scientific notation
      const cleanStr = String(rawVal).replace(/[$,\s%]/g, '');
      const num = parseFloat(cleanStr);
      if (isNaN(num)) {
        validRow = false;
        break;
      }

      coords.push(num);
    }

    if (!validRow || coords.length !== objectiveCols.length) {
      continue; // Skip malformed rows
    }

    // Extract metadata from ignored columns for tooltips
    const metadata = {};
    for (const c of columns) {
      if (c.role === 'ignore' && row[c.colIdx] !== undefined && String(row[c.colIdx]).trim() !== '') {
        metadata[c.name] = row[c.colIdx];
      }
    }

    points.push({
      id: `p_${Date.now()}_${r}`,
      name: pointName,
      coords,
      metadata
    });
  }

  return {
    points,
    objectiveNames,
    minimizeDirections
  };
}

/**
 * Universal XLSX / XLS ArrayBuffer Parser (Backward Compatible)
 * Parses an Excel ArrayBuffer and automatically extracts population points.
 *
 * @param {ArrayBuffer | Uint8Array} arrayBuffer
 * @returns {Promise<Array<{ id: string, name: string, coords: number[] }>>}
 */
export async function parseXlsxBuffer(arrayBuffer) {
  try {
    const inspected = inspectExcelWorkbook(arrayBuffer);
    const firstSheetName = inspected.sheetNames[0];
    const rows = inspected.sheetsData[firstSheetName];
    const detected = inspected.detectedConfigs[firstSheetName];

    // If auto-detection found objectives, extract them
    const objectiveCols = detected.columns.filter(c => c.role === 'objective');
    if (objectiveCols.length >= 2) {
      const result = parseExcelWithConfig(rows, detected);
      if (result.points.length > 0) {
        // Attach metadata to array for callers that need it
        result.points.objectiveNames = result.objectiveNames;
        result.points.minimizeDirections = result.minimizeDirections;
        return result.points;
      }
    }

    // Fallback: parse row by row directly
    const points = [];
    const hasHeader = detected.hasHeader;
    const dataRows = hasHeader ? rows.slice(detected.headerRowIdx + 1) : rows;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length < 2) continue;

      let name = `P${i + 1}`;
      let coords = [];
      let startIdx = 0;

      const firstCellStr = String(row[0] || '').trim();
      const firstNum = parseFloat(firstCellStr);

      if (isNaN(firstNum) && firstCellStr !== '') {
        name = firstCellStr;
        startIdx = 1;
      }

      for (let c = startIdx; c < row.length; c++) {
        const val = parseFloat(String(row[c]).replace(/[$,\s%]/g, ''));
        if (!isNaN(val)) {
          coords.push(val);
        }
      }

      if (coords.length >= 2) {
        points.push({
          id: `p_${Date.now()}_${i}`,
          name: name || `P${i + 1}`,
          coords
        });
      }
    }

    return points;
  } catch (err) {
    // If native fallback is required for custom raw deflate tests, fallback logic
    return nativeUnzipFallback(arrayBuffer);
  }
}

/**
 * Native lightweight unpacker fallback for synthesized zip buffers
 */
async function nativeUnzipFallback(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dataView = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
  const entries = {};
  let offset = 0;

  while (offset + 4 <= uint8Array.length) {
    const sig = dataView.getUint32(offset, true);

    if (sig === 0x04034b50) {
      const compMethod = dataView.getUint16(offset + 8, true);
      const compSize = dataView.getUint32(offset + 18, true);
      const nameLen = dataView.getUint16(offset + 26, true);
      const extraLen = dataView.getUint16(offset + 28, true);

      const nameBytes = uint8Array.subarray(offset + 30, offset + 30 + nameLen);
      const fileName = new TextDecoder().decode(nameBytes);

      const fileDataStart = offset + 30 + nameLen + extraLen;
      const fileData = uint8Array.subarray(fileDataStart, fileDataStart + compSize);

      let decompressedBytes = null;
      if (compMethod === 0) {
        decompressedBytes = fileData;
      } else if (compMethod === 8) {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(fileData);
          writer.close();
          const response = new Response(ds.readable);
          const arrayBuf = await response.arrayBuffer();
          decompressedBytes = new Uint8Array(arrayBuf);
        } catch (e) {
          console.warn('Decompress warning:', e);
        }
      }

      if (decompressedBytes) {
        entries[fileName] = new TextDecoder().decode(decompressedBytes);
      }

      offset = fileDataStart + compSize;
    } else {
      offset++;
    }
  }

  // Parse sheet xml
  let sheetXml = entries['xl/worksheets/sheet1.xml'];
  if (!sheetXml) {
    const sheetKey = Object.keys(entries).find(k => k.startsWith('xl/worksheets/'));
    if (sheetKey) sheetXml = entries[sheetKey];
  }
  if (!sheetXml) return [];

  const sharedStringsXml = entries['xl/sharedStrings.xml'];
  const sharedStrings = [];
  if (sharedStringsXml) {
    const matches = sharedStringsXml.matchAll(/<si>(.*?)<\/si>/gs);
    for (const match of matches) {
      const tMatch = match[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs);
      let str = '';
      for (const tm of tMatch) str += tm[1];
      sharedStrings.push(str);
    }
  }

  const rows = [];
  const rowMatches = sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs);
  for (const rMatch of rowMatches) {
    const cellMatches = rMatch[1].matchAll(/<c\s+([^>]*?)>(.*?)<\/c>/gs);
    const rowData = [];
    for (const cMatch of cellMatches) {
      const attrs = cMatch[1];
      const inner = cMatch[2];
      const isString = /t="s"/.test(attrs);
      const isInline = /t="inlineStr"/.test(attrs);
      if (isString) {
        const vMatch = inner.match(/<v>(.*?)<\/v>/);
        rowData.push(vMatch ? (sharedStrings[parseInt(vMatch[1], 10)] || '') : '');
      } else if (isInline) {
        const tMatch = inner.match(/<t[^>]*>(.*?)<\/t>/);
        rowData.push(tMatch ? tMatch[1] : '');
      } else {
        const vMatch = inner.match(/<v>(.*?)<\/v>/);
        rowData.push(vMatch ? vMatch[1] : '');
      }
    }
    if (rowData.length > 0) rows.push(rowData);
  }

  const points = [];
  const firstRow = rows[0] || [];
  const hasHeader = firstRow.some(cell => isNaN(parseFloat(cell)) && cell.trim() !== '');
  const dataRows = hasHeader ? rows.slice(1) : rows;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length < 2) continue;
    let name = `P${i + 1}`;
    let coords = [];
    let startIdx = 0;
    if (isNaN(parseFloat(row[0])) && row[0].trim() !== '') {
      name = row[0].trim();
      startIdx = 1;
    }
    for (let c = startIdx; c < row.length; c++) {
      const val = parseFloat(row[c]);
      if (!isNaN(val)) coords.push(val);
    }
    if (coords.length >= 2) {
      points.push({
        id: `p_${Date.now()}_${i}`,
        name,
        coords
      });
    }
  }

  return points;
}

/**
 * Generate official, benchmark-ready Excel (.xlsx) binary buffers
 * for 2D, 3D, and high-dimensional Multi-Objective engineering datasets.
 *
 * @param {'2d' | '3d' | '5d_engineering'} type
 * @returns {ArrayBuffer}
 */
export function createSampleExcelWorkbook(type = '2d') {
  const wb = XLSX.utils.book_new();

  if (type === '2d') {
    // Research Paper Figure 1 Benchmark (Section 2)
    const wsData = [
      ['Point_Name', 'f1_Cost (Minimize)', 'f2_Latency (Minimize)', 'Cluster_Tag'],
      ['P1', 1.0, 7.0, 'Front 1 Pareto'],
      ['P2', 3.0, 4.0, 'Front 1 Pareto'],
      ['P3', 7.0, 2.0, 'Front 1 Pareto'],
      ['P4', 5.0, 9.0, 'Front 2 Suboptimal'],
      ['P5', 7.0, 8.0, 'Front 2 Suboptimal'],
      ['P6', 9.0, 4.0, 'Front 2 Suboptimal'],
      ['P7', 7.0, 15.0, 'Front 3 Dominated'],
      ['P8', 8.0, 8.0, 'Front 3 Dominated']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Figure_1_Benchmark');
  } else if (type === '3d') {
    // 3D DTLZ Spherical Pareto Surface Benchmark
    const wsData = [
      ['Design_ID', 'Obj1_Cost ($)', 'Obj2_Delay (ms)', 'Obj3_Weight (kg)', 'Tier'],
      ['S1', 1.0, 1.5, 8.0, 'Primary Surface'],
      ['S2', 2.0, 7.5, 1.5, 'Primary Surface'],
      ['S3', 8.0, 1.8, 1.2, 'Primary Surface'],
      ['S4', 4.5, 4.5, 3.0, 'Primary Surface'],
      ['S5', 3.0, 4.0, 5.5, 'Primary Surface'],
      ['S6', 5.0, 2.5, 4.8, 'Primary Surface'],
      ['T1', 2.5, 3.0, 9.0, 'Secondary Layer'],
      ['T2', 3.5, 8.5, 3.0, 'Secondary Layer'],
      ['T3', 9.0, 3.5, 2.5, 'Secondary Layer'],
      ['T4', 6.0, 6.0, 4.5, 'Secondary Layer'],
      ['T5', 4.8, 5.5, 7.0, 'Secondary Layer'],
      ['U1', 4.0, 5.0, 10.5, 'Tertiary Layer'],
      ['U2', 5.5, 10.0, 4.5, 'Tertiary Layer'],
      ['U3', 10.5, 5.0, 4.0, 'Tertiary Layer'],
      ['U4', 8.0, 8.0, 6.0, 'Tertiary Layer'],
      ['U5', 6.5, 7.5, 8.5, 'Tertiary Layer']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '3D_Spherical_Front');
  } else {
    // 5-Objective Real-World Engineering Tradeoff (Automotive / Cloud Architecture)
    // Demonstrates multiple columns, mixed min/max objectives, and metadata columns!
    const wsData = [
      [
        'Architecture_ID',
        'Cost_USD (Min)',
        'Latency_ms (Min)',
        'Power_Watts (Min)',
        'Throughput_RPS (Max)',
        'Reliability_Pct (Max)',
        'Region_Code',
        'Engine_Type'
      ],
      ['Arch_A1', 120.0, 45.0, 25.0, 12000, 99.95, 'US-East', 'Microservices'],
      ['Arch_A2', 150.0, 28.0, 32.0, 18500, 99.99, 'EU-Central', 'Microservices'],
      ['Arch_A3', 90.0, 85.0, 18.0, 8500, 99.90, 'AP-South', 'Serverless'],
      ['Arch_A4', 210.0, 18.0, 48.0, 25000, 99.999, 'US-West', 'Dedicated GPU'],
      ['Arch_A5', 135.0, 38.0, 29.0, 14000, 99.92, 'US-East', 'Hybrid'],
      ['Arch_B1', 170.0, 52.0, 36.0, 11500, 99.85, 'SA-East', 'Monolith'],
      ['Arch_B2', 140.0, 60.0, 30.0, 10000, 99.80, 'AP-East', 'Monolith'],
      ['Arch_B3', 180.0, 40.0, 42.0, 16000, 99.90, 'EU-West', 'Microservices'],
      ['Arch_B4', 240.0, 25.0, 55.0, 22000, 99.95, 'US-East', 'Dedicated GPU'],
      ['Arch_C1', 220.0, 95.0, 60.0, 7500, 99.50, 'AF-South', 'Legacy'],
      ['Arch_C2', 260.0, 80.0, 70.0, 9000, 99.70, 'ME-Central', 'Legacy']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '5D_Cloud_Architecture');

    // Add a second sheet to demonstrate multi-sheet workbook handling!
    const ws2Data = [
      ['Parameter', 'Description', 'Optimization_Goal'],
      ['Cost_USD', 'Total infrastructure cost per month', 'Minimize (Lower is better)'],
      ['Latency_ms', '99th percentile response time', 'Minimize (Lower is better)'],
      ['Power_Watts', 'Average power draw under load', 'Minimize (Lower is better)'],
      ['Throughput_RPS', 'Peak handled requests per second', 'Maximize (Higher is better)'],
      ['Reliability_Pct', 'Uptime Service Level Agreement SLA', 'Maximize (Higher is better)']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'Objective_Definitions');
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}
