// PDE simulator core: density-scaled logistic growth with niche construction
// and an immune/predator response, plus 2D diffusion.
//
// Default ("density-scaled logistic") model implemented per simulator:
//   ∂N/∂t = D ∇²N + r * E_r * N * (1 - N / (K * E_K))
//          - (a * m_eff(E) * N) / (1 + a * h * N)
//   dE_r/dt = (1 - E_r) * (1 - exp(-b_r * N))
//   dE_K/dt = (1 - E_K) * (1 - exp(-b_K * N))
//   m_eff(E) = m0 / (1 + immuneEscape * E_avg)
//   E_avg = 0.5 * (E_r + E_K)
//
// Spatial units: the domain is the physical square [-halfWidth, halfWidth]^2
// split into gridSize x gridSize cells of side dx = 2 * halfWidth / gridSize,
// matching the CartesianGrid in coupled_pde/figures.ipynb. Lengths (seed
// radius, front radius) and areas are in these physical units, and the seed
// is normalized so that its integral (sum * dx^2) equals seedAmplitude.
//
// Integration: explicit forward Euler on a uniform grid with no-flux boundary.
// All fields are clamped to [0, K_max] for N and [0, 1] for E to keep the
// explicit scheme well-behaved.

export type PdeParams = {
  // grid + integration
  gridSize: number; // N x N cells
  dt: number; // integration timestep
  halfWidth: number; // domain is [-halfWidth, halfWidth]^2 in physical units

  // growth
  r: number; // intrinsic growth rate
  K: number; // carrying capacity (resource ceiling)

  // diffusion / motility
  D: number; // diffusion coefficient

  // niche construction
  b_r: number; // per-individual rate for E_r
  b_K: number; // per-individual rate for E_K
  E_r_init: number; // initial E_r (niche construction on growth rate)
  E_k_init: number; // initial E_k (niche construction on carrying capacity)

  // immune / predator response
  a: number; // encounter rate
  m0: number; // baseline lethality
  h: number; // handling time
  immuneEscape: number; // strength with which average E suppresses m_eff (>= 0)

  // initial seed
  seedRadius: number; // Gaussian radius r_s of the initial N blob (physical units)
  seedAmplitude: number; // initial total population: integral of N over the domain

};

export const defaultPdeParams: PdeParams = {
  gridSize: 240,
  dt: 0.001,
  halfWidth: 60,
  r: 0.5,
  K: 15.915,
  D: 0.35,
  b_r: 0.015,
  b_K: 0.015,
  E_r_init: 0.05,
  E_k_init: 0.05,
  a: 0.03,
  m0: 0.25,
  h: 0.05,
  immuneEscape: 0.5,
  seedRadius: 10,
  seedAmplitude: 100,
};

export type PdeField = Float32Array;

export type PdeState = {
  N: PdeField;
  Er: PdeField;
  Ek: PdeField;
  size: number;
  time: number;
  step: number;
};

export function makeField(size: number, fill = 0): PdeField {
  const f = new Float32Array(size * size);
  if (fill !== 0) f.fill(fill);
  return f;
}

export function idx(size: number, i: number, j: number) {
  return i * size + j;
}

// Physical side length of one grid cell.
export function cellSize(p: Pick<PdeParams, 'gridSize' | 'halfWidth'>): number {
  return (2 * p.halfWidth) / p.gridSize;
}

// Seed a Gaussian blob exp(-(r / r_s)^2) centered at the origin, in physical
// coordinates, scaled so that its integral equals seedAmplitude.
export function seedState(params: PdeParams): PdeState {
  const size = params.gridSize;
  const dx = cellSize(params);
  const N = makeField(size);
  const Er = makeField(size, params.E_r_init);
  const Ek = makeField(size, params.E_k_init);
  const c = (size - 1) / 2; // cell centers sit at x = (j - c) * dx
  const rs = Math.max(params.seedRadius, 1e-9);

  let sum = 0;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = (j - c) * dx;
      const y = (i - c) * dx;
      const v = Math.exp(-(x * x + y * y) / (rs * rs));
      N[idx(size, i, j)] = v;
      sum += v;
    }
  }
  const integral = sum * dx * dx;
  if (integral > 0) {
    const scale = params.seedAmplitude / integral;
    for (let k = 0; k < N.length; k++) N[k] *= scale;
  }

  return { N, Er, Ek, size, time: 0, step: 0 };
}

// 5-point Laplacian with no-flux (Neumann) boundary via index clamping.
function laplacianAt(field: PdeField, size: number, i: number, j: number, dx: number): number {
  // Mirror at boundary => no-flux
  const im = i > 0 ? i - 1 : i + 1; 
  const ip = i < size - 1 ? i + 1 : i - 1;
  const jm = j > 0 ? j - 1 : j + 1;
  const jp = j < size - 1 ? j + 1 : j - 1;
  const c = field[idx(size, i, j)];
  const up = field[idx(size, im, j)];
  const dn = field[idx(size, ip, j)];
  const lf = field[idx(size, i, jm)];
  const rt = field[idx(size, i, jp)];
  return (up + dn + lf + rt - 4 * c) / (dx * dx);
}

