import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getFrontColor } from './Canvas2D';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  SlidersHorizontal,
  Globe,
  Layers
} from 'lucide-react';

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Canvas3D({
  population,
  activeStep,
  finalFronts,
  crowdingDistances = {},
  withinFrontRanks = {},
  objectiveNames = [],
  minimizeDirections = [],
  projectionAxes = { x: 0, y: 1, z: 2 },
  onProjectionAxesChange,
  sortByCrowdingDistance = false
}) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ pitch: 25, yaw: -35 });
  const [zoom, setZoom] = useState(1);
  const [showFrontSpheres, setShowFrontSpheres] = useState(true);
  const [sphereMode, setSphereMode] = useState('both'); // 'both', 'shell', 'mesh'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const M = population?.[0]?.coords?.length || 3;
  const axisX = Math.min(projectionAxes?.x ?? 0, Math.max(0, M - 1));
  const axisY = Math.min(projectionAxes?.y ?? 1, Math.max(0, M - 1));
  const axisZ = Math.min(projectionAxes?.z ?? 2, Math.max(0, M - 1));

  const axes = [axisX, axisY, axisZ];

  // Compute 3D bounds
  const getBounds3D = useCallback(() => {
    if (!population || population.length === 0) {
      return { min: [0, 0, 0], max: [10, 10, 10] };
    }
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    population.forEach(p => {
      for (let m = 0; m < 3; m++) {
        const targetAxis = axes[m];
        const val = p.coords[targetAxis] !== undefined ? p.coords[targetAxis] : 0;
        if (val < min[m]) min[m] = val;
        if (val > max[m]) max[m] = val;
      }
    });

    for (let m = 0; m < 3; m++) {
      const range = Math.max(max[m] - min[m], 2);
      min[m] = Math.max(0, Math.floor(min[m] - range * 0.1));
      max[m] = Math.ceil(max[m] + range * 0.15);
    }

    return { min, max };
  }, [population, axisX, axisY, axisZ]);

  // Project 3D point (x, y, z) into 2D screen coordinates
  const project3D = useCallback((x, y, z, bounds, w, h, pitchDeg, yawDeg, zoomLevel) => {
    const nx = (x - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * 2 - 1;
    const ny = (y - bounds.min[1]) / (bounds.max[1] - bounds.min[1]) * 2 - 1;
    const nz = (z - bounds.min[2]) / (bounds.max[2] - bounds.min[2]) * 2 - 1;

    const pitch = (pitchDeg * Math.PI) / 180;
    const yaw = (yawDeg * Math.PI) / 180;

    const x1 = nx * Math.cos(yaw) + nz * Math.sin(yaw);
    const y1 = ny;
    const z1 = -nx * Math.sin(yaw) + nz * Math.cos(yaw);

    const x2 = x1;
    const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);

    const fov = 3.5;
    const depth = fov / (fov + z2);
    const scale = Math.min(w, h) * 0.38 * zoomLevel;

    const sx = w / 2 + x2 * scale * depth;
    const sy = h / 2 - y2 * scale * depth;

    return { x: sx, y: sy, depth: z2, scale: depth };
  }, []);

  // 3D Render Loop
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
    const bounds = getBounds3D();

    ctx.clearRect(0, 0, w, h);

    // Dark Background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    const p3d = (x, y, z) => project3D(x, y, z, bounds, w, h, rotation.pitch, rotation.yaw, zoom);

    // 1. Draw 3D Bounding Box Wireframe
    const [minX, minY, minZ] = bounds.min;
    const [maxX, maxY, maxZ] = bounds.max;

    const corners = [
      [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ],
      [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]
    ].map(([x, y, z]) => p3d(x, y, z));

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    edges.forEach(([i, j]) => {
      ctx.moveTo(corners[i].x, corners[i].y);
      ctx.lineTo(corners[j].x, corners[j].y);
    });
    ctx.stroke();

    // 2. Primary 3D Axes from Origin
    const origin = p3d(minX, minY, minZ);
    const endX = p3d(maxX, minY, minZ);
    const endY = p3d(minX, maxY, minZ);
    const endZ = p3d(minX, minY, maxZ);

    const xName = objectiveNames?.[axisX] || `f${axisX + 1}`;
    const xDir = minimizeDirections?.[axisX] === false ? '(Max)' : '(Min)';

    const yName = objectiveNames?.[axisY] || `f${axisY + 1}`;
    const yDir = minimizeDirections?.[axisY] === false ? '(Max)' : '(Min)';

    const zName = objectiveNames?.[axisZ] || `f${axisZ + 1}`;
    const zDir = minimizeDirections?.[axisZ] === false ? '(Max)' : '(Min)';

    const axisVisuals = [
      { end: endX, color: '#38bdf8', label: `${xName} ${xDir}` },
      { end: endY, color: '#00e5a3', label: `${yName} ${yDir}` },
      { end: endZ, color: '#a78bfa', label: `${zName} ${zDir}` }
    ];

    axisVisuals.forEach(ax => {
      ctx.strokeStyle = ax.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(ax.end.x, ax.end.y);
      ctx.stroke();

      ctx.fillStyle = ax.color;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(ax.label, ax.end.x + 8, ax.end.y + 4);
    });

    const currentFronts = activeStep?.fronts && activeStep.fronts.length > 0 ? activeStep.fronts : finalFronts;

    // 3. FRONT SPHERES & CONNECTING LINES (Denoting the fronts like lines in 2D)
    if (showFrontSpheres && currentFronts && currentFronts.length > 0) {
      // Find reference anchor point for concentric Pareto spheres (ideal origin)
      const anchorX = Math.min(0, minX);
      const anchorY = Math.min(0, minY);
      const anchorZ = Math.min(0, minZ);

      currentFronts.forEach((frontIds, fIdx) => {
        if (!frontIds || frontIds.length === 0) return;
        const frontRank = fIdx + 1;
        const color = getFrontColor(frontRank);

        const frontPoints = frontIds
          .map(id => population.find(p => p.id === id))
          .filter(Boolean);

        if (frontPoints.length === 0) return;

        // Calculate characteristic radius of this front from anchor
        const radii = frontPoints.map(p => {
          const dx = (p.coords[axisX] !== undefined ? p.coords[axisX] : 0) - anchorX;
          const dy = (p.coords[axisY] !== undefined ? p.coords[axisY] : 0) - anchorY;
          const dz = (p.coords[axisZ] !== undefined ? p.coords[axisZ] : 0) - anchorZ;
          return Math.hypot(dx, dy, dz);
        });
        const meanR = Math.max(1, radii.reduce((a, b) => a + b, 0) / radii.length);

        // A. SPHERICAL OCTANT SHELL (Concentric Pareto Front Sphere)
        if (sphereMode === 'shell' || sphereMode === 'both') {
          const latSteps = 10;
          const lonSteps = 10;
          const grid = [];

          for (let i = 0; i <= latSteps; i++) {
            const theta = (i / latSteps) * (Math.PI / 2);
            const row = [];
            for (let j = 0; j <= lonSteps; j++) {
              const phi = (j / lonSteps) * (Math.PI / 2);
              const gx = anchorX + meanR * Math.sin(theta) * Math.cos(phi);
              const gy = anchorY + meanR * Math.sin(theta) * Math.sin(phi);
              const gz = anchorZ + meanR * Math.cos(theta);
              row.push(p3d(gx, gy, gz));
            }
            grid.push(row);
          }

          // Translucent quad surface patches
          for (let i = 0; i < latSteps; i++) {
            for (let j = 0; j < lonSteps; j++) {
              const p00 = grid[i][j];
              const p10 = grid[i + 1][j];
              const p11 = grid[i + 1][j + 1];
              const p01 = grid[i][j + 1];

              ctx.save();
              ctx.fillStyle = hexToRgba(color, 0.08);
              ctx.beginPath();
              ctx.moveTo(p00.x, p00.y);
              ctx.lineTo(p10.x, p10.y);
              ctx.lineTo(p11.x, p11.y);
              ctx.lineTo(p01.x, p01.y);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }

          // Latitude wireframe rings
          ctx.save();
          ctx.strokeStyle = hexToRgba(color, 0.25);
          ctx.lineWidth = 1;
          for (let i = 0; i <= latSteps; i += 2) {
            ctx.beginPath();
            for (let j = 0; j <= lonSteps; j++) {
              const pt = grid[i][j];
              if (j === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
          }

          // Longitude wireframe meridians
          for (let j = 0; j <= lonSteps; j += 2) {
            ctx.beginPath();
            for (let i = 0; i <= latSteps; i++) {
              const pt = grid[i][j];
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
          }

          // Boundary base ring on the 3 primary planes
          ctx.strokeStyle = hexToRgba(color, 0.6);
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let j = 0; j <= lonSteps; j++) {
            const pt = grid[latSteps][j];
            if (j === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();

          ctx.beginPath();
          for (let i = 0; i <= latSteps; i++) {
            const pt = grid[i][0];
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();

          ctx.beginPath();
          for (let i = 0; i <= latSteps; i++) {
            const pt = grid[i][lonSteps];
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.restore();

          // Apex badge for Front Sphere
          const apex = p3d(
            anchorX + meanR * Math.sin(Math.PI / 4) * Math.cos(Math.PI / 4),
            anchorY + meanR * Math.sin(Math.PI / 4) * Math.sin(Math.PI / 4),
            anchorZ + meanR * Math.cos(Math.PI / 4)
          );
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`Front ${frontRank} Sphere (R≈${meanR.toFixed(1)})`, apex.x, apex.y - 8);
          ctx.restore();
        }

        // B. INTER-POINT FRONT CONNECTING LINES & MESH (like lines in 2D)
        if (sphereMode === 'mesh' || sphereMode === 'both') {
          // Sort front points by azimuthal angle around the sphere
          const sortedFrontPoints = [...frontPoints].sort((a, b) => {
            const phiA = Math.atan2((a.coords[axisY] || 0) - anchorY, (a.coords[axisX] || 0) - anchorX);
            const phiB = Math.atan2((b.coords[axisY] || 0) - anchorY, (b.coords[axisX] || 0) - anchorX);
            return phiA - phiB;
          });

          // Draw front trade-off line connecting points in 3D
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          sortedFrontPoints.forEach((p, idx) => {
            const s = p3d(p.coords[axisX] || 0, p.coords[axisY] || 0, p.coords[axisZ] || 0);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();

          // Cross-elevation connecting lines to create a triangular web
          if (sortedFrontPoints.length >= 3) {
            sortedFrontPoints.forEach((p1, idx) => {
              let nearest = null;
              let minDist = Infinity;
              const x1 = p1.coords[axisX] || 0;
              const y1 = p1.coords[axisY] || 0;
              const z1 = p1.coords[axisZ] || 0;

              sortedFrontPoints.forEach((p2, jdx) => {
                if (Math.abs(idx - jdx) <= 1) return;
                const dist = Math.hypot(
                  (p2.coords[axisX] || 0) - x1,
                  (p2.coords[axisY] || 0) - y1,
                  (p2.coords[axisZ] || 0) - z1
                );
                if (dist < minDist) {
                  minDist = dist;
                  nearest = p2;
                }
              });

              if (nearest && minDist < meanR * 0.95) {
                const s1 = p3d(x1, y1, z1);
                const s2 = p3d(nearest.coords[axisX] || 0, nearest.coords[axisY] || 0, nearest.coords[axisZ] || 0);
                ctx.beginPath();
                ctx.strokeStyle = hexToRgba(color, 0.75);
                ctx.lineWidth = 1.5;
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
                ctx.stroke();
              }
            });
          }
          ctx.restore();
        }
      });
    }

    // 4. Comparison Laser Beam
    if (activeStep?.laser) {
      const { from, to, relation } = activeStep.laser;
      const pFrom = population.find(p => p.id === from);
      const pTo = population.find(p => p.id === to);

      if (pFrom && pTo) {
        const sFrom = p3d(pFrom.coords[axisX] || 0, pFrom.coords[axisY] || 0, pFrom.coords[axisZ] || 0);
        const sTo = p3d(pTo.coords[axisX] || 0, pTo.coords[axisY] || 0, pTo.coords[axisZ] || 0);

        let beamColor = relation === 'p_dominates_q' ? '#10b981' : (relation === 'q_dominates_p' ? '#ef4444' : '#f59e0b');
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = beamColor;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(sFrom.x, sFrom.y);
        ctx.lineTo(sTo.x, sTo.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // 5. Depth-Sorted Point Spheres
    const activeIds = activeStep?.activePoints || [];

    const projectedPoints = population.map(p => {
      const x = p.coords[axisX] || 0;
      const y = p.coords[axisY] || 0;
      const z = p.coords[axisZ] || 0;
      const proj = p3d(x, y, z);
      const stepRank = activeStep?.frontRank?.[p.id];
      const finalRank = currentFronts.findIndex(f => f.includes(p.id)) + 1 || null;
      const rank = (stepRank != null) ? stepRank : (activeStep?.fronts?.length > 0 ? null : finalRank);

      return {
        point: p,
        x: proj.x,
        y: proj.y,
        depth: proj.depth,
        scale: proj.scale,
        rank
      };
    });

    projectedPoints.sort((a, b) => b.depth - a.depth);

    projectedPoints.forEach(item => {
      const p = item.point;
      const r = Math.max(5, 10 * item.scale);
      const color = getFrontColor(item.rank);
      const isActive = activeIds.includes(p.id);
      const isHovered = hoveredPoint?.id === p.id;

      ctx.save();
      if (isActive || isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3D Spherical Radial Gradient Shading
      const grad = ctx.createRadialGradient(
        item.x - r * 0.35, item.y - r * 0.35, r * 0.1,
        item.x, item.y, r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, hexToRgba(color, 0.7));

      ctx.fillStyle = grad;
      ctx.shadowColor = color;
      ctx.shadowBlur = isActive || isHovered ? 12 : 4;
      ctx.beginPath();
      ctx.arc(item.x, item.y, isHovered ? r + 3 : r, 0, Math.PI * 2);
      ctx.fill();

      // Specular Highlight Glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(item.x - r * 0.3, item.y - r * 0.3, Math.max(1.5, r * 0.22), 0, Math.PI * 2);
      ctx.fill();

      const cd = activeStep?.crowdingDistances?.[p.id] ?? crowdingDistances?.[p.id];
      const wfRank = activeStep?.withinFrontRanks?.[p.id] ?? withinFrontRanks?.[p.id];
      const isBoundary = cd === Infinity;

      // Label
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, item.x, item.y - r - 5);

      if (item.rank) {
        ctx.fillStyle = color;
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        if (sortByCrowdingDistance && wfRank) {
          const cdBadge = isBoundary ? '∞' : (cd !== undefined ? cd.toFixed(2) : '');
          ctx.fillText(`F${item.rank}·#${wfRank}${cdBadge ? ` (${cdBadge})` : ''}`, item.x, item.y + r + 12);
        } else {
          ctx.fillText(`F${item.rank}`, item.x, item.y + r + 12);
        }
      }
      ctx.restore();
    });

    // 6. Hover Tooltip in 3D
    if (hoveredPoint) {
      const p = hoveredPoint;
      const x = p.coords[axisX] || 0;
      const y = p.coords[axisY] || 0;
      const z = p.coords[axisZ] || 0;
      const proj = p3d(x, y, z);

      const stepRank = activeStep?.frontRank?.[p.id];
      const finalRank = currentFronts.findIndex(f => f.includes(p.id)) + 1 || null;
      const rank = (stepRank != null) ? stepRank : (activeStep?.fronts?.length > 0 ? null : finalRank);

      const cd = activeStep?.crowdingDistances?.[p.id] ?? crowdingDistances?.[p.id];
      const wfRank = activeStep?.withinFrontRanks?.[p.id] ?? withinFrontRanks?.[p.id];
      const cdStr = cd === Infinity ? '∞ (Boundary Solution)' : (cd !== undefined ? cd.toFixed(4) : null);

      const coordsStr = p.coords.map((c, idx) => {
        const name = objectiveNames?.[idx] || `f${idx + 1}`;
        const dir = minimizeDirections?.[idx] === false ? '↑' : '↓';
        return `${name}${dir}=${c}`;
      }).join(', ');

      const lines = [
        `${p.name} [ ${coordsStr} ]`,
        rank ? `Front: F${rank} (${rank === 1 ? 'Pareto Optimal' : 'Sub-frontier'})${wfRank ? ` • Rank #${wfRank} in front` : ''}` : 'Front: Unassigned',
        cdStr !== null ? `Crowding Distance: ${cdStr}` : null
      ].filter(Boolean);

      ctx.save();
      ctx.font = '12px "JetBrains Mono", monospace';
      const boxPadding = 10;
      const lineHeight = 18;
      const maxTextWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
      const boxW = maxTextWidth + boxPadding * 2;
      const boxH = lines.length * lineHeight + boxPadding * 2;

      let bx = proj.x + 15;
      let by = proj.y - boxH - 10;
      if (bx + boxW > w - 10) bx = proj.x - boxW - 15;
      if (by < 10) by = proj.y + 15;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      lines.forEach((line, idx) => {
        ctx.fillStyle = idx === 0 ? '#38bdf8' : (idx === 1 ? '#00e5a3' : '#cbd5e1');
        ctx.fillText(line, bx + boxPadding, by + boxPadding + (idx + 1) * lineHeight - 4);
      });
      ctx.restore();
    }

  }, [
    population,
    activeStep,
    finalFronts,
    rotation,
    zoom,
    getBounds3D,
    project3D,
    showFrontSpheres,
    sphereMode,
    hoveredPoint,
    axisX,
    axisY,
    axisZ,
    objectiveNames,
    minimizeDirections,
    crowdingDistances,
    withinFrontRanks,
    sortByCrowdingDistance
  ]);

  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      setRotation(prev => ({
        pitch: Math.max(-80, Math.min(80, prev.pitch + dy * 0.5)),
        yaw: prev.yaw + dx * 0.5
      }));
      return;
    }

    // Hover hit test
    const bounds = getBounds3D();
    const p3d = (x, y, z) => project3D(x, y, z, bounds, rect.width, rect.height, rotation.pitch, rotation.yaw, zoom);

    let found = null;
    for (const p of population) {
      const x = p.coords[axisX] || 0;
      const y = p.coords[axisY] || 0;
      const z = p.coords[axisZ] || 0;
      const s = p3d(x, y, z);
      if (Math.hypot(s.x - sx, s.y - sy) <= 15) {
        found = p;
        break;
      }
    }
    setHoveredPoint(found);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheelHandler = (e) => {
      e.preventDefault();
      setZoom(prev => Math.max(0.4, Math.min(3.0, Math.round((prev - e.deltaY * 0.0015) * 100) / 100)));
    };

    canvas.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheelHandler);
  }, []);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3.0, Math.round(prev * 1.25 * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.4, Math.round(prev * 0.8 * 100) / 100));
  };

  const handleResetCamera = () => {
    setRotation({ pitch: 25, yaw: -35 });
    setZoom(1.0);
  };

  return (
    <div className="canvas-pane">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-tip" title="Click & drag to rotate 3D multi-objective space. Scroll to zoom.">
          <span><strong>3D Multi-Objective View:</strong> Spherical Pareto surfaces &amp; front connecting lines.</span>
        </div>

        {/* Front Spheres Toggle & Mode Selector */}
        <div className="dim-toggle-group">
          <button
            className={`dim-toggle-btn ${showFrontSpheres ? 'active' : ''}`}
            onClick={() => setShowFrontSpheres(prev => !prev)}
            title="Toggle 3D Spheres denoting Pareto Fronts (like lines in 2D)"
          >
            <Globe size={13} />
            <span>Front Spheres: {showFrontSpheres ? 'ON' : 'OFF'}</span>
          </button>

          {showFrontSpheres && (
            <select
              className="proj-select"
              value={sphereMode}
              onChange={(e) => setSphereMode(e.target.value)}
              title="Select Front Visualization Style"
              style={{ height: '24px', fontSize: '11px' }}
            >
              <option value="both">Both (Sphere + Lines)</option>
              <option value="shell">Spherical Shells</option>
              <option value="mesh">Connecting Lines</option>
            </select>
          )}
        </div>

        {/* 3D Multi-Objective Projection Bar when M > 3 */}
        {M > 3 && (
          <div className="canvas-projection-bar">
            <span className="proj-label">
              <SlidersHorizontal size={12} />
              3D Proj (M={M}):
            </span>
            <div className="proj-selector-item">
              <span>X:</span>
              <select
                value={axisX}
                onChange={(e) => onProjectionAxesChange?.({ ...projectionAxes, x: parseInt(e.target.value, 10) })}
                className="proj-select"
                title="Select objective for X axis"
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
                title="Select objective for Y axis"
              >
                {Array.from({ length: M }).map((_, idx) => (
                  <option key={idx} value={idx}>
                    {objectiveNames?.[idx] || `Obj ${idx + 1}`} ({minimizeDirections?.[idx] === false ? 'Max' : 'Min'})
                  </option>
                ))}
              </select>
            </div>
            <div className="proj-selector-item">
              <span>Z:</span>
              <select
                value={axisZ}
                onChange={(e) => onProjectionAxesChange?.({ ...projectionAxes, z: parseInt(e.target.value, 10) })}
                className="proj-select"
                title="Select objective for Z axis"
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

        <button
          className="ctrl-btn btn-sm"
          onClick={handleResetCamera}
          title="Reset 3D camera to default perspective"
        >
          <RotateCcw size={12} />
          <span>Reset Camera</span>
        </button>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDraggingRef.current ? 'grabbing' : (hoveredPoint ? 'pointer' : 'grab') }}
        />

        {/* 3D Floating Zoom Controls */}
        <div className="canvas-zoom-controls">
          <button
            className="zoom-btn"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
          >
            <ZoomOut size={14} />
          </button>

          <button
            className={`zoom-btn zoom-preset-btn ${Math.round(zoom * 100) === 60 ? 'active' : ''}`}
            onClick={() => setZoom(0.6)}
            title="Quick Zoom: 60%"
          >
            60%
          </button>

          <button
            className={`zoom-btn zoom-level-badge ${Math.round(zoom * 100) === 100 ? 'active' : ''}`}
            onClick={handleResetCamera}
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            className={`zoom-btn zoom-preset-btn ${Math.round(zoom * 100) === 150 ? 'active' : ''}`}
            onClick={() => setZoom(1.5)}
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
            onClick={handleResetCamera}
            title="Reset 3D Camera & View"
          >
            <RotateCcw size={13} />
            <span className="zoom-btn-label">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
