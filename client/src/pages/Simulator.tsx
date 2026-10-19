import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  G,
  bestResponse,
  sampleLandscape,
  step,
  stabilityLabel,
  phenotypeLabel,
  tumorLabel,
  type Params,
} from '@/lib/gfunction';
// no extra imports
import { presets, defaultPreset } from '@/lib/presets';
import { Play, Pause, RotateCcw, Download, StepForward, ImageDown } from 'lucide-react';
import { exportNodeToPng } from '@/lib/exportFigure';
import { useToast } from '@/hooks/use-toast';

// ---- small SVG line/landscape components (no recharts dep) ----

type Pt = { x: number; y: number };

function formatSignedTick(value: number, decimals = 2): string {
  const rounded = Math.abs(value) < Math.pow(10, -decimals) / 2 ? 0 : value;
  if (rounded === 0) return '0.00';
  const magnitude = Math.abs(rounded).toFixed(decimals);
  return `${rounded > 0 ? '+' : '−'}${magnitude}`;
}

function niceTicks(lo: number, hi: number): number[] {
  const range = Math.max(hi - lo, 0.1);
  const rawStep = range / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / pow;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step * 0.5; t += step) {
    if (t >= lo - step * 0.2 && t <= hi + step * 0.2) ticks.push(Number(t.toFixed(10)));
  }
  if (lo < 0 && hi > 0 && !ticks.some((t) => Math.abs(t) < step / 10)) {
    ticks.push(0);
  }
  return ticks.sort((a, b) => a - b);
}

