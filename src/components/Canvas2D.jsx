import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, SlidersHorizontal } from 'lucide-react';

export const FRONT_COLORS = [
  '#00e5a3', // Front 1: Emerald Jade (Pareto Optimal)
  '#38bdf8', // Front 2: Cerulean Sky
  '#a78bfa', // Front 3: Electric Violet
  '#f59e0b', // Front 4: Warm Amber
  '#ec4899', // Front 5: Rose Pink
  '#06b6d4', // Front 6: Bright Cyan
  '#84cc16', // Front 7: Lime
  '#94a3b8'  // Front 8+: Neutral Slate
];

export function getFrontColor(rank) {
  if (!rank || rank < 1) return '#64748b';
  const idx = (rank - 1) % FRONT_COLORS.length;
  return FRONT_COLORS[idx];
}

export default function Canvas2D({
  population,
  activeStep,
  finalFronts,
  crowdingDistances = {},
  withinFrontRanks = {},
  objectiveNames = [],
  minimizeDirections = [],
  projectionAxes = { x: 0, y: 1 },
  onProjectionAxesChange,
  onCanvasClick,
  onPointMoved,
  sortByCrowdingDistance = false
}) {
  const canvasRef = useRef(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [draggedPoint, setDraggedPoint] = useState(null);

  const M = population?.[0]?.coords?.length || 2;
  const axisX = Math.min(projectionAxes?.x ?? 0, Math.max(0, M - 1));
  const axisY = Math.min(projectionAxes?.y ?? 1, Math.max(0, M - 1));

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs for tracking drag vs pan interaction
  const isDraggingPointRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const hasMovedSignificantlyRef = useRef(false);

  const padding = 60;

  // Viewport bounds based on population
  const getBounds = useCallback(() => {
    if (!population || population.length === 0) {
      return { minX: 0, maxX: 12, minY: 0, maxY: 12 };
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    population.forEach(p => {
      const x = p.coords[axisX] !== undefined ? p.coords[axisX] : 0;
      const y = p.coords[axisY] !== undefined ? p.coords[axisY] : 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const rangeX = Math.max(maxX - minX, 2);
    const rangeY = Math.max(maxY - minY, 2);
    return {
      minX: Math.max(0, Math.floor(minX - rangeX * 0.15)),
      maxX: Math.ceil(maxX + rangeX * 0.2),
      minY: Math.max(0, Math.floor(minY - rangeY * 0.15)),
      maxY: Math.ceil(maxY + rangeY * 0.2)
    };
  }, [population, axisX, axisY]);

  // Transform data coordinate to screen coordinate with zoom & pan
  const toScreen = useCallback((x, y, bounds, width, height, currentZoom, currentPan) => {
    const plotW = Math.max(width - padding * 2, 50);
    const plotH = Math.max(height - padding * 2, 50);
    const rangeX = Math.max(bounds.maxX - bounds.minX, 1);
    const rangeY = Math.max(bounds.maxY - bounds.minY, 1);

    const baseX = padding + (x - bounds.minX) * (plotW / rangeX);
    const baseY = height - padding - (y - bounds.minY) * (plotH / rangeY);

    const cx = width / 2;
    const cy = height / 2;

    const sx = cx + (baseX - cx) * currentZoom + currentPan.x;
    const sy = cy + (baseY - cy) * currentZoom + currentPan.y;

    return { x: sx, y: sy };
  }, [padding]);

  // Inverse: screen to data coordinate
  const toData = useCallback((sx, sy, bounds, width, height, currentZoom, currentPan) => {
    const plotW = Math.max(width - padding * 2, 50);
    const plotH = Math.max(height - padding * 2, 50);
    const rangeX = Math.max(bounds.maxX - bounds.minX, 1);
    const rangeY = Math.max(bounds.maxY - bounds.minY, 1);

    const cx = width / 2;
    const cy = height / 2;

    const baseX = cx + (sx - cx - currentPan.x) / currentZoom;
    const baseY = cy + (sy - cy - currentPan.y) / currentZoom;

    const x = bounds.minX + (baseX - padding) / (plotW / rangeX);
    const y = bounds.minY + (height - padding - baseY) / (plotH / rangeY);

    return {
      x: Math.round(Math.max(0, x) * 10) / 10,
      y: Math.round(Math.max(0, y) * 10) / 10
    };
  }, [padding]);

  // Zoom controls with proportional focal centering
  const handleZoomIn = () => {
    setZoom(prev => {
      const next = Math.min(6.0, Math.round(prev * 1.25 * 100) / 100);
      setPan(p => ({
        x: p.x * (next / prev),
        y: p.y * (next / prev)
      }));
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(0.25, Math.round(prev * 0.8 * 100) / 100);
      setPan(p => ({
        x: p.x * (next / prev),
        y: p.y * (next / prev)
      }));
      return next;
    });
  };

  const handleSetZoom = (targetZoom) => {
    setZoom(targetZoom);
    setPan({ x: 0, y: 0 });
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const bounds = getBounds();

    ctx.clearRect(0, 0, w, h);

    // 1. Outer Background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    // Plot Area Background
    ctx.fillStyle = '#0d1322';
    ctx.fillRect(padding, padding, w - padding * 2, h - padding * 2);

    // Helper functions with active zoom and pan
    const pos = (x, y) => toScreen(x, y, bounds, w, h, zoom, pan);

    // 2. Grid lines & Axis labels
    ctx.strokeStyle = '#1b263b';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const rangeX = Math.max(bounds.maxX - bounds.minX, 1);
    const rangeY = Math.max(bounds.maxY - bounds.minY, 1);
    const xStep = Math.max(1, Math.round(rangeX / (8 * Math.max(0.7, zoom))));
    const yStep = Math.max(1, Math.round(rangeY / (8 * Math.max(0.7, zoom))));

    // Determine min/max ticks based on visible screen range
    const topLeftData = toData(padding, padding, bounds, w, h, zoom, pan);
    const bottomRightData = toData(w - padding, h - padding, bounds, w, h, zoom, pan);

    const tickMinX = Math.max(0, Math.floor(Math.min(topLeftData.x, bottomRightData.x) - 1));
    const tickMaxX = Math.ceil(Math.max(topLeftData.x, bottomRightData.x) + 2);
    const tickMinY = Math.max(0, Math.floor(Math.min(topLeftData.y, bottomRightData.y) - 1));
    const tickMaxY = Math.ceil(Math.max(topLeftData.y, bottomRightData.y) + 2);

    for (let x = tickMinX; x <= tickMaxX; x += xStep) {
      const sx = pos(x, 0).x;
      if (sx >= padding && sx <= w - padding) {
        ctx.moveTo(sx, padding);
        ctx.lineTo(sx, h - padding);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(x.toString(), sx, h - padding + 18);
      }
    }

    for (let y = tickMinY; y <= tickMaxY; y += yStep) {
      const sy = pos(0, y).y;
      if (sy >= padding && sy <= h - padding) {
        ctx.moveTo(padding, sy);
        ctx.lineTo(w - padding, sy);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), padding - 10, sy + 4);
      }
    }
    ctx.stroke();

    // Primary Axes Box
    ctx.strokeStyle = '#334460';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);

    // Axis Labels with Custom Objectives
    const xName = objectiveNames?.[axisX] || `Objective ${axisX + 1}`;
    const xIsMin = minimizeDirections?.[axisX] !== false;
    const xDir = xIsMin ? 'Minimize ➔ Lower is better' : 'Maximize ➔ Higher is better';

    const yName = objectiveNames?.[axisY] || `Objective ${axisY + 1}`;
    const yIsMin = minimizeDirections?.[axisY] !== false;
    const yDir = yIsMin ? 'Minimize ➔ Lower is better' : 'Maximize ➔ Higher is better';

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${xName} (${xDir})`, w / 2, h - 16);

    ctx.save();
    ctx.translate(18, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${yName} (${yDir})`, 0, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(0, 229, 163, 0.7)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(xIsMin && yIsMin ? '↙ Ideal Origin (0,0)' : 'Ideal Pareto Corner', padding + 8, h - padding - 8);

    // 3. CLIP TO PLOT AREA for data elements (points, cones, curves, lasers)
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding, padding, w - padding * 2, h - padding * 2);
    ctx.clip();

    // 3A. Shaded Dominance Orthant / Cone
    const targetPoint = hoveredPoint || (activeStep?.activePoints?.[0] ? population.find(p => p.id === activeStep.activePoints[0]) : null);
    if (targetPoint) {
      const s = pos(targetPoint.coords[axisX], targetPoint.coords[axisY]);
      const domW = Math.max(0, w - padding - s.x);
      const domH = Math.max(0, s.y - padding);

      if (domW > 0 && domH > 0) {
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + domW, s.y - domH);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.04)');
        ctx.fillStyle = grad;
        ctx.fillRect(s.x, padding, domW, s.y - padding);

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(s.x, padding);
        ctx.lineTo(s.x, s.y);
        ctx.lineTo(w - padding, s.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 3B. Pareto Frontiers
    const currentFronts = activeStep?.fronts && activeStep.fronts.length > 0 ? activeStep.fronts : finalFronts;
    if (currentFronts && currentFronts.length > 0) {
      currentFronts.forEach((frontIds, fIdx) => {
        if (!frontIds || frontIds.length === 0) return;
        const frontPoints = frontIds
          .map(id => population.find(p => p.id === id))
          .filter(Boolean)
          .sort((a, b) => (a.coords[axisX] || 0) - (b.coords[axisX] || 0));

        if (frontPoints.length === 0) return;

        const color = getFrontColor(fIdx + 1);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        frontPoints.forEach((pt, i) => {
          const s = pos(pt.coords[axisX], pt.coords[axisY]);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();

        const firstS = pos(frontPoints[0].coords[axisX], frontPoints[0].coords[axisY]);
        ctx.fillStyle = color;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`F${fIdx + 1}`, firstS.x - 12, firstS.y - 4);
        ctx.restore();
      });
    }

    // 3C. Active Comparison Laser Beam
    if (activeStep?.laser) {
      const { from, to, relation, label } = activeStep.laser;
      const pFrom = population.find(p => p.id === from);
      const pTo = population.find(p => p.id === to);

      if (pFrom && pTo) {
        const sFrom = pos(pFrom.coords[axisX], pFrom.coords[axisY]);
        const sTo = pos(pTo.coords[axisX], pTo.coords[axisY]);

        let beamColor = '#f59e0b';
        if (relation === 'p_dominates_q') beamColor = '#10b981';
        else if (relation === 'q_dominates_p') beamColor = '#ef4444';
        else if (relation === 'promotion') beamColor = '#38bdf8';
        else if (relation === 'decrement') beamColor = '#a78bfa';

        ctx.save();
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = beamColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(sFrom.x, sFrom.y);
        ctx.lineTo(sTo.x, sTo.y);
        ctx.stroke();

        const angle = Math.atan2(sTo.y - sFrom.y, sTo.x - sFrom.x);
        const arrowLen = 14;
        const midX = (sFrom.x + sTo.x) / 2;
        const midY = (sFrom.y + sTo.y) / 2;

        ctx.fillStyle = beamColor;
        ctx.beginPath();
        ctx.moveTo(midX + arrowLen * Math.cos(angle), midY + arrowLen * Math.sin(angle));
        ctx.lineTo(midX + arrowLen * Math.cos(angle + 2.5), midY + arrowLen * Math.sin(angle + 2.5));
        ctx.lineTo(midX + arrowLen * Math.cos(angle - 2.5), midY + arrowLen * Math.sin(angle - 2.5));
        ctx.closePath();
        ctx.fill();

        if (label) {
          ctx.font = '600 11px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(midX - textWidth / 2 - 6, midY - 22, textWidth + 12, 18);
          ctx.strokeStyle = beamColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(midX - textWidth / 2 - 6, midY - 22, textWidth + 12, 18);

          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(label, midX, midY - 9);
        }
        ctx.restore();
      }
    }

    // 3D. Population Points
    const activeIds = activeStep?.activePoints || [];
    const r = Math.max(6, Math.min(16, 8 * Math.sqrt(zoom)));

    population.forEach(p => {
      const s = pos(p.coords[axisX], p.coords[axisY]);
      const stepRank = activeStep?.frontRank?.[p.id];
      const finalRank = finalFronts.findIndex(f => f.includes(p.id)) + 1 || null;
      const rank = (stepRank != null) ? stepRank : (activeStep?.fronts?.length > 0 ? null : finalRank);

      const isHovered = hoveredPoint?.id === p.id;
      const isActive = activeIds.includes(p.id);
      const color = getFrontColor(rank);

      const cd = activeStep?.crowdingDistances?.[p.id] ?? crowdingDistances?.[p.id];
      const wfRank = activeStep?.withinFrontRanks?.[p.id] ?? withinFrontRanks?.[p.id];
      const isBoundary = cd === Infinity;

      ctx.save();
      if (isActive) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered || isActive ? 12 : 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, isHovered ? r + 3 : r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, s.x, s.y - r - 6);

      if (rank) {
        ctx.fillStyle = color;
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        if (sortByCrowdingDistance && wfRank) {
          const cdBadge = isBoundary ? '∞' : (cd !== undefined ? cd.toFixed(2) : '');
          ctx.fillText(`F${rank}·#${wfRank}${cdBadge ? ` (${cdBadge})` : ''}`, s.x, s.y + r + 14);
        } else {
          ctx.fillText(`F${rank}`, s.x, s.y + r + 14);
        }
      }
      ctx.restore();
    });

    // End plot clipping
    ctx.restore();

    // 4. Hover Tooltip (drawn on top of clipping)
    if (hoveredPoint) {
      const p = hoveredPoint;
      const s = pos(p.coords[axisX], p.coords[axisY]);
      const rank = activeStep?.frontRank?.[p.id] !== undefined
        ? activeStep.frontRank[p.id]
        : (finalFronts.findIndex(f => f.includes(p.id)) + 1 || null);

      const domCount = activeStep?.dominationCounts?.[p.id] ?? null;
      const domSet = activeStep?.dominanceSets?.[p.id] || null;

      const cd = activeStep?.crowdingDistances?.[p.id] ?? crowdingDistances?.[p.id];
      const wfRank = activeStep?.withinFrontRanks?.[p.id] ?? withinFrontRanks?.[p.id];
      const cdStr = cd === Infinity ? '∞ (Boundary Solution)' : (cd !== undefined ? cd.toFixed(4) : null);

      const coordsStr = p.coords.map((c, idx) => {
        const name = objectiveNames?.[idx] || `f${idx + 1}`;
        const dir = minimizeDirections?.[idx] === false ? '↑' : '↓';
        return `${name}${dir}=${c}`;
      }).join(', ');

      const lines = [
        `${p.name}: [ ${coordsStr} ]`,
        rank ? `Front: F${rank} (${rank === 1 ? 'Pareto Optimal' : 'Sub-frontier'})${wfRank ? ` • Rank #${wfRank} in front` : ''}` : 'Front: Unassigned',
        cdStr !== null ? `Crowding Distance: ${cdStr}` : null,
        domCount !== null ? `Domination Count (n_p): ${domCount}` : null,
        domSet && domSet.length > 0 ? `Dominates (S_p): { ${domSet.map(id => population.find(q => q.id === id)?.name || id).join(', ')} }` : 'Dominates: ∅'
      ];
      if (p.metadata && Object.keys(p.metadata).length > 0) {
        const metaStr = Object.entries(p.metadata).map(([k, v]) => `${k}: ${v}`).join(' | ');
        lines.push(`Meta: ${metaStr}`);
      }

      ctx.save();
      ctx.font = '12px "JetBrains Mono", monospace';
      const boxPadding = 10;
      const lineHeight = 18;
      const maxTextWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
      const boxW = maxTextWidth + boxPadding * 2;
      const boxH = lines.length * lineHeight + boxPadding * 2;

      let bx = s.x + 15;
      let by = s.y - boxH - 10;
      if (bx + boxW > w - 10) bx = s.x - boxW - 15;
      if (by < 10) by = s.y + 15;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? '#38bdf8' : (i === 1 ? '#00e5a3' : '#cbd5e1');
        ctx.fillText(line, bx + boxPadding, by + boxPadding + (i + 1) * lineHeight - 4);
      });
      ctx.restore();
    }
  }, [population, activeStep, finalFronts, hoveredPoint, zoom, pan, getBounds, toScreen, toData, sortByCrowdingDistance, crowdingDistances, withinFrontRanks]);

  // Mouse wheel: zoom smoothly toward mouse position (attached non-passively to prevent browser warning)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheelHandler = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(prevZoom => {
        const newZoom = Math.max(0.4, Math.min(5.0, Math.round(prevZoom * factor * 100) / 100));
        setPan(prevPan => ({
          x: mouseX - (mouseX - prevPan.x) * (newZoom / prevZoom),
          y: mouseY - (mouseY - prevPan.y) * (newZoom / prevZoom)
        }));
        return newZoom;
      });
    };

    canvas.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheelHandler);
  }, []);

  // Mouse interaction: dragging point vs panning canvas vs clicking
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const bounds = getBounds();

    // 1. Dragging existing point
    if (isDraggingPointRef.current && draggedPoint) {
      hasMovedSignificantlyRef.current = true;
      const data = toData(sx, sy, bounds, rect.width, rect.height, zoom, pan);
      const nextCoords = [...draggedPoint.coords];
      nextCoords[axisX] = data.x;
      nextCoords[axisY] = data.y;
      const updated = { ...draggedPoint, coords: nextCoords };
      setDraggedPoint(updated);
      if (onPointMoved) onPointMoved(updated);
      return;
    }

    // 2. Panning canvas background
    if (isPanningRef.current) {
      const dx = sx - panStartRef.current.mouseX;
      const dy = sy - panStartRef.current.mouseY;
      if (Math.hypot(dx, dy) > 4) {
        hasMovedSignificantlyRef.current = true;
      }
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
      return;
    }

    // 3. Hover hit-test
    let found = null;
    for (const p of population) {
      const s = toScreen(p.coords[axisX], p.coords[axisY], bounds, rect.width, rect.height, zoom, pan);
      const dist = Math.hypot(s.x - sx, s.y - sy);
      if (dist <= 14) {
        found = p;
        break;
      }
    }
    setHoveredPoint(found);
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const bounds = getBounds();

    hasMovedSignificantlyRef.current = false;

    // Check if clicked directly on a point
    for (const p of population) {
      const s = toScreen(p.coords[axisX], p.coords[axisY], bounds, rect.width, rect.height, zoom, pan);
      if (Math.hypot(s.x - sx, s.y - sy) <= 14) {
        setDraggedPoint(p);
        isDraggingPointRef.current = true;
        return;
      }
    }

    // Otherwise start panning
    isPanningRef.current = true;
    panStartRef.current = {
      mouseX: sx,
      mouseY: sy,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handleMouseUp = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const bounds = getBounds();

    const wasDraggingPoint = isDraggingPointRef.current;
    const wasPanning = isPanningRef.current;

    isDraggingPointRef.current = false;
    isPanningRef.current = false;
    setDraggedPoint(null);

    // If mouse was released without significant drag, treat as click to add point
    if (!wasDraggingPoint && wasPanning && !hasMovedSignificantlyRef.current) {
      if (sx >= padding && sx <= rect.width - padding && sy >= padding && sy <= rect.height - padding) {
        const data = toData(sx, sy, bounds, rect.width, rect.height, zoom, pan);
        if (onCanvasClick) onCanvasClick(data.x, data.y);
      }
    }
  };

  const getCursor = () => {
    if (isDraggingPointRef.current) return 'grabbing';
    if (hoveredPoint) return 'pointer';
    if (isPanningRef.current) return 'grabbing';
    return 'crosshair';
  };

  return (
    <div className="canvas-pane">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-tip" title="Click empty space to add point. Drag points to reposition. Drag canvas to pan. Scroll or use buttons to zoom.">
          <span><strong>Interactive Canvas:</strong> Click to add. Drag to re-sort. Drag canvas to pan. Scroll/buttons to zoom.</span>
        </div>

        {/* Multi-Objective 2D Slice Projection Bar when M > 2 */}
        {M > 2 && (
          <div className="canvas-projection-bar">
            <span className="proj-label">
              <SlidersHorizontal size={12} />
              2D Projection (M={M}):
            </span>
            <div className="proj-selector-item">
              <span>X:</span>
              <select
                value={axisX}
                onChange={(e) => onProjectionAxesChange?.({ ...projectionAxes, x: parseInt(e.target.value, 10) })}
                className="proj-select"
                title="Select objective to map to X-axis"
              >
                {Array.from({ length: M }).map((_, idx) => (
                  <option key={idx} value={idx}>
                    {objectiveNames?.[idx] || `Obj ${idx + 1}`} ({minimizeDirections?.[idx] === false ? 'Max' : 'Min'})
                  </option>
                ))}
              </select>
            </div>
            <div className="proj-selector-item">
              <span>Y:</span>
              <select
                value={axisY}
                onChange={(e) => onProjectionAxesChange?.({ ...projectionAxes, y: parseInt(e.target.value, 10) })}
                className="proj-select"
                title="Select objective to map to Y-axis"
              >
                {Array.from({ length: M }).map((_, idx) => (
                  <option key={idx} value={idx}>
                    {objectiveNames?.[idx] || `Obj ${idx + 1}`} ({minimizeDirections?.[idx] === false ? 'Max' : 'Min'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="canvas-toolbar-shortcuts">
          <span className="kbd-badge">Space</span> Play
          <span className="kbd-badge">←/→</span> Step
          <span className="kbd-badge">Scroll</span> Zoom
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          id="scatter-canvas"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleResetZoom}
          onMouseLeave={() => {
            isDraggingPointRef.current = false;
            isPanningRef.current = false;
            setHoveredPoint(null);
          }}
          style={{ cursor: getCursor() }}
        />

        {/* Floating Zoom Controls Bar */}
        <div className="canvas-zoom-controls">
          <button
            className="zoom-btn"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
          >
            <ZoomOut size={14} />
          </button>

          <button
            className={`zoom-btn zoom-preset-btn ${Math.round(zoom * 100) === 50 ? 'active' : ''}`}
            onClick={() => handleSetZoom(0.5)}
            title="Quick Zoom: 50%"
          >
            50%
          </button>

          <button
            className={`zoom-btn zoom-level-badge ${Math.round(zoom * 100) === 100 ? 'active' : ''}`}
            onClick={handleResetZoom}
            title="Current Zoom Level (Click to Reset to 100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            className={`zoom-btn zoom-preset-btn ${Math.round(zoom * 100) === 150 ? 'active' : ''}`}
            onClick={() => handleSetZoom(1.5)}
            title="Quick Zoom: 150%"
          >
            150%
          </button>

          <button
            className="zoom-btn"
            onClick={handleZoomIn}
            title="Zoom In (+)"
          >
            <ZoomIn size={14} />
          </button>

          <div className="zoom-divider" />

          <button
            className="zoom-btn zoom-fit-btn"
            onClick={handleResetZoom}
            title="Fit View / Reset (Double-click Canvas)"
          >
            <Maximize2 size={13} />
            <span className="zoom-btn-label">Fit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
