// 📁 파일 경로: app/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Sparkles, Download, Star, Mail, Copy, Check, Loader2,
  ChevronLeft, ArrowRight, CheckCircle2,
  FileText, RefreshCw, FlaskConical, Lightbulb,
  AlertTriangle, Play, Link, RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormAnswers {
  q1: string; q2: string; q3: string;
  q4: string; q5: string; q6: string;
}

type AppStep = "form" | "feedback" | "tool" | "result";

interface FeedbackItem {
  question: string;
  issue: string;
}

interface FeedbackResult {
  sufficient: boolean;
  feedbacks: FeedbackItem[];
  summary: string;
}

type ResultTab = "diagnosis" | "prompt" | "poc" | "test";

interface ParsedResult {
  diagnosis: string;
  prompt: string;
  poc: string;
}

interface TestResult {
  mockData: {
    description: string;
    items: { label: string; value: string }[];
  };
  testResult: {
    summary: string;
    output: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: "q1" as keyof FormAnswers,
    title: "업무 소개",
    label: "업무를 소개해주세요.",
    desc: "소속된 조직의 목표와 자신의 업무를 연결해서 소개해주시면 좋습니다.",
    placeholder: "예) 저는 금융회사 HR팀 신입채용 담당으로, 팀의 목표는 우수 인재를 적기에 확보하는 것입니다. 저는 그 중 인턴사원 채용 전반을 담당하며, 입사 후 처우·등록 업무까지 맡고 있습니다.",
    rows: 4,
  },
  {
    id: "q2" as keyof FormAnswers,
    title: "핵심 업무",
    label: "맡은 직무에서 매주/매월 고정적으로 수행하는 가장 무겁거나 번거로운 핵심 업무는 무엇인가요?",
    desc: "반복되거나 시간이 많이 걸려 자동화하고 싶은 업무를 구체적으로 써주세요.",
    placeholder: "예) 인턴사원 입사 시마다 통장사본·계좌신고서를 받아 내용을 눈으로 대조한 뒤, 회계 ERP에 거래처 정보를 수작업으로 하나씩 입력합니다. 분기당 20~30명 처리에 1인당 10분, 총 4~5시간 소요됩니다.",
    rows: 4,
  },
  {
    id: "q3" as keyof FormAnswers,
    title: "Input / Output",
    label: "그 업무의 Input과 Output의 실제 데이터 형태는 무엇인가요?",
    desc: "Input이 어디서 오는지, Output이 누구에게 어떻게 전달되는지도 써주세요.",
    placeholder: "예)\n[Input] 인턴사원이 이메일로 제출하는 통장사본(이미지 파일)과 송금용 계좌 신고서(PDF)\n[Output] 회계 ERP 시스템에 직접 입력하는 거래처 등록 데이터 (이름·은행·계좌번호·생년월일)\n→ 회계팀에서 급여 지급 시 활용",
    rows: 5,
  },
  {
    id: "q4" as keyof FormAnswers,
    title: "비효율 구간",
    label: "업무 프로세스 중 비효율이라고 생각하는 구간과 그 이유를 써주세요.",
    desc: "3가지 관점에서 해당하는 부분을 구체적으로 작성해 주세요.\n• 과부하: 읽고 분석해야 할 정보의 양이 너무 많아 물리적 시간이 과도하게 걸리는지\n• 불균형: 특정 시점에만 업무가 몰려 병목을 만드는지\n• 비가치: 단순 복사·붙여넣기, 말투 교정, 서식 맞추기 등 형식적 낭비가 심한지",
    placeholder: "예)\n[비가치] 통장사본 이미지를 열어 계좌번호를 눈으로 확인하고 신고서와 대조하는 작업이 완전한 수작업입니다. 오타 발생 위험도 있고, 이 과정 자체가 본질적 가치(급여 지급)와 거리가 있습니다.\n[과부하] 분기 초에 20~30명이 한꺼번에 몰려 하루 종일 이 작업만 하는 날이 생깁니다.",
    rows: 5,
  },
  {
    id: "q5" as keyof FormAnswers,
    title: "업무 존재 목적",
    label: "비효율이 있음에도 불구하고 이 업무가 조직 내에 존재하는 목적은 무엇인가요?",
    desc: "절차적 이유보다 조직에 만드는 가치 관점에서 써주세요.",
    placeholder: "예) 인턴사원이 정확한 계좌 정보로 급여를 제때 수령할 수 있도록 보장하는 것입니다. 신뢰 기반의 채용 경험을 만드는 첫 단계이기도 합니다.",
    rows: 3,
  },
  {
    id: "q6" as keyof FormAnswers,
    title: "제약 조건",
    label: "AI가 작업할 때 주의해야 할 제약 사항은 무엇인가요?",
    desc: "개인정보·경영정보 유출 리스크, 법령·내부 규범·가이드라인 준수 등을 구체적으로 써주세요. 없으면 '없음'으로 기재해 주세요.",
    placeholder: "예) 통장사본에 이름·생년월일·계좌번호 등 개인정보가 포함됩니다. 외부 AI 서비스에 실제 데이터를 입력하는 것은 사내 보안 정책상 금지되어 있어, 가상 데이터로만 테스트해야 합니다.",
    rows: 3,
  },
];

