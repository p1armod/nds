import {
  computeFrontCrowdingDistance,
  sortFrontByCrowdingDistance,
  computeAllCrowdingDistances,
  crowdedCompare
} from '../engine/crowding_distance.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log('  CROWDING DISTANCE & WITHIN-FRONT SORTING TESTS    ');
console.log('====================================================\n');

// Test 1: Single-point and Two-point fronts (Boundary Infinity)
console.log('Test Group 1: Small Front Boundary Properties');
const singleFront = [{ id: 'p1', name: 'P1', coords: [2, 5] }];
const singleDist = computeFrontCrowdingDistance(singleFront);
assert(singleDist.p1 === Infinity, 'Front with 1 point assigns Infinity crowding distance');

const twoFront = [
  { id: 'p1', name: 'P1', coords: [1, 6] },
  { id: 'p2', name: 'P2', coords: [4, 2] }
];
const twoDist = computeFrontCrowdingDistance(twoFront);
assert(twoDist.p1 === Infinity && twoDist.p2 === Infinity, 'Front with 2 points assigns Infinity to both points');

// Test 2: Figure 1 Front 1 Verification (P1, P2, P3)
console.log('\nTest Group 2: Research Paper Figure 1 Front 1 Verification');
const f1Points = [
  { id: 'p1', name: 'P1', coords: [1, 7] },
  { id: 'p2', name: 'P2', coords: [3, 4] },
  { id: 'p3', name: 'P3', coords: [7, 2] }
];
const f1Dist = computeFrontCrowdingDistance(f1Points);
assert(f1Dist.p1 === Infinity, 'F1 boundary point P1 has d = Infinity');
assert(f1Dist.p3 === Infinity, 'F1 boundary point P3 has d = Infinity');

// Theoretical calculation for P2:
// Obj 1: (7 - 1) / (7 - 1) = 1.0
// Obj 2: (7 - 2) / (7 - 2) = 1.0
// Total = 1.0 + 1.0 = 2.0
assert(Math.abs(f1Dist.p2 - 2.0) < 1e-9, `F1 interior point P2 has d = ${f1Dist.p2} (expected 2.0)`);

// Sorting within Front 1 by Crowding Distance
const sortedF1 = sortFrontByCrowdingDistance(f1Points, f1Dist);
assert(sortedF1[0].id === 'p1' && sortedF1[1].id === 'p3' && sortedF1[2].id === 'p2',
  'Front 1 sorted by crowding distance: [P1(∞), P3(∞), P2(2.0)]');

// Test 3: Figure 1 Front 2 Verification (P4, P5, P6)
console.log('\nTest Group 3: Research Paper Figure 1 Front 2 Verification');
const f2Points = [
  { id: 'p4', name: 'P4', coords: [5, 9] },
  { id: 'p5', name: 'P5', coords: [7, 8] },
  { id: 'p6', name: 'P6', coords: [9, 4] }
];
const f2Dist = computeFrontCrowdingDistance(f2Points);
assert(f2Dist.p4 === Infinity, 'F2 boundary point P4 has d = Infinity');
assert(f2Dist.p6 === Infinity, 'F2 boundary point P6 has d = Infinity');

// Theoretical calculation for P5:
// Obj 1 range: [5, 9] (range 4), P5 obj1 neighbor delta = 9 - 5 = 4 / 4 = 1.0
// Obj 2 range: [4, 9] (range 5), P5 obj2 neighbor delta = 9 - 4 = 5 / 5 = 1.0
// Total = 2.0
assert(Math.abs(f2Dist.p5 - 2.0) < 1e-9, `F2 interior point P5 has d = ${f2Dist.p5} (expected 2.0)`);

const sortedF2 = sortFrontByCrowdingDistance(f2Points, f2Dist);
assert(sortedF2[0].id === 'p4' && sortedF2[1].id === 'p6' && sortedF2[2].id === 'p5',
  'Front 2 sorted by crowding distance: [P4(∞), P6(∞), P5(2.0)]');

// Test 4: Figure 1 Front 3 Verification (P7, P8)
console.log('\nTest Group 4: Research Paper Figure 1 Front 3 Verification');
const f3Points = [
  { id: 'p7', name: 'P7', coords: [7, 15] },
  { id: 'p8', name: 'P8', coords: [8, 8] }
];
const f3Dist = computeFrontCrowdingDistance(f3Points);
assert(f3Dist.p7 === Infinity && f3Dist.p8 === Infinity,
  'Front 3 both points are boundaries: P7(∞), P8(∞)');

// Test 5: 4-Point Front with Fractional Crowding Distance
console.log('\nTest Group 5: 4-Point Front with Asymmetric Spacing');
const f4Points = [
  { id: 'a', name: 'A', coords: [1, 10] },
  { id: 'b', name: 'B', coords: [2, 7] },
  { id: 'c', name: 'C', coords: [5, 4] },
  { id: 'd', name: 'D', coords: [8, 1] }
];
const f4Dist = computeFrontCrowdingDistance(f4Points);
assert(f4Dist.a === Infinity && f4Dist.d === Infinity, 'Boundary points A and D have d = Infinity');

