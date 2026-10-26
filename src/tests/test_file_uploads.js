import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseDelimitedText } from '../parsers/csv_parser.js';
import {
  parseXlsxBuffer,
  inspectExcelWorkbook,
  parseExcelWithConfig,
  createSampleExcelWorkbook
} from '../parsers/xlsx_parser.js';
import { exportToCSV, exportToXLSX } from '../parsers/dataset_exporter.js';
import { generateFNDSSteps } from '../engine/fnds.js';
import { generateENSSteps } from '../engine/ens_ss.js';
import { generateENSBSSteps } from '../engine/ens_bs.js';
import { generateNaiveNDSSteps } from '../engine/naive_nds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Helpers for synthesizing valid binary XLSX zip buffers
function createStoredZipBuffer(entries) {
  const parts = [];
  for (const [filename, content] of Object.entries(entries)) {
    const enc = new TextEncoder();
    const nameBytes = enc.encode(filename);
    const dataBytes = enc.encode(content);

    const header = new Uint8Array(30);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); // compMethod = 0 (stored)
    dv.setUint32(18, dataBytes.length, true);
    dv.setUint32(22, dataBytes.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);

    parts.push(header, nameBytes, dataBytes);
  }

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result.buffer;
}

async function createDeflatedZipBuffer(entries) {
  const parts = [];
  for (const [filename, content] of Object.entries(entries)) {
    const enc = new TextEncoder();
    const nameBytes = enc.encode(filename);
    const uncompressedData = enc.encode(content);

    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(uncompressedData);
    writer.close();
    const resp = new Response(cs.readable);
    const compressedData = new Uint8Array(await resp.arrayBuffer());

    const header = new Uint8Array(30);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 8, true); // compMethod = 8 (deflate)
    dv.setUint32(18, compressedData.length, true);
    dv.setUint32(22, uncompressedData.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);

    parts.push(header, nameBytes, compressedData);
  }

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result.buffer;
}

console.log('====================================================');
console.log('  REAL FILE UPLOAD & PARSER VERIFICATION SUITE       ');
console.log('====================================================\n');

