import React, { useState } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, RotateCcw, Eye,
  Brain, Newspaper, Clock, AlertTriangle, ChevronDown,
  Search, Zap, Layers, Tag, User, Calendar,
  MessageSquare, ExternalLink, Sparkles,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   APPROVAL QUEUE DATA
   Content Synthesizer Agent output —
   Real-World-Context Questions matched to news APIs
───────────────────────────────────────────── */
const QUEUE_DATA = [
  {
    id: 'CA-0041',
    title: 'Binary Arithmetic in Modern CPU Cache Architecture',
    topic: 'Data Representation',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.3.1',
    newsSource: 'IEEE Spectrum — "Chiplet Revolution in 2025 CPUs"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 21:44 IST',
    uc: 'UC6.3',
    difficulty: 'Hard',
    questionPreview: 'A modern CPU uses a 3-level cache hierarchy. Given that cache L1 stores data in 8-bit 2\'s complement format, which of the following correctly represents -127 in this encoding?',
    options: ['A. 1000 0000', 'B. 1000 0001', 'C. 0111 1111', 'D. 1111 1111'],
    correctAnswer: 'B',
    syllabusTags: ['UC3.6', 'Binary Arithmetic', 'Grade 13 ICT'],
    aiConfidence: 94,
    status: 'pending',
    revisionNotes: '',
  },
  {
    id: 'CA-0040',
    title: 'Newton\'s 3rd Law Applied to Electric Vehicle Regenerative Braking',
    topic: 'Information Security',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.3.1',
    newsSource: 'The Hacker News — "Zero-day Ransomware Attack Disrupts Enterprise Networks"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 20:11 IST',
    uc: 'UC5.1',
    difficulty: 'Medium',
    questionPreview: 'A zero-day ransomware attack exploits an unpatched service on a school network. Which control most directly limits the attacker\'s ability to move from the compromised server to other devices?',
    options: ['A. Network segmentation with access controls', 'B. Increasing monitor brightness', 'C. Renaming the server', 'D. Disabling the keyboard'],
    correctAnswer: 'A',
    syllabusTags: ['UC5.1', 'Information Security', 'Grade 13 ICT'],
    aiConfidence: 98,
    status: 'pending',
    revisionNotes: '',
  },
  {
    id: 'CA-0039',
    title: 'Nucleophilic Substitution in Pharmaceutical Synthesis (Ibuprofen)',
    topic: 'Systems Analysis',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.2.9',
    newsSource: 'MIT Technology Review — "Digital Transformation Projects in 2025"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 18:55 IST',
    uc: 'UC6.3',
    difficulty: 'Hard',
    questionPreview: 'During requirements analysis for a school information system, which technique best captures the interactions between a student and the system?',
    options: ['A. Use case diagram', 'B. Entity relationship table only', 'C. Binary search tree', 'D. IP address table'],
    correctAnswer: 'A',
    syllabusTags: ['UC5.4', 'Systems Analysis', 'Grade 13 ICT'],
    aiConfidence: 91,
    status: 'pending',
    revisionNotes: '',
  },
  {
    id: 'CA-0038',
    title: 'SQL Query Optimization in Large-Scale E-Commerce Databases',
    topic: 'Relational Database Concepts',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.3.1',
    newsSource: 'ACM Queue — "Database Scaling Patterns at Shopee 2025"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 17:30 IST',
    uc: 'UC5.1',
    difficulty: 'Medium',
    questionPreview: 'A Shopee database contains 10 million product records. A LEFT OUTER JOIN between `Products` and `Reviews` returns rows for products even when no reviews exist. What value does the `review_rating` column hold for such products?',
    options: ['A. 0', 'B. Empty string ""', 'C. NULL', 'D. Raises an error'],
    correctAnswer: 'C',
    syllabusTags: ['UC3.6', 'SQL & Databases', 'Grade 13 ICT'],
    aiConfidence: 99,
    status: 'pending',
    revisionNotes: '',
  },
  {
    id: 'CA-0037',
    title: 'Differentiation Applied to Drone Trajectory Optimization',
    topic: 'Networking & OSI',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.2.9',
    newsSource: 'Cloudflare Radar — "Global IPv4 Routing Incident Report 2025"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 15:00 IST',
    uc: 'UC6.3',
    difficulty: 'Hard',
    questionPreview: 'A router receives the IPv4 address 192.168.10.65/26. Which network address does the router use for this subnet?',
    options: ['A. 192.168.10.0', 'B. 192.168.10.64', 'C. 192.168.10.65', 'D. 192.168.10.128'],
    correctAnswer: 'B',
    syllabusTags: ['UC3.6', 'IPv4 Subnetting', 'Grade 13 ICT'],
    aiConfidence: 96,
    status: 'pending',
    revisionNotes: '',
  },
  {
    id: 'CA-0036',
    title: 'Momentum & Impulse in Sports Science — Sprint Biomechanics',
    topic: 'Python Programming',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.3.0',
    newsSource: 'Python Software Foundation — "Python Adoption in Data Automation 2025"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 12:15 IST',
    uc: 'UC5.1',
    difficulty: 'Easy',
    questionPreview: 'A Python program stores student marks in a list. Which expression returns the highest mark without changing the order of the list?',
    options: ['A. max(marks)', 'B. marks.highest()', 'C. marks.sort(-1)', 'D. highest(marks, 0)'],
    correctAnswer: 'A',
    syllabusTags: ['Python Programming', 'Lists and Functions', 'Grade 13 ICT'],
    aiConfidence: 99,
    status: 'pending',
    revisionNotes: '',
  },
  {
    id: 'CA-0035',
    title: 'Probability in Machine Learning — Naive Bayes Spam Filter',
    topic: 'Logic Gates',
    type: 'Real-World Context MCQ',
    agent: 'Content Synthesizer',
    agentVersion: 'v2.2.9',
    newsSource: 'IBM Research — "Energy-Efficient Logic Circuits for Edge Devices"',
    newsUrl: '#',
    createdAt: '2026-09-10 · 10:00 IST',
    uc: 'UC6.3',
    difficulty: 'Hard',
    questionPreview: 'A security circuit should output 1 only when both of its input sensors output 1. Which logic gate implements this requirement?',
    options: ['A. OR', 'B. NOT', 'C. AND', 'D. XOR'],
    correctAnswer: 'C',
    syllabusTags: ['Data Representation', 'Logic Gates', 'Grade 13 ICT'],
    aiConfidence: 88,
    status: 'pending',
    revisionNotes: '',
  },
];