// Obj 1: range 8 - 1 = 7.
// B: (5 - 1) / 7 = 4/7 (~0.5714)
// C: (8 - 2) / 7 = 6/7 (~0.8571)
// Obj 2: range 10 - 1 = 9.
// C: (7 - 1) / 9 = 6/9 = 2/3 (~0.6667)
// B: (10 - 4) / 9 = 6/9 = 2/3 (~0.6667)
// Total B = 4/7 + 2/3 = 26/21 ≈ 1.2381
// Total C = 6/7 + 2/3 = 32/21 ≈ 1.5238
assert(Math.abs(f4Dist.b - (26 / 21)) < 1e-9, `Point B crowding distance = ${f4Dist.b.toFixed(4)} (expected 1.2381)`);
assert(Math.abs(f4Dist.c - (32 / 21)) < 1e-9, `Point C crowding distance = ${f4Dist.c.toFixed(4)} (expected 1.5238)`);

// Sorting within front: C has higher crowding distance than B, so C should be ranked ahead of B!
const sortedF4 = sortFrontByCrowdingDistance(f4Points, f4Dist);
assert(sortedF4[0].id === 'a', 'Rank 1 in front: boundary A (∞)');
assert(sortedF4[1].id === 'd', 'Rank 2 in front: boundary D (∞)');
assert(sortedF4[2].id === 'c', 'Rank 3 in front: point C (d=1.5238 - less crowded)');
assert(sortedF4[3].id === 'b', 'Rank 4 in front: point B (d=1.2381 - more crowded)');

// Test 6: Zero Range Guard (identical coordinate in an objective)
console.log('\nTest Group 6: Zero Range Numerical Stability');
const flatPoints = [
  { id: 'x1', name: 'X1', coords: [1, 5] },
  { id: 'x2', name: 'X2', coords: [3, 5] },
  { id: 'x3', name: 'X3', coords: [6, 5] }
];
const flatDist = computeFrontCrowdingDistance(flatPoints);
assert(!isNaN(flatDist.x2), 'Zero range on objective 2 does not produce NaN');
assert(flatDist.x1 === Infinity && flatDist.x3 === Infinity, 'Boundaries on objective 1 still get Infinity');

// Test 7: 3D Multi-Objective Crowding Distance (M = 3)
console.log('\nTest Group 7: 3D Multi-Objective Crowding Distance');
const points3D = [
  { id: 'q1', name: 'Q1', coords: [1, 9, 8] },
  { id: 'q2', name: 'Q2', coords: [3, 6, 5] },
  { id: 'q3', name: 'Q3', coords: [5, 4, 3] },
  { id: 'q4', name: 'Q4', coords: [9, 1, 1] }
];
const dist3D = computeFrontCrowdingDistance(points3D);
assert(dist3D.q1 === Infinity, '3D boundary point Q1 receives Infinity');
assert(dist3D.q4 === Infinity, '3D boundary point Q4 receives Infinity');
assert(dist3D.q2 > 0 && Number.isFinite(dist3D.q2), `3D interior Q2 has finite positive distance: ${dist3D.q2}`);
assert(dist3D.q3 > 0 && Number.isFinite(dist3D.q3), `3D interior Q3 has finite positive distance: ${dist3D.q3}`);

// Test 8: computeAllCrowdingDistances across whole population
console.log('\nTest Group 8: Multi-Front Population Assignment');
const fig1Population = [
  { id: 'p1', name: 'P1', coords: [1, 7] },
  { id: 'p2', name: 'P2', coords: [3, 4] },
  { id: 'p3', name: 'P3', coords: [7, 2] },
  { id: 'p4', name: 'P4', coords: [5, 9] },
  { id: 'p5', name: 'P5', coords: [7, 8] },
  { id: 'p6', name: 'P6', coords: [9, 4] },
  { id: 'p7', name: 'P7', coords: [7, 15] },
  { id: 'p8', name: 'P8', coords: [8, 8] }
];
const fronts = [
  ['p1', 'p2', 'p3'],
  ['p4', 'p5', 'p6'],
  ['p7', 'p8']
];
const allResult = computeAllCrowdingDistances(fig1Population, fronts);
assert(Object.keys(allResult.crowdingDistances).length === 8, 'All 8 points have crowding distances computed');
assert(allResult.withinFrontRanks.p1 === 1, 'P1 within-front rank = 1');
assert(allResult.withinFrontRanks.p2 === 3, 'P2 within-front rank = 3 (after boundaries P1 and P3)');
assert(allResult.sortedFronts[0].join(',') === 'p1,p3,p2', 'Front 1 sorted order is [p1, p3, p2]');
assert(allResult.sortedFronts[1].join(',') === 'p4,p6,p5', 'Front 2 sorted order is [p4, p6, p5]');

// Test 9: Crowded-Comparison Operator (≺_n)
console.log('\nTest Group 9: Crowded-Comparison Operator (≺_n)');
const rankMap = { p1: 1, p2: 1, p3: 1, p4: 2, p5: 2, p6: 2, p7: 3, p8: 3 };
const distMap = allResult.crowdingDistances;

