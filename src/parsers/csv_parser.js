/**
 * CSV / TSV / Clipboard Paste Parser
 */

export function parseDelimitedText(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (!firstLine.includes(',') && /\s{2,}/.test(firstLine)) delimiter = /\s+/;

  const rawRows = lines.map(line => {
    if (delimiter instanceof RegExp) {
      return line.trim().split(delimiter);
    }
    return line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
  });

  if (rawRows.length === 0) return [];

  const firstRow = rawRows[0];
  const hasHeader = firstRow.some(cell => isNaN(parseFloat(cell)) && cell.trim() !== '');

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const points = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length < 2) continue;

    let name = `P${i + 1}`;
    let coords = [];

    const firstColNum = parseFloat(row[0]);
    let startIdx = 0;

    if (isNaN(firstColNum) && row[0].trim() !== '') {
      name = row[0].trim();
      startIdx = 1;
    }

    for (let c = startIdx; c < row.length; c++) {
      const val = parseFloat(row[c]);
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
}
