import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Play, Pause, RotateCcw, StepForward, ImageDown } from 'lucide-react';
import { exportNodeToPng } from '@/lib/exportFigure';
import { useToast } from '@/hooks/use-toast';
import {
  defaultPdeParams,
  fieldToRGBA,
  magma,
  seedState,
  stepPde,
  summarize,
  viridis,
  type PdeParams,
  type PdeState,
  type PdeSummary,
} from '@/lib/pde';
import { pdePresets, defaultPdePreset } from '@/lib/pdePresets';

// ---- Heatmap ----

function Heatmap({
  state,
  field,
  vmax,
  cmap,
  testId,
  ariaLabel,
}: {
  state: PdeState;
  field: 'N' | 'Er' | 'Ek' | 'Eavg';
  vmax: number;
  cmap: (t: number) => [number, number, number];
  testId: string;
  ariaLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displaySize = 360;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = state.size;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let f: Float32Array;
    if (field === 'N') f = state.N;
    else if (field === 'Er') f = state.Er;
    else if (field === 'Ek') f = state.Ek;
    else {
      f = new Float32Array(size * size);
      for (let k = 0; k < f.length; k++) f[k] = 0.5 * (state.Er[k] + state.Ek[k]);
    }
    const data = fieldToRGBA(f, size, vmax, cmap);
    const img = new ImageData(data, size, size);
    ctx.putImageData(img, 0, 0);
  }, [state, field, vmax, cmap]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      style={{
        width: displaySize,
        height: displaySize,
        imageRendering: 'pixelated',
        background: '#000',
        borderRadius: 8,
        display: 'block',
      }}
    />
  );
}

// ---- Time-series line chart (lightweight SVG) ----

type SeriesPt = { x: number; y: number };