// P1 in Front 1 vs P4 in Front 2 -> P1 is preferred (better front)
const comp1 = crowdedCompare(fig1Population[0], fig1Population[3], rankMap, distMap);
assert(comp1 < 0, 'P1 ∈ F1 is preferred over P4 ∈ F2 (rank 1 < rank 2)');

// P1 (Infinity) vs P2 (2.0) in same front -> P1 is preferred
const comp2 = crowdedCompare(fig1Population[0], fig1Population[1], rankMap, distMap);
assert(comp2 < 0, 'P1 (d=∞) is preferred over P2 (d=2.0) in the same front');

// P2 vs P1 -> P2 is worse
const comp3 = crowdedCompare(fig1Population[1], fig1Population[0], rankMap, distMap);
assert(comp3 > 0, 'P2 (d=2.0) is worse than P1 (d=∞) in the same front');

// Test 10: Boundary Ties (Extreme Value Degeneracy)
console.log('\nTest Group 10: Boundary Ties (Extreme Value Degeneracy)');
const tieFront = [
  { id: 't1', name: 'T1', coords: [1, 10] },
  { id: 't2', name: 'T2', coords: [1, 9] }, // shares min f1 = 1
  { id: 't3', name: 'T3', coords: [4, 5] },
  { id: 't4', name: 'T4', coords: [8, 2] }
];
const tieDist = computeFrontCrowdingDistance(tieFront);
assert(tieDist.t1 === Infinity && tieDist.t2 === Infinity, 'Both points sharing min coordinate on obj 1 get Infinity');
assert(tieDist.t4 === Infinity, 'Max coordinate point gets Infinity');
assert(Number.isFinite(tieDist.t3) && tieDist.t3 > 0, 'Interior point T3 has finite positive crowding distance');

// Test 11: Minimization vs Maximization Direction Parameter
console.log('\nTest Group 11: Minimization vs Maximization Direction Parameter');
const sortedMin = sortFrontByCrowdingDistance(f1Points, f1Dist, [true, true]);
const sortedMax = sortFrontByCrowdingDistance(f1Points, f1Dist, [false, false]);
assert(sortedMin.length === 3 && sortedMax.length === 3, 'Both minimization and maximization sort successfully');
assert(sortedMin[0].id === 'p1' && sortedMin[1].id === 'p3' && sortedMin[2].id === 'p2',
  'Minimization breaks boundary tie placing lower coordinate P1 before P3');
assert(sortedMax[0].id === 'p3' && sortedMax[1].id === 'p1' && sortedMax[2].id === 'p2',
  'Maximization breaks boundary tie placing higher coordinate P3 before P1');

// Test 12: 5D Multi-Objective Crowding Distance
console.log('\nTest Group 12: 5D Multi-Objective Crowding Distance');
const points5D = [
  { id: 'm1', name: 'M1', coords: [10, 100, 50, 5000, 99.9] },
  { id: 'm2', name: 'M2', coords: [20, 80, 60, 6000, 99.5] },
  { id: 'm3', name: 'M3', coords: [30, 60, 70, 7000, 99.0] },
  { id: 'm4', name: 'M4', coords: [40, 40, 80, 8000, 98.5] }
];
const dist5D = computeFrontCrowdingDistance(points5D);
assert(dist5D.m1 === Infinity, '5D boundary point M1 has d = Infinity');
assert(dist5D.m4 === Infinity, '5D boundary point M4 has d = Infinity');
assert(Number.isFinite(dist5D.m2) && dist5D.m2 > 0, '5D interior point M2 has positive finite distance');
assert(Number.isFinite(dist5D.m3) && dist5D.m3 > 0, '5D interior point M3 has positive finite distance');

// Test 13: Strict 1-to-N Within-Front Ranking
console.log('\nTest Group 13: Strict 1-to-N Within-Front Ranking');
const rankedAll = computeAllCrowdingDistances(fig1Population, fronts);
assert(rankedAll.withinFrontRanks.p1 === 1, 'F1 Rank 1 is P1 (∞)');
assert(rankedAll.withinFrontRanks.p3 === 2, 'F1 Rank 2 is P3 (∞)');
assert(rankedAll.withinFrontRanks.p2 === 3, 'F1 Rank 3 is P2 (d=2.0)');
assert(rankedAll.withinFrontRanks.p4 === 1, 'F2 Rank 1 is P4 (∞)');
assert(rankedAll.withinFrontRanks.p6 === 2, 'F2 Rank 2 is P6 (∞)');
assert(rankedAll.withinFrontRanks.p5 === 3, 'F2 Rank 3 is P5 (d=2.0)');
assert(rankedAll.withinFrontRanks.p7 === 1, 'F3 Rank 1 is P7 (∞)');
assert(rankedAll.withinFrontRanks.p8 === 2, 'F3 Rank 2 is P8 (∞)');

console.log('\n====================================================');
console.log(`CROWDING DISTANCE TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
