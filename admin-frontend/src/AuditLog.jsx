import React, { useState, useEffect } from 'react';
import {
  ScrollText, Search, Filter, ChevronDown, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, Brain,
  Zap, Clock, User, Bot, Wrench, Shield, Activity,
  ArrowRight, Terminal, Database, Layers,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   AUDIT LOG DATA — UC5.6
   Agent-decision history + tool failures
───────────────────────────────────────────── */
const LOG_TYPES   = ['All Types',   'Agent Decision', 'Tool Failure', 'User Action', 'System Event', 'Security'];
const LOG_LEVELS  = ['All Levels',  'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
const LOG_AGENTS  = ['All Agents',  'Content Synthesizer', 'PastPaper Trend Agent', 'Distractor Analyzer', 'Orchestrator', 'System'];

const AUDIT_LOGS = [
  {
    id:         'LOG-2026-4491',
    timestamp:  '2026-09-10 · 22:58:14 IST',
    type:       'Agent Decision',
    level:      'INFO',
    agent:      'Content Synthesizer',
    agentVersion: 'v2.3.1',
    uc:         'UC6.3',
    title:      'Question drafted and submitted for approval',
    detail:     'Generated Real-World Context MCQ for topic "Binary Arithmetic" (ICT) using IEEE Spectrum news feed. AI confidence: 94%. Submitted to approval queue as CA-0041.',
    tool:       'news_fetch_tool → question_generation_tool → approval_queue_push',
    inputTokens: 1240,
    outputTokens: 380,
    latencyMs:  3420,
    outcome:    'success',
    traceId:    'TRC-9f3a2d',
  },
  {
    id:         'LOG-2026-4490',
    timestamp:  '2026-09-10 · 22:45:03 IST',
    type:       'Tool Failure',
    level:      'ERROR',
    agent:      'PastPaper Trend Agent',
    agentVersion: 'v1.8.4',
    uc:         'UC3.6',
    title:      'news_fetch_tool timeout — fallback to cached dataset',
    detail:     'HTTP request to NewsAPI timed out after 10,000ms. Agent fell back to cached past-paper dataset (2025 snapshot). Trend analysis completed with stale news context. Alert: 1 topic trend score may be underestimated.',
    tool:       'news_fetch_tool (FAILED) → fallback_cache_tool → trend_analysis_tool',
    inputTokens: 560,
    outputTokens: 0,
    latencyMs:  10440,
    outcome:    'partial',
    traceId:    'TRC-8e1b7c',
  },
  {
    id:         'LOG-2026-4489',
    timestamp:  '2026-09-10 · 22:30:41 IST',
    type:       'Agent Decision',
    level:      'WARNING',
    agent:      'Distractor Analyzer',
    agentVersion: 'v2.1.0',
    uc:         'UC5.4',
    title:      'Anomaly detected — 71% fail rate on ICT-Q047 Option D',
    detail:     'Statistical analysis of 124 exam responses for ICT-Q047. Distractor option D selected by 71% of incorrect answers. Systematic misconception identified: sign-bit confusion in 2\'s complement. Re-teach recommendation generated and flagged to tutor dashboard.',
    tool:       'exam_response_query_tool → statistical_analysis_tool → recommendation_generation_tool',
    inputTokens: 2100,
    outputTokens: 720,
    latencyMs:  5670,
    outcome:    'success',
    traceId:    'TRC-7d4f9a',
  },
  {
    id:         'LOG-2026-4488',
    timestamp:  '2026-09-10 · 22:14:22 IST',
    type:       'User Action',
    level:      'INFO',
    agent:      'System',
    agentVersion: null,
    uc:         'UC1.4',
    title:      'Admin approved question CA-0036 (A/L ICT)',
    detail:     'User "senitha@intelliprep.lk" (Super Administrator) approved content item CA-0036 — "IPv4 Subnetting in School Networks". Question published to live Question Bank under A/L ICT · Networking & OSI.',
    tool:       'approval_action_api',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs:  112,
    outcome:    'success',
    traceId:    'TRC-6c3e8b',
  },
  {
    id:         'LOG-2026-4487',
    timestamp:  '2026-09-10 · 21:58:05 IST',
    type:       'System Event',
    level:      'INFO',
    agent:      'Orchestrator',
    agentVersion: 'v3.0.0',
    uc:         'UC5.3',
    title:      'Nightly class analytics pipeline triggered',
    detail:     'Scheduled orchestration workflow started. Spawned 3 sub-agents: (1) ClassPerformanceAgent, (2) DistractorAnalyzer, (3) PastPaperTrendAgent. Workflow ID: WF-2026-0910-N.',
    tool:       'orchestrator_spawn_tool × 3',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs:  890,
    outcome:    'success',
    traceId:    'TRC-5b2d7a',
  },
  {
    id:         'LOG-2026-4486',
    timestamp:  '2026-09-10 · 21:45:11 IST',
    type:       'Tool Failure',
    level:      'CRITICAL',
    agent:      'Content Synthesizer',
    agentVersion: 'v2.3.0',
    uc:         'UC6.3',
    title:      'LLM generation_tool rate limit exceeded — request dropped',
    detail:     'Gemini 1.5 Pro API returned 429 Too Many Requests during A/L ICT question batch generation. 2 pending question drafts were dropped from queue. Retry scheduled in 5 minutes. Batch job WF-0910-B partially completed (3/5 questions).',
    tool:       'llm_generation_tool (RATE_LIMIT_429)',
    inputTokens: 3200,
    outputTokens: 0,
    latencyMs:  0,
    outcome:    'failure',
    traceId:    'TRC-4a1c6d',
  },
  {
    id:         'LOG-2026-4485',
    timestamp:  '2026-09-10 · 21:30:00 IST',
    type:       'Security',
    level:      'WARNING',
    agent:      'System',
    agentVersion: null,
    uc:         'UC1.4',
    title:      'Failed login attempt — student account USR-009',
    detail:     'User "hasitha@gmail.com" (USR-009) attempted login 5 times with incorrect credentials. Account temporarily suspended. IP: 192.168.1.104. Admin notified.',
    tool:       'auth_gateway → account_suspension_trigger',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs:  44,
    outcome:    'blocked',
    traceId:    'TRC-3f0b5c',
  },
  {
    id:         'LOG-2026-4484',
    timestamp:  '2026-09-10 · 21:00:00 IST',
    type:       'Agent Decision',
    level:      'INFO',
    agent:      'PastPaper Trend Agent',
    agentVersion: 'v1.8.4',
    uc:         'UC3.6',
    title:      'Syllabus topic "Python Programming" flagged as High-Recurrence',
    detail:     'Analysis of 2019–2025 A/L ICT past papers identified "Python Programming" appearing in 9/9 examined years with increasing question count (avg 5.2 per paper). Risk level: HIGH. Tag added to priority question bank.',
    tool:       'paper_corpus_query_tool → nlp_topic_extraction_tool → risk_scoring_tool',
    inputTokens: 4800,
    outputTokens: 1100,
    latencyMs:  8230,
    outcome:    'success',
    traceId:    'TRC-2e9a4b',
  },
  {
    id:         'LOG-2026-4483',
    timestamp:  '2026-09-10 · 20:30:00 IST',
    type:       'User Action',
    level:      'INFO',
    agent:      'System',
    agentVersion: null,
    uc:         'UC5.1',
    title:      'Tutor requested revision on CA-0039 (A/L ICT)',
    detail:     'User "nimal@intelliprep.lk" (Tutor) sent revision instructions to Content Synthesizer Agent for CA-0039. Notes: "Adjust difficulty to Medium — keep the zero-day ransomware scenario aligned with the A/L ICT syllabus." Agent re-processing.',
    tool:       'revision_api → content_synthesizer_re_prompt',
    inputTokens: 320,
    outputTokens: 0,
    latencyMs:  233,
    outcome:    'success',
    traceId:    'TRC-1d8c3a',
  },
  {
    id:         'LOG-2026-4482',
    timestamp:  '2026-09-10 · 20:00:00 IST',
    type:       'System Event',
    level:      'INFO',
    agent:      'System',
    agentVersion: null,
    uc:         'UC5.6',
    title:      'Daily audit log snapshot archived',
    detail:     'Audit log from 2026-09-09 archived to cold storage (S3: intelliprep-audit-logs/2026/09/09). 2,341 log entries compressed and stored. Retention policy: 2 years.',
    tool:       'log_archival_tool',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs:  4500,
    outcome:    'success',
    traceId:    'TRC-0c7b2f',
  },
];

const LEVEL_STYLE = {
  INFO:     { badge: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400',    icon: null },
  WARNING:  { badge: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-400',   icon: null },
  ERROR:    { badge: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-500',     icon: null },
  CRITICAL: { badge: 'bg-red-100 text-red-800 border-red-300',       dot: 'bg-red-600 animate-pulse', icon: null },
};

const OUTCOME_STYLE = {
  success: 'text-emerald-600',
  partial: 'text-amber-600',
  failure: 'text-red-600',
  blocked: 'text-red-700',
};

const TYPE_ICON = {
  'Agent Decision': Brain,
  'Tool Failure':   Wrench,
  'User Action':    User,
  'System Event':   Activity,
  'Security':       Shield,
};

const AGENT_ICON = {
  'Content Synthesizer':    Layers,
  'PastPaper Trend Agent':  Database,
  'Distractor Analyzer':    Zap,
  'Orchestrator':           Bot,
  'System':                 Terminal,
};

/* ─────────────────────────────────────────────
   AUDIT LOG PAGE ROOT — UC5.6
───────────────────────────────────────────── */
export default function AuditLog() {
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [levelFilter, setLevelFilter] = useState('All Levels');
  const [agentFilter, setAgentFilter] = useState('All Agents');
  const [expanded, setExpanded]     = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const ROWS_PER_PAGE = 6;

  const filtered = AUDIT_LOGS.filter(log => {
    const matchType   = typeFilter  === 'All Types'  || log.type  === typeFilter;
    const matchLevel  = levelFilter === 'All Levels' || log.level === levelFilter;
    const matchAgent  = agentFilter === 'All Agents' || log.agent === agentFilter;
    const matchSearch = !search || log.title.toLowerCase().includes(search.toLowerCase()) || log.id.toLowerCase().includes(search.toLowerCase()) || log.detail.toLowerCase().includes(search.toLowerCase());
    return matchType && matchLevel && matchAgent && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage   = Math.min(currentPage, totalPages);
  const paged      = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, levelFilter, agentFilter]);

  const criticals = AUDIT_LOGS.filter(l => l.level === 'CRITICAL').length;
  const errors    = AUDIT_LOGS.filter(l => l.level === 'ERROR').length;
  const failures  = AUDIT_LOGS.filter(l => l.outcome === 'failure' || l.outcome === 'partial').length;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            System Audit Log
            <span className="text-xs text-zinc-400 block font-normal mt-1">පද්ධති විගණන ලොගය</span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Agent-decision history, tool failures, and user actions · <span className="font-mono text-zinc-500">UC5.6</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200/60">
            <AlertTriangle size={11} className="text-red-500" />
            <span className="text-[11px] font-bold text-red-700">{criticals} Critical · {errors} Error</span>
          </div>
          <button className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Events',     value: AUDIT_LOGS.length, color: 'text-zinc-700', bg: 'bg-zinc-50',     border: 'border-zinc-200' },
          { label: 'Critical Alerts',  value: criticals,         color: 'text-red-700',  bg: 'bg-red-50',      border: 'border-red-200/60' },
          { label: 'Tool Failures',    value: failures,          color: 'text-amber-700',bg: 'bg-amber-50',     border: 'border-amber-200/60' },
          { label: 'Agent Decisions',  value: AUDIT_LOGS.filter(l => l.type === 'Agent Decision').length, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200/60' },
        ].map((s, i) => (
          <div key={i} className={`px-4 py-3.5 rounded-xl bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${s.border}`}>
            <p className="text-[10px] text-zinc-400 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold leading-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-zinc-200/80 rounded-xl px-5 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className={`flex items-center gap-2 h-8 px-3 rounded-lg border transition-all duration-200 ${searchFocused ? 'border-orange-400 ring-2 ring-orange-500/15 bg-white' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'} w-72`}>
          <Search size={13} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search log ID, title, detail…"
            className="bg-transparent outline-none text-[12px] text-zinc-700 w-full placeholder-zinc-300"
          />
        </div>

        {[
          { value: typeFilter,  setter: setTypeFilter,  options: LOG_TYPES  },
          { value: levelFilter, setter: setLevelFilter, options: LOG_LEVELS },
          { value: agentFilter, setter: setAgentFilter, options: LOG_AGENTS },
        ].map((f, i) => (
          <div key={i} className="relative">
            <select
              value={f.value}
              onChange={e => f.setter(e.target.value)}
              className="appearance-none text-[12px] font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-400 cursor-pointer"
            >
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        ))}

        <p className="ml-auto text-[11px] text-zinc-400">
          <span className="font-semibold text-zinc-600">{filtered.length}</span> events
        </p>
      </div>

      {/* Log entries */}
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="divide-y divide-zinc-50">
          {paged.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-300">
                <ScrollText size={22} strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-zinc-400">No log entries match your filters</p>
            </div>
          ) : paged.map((log, i) => {
            const levelStyle = LEVEL_STYLE[log.level] || LEVEL_STYLE.INFO;
            const isOpen     = expanded === log.id;
            const TypeIcon   = TYPE_ICON[log.type] || Activity;
            const AgentIcon  = AGENT_ICON[log.agent] || Bot;

            return (
              <div key={log.id} className={isOpen ? 'bg-zinc-50/30' : ''}>
                {/* Row */}
                <button
                  className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-zinc-50/50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                >
                  {/* Level dot */}
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${levelStyle.dot}`} />
                  </div>

                  {/* Timestamp + ID */}
                  <div className="shrink-0 text-left w-40">
                    <p className="font-mono text-[10px] font-semibold text-zinc-400">{log.id}</p>
                    <p className="text-[10px] text-zinc-300 mt-0.5 leading-snug">{log.timestamp}</p>
                  </div>

                  {/* Type + agent */}
                  <div className="shrink-0 w-36">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TypeIcon size={11} className="text-zinc-400 shrink-0" />
                      <span className="text-[11px] text-zinc-500 font-medium">{log.type}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AgentIcon size={10} className="text-violet-400 shrink-0" />
                      <span className="text-[10px] text-violet-600 font-semibold truncate">{log.agent}</span>
                    </div>
                  </div>

                  {/* Title + summary */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-[13px] font-semibold text-zinc-800 leading-none">{log.title}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${levelStyle.badge}`}>{log.level}</span>
                      {log.uc && <span className="text-[9px] font-mono font-semibold text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">{log.uc}</span>}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug line-clamp-1">{log.detail}</p>
                  </div>

                  {/* Outcome */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {log.outcome === 'success' && <CheckCircle2 size={13} className="text-emerald-500" />}
                    {(log.outcome === 'failure' || log.outcome === 'blocked') && <XCircle size={13} className="text-red-500" />}
                    {log.outcome === 'partial'  && <AlertTriangle size={13} className="text-amber-500" />}
                    <span className={`text-[11px] font-semibold capitalize ${OUTCOME_STYLE[log.outcome]}`}>{log.outcome}</span>
                  </div>

                  <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-zinc-100 bg-white px-5 py-5 grid md:grid-cols-2 gap-5">
                    {/* Detail text */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Event Detail</p>
                      <p className="text-[12px] text-zinc-600 leading-relaxed">{log.detail}</p>

                      {/* Tool chain */}
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Tool Chain</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.tool.split(' → ').map((tool, ti) => (
                            <React.Fragment key={ti}>
                              <span className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-md border ${
                                tool.includes('FAILED') || tool.includes('RATE_LIMIT')
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                              }`}>
                                {tool}
                              </span>
                              {ti < log.tool.split(' → ').length - 1 && <ArrowRight size={10} className="text-zinc-300" />}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Trace Metadata</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Trace ID',        value: log.traceId,    mono: true },
                          { label: 'Agent Version',   value: log.agentVersion || '—', mono: true },
                          { label: 'Latency',         value: log.latencyMs > 0 ? `${log.latencyMs.toLocaleString()}ms` : '—', mono: true },
                          { label: 'Input Tokens',    value: log.inputTokens > 0 ? log.inputTokens.toLocaleString() : '—', mono: false },
                          { label: 'Output Tokens',   value: log.outputTokens > 0 ? log.outputTokens.toLocaleString() : '—', mono: false },
                          { label: 'Use Case',        value: log.uc || '—',  mono: true },
                        ].map((m, mi) => (
                          <div key={mi} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                            <span className="text-[11px] text-zinc-400 font-medium">{m.label}</span>
                            <span className={`text-[11px] text-zinc-700 font-semibold ${m.mono ? 'font-mono' : ''}`}>{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between">
          <p className="text-[11px] text-zinc-400">
            Showing <span className="font-semibold text-zinc-600">{(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-zinc-600">{filtered.length}</span> events
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 rounded-md text-[11px] font-semibold transition-all ${safePage === i + 1 ? 'bg-orange-600 text-white shadow-sm' : 'border border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-md border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