function LandscapePlot({
  data,
  u,
  vStar,
  width,
  height,
}: {
  data: { v: number; g: number }[];
  u: number;
  vStar: number;
  width: number;
  height: number;
}) {
  const pad = { l: 64, r: 16, t: 16, b: 32 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const gs = data.map((d) => d.g);
  const gMin = Math.min(...gs);
  const gMax = Math.max(...gs);
  const yPad = (gMax - gMin) * 0.1 || 0.1;
  const yLo = gMin - yPad;
  const yHi = gMax + yPad;
  const xS = (v: number) => pad.l + v * w;
  const yS = (g: number) => pad.t + (1 - (g - yLo) / (yHi - yLo)) * h;
  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xS(d.v).toFixed(2)} ${yS(d.g).toFixed(2)}`)
    .join(' ');
  // Zero line if in range
  const zeroY = yLo < 0 && yHi > 0 ? yS(0) : null;

  const yTicks = niceTicks(yLo, yHi);
  const xTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Fitness landscape G(v) over strategy v"
      data-testid="plot-landscape"
    >
      {/* axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + h} stroke="hsl(var(--border))" />
      <line
        x1={pad.l}
        y1={pad.t + h}
        x2={pad.l + w}
        y2={pad.t + h}
        stroke="hsl(var(--border))"
      />
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={pad.l - 4}
            x2={pad.l}
            y1={yS(t)}
            y2={yS(t)}
            stroke="hsl(var(--border))"
          />
          <text
            x={pad.l - 10}
            y={yS(t) + 3}
            textAnchor="end"
            fontSize="11"
            fontWeight="600"
            paintOrder="stroke"
            stroke="hsl(var(--card))"
            strokeWidth="3"
            className="tabular"
            fill="hsl(var(--muted-foreground))"
          >
            {formatSignedTick(t)}
          </text>
          <line
            x1={pad.l}
            x2={pad.l + w}
            y1={yS(t)}
            y2={yS(t)}
            stroke="hsl(var(--border))"
            strokeOpacity={0.35}
            strokeDasharray="2 3"
          />
        </g>
      ))}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={xS(t)}
            x2={xS(t)}
            y1={pad.t + h}
            y2={pad.t + h + 4}
            stroke="hsl(var(--border))"
          />
          <text
            x={xS(t)}
            y={pad.t + h + 16}
            textAnchor="middle"
            fontSize="10"
            className="tabular"
            fill="hsl(var(--muted-foreground))"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {/* zero line */}
      {zeroY !== null && (
        <line
          x1={pad.l}
          x2={pad.l + w}
          y1={zeroY}
          y2={zeroY}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.4}
          strokeDasharray="3 3"
        />
      )}
      {/* curve */}
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2.25}
      />
      {/* v* */}
      <line
        x1={xS(vStar)}
        x2={xS(vStar)}
        y1={pad.t}
        y2={pad.t + h}
        stroke="hsl(var(--chart-2))"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <text
        x={vStar < 0.85 ? xS(vStar) + 4 : xS(vStar) - 4}
        y={pad.t + 12}
        textAnchor={vStar < 0.85 ? 'start' : 'end'}
        fontSize="10"
        fill="hsl(var(--chart-2))"
        className="tabular"
      >
        v* = {vStar.toFixed(2)}
      </text>
      {/* u */}
      <line
        x1={xS(u)}
        x2={xS(u)}
        y1={pad.t}
        y2={pad.t + h}
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      <text
        x={u < 0.85 ? xS(u) + 4 : xS(u) - 4}
        y={pad.t + 26}
        textAnchor={u < 0.85 ? 'start' : 'end'}
        fontSize="10"
        fill="hsl(var(--foreground))"
        className="tabular"
      >
        u = {u.toFixed(2)}
      </text>
      {/* axis labels */}
      <text
        x={pad.l + w / 2}
        y={height - 4}
        textAnchor="middle"
        fontSize="11"
        fill="hsl(var(--muted-foreground))"
      >
        strategy v &nbsp;·&nbsp; 0 = cooperative / interior &nbsp;→&nbsp; 1 = motile / edge
      </text>
      <text
        x={12}
        y={pad.t + h / 2}
        transform={`rotate(-90 12 ${pad.t + h / 2})`}
        textAnchor="middle"
        fontSize="11"
        fill="hsl(var(--muted-foreground))"
      >
        fitness G(v ; u, x, E)
      </text>
    </svg>
  );
}

// Replace circle's y with interpolated G value.
function interpolateG(data: { v: number; g: number }[], u: number): number {
  if (data.length === 0) return 0;
  // linear interpolation
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i];
    const b = data[i + 1];
    if (u >= a.v && u <= b.v) {
      const t = (u - a.v) / (b.v - a.v || 1);
      return a.g + t * (b.g - a.g);
    }
  }
  return data[data.length - 1].g;
}

function TrajectoryPlot({
  series,
  width,
  height,
  yLabel,
  color,
  yDomain,
  testId,
}: {
  series: Pt[];
  width: number;
  height: number;
  yLabel: string;
  color: string;
  yDomain?: [number, number];
  testId: string;
}) {
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const xMin = Math.min(0, ...xs);
  const xMax = Math.max(20, ...xs);
  const yMin = yDomain ? yDomain[0] : Math.min(...ys);
  const yMax = yDomain ? yDomain[1] : Math.max(...ys);
  const yPad = (yMax - yMin) * 0.1 || 0.1;
  const yLo = yMin - (yDomain ? 0 : yPad);
  const yHi = yMax + (yDomain ? 0 : yPad);
  const xS = (x: number) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * w;
  const yS = (y: number) => pad.t + (1 - (y - yLo) / (yHi - yLo || 1)) * h;
  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xS(p.x).toFixed(2)} ${yS(p.y).toFixed(2)}`)
    .join(' ');
  const yTicks = [yLo, yLo + (yHi - yLo) * 0.5, yHi];
  return (
    <svg width={width} height={height} role="img" aria-label={yLabel} data-testid={testId}>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + h} stroke="hsl(var(--border))" />
      <line
        x1={pad.l}
        y1={pad.t + h}
        x2={pad.l + w}
        y2={pad.t + h}
        stroke="hsl(var(--border))"
      />
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l - 3} x2={pad.l} y1={yS(t)} y2={yS(t)} stroke="hsl(var(--border))" />
          <text
            x={pad.l - 5}
            y={yS(t) + 3}
            textAnchor="end"
            fontSize="9"
            className="tabular"
            fill="hsl(var(--muted-foreground))"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      <text
        x={pad.l}
        y={pad.t - 2}
        fontSize="10"
        fill="hsl(var(--muted-foreground))"
      >
        {yLabel}
      </text>
      <path d={path} fill="none" stroke={color} strokeWidth={1.75} />
      {series.length > 0 && (
        <circle
          cx={xS(series[series.length - 1].x)}
          cy={yS(series[series.length - 1].y)}
          r={3}
          fill={color}
        />
      )}
      <text
        x={pad.l + w}
        y={pad.t + h + 16}
        textAnchor="end"
        fontSize="9"
        fill="hsl(var(--muted-foreground))"
      >
        time t
      </text>
    </svg>
  );
}

