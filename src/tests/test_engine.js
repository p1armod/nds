import { dominates, compareDominance, verifyIrreflexive, verifyAsymmetric, verifyTransitive, computeTheoreticalBounds } from '../engine/dominance.js';
import { generateFNDSSteps } from '../engine/fnds.js';
import { generateENSSteps } from '../engine/ens_ss.js';
import { generateENSBSSteps } from '../engine/ens_bs.js';
import { generateNaiveNDSSteps } from '../engine/naive_nds.js';
import { computeNdfTriangle } from '../engine/bell_ndf.js';

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
console.log('  NON-DOMINATED SORTING TEST SUITE (RESEARCH PAPER) ');
console.log('====================================================\n');

// 1. Dominance Definition & Properties (Section 2)
console.log('Test Group 1: Mathematical Properties (Section 2)');
const p = [1, 7];
const q = [5, 9];
const r = [7, 15];

assert(dominates(p, q), 'P1(1,7) dominates P4(5,9)');
assert(!dominates(q, p), 'P4(5,9) does not dominate P1(1,7)');
assert(verifyIrreflexive(p), 'Property 1: Irreflexive ¬(P ≺ P)');
assert(verifyAsymmetric(p, q), 'Property 2: Asymmetric (P ≺ Q ⇒ ¬(Q ≺ P))');
assert(verifyTransitive(p, q, r), 'Property 4: Transitivity (P ≺ Q ∧ Q ≺ R ⇒ P ≺ R)');

// Figure 1 Population from Research Paper
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

console.log('\nTest Group 2: Paper Figure 1 & Tables 1 and 2 Validation');
const fndsResult = generateFNDSSteps(fig1Population);

// Validate Table 1: Domination counts
const expectedDomCounts = {
  p1: 0, p2: 0, p3: 0, p4: 2, p5: 3, p6: 2, p7: 5, p8: 4
};
const initCountsStep = fndsResult.steps.find(s => s.type === 'FRONT_1_FORMED');
for (const [id, exp] of Object.entries(expectedDomCounts)) {
  const actual = initCountsStep.dominationCounts[id];
  assert(actual === exp, `Table 1 match: Domination count of ${id.toUpperCase()} = ${actual} (expected ${exp})`);
}

// Validate Table 2: Dominance sets
const expectedDomSets = {
  p1: ['p4', 'p5', 'p7', 'p8'],
  p2: ['p4', 'p5', 'p6', 'p7', 'p8'],
  p3: ['p5', 'p6', 'p7', 'p8'],
  p4: ['p7'],
  p5: ['p7', 'p8'],
  p6: [],
  p7: [],
  p8: []
};
const lastStep = fndsResult.steps[fndsResult.steps.length - 1];
for (const [id, expArr] of Object.entries(expectedDomSets)) {
  const actualSet = lastStep.dominanceSets[id].sort();
  const expSet = [...expArr].sort();
  const match = JSON.stringify(actualSet) === JSON.stringify(expSet);
  assert(match, `Table 2 match: Dominance set S_${id.toUpperCase()} = {${actualSet.join(',')}} (expected {${expSet.join(',')}})`);
}

// Validate Fronts: Front 1: {P1, P2, P3}, Front 2: {P4, P5, P6}, Front 3: {P7, P8}
console.log('\nTest Group 3: Non-dominated Front Partition Verification');
const f1 = fndsResult.fronts[0].sort();
const f2 = fndsResult.fronts[1].sort();
const f3 = fndsResult.fronts[2].sort();

assert(JSON.stringify(f1) === JSON.stringify(['p1', 'p2', 'p3']), 'Front 1 = {P1, P2, P3}');
assert(JSON.stringify(f2) === JSON.stringify(['p4', 'p5', 'p6']), 'Front 2 = {P4, P5, P6}');
assert(JSON.stringify(f3) === JSON.stringify(['p7', 'p8']), 'Front 3 = {P7, P8}');

// 4. Test ENS-SS (Efficient Non-dominated Sort Sequential)
console.log('\nTest Group 4: ENS-SS Verification');
const ensResult = generateENSSteps(fig1Population);
const ensF1 = ensResult.fronts[0].sort();
const ensF2 = ensResult.fronts[1].sort();
const ensF3 = ensResult.fronts[2].sort();
assert(JSON.stringify(ensF1) === JSON.stringify(['p1', 'p2', 'p3']), 'ENS-SS Front 1 matches FNDS');
assert(JSON.stringify(ensF2) === JSON.stringify(['p4', 'p5', 'p6']), 'ENS-SS Front 2 matches FNDS');
assert(JSON.stringify(ensF3) === JSON.stringify(['p7', 'p8']), 'ENS-SS Front 3 matches FNDS');
assert(ensResult.totalComparisons < fndsResult.totalComparisons, `ENS-SS is more efficient: ${ensResult.totalComparisons} vs ${fndsResult.totalComparisons} comparisons`);