const STORAGE_KEY = "ax-worksheet-answers-v1";

const STEP_LABELS: { id: AppStep; label: string }[] = [
  { id: "form", label: "작성" },
  { id: "feedback", label: "검토" },
  { id: "tool", label: "도구" },
  { id: "result", label: "결과" },
];

function StepIndicator({ current }: { current: AppStep }) {
  const steps = STEP_LABELS;
  const currentIdx = steps.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all
            ${i === currentIdx ? "bg-violet-100 text-violet-700" : i < currentIdx ? "text-emerald-600" : "text-slate-300"}`}>
            {i < currentIdx ? <Check size={10} /> : <span className="w-3 text-center">{i + 1}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-3 h-px mx-0.5 ${i < currentIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const RESULT_TABS: { id: ResultTab; label: string; icon: React.ReactNode }[] = [
  { id: "diagnosis", label: "자동화 진단", icon: <Lightbulb size={14} /> },
  { id: "prompt", label: "시스템 프롬프트", icon: <Sparkles size={14} /> },
  { id: "poc", label: "PoC 가이드", icon: <FlaskConical size={14} /> },
  { id: "test", label: "실시간 테스트", icon: <Play size={14} /> },
];

const AI_TOOLS = ["ChatGPT", "Gemini", "Claude", "Codex", "Copilot", "기타"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseResult(raw: string): ParsedResult {
  const d = raw.match(/<<<DIAGNOSIS>>>([\s\S]*?)<<<\/DIAGNOSIS>>>/);
  const p = raw.match(/<<<PROMPT>>>([\s\S]*?)<<<\/PROMPT>>>/);
  const c = raw.match(/<<<POC>>>([\s\S]*?)<<<\/POC>>>/);
  return {
    diagnosis: d ? d[1].trim() : raw,
    prompt: p ? p[1].trim() : "",
    poc: c ? c[1].trim() : "",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CodeBlock({ content, label }: { content: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all">
          {copied ? <><Check size={11} />복사됨</> : <><Copy size={11} />복사</>}
        </button>
      </div>
      <div className="bg-slate-900 rounded-xl p-4 text-sm text-slate-100 font-mono leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto border border-slate-700">
        {content}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorksheetPage() {
  const [step, setStep] = useState<AppStep>("form");
  const [answers, setAnswers] = useState<FormAnswers>({ q1: "", q2: "", q3: "", q4: "", q5: "", q6: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("diagnosis");
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [analyzedMeta, setAnalyzedMeta] = useState<{
    systemPrompt: string;
    hasPersonalData: boolean;
    hasConfidentialData: boolean;
    inputSpec: string;
    outputSpec: string;
    taskDescription: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // 로컬스토리지에서 이전 답변 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAnswers(prev => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  // 답변 변경 시 자동 저장
  useEffect(() => {
    try {
      const hasContent = Object.values(answers).some(a => a.trim().length > 0);
      if (hasContent) localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch { /* ignore */ }
  }, [answers]);

  // 모든 질문에 최소 답변이 있는지
  const allAnswered = Object.values(answers).every(a => a.trim().length >= 20);

  // ── 제출 → AI 1회 피드백 ──
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    setStep("feedback");

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "feedback", answers }),
      });
      const data = await res.json();
      setFeedback(data);
    } catch {
      setFeedback({
        sufficient: true,
        feedbacks: [],
        summary: "답변을 확인하는 중 오류가 발생했습니다. 그대로 진행합니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 도구 선택 ──
  const toggleTool = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };


  const handleGenerate = async () => {
    setStep("result");
    setResult("");
    setIsGenerating(true);

    try {
      // 1. 답변 정제 (analyze 모드)
      const analyzeRes = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "analyze", answers }),
      });
      const analyzedData = await analyzeRes.json();

      // 도구 정보 주입
      analyzedData.step4 = {
        ...analyzedData.step4,
        tools: selectedTools,
        usageMode: "repeat",
      };

      // 테스트 탭용 메타데이터 저장
      setAnalyzedMeta({
        systemPrompt: "",  // 스트리밍 완료 후 채워짐
        hasPersonalData: !!(analyzedData.step4?.hasPersonalData),
        hasConfidentialData: !!(analyzedData.step4?.hasConfidentialData),
        inputSpec: analyzedData.step2?.inputSpec || "",
        outputSpec: analyzedData.step2?.outputSpec || "",
        taskDescription: analyzedData.step1?.taskDescription || "",
      });

      // 2. 분석 스트리밍
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzedData),
      });

      if (!genRes.ok) throw new Error("생성 실패");

      const reader = genRes.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setResult(full);
      }

      // 스트리밍 완료 후 시스템 프롬프트 추출해서 메타에 저장
      const promptMatch = full.match(/<<<PROMPT>>>([\s\S]*?)<<<\/PROMPT>>>/);
      if (promptMatch) {
        setAnalyzedMeta(prev => prev ? { ...prev, systemPrompt: promptMatch[1].trim() } : null);
      }
    } catch {
      setResult("❌ 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `업무자동화_PoC설계_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!result) return;
    const parsed = parseResult(result);
    navigator.clipboard.writeText(parsed.prompt || result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parsed = parseResult(result);
  const hasStructured = !!(parsed.prompt || parsed.poc);

  // ── 진행률 ──
  const progress = step === "form" ? 30
    : step === "feedback" ? 55
    : step === "tool" ? 80
    : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-white" />
              </div>
              <h1 className="text-sm font-black text-slate-900 tracking-tight truncate">업무 자동화 워크시트</h1>
            </div>
            <StepIndicator current={step} />
          </div>
          <div className="mt-2.5 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28">

        {/* ── STEP 1: 질문 양식 ── */}
        {step === "form" && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 mb-1">업무 분석 워크시트</h2>
                <p className="text-sm text-slate-500">6개 질문에 충분히 답변해 주세요. 작성 내용은 자동 저장됩니다.</p>
              </div>
              {Object.values(answers).some(a => a.trim().length > 0) && (
                <button
                  onClick={() => {
                    if (confirm("작성한 내용을 모두 지울까요?")) {
                      const empty = { q1: "", q2: "", q3: "", q4: "", q5: "", q6: "" };
                      setAnswers(empty);
                      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0">
                  <RotateCcw size={12} />초기화
                </button>
              )}
            </div>

            {QUESTIONS.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black bg-violet-100 text-violet-600">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-violet-600 mb-0.5">{q.title}</p>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{q.label}</p>
                  </div>
                </div>

                {q.desc && (
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed whitespace-pre-line pl-10">{q.desc}</p>
                )}

                <textarea
                  value={answers[q.id]}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={q.rows}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800
                    placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400
                    focus:border-transparent transition-all text-sm leading-relaxed resize-none"
                />

                {/* 글자 수 표시 */}
                <div className="flex justify-end mt-1.5">
                  <span className={`text-xs ${answers[q.id].trim().length >= 20 ? "text-emerald-500" : "text-slate-300"}`}>
                    {answers[q.id].trim().length}자
                    {answers[q.id].trim().length >= 20 && " ✓"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 2: AI 피드백 ── */}
        {step === "feedback" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 mb-1">AI 피드백</h2>
              <p className="text-sm text-slate-500">작성하신 내용을 AI가 검토했어요. 보완이 필요한 부분을 확인하고 수정해주세요.</p>
            </div>

            {/* 로딩 */}
            {isSubmitting && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-rose-500 animate-pulse" />
                  <Loader2 className="absolute inset-0 m-auto text-white animate-spin" size={24} />
                </div>
                <p className="text-sm text-slate-500 animate-pulse">답변을 분석하고 있어요...</p>
              </div>
            )}

            {/* 피드백 결과 */}
            {feedback && !isSubmitting && (
              <div className="space-y-4">
                {/* 전체 요약 */}
                <div className={`rounded-2xl border p-5 ${feedback.sufficient
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {feedback.sufficient
                      ? <CheckCircle2 size={16} className="text-emerald-600" />
                      : <AlertTriangle size={16} className="text-amber-600" />}
                    <p className={`text-sm font-bold ${feedback.sufficient ? "text-emerald-700" : "text-amber-700"}`}>
                      {feedback.sufficient ? "분석을 시작할 수 있어요!" : "보완이 필요한 부분이 있어요"}
                    </p>
                  </div>
                  <p className={`text-sm leading-relaxed ${feedback.sufficient ? "text-emerald-700" : "text-amber-700"}`}>
                    {feedback.summary}
                  </p>
                </div>

                {/* 개별 피드백 */}
                {feedback.feedbacks.length > 0 && (
                  <div className="space-y-3">
                    {feedback.feedbacks.map((fb, i) => (
                      <div key={i} className="bg-white rounded-xl border border-amber-200 p-4">
                        <p className="text-xs font-bold text-amber-600 mb-1">{fb.question}</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{fb.issue}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 수정 또는 진행 */}
                <div className="flex gap-3">
                  <button onClick={() => setStep("form")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl
                      border-2 border-slate-200 text-slate-600 font-semibold text-sm
                      hover:border-violet-300 hover:text-violet-600 transition-all active:scale-95">
                    <ChevronLeft size={16} />답변 수정하기
                  </button>
                  <button onClick={() => setStep("tool")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl
                      bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-sm
                      hover:from-violet-600 hover:to-rose-600 transition-all shadow-md active:scale-95">
                    {feedback.sufficient ? "다음 단계로" : "그대로 진행"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: AI 도구 선택 ── */}
        {step === "tool" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 mb-1">AI 도구 선택</h2>
              <p className="text-sm text-slate-500">PoC 구현에 사용할 AI 도구를 선택해 주세요. 선택에 따라 프롬프트와 구현 가이드가 최적화됩니다.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {AI_TOOLS.map(tool => {
                  const selected = selectedTools.includes(tool);
                  return (
                    <button key={tool} onClick={() => toggleTool(tool)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 font-semibold text-sm
                        transition-all active:scale-95
                        ${selected
                          ? "bg-violet-500 border-violet-500 text-white shadow-md shadow-violet-200"
                          : "bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600"}`}>
                      {selected && <Check size={14} />}{tool}
                    </button>
                  );
                })}
              </div>
              {selectedTools.length > 0 && (
                <p className="text-sm text-slate-500 mt-3">
                  선택됨: <span className="font-semibold text-violet-600">{selectedTools.join(", ")}</span>
                </p>
              )}
            </div>

            {/* 답변 요약 미리보기 */}
            <div className="bg-gradient-to-br from-slate-50 to-violet-50 rounded-2xl border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">📋 작성한 답변 요약</p>
              <div className="space-y-2">
                {QUESTIONS.map((q, idx) => (
                  <div key={q.id} className="flex gap-2 text-xs text-slate-600">
                    <span className="font-bold text-violet-500 flex-shrink-0">Q{idx + 1}</span>
                    <span className="line-clamp-2">{answers[q.id] || "미작성"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: 결과 ── */}
        {step === "result" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 mb-1">분석 결과</h2>
              <p className="text-sm text-slate-500">업무 재설계 · 시스템 프롬프트 · PoC 설계 가이드</p>
            </div>

            {/* 로딩 */}
            {isGenerating && !hasStructured && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm flex flex-col items-center gap-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-rose-500 animate-pulse" />
                  <Loader2 className="absolute inset-0 m-auto text-white animate-spin" size={28} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-slate-700 text-sm font-semibold animate-pulse">AI가 업무를 분석하고 있어요</p>
                  <p className="text-slate-400 text-xs">비효율 진단 → AI 적용 영역 발견 → 프로세스 재설계 → PoC 스펙 생성</p>
                </div>
                {result && (
                  <div className="w-full bg-slate-50 rounded-xl p-3 text-xs text-slate-400 font-mono max-h-24 overflow-hidden">
                    {result.slice(-200)}
                    <span className="animate-pulse">▌</span>
                  </div>
                )}
              </div>
            )}

            {hasStructured && (
              <>
                {/* 💡 새로운 가능성 — 항상 최상단 하이라이트 */}
                {parsed.diagnosis.includes("💡") && (
                  <div className="bg-gradient-to-r from-violet-500 to-rose-500 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                        <Lightbulb size={13} className="text-white" />
                      </div>
                      <p className="text-sm font-bold">💡 미처 생각 못했던 새로운 가능성</p>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap opacity-95">
                      {(() => {
                        const match = parsed.diagnosis.match(/💡[^\n]*새로운 가능성[^\n]*\n([\s\S]*?)(?=\n###|\n🟢|\n🟡|\n🔴|\n### 예상|$)/);
                        return match ? match[1].trim() : parsed.diagnosis.split("💡")[1]?.split("###")[0]?.trim() || "";
                      })()}
                    </div>
                  </div>
                )}

                {/* 탭 */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                  {RESULT_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all
                        ${activeTab === tab.id ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                {/* ── 자동화 진단 탭 ── */}
                {activeTab === "diagnosis" && (
                  <div className="space-y-3">
                    {/* 업무 본질 */}
                    {parsed.diagnosis.includes("업무 본질") && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">업무 본질 재정의</p>
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {(() => {
                            const match = parsed.diagnosis.match(/### 업무 본질 재정의\n([\s\S]*?)(?=\n###|$)/);
                            return match ? match[1].trim() : "";
                          })()}
                        </div>
                      </div>
                    )}

                    {/* 비효율 원인 */}
                    {parsed.diagnosis.includes("비효율 원인") && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">비효율 원인 진단</p>
                        <div className="space-y-2">
                          {["과부하", "불균형", "비가치"].map((type, i) => {
                            const colors = [
                              "bg-red-50 border-red-200 text-red-700",
                              "bg-amber-50 border-amber-200 text-amber-700",
                              "bg-orange-50 border-orange-200 text-orange-700",
                            ];
                            const regex = new RegExp(`- ${type}:([^\\n]*(?:\\n(?!- )[^\\n]*)*)`, "g");
                            const match = parsed.diagnosis.match(regex)?.[0];
                            if (!match) return null;
                            return (
                              <div key={type} className={`px-3 py-2.5 rounded-xl border text-xs leading-relaxed ${colors[i]}`}>
                                <span className="font-bold">{type}: </span>
                                {match.replace(`- ${type}:`, "").trim()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 🟢🟡🔴 분류 */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">AI 적용 영역 분류</p>
                      <div className="space-y-2">
                        {[
                          { emoji: "🟢", label: "대체 가능", bg: "bg-emerald-50 border-emerald-200" },
                          { emoji: "🟡", label: "증강 가능", bg: "bg-yellow-50 border-yellow-200" },
                          { emoji: "🔴", label: "사람 필수", bg: "bg-red-50 border-red-200" },
                        ].map(({ emoji, label, bg }) => {
                          const regex = new RegExp(`${emoji}[^\\n]*${label}[^\\n]*\\n([\\s\\S]*?)(?=\\n[🟢🟡🔴💡]|\\n### |$)`);
                          const match = parsed.diagnosis.match(regex);
                          if (!match) return null;
                          return (
                            <div key={label} className={`rounded-xl border p-3 ${bg}`}>
                              <p className="text-xs font-bold text-slate-700 mb-1.5">{emoji} {label}</p>
                              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {match[1].trim()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 예상 효과 */}
                    {parsed.diagnosis.includes("예상 효과") && (
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">예상 효과</p>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
                          {(() => {
                            const match = parsed.diagnosis.match(/### 예상 효과\n([\s\S]*?)(?=\n###|<<<|$)/);
                            return match ? match[1].trim() : "";
                          })()}
                        </div>
                      </div>
                    )}

                    {/* 파싱 안 된 나머지 진단 내용 */}
                    {!parsed.diagnosis.includes("업무 본질") && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb size={16} className="text-amber-600" />
                          <h3 className="text-sm font-bold text-amber-800">자동화 진단 리포트</h3>
                        </div>
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{parsed.diagnosis}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── 시스템 프롬프트 탭 ── */}
                {activeTab === "prompt" && (
                  <div className="space-y-3">
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                      <p className="text-xs text-violet-700 leading-relaxed">
                        💡 이 프롬프트는 <strong>기존 프로세스를 그대로 자동화</strong>한 것이 아니라,
                        업무의 목적(Why)만 유지하고 <strong>AI 기반으로 새로 설계</strong>된 것입니다.
                        AI 채팅의 System Prompt란에 붙여넣고 Input 템플릿으로 데이터를 넣어보세요.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-100 hover:bg-violet-200 text-violet-700 transition-all">
                        {copied ? <><Check size={12} />복사됨</> : <><Copy size={12} />전체 복사</>}
                      </button>
                    </div>
                    <CodeBlock content={parsed.prompt} label="시스템 프롬프트 — 복사해서 AI 채팅 System Prompt란에 붙여넣으세요" />
                  </div>
                )}

                {/* ── PoC 설계 가이드 탭 ── */}
                {activeTab === "poc" && (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        🚀 <strong>Codex에 바로 붙여넣기</strong>하면 프로토타입을 만들 수 있어요.
                        ⚡ 30분 단계부터 시작해서 점진적으로 구현해보세요.
                      </p>
                    </div>
                    <CodeBlock content={parsed.poc} label="PoC 설계 가이드 — Codex에 붙여넣어 구현해보세요" />
                  </div>
                )}

                {/* ── 실시간 테스트 탭 ── */}
                {activeTab === "test" && (
                  <div className="space-y-4">
                    {/* 제약 조건 배너 */}
                    <div className={`rounded-xl border p-4 text-xs leading-relaxed ${
                      analyzedMeta?.hasPersonalData
                        ? "bg-red-50 border-red-200 text-red-700"
                        : analyzedMeta?.hasConfidentialData
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}>
                      {analyzedMeta?.hasPersonalData
                        ? "⚠️ 개인정보 포함 업무입니다. 아래 테스트에는 완전히 가상의 마스킹 데이터가 사용됩니다."
                        : analyzedMeta?.hasConfidentialData
                        ? "⚠️ 경영/기밀 정보 포함 업무입니다. 픽션 데이터로 테스트합니다."
                        : "✅ 실제 업무와 유사한 형태의 샘플 데이터로 테스트합니다."}
                    </div>

                    {/* 테스트 시작 버튼 */}
                    {!testResult && !isTesting && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center shadow-md">
                          <Play size={24} className="text-white ml-0.5" />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-bold text-slate-800 mb-1">프롬프트를 실제로 테스트해보세요</p>
                          <p className="text-sm text-slate-500">AI가 가상 데이터를 생성하고 방금 만들어진 시스템 프롬프트로 실제 처리합니다.</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!analyzedMeta?.systemPrompt) return;
                            setIsTesting(true);
                            setTestResult(null);
                            try {
                              const res = await fetch("/api/test", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(analyzedMeta),
                              });
                              const data = await res.json();
                              setTestResult(data);
                            } catch {
                              setTestResult({
                                mockData: { description: "오류 발생", items: [] },
                                testResult: { summary: "테스트 중 오류가 발생했습니다.", output: "" },
                              });
                            } finally {
                              setIsTesting(false);
                            }
                          }}
                          disabled={!analyzedMeta?.systemPrompt}
                          className="flex items-center gap-2 px-8 py-3 rounded-xl
                            bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-sm
                            hover:from-violet-600 hover:to-rose-600 transition-all shadow-md active:scale-95
                            disabled:opacity-40 disabled:cursor-not-allowed">
                          <Play size={16} />테스트 시작
                        </button>
                        {!analyzedMeta?.systemPrompt && (
                          <p className="text-xs text-slate-400">분석이 완료되면 테스트가 가능합니다.</p>
                        )}
                      </div>
                    )}

                    {/* 로딩 */}
                    {isTesting && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-rose-500 animate-pulse" />
                          <Loader2 className="absolute inset-0 m-auto text-white animate-spin" size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700 animate-pulse">가상 데이터 생성 중...</p>
                          <p className="text-xs text-slate-400 mt-1">제약 조건을 반영해서 테스트 데이터를 만들고 AI가 처리합니다</p>
                        </div>
                      </div>
                    )}

                    {/* 테스트 결과 */}
                    {testResult && !isTesting && (
                      <div className="space-y-3">
                        {/* 가상 Input 데이터 */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center">
                              <FileText size={11} className="text-slate-600" />
                            </div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">가상 Input 데이터</p>
                            {(analyzedMeta?.hasPersonalData || analyzedMeta?.hasConfidentialData) && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">마스킹 처리됨</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mb-3">{testResult.mockData.description}</p>
                          <div className="space-y-2">
                            {testResult.mockData.items.map((item, i) => (
                              <div key={i} className="flex items-start gap-3 text-sm">
                                <span className="text-xs font-semibold text-slate-400 min-w-[80px] mt-0.5">{item.label}</span>
                                <span className="text-slate-700 font-mono text-xs bg-slate-50 px-2 py-1 rounded-lg flex-1">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* AI 처리 결과 */}
                        <div className="bg-gradient-to-br from-violet-50 to-rose-50 rounded-2xl border border-violet-200 p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center">
                              <Sparkles size={11} className="text-white" />
                            </div>
                            <p className="text-xs font-bold text-violet-700 uppercase tracking-wider">AI 처리 결과</p>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed mb-4">{testResult.testResult.summary}</p>
                          {testResult.testResult.output && (
                            <div className="bg-white rounded-xl border border-violet-200 p-4">
                              <p className="text-xs font-bold text-slate-500 mb-2">Output</p>
                              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
                                {testResult.testResult.output}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 다시 테스트 */}
                        <button
                          onClick={() => setTestResult(null)}
                          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl
                            border-2 border-slate-200 text-slate-600 font-semibold text-sm
                            hover:border-violet-300 hover:text-violet-600 transition-all active:scale-95">
                          <RefreshCw size={14} />다른 가상 데이터로 다시 테스트
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleDownload}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                        bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm
                        hover:from-violet-600 hover:to-purple-700 transition-all shadow-md shadow-violet-200 active:scale-95">
                      <Download size={15} />.txt 다운로드
                    </button>
                    <button onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                        border-2 border-slate-200 text-slate-600 font-semibold text-sm
                        hover:border-violet-300 hover:text-violet-600 transition-all active:scale-95">
                      {linkCopied ? <><Check size={15} />복사됨!</> : <><Link size={15} />링크 공유</>}
                    </button>
                  </div>
                  {emailSent ? (
                    <div className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-sm">
                      <CheckCircle2 size={16} />이메일 전송 완료!
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="이메일로 결과 전송"
                        className="flex-1 px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-slate-400 min-w-0" />
                      <button onClick={() => { window.open(`mailto:${email}?subject=${encodeURIComponent("업무 자동화 PoC 설계 결과")}&body=${encodeURIComponent(result)}`); setEmailSent(true); }}
                        disabled={!email}
                        className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap">
                        <Mail size={15} />전송
                      </button>
                    </div>
                  )}
                </div>

                {/* 별점 */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-600 mb-3 text-center">워크시트 만족도를 평가해 주세요</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)}
                        className="transition-all active:scale-90">
                        <Star size={32} className={`transition-all ${star <= (hoveredStar || rating) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200"}`} />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-center text-sm text-slate-500 mt-2">
                      {["", "아쉬웠어요", "개선이 필요해요", "보통이에요", "만족스러워요", "정말 유용했어요!"][rating]}
                    </p>
                  )}
                </div>
              </>
            )}

            <button onClick={() => {
                setStep("form");
                setResult("");
                setActiveTab("diagnosis");
                setTestResult(null);
                setAnalyzedMeta(null);
              }}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              <ChevronLeft size={16} />처음부터 다시 작성하기
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      {step === "form" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Object.values(answers).map((a, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all ${a.trim().length >= 20 ? "bg-violet-500" : "bg-slate-200"}`} />
                ))}
              </div>
              <span className="text-xs text-slate-500">
                {Object.values(answers).filter(a => a.trim().length >= 20).length}/6 작성
              </span>
            </div>
            <button onClick={handleSubmit} disabled={!allAnswered || isSubmitting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl
                bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-sm
                hover:from-violet-600 hover:to-rose-600 transition-all shadow-md shadow-violet-200
                active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
              {isSubmitting
                ? <><Loader2 size={15} className="animate-spin" />분석 중...</>
                : <><Sparkles size={15} />제출하기<ArrowRight size={15} /></>}
            </button>
          </div>
          {!allAnswered && (
            <p className="text-center text-xs text-slate-400 pb-2">
              모든 질문에 20자 이상 답변해 주세요
            </p>
          )}
        </div>
      )}

      {step === "tool" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <button onClick={() => setStep("form")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-95">
              <ChevronLeft size={16} />이전
            </button>
            <button onClick={handleGenerate} disabled={selectedTools.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl
                bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-sm
                hover:from-violet-600 hover:to-rose-600 transition-all shadow-md shadow-violet-200
                active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
              <Sparkles size={15} />분석 시작<ArrowRight size={15} />
            </button>
          </div>
          {selectedTools.length === 0 && (
            <p className="text-center text-xs text-slate-400 pb-2">AI 도구를 하나 이상 선택해 주세요</p>
          )}
        </div>
      )}
    </div>
  );
}