// ---- mapping table content ----
const mapping = [
  {
    param: 'Carrying capacity (K)',
    prairie: 'Town resource ceiling — forage, soil moisture, burrow space',
    tumor: 'Tissue/resource ceiling — substrate, vascular supply, mechanical room',
    role: 'Logistic ceiling: G shrinks as x → K',
  },
  {
    param: 'Competitive overlap (α)',
    prairie: 'Burrow / coterie overlap and shared forage',
    tumor: 'Clonal niche overlap and shared microenvironmental resources',
    role: 'Strength of competition between v and u, scaled by density',
  },
  {
    param: 'Habitat quality (H)',
    prairie: 'Forage, soil quality, burrow infrastructure',
    tumor: 'Vascularity, oxygen, nutrients, stromal support',
    role: 'Boosts intrinsic growth, more for cooperative phenotypes',
  },
  {
    param: 'Disturbance (D)',
    prairie: 'Predators, plague, fire, human disturbance',
    tumor: 'Immune attack, therapy pulses, necrosis, vascular collapse',
    role: 'Penalty applied area-wise — interior phenotypes more exposed',
  },
  {
    param: 'Public goods (P)',
    prairie: 'Alarm calls, communal vigilance, kin support',
    tumor: 'Diffusible growth factors, shared metabolites, cooperative niches',
    role: 'Bonus to cooperative strategies, scales with density',
  },
  {
    param: 'Edge risk',
    prairie: 'Edge-of-town predation and exposure',
    tumor: 'Edge invasion cost (immune surveillance, mechanical stress)',
    role: 'Quadratic penalty against motile/edge phenotype',
  },
  {
    param: 'Motility cost',
    prairie: 'Energetic cost of dispersal',
    tumor: 'Cost of motility machinery (EMT, ECM remodeling)',
    role: 'Linear penalty on motile phenotype',
  },
  {
    param: 'Therapy intensity',
    prairie: '(Analog) management/control pulses',
    tumor: 'Cytotoxic / targeted therapy selection pressure',
    role: 'Selectively penalizes proliferative/motile phenotype',
  },
];

// ---- helper UI ----

