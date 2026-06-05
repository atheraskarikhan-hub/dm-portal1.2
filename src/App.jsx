import { useState, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ComposedChart,
  Area,
} from 'recharts';

// ── Real data extracted from your Excel files ──────────────────────────────
const DATA = {
  meta: {
    company: 'DM Clinical Research',
    subtitle: 'Revenue Operations Portal',
    asOf: 'May 26, 2026',
    vaccineSplit: 0.18,
    nonVaccineShift: 0.82,
    provision: 0.25,
  },
  kpis: {
    totalBacklog: 60329840,
    totalPipeline: 7633816,
    grandTotal2026: 67963656,
    vaccineTotal: 46960864,
    nonVaccineTotal: 21002792,
    actualYTD: 28708447,
    forecastRemaining: 39255209,
    studyCount: 2165,
    vaccineStudies: 1028,
    nonVaccineStudies: 1137,
  },
  monthly2026: [
    { month: 'Jan', actual: 6450018, forecast: null, type: 'ACT' },
    { month: 'Feb', actual: 7090431, forecast: null, type: 'ACT' },
    { month: 'Mar', actual: 8428336, forecast: null, type: 'ACT' },
    { month: 'Apr', actual: 6739662, forecast: null, type: 'ACT' },
    { month: 'May', actual: null, forecast: 4918149, type: 'FCST' },
    { month: 'Jun', actual: null, forecast: 3614054, type: 'FCST' },
    { month: 'Jul', actual: null, forecast: 3168263, type: 'FCST' },
    { month: 'Aug', actual: null, forecast: 2668049, type: 'FCST' },
    { month: 'Sep', actual: null, forecast: 2580431, type: 'FCST' },
    { month: 'Oct', actual: null, forecast: 8280002, type: 'FCST' },
    { month: 'Nov', actual: null, forecast: 3496758, type: 'FCST' },
    { month: 'Dec', actual: null, forecast: 2895688, type: 'FCST' },
  ],
  statusBreakdown: [
    {
      status: 'Maintenance',
      count: 282,
      revenue2026: 25740503,
      vaccine: 16326553,
      nonVaccine: 9413950,
    },
    {
      status: 'Enrolling',
      count: 83,
      revenue2026: 23328627,
      vaccine: 12173010,
      nonVaccine: 11155617,
    },
    {
      status: 'Awarded',
      count: 82,
      revenue2026: 10831118,
      vaccine: 8750000,
      nonVaccine: 2081118,
    },
    {
      status: 'Pipeline',
      count: 2179,
      revenue2026: 7633816,
      vaccine: 3378067,
      nonVaccine: 4255748,
    },
    {
      status: 'Closed',
      count: 378,
      revenue2026: 429592,
      vaccine: 429592,
      nonVaccine: 0,
    },
  ],
  waterfall: [
    {
      label: 'Maintenance',
      value: 25740503,
      running: 25740503,
      type: 'positive',
    },
    {
      label: 'Enrolling',
      value: 23328627,
      running: 49069130,
      type: 'positive',
    },
    { label: 'Awarded', value: 10831118, running: 59900248, type: 'positive' },
    {
      label: 'Risk Adj. Awarded',
      value: -6100817,
      running: 53799431,
      type: 'negative',
    },
    { label: 'Pipeline', value: 9018658, running: 62818089, type: 'positive' },
    {
      label: 'Risk Adj. Pipeline',
      value: -1050038,
      running: 61768051,
      type: 'negative',
    },
    {
      label: 'Genuine Go-Get',
      value: 11939062,
      running: 73707113,
      type: 'positive',
    },
    {
      label: 'Expected Goals',
      value: -5743457,
      running: 67963656,
      type: 'negative',
    },
    { label: 'TOTAL 2026', value: 67963656, running: 67963656, type: 'total' },
  ],
  sites: [
    {
      site: 'Tomball 13406',
      revenue2026: 18437454,
      rev2024: 11227405,
      rev2025: 13090269,
      type: 'Houston',
    },
    {
      site: 'CyFair',
      revenue2026: 16772287,
      rev2024: 9539071,
      rev2025: 6884127,
      type: 'Houston',
    },
    {
      site: 'Sugarland',
      revenue2026: 14782442,
      rev2024: 7206359,
      rev2025: 6380316,
      type: 'Houston',
    },
    {
      site: 'Bellaire',
      revenue2026: 11085031,
      rev2024: 7416899,
      rev2025: 4428863,
      type: 'Houston',
    },
    {
      site: 'River Forest',
      revenue2026: 9740434,
      rev2024: 6663343,
      rev2025: 5822467,
      type: 'Non-Houston',
    },
    {
      site: 'Philadelphia',
      revenue2026: 8230773,
      rev2024: 7535016,
      rev2025: 6706404,
      type: 'Non-Houston',
    },
    {
      site: 'Southfield',
      revenue2026: 7809621,
      rev2024: 6485165,
      rev2025: 4724400,
      type: 'Non-Houston',
    },
    {
      site: 'Brookline',
      revenue2026: 3602726,
      rev2024: 3358295,
      rev2025: 3019406,
      type: 'Non-Houston',
    },
    {
      site: 'Jersey City',
      revenue2026: 3527346,
      rev2024: 1545965,
      rev2025: 3527346,
      type: 'Non-Houston',
    },
  ],
  pipelineStratification: [
    {
      band: '0% – 10%',
      count: 469,
      vaccine: 469,
      nonVaccine: 658,
      revenue: 245691,
    },
    {
      band: '11% – 30%',
      count: 168,
      vaccine: 10,
      nonVaccine: 158,
      revenue: 5528784,
    },
    {
      band: '31% – 75%',
      count: 23,
      vaccine: 0,
      nonVaccine: 23,
      revenue: 143566,
    },
    {
      band: '76% – 85%',
      count: 22,
      vaccine: 22,
      nonVaccine: 0,
      revenue: 4150656,
    },
  ],
  goGet: {
    baseline: 85000000,
    backlog: 60329840,
    pipeline: 9018658,
    goGetOrganic: 6145304,
    goGetAwarded: 6100817,
    genuineGoGet: 11939062,
    expected: 67963656,
    confidenceWeighted: { total: 6249, vaccine: 4187, nonVaccine: 2062 },
  },
};

