import React from 'react';

export default function TheoryQA() {
  const qaList = [
    {
      num: 'Q1',
      question: 'Why cannot we directly use merge-sort, quick-sort, etc. for Non-dominated Sorting?',
      answer: `Standard comparison sorting algorithms require a <strong>total order</strong> (every pair of elements must satisfy a ≤ b or b ≤ a). Multi-objective Pareto dominance is only a <strong>partial order</strong>: two points can be mutually non-dominated (P ⊀ Q ∧ Q ⊀ P). If quicksort partitions around a pivot, it cannot decide whether incomparable points belong to the left or right partition, violating the comparison sort invariant.`
    },
    {
      num: 'Q2',
      question: 'What is the benefit of pre-sorting by objective 1 in Efficient Non-dominated Sort (ENS)?',
      answer: `Sorting points on <code>f1</code> ascending guarantees that for any point P_j examined after P_i, <code>P_j[0] ≥ P_i[0]</code>. Thus, <strong>a later point can never dominate an earlier point</strong>! When testing P_j against existing fronts, we only need to test one-way dominance (does Q ≺ P_j?), eliminating mutual checks and saving roughly 50% to 75% of dominance comparisons.`
    },
    {
      num: 'Q3',
      question: 'Maximum and minimum number of dominance comparisons in FNDS vs ENS?',
      answer: `In <strong>Fast Non-dominated Sort (FNDS / NSGA-II)</strong>: Always executes <code>O(M · N²)</code> comparisons in Phase 1 (specifically N(N - 1) pairwise dominance tests) regardless of the front structure.
      In <strong>ENS-SS / ENS-BS</strong>: Pre-sorting takes <code>O(N log N)</code>. In the best case (all non-dominated), ENS assigns every point to Front 1 with <code>O(N)</code> to <code>O(N log N)</code> comparisons. In the worst case (single chain), ENS-SS takes <code>O(K · N) = O(N²)</code>, while ENS-BS locates front indices via binary search in <code>O(N log K)</code> front probes.`
    },
    {
      num: 'Q4',
      question: 'Theorem 3: Why is dom_count(P ∈ F_k) < dom_count(P\' ∈ F_{k+1}) not always true?',
      answer: `As proven in Section 3.1.2: Minimum domination count for <code>F_{k+1}</code> is <code>k</code> (dominated by just one point in each preceding front), whereas maximum domination count for <code>F_k</code> is <code>∑_{i=1}^{k-1} n_i</code>. For example, if F1 had 10 points and P ∈ F2 was dominated by all 10, its count would be <code>10</code>. If another point P' ∈ F3 was dominated by only one point in F1 and one in F2, its count would be only <code>2</code>! Hence, front rank does not strictly order domination counts.`
    },
    {
      num: 'Q5',
      question: 'How is tie resolved in pre-sorting, and what happens if we only consider the first objective?',
      answer: `If two points have identical <code>f1</code> values, ties are resolved hierarchically by examining <code>f2, f3, ..., fM</code> sequentially. If tie-breaking were ignored and points with equal <code>f1</code> were arbitrarily ordered, an earlier point might have a worse <code>f2</code> and be dominated by a subsequent point with identical <code>f1</code>, violating the ENS invariant that subsequent points cannot dominate earlier ones!`
    },
    {
      num: 'Q6',
      question: 'Maximum and Minimum number of edges in the Dominance Graph?',
      answer: `Minimum edges: <code>0</code> (when all points are mutually non-dominated, forming an independent antichain).
      Maximum edges: <code>N(N - 1) / 2</code> when points form a strict total chain P1 ≺ P2 ≺ ... ≺ PN (a tournament DAG). In a Hasse diagram (transitive reduction), the maximum edges is bounded by bipartite layers <code>O(N²/4)</code>.`
    },
    {
      num: 'Q7',
      question: 'Given three points P, Q, R: Can P ∥ Q, Q ∥ R, but P ≺ R?',
      answer: `<strong>YES!</strong> Non-domination is <em>not transitive</em>. For example in 2D minimization: Let P = (1, 5), Q = (3, 3), and R = (5, 6).
      • P vs Q: P1 < Q1 (1 < 3) but P2 > Q2 (5 > 3) ➔ P ∥ Q (non-dominated).
      • Q vs R: Q1 < R1 (3 < 5) and Q2 < R2 (3 < 6) ➔ Actually Q ≺ R.
      Or consider P = (1, 5), Q = (4, 4), R = (2, 6):
      • P vs Q: (1 < 4) and (5 > 4) ➔ P ∥ Q.
      • Q vs R: (4 > 2) and (4 < 6) ➔ Q ∥ R.
      • P vs R: (1 < 2) and (5 < 6) ➔ <strong>P ≺ R</strong>!`
    },
    {
      num: 'Q8',
      question: 'Given 5 points, in how many different ways can they be sorted into non-dominated fronts?',
      answer: `From Section 5 and Figure 5: The total number of possible combinations of non-dominated fronts for N=5 points is given by the 5th Bell number (ordered Bell / Fubini number):
      <code>B_5 = 1 + 30 + 150 + 240 + 120 = 541 ways</code>!
      This is strictly larger than standard set partitions (Stirling numbers / standard Bell number B_5 = 52) because the fronts have a strict topological order (Front 1 is strictly superior to Front 2, Front 2 to Front 3, etc.).`
    },
    {
      num: 'Q9',
      question: 'What is Crowding Distance in NSGA-II and why do boundary solutions receive ∞?',
      answer: `All solutions within a non-dominated front are mutually non-dominating. To maintain diversity and avoid solution crowding along the Pareto frontier, <strong>NSGA-II (Deb et al., 2002)</strong> computes a <em>crowding distance</em>:
      • For each objective <code>m</code>, solutions in front <code>F</code> are sorted ascending.
      • Boundary solutions with the minimum and maximum objective values receive <code>∞</code>, guaranteeing they are preserved during selection to maintain the extreme boundaries of the Pareto front.
      • Intermediate solutions receive the normalized cuboid distance to their neighbors:
        <code>I_j[d] += (I_{j+1}[m] - I_{j-1}[m]) / (f_m^max - f_m^min)</code>.
      Solutions located in less dense regions have higher crowding distance and are prioritized.`
    },
    {
      num: 'Q10',
      question: 'How does the Crowded-Comparison Operator (≺_n) sort individuals in NSGA-II?',
      answer: `The <strong>crowded-comparison operator (≺_n)</strong> establishes a complete partial order across the entire population based on two criteria:
      1. <strong>Front Rank (Primary):</strong> Between two points P and Q, if <code>rank(P) < rank(Q)</code>, P is preferred (P ≺_n Q).
      2. <strong>Crowding Distance (Within-Front Tie-breaker):</strong> If P and Q share the same front (<code>rank(P) == rank(Q)</code>), then P is preferred if it has a <strong>higher crowding distance</strong>: <code>distance(P) > distance(Q)</code>.
      Sorting within each front by descending crowding distance naturally guides the population towards a well-distributed, non-clustered Pareto front.`
    }
  ];

  return (
    <div className="theory-container-panel">
      <div className="theory-scroll">
        <div className="theory-header-banner">
          <h3>Section 6: Research Questions &amp; Mathematical Invariants</h3>
          <p>
            Theoretical proofs, combinatorial complexity bounds, and order-theoretic properties analyzed in the research paper.
          </p>
        </div>

        {qaList.map((item, idx) => (
          <div key={idx} className="qa-card">
            <div className="qa-question">
              <span className="qa-num">{item.num}</span>
              <span>{item.question}</span>
            </div>
            <div
              className="qa-answer"
              dangerouslySetInnerHTML={{ __html: item.answer }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
