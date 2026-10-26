/**
 * Master Test Runner for Non-Dominated Sorting (NDS) Research Platform
 * Executes:
 * 1. Paper Figure 1 & Theoretical Properties Test Suite (test_engine.js)
 * 2. NSGA-II Crowding Distance & Within-Front Sorting Test Suite (test_crowding_distance.js)
 * 3. Real File Upload, Excel Parsing & Parser Suite (test_file_uploads.js)
 * 4. Cross-Algorithm End-to-End Integration Suite (test_integration.js)
 */

console.log('####################################################');
console.log('#   STARTING COMPLETE NDS RESEARCH VERIFICATION    #');
console.log('####################################################\n');

try {
  await import('./test_engine.js');
  await import('./test_crowding_distance.js');
  await import('./test_file_uploads.js');
  await import('./test_integration.js');

  console.log('\n####################################################');
  console.log('#   ALL TEST SUITES EXECUTED AND FULLY VERIFIED    #');
  console.log('####################################################');
} catch (err) {
  console.error('\nTest Execution Error:', err);
  process.exit(1);
}