const DIFFICULTY_BADGE = {
  'Easy':   'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Medium': 'bg-amber-50 text-amber-700 border-amber-100',
  'Hard':   'bg-red-50 text-red-700 border-red-100',
};

/* ─────────────────────────────────────────────
   REVISION DIALOG
───────────────────────────────────────────── */
function RevisionDialog({ item, onClose, onSubmit }) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-[14px] font-semibold text-zinc-900">Request Revision</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">සංශෝධනයක් ඉල්ලන්න · <span className="font-mono">{item.id}</span></p>
        </div>
        <div className="p-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Revision Instructions for Content Synthesizer Agent
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Adjust difficulty level down. The news context is too advanced for A/L syllabus. Simplify the real-world scenario..."
            className="w-full text-[13px] text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all placeholder-zinc-300"
          />
          <p className="text-[10px] text-zinc-400 mt-1.5">These notes will be sent as a prompt back to the Content Synthesizer agent (UC6.3).</p>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(notes)}
            disabled={!notes.trim()}
            className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
          >
            Send to Agent
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   APPROVAL CARD
───────────────────────────────────────────── */
function ApprovalCard({ item, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);

  return (
    <>
      <div className={`bg-white border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all ${
        item.status === 'approved' ? 'border-emerald-200 opacity-70' :
        item.status === 'rejected' ? 'border-red-200 opacity-50' :
        item.status === 'revision' ? 'border-amber-200' :
        'border-zinc-200/80 hover:border-zinc-300'
      }`}>
        {/* Card header */}
        <div className="px-5 py-4 flex items-start gap-4">
          {/* AI Confidence ring */}
          <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
              item.aiConfidence >= 95 ? 'border-emerald-400 text-emerald-700 bg-emerald-50' :
              item.aiConfidence >= 88 ? 'border-orange-400 text-orange-700 bg-orange-50' :
              'border-red-400 text-red-700 bg-red-50'
            }`}>
              {item.aiConfidence}
            </div>
            <span className="text-[9px] font-semibold text-zinc-400 text-center leading-none">AI<br/>Score</span>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {/* ID */}
              <span className="font-mono text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{item.id}</span>
              {/* Difficulty */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_BADGE[item.difficulty]}`}>{item.difficulty}</span>
              {/* UC */}
              <span className="text-[9px] font-mono font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">{item.uc}</span>
              {/* Status */}
              {item.status !== 'pending' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  item.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {item.status === 'approved' ? '✓ Approved' : item.status === 'rejected' ? '✗ Rejected' : '↻ Revision Sent'}
                </span>
              )}
              <span className="ml-auto text-[10px] text-zinc-400 font-medium">{item.createdAt}</span>
            </div>

            <h3 className="text-[14px] font-semibold text-zinc-900 leading-snug mb-1.5">{item.title}</h3>

            {/* News context strip */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 border border-zinc-100">
                <Newspaper size={11} className="text-zinc-400 shrink-0" />
                <span className="text-[10px] text-zinc-500 font-medium truncate max-w-xs">{item.newsSource}</span>
                <ExternalLink size={9} className="text-zinc-300 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-50 border border-violet-100">
                <Sparkles size={11} className="text-violet-500 shrink-0" />
                <span className="text-[10px] text-violet-600 font-semibold">{item.agent} {item.agentVersion}</span>
              </div>
            </div>

            {/* Topic tags */}
            <div className="flex flex-wrap gap-1">
              {item.syllabusTags.map(tag => (
                <span key={tag} className="text-[10px] font-medium text-zinc-500 bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(p => !p)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <ChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded: question preview */}
        {expanded && (
          <div className="border-t border-zinc-100 bg-zinc-50/40 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">Question Preview</p>
            <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-4">
              <p className="text-[13px] text-zinc-800 leading-relaxed font-medium mb-4">{item.questionPreview}</p>
              <div className="grid grid-cols-2 gap-2">
                {item.options.map((opt, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${
                      opt.startsWith(item.correctAnswer)
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    {opt}
                    {opt.startsWith(item.correctAnswer) && <span className="ml-1.5 text-[9px] text-emerald-600 font-bold">✓ CORRECT</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Revision notes */}
            {item.revisionNotes && (
              <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <MessageSquare size={12} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-amber-700 mb-0.5">Revision Notes Sent to Agent</p>
                  <p className="text-[12px] text-amber-800">{item.revisionNotes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        {item.status === 'pending' && (
          <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/30 flex items-center justify-between gap-3">
            <button
              onClick={() => setExpanded(p => !p)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              <Eye size={13} />
              {expanded ? 'Collapse' : 'Preview Question'}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRevisionOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[12px] font-semibold transition-all"
              >
                <RotateCcw size={12} />
                Request Revision
              </button>
              <button
                onClick={() => onAction(item.id, 'rejected')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-[12px] font-semibold transition-all"
              >
                <XCircle size={13} />
                Reject
              </button>
              <button
                onClick={() => onAction(item.id, 'approved')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold shadow-sm transition-all active:scale-95"
              >
                <CheckCircle2 size={13} />
                Approve
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revision dialog */}
      {revisionOpen && (
        <RevisionDialog
          item={item}
          onClose={() => setRevisionOpen(false)}
          onSubmit={notes => {
            onAction(item.id, 'revision', notes);
            setRevisionOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   PENDING APPROVALS PAGE ROOT
───────────────────────────────────────────── */
export default function PendingApprovals() {
  const [items, setItems] = useState(QUEUE_DATA);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const handleAction = (id, status, revisionNotes = '') => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, status, revisionNotes } : item
    ));
  };

  const statusFilters = ['All', 'Pending', 'Approved', 'Rejected', 'Revision'];

  const visible = items.filter(item => {
    const matchStatus = filter === 'All' || item.status === filter.toLowerCase();
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.topic.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const rejectedCount = items.filter(i => i.status === 'rejected').length;
  const revisionCount = items.filter(i => i.status === 'revision').length;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-none">
            Pending AI Approvals
            <span className="text-xs text-zinc-400 block font-normal mt-1">AI අනුමත කිරීම් රැකෑරූ</span>
          </h1>
          <p className="text-[13px] text-zinc-400 mt-2">
            Content Synthesizer Agent output queue · Tutor/Admin review required before publishing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200/60">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
            </span>
            <span className="text-[11px] font-bold text-orange-700">{pendingCount} Awaiting Review</span>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pending Review', value: pendingCount, color: 'border-orange-200 bg-orange-50', textColor: 'text-orange-700', dot: 'bg-orange-500' },
          { label: 'Approved',       value: approvedCount, color: 'border-emerald-200 bg-emerald-50', textColor: 'text-emerald-700', dot: 'bg-emerald-500' },
          { label: 'Rejected',       value: rejectedCount, color: 'border-red-200 bg-red-50', textColor: 'text-red-700', dot: 'bg-red-500' },
          { label: 'Revision Sent',  value: revisionCount, color: 'border-amber-200 bg-amber-50', textColor: 'text-amber-700', dot: 'bg-amber-500' },
        ].map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.color}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
            <div>
              <p className="text-[10px] text-zinc-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold leading-none ${s.textColor}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-zinc-200/80 rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Search */}
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-zinc-200 bg-zinc-50 hover:border-zinc-300 w-64 transition-all focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/15 focus-within:bg-white">
          <Search size={13} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by topic or title…"
            className="bg-transparent outline-none text-[12px] text-zinc-700 w-full placeholder-zinc-300"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 border-l border-zinc-100 pl-3">
          {statusFilters.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filter === s ? 'bg-orange-600 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="ml-auto text-[11px] text-zinc-400">
          Showing <span className="font-semibold text-zinc-600">{visible.length}</span> items
        </p>
      </div>

      {/* Approval cards */}
      <div className="space-y-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 bg-white border border-zinc-200/80 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-300">
              <ShieldCheck size={22} strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-zinc-500">No items match your filters</p>
            <p className="text-[11px] text-zinc-300">සොයාගත නොහැකි · Adjust filters to see results</p>
          </div>
        ) : (
          visible.map(item => (
            <ApprovalCard key={item.id} item={item} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  );
}
