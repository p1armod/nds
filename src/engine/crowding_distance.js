/**
 * NSGA-II Crowding Distance Computation and Within-Front Sorting
 * Reference: Deb, Pratap, Agarwal, Meyarivan (2002) - "A Fast and Elitist
 * Multiobjective Genetic Algorithm: NSGA-II", Section III-B.
 */

/**
 * Computes crowding distances for an array of points belonging to a single non-dominated front.
 * 
 * For a front I of size l:
 * - If l <= 2, all points are boundary solutions and receive distance Infinity.
 * - For l > 2:
 *   - Each point distance initialized to 0.
 *   - For each objective m = 0 ... M-1:
 *     - Sort points ascending by objective m.
 *     - Assign Infinity to the minimum and maximum boundary points.
 *     - For each intermediate point j = 1 ... l-2:
 *       if distance is not already Infinity:
 *         distance += (I[j+1][m] - I[j-1][m]) / (max_m - min_m)
 * 
 * @param {Array<{id: string, name: string, coords: number[]}>} frontPoints
 * @returns {Record<string, number>} Map from point id to crowding distance
 */
export function computeFrontCrowdingDistance(frontPoints) {
  const distances = {};
  const l = frontPoints.length;

  if (l === 0) return distances;

  if (l === 1) {
    distances[frontPoints[0].id] = Infinity;
    return distances;
  }

  if (l === 2) {
    distances[frontPoints[0].id] = Infinity;
    distances[frontPoints[1].id] = Infinity;
    return distances;
  }

  // Initialize all to 0
  frontPoints.forEach(p => {
    distances[p.id] = 0;
  });

  const M = frontPoints[0].coords.length;

  for (let m = 0; m < M; m++) {
    // Sort front points by objective m ascending
    const sorted = [...frontPoints].sort((a, b) => {
      const diff = a.coords[m] - b.coords[m];
      if (Math.abs(diff) > 1e-9) return diff;
      // Secondary sort to stabilize identical coordinates
      for (let k = 0; k < M; k++) {
        if (k === m) continue;
        const subDiff = a.coords[k] - b.coords[k];
        if (Math.abs(subDiff) > 1e-9) return subDiff;
      }
      return a.id.localeCompare(b.id);
    });

    // Boundary points on this objective get Infinity (all points sharing min or max coordinate)
    const minM = sorted[0].coords[m];
    const maxM = sorted[l - 1].coords[m];
    const rangeM = maxM - minM;

    for (let j = 0; j < l; j++) {
      const val = sorted[j].coords[m];
      if (Math.abs(val - minM) < 1e-9 || Math.abs(val - maxM) < 1e-9) {
        distances[sorted[j].id] = Infinity;
      }
    }

    if (rangeM > 1e-9) {
      for (let j = 1; j < l - 1; j++) {
        const curr = sorted[j];
        if (distances[curr.id] !== Infinity) {
          const delta = (sorted[j + 1].coords[m] - sorted[j - 1].coords[m]) / rangeM;
          distances[curr.id] += delta;
        }
      }
    }
  }

  return distances;
}

/**
 * Sorts points within a front by crowding distance in descending order.
 * Points with Infinity (boundary points) come first.
 * Intermediate points follow with higher crowding distances preferred (less crowded).
 * Ties are broken deterministically by objective coordinates (f1 ascending, etc.).
 *
 * @param {Array<{id: string, name: string, coords: number[]}>} frontPoints
 * @param {Record<string, number>} [precomputedDistances]
 * @returns {Array<{id: string, name: string, coords: number[]}>} Sorted front points
 */
