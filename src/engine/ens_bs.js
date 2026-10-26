import { dominates } from './dominance.js';
import { computeAllCrowdingDistances } from './crowding_distance.js';

/**
 * Efficient Non-dominated Sort - Binary Search (ENS-BS)
 * (Zhang et al.)
 */
export function generateENSBSSteps(population, minimize = null) {
  const steps = [];
  const N = population.length;
  let totalComparisons = 0;

  const sortedPop = [...population].sort((a, b) => {
    const M = Math.min(a.coords.length, b.coords.length);
    for (let m = 0; m < M; m++) {
      const isMin = minimize ? minimize[m] !== false : true;
      const diff = isMin ? (a.coords[m] - b.coords[m]) : (b.coords[m] - a.coords[m]);
      if (Math.abs(diff) > 1e-9) return diff;
    }
    return 0;
  });

  const frontRank = {};
  population.forEach(p => { frontRank[p.id] = null; });

  steps.push({
    stepIndex: steps.length,
    phase: 'PRE_SORTING',
    type: 'PRE_SORT_COMPLETE',
    title: 'Pre-sorting by Objective 1 for Binary Search',
    explanation: `Pre-sorted ${N} points on f1 ascending: [${sortedPop.map(p => p.name).join(' ➔ ')}]. Binary search will locate front in O(log K) steps.`,
    activePoints: sortedPop.map(p => p.id),
    laser: null,
    fronts: [],
    frontRank: { ...frontRank },
    sortedOrder: sortedPop.map(p => p.id),
    stats: { comparisons: totalComparisons, currentFront: 0 }
  });

  const fronts = [];

  for (let i = 0; i < N; i++) {
    const p = sortedPop[i];

    if (fronts.length === 0) {
      fronts.push([p.id]);
      frontRank[p.id] = 1;
      steps.push({
        stepIndex: steps.length,
        phase: 'FRONT_ASSIGNMENT',
        type: 'FIRST_FRONT_CREATED',
        title: `Initialize Front 1 with ${p.name}`,
        explanation: `First pre-sorted point ${p.name} automatically anchors Front 1.`,
        activePoints: [p.id],
        laser: null,
        fronts: fronts.map(f => [...f]),
        frontRank: { ...frontRank },
        sortedOrder: sortedPop.map(p => p.id),
        stats: { comparisons: totalComparisons, currentFront: 1 }
      });
      continue;
    }

    let low = 0;
    let high = fronts.length - 1;
    let insertFront = fronts.length;

    steps.push({
      stepIndex: steps.length,
      phase: 'BINARY_SEARCH',
      type: 'START_BINARY_SEARCH',
      title: `Binary Search for ${p.name}`,
      explanation: `Searching front index in range [Front 1 ... Front ${fronts.length}] for point ${p.name}.`,
      activePoints: [p.id],
      laser: null,
      fronts: fronts.map(f => [...f]),
      frontRank: { ...frontRank },
      sortedOrder: sortedPop.map(p => p.id),
      stats: { comparisons: totalComparisons, currentFront: fronts.length }
    });

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midFront = fronts[mid];
      let dominatedInMid = false;

      steps.push({
        stepIndex: steps.length,
        phase: 'BINARY_SEARCH',
        type: 'PROBE_MID_FRONT',
        title: `Probe Front ${mid + 1} for ${p.name}`,
        explanation: `Binary search mid = Front ${mid + 1} (bracket [F${low + 1} ... F${high + 1}]). Checking if any member dominates ${p.name}.`,
        activePoints: [p.id, ...midFront],
        laser: null,
        fronts: fronts.map(f => [...f]),
        frontRank: { ...frontRank },
        sortedOrder: sortedPop.map(p => p.id),
        stats: { comparisons: totalComparisons, currentFront: mid + 1 }
      });

      for (const qId of midFront) {
        const q = population.find(item => item.id === qId);
        totalComparisons++;
        const qDomP = dominates(q.coords, p.coords, minimize);

        if (qDomP) {
          dominatedInMid = true;
          steps.push({
            stepIndex: steps.length,
            phase: 'BINARY_SEARCH',
            type: 'DOMINATED_AT_MID',
            title: `${q.name} dominates ${p.name}`,
            explanation: `${q.name} ∈ F${mid + 1} dominates ${p.name}. Point cannot belong to Front ${mid + 1} or lower; searching higher fronts [F${mid + 2} ... F${high + 1}].`,
            activePoints: [p.id, q.id],
            laser: {
              from: q.id,
              to: p.id,
              relation: 'q_dominates_p',
              label: `${q.name} ≺ ${p.name}`
            },
            fronts: fronts.map(f => [...f]),
            frontRank: { ...frontRank },
            sortedOrder: sortedPop.map(p => p.id),
            stats: { comparisons: totalComparisons, currentFront: mid + 1 }
          });
          break;
        }
      }

      if (dominatedInMid) {
        low = mid + 1;
      } else {
        insertFront = mid;
        high = mid - 1;
      }
    }

    if (insertFront < fronts.length) {
      fronts[insertFront].push(p.id);
      frontRank[p.id] = insertFront + 1;
      steps.push({
        stepIndex: steps.length,
        phase: 'FRONT_ASSIGNMENT',
        type: 'ASSIGN_FRONT',
        title: `${p.name} Inserted in Front ${insertFront + 1}`,
        explanation: `Binary search converged: ${p.name} assigned to Front ${insertFront + 1}.`,
        activePoints: [p.id],
        laser: null,
        fronts: fronts.map(f => [...f]),
        frontRank: { ...frontRank },
        sortedOrder: sortedPop.map(p => p.id),
        stats: { comparisons: totalComparisons, currentFront: insertFront + 1 }
      });
    } else {
      const newFrontIndex = fronts.length + 1;
      fronts.push([p.id]);
      frontRank[p.id] = newFrontIndex;
      steps.push({
        stepIndex: steps.length,
        phase: 'FRONT_ASSIGNMENT',
        type: 'NEW_FRONT_CREATED',
        title: `Created Front ${newFrontIndex} for ${p.name}`,
        explanation: `${p.name} is dominated in all existing fronts. Created new Front ${newFrontIndex}.`,
        activePoints: [p.id],
        laser: null,
        fronts: fronts.map(f => [...f]),
        frontRank: { ...frontRank },
        sortedOrder: sortedPop.map(p => p.id),
        stats: { comparisons: totalComparisons, currentFront: newFrontIndex }
      });
    }
  }

  // Compute Crowding Distances and sort within fronts
  const cdResult = computeAllCrowdingDistances(population, fronts, minimize);

  if (fronts.length > 0) {
    const cdSummary = fronts.map((f, idx) => {
      const sortedInFront = cdResult.sortedFronts[idx] || [];
      const names = sortedInFront.map(id => {
        const pt = population.find(item => item.id === id);
        const dist = cdResult.crowdingDistances[id];
        const distStr = dist === Infinity ? '∞' : dist.toFixed(3);
        return `${pt ? pt.name : id}(d=${distStr})`;
      }).join(', ');
      return `F${idx + 1}: [${names}]`;
    }).join(' | ');

    steps.push({
      stepIndex: steps.length,
      phase: 'CROWDING_DISTANCE',
      type: 'CROWDING_DISTANCE_SORT',
      title: 'Crowding Distance Computation',
      explanation: `Calculated crowding distances for ENS-BS fronts to maintain diversity. Boundary points receive ∞. Solutions sorted descending: ${cdSummary}.`,
      activePoints: population.map(p => p.id),
      laser: null,
      fronts: cdResult.sortedFronts.map(f => [...f]),
      frontRank: { ...frontRank },
      sortedOrder: sortedPop.map(p => p.id),
      crowdingDistances: { ...cdResult.crowdingDistances },
      withinFrontRanks: { ...cdResult.withinFrontRanks },
      stats: { comparisons: totalComparisons, currentFront: fronts.length }
    });
  }

  steps.push({
    stepIndex: steps.length,
    phase: 'COMPLETE',
    type: 'SORT_FINISHED',
    title: 'ENS-BS Sort Completed',
    explanation: `ENS Binary Search completed in ${totalComparisons} dominance comparisons. Fronts sorted within front by crowding distance.`,
    activePoints: [],
    laser: null,
    fronts: cdResult.sortedFronts.map(f => [...f]),
    frontRank: { ...frontRank },
    sortedOrder: sortedPop.map(p => p.id),
    crowdingDistances: { ...cdResult.crowdingDistances },
    withinFrontRanks: { ...cdResult.withinFrontRanks },
    stats: { comparisons: totalComparisons, currentFront: fronts.length }
  });

  return {
    fronts: cdResult.sortedFronts,
    rawFronts: fronts,
    crowdingDistances: cdResult.crowdingDistances,
    withinFrontRanks: cdResult.withinFrontRanks,
    steps,
    totalComparisons
  };
}
