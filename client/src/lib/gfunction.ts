// Vincent & Brown G-function (toy, interpretable)
// Strategy v in [0,1]: 0 = cooperative / philopatric / interior;
//                       1 = motile / competitive / edge.
// Resident strategy u (population mean strategy in [0,1]).
// State x = population size (town occupancy / tumor cell count, scaled).
// Environment E: { K, alpha, H, D, P, edgeRisk, motCost, therapy }.
//   K          carrying capacity (resource ceiling)
//   alpha      competitive overlap with resident
//   H          habitat quality (forage / vascularity)
//   D          disturbance frequency (predation / immune / therapy pulses)
//   P          public-goods benefit (alarm calls / shared diffusibles)
//   edgeRisk   penalty for edge / motile phenotype
//   motCost    energetic / fitness cost of being motile
//   therapy    therapy intensity (selective against motile/edge)

export type Env = {
  K: number;        //  10..1000
  alpha: number;    //  0..1.5
  H: number;        //  0..1.5
  D: number;        //  0..1
  P: number;        //  0..1
  edgeRisk: number; //  0..1
  motCost: number;  //  0..1
  therapy: number;  //  0..1
};

export type Params = Env & {
  u: number; // resident strategy
  x: number; // current population
};

// Effective competition coefficient between focal v and resident u.
// More overlap when v ≈ u; alpha scales the global intensity.
export function competition(v: number, u: number, alpha: number): number {
  const overlap = Math.exp(-Math.pow((v - u) / 0.35, 2));
  return alpha * overlap;
}

// Habitat suitability for strategy v.
// Cooperative/interior strategies (v low) gain more from habitat quality H
// (forage / vascular support); motile (v high) gain less.
export function habitat(v: number, H: number): number {
  return H * (1 - 0.5 * v);
}

// Public goods bonus: shared by cooperative phenotypes; diluted by motile.
// Bonus saturates with population x (more cooperators → more public good).
export function publicGoods(v: number, x: number, K: number, P: number): number {
  const cooperativeFraction = 1 - v;
  const density = Math.min(1, x / Math.max(1, K));
  return P * cooperativeFraction * density;
}

// Disturbance penalty: cooperative/interior strategies more exposed to
// area-effect disturbance (plague, fire, necrosis). Motile/edge less exposed
// because they disperse, but edge has its own risk (next term).
export function disturbance(v: number, D: number): number {
  return D * (1 - 0.6 * v);
}

// Edge / motility intrinsic cost.
export function motilityCost(v: number, edgeRisk: number, motCost: number): number {
  return edgeRisk * v * v + motCost * v;
}

// Therapy-induced selection: pulses harm proliferative/motile phenotypes more.
export function therapySelection(v: number, therapy: number): number {
  return therapy * (0.3 + 0.7 * v);
}

// Per-capita fitness G(v; u, x, E).
// Logistic baseline: r0 * (1 - x/K) with strategy- and env-modulated terms.
export function G(v: number, p: Params): number {
  const r0 = 0.6 + 0.6 * habitat(v, p.H);
  const logistic = r0 * (1 - p.x / Math.max(1, p.K));
  const comp = competition(v, p.u, p.alpha) * (p.x / Math.max(1, p.K));
  const pg = publicGoods(v, p.x, p.K, p.P);
  const dist = disturbance(v, p.D);
  const cost = motilityCost(v, p.edgeRisk, p.motCost);
  const tx = therapySelection(v, p.therapy);
  return logistic - comp + pg - dist - cost - tx;
}

// Numerical derivative dG/dv at v=u.
export function dGdv_atU(p: Params, h = 1e-3): number {
  const v = p.u;
  const a = Math.min(1, v + h);
  const b = Math.max(0, v - h);
  return (G(a, p) - G(b, p)) / (a - b);
}

// Find adaptive best response v* on a grid.
export function bestResponse(p: Params, n = 201): { vStar: number; gStar: number } {
  let vStar = 0;
  let gStar = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = i / (n - 1);
    const g = G(v, p);
    if (g > gStar) {
      gStar = g;
      vStar = v;
    }
  }
  return { vStar, gStar };
}

// Sample G across v for plotting.
export function sampleLandscape(p: Params, n = 121): { v: number; g: number }[] {
  const out: { v: number; g: number }[] = [];
  for (let i = 0; i < n; i++) {
    const v = i / (n - 1);
    out.push({ v, g: G(v, p) });
  }
  return out;
}

// One adaptive-dynamics step: u advances along selection gradient at v=u;
// x updates by logistic-style ecological response from G(u).
export function step(
  p: Params,
  uStepSize = 0.04,
  xStepSize = 0.25
): { u: number; x: number; gAtU: number; grad: number } {
  const grad = dGdv_atU(p);
  let uNext = p.u + uStepSize * grad;
  if (uNext < 0) uNext = 0;
  if (uNext > 1) uNext = 1;
  const gAtU = G(p.u, p);
  let xNext = p.x + xStepSize * gAtU * p.x;
  if (xNext < 0.01) xNext = 0.01;
  if (xNext > p.K * 1.5) xNext = p.K * 1.5;
  return { u: uNext, x: xNext, gAtU, grad };
}

// Stability classifier near current u.
export function stabilityLabel(p: Params): {
  label: string;
  tone: 'stable' | 'directional' | 'disruptive';
} {
  const { vStar } = bestResponse(p);
  const gap = Math.abs(vStar - p.u);
  // Second derivative at u (curvature) tells us if u is near a peak.
  const h = 0.02;
  const a = G(Math.min(1, p.u + h), p);
  const b = G(Math.max(0, p.u - h), p);
  const c = G(p.u, p);
  const curvature = (a - 2 * c + b) / (h * h);
  // Boundary attractor: if v* is at the boundary and u is near it.
  if ((vStar < 0.02 || vStar > 0.98) && gap < 0.04) {
    return { label: 'Boundary attractor (' + (vStar < 0.5 ? 'cooperative' : 'motile') + ' edge)', tone: 'stable' };
  }
  if (gap < 0.03 && curvature < -0.05) {
    return { label: 'Convergent stable strategy (ESS-like)', tone: 'stable' };
  }
  if (gap < 0.05) {
    return { label: 'Near singular strategy — drifting', tone: 'directional' };
  }
  // Disruptive only if curvature is meaningfully positive AND there is an interior peak.
  if (curvature > 0.4 && vStar > 0.05 && vStar < 0.95) {
    return { label: 'Disruptive selection — branching pressure', tone: 'disruptive' };
  }
  return {
    label: vStar > p.u ? 'Directional selection toward motile' : 'Directional selection toward cooperative',
    tone: 'directional',
  };
}

export function phenotypeLabel(u: number): string {
  if (u < 0.18) return 'Philopatric, interior, cooperative';
  if (u < 0.38) return 'Mostly cooperative with mild dispersal';
  if (u < 0.55) return 'Mixed / generalist';
  if (u < 0.78) return 'Dispersive, edge-biased, competitive';
  return 'Highly motile / invasive';
}

export function tumorLabel(u: number): string {
  if (u < 0.18) return 'Indolent, well-bounded clonal core';
  if (u < 0.38) return 'Slowly proliferative, low invasion';
  if (u < 0.55) return 'Heterogeneous, partially invasive';
  if (u < 0.78) return 'Invasive front, high motility';
  return 'Aggressive, dispersing micrometastases';
}
