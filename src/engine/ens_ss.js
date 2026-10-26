import { dominates } from './dominance.js';
import { computeAllCrowdingDistances } from './crowding_distance.js';

/**
 * Efficient Non-dominated Sort - Sequential Search (ENS-SS)
 * (Zhang et al.)
 */
export function generateENSSteps(population, minimize = null) {
  const steps = [];
  const N = population.length;
  let totalComparisons = 0;

  // Pre-sort population: Primary f1 ascending, break ties sequentially on f2, f3...
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

  // Step 0: Pre-sorting step
  steps.push({
    stepIndex: steps.length,
    phase: 'PRE_SORTING',
    type: 'PRE_SORT_COMPLETE',
    title: 'Pre-sorting by Objective 1 (with Tie-breaking)',
    explanation: `Pre-sorted ${N} points on f1 ascending (ties broken by f2..fM): [${sortedPop.map(p => p.name).join(' ➔ ')}]. Theorem: Later points cannot dominate earlier points!`,
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
    let assigned = false;

    steps.push({
      stepIndex: steps.length,
      phase: 'SEQUENTIAL_INSERTION',
      type: 'SELECT_POINT',
      title: `Evaluate Point ${p.name}`,
      explanation: `Evaluating ${p.name} (coords: [${p.coords.join(', ')}]). Testing sequentially against existing fronts.`,
      activePoints: [p.id],
      laser: null,
      fronts: fronts.map(f => [...f]),
      frontRank: { ...frontRank },
      sortedOrder: sortedPop.map(p => p.id),
      stats: { comparisons: totalComparisons, currentFront: fronts.length }
    });

    for (let k = 0; k < fronts.length; k++) {
      const currentFront = fronts[k];
      let dominatedByFront = false;

      for (const qId of currentFront) {
        const q = population.find(item => item.id === qId);
        totalComparisons++;

        const qDomP = dominates(q.coords, p.coords, minimize);

        steps.push({
          stepIndex: steps.length,
          phase: 'SEQUENTIAL_INSERTION',
          type: 'COMPARE_FRONT_MEMBER',
          title: `Compare ${p.name} with ${q.name} (F${k + 1})`,
          explanation: `Checking if ${q.name} ∈ F${k + 1} dominates ${p.name}: ${qDomP ? `YES (${q.name} ≺ ${p.name})` : `NO (${q.name} ⊀ ${p.name})`}.`,
          activePoints: [p.id, q.id],
          laser: {
            from: q.id,
            to: p.id,
            relation: qDomP ? 'q_dominates_p' : 'non-dominated',
            label: qDomP ? `${q.name} ≺ ${p.name}` : `${q.name} ⊀ ${p.name}`
          },
          fronts: fronts.map(f => [...f]),
          frontRank: { ...frontRank },
          sortedOrder: sortedPop.map(p => p.id),
          stats: { comparisons: totalComparisons, currentFront: k + 1 }
        });

        if (qDomP) {
          dominatedByFront = true;
          break; // Point p is dominated in this front, must advance to next front
        }
      }

      if (!dominatedByFront) {
        currentFront.push(p.id);
        frontRank[p.id] = k + 1;
        assigned = true;

        steps.push({
          stepIndex: steps.length,
          phase: 'FRONT_ASSIGNMENT',
          type: 'ASSIGN_FRONT',
          title: `${p.name} Assigned to Front ${k + 1}`,
          explanation: `${p.name} is not dominated by any member of Front ${k + 1}. Added to Front ${k + 1}.`,
          activePoints: [p.id],
          laser: null,
          fronts: fronts.map(f => [...f]),
          frontRank: { ...frontRank },
          sortedOrder: sortedPop.map(p => p.id),
          stats: { comparisons: totalComparisons, currentFront: k + 1 }
        });
        break;
      }
    }

    if (!assigned) {
      const newFrontIndex = fronts.length + 1;
      fronts.push([p.id]);
      frontRank[p.id] = newFrontIndex;

      steps.push({
        stepIndex: steps.length,
        phase: 'FRONT_ASSIGNMENT',
        type: 'NEW_FRONT_CREATED',
        title: `New Front ${newFrontIndex} Created for ${p.name}`,
        explanation: `${p.name} was dominated in all existing fronts. Created new Front ${newFrontIndex} = { ${p.name} }.`,
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
      explanation: `Calculated crowding distances for ENS-SS fronts to maintain diversity. Boundary points receive ∞. Solutions sorted descending: ${cdSummary}.`,
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
    title: 'ENS-SS Sort Completed',
    explanation: `ENS Sequential Search finished in only ${totalComparisons} dominance comparisons (vs ~${N * (N - 1)} in Naive/FNDS). Fronts sorted within front by crowding distance.`,
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
