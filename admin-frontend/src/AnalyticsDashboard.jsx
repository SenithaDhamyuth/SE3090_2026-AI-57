import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Brain, BookOpen, Target, Users, AlertTriangle, CheckCircle2,
  RefreshCw, Filter, ChevronDown, Zap, Layers, Activity,
  FlaskConical, Lightbulb, GraduationCap, Calendar, Clock,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   SHARED PRIMITIVES
───────────────────────────────────────────── */
function PageHeader({ title, titleSi, description, children }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
          {title}
          <span className="text-xs text-zinc-400 block font-normal mt-1">{titleSi}</span>
        </h1>
        <p className="text-[13px] text-zinc-400 mt-2">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SectionCard({ title, titleSi, uc, accent, icon: Icon, headerRight, children }) {
  return (
    <div className={`bg-white border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden ${accent ? 'border-orange-200/60' : 'border-zinc-200/80'}`}>
      <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${accent ? 'border-orange-100 bg-orange-50/30' : 'border-zinc-100'}`}>
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
              <Icon size={15} strokeWidth={2} />
            </div>
          )}
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-900 tracking-tight">{title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-400">{titleSi}</span>
              {uc && <span className="text-[9px] font-mono font-semibold text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">{uc}</span>}
            </div>
          </div>
        </div>
        {headerRight}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Sparkline({ data, color = '#EA580C', height = 32, width = 80 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity="0.08" stroke="none" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   PAST PAPER TRENDS — UC3.6
   Syllabus topic recurrence heatmap
───────────────────────────────────────────── */
const TREND_DATA = [
  { topic: 'Python Programming',                  hits: 9, trend: 'up',     years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], freq: [2,3,2,4,3,5,4], risk: 'High' },
  { topic: 'Database Management',                 hits: 8, trend: 'up',     years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], freq: [2,2,3,3,4,4,5], risk: 'High' },
  { topic: 'Data Representation & Logic Gates',   hits: 7, trend: 'stable', years: [2019, 2020, 2022, 2023, 2024, 2025], freq: [2,1,2,3,2,3], risk: 'Medium' },
  { topic: 'Networking & OSI',                    hits: 8, trend: 'up',     years: [2019, 2020, 2021, 2022, 2023, 2024, 2025], freq: [1,2,2,3,4,4,5], risk: 'High' },
  { topic: 'Systems Analysis',                    hits: 6, trend: 'stable', years: [2019, 2021, 2022, 2023, 2024], freq: [2,2,1,2,2], risk: 'Medium' },
  { topic: 'Information Security',                hits: 5, trend: 'up',     years: [2020, 2021, 2022, 2023, 2024, 2025], freq: [1,1,2,2,3,4], risk: 'Medium' },
  { topic: 'Web Development',                     hits: 5, trend: 'down',   years: [2019, 2020, 2022, 2023, 2025], freq: [3,3,2,2,1], risk: 'Low' },
  { topic: 'Operating Systems',                    hits: 4, trend: 'stable', years: [2020, 2022, 2023, 2025], freq: [2,2,2,2], risk: 'Low' },
];

const RISK_MAP = {
  High:   'bg-red-50 text-red-700 border-red-100',
  Medium: 'bg-amber-50 text-amber-700 border-amber-100',
  Low:    'bg-zinc-50 text-zinc-500 border-zinc-100',
};

function PastPaperTrends() {
  return (
    <SectionCard
      title="Past Paper Trend Analysis"
      titleSi="පසුගිය ප්‍රශ්න පත්‍ර ප්‍රවණතා"
      uc="UC3.6"
      icon={BarChart3}
      headerRight={<span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">A/L ICT</span>}
    >
      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-100">
          <AlertTriangle size={11} className="text-red-500" />
          <span className="text-[11px] font-semibold text-red-700">{TREND_DATA.filter(t => t.risk === 'High').length} High-Risk Topics</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100">
          <Brain size={11} className="text-violet-500" />
          <span className="text-[11px] font-semibold text-violet-700">AI-detected via PastPaper Agent</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 border border-zinc-200 ml-auto">
          <Calendar size={11} className="text-zinc-400" />
          <span className="text-[11px] font-semibold text-zinc-500">2019–2025 Dataset</span>
        </div>
      </div>

      {/* Trend rows */}
      <div className="space-y-2.5">
        {TREND_DATA.map((t, i) => {
          const maxHits = Math.max(...TREND_DATA.map(x => x.hits));
          const pct = (t.hits / maxHits) * 100;
          return (
            <div key={i} className="group flex items-center gap-4 px-4 py-3 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/50 transition-all">
              {/* Topic + bar */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-zinc-800 truncate">{t.topic}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-zinc-400 shrink-0">
                    {t.hits} papers
                  </span>
                </div>
              </div>

              {/* Mini sparkline */}
              <div className="shrink-0 hidden lg:block">
                <Sparkline data={t.freq} color={t.trend === 'up' ? '#EA580C' : t.trend === 'down' ? '#ef4444' : '#a1a1aa'} height={24} width={60} />
              </div>

              {/* Trend */}
              <div className="shrink-0">
                {t.trend === 'up'
                  ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><ArrowUpRight size={12} />Rising</span>
                  : t.trend === 'down'
                  ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500"><ArrowDownRight size={12} />Declining</span>
                  : <span className="text-[10px] font-semibold text-zinc-400">Stable</span>
                }
              </div>

              {/* Risk badge */}
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RISK_MAP[t.risk]}`}>
                {t.risk}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
        <p className="text-[11px] text-zinc-400">
          Agent last synced past papers: <span className="font-mono text-zinc-500">Today 22:00 IST</span>
        </p>
        <button className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 hover:text-orange-700">
          <RefreshCw size={11} />
          Re-run trend analysis
        </button>
      </div>
    </SectionCard>
  );
}