function MiniLine({
  data,
  width,
  height,
  label,
  color,
  testId,
}: {
  data: SeriesPt[];
  width: number;
  height: number;
  label: string;
  color: string;
  testId: string;
}) {
  const pad = { l: 44, r: 8, t: 12, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const yMin = ys.length ? Math.min(...ys, 0) : 0;
  const yMaxRaw = ys.length ? Math.max(...ys, 1e-6) : 1;
  const yMax = yMaxRaw === yMin ? yMaxRaw + 1 : yMaxRaw;
  const xS = (x: number) => pad.l + ((x - xMin) / Math.max(xMax - xMin, 1e-9)) * w;
  const yS = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * h;
  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xS(d.x).toFixed(2)} ${yS(d.y).toFixed(2)}`)
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={label}
      data-testid={testId}
    >
      <text x={8} y={14} className="text-[10px] fill-muted-foreground">{label}</text>
      <rect
        x={pad.l}
        y={pad.t}
        width={w}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.15}
      />
      <text x={pad.l - 6} y={pad.t + 8} textAnchor="end" className="text-[9px] fill-muted-foreground">
        {yMax.toFixed(2)}
      </text>
      <text
        x={pad.l - 6}
        y={pad.t + h}
        textAnchor="end"
        className="text-[9px] fill-muted-foreground"
      >
        {yMin.toFixed(2)}
      </text>
      <text x={pad.l} y={height - 6} className="text-[9px] fill-muted-foreground">
        t={xMin.toFixed(1)}
      </text>
      <text
        x={pad.l + w}
        y={height - 6}
        textAnchor="end"
        className="text-[9px] fill-muted-foreground"
      >
        t={xMax.toFixed(1)}
      </text>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ---- Slider row helper ----

function SliderRow({
  label,
  prairie,
  tumor,
  value,
  min,
  max,
  step,
  onChange,
  testId,
  format,
}: {
  label: string;
  prairie: string;
  tumor: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  testId: string;
  format?: (v: number) => string;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label
              htmlFor={`pde-slider-${testId}`}
              className="text-xs font-medium cursor-help"
              data-testid={`label-${testId}`}
            >
              {label}
            </Label>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs grid gap-1">
              <div><span className="font-semibold">Prairie:</span> {prairie}</div>
              <div><span className="font-semibold">Tumor:</span> {tumor}</div>
            </div>
          </TooltipContent>
        </Tooltip>
        <span
          className="text-xs tabular-nums text-muted-foreground"
          data-testid={`value-${testId}`}
        >
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <Slider
        id={`pde-slider-${testId}`}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        data-testid={`slider-${testId}`}
        aria-label={label}
      />
    </div>
  );
}

// ---- Page ----

export default function PdeSimulator() {
  const [presetId, setPresetId] = useState<string>(defaultPdePreset.id);
  const [params, setParams] = useState<PdeParams>(defaultPdePreset.params);
  const [state, setState] = useState<PdeState>(() => seedState(defaultPdePreset.params));
  const [running, setRunning] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(2);
  const [exporting, setExporting] = useState(false);
  const figureRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const [seriesTotalN, setSeriesTotalN] = useState<SeriesPt[]>([]);
  const [seriesOcc, setSeriesOcc] = useState<SeriesPt[]>([]);
  const [seriesMeanE, setSeriesMeanE] = useState<SeriesPt[]>([]);
  const [seriesFront, setSeriesFront] = useState<SeriesPt[]>([]);

  const summary: PdeSummary = useMemo(() => summarize(state, params), [state, params]);

  // animation loop
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      setState((prev) => {
        let s = prev;
        for (let k = 0; k < stepsPerFrame; k++) s = stepPde(s, params);
        const sum = summarize(s, params);
        setSeriesTotalN((arr) => trimSeries([...arr, { x: s.time, y: sum.totalN }]));
        setSeriesOcc((arr) => trimSeries([...arr, { x: s.time, y: sum.occupiedArea }]));
        setSeriesMeanE((arr) => trimSeries([...arr, { x: s.time, y: sum.meanE }]));
        setSeriesFront((arr) => trimSeries([...arr, { x: s.time, y: sum.frontRadius }]));
        return s;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, params, stepsPerFrame]);

  function manualStep() {
    setState((prev) => {
      const s = stepPde(prev, params);
      const sum = summarize(s, params);
      setSeriesTotalN((arr) => trimSeries([...arr, { x: s.time, y: sum.totalN }]));
      setSeriesOcc((arr) => trimSeries([...arr, { x: s.time, y: sum.occupiedArea }]));
      setSeriesMeanE((arr) => trimSeries([...arr, { x: s.time, y: sum.meanE }]));
      setSeriesFront((arr) => trimSeries([...arr, { x: s.time, y: sum.frontRadius }]));
      return s;
    });
  }

  function resetState(nextParams: PdeParams = params) {
    setRunning(false);
    const s = seedState(nextParams);
    setState(s);
    const sum = summarize(s, nextParams);
    setSeriesTotalN([{ x: 0, y: sum.totalN }]);
    setSeriesOcc([{ x: 0, y: sum.occupiedArea }]);
    setSeriesMeanE([{ x: 0, y: sum.meanE }]);
    setSeriesFront([{ x: 0, y: sum.frontRadius }]);
  }

  function applyPreset(id: string) {
    const p = pdePresets.find((q) => q.id === id);
    if (!p) return;
    setPresetId(id);
    setParams(p.params);
    resetState(p.params);
  }

  function update<K extends keyof PdeParams>(key: K, value: PdeParams[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  async function downloadFigure() {
    if (exporting) return;
    setExporting(true);
    const result = await exportNodeToPng(
      figureRef.current,
      'prairie-dogs-pde-result.png',
    );
    setExporting(false);
    if (result.ok) {
      toast({
        title: 'Figure downloaded',
        description: 'Saved prairie-dogs-pde-result.png',
      });
    } else {
      toast({
        title: 'Figure export failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  }

  // vmax for heatmaps (N capped at 1.5 * K to match clamp)
  const nVmax = Math.max(params.K * 1.0, 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              aria-label="PDE simulator logo"
              className="shrink-0"
            >
              <rect x="3" y="3" width="26" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="3" fill="currentColor" />
              <circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" strokeOpacity={0.55} />
              <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeOpacity={0.3} />
            </svg>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight truncate">
                PDE Spread Simulator
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight truncate">
                2-D logistic growth + niche construction + immune response
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2" aria-label="Simulator navigation">
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-md border border-border hover-elevate"
              data-testid="link-gfunction"
            >
              G-function
            </Link>
            <span
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
              data-testid="link-pde-active"
              aria-current="page"
            >
              PDE
            </span>
            <Badge variant="secondary" className="hidden md:inline-flex text-[10px]">
              teaching · manuscript companion
            </Badge>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* CONTROLS */}
        <section className="grid gap-4" aria-label="PDE simulation controls">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preset scenarios</CardTitle>
              <CardDescription className="text-xs">
                Each preset seeds parameters and resets the field.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Select value={presetId} onValueChange={applyPreset}>
                <SelectTrigger data-testid="select-pde-preset" aria-label="PDE preset scenario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pdePresets.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      data-testid={`pde-preset-option-${p.id}`}
                    >
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                className="text-xs text-muted-foreground"
                data-testid="text-pde-preset-blurb"
              >
                {pdePresets.find((p) => p.id === presetId)?.blurb}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setRunning((r) => !r)}
                  data-testid="button-pde-run-pause"
                  aria-label={running ? 'Pause simulation' : 'Run simulation'}
                >
                  {running ? <Pause className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                  {running ? 'Pause' : 'Run'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={manualStep}
                  data-testid="button-pde-step"
                  aria-label="Step one PDE timestep"
                >
                  <StepForward className="size-3.5 mr-1" />
                  Step
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetState()}
                  data-testid="button-pde-reset"
                  aria-label="Reset PDE field"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadFigure}
                  disabled={exporting}
                  data-testid="button-pde-download-figure"
                  aria-label="Download figure as PNG"
                >
                  <ImageDown className="size-3.5 mr-1" />
                  {exporting ? 'Saving…' : 'Figure PNG'}
                </Button>
              </div>
              <p
                className="sr-only"
                role="status"
                aria-live="polite"
                data-testid="status-pde-figure-export"
              >
                {exporting ? 'Generating figure PNG…' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Growth &amp; spread</CardTitle>
              <CardDescription className="text-xs">
                Logistic growth and diffusion.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SliderRow
                label="Growth rate (r)"
                prairie="Reproductive rate of the colony per generation."
                tumor="Intrinsic proliferation rate of cancer cells."
                value={params.r}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => update('r', v)}
                testId="r"
              />
              <SliderRow
                label="Carrying capacity (K)"
                prairie="Town resource ceiling — forage, soil, burrow space."
                tumor="Tissue carrying capacity — vasculature, mechanical room."
                value={params.K}
                min={20}
                max={300}
                step={1}
                onChange={(v) => update('K', v)}
                testId="K"
                format={(v) => v.toFixed(0)}
              />
              <SliderRow
                label="Diffusion (D) — motility"
                prairie="Dispersal of individuals across space."
                tumor="Cell motility / invasion coefficient."
                value={params.D}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => update('D', v)}
                testId="D"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Niche construction (E)</CardTitle>
              <CardDescription className="text-xs">
                Habitat engineering that modifies r and K and reduces immune pressure.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SliderRow
                label="Construction rate for r (b_r)"
                prairie="How fast a coterie improves local conditions for growth."
                tumor="How fast cancer cells engineer growth-favoring niche."
                value={params.b_r}
                min={0}
                max={0.1}
                step={0.001}
                onChange={(v) => update('b_r', v)}
                testId="b_r"
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Construction rate for K (b_K)"
                prairie="How fast a coterie expands resource ceiling."
                tumor="How fast cancer cells engineer expansion of tissue capacity."
                value={params.b_K}
                min={0}
                max={0.1}
                step={0.001}
                onChange={(v) => update('b_K', v)}
                testId="b_K"
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Initial E_r (E₀ᵣ)"
                prairie="Pre-existing burrow / habitat quality."
                tumor="Pre-existing stromal / niche favorability."
                value={params.E_r_init}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('E_r_init', v)}
                testId="E_r_init"
              />
              <SliderRow
                label="Initial E_k (E₀ₖ)"
                prairie="Pre-existing burrow / habitat quality."
                tumor="Pre-existing stromal / niche favorability."
                value={params.E_k_init}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('E_k_init', v)}
                testId="E_k_init"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Immune / predator response</CardTitle>
              <CardDescription className="text-xs">
                Holling type II functional response.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SliderRow
                label="Encounter rate (a)"
                prairie="Predator encounter rate with prey."
                tumor="Immune effector encounter rate with cancer cells."
                value={params.a}
                min={0}
                max={0.1}
                step={0.001}
                onChange={(v) => update('a', v)}
                testId="a"
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Predator lethality (m₀)"
                prairie="Baseline lethality of predators / plague."
                tumor="Baseline lethality of immune cells / therapy."
                value={params.m0}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => update('m0', v)}
                testId="m0"
              />
              <SliderRow
                label="Handling time (h)"
                prairie="Per-prey handling/recovery time for predator."
                tumor="Per-cell handling time for immune effector."
                value={params.h}
                min={0}
                max={0.5}
                step={0.005}
                onChange={(v) => update('h', v)}
                testId="h"
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Immune escape (via E)"
                prairie="Niche reduces predation pressure (refuges)."
                tumor="Niche construction reduces immune effectiveness."
                value={params.immuneEscape}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('immuneEscape', v)}
                testId="immuneEscape"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Initial seed &amp; integration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SliderRow
                label="Seed radius (cells)"
                prairie="Founding coterie size."
                tumor="Initial lesion radius."
                value={params.seedRadius}
                min={1}
                max={20}
                step={1}
                onChange={(v) => update('seedRadius', v)}
                testId="seedRadius"
                format={(v) => v.toFixed(0)}
              />
              <SliderRow
                label="Seed amplitude (N₀ at center)"
                prairie="Initial density at the founding center."
                tumor="Initial cell density at lesion core."
                value={params.seedAmplitude}
                min={1}
                max={200}
                step={1}
                onChange={(v) => update('seedAmplitude', v)}
                testId="seedAmplitude"
                format={(v) => v.toFixed(0)}
              />
              <SliderRow
                label="Timestep (dt)"
                prairie="Integration step. Smaller = more stable."
                tumor="Integration step. Smaller = more stable."
                value={params.dt}
                min={0.005}
                max={0.2}
                step={0.005}
                onChange={(v) => update('dt', v)}
                testId="dt"
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Steps per frame (speed)"
                prairie="How many timesteps to advance each animation frame."
                tumor="How many timesteps to advance each animation frame."
                value={stepsPerFrame}
                min={1}
                max={10}
                step={1}
                onChange={(v) => setStepsPerFrame(Math.round(v))}
                testId="stepsPerFrame"
                format={(v) => v.toFixed(0)}
              />
              <SliderRow
                label="Grid size"
                prairie="Spatial resolution. Larger = more detail, slower."
                tumor="Spatial resolution. Larger = more detail, slower."
                value={params.gridSize}
                min={40}
                max={140}
                step={10}
                onChange={(v) => {
                  const g = Math.round(v / 10) * 10;
                  setParams((p) => ({ ...p, gridSize: g }));
                  // resetting state needs the new size
                  setRunning(false);
                  const next = { ...params, gridSize: g };
                  const s = seedState(next);
                  setState(s);
                  const sum = summarize(s, next);
                  setSeriesTotalN([{ x: 0, y: sum.totalN }]);
                  setSeriesOcc([{ x: 0, y: sum.occupiedArea }]);
                  setSeriesMeanE([{ x: 0, y: sum.meanE }]);
                  setSeriesFront([{ x: 0, y: sum.frontRadius }]);
                }}
                testId="gridSize"
                format={(v) => v.toFixed(0)}
              />
            </CardContent>
          </Card>
        </section>

        {/* DISPLAY */}
        <section className="grid gap-5" aria-label="PDE simulation output">
          {/* exported figure region: N heatmap + readouts, E heatmaps, summary plots */}
          <div
            ref={figureRef}
            data-testid="figure-pde"
            className="grid gap-5 bg-background rounded-lg"
          >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Population density N(x, y, t)
              </CardTitle>
              <CardDescription className="text-xs">
                Prairie-dog density / cancer-cell density. Viridis colormap; brighter = denser.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[auto_1fr] items-start">
              <Heatmap
                state={state}
                field="N"
                vmax={nVmax}
                cmap={viridis}
                testId="heatmap-N"
                ariaLabel="Population density field"
              />
              <div className="grid gap-2 text-xs">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <div className="text-muted-foreground">Time t</div>
                  <div className="font-mono" data-testid="text-time">{state.time.toFixed(2)}</div>
                  <div className="text-muted-foreground">Steps</div>
                  <div className="font-mono" data-testid="text-step">{state.step}</div>
                  <div className="text-muted-foreground">Total N</div>
                  <div className="font-mono" data-testid="text-totalN">
                    {summary.totalN.toFixed(1)}
                  </div>
                  <div className="text-muted-foreground">Mean N</div>
                  <div className="font-mono" data-testid="text-meanN">
                    {summary.meanN.toFixed(3)}
                  </div>
                  <div className="text-muted-foreground">Occupied area</div>
                  <div className="font-mono" data-testid="text-occArea">
                    {summary.occupiedArea} cells
                  </div>
                  <div className="text-muted-foreground">Front radius</div>
                  <div className="font-mono" data-testid="text-frontR">
                    {summary.frontRadius.toFixed(2)}
                  </div>
                  <div className="text-muted-foreground">Mean E</div>
                  <div className="font-mono" data-testid="text-meanE">
                    {summary.meanE.toFixed(3)}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Mode:&nbsp;
                  <span data-testid="text-mode">density-scaled logistic</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Niche construction field E(x, y, t)
              </CardTitle>
              <CardDescription className="text-xs">
                Average of E_r and E_K (clamped to [0, 1]). Magma colormap; brighter =
                more habitat engineering / immune escape.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <div className="text-xs text-muted-foreground">E_r (growth modifier)</div>
                <Heatmap
                  state={state}
                  field="Er"
                  vmax={1}
                  cmap={magma}
                  testId="heatmap-Er"
                  ariaLabel="Niche construction field E_r"
                />
              </div>
              <div className="grid gap-1">
                <div className="text-xs text-muted-foreground">E_K (capacity modifier)</div>
                <Heatmap
                  state={state}
                  field="Ek"
                  vmax={1}
                  cmap={magma}
                  testId="heatmap-Ek"
                  ariaLabel="Niche construction field E_K"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary trajectories</CardTitle>
              <CardDescription className="text-xs">
                Total population, occupied area, front radius, and mean E over time.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <MiniLine
                data={seriesTotalN}
                width={420}
                height={140}
                label="Total N"
                color="hsl(142, 71%, 45%)"
                testId="line-totalN"
              />
              <MiniLine
                data={seriesOcc}
                width={420}
                height={140}
                label="Occupied area (cells)"
                color="hsl(212, 90%, 55%)"
                testId="line-occupied"
              />
              <MiniLine
                data={seriesFront}
                width={420}
                height={140}
                label="Front radius"
                color="hsl(28, 90%, 55%)"
                testId="line-front"
              />
              <MiniLine
                data={seriesMeanE}
                width={420}
                height={140}
                label="Mean E"
                color="hsl(290, 70%, 55%)"
                testId="line-meanE"
              />
            </CardContent>
          </Card>
          </div>
          {/* end exported figure region */}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Model notes &amp; assumptions</CardTitle>
              <CardDescription className="text-xs">
                Formulas, default interpretation, and limitations.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-xs">
              <div>
                <div className="font-semibold mb-1">Equation in the source PDF</div>
                <pre className="bg-muted/40 rounded p-2 overflow-auto text-[11px]">
{`dN/dt = r E_r ((K E_K − N) / (K E_K)) − a m / (1 + a h N)
dE_i/dt = (1 − E)(1 − exp(−b_i N(x,y)))`}
                </pre>
              </div>
              <div>
                <div className="font-semibold mb-1">
                  Default implementation (density-scaled logistic, recommended)
                </div>
                <pre className="bg-muted/40 rounded p-2 overflow-auto text-[11px]">
{`∂N/∂t = D ∇²N
       + r E_r N (1 − N / (K E_K))
       − (a m_eff N) / (1 + a h N)

m_eff = m0 · (1 − immuneEscape · E_avg),   E_avg = (E_r + E_K)/2
dE_r/dt = b_r (1 − E_r)(1 − exp(−b_r N))
dE_K/dt = b_K (1 − E_K)(1 − exp(−b_K N))`}
                </pre>
              </div>
              <div>
                <div className="font-semibold mb-1">Integration</div>
                <p className="text-muted-foreground">
                  Explicit forward Euler on a uniform 2-D grid with no-flux (Neumann)
                  boundary conditions. The 5-point Laplacian uses index mirroring at
                  the grid edge. Fields are clamped (N to [0, 1.5K], E to [0, 1]) to
                  keep the scheme stable.
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">Variable mapping</div>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  <li>
                    <span className="font-mono">N</span> — population /
                    cancer-cell density per cell.
                  </li>
                  <li>
                    <span className="font-mono">E_r, E_K</span> — niche construction /
                    habitat engineering modifying growth and capacity.
                  </li>
                  <li>
                    <span className="font-mono">D</span> — motility / cell migration /
                    diffusion coefficient.
                  </li>
                  <li>
                    <span className="font-mono">K</span> — resource ceiling / tissue
                    carrying capacity.
                  </li>
                  <li>
                    Predator / immune term — predation, immune attack, or therapy
                    pressure; weakens as niche construction grows.
                  </li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Scope &amp; limitations</div>
                <p className="text-muted-foreground">
                  This is a teaching and manuscript-companion tool. Parameters are not
                  fit to patient data or empirical prairie-dog populations.
                  Numerical results are illustrative and{' '}
                  <strong>not a calibrated clinical model.</strong> Use it to build
                  intuition about how growth, diffusion, niche construction, and
                  immune pressure jointly shape spatial spread.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function trimSeries(arr: SeriesPt[], max = 600): SeriesPt[] {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
}
