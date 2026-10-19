# Prairie Dogs — Cancer-Ecology Simulators

**Live demo (G-function):** https://cancer-ecology-center.github.io/tumor-ecology-models/
**Live demo (PDE spread):** https://cancer-ecology-center.github.io/tumor-ecology-models/#/PDE

Two interactive simulators that use a prairie dog town as a mesoscopic ecological analog for a tumor:

1. A **G-function simulator** (Vincent & Brown) — non-spatial adaptive dynamics over a single strategy axis (route `#/`).
2. A **PDE spread simulator** — 2-D logistic growth with niche construction, an immune/predator response, and diffusion, integrated on a grid (route `#/pde`).

Both are teaching tools and companions to an in-preparation manuscript on ecology-guided thinking in cancer dynamics and adaptive therapy. The header of each page links to the other simulator.

## Scientific framing

Tumors are not just collections of mutated cells — they are ecological communities whose fate is shaped by density, resource limitation, public goods, predation/therapy, and trade-offs between staying put and dispersing. Prairie dog (*Cynomys* spp.) towns are a tractable mesoscopic analog: a spatially structured population of social rodents balancing philopatric cooperation in the colony interior against riskier dispersal at the edge, with public-good behaviors (alarm calls, burrow maintenance) and area-effect disturbances (plague, predation) acting on the whole town.

Mapping the analogy:

| Prairie dog town | Tumor |
|---|---|
| Interior, philopatric, cooperative individuals | Indolent / well-bounded clonal core |
| Edge / dispersing individuals | Invasive front, motile / metastatic phenotype |
| Alarm calls, shared burrow upkeep | Diffusible public goods (growth factors, vasculature) |
| Plague / predation pulses | Immune pressure, chemotherapy / radiation |
| Forage quality, soil | Vascularity, nutrients, stromal support |

The simulator lets a user drive a population's mean strategy `u` along the selection gradient of a Vincent & Brown G-function and watch ESS-like attractors, directional selection, and branching pressure emerge from interpretable ecological parameters.

## Model — toy G-function `G(v; u, x, E)`

The per-capita fitness of a focal phenotype `v` in a resident population of mean strategy `u` and density `x`, in environment `E`, is:

```
G(v; u, x, E) = r0(v, H) · (1 − x/K)
              − α · overlap(v, u) · (x/K)
              + P · (1 − v) · min(1, x/K)
              − D · (1 − 0.6 v)
              − (edgeRisk · v² + motCost · v)
              − therapy · (0.3 + 0.7 v)
```

where `r0(v, H) = 0.6 + 0.6 · H · (1 − 0.5 v)` and `overlap(v, u) = exp(−((v − u)/0.35)²)`.

**Variables**

- `v` — focal strategy in [0, 1]. `0` = philopatric / interior / cooperative; `1` = motile / edge / competitive.
- `u` — resident (population mean) strategy in [0, 1].
- `x` — population size (town occupancy / scaled tumor cell count).

**Environment `E`**

- `K` — carrying capacity (resource ceiling).
- `α` (`alpha`) — competitive overlap intensity between focal and resident strategies.
- `H` — habitat quality (forage / vascularity / stromal support).
- `D` — area-effect disturbance frequency (plague, immune pulses, baseline therapy pressure).
- `P` — public-goods benefit shared by cooperative phenotypes (alarm calls, diffusibles); diluted by motile fraction and saturating in `x`.
- `edgeRisk` — quadratic penalty for adopting the edge / motile phenotype.
- `motCost` — linear energetic / fitness cost of motility.
- `therapy` — therapy intensity, selecting more strongly against proliferative / motile phenotypes.

The adaptive dynamics step advances `u` along the selection gradient `∂G/∂v` evaluated at `v = u`, and updates `x` by an ecological response proportional to `G(u; u, x, E) · x`. See [`client/src/lib/gfunction.ts`](client/src/lib/gfunction.ts) for the exact implementation.

## PDE spread simulator — 2-D field model

The PDE simulator (route `#/pde`) treats `N(x, y, t)` as a population/cancer-cell density on a 2-D grid and integrates logistic growth with niche construction, an immune/predator response, and diffusion. The equation in the attached manuscript draft is:

```
dN/dt = r E_r ((K E_K − N) / (K E_K)) − a m / (1 + a h N)
dE_i/dt = (1 − E_i)(1 − exp(−b_i N(x, y)))
```

The simulator defaults to a **density-scaled logistic** interpretation (recommended) so empty cells stay empty:

```
∂N/∂t = D ∇²N
       + r E_r N (1 − N / (K E_K))
       − (a · m_eff(E) · N) / (1 + a h N)

m_eff(E) = m₀ / (1 + immuneEscape · E_avg),  E_avg = (E_r + E_K) / 2
dE_r/dt  = b_r (1 − E_r)(1 − exp(−b_r N))
dE_K/dt  = b_K (1 − E_K)(1 − exp(−b_K N))
```

**Integration.** Explicit forward Euler on a uniform grid with no-flux (Neumann) boundary conditions and a 5-point Laplacian. `N` is clamped to `[0, 1.5 K]` and `E_{r,K}` to `[0, 1]` to keep the explicit scheme stable. Implementation lives in [`client/src/lib/pde.ts`](client/src/lib/pde.ts).

