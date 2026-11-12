import { defaultPdeParams, withDerivedK, type PdeParams } from './pde';

export type PdePreset = {
  id: string;
  name: string;
  blurb: string;
  params: PdeParams;
};

function mk(overrides: Partial<PdeParams>): PdeParams {
  // K is derived from the seed (K = kScaling * seed peak), as in figures.ipynb.
  return withDerivedK({ ...defaultPdeParams, ...overrides });
}

export const pdePresets: PdePreset[] = [
  {
    id: 'prairie-town',
    name: 'Baseline expansion',
    blurb:
      'Modest growth and motility, baseline predation. Town slowly spreads outward from a founding coterie.',
    params: mk({
      r: 0.5,
      D: 0.35,
      a: 0.03,
      m0: 0.25,
      h: 0.05,
      b_r: 0.015,
      b_K: 0.015,
      immuneEscape: 0.5,
      seedRadius: 10,
      seedAmplitude: 100,
    }),
  },
  // {
  //   id: 'indolent-tumor',
  //   name: 'Indolent tumor',
  //   blurb:
  //     'Slow growth, low motility, strong immune pressure. Bounded core that barely expands.',
  //   params: mk({
  //     r: 0.35,
  //     K: 80,
  //     D: 0.15,
  //     a: 0.03,
  //     m0: 0.45,
  //     h: 0.04,
  //     b_r: 0.01,
  //     b_K: 0.01,
  //     immuneEscape: 0.35,
  //     seedRadius: 4,
  //     seedAmplitude: 50,
  //   }),
  // },
  {
    id: 'aggressive-invasive',
    name: 'High motility + weak niche',
    blurb:
      'High growth and high motility. Rapid front propagation with weak immune containment.',
    params: mk({
      r: 0.95,
      D: 0.9,
      a: 0.03,
      m0: 0.25,
      h: 0.1,
      b_r: 0.005,
      b_K: 0.005,
      immuneEscape: 0.75,
      seedRadius: 10,
      seedAmplitude: 100,
    }),
  },
  {
    id: 'high-immune-pressure',
    name: 'High predation/immune pressure',
    blurb:
      'Strong immune attack, low escape. The lesion struggles to establish and may regress.',
    params: mk({
      r: 0.5,
      D: 0.35,
      a: 0.2,
      m0: 0.4,
      h: 0.02,
      b_r: 0.01,
      b_K: 0.01,
      immuneEscape: 0.1,
      seedRadius: 10,
      seedAmplitude: 100,
    }),
  },
  {
    id: 'high-niche-construction',
    name: 'Strong niche construction',
    blurb:
      'Strong ecological engineering. Niche construction quickly suppresses immune pressure and lifts carrying capacity.',
    params: mk({
      r: 0.13,
      D: 0.15,
      a: 0.03,
      m0: 0.25,
      h: 0.04,
      b_r: 0.1,
      b_K: 0.1,
      immuneEscape: 0.5,
      seedRadius: 10,
      seedAmplitude: 100,
    }),
  },
];

export const defaultPdePreset = pdePresets[0];