/* ─────────────────────────────────────────────
   DISTRACTOR ANALYSIS INSIGHTS — UC5.4
   Anomaly report with AI re-teach recommendations
───────────────────────────────────────────── */
const DISTRACTOR_DATA = [
  {
    qid: 'ICT-Q047',
    topic: 'IPv4 Subnetting',
    failRate: 78,
    distractorOption: 'D',
    distractorReason: 'Students confuse the network address with the first usable host address when calculating a /26 subnet.',
    recommendation: 'Generate practical IP routing examples with subnet boundary diagrams before the next exam session.',
    severity: 'critical',
    affectedStudents: 88,
  },
  {
    qid: 'ICT-Q023',
    topic: 'OSI Model & Network Protocols',
    failRate: 58,
    distractorOption: 'B',
    distractorReason: 'Students map routing and addressing tasks to the wrong OSI layer, especially confusing Network and Data Link responsibilities.',
    recommendation: 'Provide a layered troubleshooting scenario that contrasts MAC addressing, IP routing, and transport protocols.',
    severity: 'warning',
    affectedStudents: 53,
  },
  {
    qid: 'ICT-Q011',
    topic: 'Systems Analysis — Feasibility Study',
    failRate: 44,
    distractorOption: 'A',
    distractorReason: 'Students identify a preferred implementation before evaluating technical, economic, and operational feasibility.',
    recommendation: 'Insert a school information-system case study requiring a structured feasibility comparison.',
    severity: 'warning',
    affectedStudents: 41,
  },
  {
    qid: 'ICT-Q089',
    topic: 'SQL JOIN Types — INNER vs LEFT OUTER',
    subject: 'ICT',
    failRate: 34,
    distractorOption: 'C',
    distractorReason: 'Confusion between NULL handling in LEFT JOIN vs INNER JOIN — common table output misreading.',
    recommendation: 'Generate a visual table comparison. Content Synthesizer agent has a draft queued for review.',
    severity: 'info',
    affectedStudents: 29,
  },
];

