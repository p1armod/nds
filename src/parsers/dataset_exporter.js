/**
 * Dataset & Non-Dominated Sorting Results Exporter
 * Supports CSV, TSV, and Multi-Sheet Enterprise Excel (.xlsx) workbooks
 * with arbitrary objectives/dimensions, custom names, and min/max indicators.
 */

import * as XLSX from 'xlsx';
import { dominates } from '../engine/dominance.js';

/**
 * Export results to CSV text format
 */
export function exportToCSV(
  population,
  frontRankMap = {},
  dominationCounts = null,
  dominanceSets = null,
  crowdingDistances = null,
  withinFrontRanks = null,
  objectiveNames = null,
  minimizeDirections = null
) {
  const maxCoords = population.reduce((max, p) => Math.max(max, p.coords.length), 2);
  const headers = ['Point'];

  for (let m = 0; m < maxCoords; m++) {
    const objName = objectiveNames && objectiveNames[m] ? objectiveNames[m] : `Objective${m + 1}`;
    const dir = minimizeDirections && minimizeDirections[m] === false ? 'Maximize' : 'Minimize';
    headers.push(`${objName}_${dir}`);
  }
  headers.push('FrontRank', 'WithinFrontRank', 'CrowdingDistance', 'DominationCount', 'DominanceSet');

  const rows = [headers.join(',')];

  population.forEach(p => {
    const row = [p.name];
    for (let m = 0; m < maxCoords; m++) {
      row.push(p.coords[m] !== undefined ? p.coords[m] : '');
    }
    const rank = frontRankMap[p.id] !== undefined && frontRankMap[p.id] !== null ? `F${frontRankMap[p.id]}` : 'Unsorted';
    row.push(rank);

    const wfRank = withinFrontRanks && withinFrontRanks[p.id] !== undefined && withinFrontRanks[p.id] !== null ? `#${withinFrontRanks[p.id]}` : '-';
    row.push(wfRank);

    let cdStr = '-';
    if (crowdingDistances && crowdingDistances[p.id] !== undefined) {
      const cd = crowdingDistances[p.id];
      cdStr = cd === Infinity ? 'Infinity' : cd.toFixed(4);
    }
    row.push(cdStr);

    const domCount = dominationCounts && dominationCounts[p.id] !== undefined ? dominationCounts[p.id] : '-';
    row.push(domCount);

    const domSet = dominanceSets && dominanceSets[p.id] ? `"${dominanceSets[p.id].map(id => {
      const q = population.find(item => item.id === id);
      return q ? q.name : id;
    }).join(';')}"` : '""';
    row.push(domSet);

    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Export results to a multi-sheet Microsoft Excel (.xlsx) workbook
 *
 * @param {Array<{ id: string, name: string, coords: number[] }>} population
 * @param {Record<string, number>} frontRankMap
 * @param {Record<string, number>} [dominationCounts]
 * @param {Record<string, string[]>} [dominanceSets]
 * @param {Record<string, number>} [crowdingDistances]
 * @param {Record<string, number>} [withinFrontRanks]
 * @param {string[]} [objectiveNames]
 * @param {boolean[]} [minimizeDirections]
 * @param {string} [algoName]
 * @returns {Uint8Array}
 */
export function exportToXLSX(
  population,
  frontRankMap = {},
  dominationCounts = null,
  dominanceSets = null,
  crowdingDistances = null,
  withinFrontRanks = null,
  objectiveNames = null,
  minimizeDirections = null,
  algoName = 'FNDS (NSGA-II)'
) {
  const wb = XLSX.utils.book_new();
  const maxCoords = population.reduce((max, p) => Math.max(max, p.coords.length), 2);

  // --- SHEET 1: Pareto Fronts & Rankings ---
  const sheet1Headers = ['Point_ID', 'Point_Name'];
  for (let m = 0; m < maxCoords; m++) {
    const objName = objectiveNames && objectiveNames[m] ? objectiveNames[m] : `Objective_${m + 1}`;
    const dir = minimizeDirections && minimizeDirections[m] === false ? '(Max)' : '(Min)';
    sheet1Headers.push(`${objName} ${dir}`);
  }
  sheet1Headers.push(
    'Pareto_Front_Rank',
    'Within_Front_Rank',
    'Crowding_Distance',
    'Domination_Count_np',
    'Dominance_Set_Sp'
  );

  const sheet1Data = [sheet1Headers];

  population.forEach(p => {
    const row = [p.id, p.name];
    for (let m = 0; m < maxCoords; m++) {
      row.push(p.coords[m] !== undefined ? p.coords[m] : '');
    }

    const rank = frontRankMap[p.id] !== undefined && frontRankMap[p.id] !== null ? `F${frontRankMap[p.id]}` : 'Unsorted';
    row.push(rank);

    const wf = withinFrontRanks && withinFrontRanks[p.id] !== undefined && withinFrontRanks[p.id] !== null ? withinFrontRanks[p.id] : '';
    row.push(wf);

    let cdVal = '';
    if (crowdingDistances && crowdingDistances[p.id] !== undefined) {
      const cd = crowdingDistances[p.id];
      cdVal = cd === Infinity ? 'Infinity' : Number(cd.toFixed(4));
    }
    row.push(cdVal);

    const np = dominationCounts && dominationCounts[p.id] !== undefined ? dominationCounts[p.id] : '';
    row.push(np);

    const sp = dominanceSets && dominanceSets[p.id]
      ? dominanceSets[p.id].map(id => population.find(item => item.id === id)?.name || id).join(', ')
      : '';
    row.push(sp);

    sheet1Data.push(row);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'NDS_Front_Rankings');

  // --- SHEET 2: Pairwise Dominance Matrix ---
  const matrixHeaders = ['Point', ...population.map(p => p.name)];
  const matrixData = [matrixHeaders];

  for (let i = 0; i < population.length; i++) {
    const p = population[i];
    const row = [p.name];
    for (let j = 0; j < population.length; j++) {
      if (i === j) {
        row.push('-');
      } else {
        const q = population[j];
        const pDomQ = dominates(p.coords, q.coords, minimizeDirections);
        row.push(pDomQ ? 1 : 0);
      }
    }
    matrixData.push(row);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Dominance_Matrix');

  // --- SHEET 3: Experiment Metadata & Summary ---
  const maxRank = Object.values(frontRankMap).reduce((max, r) => Math.max(max, r || 0), 0);
  const metadataData = [
    ['Parameter', 'Value', 'Description'],
    ['Algorithm', algoName, 'Non-Dominated Sorting Engine'],
    ['Population Size (N)', population.length, 'Total candidates/points evaluated'],
    ['Dimensions / Objectives (M)', maxCoords, 'Number of objective dimensions evaluated'],
    ['Number of Pareto Fronts (K)', maxRank, 'Total partitioned non-dominated frontiers'],
    ['Timestamp', new Date().toISOString(), 'Export execution timestamp']
  ];

  if (objectiveNames && objectiveNames.length > 0) {
    metadataData.push(['', '', '']);
    metadataData.push(['Objective Index', 'Objective Name', 'Optimization Goal']);
    objectiveNames.forEach((name, idx) => {
      const isMin = minimizeDirections && minimizeDirections[idx] === false ? 'Maximize (Higher is better)' : 'Minimize (Lower is better)';
      metadataData.push([`Objective ${idx + 1}`, name, isMin]);
    });
  }

  const ws3 = XLSX.utils.aoa_to_sheet(metadataData);
  XLSX.utils.book_append_sheet(wb, ws3, 'Run_Metadata');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

/**
 * Trigger browser file download from string or buffer
 */
export function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8;') {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType })
    : new Blob([content], { type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
