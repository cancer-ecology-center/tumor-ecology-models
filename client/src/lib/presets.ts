import type { Params } from './gfunction';

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  params: Params;
};

export const presets: Preset[] = [
  {
    id: 'stable-town',
    name: 'Prairie dog stable town',
    blurb:
      'Mature coterie network. Resources steady, predation low, public goods active. Cooperative interior strategy is favored.',
    params: {
      K: 500,
      alpha: 0.6,
      H: 1.1,
      D: 0.1,
      P: 0.5,
      edgeRisk: 0.4,
      motCost: 0.25,
      therapy: 0,
      u: 0.2,
      x: 380,
    },
  },
  {
    id: 'disturbed-expansion',
    name: 'Prairie dog disturbed expansion',
    blurb:
      'Recurrent disturbance (plague/fire) and habitat heterogeneity. Selection pushes toward dispersive edge phenotype.',
    params: {
      K: 600,
      alpha: 0.4,
      H: 0.6,
      D: 0.7,
      P: 0.15,
      edgeRisk: 0.08,
      motCost: 0.05,
      therapy: 0,
      u: 0.45,
      x: 180,
    },
  },
  {
    id: 'indolent-tumor',
    name: 'Indolent tumor',
    blurb:
      'Stable stromal niche, ample vasculature, low immune pressure. Cooperative low-motility clones dominate.',
    params: {
      K: 800,
      alpha: 0.7,
      H: 1.2,
      D: 0.08,
      P: 0.45,
      edgeRisk: 0.5,
      motCost: 0.3,
      therapy: 0,
      u: 0.18,
      x: 600,
    },
  },
  {
    id: 'aggressive-tumor',
    name: 'Aggressive invasive tumor',
    blurb:
      'Hypoxic, immune-pressured, vascularly unstable. Selection sweeps toward motile, edge-invasive phenotype.',
    params: {
      K: 700,
      alpha: 0.5,
      H: 0.3,
      D: 0.8,
      P: 0.05,
      edgeRisk: 0.05,
      motCost: 0.02,
      therapy: 0,
      u: 0.7,
      x: 220,
    },
  },
  {
    id: 'adaptive-therapy',
    name: 'Adaptive therapy steering',
    blurb:
      'Moderate therapy intensity favoring sensitive cooperative clones. Goal: contain x while preventing motile escape.',
    params: {
      K: 700,
      alpha: 0.75,
      H: 0.95,
      D: 0.2,
      P: 0.35,
      edgeRisk: 0.5,
      motCost: 0.3,
      therapy: 0.4,
      u: 0.4,
      x: 420,
    },
  },
];

export const defaultPreset = presets[0];
