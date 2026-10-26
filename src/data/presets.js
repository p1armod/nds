/**
 * Preset Multi-Objective Datasets for NDS Visualizer
 */

export const PRESETS = {
  paperFigure1: {
    name: 'Research Paper Fig. 1 (2D: 8 pts, 3 fronts)',
    description: 'Exact dataset from Section 1, Figure 1 and Tables 1-2 of the research paper.',
    dimensions: 2,
    points: [
      { id: 'p1', name: 'P1', coords: [1, 7] },
      { id: 'p2', name: 'P2', coords: [3, 4] },
      { id: 'p3', name: 'P3', coords: [7, 2] },
      { id: 'p4', name: 'P4', coords: [5, 9] },
      { id: 'p5', name: 'P5', coords: [7, 8] },
      { id: 'p6', name: 'P6', coords: [9, 4] },
      { id: 'p7', name: 'P7', coords: [7, 15] },
      { id: 'p8', name: 'P8', coords: [8, 8] }
    ]
  },

  paperFigure1_3D: {
    name: 'Research Paper Fig. 1 in 3D Space (3 objectives)',
    description: '3-objective extension of the paper dataset demonstrating 3D Pareto frontier surface.',
    dimensions: 3,
    points: [
      { id: 'p1', name: 'P1', coords: [1, 7, 3] },
      { id: 'p2', name: 'P2', coords: [3, 4, 4] },
      { id: 'p3', name: 'P3', coords: [7, 2, 2] },
      { id: 'p4', name: 'P4', coords: [5, 9, 5] },
      { id: 'p5', name: 'P5', coords: [7, 8, 6] },
      { id: 'p6', name: 'P6', coords: [9, 4, 5] },
      { id: 'p7', name: 'P7', coords: [7, 15, 8] },
      { id: 'p8', name: 'P8', coords: [8, 8, 7] }
    ]
  },

  convexFrontiers: {
    name: 'Convex Pareto Frontiers (2D: 18 pts)',
    description: 'Multiple concentric convex trade-off curves typical of continuous multi-objective optimization.',
    dimensions: 2,
    points: [
      // Front 1
      { id: 'c1', name: 'A1', coords: [1.2, 8.5] },
      { id: 'c2', name: 'A2', coords: [2.1, 5.2] },
      { id: 'c3', name: 'A3', coords: [3.8, 3.1] },
      { id: 'c4', name: 'A4', coords: [6.0, 1.9] },
      { id: 'c5', name: 'A5', coords: [8.8, 1.1] },
      // Front 2
      { id: 'c6', name: 'B1', coords: [2.5, 9.8] },
      { id: 'c7', name: 'B2', coords: [3.9, 6.7] },
      { id: 'c8', name: 'B3', coords: [5.2, 4.8] },
      { id: 'c9', name: 'B4', coords: [7.5, 3.4] },
      { id: 'c10', name: 'B5', coords: [10.2, 2.5] },
      // Front 3
      { id: 'c11', name: 'C1', coords: [4.2, 11.5] },
      { id: 'c12', name: 'C2', coords: [5.8, 8.9] },
      { id: 'c13', name: 'C3', coords: [7.3, 7.0] },
      { id: 'c14', name: 'C4', coords: [9.4, 5.5] },
      { id: 'c15', name: 'C5', coords: [11.8, 4.2] },
      // Outliers
      { id: 'c16', name: 'D1', coords: [7.0, 12.5] },
      { id: 'c17', name: 'D2', coords: [10.5, 9.2] },
      { id: 'c18', name: 'D3', coords: [13.0, 7.5] }
    ]
  },

  dtlz3D: {
    name: '3D Spherical Pareto Surface (16 pts)',
    description: 'Points distributed across 3D spherical non-dominated front and sub-optimal layers.',
    dimensions: 3,
    points: [
      // Layer 1 (Spherical trade-off)
      { id: 's1', name: 'S1', coords: [1.0, 1.5, 8.0] },
      { id: 's2', name: 'S2', coords: [2.0, 7.5, 1.5] },
      { id: 's3', name: 'S3', coords: [8.0, 1.8, 1.2] },
      { id: 's4', name: 'S4', coords: [4.5, 4.5, 3.0] },
      { id: 's5', name: 'S5', coords: [3.0, 4.0, 5.5] },
      { id: 's6', name: 'S6', coords: [5.0, 2.5, 4.8] },
      // Layer 2
      { id: 's7', name: 'T1', coords: [2.5, 3.0, 9.0] },
      { id: 's8', name: 'T2', coords: [3.5, 8.5, 3.0] },
      { id: 's9', name: 'T3', coords: [9.0, 3.5, 2.5] },
      { id: 's10', name: 'T4', coords: [6.0, 6.0, 4.5] },
      { id: 's11', name: 'T5', coords: [4.8, 5.5, 7.0] },
      // Layer 3
      { id: 's12', name: 'U1', coords: [4.0, 5.0, 10.5] },
      { id: 's13', name: 'U2', coords: [5.5, 10.0, 4.5] },
      { id: 's14', name: 'U3', coords: [10.5, 5.0, 4.0] },
      { id: 's15', name: 'U4', coords: [8.0, 8.0, 6.0] },
      { id: 's16', name: 'U5', coords: [6.5, 7.5, 8.5] }
    ]
  },

  worstCaseChain: {
    name: 'Strict Dominance Chain (Worst Case: N fronts)',
    description: 'Each point strictly dominates the next: P1 ≺ P2 ≺ P3 ≺ ... ≺ PN. Generates exactly N fronts with maximum domination counts.',
    dimensions: 2,
    points: [
      { id: 'w1', name: 'W1', coords: [1, 1] },
      { id: 'w2', name: 'W2', coords: [2, 2] },
      { id: 'w3', name: 'W3', coords: [3, 3] },
      { id: 'w4', name: 'W4', coords: [4, 4] },
      { id: 'w5', name: 'W5', coords: [5, 5] },
      { id: 'w6', name: 'W6', coords: [6, 6] },
      { id: 'w7', name: 'W7', coords: [7, 7] }
    ]
  },

  bestCaseNonDominated: {
    name: 'All Non-Dominated (Best Case: 1 front)',
    description: 'All points are mutually non-dominated (P_i ⊀ P_j ∧ P_j ⊀ P_i). Exactly 1 front (Front 1) where all counts are 0.',
    dimensions: 2,
    points: [
      { id: 'b1', name: 'N1', coords: [1, 10] },
      { id: 'b2', name: 'N2', coords: [2, 9] },
      { id: 'b3', name: 'N3', coords: [3, 8] },
      { id: 'b4', name: 'N4', coords: [4, 7] },
      { id: 'b5', name: 'N5', coords: [5, 6] },
      { id: 'b6', name: 'N6', coords: [6, 5] },
      { id: 'b7', name: 'N7', coords: [7, 4] },
      { id: 'b8', name: 'N8', coords: [8, 3] },
      { id: 'b9', name: 'N9', coords: [9, 2] },
      { id: 'b10', name: 'N10', coords: [10, 1] }
    ]
  },

  disconnectedClusters: {
    name: 'Disconnected Clusters (2D: 16 pts)',
    description: 'Isolated clusters in objective space with varying trade-offs.',
    dimensions: 2,
    points: [
      { id: 'cl1', name: 'L1', coords: [1.5, 8.0] },
      { id: 'cl2', name: 'L2', coords: [2.0, 7.5] },
      { id: 'cl3', name: 'L3', coords: [2.5, 9.0] },
      { id: 'cl4', name: 'L4', coords: [3.0, 8.5] },
      { id: 'cm1', name: 'M1', coords: [5.0, 5.0] },
      { id: 'cm2', name: 'M2', coords: [5.5, 4.5] },
      { id: 'cm3', name: 'M3', coords: [6.0, 5.8] },
      { id: 'cm4', name: 'M4', coords: [6.5, 5.2] },
      { id: 'cr1', name: 'R1', coords: [8.5, 2.0] },
      { id: 'cr2', name: 'R2', coords: [9.0, 1.5] },
      { id: 'cr3', name: 'R3', coords: [9.5, 2.8] },
      { id: 'cr4', name: 'R4', coords: [10.0, 2.2] },
      { id: 'cd1', name: 'D1', coords: [4.0, 11.0] },
      { id: 'cd2', name: 'D2', coords: [7.5, 8.0] },
      { id: 'cd3', name: 'D3', coords: [11.0, 6.0] },
      { id: 'cd4', name: 'D4', coords: [12.0, 4.0] }
    ]
  },

  multiObjective5D: {
    name: '5D Cloud Microservices Trade-off (5 Objectives)',
    description: 'Real-world 5-objective engineering tradeoff: Cost ($) [Min], Latency (ms) [Min], Power (W) [Min], Throughput (req/s) [Max], Reliability (%) [Max].',
    dimensions: 5,
    objectiveNames: ['Cost ($)', 'Latency (ms)', 'Power (W)', 'Throughput (req/s)', 'Reliability (%)'],
    minimizeDirections: [true, true, true, false, false],
    points: [
      { id: 'm1', name: 'Arch_A1', coords: [120.0, 45.0, 25.0, 12000, 99.95] },
      { id: 'm2', name: 'Arch_A2', coords: [150.0, 28.0, 32.0, 18500, 99.99] },
      { id: 'm3', name: 'Arch_A3', coords: [90.0, 85.0, 18.0, 8500, 99.90] },
      { id: 'm4', name: 'Arch_A4', coords: [210.0, 18.0, 48.0, 25000, 99.999] },
      { id: 'm5', name: 'Arch_A5', coords: [135.0, 38.0, 29.0, 14000, 99.92] },
      { id: 'm6', name: 'Arch_B1', coords: [170.0, 52.0, 36.0, 11500, 99.85] },
      { id: 'm7', name: 'Arch_B2', coords: [140.0, 60.0, 30.0, 10000, 99.80] },
      { id: 'm8', name: 'Arch_B3', coords: [180.0, 40.0, 42.0, 16000, 99.90] },
      { id: 'm9', name: 'Arch_B4', coords: [240.0, 25.0, 55.0, 22000, 99.95] },
      { id: 'm10', name: 'Arch_C1', coords: [220.0, 95.0, 60.0, 7500, 99.50] },
      { id: 'm11', name: 'Arch_C2', coords: [260.0, 80.0, 70.0, 9000, 99.70] }
    ]
  }
};

export function generateRandomPopulation(count = 12, dimensions = 2, maxCoord = 15) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const coords = [];
    for (let m = 0; m < dimensions; m++) {
      coords.push(Math.round((Math.random() * (maxCoord - 1) + 1) * 10) / 10);
    }
    points.push({
      id: `rnd_${Date.now()}_${i}`,
      name: `R${i + 1}`,
      coords
    });
  }
  return points;
}