// 5. Test ENS-BS (Efficient Non-dominated Sort Binary Search)
console.log('\nTest Group 5: ENS-BS Verification');
const ensBsResult = generateENSBSSteps(fig1Population);
const ensBsF1 = ensBsResult.fronts[0].sort();
const ensBsF2 = ensBsResult.fronts[1].sort();
const ensBsF3 = ensBsResult.fronts[2].sort();
assert(JSON.stringify(ensBsF1) === JSON.stringify(['p1', 'p2', 'p3']), 'ENS-BS Front 1 matches FNDS');
assert(JSON.stringify(ensBsF2) === JSON.stringify(['p4', 'p5', 'p6']), 'ENS-BS Front 2 matches FNDS');
assert(JSON.stringify(ensBsF3) === JSON.stringify(['p7', 'p8']), 'ENS-BS Front 3 matches FNDS');

// 6. Test Naive NDS
console.log('\nTest Group 6: Naive NDS Verification');
const naiveResult = generateNaiveNDSSteps(fig1Population);
const naiveF1 = naiveResult.fronts[0].sort();
const naiveF2 = naiveResult.fronts[1].sort();
const naiveF3 = naiveResult.fronts[2].sort();
assert(JSON.stringify(naiveF1) === JSON.stringify(['p1', 'p2', 'p3']), 'Naive NDS Front 1 matches FNDS');
assert(JSON.stringify(naiveF2) === JSON.stringify(['p4', 'p5', 'p6']), 'Naive NDS Front 2 matches FNDS');
assert(JSON.stringify(naiveF3) === JSON.stringify(['p7', 'p8']), 'Naive NDS Front 3 matches FNDS');

// 7. Section 5: NDF Triangle & Bell Numbers
console.log('\nTest Group 7: Section 5 Bell Numbers & NDF Triangle (Figure 5)');
const triangle = computeNdfTriangle(10);
const expectedBellNumbers = [
  1, 3, 13, 75, 541, 4683, 47293, 545835, 7087261, 102247563
];
for (let n = 1; n <= 10; n++) {
  const actualB = Number(triangle[n - 1].bellNumber);
  const expB = expectedBellNumbers[n - 1];
  assert(actualB === expB, `Figure 5: B_${n} = ${actualB} (expected ${expB})`);
}

// Check row 4 coefficients: [1, 14, 36, 24]
assert(JSON.stringify(triangle[3].coefficients) === JSON.stringify([1, 14, 36, 24]), 'Figure 5 N=4 row: [1, 14, 36, 24]');
// Check row 6 coefficients: [1, 62, 540, 1560, 1800, 720]
assert(JSON.stringify(triangle[5].coefficients) === JSON.stringify([1, 62, 540, 1560, 1800, 720]), 'Figure 5 N=6 row: [1, 62, 540, 1560, 1800, 720]');

// 8. Theoretical Bounds
console.log('\nTest Group 8: Theoretical Bounds (Eq. 7, 8, 11, 12)');
const frontSizes = [3, 3, 2];
const b1 = computeTheoreticalBounds(0, frontSizes);
assert(b1.dominationCount.min === 0 && b1.dominationCount.max === 0, 'Front 1 dom count bounds: [0, 0]');
assert(b1.dominanceSet.min === 2 && b1.dominanceSet.max === 5, 'Front 1 dom set bounds: [2, 5]');

const b2 = computeTheoreticalBounds(1, frontSizes);
assert(b2.dominationCount.min === 1 && b2.dominationCount.max === 3, 'Front 2 dom count bounds: [1, 3]');
assert(b2.dominanceSet.min === 1 && b2.dominanceSet.max === 2, 'Front 2 dom set bounds: [1, 2]');

const b3 = computeTheoreticalBounds(2, frontSizes);
assert(b3.dominationCount.min === 2 && b3.dominationCount.max === 6, 'Front 3 dom count bounds: [2, 6]');
assert(b3.dominanceSet.min === 0 && b3.dominanceSet.max === 0, 'Front 3 dom set bounds: [0, 0]');

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
