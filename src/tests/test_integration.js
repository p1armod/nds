import { generateFNDSSteps } from '../engine/fnds.js';
import { generateENSSteps } from '../engine/ens_ss.js';
import { generateENSBSSteps } from '../engine/ens_bs.js';
import { generateNaiveNDSSteps } from '../engine/naive_nds.js';
import { PRESETS, generateRandomPopulation } from '../data/presets.js';
import { computeAllCrowdingDistances, sortFrontByCrowdingDistance } from '../engine/crowding_distance.js';
import { computeNdfTriangle, getBellPolynomialString } from '../engine/bell_ndf.js';
import { computeTheoreticalBounds, dominates } from '../engine/dominance.js';

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
console.log('  END-TO-END CROSS-ALGORITHM INTEGRATION TESTS      ');
console.log('====================================================\n');

// 1. Cross-Algorithm Front & Crowding Distance Equivalence on All Presets
const presetsToTest = [
  'paperFigure1',
  'paperFigure1_3D',
  'convexFrontiers',
  'worstCaseChain',
  'bestCaseNonDominated',
  'disconnectedClusters'
];

for (const presetKey of presetsToTest) {
  const preset = PRESETS[presetKey];
  console.log(`Testing Preset: ${preset.name} (${preset.points.length} points, ${preset.dimensions}D)`);

  const fndsRes = generateFNDSSteps(preset.points);
  const ensSSRes = generateENSSteps(preset.points);
  const ensBSRes = generateENSBSSteps(preset.points);
  const naiveRes = generateNaiveNDSSteps(preset.points);

  // 1. Same number of fronts across all 4 algorithms
  assert(fndsRes.fronts.length === ensSSRes.fronts.length &&
         fndsRes.fronts.length === ensBSRes.fronts.length &&
         fndsRes.fronts.length === naiveRes.fronts.length,
         `All 4 algorithms agree on front count: ${fndsRes.fronts.length}`);

  // 2. Front contents match
  for (let k = 0; k < fndsRes.fronts.length; k++) {
    const fndsFront = [...fndsRes.fronts[k]].sort();
    const ensSSFront = [...ensSSRes.fronts[k]].sort();
    const ensBSFront = [...ensBSRes.fronts[k]].sort();
    const naiveFront = [...naiveRes.fronts[k]].sort();

    assert(JSON.stringify(fndsFront) === JSON.stringify(ensSSFront),
      `Preset ${presetKey} F${k + 1}: FNDS matches ENS-SS (${fndsFront.join(',')})`);
    assert(JSON.stringify(fndsFront) === JSON.stringify(ensBSFront),
      `Preset ${presetKey} F${k + 1}: FNDS matches ENS-BS`);
    assert(JSON.stringify(fndsFront) === JSON.stringify(naiveFront),
      `Preset ${presetKey} F${k + 1}: FNDS matches Naive NDS`);
  }

  // 3. Crowding Distances match across all algorithms
  for (const pt of preset.points) {
    const cdFnds = fndsRes.crowdingDistances[pt.id];
    const cdEnsSS = ensSSRes.crowdingDistances[pt.id];
    const cdEnsBS = ensBSRes.crowdingDistances[pt.id];
    const cdNaive = naiveRes.crowdingDistances[pt.id];

    if (cdFnds === Infinity) {
      assert(cdEnsSS === Infinity && cdEnsBS === Infinity && cdNaive === Infinity,
        `Point ${pt.name} is consistently recognized as boundary (Infinity) across all algorithms`);
    } else {
      assert(Math.abs(cdFnds - cdEnsSS) < 1e-6 &&
             Math.abs(cdFnds - cdEnsBS) < 1e-6 &&
             Math.abs(cdFnds - cdNaive) < 1e-6,
        `Point ${pt.name} crowding distance matches across all engines: ${cdFnds.toFixed(4)}`);
    }
  }

  // 4. Sorted front order matches across all engines
  for (let k = 0; k < fndsRes.fronts.length; k++) {
    const orderFnds = fndsRes.fronts[k];
    const orderEnsSS = ensSSRes.fronts[k];
    assert(JSON.stringify(orderFnds) === JSON.stringify(orderEnsSS),
      `Front ${k + 1} crowding distance order matches between FNDS and ENS-SS: [${orderFnds.join(' ➔ ')}]`);
  }
  console.log('');
}

// 2. Random Population Stress Testing in 2D and 3D
console.log('Test Group 2: Random Population Robustness');
for (let rep = 1; rep <= 3; rep++) {
  const rand2D = generateRandomPopulation(15, 2);
  const fndsRand2D = generateFNDSSteps(rand2D);
  const ensRand2D = generateENSSteps(rand2D);

  assert(fndsRand2D.fronts.length === ensRand2D.fronts.length,
    `Random 2D run ${rep}: Same front count (${fndsRand2D.fronts.length})`);
  assert(Object.keys(fndsRand2D.crowdingDistances).length === 15,
    `Random 2D run ${rep}: All 15 points have crowding distances`);

  const rand3D = generateRandomPopulation(12, 3);
  const fndsRand3D = generateFNDSSteps(rand3D);
  const ensRand3D = generateENSSteps(rand3D);

  assert(fndsRand3D.fronts.length === ensRand3D.fronts.length,
    `Random 3D run ${rep}: Same front count (${fndsRand3D.fronts.length})`);
  assert(Object.keys(fndsRand3D.crowdingDistances).length === 12,
    `Random 3D run ${rep}: All 12 points have 3D crowding distances`);
}

// 3. Polynomial & Theoretical Bounds Integration
console.log('\nTest Group 3: Bell Polynomial Strings & Bounds Verification');
const poly4 = getBellPolynomialString(4);
assert(poly4.includes('24x_4'), `N=4 polynomial contains '24x_4': ${poly4}`);
const poly5 = getBellPolynomialString(5);
assert(poly5.includes('120x_5'), `N=5 polynomial contains '120x_5': ${poly5}`);

console.log('\n====================================================');
console.log(`INTEGRATION TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
