import { dominates } from './dominance.js';
import { computeAllCrowdingDistances } from './crowding_distance.js';

/**
 * Fast Non-dominated Sort (FNDS) - Deb et al. (NSGA-II)
 * Generates an array of visual simulation steps so sorting unfolds visually.
 *
 * @param {Array<{id: string, name: string, coords: number[]}>} population
 * @param {boolean[]} [minimize]
 * @returns {{ fronts: string[][], steps: object[], totalComparisons: number }}
 */
export function generateFNDSSteps(population, minimize = null) {
  const steps = [];
  const N = population.length;
  let totalComparisons = 0;

  const S = {}; // Dominance set: points dominated by p
  const n = {}; // Domination count: number of points dominating p
  const frontRank = {}; // Assigned front index

  population.forEach(p => {
    S[p.id] = [];
    n[p.id] = 0;
    frontRank[p.id] = null;
  });

  // Step 0: Initial State
  steps.push({
    stepIndex: steps.length,
    phase: 'INITIALIZATION',
    type: 'INIT',
    title: 'Initialize Population',
    explanation: `Loaded ${N} points. All domination counts n_p set to 0, dominance sets S_p set to ∅.`,
    activePoints: [],
    laser: null,
    dominationCounts: { ...n },
    dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
    fronts: [],
    frontRank: { ...frontRank },
    stats: { comparisons: totalComparisons, currentFront: 0 }
  });

  // PHASE 1: Pairwise Dominance Matrix Computation
  for (let i = 0; i < N; i++) {
    const p = population[i];

    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const q = population[j];

      totalComparisons++;

      // Formulate objective comparison inequalities
      const M = Math.min(p.coords.length, q.coords.length);
      const conditions = [];
      for (let m = 0; m < M; m++) {
        const pm = p.coords[m];
        const qm = q.coords[m];
        const isMin = minimize ? minimize[m] !== false : true;
        const comp = pm === qm ? '=' : (isMin ? (pm < qm ? '<' : '>') : (pm > qm ? '>' : '<'));
        conditions.push(`f${m+1}: ${pm} ${comp} ${qm}`);
      }

      const pDomQ = dominates(p.coords, q.coords, minimize);
      const qDomP = dominates(q.coords, p.coords, minimize);

      let relation = 'non-dominated';
      let explanation = '';

      if (pDomQ) {
        relation = 'p_dominates_q';
        S[p.id].push(q.id);
        explanation = `${p.name} ≺ ${q.name} (${p.name} dominates ${q.name}). Added ${q.name} to S_${p.name}.`;
      } else if (qDomP) {
        relation = 'q_dominates_p';
        n[p.id] += 1;
        explanation = `${q.name} ≺ ${p.name} (${q.name} dominates ${p.name}). Incremented n_${p.name} to ${n[p.id]}.`;
      } else {
        relation = 'non-dominated';
        explanation = `${p.name} and ${q.name} are non-dominated (${p.name} ⊀ ${q.name} ∧ ${q.name} ⊀ ${p.name}).`;
      }

      steps.push({
        stepIndex: steps.length,
        phase: 'PAIRWISE_COMPARISON',
        type: 'COMPARE_PAIR',
        title: `Compare ${p.name} vs ${q.name}`,
        explanation: `${explanation} [${conditions.join(', ')}]`,
        activePoints: [p.id, q.id],
        laser: {
          from: p.id,
          to: q.id,
          relation,
          label: relation === 'p_dominates_q' ? `${p.name} ≺ ${q.name}` :
                 (relation === 'q_dominates_p' ? `${q.name} ≺ ${p.name}` : `${p.name} ∥ ${q.name}`)
        },
        dominationCounts: { ...n },
        dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
        fronts: [],
        frontRank: { ...frontRank },
        stats: { comparisons: totalComparisons, currentFront: 0 }
      });
    }
  }

  // Identify Front 1 (all points with n_p == 0)
  const fronts = [];
  const F1 = [];
  population.forEach(p => {
    if (n[p.id] === 0) {
      F1.push(p.id);
      frontRank[p.id] = 1;
    }
  });

  if (F1.length > 0) {
    fronts.push(F1);
    const f1Names = F1.map(id => population.find(p => p.id === id)?.name || id).join(', ');
    steps.push({
      stepIndex: steps.length,
      phase: 'FRONT_DISCOVERY',
      type: 'FRONT_1_FORMED',
      title: 'Front 1 Identified (Pareto Optimal)',
      explanation: `Points with domination count n_p = 0 form Front 1 (Pareto Frontier): { ${f1Names} }.`,
      activePoints: [...F1],
      laser: null,
      dominationCounts: { ...n },
      dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
      fronts: fronts.map(f => [...f]),
      frontRank: { ...frontRank },
      stats: { comparisons: totalComparisons, currentFront: 1 }
    });
  }

  // PHASE 2: Peeling successive fronts
  let frontIndex = 0;

  while (fronts[frontIndex] && fronts[frontIndex].length > 0) {
    const currentFront = fronts[frontIndex];
    const nextFront = [];
    const currentK = frontIndex + 1;

    for (const pId of currentFront) {
      const p = population.find(item => item.id === pId);
      const dominatedList = S[pId];

      for (const qId of dominatedList) {
        const q = population.find(item => item.id === qId);
        n[qId] -= 1;
        const reachedZero = n[qId] === 0;

        if (reachedZero) {
          nextFront.push(qId);
          frontRank[qId] = currentK + 1;
        }

        steps.push({
          stepIndex: steps.length,
          phase: 'PEELING_FRONTS',
          type: reachedZero ? 'PROMOTE_TO_FRONT' : 'DECREMENT_COUNT',
          title: `Peel Front ${currentK}: ${p.name} ➔ ${q.name}`,
          explanation: `${p.name} ∈ F${currentK} decrements n_${q.name} by 1 (now ${n[qId]}).${reachedZero ? ` n_${q.name} reached 0 ➔ Promoted to Front ${currentK + 1}!` : ''}`,
          activePoints: [pId, qId],
          laser: {
            from: pId,
            to: qId,
            relation: reachedZero ? 'promotion' : 'decrement',
            label: `n_${q.name} ➔ ${n[qId]}`
          },
          dominationCounts: { ...n },
          dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
          fronts: fronts.map(f => [...f]),
          frontRank: { ...frontRank },
          stats: { comparisons: totalComparisons, currentFront: currentK }
        });
      }
    }

    frontIndex++;
    if (nextFront.length > 0) {
      fronts.push(nextFront);
      const nextNames = nextFront.map(id => population.find(p => p.id === id).name).join(', ');
      steps.push({
        stepIndex: steps.length,
        phase: 'FRONT_DISCOVERY',
        type: 'FRONT_FORMED',
        title: `Front ${frontIndex + 1} Formed`,
        explanation: `Front ${frontIndex + 1} finalized: { ${nextNames} }.`,
        activePoints: [...nextFront],
        laser: null,
        dominationCounts: { ...n },
        dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
        fronts: fronts.map(f => [...f]),
        frontRank: { ...frontRank },
        stats: { comparisons: totalComparisons, currentFront: frontIndex + 1 }
      });
    }
  }

  // PHASE 3: Crowding Distance Computation & Within-Front Sorting (NSGA-II)
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
      title: 'Crowding Distance Computation (NSGA-II)',
      explanation: `Calculated crowding distance for each front to maintain diversity. Boundary points receive ∞. Solutions sorted descending: ${cdSummary}.`,
      activePoints: population.map(p => p.id),
      laser: null,
      dominationCounts: { ...n },
      dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
      fronts: cdResult.sortedFronts.map(f => [...f]),
      frontRank: { ...frontRank },
      crowdingDistances: { ...cdResult.crowdingDistances },
      withinFrontRanks: { ...cdResult.withinFrontRanks },
      stats: { comparisons: totalComparisons, currentFront: fronts.length }
    });
  }

  // Final Summary Step
  steps.push({
    stepIndex: steps.length,
    phase: 'COMPLETE',
    type: 'SORT_FINISHED',
    title: 'Fast Non-dominated Sort Completed',
    explanation: `Completed sorting in ${totalComparisons} dominance comparisons. Generated ${fronts.length} non-dominated fronts, sorted within front by crowding distance.`,
    activePoints: [],
    laser: null,
    dominationCounts: { ...n },
    dominanceSets: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, [...v]])),
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