**UI features.** Heatmaps for `N`, `E_r`, and `E_K`; line plots for total `N`, occupied area, front radius, and mean `E`; sliders for every model parameter (`r, K, D, b_r, b_K, a, m₀, h, immuneEscape, E₀, seed radius, seed amplitude, dt, steps-per-frame, grid size`); presets for prairie dog town expansion, indolent tumor, aggressive invasive tumor, high immune pressure, and high niche construction / immune escape.

**Variable mapping (cancer ↔ prairie dog).**

| Symbol | Prairie dog | Tumor |
|---|---|---|
| `N` | Town occupancy / density | Cancer cell density |
| `E_r, E_K` | Habitat engineering, burrow upkeep | Niche construction, stromal remodeling |
| `D` | Dispersal / motility | Cell motility / invasion coefficient |
| `K` | Resource ceiling | Tissue carrying capacity |
| `a, m₀, h` | Predator encounter, lethality, handling | Immune effector encounter, lethality, handling |
| `immuneEscape` | Refuges that reduce predation pressure | Niche construction that blunts immune attack |

## Figure download / export

Both simulators include a **"Figure PNG"** button (next to the Run / Step / Reset controls) that downloads the current result as a PNG image — useful for slides, lab notebooks, or manuscript figures.

- **G-function simulator** (`#/`) captures the named figure region — the summary readouts, the fitness landscape `G(v; u, x, E)`, and the `u(t)`, `x(t)`, and `G(u, t)` trajectory plots — into `prairie-dogs-gfunction-result.png`.
- **PDE spread simulator** (`#/pde`) captures the `N` density heatmap with its current-parameter readout panel, the `E_r` and `E_K` niche-construction heatmaps, and the summary trajectory plots into `prairie-dogs-pde-result.png`.

The export is fully client-side (via [`html-to-image`](https://github.com/bubkoo/html-to-image)), so it works on the static GitHub Pages deployment with no backend and no use of cookies or local/session storage. It captures a named figure container rather than the whole page; the long model-notes / mapping sections below each figure are intentionally excluded to keep the exported image focused on the visualization. Mixed SVG + `<canvas>` content (the PDE heatmaps) is embedded directly, and the canvases are painted from in-memory pixel data so there are no cross-origin tainting issues. Success and failure are reported via a toast notification.

## Scope and disclaimer

Both simulators are **teaching and manuscript-companion tools**. The G-function is deliberately toy-scale and interpretable; the PDE model is a stable, transparent explicit-finite-difference scheme rather than a calibrated PDE solver. Parameters are not fit to any patient cohort, tumor model, or empirical prairie dog data. **Do not treat outputs as clinically calibrated predictions.** The intent is to build intuition about how ecological trade-offs and spatial dynamics shape evolutionary and ecological behavior in a tumor-like system.

## Local development

Requires Node.js (matching the version in `package.json` engines / `@types/node`).

```sh
npm ci              # reproducible install from package-lock.json
npm run dev         # full dev server (Express + Vite middleware)
npm run build       # full-stack build
npm run check       # TypeScript typecheck
```

### Deployment (prod + preview)

`.github/workflows/pages.yml` runs on every push to `main` or `dev` (and manually via `workflow_dispatch`). It builds both branches and publishes a single Pages site:

- `main` → https://cancer-ecology-center.github.io/tumor-ecology-models/ (built with `BASE_PATH=/tumor-ecology-models/`)
- `dev` → https://cancer-ecology-center.github.io/tumor-ecology-models/preview/ (built with `BASE_PATH=/tumor-ecology-models/preview/`)

If the `dev` branch does not exist, only the prod site is published. The Vite `base` is read from `BASE_PATH` in `vite.config.ts`; routing uses hash URLs (`wouter` + `useHashLocation`), so no router basename or `404.html` fallback is needed.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-run the latest workflow from the Actions tab.

## Citing this work

If you use this simulator in teaching, talks, or derivative work, please cite the foundational literature alongside this repository:

- **G-function formalism.** Vincent, T. L. & Brown, J. S. *Evolutionary Game Theory, Natural Selection, and Darwinian Dynamics.* Cambridge University Press, 2005.
- **Cancer ecology and adaptive therapy.** Gatenby, R. A., Silva, A. S., Gillies, R. J. & Frieden, B. R. *Adaptive therapy.* Cancer Research 69, 4894–4903 (2009). See also Gatenby & Brown, *Integrating evolutionary dynamics into cancer therapy*, Nat. Rev. Clin. Oncol. (2020).
- **Prairie dog ecology.** Hoogland, J. L. *The Black-Tailed Prairie Dog: Social Life of a Burrowing Mammal.* University of Chicago Press, 1995.

Suggested citation for the simulator itself:

> Pienta, K. *Prairie Dogs — G-function Cancer-Ecology Simulator* (2026). https://github.com/kpienta-cloud/Prairie-Dogs

A formal manuscript is in preparation; please cite it in addition to this repository once published.

## License

Released under the **MIT License** (see `package.json`). Attribution to the repository and the citations above is appreciated when this tool is used in teaching, talks, or derivative scientific work.