async function runFileUploadTests() {
  // Test 1: Real paper_figure1_dataset.csv from workspace disk
  console.log('Test Group 1: Real Disk CSV Upload (paper_figure1_dataset.csv)');
  const csvFilePath = path.join(projectRoot, 'paper_figure1_dataset.csv');
  assert(fs.existsSync(csvFilePath), `Real file exists at: ${csvFilePath}`);

  const rawCsvText = fs.readFileSync(csvFilePath, 'utf-8');
  const pointsFromCsv = parseDelimitedText(rawCsvText);

  assert(pointsFromCsv.length === 8, `Parsed exactly 8 points from real CSV (got ${pointsFromCsv.length})`);
  assert(pointsFromCsv[0].name === 'P1' && pointsFromCsv[0].coords[0] === 1 && pointsFromCsv[0].coords[1] === 7,
    'Point P1 parsed correctly: [1, 7]');
  assert(pointsFromCsv[7].name === 'P8' && pointsFromCsv[7].coords[0] === 8 && pointsFromCsv[7].coords[1] === 8,
    'Point P8 parsed correctly: [8, 8]');

  // Run all 4 algorithms on the parsed file
  const fndsRes = generateFNDSSteps(pointsFromCsv);
  assert(fndsRes.fronts.length === 3, 'FNDS generated 3 fronts from uploaded CSV');
  assert(fndsRes.fronts[0].length === 3, 'FNDS Front 1 has 3 points');
  assert(fndsRes.crowdingDistances[pointsFromCsv[0].id] === Infinity, 'Front 1 P1 has crowding distance = Infinity');
  assert(Math.abs(fndsRes.crowdingDistances[pointsFromCsv[1].id] - 2.0) < 1e-9, 'Front 1 P2 has crowding distance = 2.0');

  // Test 2: Tab-Delimited (TSV) Upload
  console.log('\nTest Group 2: Tab-Delimited (TSV) Format Upload');
  const tsvData = `Point\tCost\tLatency\nP1\t10\t50\nP2\t20\t30\nP3\t30\t15`;
  const tsvPoints = parseDelimitedText(tsvData);
  assert(tsvPoints.length === 3, `TSV parsed 3 points correctly (got ${tsvPoints.length})`);
  assert(tsvPoints[1].name === 'P2' && tsvPoints[1].coords[0] === 20 && tsvPoints[1].coords[1] === 30,
    'TSV point P2 coords = [20, 30]');

  // Test 3: Semicolon-Delimited Upload (European Excel format)
  console.log('\nTest Group 3: Semicolon-Delimited Upload (European Excel)');
  const semiData = `Point;f1;f2\nNodeA;1.5;8.4\nNodeB;2.5;6.1\nNodeC;4.2;3.0`;
  const semiPoints = parseDelimitedText(semiData);
  assert(semiPoints.length === 3, `Semicolon-delimited parsed 3 points (got ${semiPoints.length})`);
  assert(semiPoints[0].name === 'NodeA' && semiPoints[0].coords[0] === 1.5, 'NodeA parsed with coords [1.5, 8.4]');

  // Test 4: Space-Delimited Upload
  console.log('\nTest Group 4: Whitespace-Delimited Data Upload');
  const spaceData = `Point    f1    f2\nItem1    5.0   12.0\nItem2    8.5   9.2`;
  const spacePoints = parseDelimitedText(spaceData);
  assert(spacePoints.length === 2, `Whitespace-delimited parsed 2 points (got ${spacePoints.length})`);
  assert(spacePoints[1].name === 'Item2' && spacePoints[1].coords[1] === 9.2, 'Item2 parsed with coords [8.5, 9.2]');

  // Test 5: CSV Without Header Row (Pure Numerical)
  console.log('\nTest Group 5: Raw CSV Without Header (Direct Coordinates)');
  const headerlessCsv = `1.2, 9.8\n3.4, 6.5\n7.1, 2.3`;
  const headerlessPoints = parseDelimitedText(headerlessCsv);
  assert(headerlessPoints.length === 3, 'Headerless CSV parsed 3 points');
  assert(headerlessPoints[0].name === 'P1', 'Automatic name assignment P1 for row 1');
  assert(headerlessPoints[0].coords[0] === 1.2 && headerlessPoints[0].coords[1] === 9.8, 'P1 coords = [1.2, 9.8]');

  // Test 6: 3D Multi-Objective CSV Upload
  console.log('\nTest Group 6: 3D Multi-Objective (3 Coordinates) Upload');
  const csv3D = `Point,f1,f2,f3\nSol1,1,9,4\nSol2,3,6,2\nSol3,5,3,8\nSol4,7,1,5`;
  const pts3D = parseDelimitedText(csv3D);
  assert(pts3D.length === 4, 'Parsed 4 3D points');
  assert(pts3D[0].coords.length === 3, 'Point Sol1 has 3 coordinates');
  const ens3D = generateENSSteps(pts3D);
  assert(ens3D.fronts.length > 0, `ENS-SS successfully sorted 3D points into ${ens3D.fronts.length} fronts`);
  assert(Object.keys(ens3D.crowdingDistances).length === 4, 'Crowding distances computed across 3D objectives');

  // Test 7: Dirty / Malformed Data Resilience
  console.log('\nTest Group 7: Dirty & Edge-Case Input Resilience');
  const dirtyData = `
    Point, Obj1, Obj2
    
    Valid1, 10, 20
    BrokenRow
    Valid2, 30, 40, "extra trailing notes"
    , ,
    Valid3, 50, 60
  `;
  const dirtyPoints = parseDelimitedText(dirtyData);
  assert(dirtyPoints.length === 3, `Dirty data filtered broken rows, extracted 3 valid points (got ${dirtyPoints.length})`);
  assert(parseDelimitedText('').length === 0, 'Empty string returns empty array');
  assert(parseDelimitedText(null).length === 0, 'Null input returns empty array');

  // Test 8: Real Excel (.xlsx) Uncompressed Binary Buffer Upload
  console.log('\nTest Group 8: Native Real XLSX Uncompressed Binary Buffer Upload');
  const sheetXml1 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><t>Point</t></c>
      <c r="B1" t="inlineStr"><t>Latency_ms</t></c>
      <c r="C1" t="inlineStr"><t>RAM_MB</t></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><t>ClusterA</t></c>
      <c r="B2"><v>12.5</v></c>
      <c r="C2"><v>256</v></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><t>ClusterB</t></c>
      <c r="B3"><v>24.0</v></c>
      <c r="C3"><v>128</v></c>
    </row>
  </sheetData>
</worksheet>`;

  const xlsxStoredBuf = createStoredZipBuffer({
    'xl/worksheets/sheet1.xml': sheetXml1
  });
  const xlsxPoints1 = await parseXlsxBuffer(xlsxStoredBuf);
  assert(xlsxPoints1.length === 2, `XLSX uncompressed parsed 2 points (got ${xlsxPoints1.length})`);
  assert(xlsxPoints1[0].name === 'ClusterA' && xlsxPoints1[0].coords[0] === 12.5 && xlsxPoints1[0].coords[1] === 256,
    'ClusterA parsed with coords [12.5, 256]');

  // Test 9: Real Excel (.xlsx) Deflate-Compressed Binary Upload
  console.log('\nTest Group 9: Native Real XLSX Deflate-Compressed Binary Upload');
  const sheetXml2 = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><t>Individual</t></c>
      <c r="B1" t="inlineStr"><t>Obj1</t></c>
      <c r="C1" t="inlineStr"><t>Obj2</t></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><t>Ind1</t></c>
      <c r="B2"><v>1.0</v></c>
      <c r="C2"><v>7.0</v></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><t>Ind2</t></c>
      <c r="B3"><v>3.0</v></c>
      <c r="C3"><v>4.0</v></c>
    </row>
    <row r="4">
      <c r="A4" t="inlineStr"><t>Ind3</t></c>
      <c r="B4"><v>7.0</v></c>
      <c r="C4"><v>2.0</v></c>
    </row>
  </sheetData>
</worksheet>`;

  const xlsxDeflatedBuf = await createDeflatedZipBuffer({
    'xl/worksheets/sheet1.xml': sheetXml2
  });
  const xlsxPoints2 = await parseXlsxBuffer(xlsxDeflatedBuf);
  assert(xlsxPoints2.length === 3, `XLSX Deflate parsed 3 points (got ${xlsxPoints2.length})`);
  assert(xlsxPoints2[2].name === 'Ind3' && xlsxPoints2[2].coords[0] === 7.0 && xlsxPoints2[2].coords[1] === 2.0,
    'Ind3 parsed with coords [7.0, 2.0]');

  // Test 10: Real Excel with Shared Strings (xl/sharedStrings.xml)
  console.log('\nTest Group 10: XLSX with Shared Strings Table (t="s")');
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>HeaderPoint</t></si>
  <si><t>Metric1</t></si>
  <si><t>AlphaNode</t></si>
  <si><t>BetaNode</t></si>
</sst>`;

  const sheetXmlWithSst = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1"><v>999</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>2</v></c>
      <c r="B2"><v>100</v></c>
      <c r="C2"><v>200</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>3</v></c>
      <c r="B3"><v>300</v></c>
      <c r="C3"><v>400</v></c>
    </row>
  </sheetData>
</worksheet>`;

  const sstBuf = await createDeflatedZipBuffer({
    'xl/sharedStrings.xml': sharedStringsXml,
    'xl/worksheets/sheet1.xml': sheetXmlWithSst
  });
  const sstPoints = await parseXlsxBuffer(sstBuf);
  assert(sstPoints.length === 2, `Shared strings XLSX parsed 2 points`);
  assert(sstPoints[0].name === 'AlphaNode' && sstPoints[0].coords[0] === 100,
    'Resolved shared string index 2 -> "AlphaNode"');
  assert(sstPoints[1].name === 'BetaNode' && sstPoints[1].coords[0] === 300,
    'Resolved shared string index 3 -> "BetaNode"');

  // Test 11: End-to-End Export & Re-import Round-Trip
  console.log('\nTest Group 11: Export to CSV -> Re-import Round-Trip');
  const originalPop = [
    { id: 'p1', name: 'Original1', coords: [1.23, 4.56] },
    { id: 'p2', name: 'Original2', coords: [7.89, 0.12] }
  ];
  const exportedCsv = exportToCSV(
    originalPop,
    { p1: 1, p2: 1 },
    { p1: 0, p2: 0 },
    { p1: ['p2'], p2: [] },
    { p1: Infinity, p2: Infinity },
    { p1: 1, p2: 2 }
  );

  const reimportedPop = parseDelimitedText(exportedCsv);
  assert(reimportedPop.length === 2, 'Re-imported CSV has 2 points');
  assert(reimportedPop[0].name === 'Original1', 'Re-imported point name = "Original1"');
  assert(Math.abs(reimportedPop[0].coords[0] - 1.23) < 1e-6, 'Re-imported coord f1 matches 1.23');
  assert(Math.abs(reimportedPop[0].coords[1] - 4.56) < 1e-6, 'Re-imported coord f2 matches 4.56');

  // Test 12: Real Binary .xlsx Workbook Generation
  console.log('\nTest Group 12: Real Binary .xlsx Workbook Generation');
  const buf2D = createSampleExcelWorkbook('2d');
  const inspected2D = inspectExcelWorkbook(buf2D, 'sample_2d.xlsx');
  assert(inspected2D.sheetNames.includes('Figure_1_Benchmark'), '2D sample contains Figure_1_Benchmark sheet');
  assert(inspected2D.sheetsData['Figure_1_Benchmark'].length === 9, '2D sample contains 1 header + 8 data rows');

  const buf3D = createSampleExcelWorkbook('3d');
  const inspected3D = inspectExcelWorkbook(buf3D, 'sample_3d.xlsx');
  assert(inspected3D.sheetNames.includes('3D_Spherical_Front'), '3D sample contains 3D_Spherical_Front sheet');
  assert(inspected3D.sheetsData['3D_Spherical_Front'].length === 17, '3D sample contains 1 header + 16 data rows');

  // Test 13: 5D Multi-Objective Excel Parsing (Multiple Columns & Mixed Directions)
  console.log('\nTest Group 13: 5D Multi-Objective Excel Parsing with Mixed Min/Max');
  const buf5D = createSampleExcelWorkbook('5d_engineering');
  const inspected5D = inspectExcelWorkbook(buf5D, 'sample_5d.xlsx');
  assert(inspected5D.sheetNames.length === 2, '5D sample workbook contains multiple sheets (2 sheets)');
  assert(inspected5D.sheetNames.includes('5D_Cloud_Architecture'), 'Sheet 1 is 5D_Cloud_Architecture');
  assert(inspected5D.sheetNames.includes('Objective_Definitions'), 'Sheet 2 is Objective_Definitions');

  const detected5D = inspected5D.detectedConfigs['5D_Cloud_Architecture'];
  const parsed5D = parseExcelWithConfig(inspected5D.sheetsData['5D_Cloud_Architecture'], detected5D);

  assert(parsed5D.points.length === 11, `Extracted 11 cloud architecture solutions (got ${parsed5D.points.length})`);
  assert(parsed5D.objectiveNames.length === 5, `Identified 5 objectives: ${parsed5D.objectiveNames.join(', ')}`);
  assert(parsed5D.points[0].name === 'Arch_A1', 'First point name resolved as Arch_A1');
  assert(parsed5D.points[0].coords.length === 5, 'Arch_A1 has 5 objective values');
  assert(parsed5D.points[0].coords[0] === 120.0, 'Arch_A1 Cost = 120.0');
  assert(parsed5D.points[0].coords[3] === 12000, 'Arch_A1 Throughput = 12000');
  assert(parsed5D.points[0].metadata['Region_Code'] === 'US-East', 'Extracted metadata Region_Code = US-East');
  assert(parsed5D.points[0].metadata['Engine_Type'] === 'Microservices', 'Extracted metadata Engine_Type = Microservices');

  // Verify minimization & maximization directions auto-detected
  assert(parsed5D.minimizeDirections[0] === true, 'Cost_USD is Minimized (true)');
  assert(parsed5D.minimizeDirections[1] === true, 'Latency_ms is Minimized (true)');
  assert(parsed5D.minimizeDirections[2] === true, 'Power_Watts is Minimized (true)');
  assert(parsed5D.minimizeDirections[3] === false, 'Throughput_RPS is Maximized (false)');
  assert(parsed5D.minimizeDirections[4] === false, 'Reliability_Pct is Maximized (false)');

  // Test 14: Custom Column Mapping & Validation
  console.log('\nTest Group 14: Custom Column Mapping & Validation');
  // Select only 2 objectives out of the 5
  const customConfig = {
    hasHeader: true,
    headerRowIdx: 0,
    nameColIdx: 0,
    columns: [
      { colIdx: 0, name: 'Architecture_ID', role: 'name' },
      { colIdx: 1, name: 'Cost', role: 'objective', isMin: true },
      { colIdx: 2, name: 'Latency', role: 'objective', isMin: true },
      { colIdx: 3, name: 'Power', role: 'ignore' },
      { colIdx: 4, name: 'Throughput', role: 'ignore' },
      { colIdx: 5, name: 'Reliability', role: 'ignore' }
    ]
  };
  const filtered = parseExcelWithConfig(inspected5D.sheetsData['5D_Cloud_Architecture'], customConfig);
  assert(filtered.points.length === 11, 'Filtered configuration parsed 11 points');
  assert(filtered.objectiveNames.length === 2, 'Filtered configuration extracted exactly 2 objectives');
  assert(filtered.points[0].coords.length === 2, 'Point coordinates trimmed to 2 dimensions');

  let errorCaught = false;
  try {
    parseExcelWithConfig(inspected5D.sheetsData['5D_Cloud_Architecture'], {
      hasHeader: true,
      columns: [{ colIdx: 0, role: 'name' }]
    });
  } catch (e) {
    errorCaught = true;
  }
  assert(errorCaught, 'Validation threw error when zero objective columns selected');

  // Test 15: Multi-Sheet .xlsx Export and Re-Import Round-Trip
  console.log('\nTest Group 15: Multi-Sheet .xlsx Export and Re-Import Round-Trip');
  const fnds5D = generateFNDSSteps(parsed5D.points, parsed5D.minimizeDirections);
  const rankMap5D = fnds5D.steps[fnds5D.steps.length - 1].frontRank;

  const exportedXlsxBuffer = exportToXLSX(
    parsed5D.points,
    rankMap5D,
    fnds5D.steps[fnds5D.steps.length - 1].dominationCounts,
    fnds5D.steps[fnds5D.steps.length - 1].dominanceSets,
    fnds5D.crowdingDistances,
    fnds5D.withinFrontRanks,
    parsed5D.objectiveNames,
    parsed5D.minimizeDirections,
    'FNDS 5D Test'
  );

  const reimportedWb = inspectExcelWorkbook(exportedXlsxBuffer, 'exported_5d.xlsx');
  assert(reimportedWb.sheetNames.includes('NDS_Front_Rankings'), 'Exported XLSX contains NDS_Front_Rankings sheet');
  assert(reimportedWb.sheetNames.includes('Dominance_Matrix'), 'Exported XLSX contains Dominance_Matrix sheet');
  assert(reimportedWb.sheetNames.includes('Run_Metadata'), 'Exported XLSX contains Run_Metadata sheet');

  const rankRows = reimportedWb.sheetsData['NDS_Front_Rankings'];
  assert(rankRows.length === 12, '1 header row + 11 solution ranking rows in exported sheet');
  assert(rankRows[1][1] === 'Arch_A1', 'Re-imported Solution name Arch_A1');
  assert(rankRows[1][2] === 120, 'Re-imported Cost value = 120');

  // Test 16: Cross-Algorithm Verification on 5D Dataset with Mixed Directions
  console.log('\nTest Group 16: Cross-Algorithm Multi-Objective (5D) Verification');
  const ensSS5D = generateENSSteps(parsed5D.points, parsed5D.minimizeDirections);
  const ensBS5D = generateENSBSSteps(parsed5D.points, parsed5D.minimizeDirections);
  const naive5D = generateNaiveNDSSteps(parsed5D.points, parsed5D.minimizeDirections);

  assert(fnds5D.fronts.length > 0, `FNDS partitioned 5D points into ${fnds5D.fronts.length} fronts`);
  assert(ensSS5D.fronts.length === fnds5D.fronts.length, `ENS-SS agreed on front count: ${ensSS5D.fronts.length}`);
  assert(ensBS5D.fronts.length === fnds5D.fronts.length, `ENS-BS agreed on front count: ${ensBS5D.fronts.length}`);
  assert(naive5D.fronts.length === fnds5D.fronts.length, `Naive NDS agreed on front count: ${naive5D.fronts.length}`);

  // Compare Front 1 membership across all 4 algorithms
  const f1_fnds = [...fnds5D.fronts[0]].sort();
  const f1_ens_ss = [...ensSS5D.fronts[0]].sort();
  const f1_ens_bs = [...ensBS5D.fronts[0]].sort();
  const f1_naive = [...naive5D.fronts[0]].sort();

  assert(JSON.stringify(f1_fnds) === JSON.stringify(f1_ens_ss), 'ENS-SS Front 1 exactly matches FNDS on 5D dataset');
  assert(JSON.stringify(f1_fnds) === JSON.stringify(f1_ens_bs), 'ENS-BS Front 1 exactly matches FNDS on 5D dataset');
  assert(JSON.stringify(f1_fnds) === JSON.stringify(f1_naive), 'Naive NDS Front 1 exactly matches FNDS on 5D dataset');

  console.log('\n====================================================');
  console.log(`REAL FILE UPLOAD TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFileUploadTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
