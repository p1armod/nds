import React from 'react';
import { Activity, Sparkles, Box, Grid } from 'lucide-react';

export const ALGORITHM_INFO = {
  fnds: {
    name: 'Fast Non-dominated Sort (NSGA-II)',
    complexity: 'O(M · N²)',
    author: 'Deb et al. (2002)'
  },
  ens_ss: {
    name: 'Efficient NDS - Sequential (ENS-SS)',
    complexity: 'O(M · N · K)',
    author: 'Zhang et al. (2015)'
  },
  ens_bs: {
    name: 'Efficient NDS - Binary Search (ENS-BS)',
    complexity: 'O(M · N · log K)',
    author: 'Zhang et al. (2015)'
  },
  naive: {
    name: 'Naive NDS (Deductive Sort)',
    complexity: 'O(M · N²)',
    author: 'Classical Deductive'
  }
};

export default function Navbar({
  selectedAlgo,
  setSelectedAlgo,
  selectedPreset,
  setSelectedPreset,
  dimensionMode,
  setDimensionMode,
  sortByCrowdingDistance,
  setSortByCrowdingDistance,
  populationCount,
  comparisonsCount,
  frontsCount,
  dimensionsCount = 2
}) {
  const algoInfo = ALGORITHM_INFO[selectedAlgo] || ALGORITHM_INFO.fnds;

  return (
    <header className="top-navbar">
      <div className="brand-section">
        <div className="brand-logo">
          <Activity size={18} strokeWidth={2.5} />
        </div>
        <div className="brand-info">
          <h1>Non-dominated Sorting (NDS)</h1>
          <div className="paper-ref">Pareto Dominance Theory &amp; Visualizer</div>
        </div>
      </div>

      <div className="navbar-center">
        {/* Algorithm Selector */}
        <div className="selector-group">
          <label htmlFor="algo-select">Algorithm:</label>
          <select
            id="algo-select"
            className="select-input"
            value={selectedAlgo}
            onChange={(e) => setSelectedAlgo(e.target.value)}
          >
            <option value="fnds">Fast Non-dominated Sort (NSGA-II)</option>
            <option value="ens_ss">Efficient NDS - Sequential (ENS-SS)</option>
            <option value="ens_bs">Efficient NDS - Binary Search (ENS-BS)</option>
            <option value="naive">Naive NDS (Deductive Sort)</option>
          </select>
        </div>

        {/* Dataset Selector */}
        <div className="selector-group">
          <label htmlFor="preset-select">Dataset:</label>
          <select
            id="preset-select"
            className="select-input"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
          >
            <option value="paperFigure1">Research Paper Fig. 1 (2D: 8 pts, 3 fronts)</option>
            <option value="paperFigure1_3D">Research Paper Fig. 1 in 3D Space (3 objectives)</option>
            <option value="convexFrontiers">Convex Pareto Frontiers (2D: 18 pts)</option>
            <option value="dtlz3D">3D Spherical Pareto Surface (16 pts)</option>
            <option value="multiObjective5D">5D Cloud Microservices Trade-off (5 Objectives)</option>
            <option value="worstCaseChain">Strict Dominance Chain (Worst Case: N fronts)</option>
            <option value="bestCaseNonDominated">All Non-Dominated (Best Case: 1 front)</option>
            <option value="disconnectedClusters">Disconnected Clusters (2D: 16 pts)</option>
            <option value="random">Generate Random Population</option>
          </select>
        </div>

        {/* 2D vs 3D Dimension Mode Toggle */}
        <div className="dim-toggle-group">
          <button
            className={`dim-toggle-btn ${dimensionMode === '2d' ? 'active' : ''}`}
            onClick={() => setDimensionMode('2d')}
            title="2D Coordinate Scatter View"
          >
            <Grid size={14} />
            <span>2D</span>
          </button>
          <button
            className={`dim-toggle-btn ${dimensionMode === '3d' ? 'active' : ''}`}
            onClick={() => setDimensionMode('3d')}
            title="3D Multi-Objective Perspective View"
          >
            <Box size={14} />
            <span>3D</span>
          </button>
        </div>

        {/* Crowding Distance Sort Toggle */}
        <div className="dim-toggle-group">
          <button
            className={`dim-toggle-btn ${sortByCrowdingDistance ? 'active' : ''}`}
            onClick={() => setSortByCrowdingDistance(prev => !prev)}
            title="Toggle Crowding Distance Sorting within Fronts (NSGA-II)"
          >
            <Sparkles size={13} />
            <span>Crowding Dist</span>
          </button>
        </div>
      </div>

      {/* Metrics HUD */}
      <div className="hud-metrics">
        <div className="hud-item" title="Algorithm Time Complexity">
          <span>Complexity:</span>
          <strong className="algo-badge">{algoInfo.complexity}</strong>
        </div>
        <div className="hud-item accent-dim" title="Number of Optimization Dimensions / Objectives (M)">
          <span>Objectives:</span>
          <strong className="dim-badge">{dimensionsCount}D</strong>
        </div>
        <div className="hud-item" title="Number of points in population">
          <span>Points (N):</span>
          <strong>{populationCount}</strong>
        </div>
        <div className="hud-item" title="Dominance comparisons executed">
          <span>Comparisons:</span>
          <strong className="comp-badge">{comparisonsCount}</strong>
        </div>
        <div className="hud-item accent-fronts" title="Number of non-dominated fronts">
          <span>Fronts (K):</span>
          <strong className="front-badge">{frontsCount}</strong>
        </div>
      </div>
    </header>
  );
}
