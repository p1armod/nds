/**
 * Core Pareto Dominance Mathematics & Theoretical Bounds
 * Based on Sections 1, 2, 3, 4 of the research paper: "Non-dominated Sorting"
 */

/**
 * Definition 1 (Dominance):
 * Point Pi dominates Pj (written Pi ≺ Pj) iff:
 * 1. Pim <= Pjm for all objectives m ∈ {1, ..., M} (assuming minimization)
 * 2. Pim < Pjm for at least one objective m ∈ {1, ..., M}
 *
 * @param {number[]} p - Coordinates of point Pi
 * @param {number[]} q - Coordinates of point Pj
 * @param {boolean[]} [minimize] - Array of booleans indicating minimization per objective (default all true)
 * @returns {boolean} True if p dominates q
 */
export function dominates(p, q, minimize = null) {
  const M = Math.min(p.length, q.length);
  let strictlyBetter = false;

  for (let m = 0; m < M; m++) {
    const isMin = minimize ? minimize[m] !== false : true;
    const pm = p[m];
    const qm = q[m];

    if (isMin) {
      if (pm > qm) return false; // p is worse on objective m
      if (pm < qm) strictlyBetter = true;
    } else {
      if (pm < qm) return false;
      if (pm > qm) strictlyBetter = true;
    }
  }

  return strictlyBetter;
}

/**
 * Checks detailed relationship between two points:
 *  1: p dominates q (p ≺ q)
 * -1: q dominates p (q ≺ p)
 *  0: mutually non-dominated (p ⊀ q ∧ q ⊀ p)
 *  2: identical coordinates (p == q)
 */
export function compareDominance(p, q, minimize = null) {
  const pDomQ = dominates(p, q, minimize);
  const qDomP = dominates(q, p, minimize);

  if (pDomQ) return 1;
  if (qDomP) return -1;

  const M = Math.min(p.length, q.length);
  let identical = true;
  for (let m = 0; m < M; m++) {
    if (Math.abs(p[m] - q[m]) > 1e-9) {
      identical = false;
      break;
    }
  }
  if (identical) return 2;

  return 0; // mutually non-dominated
}

/**
 * Section 2: Mathematical Properties of the Dominance Relation
 */

// Property 1: Irreflexive - A point cannot dominate itself: ¬(P ≺ P)
export function verifyIrreflexive(p, minimize = null) {
  return !dominates(p, p, minimize);
}

// Property 2: Asymmetric - If P ≺ Q, then ¬(Q ≺ P)
export function verifyAsymmetric(p, q, minimize = null) {
  if (dominates(p, q, minimize)) {
    return !dominates(q, p, minimize);
  }
  return true;
}

// Property 4: Transitivity - If P ≺ Q and Q ≺ R, then P ≺ R
export function verifyTransitive(p, q, r, minimize = null) {
  if (dominates(p, q, minimize) && dominates(q, r, minimize)) {
    return dominates(p, r, minimize);
  }
  return true;
}

/**
 * Section 3 & 4: Theoretical Bounds from the Research Paper
 * 
 * For a point P in front Fk (1 <= k <= K):
 * - Domination count max (Eq. 7): sum_{i=1}^{k-1} n_i
 * - Domination count min (Eq. 8): k - 1
 * - Dominance set max (Eq. 11): sum_{i=k+1}^K n_i
 * - Dominance set min (Eq. 12): K - k
 */
export function computeTheoreticalBounds(frontIndex, frontSizes) {
  const k = frontIndex + 1; // 1-indexed front number
  const K = frontSizes.length; // total number of fronts

  // Domination Count bounds:
  let domCountMax = 0;
  for (let i = 0; i < frontIndex; i++) {
    domCountMax += frontSizes[i];
  }
  const domCountMin = k - 1;

  // Dominance Set bounds:
  let domSetMax = 0;
  for (let i = frontIndex + 1; i < K; i++) {
    domSetMax += frontSizes[i];
  }
  const domSetMin = K - k;

  return {
    k,
    totalFronts: K,
    dominationCount: {
      min: domCountMin,
      max: domCountMax
    },
    dominanceSet: {
      min: domSetMin,
      max: domSetMax
    }
  };
}