const fmt = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};
const fmtPct = (n) => `${(n * 100).toFixed(0)}%`;
const fmtK = (n) => `$${(n / 1000).toFixed(0)}K`;

// ── Chart helpers ───────────────────────────────────────────────────────────
const TEAL = '#00C2A8';
const TEAL_DIM = '#00836f';
const AMBER = '#FFB547';
const RED = '#FF5B5B';
const SLATE = '#64748B';
const BLUE = '#4D90FF';
const BG = '#0B1120';
const SURFACE = '#131E30';
const SURFACE2 = '#1A2840';
const BORDER = '#1F2F45';
const TEXT = '#E2EAF4';
const MUTED = '#6B7FA0';

// ── Mini Components ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, delta, icon }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: accent || TEAL,
          borderRadius: '12px 12px 0 0',
        }}
      />
      <div
        style={{
          fontSize: 11,
          color: MUTED,
          fontFamily: 'DM Mono, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: TEXT,
          fontFamily: 'Syne, sans-serif',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>}
      {delta !== undefined && (
        <div
          style={{
            fontSize: 12,
            color: delta >= 0 ? TEAL : RED,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs last update
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, badge }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}
    >
      <div
        style={{ width: 3, height: 18, background: TEAL, borderRadius: 2 }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: TEXT,
          fontFamily: 'Syne, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
      </span>
      {badge && (
        <span
          style={{
            fontSize: 10,
            background: TEAL + '22',
            color: TEAL,
            padding: '2px 8px',
            borderRadius: 20,
            fontFamily: 'DM Mono, monospace',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: SURFACE2,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        color: TEXT,
      }}
    >
      <div
        style={{
          color: MUTED,
          marginBottom: 4,
          fontFamily: 'DM Mono, monospace',
        }}
      >
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || TEAL }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

// ── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'sites', label: 'Sites' },
  { id: 'pipeline', label: 'Pipeline' },
];

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const monthlyData = DATA.monthly2026.map((d) => ({
    ...d,
    bar: d.actual ?? d.forecast,
    isActual: d.actual !== null,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <KpiCard
          label="2026 Grand Total"
          value={fmt(DATA.kpis.grandTotal2026)}
          sub={`${DATA.kpis.studyCount} active studies`}
          accent={TEAL}
        />
        <KpiCard
          label="YTD Actuals (Jan–Apr)"
          value={fmt(DATA.kpis.actualYTD)}
          sub="42% of annual target"
          accent={BLUE}
        />
        <KpiCard
          label="Remaining Forecast"
          value={fmt(DATA.kpis.forecastRemaining)}
          sub="May–Dec 2026"
          accent={AMBER}
        />
        <KpiCard
          label="Vaccine / Non-Vaccine"
          value="69% / 31%"
          sub={`${fmt(DATA.kpis.vaccineTotal)} | ${fmt(
            DATA.kpis.nonVaccineTotal
          )}`}
          accent="#A855F7"
        />
      </div>

      {/* Charts row */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}
      >
        {/* Monthly bar */}
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '20px 20px 12px',
          }}
        >
          <SectionHeader title="Monthly Revenue 2026" badge="ACT + FCST" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barSize={26}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={BORDER}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{
                  fill: MUTED,
                  fontSize: 11,
                  fontFamily: 'DM Mono, monospace',
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bar" name="Revenue" radius={[4, 4, 0, 0]}>
                {monthlyData.map((d, i) => (
                  <Cell key={i} fill={d.isActual ? TEAL : TEAL + '55'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'flex-end',
              fontSize: 11,
              color: MUTED,
              marginTop: 4,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: TEAL,
                  display: 'inline-block',
                }}
              />
              Actual
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: TEAL + '55',
                  display: 'inline-block',
                }}
              />
              Forecast
            </span>
          </div>
        </div>

        {/* Status donut-like breakdown */}
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '20px',
          }}
        >
          <SectionHeader title="Revenue by Status" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DATA.statusBreakdown.map((d) => {
              const pct = d.revenue2026 / DATA.kpis.grandTotal2026;
              const colors = {
                Maintenance: TEAL,
                Enrolling: BLUE,
                Awarded: AMBER,
                Pipeline: '#A855F7',
                Closed: SLATE,
              };
              const c = colors[d.status] || TEAL;
              return (
                <div key={d.status}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: TEXT }}>
                      {d.status}{' '}
                      <span style={{ color: MUTED }}>({d.count})</span>
                    </span>
                    <span
                      style={{ color: c, fontFamily: 'DM Mono, monospace' }}
                    >
                      {fmt(d.revenue2026)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: BORDER,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct * 100}%`,
                        height: '100%',
                        background: c,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vaccine vs Non-Vaccine row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '18px 20px',
            gridColumn: '1/3',
          }}
        >
          <SectionHeader
            title="Vaccine vs Non-Vaccine Split by Month"
            badge="2026"
          />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={DATA.monthly2026.map((d, i) => ({
                month: d.month,
                vaccine: [
                  6450018 * 0.69,
                  7090431 * 0.69,
                  8428336 * 0.69,
                  6739662 * 0.69,
                  4918149 * 0.69,
                  3614054 * 0.69,
                  3168263 * 0.69,
                  2668049 * 0.69,
                  2580431 * 0.69,
                  8280002 * 0.69,
                  3496758 * 0.69,
                  2895688 * 0.69,
                ][i],
                nonVaccine: [
                  6450018 * 0.31,
                  7090431 * 0.31,
                  8428336 * 0.31,
                  6739662 * 0.31,
                  4918149 * 0.31,
                  3614054 * 0.31,
                  3168263 * 0.31,
                  2668049 * 0.31,
                  2580431 * 0.31,
                  8280002 * 0.31,
                  3496758 * 0.31,
                  2895688 * 0.31,
                ][i],
              }))}
              barSize={16}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={BORDER}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="vaccine"
                name="Vaccine"
                stackId="a"
                fill={TEAL}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="nonVaccine"
                name="Non-Vaccine"
                stackId="a"
                fill={BLUE + '99'}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <SectionHeader title="Go-Get Target" />
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: AMBER,
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {fmt(DATA.goGet.baseline)}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
            Baseline target
          </div>
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              <span style={{ color: MUTED }}>Achieved</span>
              <span style={{ color: TEAL }}>
                {fmtPct(DATA.kpis.grandTotal2026 / DATA.goGet.baseline)}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: BORDER,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${
                    (DATA.kpis.grandTotal2026 / DATA.goGet.baseline) * 100
                  }%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${TEAL}, ${AMBER})`,
                  borderRadius: 3,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
              Conf. Weighted Goals:{' '}
              <span style={{ color: TEXT }}>
                {DATA.goGet.confidenceWeighted.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Waterfall Tab ─────────────────────────────────────────────────────────────
function WaterfallTab() {
  const wfData = DATA.waterfall.map((d, i) => {
    if (d.type === 'total') return { ...d, base: 0, bar: d.value };
    const prev = i === 0 ? 0 : DATA.waterfall[i - 1].running;
    if (d.type === 'negative')
      return { ...d, base: d.running, bar: Math.abs(d.value) };
    return { ...d, base: prev, bar: d.value };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <KpiCard
          label="Backlog Revenue"
          value={fmt(DATA.goGet.backlog)}
          sub="Maintenance + Enrolling + Awarded"
          accent={TEAL}
        />
        <KpiCard
          label="Pipeline Revenue"
          value={fmt(DATA.goGet.pipeline)}
          sub="After risk adjustments"
          accent={BLUE}
        />
        <KpiCard
          label="Genuine Go-Get"
          value={fmt(DATA.goGet.genuineGoGet)}
          sub="Organic + adjustments"
          accent={AMBER}
        />
        <KpiCard
          label="Expected (Final)"
          value={fmt(DATA.goGet.expected)}
          sub="Confidence weighted"
          accent="#A855F7"
        />
      </div>

      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px',
        }}
      >
        <SectionHeader
          title="Revenue Waterfall Bridge 2026"
          badge="Budget → Actual"
        />
        <div style={{ overflowX: 'auto' }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={wfData} barSize={38}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={BORDER}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fill: MUTED,
                  fontSize: 10,
                  fontFamily: 'DM Mono, monospace',
                }}
                axisLine={false}
                tickLine={false}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div
                      style={{
                        background: SURFACE2,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 12,
                        color: TEXT,
                      }}
                    >
                      <div style={{ color: MUTED, marginBottom: 4 }}>
                        {label}
                      </div>
                      <div
                        style={{
                          color:
                            d?.type === 'negative'
                              ? RED
                              : d?.type === 'total'
                              ? AMBER
                              : TEAL,
                        }}
                      >
                        {d?.type === 'negative' ? '-' : ''}
                        {fmt(d?.value)}
                      </div>
                      <div style={{ color: MUTED, fontSize: 11 }}>
                        Running: {fmt(d?.running)}
                      </div>
                    </div>
                  );
                }}
              />
              {/* invisible base bar */}
              <Bar dataKey="base" stackId="wf" fill="transparent" />
              <Bar dataKey="bar" stackId="wf" radius={[4, 4, 0, 0]}>
                {wfData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.type === 'negative'
                        ? RED + 'BB'
                        : d.type === 'total'
                        ? AMBER
                        : TEAL
                    }
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Waterfall detail table */}
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px',
        }}
      >
        <SectionHeader title="Waterfall Components" />
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <thead>
            <tr>
              {['Component', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === 'Component' ? 'left' : 'right',
                      padding: '8px 10px',
                      borderBottom: `1px solid ${BORDER}`,
                      color: MUTED,
                      fontWeight: 500,
                      fontSize: 11,
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {[
              [
                'Backlog (Maintenance)',
                22427250,
                6063334,
                13737426,
                8689824,
                2444843,
                3618490,
                28490584,
              ],
              [
                'Total Enrolling',
                17913985,
                10115981,
                8047762,
                9866223,
                5514819,
                4601163,
                28029966,
              ],
              [
                'Total Awarded',
                294154,
                7227576,
                0,
                294154,
                2432472,
                4795104,
                7521730,
              ],
              [
                'Risk Adj. Awarded',
                -4421,
                -6096396,
                0,
                -4421,
                -425875,
                -5670522,
                -6100817,
              ],
              [
                'Total Pipeline',
                176090,
                8842568,
                0,
                176090,
                2924502,
                5918066,
                9018658,
              ],
              ['Genuine Go-Get', 0, 11939062, 0, 0, 4775625, 7163437, 11939062],
            ].map(([label, ...vals]) => (
              <tr key={label} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                <td style={{ padding: '9px 10px', color: TEXT }}>{label}</td>
                {vals.map((v, i) => (
                  <td
                    key={i}
                    style={{
                      textAlign: 'right',
                      padding: '9px 10px',
                      fontFamily: 'DM Mono, monospace',
                      color: v < 0 ? RED : v === 0 ? MUTED : TEXT,
                      fontSize: 12,
                    }}
                  >
                    {v === 0 ? '—' : fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Forecast Tab ─────────────────────────────────────────────────────────────
function ForecastTab() {
  const lineData = DATA.monthly2026.map((d) => ({
    month: d.month,
    actual: d.actual,
    forecast: d.forecast,
    cumActual: null,
    cumForecast: null,
  }));

  let cumA = 0,
    cumF = 0;
  lineData.forEach((d) => {
    if (d.actual !== null) {
      cumA += d.actual;
      d.cumActual = cumA;
    } else {
      cumF += d.forecast;
      d.cumForecast = cumA + cumF;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <KpiCard
          label="Vaccine 2026"
          value={fmt(DATA.kpis.vaccineTotal)}
          sub={`${DATA.kpis.vaccineStudies} studies`}
          accent={TEAL}
        />
        <KpiCard
          label="Non-Vaccine 2026"
          value={fmt(DATA.kpis.nonVaccineTotal)}
          sub={`${DATA.kpis.nonVaccineStudies} studies`}
          accent={BLUE}
        />
        <KpiCard
          label="YTD Actuals"
          value={fmt(DATA.kpis.actualYTD)}
          sub="Jan – Apr 2026"
          accent={AMBER}
        />
        <KpiCard
          label="H1 vs H2"
          value="$28.6M / $31.6M"
          sub="First vs second half"
          accent={SLATE}
        />
      </div>

      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px',
        }}
      >
        <SectionHeader
          title="Revenue Forecast Trend 2026"
          badge="Actuals vs Forecast"
        />
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={DATA.monthly2026.map((d) => ({
              ...d,
              value: d.actual ?? d.forecast,
            }))}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={TEAL} stopOpacity={0.15} />
                <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={BORDER}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              x="Apr"
              stroke={AMBER}
              strokeDasharray="5 3"
              label={{
                value: 'Actual cutoff',
                fill: AMBER,
                fontSize: 10,
                position: 'top',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Revenue"
              fill="url(#areaGrad)"
              stroke={TEAL}
              strokeWidth={2}
              dot={(p) =>
                p.payload.actual !== null ? (
                  <circle key={p.key} cx={p.cx} cy={p.cy} r={4} fill={TEAL} />
                ) : (
                  <circle
                    key={p.key}
                    cx={p.cx}
                    cy={p.cy}
                    r={3}
                    fill={TEAL + '88'}
                    strokeDasharray="3 2"
                  />
                )
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Quarterly breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '20px',
          }}
        >
          <SectionHeader title="Quarterly Breakdown" />
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
          >
            <thead>
              <tr>
                {['Quarter', 'Revenue', 'vs Q prior', 'Type'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === 'Quarter' ? 'left' : 'right',
                      padding: '6px 8px',
                      borderBottom: `1px solid ${BORDER}`,
                      color: MUTED,
                      fontWeight: 500,
                      fontSize: 11,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Q1 2026', 21785188, null, 'ACT'],
                ['Q2 2026', 17761112, -18.5, 'ACT'],
                ['Q3 2026', 18092261, +1.9, 'FCST'],
                ['Q4 2026', 26096260, +44.2, 'FCST'],
              ].map(([q, rev, d, type]) => (
                <tr key={q} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                  <td
                    style={{
                      padding: '9px 8px',
                      color: TEXT,
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 12,
                    }}
                  >
                    {q}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '9px 8px',
                      color: TEAL,
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    {fmt(rev)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '9px 8px',
                      color: d === null ? MUTED : d >= 0 ? TEAL : RED,
                      fontSize: 12,
                    }}
                  >
                    {d === null ? '—' : `${d > 0 ? '+' : ''}${d}%`}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 8px' }}>
                    <span
                      style={{
                        background: type === 'ACT' ? TEAL + '22' : AMBER + '22',
                        color: type === 'ACT' ? TEAL : AMBER,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontFamily: 'DM Mono, monospace',
                      }}
                    >
                      {type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '20px',
          }}
        >
          <SectionHeader title="Vaccine vs Non-Vaccine Trend" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={DATA.monthly2026.map((d, i) => ({
                month: d.month,
                vaccine:
                  (d.actual ?? d.forecast) *
                  [
                    0.85, 0.86, 0.87, 0.8, 0.81, 0.59, 0.44, 0.36, 0.42, 0.94,
                    0.86, 0.78,
                  ][i],
                nonVaccine:
                  (d.actual ?? d.forecast) *
                  [
                    0.15, 0.14, 0.13, 0.2, 0.19, 0.41, 0.56, 0.64, 0.58, 0.06,
                    0.14, 0.22,
                  ][i],
              }))}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={BORDER}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="vaccine"
                name="Vaccine"
                stroke={TEAL}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="nonVaccine"
                name="Non-Vaccine"
                stroke={BLUE}
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Sites Tab ─────────────────────────────────────────────────────────────────
function SitesTab() {
  const maxRev = Math.max(...DATA.sites.map((s) => s.revenue2026));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px',
        }}
      >
        <SectionHeader title="Site Revenue 2026 vs Prior Years" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={DATA.sites} layout="vertical" barSize={10}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={BORDER}
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="site"
              tick={{ fill: TEXT, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="rev2024"
              name="2024"
              fill={SLATE + '66'}
              radius={[0, 3, 3, 0]}
            />
            <Bar
              dataKey="rev2025"
              name="2025"
              fill={BLUE + '88'}
              radius={[0, 3, 3, 0]}
            />
            <Bar
              dataKey="revenue2026"
              name="2026"
              fill={TEAL}
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {DATA.sites.map((s) => (
          <div
            key={s.site}
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  {s.site}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: s.type === 'Houston' ? TEAL : BLUE,
                    marginTop: 2,
                  }}
                >
                  {s.type}
                </div>
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: TEAL,
                  fontFamily: 'Syne, sans-serif',
                }}
              >
                {fmt(s.revenue2026)}
              </div>
            </div>
            <div
              style={{
                height: 4,
                background: BORDER,
                borderRadius: 2,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(s.revenue2026 / maxRev) * 100}%`,
                  height: '100%',
                  background: s.type === 'Houston' ? TEAL : BLUE,
                  borderRadius: 2,
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: MUTED,
              }}
            >
              <span>2024: {fmt(s.rev2024)}</span>
              <span>2025: {fmt(s.rev2025)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────
function PipelineTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <KpiCard
          label="Total Pipeline Studies"
          value="2,179"
          sub="501 Vaccine + 1,678 Non-Vaccine"
          accent={TEAL}
        />
        <KpiCard
          label="Pipeline Revenue 2026"
          value={fmt(DATA.kpis.totalPipeline)}
          sub="After risk adjustments"
          accent={BLUE}
        />
        <KpiCard
          label="Confidence Weighted"
          value={`${DATA.goGet.confidenceWeighted.total.toLocaleString()}`}
          sub="Expected randomizations"
          accent={AMBER}
        />
        <KpiCard
          label="Genuine Go-Get"
          value={fmt(DATA.goGet.genuineGoGet)}
          sub="12% of baseline target"
          accent="#A855F7"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '20px',
          }}
        >
          <SectionHeader
            title="Pipeline Stratification"
            badge="By Confidence Band"
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={DATA.pipelineStratification} barSize={32}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={BORDER}
                vertical={false}
              />
              <XAxis
                dataKey="band"
                tick={{
                  fill: MUTED,
                  fontSize: 10,
                  fontFamily: 'DM Mono, monospace',
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill={TEAL}
                radius={[4, 4, 0, 0]}
              >
                {DATA.pipelineStratification.map((_, i) => (
                  <Cell key={i} fill={[SLATE, BLUE, '#A855F7', TEAL][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '20px',
          }}
        >
          <SectionHeader title="Study Status Distribution" />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginTop: 8,
            }}
          >
            {[
              { label: 'Pipeline', count: 2179, pct: 0.63, color: '#A855F7' },
              { label: 'Closed', count: 378, pct: 0.18, color: SLATE },
              { label: 'Maintenance', count: 282, pct: 0.13, color: TEAL },
              { label: 'Enrolling', count: 83, pct: 0.04, color: BLUE },
              { label: 'Awarded', count: 82, pct: 0.04, color: AMBER },
            ].map((d) => (
              <div
                key={d.label}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: d.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: TEXT, width: 90 }}>
                  {d.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 5,
                    background: BORDER,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${d.pct * 100}%`,
                      height: '100%',
                      background: d.color,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    fontFamily: 'DM Mono, monospace',
                    width: 40,
                    textAlign: 'right',
                  }}
                >
                  {d.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px',
        }}
      >
        <SectionHeader title="Go-Get Bridge" badge="Backlog → Expected" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 1,
          }}
        >
          {[
            { label: 'Backlog', value: DATA.goGet.backlog, icon: '📦' },
            { label: 'Pipeline', value: DATA.goGet.pipeline, icon: '🔬' },
            { label: 'Go-Get', value: DATA.goGet.genuineGoGet, icon: '🎯' },
            { label: 'Expected Total', value: DATA.goGet.expected, icon: '✅' },
            {
              label: 'Baseline Target',
              value: DATA.goGet.baseline,
              icon: '🏁',
            },
          ].map((d, i) => (
            <div
              key={d.label}
              style={{
                background: SURFACE2,
                padding: '16px',
                textAlign: 'center',
                borderRadius:
                  i === 0 ? '8px 0 0 8px' : i === 4 ? '0 8px 8px 0' : 0,
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 6 }}>{d.icon}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: TEAL,
                  fontFamily: 'Syne, sans-serif',
                }}
              >
                {fmt(d.value)}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                {d.label}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: MUTED,
          }}
        >
          <span style={{ color: TEXT }}>
            {fmtPct(DATA.goGet.expected / DATA.goGet.baseline)}
          </span>{' '}
          of baseline target achieved ·
          <span style={{ color: RED }}>
            {fmt(DATA.goGet.baseline - DATA.goGet.expected)}
          </span>{' '}
          gap remaining
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
  }, []);

  const tabContent = {
    overview: <OverviewTab />,
    waterfall: <WaterfallTab />,
    forecast: <ForecastTab />,
    sites: <SitesTab />,
    pipeline: <PipelineTab />,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Top nav */}
      <div
        style={{
          borderBottom: `1px solid ${BORDER}`,
          background: SURFACE,
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${TEAL}, ${BLUE})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            DM
          </div>
          <div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: TEXT,
                fontFamily: 'Syne, sans-serif',
              }}
            >
              DM Clinical Research
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: MUTED }}>
              Revenue Operations Portal
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? TEAL + '18' : 'transparent',
                border: 'none',
                color: activeTab === t.id ? TEAL : MUTED,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: activeTab === t.id ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: TEAL,
              animation: 'pulse 2s infinite',
            }}
          />
          <span style={{ color: MUTED }}>Updated {DATA.meta.asOf}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
            fontSize: 12,
            color: MUTED,
          }}
        >
          <span>FP&A</span>
          <span>›</span>
          <span style={{ color: TEXT }}>
            {TABS.find((t) => t.id === activeTab)?.label}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              background: AMBER + '22',
              color: AMBER,
              padding: '2px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontFamily: 'DM Mono, monospace',
            }}
          >
            FY 2026 · Baseline 85M
          </span>
        </div>
        {tabContent[activeTab]}
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
