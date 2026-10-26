import { dominates } from './dominance.js';
import { computeAllCrowdingDistances } from './crowding_distance.js';

/**
 * Naive Non-dominated Sort (Deductive Sort)
 */
export function generateNaiveNDSSteps(population, minimize = null) {
  const steps = [];
  const N = population.length;
  let totalComparisons = 0;

  const frontRank = {};
  population.forEach(p => { frontRank[p.id] = null; });

  let remaining = [...population];
  const fronts = [];
  let k = 1;

  steps.push({
    stepIndex: steps.length,
    phase: 'INITIALIZATION',
    type: 'INIT',
    title: 'Initialize Naive NDS',
    explanation: `Starting Naive Non-dominated Sorting on ${N} points.`,
    activePoints: [],
    laser: null,
    fronts: [],
    frontRank: { ...frontRank },
    stats: { comparisons: totalComparisons, currentFront: 0 }
  });

  while (remaining.length > 0) {
    const currentFront = [];

    steps.push({
      stepIndex: steps.length,
      phase: 'FINDING_FRONT',
      type: 'START_FRONT_SCAN',
      title: `Finding Front ${k}`,
      explanation: `Scanning ${remaining.length} remaining points to identify points not dominated by any other remaining point.`,
      activePoints: remaining.map(p => p.id),
      laser: null,
      fronts: fronts.map(f => [...f]),
      frontRank: { ...frontRank },
      stats: { comparisons: totalComparisons, currentFront: k }
    });

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      let dominated = false;

      for (let j = 0; j < remaining.length; j++) {
        if (i === j) continue;
        const q = remaining[j];
        totalComparisons++;

        const qDomP = dominates(q.coords, p.coords, minimize);

        steps.push({
          stepIndex: steps.length,
          phase: 'PAIRWISE_CHECK',
          type: 'COMPARE_PAIR',
          title: `Check if ${q.name} dominates ${p.name}`,
          explanation: `Testing if ${q.name} dominates candidate ${p.name}: ${qDomP ? `YES (${q.name} ≺ ${p.name})` : `NO (${q.name} ⊀ ${p.name})`}.`,
          activePoints: [p.id, q.id],
          laser: {
            from: q.id,
            to: p.id,
            relation: qDomP ? 'q_dominates_p' : 'non-dominated',
            label: qDomP ? `${q.name} ≺ ${p.name}` : `${q.name} ⊀ ${p.name}`
          },
          fronts: fronts.map(f => [...f]),
          frontRank: { ...frontRank },
          stats: { comparisons: totalComparisons, currentFront: k }
        });

        if (qDomP) {
          dominated = true;
          break; // p is dominated, cannot be in current front
        }
      }

      if (!dominated) {
        currentFront.push(p.id);
        frontRank[p.id] = k;
      }
    }

    fronts.push(currentFront);
    const frontNames = currentFront.map(id => population.find(p => p.id === id).name).join(', ');

    steps.push({
      stepIndex: steps.length,
      phase: 'FRONT_DISCOVERY',
      type: 'FRONT_FORMED',
      title: `Front ${k} Identified`,
      explanation: `Front ${k} complete: { ${frontNames} }. Removing these points from candidate pool.`,
      activePoints: [...currentFront],
      laser: null,
      fronts: fronts.map(f => [...f]),
      frontRank: { ...frontRank },
      stats: { comparisons: totalComparisons, currentFront: k }
    });

    remaining = remaining.filter(p => !currentFront.includes(p.id));
    k++;
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
      explanation: `Calculated crowding distances for Naive NDS fronts to maintain diversity. Boundary points receive ∞. Solutions sorted descending: ${cdSummary}.`,
      activePoints: population.map(p => p.id),
      laser: null,
      fronts: cdResult.sortedFronts.map(f => [...f]),
      frontRank: { ...frontRank },
      crowdingDistances: { ...cdResult.crowdingDistances },
      withinFrontRanks: { ...cdResult.withinFrontRanks },
      stats: { comparisons: totalComparisons, currentFront: fronts.length }
    });
  }

  steps.push({
    stepIndex: steps.length,
    phase: 'COMPLETE',
    type: 'SORT_FINISHED',
    title: 'Naive NDS Completed',
    explanation: `Naive Non-dominated Sorting finished in ${totalComparisons} dominance comparisons. Fronts sorted within front by crowding distance.`,
    activePoints: [],
    laser: null,
    fronts: cdResult.sortedFronts.map(f => [...f]),
    frontRank: { ...frontRank },
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