export function sortFrontByCrowdingDistance(frontPoints, precomputedDistances = null, minimize = null) {
  if (!frontPoints || frontPoints.length <= 1) return frontPoints ? [...frontPoints] : [];

  const distances = precomputedDistances || computeFrontCrowdingDistance(frontPoints);

  return [...frontPoints].sort((a, b) => {
    const distA = distances[a.id] ?? 0;
    const distB = distances[b.id] ?? 0;

    // Both Infinity: break ties deterministically by coordinates (e.g. f1 ascending/descending)
    if (distA === Infinity && distB === Infinity) {
      const M = Math.min(a.coords.length, b.coords.length);
      for (let m = 0; m < M; m++) {
        const isMin = minimize ? minimize[m] !== false : true;
        const diff = isMin ? (a.coords[m] - b.coords[m]) : (b.coords[m] - a.coords[m]);
        if (Math.abs(diff) > 1e-9) return diff;
      }
      return a.name.localeCompare(b.name);
    }

    // Infinite crowding distance preferred over finite
    if (distA === Infinity) return -1;
    if (distB === Infinity) return 1;

    // Higher crowding distance preferred (descending)
    const diff = distB - distA;
    if (Math.abs(diff) > 1e-9) return diff;

    // Tie-breaker for identical finite crowding distance
    const M = Math.min(a.coords.length, b.coords.length);
    for (let m = 0; m < M; m++) {
      const isMin = minimize ? minimize[m] !== false : true;
      const cDiff = isMin ? (a.coords[m] - b.coords[m]) : (b.coords[m] - a.coords[m]);
      if (Math.abs(cDiff) > 1e-9) return cDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Computes crowding distances and within-front ranks for all fronts in a population.
 * 
 * @param {Array<{id: string, name: string, coords: number[]}>} population
 * @param {string[][]} fronts Array of fronts, each containing point IDs
 * @param {boolean[]} [minimize] Optional optimization direction per objective
 * @returns {{
 *   crowdingDistances: Record<string, number>,
 *   withinFrontRanks: Record<string, number>,
 *   sortedFronts: string[][]
 * }}
 */
export function computeAllCrowdingDistances(population, fronts, minimize = null) {
  const popMap = new Map(population.map(p => [p.id, p]));
  const crowdingDistances = {};
  const withinFrontRanks = {};
  const sortedFronts = [];

  for (const frontIds of fronts) {
    const frontPoints = frontIds
      .map(id => popMap.get(id))
      .filter(Boolean);

    const distances = computeFrontCrowdingDistance(frontPoints);
    Object.assign(crowdingDistances, distances);

    const sortedPoints = sortFrontByCrowdingDistance(frontPoints, distances, minimize);
    const sortedIds = sortedPoints.map(p => p.id);
    sortedFronts.push(sortedIds);

    sortedPoints.forEach((p, index) => {
      withinFrontRanks[p.id] = index + 1;
    });
  }

  // Any unassigned points get 0 distance and rank null
  population.forEach(p => {
    if (crowdingDistances[p.id] === undefined) {
      crowdingDistances[p.id] = 0;
      withinFrontRanks[p.id] = null;
    }
  });

  return {
    crowdingDistances,
    withinFrontRanks,
    sortedFronts
  };
}

/**
 * Canonical NSGA-II Crowded-Comparison Operator (≺_n).
 * Between two points p and q:
 * 1. p ≺_n q if p is in a better (lower index) front: rank_p < rank_q
 * 2. If in the same front, p ≺_n q if p has greater crowding distance: d_p > d_q
 * 
 * @returns {number} -1 if p is preferred to q, 1 if q is preferred to p, 0 if equal
 */
export function crowdedCompare(p, q, rankMap, distanceMap) {
  const rankP = rankMap[p.id] ?? Infinity;
  const rankQ = rankMap[q.id] ?? Infinity;

  if (rankP !== rankQ) {
    return rankP - rankQ;
  }

  const distP = distanceMap[p.id] ?? 0;
  const distQ = distanceMap[q.id] ?? 0;

  if (distP !== distQ) {
    return distQ - distP; // Higher crowding distance is preferred
  }

  // Deterministic tie-breaker
  const M = Math.min(p.coords.length, q.coords.length);
  for (let m = 0; m < M; m++) {
    const diff = p.coords[m] - q.coords[m];
    if (Math.abs(diff) > 1e-9) return diff;
  }

  return p.name.localeCompare(q.name);
}