function Stat({ label, value, hint, testId }: {
  label: string;
  value: string;
  hint?: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-card-border bg-card px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular" data-testid={testId}>{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

type SliderRowProps = {
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
};
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
}: SliderRowProps) {
  const fmt = format || ((v: number) => v.toFixed(2));
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <label
              htmlFor={testId}
              className="text-sm font-medium text-foreground cursor-help"
            >
              {label}
            </label>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            <div><span className="font-semibold">Prairie dog: </span>{prairie}</div>
            <div className="mt-1"><span className="font-semibold">Tumor: </span>{tumor}</div>
          </TooltipContent>
        </Tooltip>
        <span className="text-sm tabular text-muted-foreground" data-testid={`value-${testId}`}>
          {fmt(value)}
        </span>
      </div>
      <Slider
        id={testId}
        data-testid={`slider-${testId}`}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

// ---- main component ----

export default function Simulator() {
  const [params, setParams] = useState<Params>({ ...defaultPreset.params });
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [trajU, setTrajU] = useState<Pt[]>([{ x: 0, y: defaultPreset.params.u }]);
  const [trajX, setTrajX] = useState<Pt[]>([{ x: 0, y: defaultPreset.params.x }]);
  const [trajG, setTrajG] = useState<Pt[]>([
    { x: 0, y: G(defaultPreset.params.u, defaultPreset.params) },
  ]);
  const [presetId, setPresetId] = useState(defaultPreset.id);
  const tickRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLDivElement | null>(null);
  const [plotW, setPlotW] = useState(560);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // resize observer for landscape plot
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setPlotW(Math.max(320, Math.min(900, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const landscape = useMemo(() => sampleLandscape(params, 121), [params]);
  const { vStar, gStar } = useMemo(() => bestResponse(params), [params]);
  const stab = useMemo(() => stabilityLabel(params), [params]);
  const gAtU = useMemo(() => G(params.u, params), [params]);

  const expansionPressure = useMemo(() => {
    // |dG/dv| at u, normalized
    const h = 0.01;
    const a = G(Math.min(1, params.u + h), params);
    const b = G(Math.max(0, params.u - h), params);
    const grad = (a - b) / (2 * h);
    return grad; // signed
  }, [params]);

  // animation loop
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setParams((prev) => {
        const next = step(prev, 0.05, 0.18);
        const newP: Params = { ...prev, u: next.u, x: next.x };
        setTime((t) => {
          const tNext = t + 1;
          setTrajU((arr) => trim([...arr, { x: tNext, y: next.u }]));
          setTrajX((arr) => trim([...arr, { x: tNext, y: next.x }]));
          setTrajG((arr) => trim([...arr, { x: tNext, y: next.gAtU }]));
          return tNext;
        });
        return newP;
      });
    }, 80);
    tickRef.current = id;
    return () => window.clearInterval(id);
  }, [running]);

  function trim<T>(arr: T[], maxLen = 240): T[] {
    if (arr.length <= maxLen) return arr;
    return arr.slice(arr.length - maxLen);
  }

  function applyPreset(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setRunning(false);
    setPresetId(id);
    setParams({ ...p.params });
    setTime(0);
    setTrajU([{ x: 0, y: p.params.u }]);
    setTrajX([{ x: 0, y: p.params.x }]);
    setTrajG([{ x: 0, y: G(p.params.u, p.params) }]);
  }

  function manualStep() {
    setParams((prev) => {
      const n = step(prev, 0.05, 0.18);
      const newP: Params = { ...prev, u: n.u, x: n.x };
      setTime((t) => {
        const tNext = t + 1;
        setTrajU((arr) => trim([...arr, { x: tNext, y: n.u }]));
        setTrajX((arr) => trim([...arr, { x: tNext, y: n.x }]));
        setTrajG((arr) => trim([...arr, { x: tNext, y: n.gAtU }]));
        return tNext;
      });
      return newP;
    });
  }

  function resetTrajectory() {
    setRunning(false);
    setTime(0);
    setTrajU([{ x: 0, y: params.u }]);
    setTrajX([{ x: 0, y: params.x }]);
    setTrajG([{ x: 0, y: G(params.u, params) }]);
  }

  function exportJSON() {
    const data = {
      meta: {
        tool: 'G-function Simulator',
        framework: 'Vincent & Brown G-function (toy interpretable model)',
        timestamp: new Date().toISOString(),
        preset: presetId,
      },
      params,
      derived: { vStar, gStar, gAtU, stability: stab.label },
      trajectory: { u: trajU, x: trajX, gAtU: trajG },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gfunction-${presetId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFigure() {
    if (exporting) return;
    setExporting(true);
    const result = await exportNodeToPng(
      figureRef.current,
      'prairie-dogs-gfunction-result.png',
    );
    setExporting(false);
    if (result.ok) {
      toast({
        title: 'Figure downloaded',
        description: 'Saved prairie-dogs-gfunction-result.png',
      });
    } else {
      toast({
        title: 'Figure export failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  }

  function update<K extends keyof Params>(key: K, value: Params[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  // landscape plot height responsive
  const plotH = 320;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* logo */}
            <svg width="28" height="28" viewBox="0 0 32 32" aria-label="G-function logo" className="shrink-0">
              <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 22 Q16 6 23 22" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="16" cy="13" r="2" fill="currentColor" />
            </svg>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight truncate">
                G-function Simulator
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight truncate">
                Prairie dog town as cancer ecology · Vincent &amp; Brown formalism
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2" aria-label="Simulator navigation">
            <span
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
              data-testid="link-gfunction-active"
              aria-current="page"
            >
              G-function
            </span>
            <Link
              href="/pde"
              className="text-xs px-3 py-1.5 rounded-md border border-border hover-elevate"
              data-testid="link-pde"
            >
              PDE
            </Link>
            <Badge variant="secondary" className="hidden md:inline-flex text-[10px]">
              teaching · manuscript companion
            </Badge>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* CONTROLS */}
        <section className="grid gap-4" aria-label="Simulation controls">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preset scenarios</CardTitle>
              <CardDescription className="text-xs">
                Each preset seeds parameters and resets trajectory.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Select value={presetId} onValueChange={applyPreset}>
                <SelectTrigger data-testid="select-preset" aria-label="Preset scenario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id} data-testid={`preset-option-${p.id}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" data-testid="text-preset-blurb">
                {presets.find((p) => p.id === presetId)?.blurb}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setRunning((r) => !r)}
                  data-testid="button-run-pause"
                  aria-label={running ? 'Pause simulation' : 'Run simulation'}
                >
                  {running ? <Pause className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                  {running ? 'Pause' : 'Run'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={manualStep}
                  data-testid="button-step"
                  aria-label="Step one generation"
                >
                  <StepForward className="size-3.5 mr-1" />
                  Step
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetTrajectory}
                  data-testid="button-reset-trajectory"
                  aria-label="Reset trajectory"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportJSON}
                  data-testid="button-export-json"
                  aria-label="Export parameters as JSON"
                >
                  <Download className="size-3.5 mr-1" />
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadFigure}
                  disabled={exporting}
                  data-testid="button-download-figure"
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
                data-testid="status-figure-export"
              >
                {exporting ? 'Generating figure PNG…' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ecological parameters</CardTitle>
              <CardDescription className="text-xs">
                Hover labels to see the prairie ↔ tumor mapping.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SliderRow
                label="Carrying capacity (K)"
                prairie="Town resource ceiling — forage, soil, burrow space."
                tumor="Tissue/resource ceiling — vasculature, mechanical room."
                value={params.K}
                min={50}
                max={1000}
                step={10}
                onChange={(v) => update('K', v)}
                testId="K"
                format={(v) => v.toFixed(0)}
              />
              <SliderRow
                label="Competitive overlap (α)"
                prairie="Burrow / coterie overlap and shared forage."
                tumor="Clonal niche overlap and shared microenvironment."
                value={params.alpha}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => update('alpha', v)}
                testId="alpha"
              />
              <SliderRow
                label="Habitat quality (H)"
                prairie="Forage, soil, burrow infrastructure."
                tumor="Vascularity, oxygen, nutrients, stromal support."
                value={params.H}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(v) => update('H', v)}
                testId="H"
              />
              <SliderRow
                label="Disturbance (D)"
                prairie="Predators, plague, fire, human disturbance."
                tumor="Immune attack, therapy pulses, necrosis."
                value={params.D}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('D', v)}
                testId="D"
              />
              <SliderRow
                label="Public goods benefit (P)"
                prairie="Alarm calls, communal vigilance, kin support."
                tumor="Diffusibles, shared metabolites, cooperative niches."
                value={params.P}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('P', v)}
                testId="P"
              />
              <SliderRow
                label="Edge risk"
                prairie="Edge-of-town predation and exposure."
                tumor="Edge invasion cost (immune surveillance, ECM stress)."
                value={params.edgeRisk}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('edgeRisk', v)}
                testId="edgeRisk"
              />
              <SliderRow
                label="Motility / dispersal cost"
                prairie="Energetic cost of dispersal."
                tumor="Cost of motility machinery (EMT, ECM remodeling)."
                value={params.motCost}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('motCost', v)}
                testId="motCost"
              />
              <SliderRow
                label="Therapy intensity"
                prairie="(Analog) management / control pulses."
                tumor="Cytotoxic / targeted therapy selection pressure."
                value={params.therapy}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update('therapy', v)}
                testId="therapy"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">State (initial conditions)</CardTitle>
              <CardDescription className="text-xs">
                Manually nudge the resident strategy u and population x.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <SliderRow
                label="Resident strategy u"
                prairie="Population mean dispersal/edge tendency (0 = interior, 1 = motile)."
                tumor="Population mean phenotype (0 = cooperative core, 1 = invasive front)."
                value={params.u}
                min={0}
                max={1}
                step={0.005}
                onChange={(v) => {
                  update('u', v);
                  setTrajU((a) => [...a.slice(0, -1), { x: time, y: v }]);
                  setTrajG((a) => [...a.slice(0, -1), { x: time, y: G(v, { ...params, u: v }) }]);
                }}
                testId="u"
              />
              <SliderRow
                label="Population x"
                prairie="Town occupancy."
                tumor="Tumor cell count (scaled)."
                value={params.x}
                min={1}
                max={1500}
                step={1}
                onChange={(v) => {
                  update('x', v);
                  setTrajX((a) => [...a.slice(0, -1), { x: time, y: v }]);
                }}
                testId="x"
                format={(v) => v.toFixed(0)}
              />
            </CardContent>
          </Card>
        </section>

        {/* MAIN PLOTS + INFO */}
        <section className="grid gap-5 min-w-0">
          {/* exported figure region: readouts + landscape + trajectories */}
          <div
            ref={figureRef}
            data-testid="figure-gfunction"
            className="grid gap-5 min-w-0 bg-background rounded-lg"
          >
          {/* readouts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat
              label="Resident u"
              value={params.u.toFixed(3)}
              hint={phenotypeLabel(params.u)}
              testId="stat-u"
            />
            <Stat
              label="Best response v*"
              value={vStar.toFixed(3)}
              hint={`G(v*) = ${gStar.toFixed(3)}`}
              testId="stat-vstar"
            />
            <Stat
              label="G(u)"
              value={gAtU.toFixed(3)}
              hint={`Population x = ${params.x.toFixed(0)} / K = ${params.K.toFixed(0)}`}
              testId="stat-gu"
            />
            <Stat
              label="Selection gradient"
              value={expansionPressure.toFixed(3)}
              hint={
                Math.abs(expansionPressure) < 0.02
                  ? 'Near singular'
                  : expansionPressure > 0
                  ? 'Pushes toward motile'
                  : 'Pushes toward cooperative'
              }
              testId="stat-grad"
            />
          </div>

          <Card ref={containerRef as any}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fitness landscape G(v ; u, x, E)</CardTitle>
              <CardDescription className="text-xs">
                Solid line: per-capita fitness across focal strategy v. Vertical
                solid: resident u. Dashed: adaptive best response v*.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden">
                <LandscapePlotWrapper
                  data={landscape}
                  u={params.u}
                  vStar={vStar}
                  width={plotW - 32}
                  height={plotH}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span><span className="inline-block size-2 rounded-sm align-middle mr-1" style={{ background: 'hsl(var(--primary))' }} />G(v) curve</span>
                <span><span className="inline-block w-3 h-px align-middle mr-1 bg-foreground" />resident u</span>
                <span><span className="inline-block w-3 h-px align-middle mr-1" style={{ background: 'hsl(var(--chart-2))', borderTop: '1px dashed' }} />best response v*</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">u(t) — strategy trajectory</CardTitle></CardHeader>
              <CardContent>
                <TrajectoryPlot
                  series={trajU}
                  width={plotW > 900 ? 360 : Math.max(240, (plotW - 32) / 3)}
                  height={140}
                  yLabel="u"
                  yDomain={[0, 1]}
                  color="hsl(var(--chart-1))"
                  testId="plot-u-traj"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">x(t) — population</CardTitle></CardHeader>
              <CardContent>
                <TrajectoryPlot
                  series={trajX}
                  width={plotW > 900 ? 360 : Math.max(240, (plotW - 32) / 3)}
                  height={140}
                  yLabel="x"
                  color="hsl(var(--chart-2))"
                  testId="plot-x-traj"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">G(u, t) — realized fitness</CardTitle></CardHeader>
              <CardContent>
                <TrajectoryPlot
                  series={trajG}
                  width={plotW > 900 ? 360 : Math.max(240, (plotW - 32) / 3)}
                  height={140}
                  yLabel="G(u)"
                  color="hsl(var(--chart-3))"
                  testId="plot-g-traj"
                />
              </CardContent>
            </Card>
          </div>
          </div>
          {/* end exported figure region */}

          {/* state summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ecological state readout</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected strategy</div>
                <div className="text-sm font-medium" data-testid="text-strategy-label">{phenotypeLabel(params.u)}</div>
                <div className="text-xs text-muted-foreground" data-testid="text-tumor-label">{tumorLabel(params.u)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Stability cue</div>
                <div className="text-sm font-medium" data-testid="text-stability-label">{stab.label}</div>
                <div className="text-xs text-muted-foreground">
                  {stab.tone === 'stable'
                    ? 'Population near a convergent stable strategy.'
                    : stab.tone === 'disruptive'
                    ? 'Curvature suggests evolutionary branching pressure.'
                    : 'Selection actively moves u toward v*.'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Relative expansion pressure</div>
                <div className="text-sm font-medium tabular" data-testid="text-expansion">
                  {expansionPressure > 0 ? '+' : ''}{expansionPressure.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Local slope dG/dv at v=u. Sign tells which way selection pushes the resident.
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Density / capacity</div>
                <div className="text-sm font-medium tabular">
                  x / K = {(params.x / Math.max(1, params.K)).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Logistic damping kicks in as this approaches 1.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* mapping table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Parameter mapping · prairie ↔ tumor</CardTitle>
              <CardDescription className="text-xs">
                Each control plays the same model role in both ecologies.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-mapping">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Parameter</th>
                    <th className="py-2 pr-3 font-medium">Prairie dog</th>
                    <th className="py-2 pr-3 font-medium">Tumor analog</th>
                    <th className="py-2 font-medium">Model role</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m) => (
                    <tr key={m.param} className="border-t border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium">{m.param}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{m.prairie}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{m.tumor}</td>
                      <td className="py-2 text-muted-foreground">{m.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* model notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Model notes &amp; limitations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm leading-relaxed">
              <p>
                The G-function (Vincent &amp; Brown) defines per-capita fitness for a focal strategy v
                evaluated against a resident strategy u in ecological state x and circumstance E:
                <span className="font-mono text-[12px]"> G(v ; u, x, E)</span>. Setting v = u gives the
                fitness of the resident; the partial derivative <span className="font-mono text-[12px]">∂G/∂v</span> at
                v = u is the selection gradient.
              </p>
              <p className="font-mono text-[12px] bg-muted/50 rounded-md p-3 leading-relaxed">
                G(v ; u, x, E) ={' '}
                r₀(v,H) · (1 − x/K)
                {' − '}α · exp(−((v−u)/0.35)²) · (x/K)
                {' + '}P · (1−v) · min(1, x/K)
                {' − '}D · (1 − 0.6v)
                {' − '}edgeRisk · v² − motCost · v
                {' − '}therapy · (0.3 + 0.7v)
                <br />where r₀(v,H) = 0.6 + 0.6 · H · (1 − 0.5v).
              </p>
              <p>
                Adaptive dynamics: u<sub>t+1</sub> = u<sub>t</sub> + η · ∂G/∂v|<sub>v=u</sub>, clipped to [0,1];
                ecology updates by x<sub>t+1</sub> = x<sub>t</sub> + ξ · G(u) · x<sub>t</sub>.
              </p>
              <p className="text-muted-foreground">
                <strong>Limitations.</strong> This is a transparent toy formulation for teaching and
                hypothesis exploration, not a calibrated clinical model. It uses a single
                one-dimensional strategy axis, ignores spatial structure beyond the K/edge metaphor,
                assumes monomorphic resident populations (no explicit variance or branching beyond a
                stability cue), and treats therapy as a simple selection coefficient. Use it to build
                intuition about how K, α, H, D, P, and therapy reshape fitness landscapes — not to
                make patient predictions.
              </p>
            </CardContent>
          </Card>

          {/* further reading */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Further reading</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <a
                className="text-primary hover:underline"
                href="https://www.cambridge.org/core/books/evolutionary-game-theory-natural-selection-and-darwinian-dynamics/8C5AB78A47E5DC8C9CDC50EB8E3F50EA"
                target="_blank"
                rel="noreferrer"
              >
                Vincent &amp; Brown (2005). <em>Evolutionary Game Theory, Natural Selection, and
                Darwinian Dynamics.</em> Cambridge.
              </a>
              <a
                className="text-primary hover:underline"
                href="https://www.nature.com/articles/nrc1232"
                target="_blank"
                rel="noreferrer"
              >
                Merlo, Pepper, Reid &amp; Maley (2006). Cancer as an evolutionary and ecological
                process. <em>Nature Reviews Cancer.</em>
              </a>
              <a
                className="text-primary hover:underline"
                href="https://www.nature.com/articles/s41568-019-0142-8"
                target="_blank"
                rel="noreferrer"
              >
                Gatenby &amp; Brown (2020). Integrating evolutionary dynamics into cancer therapy.
                <em> Nature Reviews Clinical Oncology.</em>
              </a>
              <a
                className="text-primary hover:underline"
                href="https://www.journals.uchicago.edu/doi/10.1086/284280"
                target="_blank"
                rel="noreferrer"
              >
                Hoogland &amp; Sherman (1976/1981). Black-tailed prairie dog coterie ecology — classic
                empirical reference.
              </a>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border mt-6">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-4 text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <div>G-function Simulator · transparent toy model for teaching and manuscript companion use</div>
          <div>Built with React</div>
        </div>
      </footer>
    </div>
  );
}