// One explicit Euler step in-place via swap buffers.
// Returns updated state (new buffers).
export function stepPde(state: PdeState, p: PdeParams): PdeState {
  const size = state.size;
  const { N, Er, Ek } = state;
  const Nn = new Float32Array(size * size);
  const Ern = new Float32Array(size * size);
  const Ekn = new Float32Array(size * size);

  const dt = p.dt;
  const dx = cellSize(p);
  const Kfloor = 1e-6;

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const k = idx(size, i, j);
      const ni = N[k];
      const er = Er[k];
      const ek = Ek[k];
      const eAvg = 0.5 * (er + ek);

      // diffusion
      const lap = laplacianAt(N, size, i, j, dx);
      const diff = p.D * lap;

      // growth
      const kEff = Math.max(p.K * ek, Kfloor);
      const growth = p.r * er * ni * (1 - ni / kEff);

      // immune / predator response (Holling type II)
      const mEff = p.m0 / (1 + p.immuneEscape * eAvg);
      const predation = (p.a * mEff * ni) / (1 + p.a * p.h * ni);

      const dN = diff + growth - predation;
      let nNext = ni + dt * dN;
      if (!Number.isFinite(nNext) || nNext < 0) nNext = 0;
      // soft clamp at 1.5 * K to keep the explicit scheme from blowing up
      const nCap = 1.5 * p.K;
      if (nNext > nCap) nNext = nCap;
      Nn[k] = nNext;

      // niche construction dynamics
      const driveR = (1 - er) * (1 - Math.exp(-p.b_r * ni));
      const driveK = (1 - ek) * (1 - Math.exp(-p.b_K * ni));
      const erNext = er + dt * driveR;
      const ekNext = ek + dt * driveK;
      Ern[k] = erNext;
      Ekn[k] = ekNext;
    }
  }

  return {
    N: Nn,
    Er: Ern,
    Ek: Ekn,
    size,
    time: state.time + dt,
    step: state.step + 1,
  };
}

// ---- Summary metrics ----

export type PdeSummary = {
  totalN: number; // integral of N over the domain (sum * dx^2)
  meanN: number; // mean density per cell
  meanE: number;
  occupiedArea: number; // physical area where N / (K E_K) > threshold
  frontRadius: number; // radius of the occupied region from the origin (physical units)
};

export function summarize(state: PdeState, p: PdeParams): PdeSummary {
  const { N, Er, Ek, size } = state;
  const dx = cellSize(p);
  let totalN = 0;
  let totalE = 0;
  let occ = 0;
  // Same threshold as the notebook's wavefront: N / (K E_K) > 0.1.
  const occThreshold = 0.1;
  let maxR2 = 0;
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const k = idx(size, i, j);
      totalN += N[k];
      totalE += 0.5 * (Er[k] + Ek[k]);
      if (N[k]/(Ek[k]*p.K) > occThreshold) {
        occ += 1;
        const di = i - cx;
        const dj = j - cy;
        const r2 = di * di + dj * dj;
        if (r2 > maxR2) maxR2 = r2;
      }
    }
  }
  const cells = size * size;
  return {
    totalN: totalN * dx * dx,
    meanN: totalN / cells,
    meanE: totalE / cells,
    occupiedArea: occ * dx * dx,
    frontRadius: Math.sqrt(maxR2) * dx,
  };
}

// ---- Colormap helpers ----

// Map a normalized value in [0,1] to an RGB color via a viridis-like ramp.
// Lightweight 5-stop piecewise-linear approximation.
const VIRIDIS_STOPS: Array<[number, number, number]> = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

export function viridis(t: number): [number, number, number] {
  if (!Number.isFinite(t)) t = 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const n = VIRIDIS_STOPS.length - 1;
  const s = t * n;
  const i = Math.min(Math.floor(s), n - 1);
  const f = s - i;
  const a = VIRIDIS_STOPS[i];
  const b = VIRIDIS_STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

// Magma-like ramp for PDE field visualizations.
const MAGMA_STOPS: Array<[number, number, number]> = [
  [0, 0, 4],
  [80, 18, 123],
  [182, 54, 121],
  [251, 136, 97],
  [252, 253, 191],
];

export function magma(t: number): [number, number, number] {
  if (!Number.isFinite(t)) t = 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const n = MAGMA_STOPS.length - 1;
  const s = t * n;
  const i = Math.min(Math.floor(s), n - 1);
  const f = s - i;
  const a = MAGMA_STOPS[i];
  const b = MAGMA_STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

// Render a field into an ImageData-compatible Uint8ClampedArray (RGBA).
// `vmax` is the value mapped to the top of the colormap; values are clamped.
export function fieldToRGBA(
  field: PdeField,
  size: number,
  vmax: number,
  cmap: (t: number) => [number, number, number],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const inv = vmax > 0 ? 1 / vmax : 1;
  for (let k = 0; k < field.length; k++) {
    const t = field[k] * inv;
    const [r, g, b] = cmap(t);
    const o = k * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}