const SEVERITY_MAP = {
  critical: { bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',   dot: 'bg-red-500',    label: 'Critical' },
  warning:  { bar: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Warning' },
  info:     { bar: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',  dot: 'bg-blue-400',  label: 'Info' },
};

function DistractorAnalysis() {
  const [expanded, setExpanded] = useState(null);
  return (
    <SectionCard
      title="Distractor Analysis Insights"
      titleSi="ව්‍යාකූල විකල්ප විශ්ලේෂණය"
      uc="UC5.4"
      icon={FlaskConical}
      accent
      headerRight={
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200/60">
          <AlertTriangle size={11} className="text-red-500" />
          <span className="text-[11px] font-semibold text-red-700">
            {DISTRACTOR_DATA.filter(d => d.severity === 'critical').length} Critical Anomalies
          </span>
        </div>
      }
    >
      <div className="space-y-3">
        {DISTRACTOR_DATA.map((item, i) => {
          const sev = SEVERITY_MAP[item.severity];
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              className={`border rounded-lg overflow-hidden transition-all ${isOpen ? 'border-orange-200 shadow-sm' : 'border-zinc-200/80'}`}
            >
              {/* Row header */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-zinc-50/50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                {/* Severity dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />

                {/* QID */}
                <span className="font-mono text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md shrink-0">
                  {item.qid}
                </span>

                {/* Topic */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-zinc-800 truncate">{item.topic}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{item.affectedStudents} students affected · Option {item.distractorOption} dominant distractor</p>
                </div>

                {/* Fail rate bar */}
                <div className="shrink-0 hidden md:flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${sev.bar}`} style={{ width: `${item.failRate}%` }} />
                  </div>
                  <span className={`text-[12px] font-bold ${item.failRate >= 60 ? 'text-red-600' : item.failRate >= 40 ? 'text-amber-600' : 'text-zinc-500'}`}>
                    {item.failRate}%
                  </span>
                </div>

                {/* Badge */}
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sev.badge}`}>
                  {sev.label}
                </span>

                <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-4 grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Distractor Pattern</p>
                    <p className="text-[12px] text-zinc-600 leading-relaxed">{item.distractorReason}</p>
                  </div>
                  <div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 shrink-0 mt-0.5">
                        <Lightbulb size={12} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-1.5">AI Re-Teach Recommendation</p>
                        <p className="text-[12px] text-zinc-600 leading-relaxed">{item.recommendation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold transition-colors">
                        Trigger Re-Teach
                      </button>
                      <button className="px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-300 text-[11px] font-semibold text-zinc-600 hover:text-zinc-800 transition-colors">
                        View Question
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ─────────────────────────────────────────────
   CLASS ANALYTICS — UC5.3
   Performance metrics by class and date range
───────────────────────────────────────────── */
const CLASS_DATA = [
  { class: 'Grade 13 · ICT (Morning)',   students: 28, avgScore: 74, passRate: 82, avgTime: '1h 32m', sessions: 14, delta: +4.2  },
  { class: 'Grade 13 · ICT (Evening)',   students: 22, avgScore: 61, passRate: 65, avgTime: '1h 48m', sessions: 11, delta: -2.1  },
  { class: 'Grade 13 · ICT (Revision)',   students: 31, avgScore: 68, passRate: 72, avgTime: '1h 55m', sessions: 16, delta: +1.8  },
  { class: 'Grade 12 · ICT Foundation',   students: 19, avgScore: 79, passRate: 89, avgTime: '1h 22m', sessions: 13, delta: +6.3  },
  { class: 'Grade 13 · ICT (Practical)',  students: 35, avgScore: 55, passRate: 57, avgTime: '2h 05m', sessions: 18, delta: -5.4  },
];

function ClassAnalytics() {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const ranges = ['Last 7 Days', 'Last 30 Days', 'This Term', 'All Time'];

  return (
    <SectionCard
      title="Class Performance Analytics"
      titleSi="පන්ති කාර්යසාධනය"
      uc="UC5.3"
      icon={GraduationCap}
      headerRight={
        <div className="relative">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="appearance-none text-[12px] font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-400 cursor-pointer"
          >
            {ranges.map(r => <option key={r}>{r}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>
      }
    >
      {/* Summary stat strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Enrolled', value: CLASS_DATA.reduce((a, c) => a + c.students, 0), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg. Pass Rate', value: `${Math.round(CLASS_DATA.reduce((a, c) => a + c.passRate, 0) / CLASS_DATA.length)}%`, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Avg. Score', value: `${Math.round(CLASS_DATA.reduce((a, c) => a + c.avgScore, 0) / CLASS_DATA.length)}%`, icon: BarChart3, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Total Sessions', value: CLASS_DATA.reduce((a, c) => a + c.sessions, 0), icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-100 bg-zinc-50/50">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
              <s.icon size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-400 font-medium leading-none">{s.label}</p>
              <p className="text-[16px] font-bold text-zinc-900 leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Class table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-100">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70">
              {['Class', 'Students', 'Avg. Score', 'Pass Rate', 'Avg. Duration', 'Sessions', 'Trend'].map(col => (
                <th key={col} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {CLASS_DATA.map((cls, i) => (
              <tr key={i} className="hover:bg-zinc-50/60 transition-colors group">
                <td className="px-4 py-3">
                  <span className="text-[12px] font-semibold text-zinc-800">{cls.class}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Users size={11} className="text-zinc-400" />
                    <span className="text-[12px] text-zinc-600">{cls.students}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${cls.avgScore}%` }} />
                    </div>
                    <span className="text-[12px] font-semibold text-zinc-700">{cls.avgScore}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[12px] font-bold ${cls.passRate >= 80 ? 'text-emerald-600' : cls.passRate >= 65 ? 'text-amber-600' : 'text-red-500'}`}>
                    {cls.passRate}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Clock size={11} className="text-zinc-400" />
                    <span className="text-[12px] text-zinc-500 font-mono">{cls.avgTime}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[12px] text-zinc-600">{cls.sessions}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${cls.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {cls.delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {cls.delta > 0 ? '+' : ''}{cls.delta}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ─────────────────────────────────────────────
   ANALYTICS DASHBOARD ROOT
───────────────────────────────────────────── */
export default function AnalyticsDashboard() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
      <PageHeader
        title="AI Analytics & Trends"
        titleSi="AI විශ්ලේෂණ සහ ප්‍රවණතා"
        description="Multi-agent intelligence layer · Real-time syllabus gap detection, distractor anomaly reporting, and class performance analytics."
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-violet-50 border border-violet-200/60">
            <Brain size={12} className="text-violet-500" />
            <span className="text-[11px] font-semibold text-violet-700">3 Agents Active</span>
          </div>
          <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-semibold shadow-sm transition-all active:scale-95">
            <RefreshCw size={13} />
            Sync All Agents
          </button>
        </div>
      </PageHeader>

      <PastPaperTrends />
      <DistractorAnalysis />
      <ClassAnalytics />
    </div>
  );
}
