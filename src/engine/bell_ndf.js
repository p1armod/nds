/**
 * Section 5: Combinations of Non-dominated Fronts & Bell Polynomial
 * Based on Equations 15-19 and Figure 5 of the research paper:
 * "Non-dominated Sorting"
 */

/**
 * Computes the NDF (Non-dominated front) Triangle up to maxN rows.
 * Recurrence (Eq. 19):
 * a_N^k = k * (a_{N-1}^{k-1} + a_{N-1}^k) for 2 <= k <= N - 1
 * Boundary:
 * a_N^1 = 1
 * a_N^N = N * a_{N-1}^{N-1} = N!
 *
 * @param {number} maxN - Maximum N (number of points)
 * @returns {Array<{ N: number, coefficients: number[], bellNumber: bigint|number, bellNumberStr: string }>}
 */
export function computeNdfTriangle(maxN = 10) {
  const table = [];

  for (let N = 1; N <= maxN; N++) {
    const row = new Array(N + 1).fill(0n);
    row[1] = 1n;

    if (N > 1) {
      const prevRow = table[N - 2].coeffsBigInt;
      row[N] = BigInt(N) * prevRow[N - 1];

      for (let k = 2; k < N; k++) {
        row[k] = BigInt(k) * (prevRow[k - 1] + prevRow[k]);
      }
    }

    let sum = 0n;
    const coeffsNumber = [];
    for (let k = 1; k <= N; k++) {
      sum += row[k];
      coeffsNumber.push(Number(row[k]));
    }

    table.push({
      N,
      coeffsBigInt: row,
      coefficients: coeffsNumber,
      bellNumber: sum,
      bellNumberStr: sum.toString()
    });
  }

  return table;
}

/**
 * Returns formatted Bell polynomial string for N points.
 * e.g., B_3(x) = x_1 + 6x_2 + 6x_3
 */
export function getBellPolynomialString(N) {
  const triangle = computeNdfTriangle(N);
  const row = triangle[N - 1];
  const terms = [];

  for (let k = 1; k <= N; k++) {
    const coeff = row.coefficients[k - 1];
    if (coeff === 1) {
      terms.push(`x_${k}`);
    } else {
      terms.push(`${coeff.toLocaleString()}x_${k}`);
    }
  }

  return `B_${N}(x) = ${terms.join(' + ')}`;
}
