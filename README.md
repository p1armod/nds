# Non-dominated Sorting (NDS) - React Interactive Research Visualizer

An interactive, high-depth visualizer built with **React 18, Vite, and Lucide Icons** for **Pareto Dominance Theory and Non-dominated Sorting Algorithms**, strictly aligned with the research paper `NDS (1).pdf`.

---

## 🔬 Mathematical Rigor & Research Paper Grounding

1. **Definition 1 (Pareto Dominance $P_i \prec P_j$):**
   - Assumes all objectives are minimized:
     $$\forall m \in \{1, \dots, M\}, \quad P_{im} \le P_{jm} \quad \text{and} \quad \exists m \in \{1, \dots, M\}, \quad P_{im} < P_{jm}$$
   - Visually demonstrated via interactive **Dominance Cones (Orthants)** in 2D and **Dominance Octants** in 3D: hovering any point $P(x, y)$ shades the dominated quadrant $[x, \infty) \times [y, \infty)$.

2. **Section 2 (Properties of Dominance Relation):**
   - **Irreflexive:** $\neg(P \prec P)$
   - **Asymmetric:** $P \prec Q \implies \neg(Q \prec P)$
   - **Antisymmetric:** Dominance relation is strictly asymmetric.
   - **Transitive:** $(P \prec Q) \land (Q \prec R) \implies P \prec R$
   - **Negation Property:** $P \not\prec Q \implies (Q \prec P) \lor (P \parallel Q)$

3. **Section 3 (Domination Count $n_P$ & Table 1):**
   - Domination count: $n_P = |\{Q \in P \mid Q \prec P\}|$
   - **Theoretical Bounds (Eq. 7 & 8):**
     $$\text{DomCount}_{\min} = k - 1, \qquad \text{DomCount}_{\max} = \sum_{i=1}^{k-1} n_i$$
   - **Theorem 3:** Domination count is *not monotonic* with front rank ($n_P < n_{P'}$ is not always true for $P \in F_k, P' \in F_{k+1}$).

4. **Section 4 (Dominance Set $D_P / S_P$ & Table 2):**
   - Dominance set: $D_P = \{Q \in P \mid P \prec Q\}$
   - **Theoretical Bounds (Eq. 11 & 12):**
     $$\text{DomSet}_{\min} = K - k, \qquad \text{DomSet}_{\max} = \sum_{i=k+1}^K n_i$$
   - **Theorem 2:** Maximum cardinality of dominance set cannot exceed $N - 1$.

5. **Section 5 (Combinations of Non-dominated Fronts & Bell Polynomial):**
   - Total front partitionings equal the $N$-th ordered Bell number $B_N$.
   - **Bell Polynomial:**
     $$B_N(x_1, \dots, x_N) = \sum_{k=1}^N a_N^k x_k$$
   - **Recurrence Relation (Eq. 19 & NDF Triangle in Fig. 5):**
     $$a_N^k = k \times \left(a_{N-1}^{k-1} + a_{N-1}^k\right), \quad a_N^1 = 1, \quad a_N^N = N!$$
   - Interactive **NDF Triangle** component allows tracing this exact recurrence up to $N = 10$ with live parent-term decomposition.

6. **Sorting Algorithms Supported:**
   - **Fast Non-dominated Sort (FNDS / NSGA-II, Deb et al.):** Phase 1 computes pairwise matrix and counts in $O(MN^2)$; Phase 2 peels fronts by decrementing $n_Q$ as members of $F_k$ are retired.
   - **Efficient Non-dominated Sort - Sequential (ENS-SS, Zhang et al.):** Pre-sorts on $f_1$ ascending (with tie-breaking on $f_2 \dots f_M$); sequentially tests points against fronts in $O(KN)$ comparisons.
   - **Efficient Non-dominated Sort - Binary Search (ENS-BS, Zhang et al.):** Binary searches the front indices in $O(N \log K)$ front probes.
   - **Naive NDS (Deductive Sort):** Iteratively scans remaining population to peel non-dominated points.

---

## 🚀 Key Features

- **2D & 3D Interactive Canvas:**
  - **2D Mode:** Click to insert points, drag points to observe real-time front adaptation, shaded dominance cones, and pairwise comparison laser beams.
  - **3D Mode:** Full 3D perspective projection for 3-objective datasets ($f_1, f_2, f_3$) with orbit rotation, zoom, depth sorting, and 3D comparison lasers.
- **Visual, Step-by-Step Sorting:**
  Every single comparison between points is rendered live on canvas with an animated laser beam, inequality badges, and mathematical explanation. Domination counts flip and decrement in real-time.
- **Multi-Modal Data Input:**
  - **Direct Coordinate Entry:** Type coordinates ($f_1, f_2, f_3$) and add instantly.
  - **Interactive Canvas Insertion:** Click anywhere on the coordinate plane to drop points.
  - **Native Excel (.xlsx / .xls) Import:** Zero-dependency client-side unpacker using Web Streams `DecompressionStream`.
  - **CSV / TSV File Drop:** Drop or upload custom datasets.
  - **Clipboard Paste:** Copy cells from Excel or Google Sheets and paste directly.
  - **Sample Excel & CSV Downloads:** Download pre-formatted template spreadsheets matching Figure 1.
  - **Results Export:** Export the sorted dataset with front assignments, domination counts, and dominance sets to CSV.
- **Synchronized Analytical Workbench:**
  - **Dominance Poset DAG:** Hasse diagram with topological front tiers and transitive reduction.
  - **Tables 1 & 2 Live Matrix:** Exact replica of the paper's tables with theoretical bound verification.
  - **NDF Triangle & Bell Explorer:** Interactive recurrence visualizer matching Figure 5 of the paper.
  - **Research Paper Theory & Q&A:** In-depth answers and proofs for the 18 research questions in Section 6.

---

## 🛠️ Quick Start

### 1. Launch Dev Server
```bash
npm run dev -- --port 3000
```
Open [http://localhost:3000](http://localhost:3000) in any browser.

### 2. Run Test Suite
```bash
npm test
```
Executes all 52 automated tests verifying algorithmic outputs against Figure 1, Tables 1 & 2, and the NDF Triangle.

### 3. Build for Production
```bash
npm run build
```
Compiles optimized assets to `dist/`.
