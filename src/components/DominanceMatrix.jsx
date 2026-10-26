import React, { useState, useMemo } from 'react';
import { getFrontColor } from './Canvas2D';
import { dominates, computeTheoreticalBounds } from '../engine/dominance';

export default function DominanceMatrix({
  population,
  activeStep,
  finalFronts,
  crowdingDistances = {},
  withinFrontRanks = {},
  objectiveNames = [],
  minimizeDirections = null,
  sortByCrowdingDistance = false
}) {
  const [viewMode, setViewMode] = useState('both'); // 'both', 'table1', 'table2', 'table3'

  const currentFronts = activeStep?.fronts && activeStep.fronts.length > 0 ? activeStep.fronts : finalFronts;
  const frontSizes = currentFronts.map(f => f.length);

  const activeCounts = activeStep?.dominationCounts || {};
  const activeSets = activeStep?.dominanceSets || {};
  const activeIds = activeStep?.activePoints || [];
  const activeCd = activeStep?.crowdingDistances || crowdingDistances || {};
  const activeWf = activeStep?.withinFrontRanks || withinFrontRanks || {};

  // Ground truth calculation for Dominated By and Dominance Sets
  const { dominatedByMap, dominanceSetMap } = useMemo(() => {
    const domBy = {};
    const domSet = {};
    population.forEach(p => {
      domBy[p.id] = [];
      domSet[p.id] = [];
    });

    for (let i = 0; i < population.length; i++) {
      const p = population[i];
      for (let j = 0; j < population.length; j++) {
        if (i === j) continue;
        const q = population[j];
        if (dominates(p.coords, q.coords, minimizeDirections)) {
          domSet[p.id].push(q);
          domBy[q.id].push(p);
        }
      }
    }
    return { dominatedByMap: domBy, dominanceSetMap: domSet };
  }, [population, minimizeDirections]);

  // Sort population by Crowded-Comparison Operator (Front Rank, then within-front rank / crowding distance)
  const displayPopulation = useMemo(() => {
    if (!sortByCrowdingDistance) return population;
    return [...population].sort((a, b) => {
      const stepRankA = activeStep?.frontRank?.[a.id];
      const finalRankA = currentFronts.findIndex(f => f.includes(a.id)) + 1 || 999999;
      const rankA = (stepRankA != null) ? stepRankA : (activeStep?.fronts?.length > 0 ? 999999 : finalRankA);

      const stepRankB = activeStep?.frontRank?.[b.id];
      const finalRankB = currentFronts.findIndex(f => f.includes(b.id)) + 1 || 999999;
      const rankB = (stepRankB != null) ? stepRankB : (activeStep?.fronts?.length > 0 ? 999999 : finalRankB);

      if (rankA !== rankB) return rankA - rankB;

      const wfA = activeWf[a.id] ?? 999999;
      const wfB = activeWf[b.id] ?? 999999;
      if (wfA !== wfB) return wfA - wfB;

      const cdA = activeCd[a.id] ?? 0;
      const cdB = activeCd[b.id] ?? 0;
      if (cdA === Infinity && cdB !== Infinity) return -1;
      if (cdB === Infinity && cdA !== Infinity) return 1;
      return cdB - cdA;
    });
  }, [population, sortByCrowdingDistance, activeStep, currentFronts, activeWf, activeCd]);

  if (!population || population.length === 0) {
    return (
      <div className="matrix-empty">
        <p>No population loaded</p>
      </div>
    );
  }

  return (
    <div className="matrix-container-panel">
      <div className="matrix-header">
        <div className="matrix-title">
          <span>Mathematical Dominance &amp; Crowding Records</span>
          <span className="matrix-subtitle">Tables 1, 2 &amp; 3 (NSGA-II Crowded-Comparison)</span>
        </div>
        <div className="matrix-tabs">
          <button
            className={`m-tab ${viewMode === 'both' ? 'active' : ''}`}
            onClick={() => setViewMode('both')}
          >
            All Tables
          </button>
          <button
            className={`m-tab ${viewMode === 'table1' ? 'active' : ''}`}
            onClick={() => setViewMode('table1')}
          >
            Table 1 (Dom. Count)
          </button>
          <button
            className={`m-tab ${viewMode === 'table2' ? 'active' : ''}`}
            onClick={() => setViewMode('table2')}
          >
            Table 2 (Dom. Set)
          </button>
          <button
            className={`m-tab ${viewMode === 'table3' ? 'active' : ''}`}
            onClick={() => setViewMode('table3')}
          >
            Table 3 (Crowding Dist)
          </button>
        </div>
      </div>

      <div className="matrix-content-scroll">
        {/* Table 1: Domination Count */}
        {(viewMode === 'both' || viewMode === 'table1') && (
          <div className="paper-table-section">
            <div className="table-section-title">
              <span className="badge-title">Table 1</span>
              <strong>Domination Count (n_p = |&#123;Q ∈ P | Q ≺ P&#125;|)</strong>
              {sortByCrowdingDistance && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  * Ordered by NSGA-II ≺_n (Front &amp; Crowding)
                </span>
              )}
            </div>
            <div className="paper-table-wrapper">
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th>Coords</th>
                    <th>Dominated By</th>
                    <th>Dom. Count (n_p)</th>
                    <th>Front</th>
                    <th>Crowding Dist (I_d)</th>
                    <th>Theoretical Bounds (Eq. 7 &amp; 8)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPopulation.map(p => {
                    const domList = dominatedByMap[p.id]?.map(q => q.name).join(', ') || '∅';
                    const stepRank = activeStep?.frontRank?.[p.id];
                    const finalRank = currentFronts.findIndex(f => f.includes(p.id)) + 1 || null;
                    const rank = (stepRank != null) ? stepRank : (activeStep?.fronts?.length > 0 ? null : finalRank);

                    const liveCount = activeCounts[p.id] !== undefined ? activeCounts[p.id] : dominatedByMap[p.id]?.length;
                    const isActive = activeIds.includes(p.id);
                    const frontColor = getFrontColor(rank);

                    const cd = activeCd[p.id];
                    const cdText = cd === Infinity ? '∞' : (cd !== undefined ? cd.toFixed(3) : '-');

                    let boundsStr = '-';
                    if (rank && currentFronts.length > 0) {
                      const bounds = computeTheoreticalBounds(rank - 1, frontSizes);
                      boundsStr = `Min: ${bounds.dominationCount.min} (k-1) | Max: ${bounds.dominationCount.max} (∑n_i)`;
                    }

                    return (
                      <tr key={p.id} className={isActive ? 'row-active' : ''}>
                        <td><strong style={{ color: frontColor }}>{p.name}</strong></td>
                        <td className="mono">({p.coords.join(', ')})</td>
                        <td className="mono">&#123; {domList} &#125;</td>
                        <td>
                          <span className={`count-badge ${liveCount === 0 ? 'zero' : ''}`}>{liveCount}</span>
                        </td>
                        <td>
                          {rank ? (
                            <span
                              className="front-pill"
                              style={{ background: `${frontColor}20`, color: frontColor, border: `1px solid ${frontColor}50` }}
                            >
                              F{rank}
                            </span>
                          ) : (
                            <span className="text-muted">Unsorted</span>
                          )}
                        </td>
                        <td className="mono">
                          <span className={`cd-badge ${cd === Infinity ? 'infinity' : ''}`}>{cdText}</span>
                        </td>
                        <td className="mono-small">{boundsStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-caption">
              * <strong>Theorem 3 (from paper):</strong> dom_count(P ∈ F_k) &lt; dom_count(P' ∈ F_&#123;k+1&#125;) is <em>not always true</em>.
            </div>
          </div>
        )}

        {/* Table 2: Dominance Set */}
        {(viewMode === 'both' || viewMode === 'table2') && (
          <div className="paper-table-section">
            <div className="table-section-title">
              <span className="badge-title">Table 2</span>
              <strong>Dominance Set (D_p / S_p = &#123;Q ∈ P | P ≺ Q&#125;)</strong>
              {sortByCrowdingDistance && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  * Ordered by NSGA-II ≺_n (Front &amp; Crowding)
                </span>
              )}
            </div>
            <div className="paper-table-wrapper">
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th>Dominance Set (D_p)</th>
                    <th>Cardinality |D_p|</th>
                    <th>Front</th>
                    <th>Crowding Dist (I_d)</th>
                    <th>Theoretical Bounds (Eq. 11 &amp; 12)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPopulation.map(p => {
                    const domSet = activeSets[p.id]
                      ? activeSets[p.id].map(id => population.find(item => item.id === id)?.name || id).join(', ') || '∅'
                      : (dominanceSetMap[p.id]?.map(q => q.name).join(', ') || '∅');

                    const card = activeSets[p.id] ? activeSets[p.id].length : dominanceSetMap[p.id]?.length;
                    const stepRank = activeStep?.frontRank?.[p.id];
                    const finalRank = currentFronts.findIndex(f => f.includes(p.id)) + 1 || null;
                    const rank = (stepRank != null) ? stepRank : (activeStep?.fronts?.length > 0 ? null : finalRank);

                    const isActive = activeIds.includes(p.id);
                    const frontColor = getFrontColor(rank);

                    const cd = activeCd[p.id];
                    const cdText = cd === Infinity ? '∞' : (cd !== undefined ? cd.toFixed(3) : '-');

                    let boundsStr = '-';
                    if (rank && currentFronts.length > 0) {
                      const bounds = computeTheoreticalBounds(rank - 1, frontSizes);
                      boundsStr = `Min: ${bounds.dominanceSet.min} (K-k) | Max: ${bounds.dominanceSet.max} (∑n_i)`;
                    }

                    return (
                      <tr key={p.id} className={isActive ? 'row-active' : ''}>
                        <td><strong style={{ color: frontColor }}>{p.name}</strong></td>
                        <td className="mono">&#123; {domSet} &#125;</td>
                        <td>
                          <span className={`count-badge ${card > 0 ? 'positive' : 'zero'}`}>{card}</span>
                        </td>
                        <td>
                          {rank ? (
                            <span
                              className="front-pill"
                              style={{ background: `${frontColor}20`, color: frontColor, border: `1px solid ${frontColor}50` }}
                            >
                              F{rank}
                            </span>
                          ) : (
                            <span className="text-muted">Unsorted</span>
                          )}
                        </td>
                        <td className="mono">
                          <span className={`cd-badge ${cd === Infinity ? 'infinity' : ''}`}>{cdText}</span>
                        </td>
                        <td className="mono-small">{boundsStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-caption">
              * <strong>Theorem 2 (from paper):</strong> Maximum cardinality of D_p cannot exceed N - 1.
            </div>
          </div>
        )}

        {/* Table 3: Crowding Distance & Within-Front Diversity */}
        {(viewMode === 'both' || viewMode === 'table3') && (
          <div className="paper-table-section">
            <div className="table-section-title">
              <span className="badge-title">Table 3</span>
              <strong>NSGA-II Crowding Distance &amp; Within-Front Diversity Ranking</strong>
            </div>
            <div className="paper-table-wrapper">
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>Within-Front Rank</th>
                    <th>Point</th>
                    <th>Front</th>
                    <th>Coordinates</th>
                    <th>Crowding Distance (I_d)</th>
                    <th>Diversity Classification</th>
                    <th>Crowded-Comparison Preference</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Collect points ordered by front rank, then strictly by within-front rank (#1, #2, #3...)
                    const sortedRows = [];
                    currentFronts.forEach((frontIds, fIdx) => {
                      const fNum = fIdx + 1;
                      const pointsInFront = frontIds
                        .map(pId => population.find(item => item.id === pId))
                        .filter(Boolean);

                      // Strictly sort by withinFrontRank ascending
                      pointsInFront.sort((a, b) => {
                        const rankA = activeWf[a.id] ?? 999999;
                        const rankB = activeWf[b.id] ?? 999999;
                        if (rankA !== rankB) return rankA - rankB;
                        const cdA = activeCd[a.id] ?? 0;
                        const cdB = activeCd[b.id] ?? 0;
                        if (cdA === Infinity && cdB !== Infinity) return -1;
                        if (cdB === Infinity && cdA !== Infinity) return 1;
                        return cdB - cdA;
                      });

                      pointsInFront.forEach((pt, localIdx) => {
                        const cd = activeCd[pt.id];
                        const wfRank = activeWf[pt.id] || (localIdx + 1);
                        sortedRows.push({
                          point: pt,
                          front: fNum,
                          withinFrontRank: wfRank,
                          crowdingDistance: cd
                        });
                      });
                    });

                    // Any unassigned points
                    population.forEach(p => {
                      if (!sortedRows.some(r => r.point.id === p.id)) {
                        sortedRows.push({
                          point: p,
                          front: null,
                          withinFrontRank: null,
                          crowdingDistance: 0
                        });
                      }
                    });

                    return sortedRows.map(({ point: p, front, withinFrontRank, crowdingDistance }) => {
                      const frontColor = getFrontColor(front);
                      const isInfinity = crowdingDistance === Infinity;
                      const cdStr = isInfinity ? '∞ (Infinity)' : (crowdingDistance !== undefined ? crowdingDistance.toFixed(4) : '-');
                      const isActive = activeIds.includes(p.id);

                      return (
                        <tr key={p.id} className={isActive ? 'row-active' : ''}>
                          <td>
                            {withinFrontRank ? (
                              <span className="badge-title" style={{ borderColor: frontColor, color: frontColor }}>
                                #{withinFrontRank}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: frontColor }}>{p.name}</strong>
                          </td>
                          <td>
                            {front ? (
                              <span
                                className="front-pill"
                                style={{ background: `${frontColor}20`, color: frontColor, border: `1px solid ${frontColor}50` }}
                              >
                                F{front}
                              </span>
                            ) : (
                              <span className="text-muted">Unsorted</span>
                            )}
                          </td>
                          <td className="mono">({p.coords.join(', ')})</td>
                          <td className="mono">
                            <span className={`cd-badge ${isInfinity ? 'infinity' : ''}`}>
                              {cdStr}
                            </span>
                          </td>
                          <td>
                            {isInfinity ? (
                              <span style={{ color: '#00e5a3', fontWeight: 600 }}>Boundary Anchor (Extreme Solution)</span>
                            ) : (
                              <span style={{ color: '#38bdf8' }}>Interior Solution (Normalized Spread)</span>
                            )}
                          </td>
                          <td className="mono-small">
                            {withinFrontRank === 1
                              ? '★ Highest Priority in Front (Most Diverse)'
                              : (isInfinity ? 'Boundary Priority (Preserves Extremes)' : `Preference Score: ${crowdingDistance?.toFixed(3) || '-'}`)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <div className="table-caption">
              * <strong>NSGA-II Crowded-Comparison Operator (≺_n):</strong> When two solutions belong to the same non-dominated front, the solution with the <em>larger crowding distance</em> is selected first, maximizing Pareto spread and solution diversity.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