// Wrapper that adds the resident-point dot at the correct interpolated y.
function LandscapePlotWrapper(props: {
  data: { v: number; g: number }[];
  u: number;
  vStar: number;
  width: number;
  height: number;
}) {
  // The LandscapePlot uses currentParamsRefHack for the dot's y; we fix the y
  // here by overlaying our own small marker for clarity.
  const { data, u, vStar, width, height } = props;
  const pad = { l: 64, r: 16, t: 16, b: 32 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const gs = data.map((d) => d.g);
  const gMin = Math.min(...gs);
  const gMax = Math.max(...gs);
  const yPad = (gMax - gMin) * 0.1 || 0.1;
  const yLo = gMin - yPad;
  const yHi = gMax + yPad;
  const xS = (v: number) => pad.l + v * w;
  const yS = (g: number) => pad.t + (1 - (g - yLo) / (yHi - yLo)) * h;
  const dotY = yS(interpolateG(data, u));
  const starY = yS(interpolateG(data, vStar));
  return (
    <div className="relative">
      <LandscapePlot data={data} u={u} vStar={vStar} width={width} height={height} />
      <svg
        className="absolute inset-0 pointer-events-none"
        width={width}
        height={height}
      >
        <circle cx={xS(u)} cy={dotY} r={4.5} fill="hsl(var(--foreground))" />
        <circle cx={xS(vStar)} cy={starY} r={4.5} fill="hsl(var(--chart-2))" />
      </svg>
    </div>
  );
}
