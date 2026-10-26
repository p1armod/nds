import React, { useState, useMemo } from 'react';
import { getFrontColor } from './Canvas2D';
import { dominates } from '../engine/dominance';

export default function DominanceDAG({
  population,
  activeStep,
  finalFronts,
  crowdingDistances = {},
  withinFrontRanks = {},
  minimizeDirections = null,
  sortByCrowdingDistance = false
}) {
  const [transitiveReduction, setTransitiveReduction] = useState(true);

  const currentFronts = activeStep?.fronts && activeStep.fronts.length > 0 ? activeStep.fronts : finalFronts;

  const tiers = useMemo(() => {
    const assignedIds = new Set(currentFronts.flat());
    const unassigned = population.filter(p => !assignedIds.has(p.id)).map(p => p.id);

    let res = currentFronts.map(front => [...front]);
    if (sortByCrowdingDistance) {
      // Sort each front tier strictly by withinFrontRank (#1, #2, #3...)
      res = res.map(front => {
        return [...front].sort((aId, bId) => {
          const rankA = activeStep?.withinFrontRanks?.[aId] ?? withinFrontRanks[aId] ?? 999;
          const rankB = activeStep?.withinFrontRanks?.[bId] ?? withinFrontRanks[bId] ?? 999;
          if (rankA !== rankB) return rankA - rankB;
          const cdA = activeStep?.crowdingDistances?.[aId] ?? crowdingDistances[aId] ?? 0;
          const cdB = activeStep?.crowdingDistances?.[bId] ?? crowdingDistances[bId] ?? 0;
          if (cdA === Infinity && cdB !== Infinity) return -1;
          if (cdB === Infinity && cdA !== Infinity) return 1;
          return cdB - cdA;
        });
      });
    } else {
      // Natural / raw population order in each front
      res = res.map(front => {
        return [...front].sort((aId, bId) => {
          const idxA = population.findIndex(p => p.id === aId);
          const idxB = population.findIndex(p => p.id === bId);
          return idxA - idxB;
        });
      });
    }
    if (unassigned.length > 0) res.push(unassigned);
    return res;
  }, [currentFronts, sortByCrowdingDistance, activeStep, withinFrontRanks, crowdingDistances, population]);

  // Compute node coordinates
  const { nodePositions, edgesToDraw } = useMemo(() => {
    const width = 600;
    const height = 450;
    const tierCount = Math.max(tiers.length, 1);
    const tierHeight = (height - 80) / tierCount;
    const positions = {};

    tiers.forEach((tier, tierIdx) => {
      const y = 50 + tierIdx * tierHeight + tierHeight / 2;
      const spacing = width / (tier.length + 1);
      tier.forEach((id, colIdx) => {
        positions[id] = {
          x: spacing * (colIdx + 1),
          y,
          tierIdx
        };
      });
    });

    // Compute raw dominance edges P -> Q
    const rawEdges = [];
    for (let i = 0; i < population.length; i++) {
      const p = population[i];
      for (let j = 0; j < population.length; j++) {
        if (i === j) continue;
        const q = population[j];
        if (dominates(p.coords, q.coords, minimizeDirections)) {
          rawEdges.push({ from: p.id, to: q.id });
        }
      }
    }

    // Transitive Reduction (Hasse Diagram)
    let filteredEdges = rawEdges;
    if (transitiveReduction && rawEdges.length > 0) {
      const adj = {};
      population.forEach(p => { adj[p.id] = new Set(); });
      rawEdges.forEach(e => adj[e.from].add(e.to));

      const hasLongerPath = (u, v) => {
        for (const w of adj[u]) {
          if (w !== v) {
            const visited = new Set();
            const queue = [w];
            while (queue.length > 0) {
              const curr = queue.shift();
              if (curr === v) return true;
              for (const next of adj[curr]) {
                if (!visited.has(next)) {
                  visited.add(next);
                  queue.push(next);
                }
              }
            }
          }
        }
        return false;
      };

      filteredEdges = rawEdges.filter(e => !hasLongerPath(e.from, e.to));
    }

    return { nodePositions: positions, edgesToDraw: filteredEdges };
  }, [population, tiers, transitiveReduction]);

  const activeLaser = activeStep?.laser;
  const activeIds = activeStep?.activePoints || [];
  const width = 600;
  const height = 450;
  const tierHeight = (height - 80) / Math.max(tiers.length, 1);

  return (
    <div className="dag-container-panel">
      <div className="dag-header">
        <div className="dag-title">
          <span>Dominance Graph (Poset DAG)</span>
          <span className="dag-subtitle">Topological Front Tiers</span>
        </div>
        <div className="dag-controls">
          <label className="dag-toggle-label">
            <input
              type="checkbox"
              checked={transitiveReduction}
              onChange={(e) => setTransitiveReduction(e.target.checked)}
            />
            <span>Hasse Reduction (Direct Dominance)</span>
          </label>
        </div>
      </div>

      <div className="dag-svg-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            <marker id="dag-arr" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
            </marker>
            <marker id="dag-arr-active" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Tier Background Bands */}
          {tiers.map((tier, idx) => {
            const isUnassigned = idx >= currentFronts.length;
            const rankNum = idx + 1;
            const color = isUnassigned ? '#64748b' : getFrontColor(rankNum);
            const y = 50 + idx * tierHeight;

            return (
              <g key={`tier-${idx}`}>
                <rect
                  x="10"
                  y={y}
                  width={width - 20}
                  height={tierHeight - 10}
                  rx="8"
                  fill={`${color}08`}
                  stroke={`${color}25`}
                  strokeWidth="1"
                />
                <text
                  x="22"
                  y={y + 22}
                  fill={color}
                  fontFamily="monospace"
                  fontSize="12"
                  fontWeight="700"
                >
                  {isUnassigned ? 'Unsorted Pool' : `Front ${rankNum} (F${rankNum})`}
                </text>
              </g>
            );
          })}

          {/* Edges */}
          {edgesToDraw.map((e, idx) => {
            const p1 = nodePositions[e.from];
            const p2 = nodePositions[e.to];
            if (!p1 || !p2) return null;

            const isActive = activeLaser && (
              (activeLaser.from === e.from && activeLaser.to === e.to) ||
              (activeLaser.from === e.to && activeLaser.to === e.from)
            );

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const d = `M ${p1.x} ${p1.y} C ${p1.x + dx * 0.2} ${p1.y + dy * 0.5}, ${p1.x + dx * 0.8} ${p1.y + dy * 0.5}, ${p2.x} ${p2.y}`;

            return (
              <path
                key={`edge-${idx}`}
                d={d}
                fill="none"
                stroke={isActive ? '#38bdf8' : 'rgba(100, 116, 139, 0.4)'}
                strokeWidth={isActive ? 2.5 : 1.5}
                markerEnd={isActive ? 'url(#dag-arr-active)' : 'url(#dag-arr)'}
              />
            );
          })}

          {/* Nodes */}
          {population.map(p => {
            const pos = nodePositions[p.id];
            if (!pos) return null;

            const stepRank = activeStep?.frontRank?.[p.id];
            const finalRank = currentFronts.findIndex(f => f.includes(p.id)) + 1 || null;
            const rank = (stepRank != null) ? stepRank : (activeStep?.fronts?.length > 0 ? null : finalRank);

            const color = getFrontColor(rank);
            const isActive = activeIds.includes(p.id);
            const cd = activeStep?.crowdingDistances?.[p.id] ?? crowdingDistances?.[p.id];
            const wfRank = activeStep?.withinFrontRanks?.[p.id] ?? withinFrontRanks?.[p.id];
            const isBoundary = cd === Infinity;
            const cdStr = isBoundary ? 'd=∞' : (cd !== undefined ? `d=${cd.toFixed(2)}` : '');

            return (
              <g key={p.id} transform={`translate(${pos.x}, ${pos.y})`}>
                {isActive && (
                  <circle
                    r="20"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                )}
                <circle
                  r="14"
                  fill="#0f172a"
                  stroke={color}
                  strokeWidth="2.5"
                />
                <text
                  y="4"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontFamily="monospace"
                  fontSize="11"
                  fontWeight="700"
                >
                  {p.name}
                </text>

                {/* Subtle crowding distance sub-label */}
                {sortByCrowdingDistance && cdStr && (
                  <text
                    y="25"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontFamily="monospace"
                    fontSize="9"
                    fontWeight="500"
                  >
                    {wfRank ? `#${wfRank} · ` : ''}{cdStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
