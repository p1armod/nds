import React, { useState, useMemo } from 'react';
import { computeNdfTriangle, getBellPolynomialString } from '../engine/bell_ndf';

export default function NDFTriangle() {
  const [maxN, setMaxN] = useState(8);
  const [highlightedCell, setHighlightedCell] = useState(null); // { n, k }

  const triangle = useMemo(() => computeNdfTriangle(maxN), [maxN]);
  const polyStr = useMemo(() => getBellPolynomialString(maxN), [maxN]);
  const activeRow = triangle[maxN - 1];

  // Recurrence breakdown for hovered cell
  const recurrenceInfo = useMemo(() => {
    if (!highlightedCell || highlightedCell.n <= 1) return null;
    const { n, k } = highlightedCell;
    const prevRow = triangle[n - 2];
    const prev1 = k > 1 ? prevRow.coefficients[k - 2] : 0;
    const prev2 = k <= n - 1 ? prevRow.coefficients[k - 1] : 0;
    const currentVal = triangle[n - 1].coefficients[k - 1];

    return {
      n,
      k,
      prev1,
      prev2,
      currentVal,
      sum: prev1 + prev2
    };
  }, [highlightedCell, triangle]);

  return (
    <div className="ndf-container-panel">
      <div className="ndf-header">
        <div className="ndf-title">
          <span>Combinations of Fronts &amp; NDF Triangle</span>
          <span className="ndf-subtitle">Section 5 (Equations 15–19 &amp; Figure 5)</span>
        </div>
        <div className="ndf-controls">
          <label>Rows (N): <span className="ndf-n-val">{maxN}</span></label>
          <input
            type="range"
            min="3"
            max="10"
            value={maxN}
            onChange={(e) => setMaxN(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      <div className="ndf-body">
        {/* Bell Polynomial Banner */}
        <div className="ndf-formula-banner">
          <div className="poly-title">Bell Polynomial for N = {maxN} points:</div>
          <div className="poly-math">{polyStr}</div>
          <div className="poly-sum">
            Total Possible Front Combinations (Bell Number B_{maxN}): <strong>{activeRow.bellNumberStr}</strong>
          </div>
        </div>

        {/* NDF Triangle Table (Figure 5) */}
        <div className="ndf-table-wrapper">
          <table className="ndf-triangle-table">
            <thead>
              <tr>
                <th>Points (N)</th>
                {Array.from({ length: maxN }, (_, i) => (
                  <th key={`k-${i + 1}`}>k = {i + 1}</th>
                ))}
                <th className="bell-col">Bell Number (B_N)</th>
              </tr>
            </thead>
            <tbody>
              {triangle.map((row) => {
                const N = row.N;
                return (
                  <tr key={`row-${N}`}>
                    <td className="row-label">N = {N}</td>
                    {Array.from({ length: maxN }, (_, i) => {
                      const k = i + 1;
                      if (k <= N) {
                        const val = row.coefficients[k - 1];
                        const isMain = highlightedCell?.n === N && highlightedCell?.k === k;
                        const isParent = highlightedCell && highlightedCell.n === N + 1 && (highlightedCell.k === k + 1 || highlightedCell.k === k);

                        return (
                          <td
                            key={`cell-${N}-${k}`}
                            className={`coeff-cell ${isMain ? 'active-cell' : (isParent ? 'parent-cell' : '')}`}
                            onMouseEnter={() => setHighlightedCell({ n: N, k })}
                            onMouseLeave={() => setHighlightedCell(null)}
                          >
                            {val.toLocaleString()}
                          </td>
                        );
                      }
                      return <td key={`empty-${N}-${k}`} className="empty-cell">-</td>;
                    })}
                    <td className="bell-col"><strong>{row.bellNumberStr}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Explainer / Trace Box */}
        <div className="ndf-explainer">
          {recurrenceInfo ? (
            <div className="explainer-calc">
              <span className="calc-tag">Evaluating a_{recurrenceInfo.n}^{recurrenceInfo.k} (k={recurrenceInfo.k} fronts):</span>
              <code>
                a_{recurrenceInfo.n}^{recurrenceInfo.k} = {recurrenceInfo.k} × (a_{recurrenceInfo.n - 1}^{recurrenceInfo.k - 1} + a_{recurrenceInfo.n - 1}^{recurrenceInfo.k}) = {recurrenceInfo.k} × ({recurrenceInfo.prev1.toLocaleString()} + {recurrenceInfo.prev2.toLocaleString()}) = <strong>{recurrenceInfo.currentVal.toLocaleString()}</strong>
              </code>
              <div className="explainer-sub">
                Shows all possible ways to partition {recurrenceInfo.n} points into exactly {recurrenceInfo.k} ordered non-dominated fronts.
              </div>
            </div>
          ) : (
            <>
              <div className="explainer-rule">
                <strong>Recurrence Relation (Eq. 19):</strong>
                <code>a_N^k = k × (a_&#123;N-1&#125;^&#123;k-1&#125; + a_&#123;N-1&#125;^k)</code>
              </div>
              <div className="explainer-desc">
                Hover any cell in the triangle above to trace its two parent terms in row N-1. The row sum gives the total possible front configurations (Bell number B_N), which grows exponentially as shown in Figure 2 of the paper.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
