"use client";

import { useState, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Plus,
  Trash2,
  Download,
  Star,
  Mail,
  Copy,
  Check,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Zap,
  Target,
  Layers,
  Repeat,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProcessStep {
  id: string;
  label: string;
  efficient: boolean;
}

interface FormData {
  basics: { name: string; organization: string };
  step1: { taskDescription: string; frequency: string; essentialReason: string };
  step2: { inputSpec: string; outputSpec: string };
  step3: { steps: ProcessStep[] };
  step4: { tools: string[] };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_TOOLS = ["ChatGPT", "Gemini", "Claude", "Copilot", "Perplexity", "기타"];

const STEPS_CONFIG = [
  {
    id: "basics",
    label: "기초 정보",
    icon: Target,
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    accent: "text-violet-600",
    ring: "ring-violet-400",
  },
  {
    id: "step1",
    label: "Step 1: 발견",
    icon: Zap,
    color: "from-amber-400 to-orange-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    accent: "text-amber-600",
    ring: "ring-amber-400",
  },
  {
    id: "step2",
    label: "Step 2: 정의",
    icon: Layers,
    color: "from-sky-400 to-blue-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    accent: "text-sky-600",
    ring: "ring-sky-400",
  },
  {
    id: "step3",
    label: "Step 3: 분해",
    icon: Repeat,
    color: "from-emerald-400 to-teal-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    accent: "text-emerald-600",
    ring: "ring-emerald-400",
  },
  {
    id: "step4",
    label: "Step 4: 전환",
    icon: Sparkles,
    color: "from-rose-400 to-pink-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    accent: "text-rose-600",
    ring: "ring-rose-400",
  },
];

const INITIAL_DATA: FormData = {
  basics: { name: "", organization: "" },
  step1: { taskDescription: "", frequency: "", essentialReason: "" },
  step2: { inputSpec: "", outputSpec: "" },
  step3: { steps: [] },
  step4: { tools: [] },
};

// ─── Helper Components ────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800
        placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400
        focus:border-transparent transition-all duration-200 text-sm shadow-sm ${className}`}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800
        placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400
        focus:border-transparent transition-all duration-200 text-sm shadow-sm resize-none leading-relaxed"
    />
  );
}

// ─── Step Panels ──────────────────────────────────────────────────────────────

function BasicsPanel({ data, onChange }: { data: FormData["basics"]; onChange: (d: FormData["basics"]) => void }) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100">
        <p className="text-sm text-violet-700 leading-relaxed">
          워크시트를 시작하기 전에 기본 정보를 입력해 주세요. 이 정보는 최종 프롬프트에 맥락으로 반영됩니다.
        </p>
      </div>
      <div>
        <Label required>이름</Label>
        <Input value={data.name} onChange={(v) => onChange({ ...data, name: v })} placeholder="예: 김지수" />
      </div>
      <div>
        <Label required>기업 / 소속 / 직무</Label>
        <Input
          value={data.organization}
          onChange={(v) => onChange({ ...data, organization: v })}
          placeholder="예: 스타트업 마케팅팀 콘텐츠 기획자"
        />
      </div>
    </div>
  );
}

function Step1Panel({ data, onChange }: { data: FormData["step1"]; onChange: (d: FormData["step1"]) => void }) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
        <p className="text-sm text-amber-700 leading-relaxed">
          <strong>발견 단계:</strong> 지금 당장 자동화하고 싶은 번거로운 업무 하나를 구체적으로 떠올려 보세요.
        </p>
      </div>
      <div>
        <Label required>번거로운 업무 내용</Label>
        <Textarea
          value={data.taskDescription}
          onChange={(v) => onChange({ ...data, taskDescription: v })}
          placeholder="예: 매주 월요일마다 각 팀 리포트를 수집해서 경영진 주간 요약 보고서를 작성하는 업무. 각 팀 리포트 형식이 달라서 통합하는 데만 2시간이 걸림."
          rows={4}
        />
      </div>
      <div>
        <Label required>빈도 및 소요 시간</Label>
        <Input
          value={data.frequency}
          onChange={(v) => onChange({ ...data, frequency: v })}
          placeholder="예: 매주 월요일, 약 2~3시간 소요"
        />
      </div>
      <div>
        <Label required>그럼에도 이 업무가 존재하는 본질적 이유</Label>
        <Textarea
          value={data.essentialReason}
          onChange={(v) => onChange({ ...data, essentialReason: v })}
          placeholder="예: 경영진이 각 팀의 진행 현황을 한눈에 파악하여 신속한 의사결정을 내리기 위함. 단순 취합이 아니라 이슈 우선순위화가 핵심."
          rows={3}
        />
      </div>
    </div>
  );
}

function Step2Panel({ data, onChange }: { data: FormData["step2"]; onChange: (d: FormData["step2"]) => void }) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100">
        <p className="text-sm text-sky-700 leading-relaxed">
          <strong>정의 단계:</strong> AI에게 무엇을 넣고(Input), 무엇을 받을지(Output)를 명확히 정의하세요.
        </p>
      </div>
      <div>
        <Label required>AI에 넣을 데이터 Input 스펙</Label>
        <Textarea
          value={data.inputSpec}
          onChange={(v) => onChange({ ...data, inputSpec: v })}
          placeholder={`예:\n- 각 팀 리포트 (Google Docs 링크 또는 텍스트 붙여넣기)\n- 이번 주 주요 회사 공지사항 목록\n- 지난주 보고서 (참고용)`}
          rows={5}
        />
      </div>
      <div>
        <Label required>AI에게 기대하는 최종 Output 형태</Label>
        <Textarea
          value={data.outputSpec}
          onChange={(v) => onChange({ ...data, outputSpec: v })}
          placeholder={`예:\n- 경영진용 A4 1장 분량의 주간 요약 보고서\n- 팀별 핵심 성과 3줄 요약\n- 이슈 우선순위 Top 3 (Red/Yellow/Green 신호등 형식)\n- 다음 주 포커스 사항 제안`}
          rows={5}
        />
      </div>
    </div>
  );
}

function Step3Panel({ data, onChange }: { data: FormData["step3"]; onChange: (d: FormData["step3"]) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addStep = () => {
    if (!newLabel.trim()) return;
    const newStep: ProcessStep = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      efficient: true,
    };
    onChange({ steps: [...data.steps, newStep] });
    setNewLabel("");
    inputRef.current?.focus();
  };

  const removeStep = (id: string) => {
    onChange({ steps: data.steps.filter((s) => s.id !== id) });
  };

  const toggleEfficient = (id: string) => {
    onChange({
      steps: data.steps.map((s) => (s.id === id ? { ...s, efficient: !s.efficient } : s)),
    });
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
        <p className="text-sm text-emerald-700 leading-relaxed">
          <strong>분해 단계:</strong> Input → Output 사이의 세부 처리 단계를 추가하고, 각 단계가 효율적인지
          비효율적인지 토글하세요. 비효율 단계가 자동화 우선 대상이 됩니다.
        </p>
      </div>

      {/* Add step input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStep()}
          placeholder="단계 입력 후 Enter 또는 + 버튼 클릭"
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800
            placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400
            focus:border-transparent transition-all duration-200 text-sm shadow-sm"
        />
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600
            text-white font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
        >
          <Plus size={16} />
          추가
        </button>
      </div>

      {/* Step list */}
      {data.steps.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Layers size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">업무 단계를 추가해 보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.steps.map((step, idx) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200
                ${step.efficient ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}
            >
              <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
              <span className="flex-1 text-sm text-slate-700 font-medium">{step.label}</span>
              <button
                onClick={() => toggleEfficient(step.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                  ${step.efficient
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                  }`}
              >
                {step.efficient ? (
                  <><ToggleRight size={14} /> 효율</>
                ) : (
                  <><ToggleLeft size={14} /> 비효율</>
                )}
              </button>
              <button
                onClick={() => removeStep(step.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {data.steps.length > 0 && (
        <div className="flex gap-4 pt-1">
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            효율 {data.steps.filter((s) => s.efficient).length}개
          </div>
          <div className="flex items-center gap-2 text-xs text-rose-600">
            <div className="w-3 h-3 rounded-full bg-rose-400" />
            비효율 {data.steps.filter((s) => !s.efficient).length}개 (자동화 대상)
          </div>
        </div>
      )}
    </div>
  );
}

function Step4Panel({
  data,
  onChange,
}: {
  data: FormData["step4"];
  onChange: (d: FormData["step4"]) => void;
}) {
  const toggleTool = (tool: string) => {
    const current = data.tools;
    const updated = current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool];
    onChange({ tools: updated });
  };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
        <p className="text-sm text-rose-700 leading-relaxed">
          <strong>전환 단계:</strong> 이 업무 자동화에 활용할 AI 도구를 선택하세요. 복수 선택 가능합니다.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {AI_TOOLS.map((tool) => {
          const selected = data.tools.includes(tool);
          return (
            <button
              key={tool}
              onClick={() => toggleTool(tool)}
              className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 font-semibold text-sm
                transition-all duration-200 active:scale-95
                ${selected
                  ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-200"
                  : "bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600"
                }`}
            >
              {selected && <Check size={14} />}
              {tool}
            </button>
          );
        })}
      </div>
      {data.tools.length > 0 && (
        <p className="text-sm text-slate-500">
          선택됨: <span className="font-semibold text-rose-600">{data.tools.join(", ")}</span>
        </p>
      )}
    </div>
  );
}

// ─── Result Panel ─────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  isLoading,
  onDownload,
  onCopy,
  copied,
  email,
  onEmailChange,
  onEmailSend,
  emailSent,
  rating,
  onRating,
}: {
  result: string;
  isLoading: boolean;
  onDownload: () => void;
  onCopy: () => void;
  copied: boolean;
  email: string;
  onEmailChange: (v: string) => void;
  onEmailSend: () => void;
  emailSent: boolean;
  rating: number;
  onRating: (r: number) => void;
}) {
  const [hoveredStar, setHoveredStar] = useState(0);

  if (isLoading && !result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-rose-500 animate-pulse" />
          <Loader2 className="absolute inset-0 m-auto text-white animate-spin" size={28} />
        </div>
        <p className="text-slate-500 text-sm animate-pulse">AI가 최적의 프롬프트를 생성 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Streaming result */}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Sparkles size={15} className="text-violet-500" />
            생성된 시스템 프롬프트
            {isLoading && <Loader2 size={13} className="animate-spin text-slate-400" />}
          </h3>
          <button
            onClick={onCopy}
            disabled={!result}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-slate-100 hover:bg-violet-100 text-slate-600 hover:text-violet-700
              transition-all duration-200 disabled:opacity-40"
          >
            {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
          </button>
        </div>
        <div
          className="bg-slate-900 rounded-2xl p-5 text-sm text-slate-100 font-mono leading-relaxed
            whitespace-pre-wrap min-h-[200px] max-h-[500px] overflow-y-auto
            border border-slate-700 shadow-xl"
        >
          {result || (
            <span className="text-slate-500 font-sans">
              프롬프트가 여기에 실시간으로 출력됩니다...
            </span>
          )}
          {isLoading && <span className="animate-pulse ml-0.5">▌</span>}
        </div>
      </div>

      {/* Footer actions */}
      <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        {/* Download */}
        <button
          onClick={onDownload}
          disabled={!result}
          className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl
            bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm
            hover:from-violet-600 hover:to-purple-700 transition-all duration-200
            shadow-md shadow-violet-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          .txt 파일 다운로드
        </button>

        {/* Email */}
        {emailSent ? (
          <div className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl
            bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 size={16} />
            이메일 전송 완료!
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="이메일 주소 입력"
              className="flex-1 px-3 py-3 rounded-xl border border-slate-200 text-sm
                focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent
                placeholder:text-slate-400 min-w-0"
            />
            <button
              onClick={onEmailSend}
              disabled={!result || !email}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 text-white
                font-semibold text-sm hover:bg-slate-700 transition-all duration-200
                active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Mail size={15} />
              전송
            </button>
          </div>
        )}
      </div>

      {/* Star rating */}
      <div className="pt-4 border-t border-slate-100">
        <p className="text-sm font-semibold text-slate-600 mb-3 text-center">워크시트 만족도를 평가해 주세요</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="transition-all duration-150 active:scale-90"
            >
              <Star
                size={32}
                className={`transition-all duration-150 ${
                  star <= (hoveredStar || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-200 fill-slate-200"
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-sm text-slate-500 mt-2">
            {["", "아쉬웠어요", "개선이 필요해요", "보통이에요", "만족스러워요", "정말 유용했어요!"][rating]}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorksheetPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [rating, setRating] = useState(0);
  const [copied, setCopied] = useState(false);
  const [animDir, setAnimDir] = useState<"forward" | "backward">("forward");
  const [isAnimating, setIsAnimating] = useState(false);

  const totalSteps = STEPS_CONFIG.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isResultStep = currentStep === totalSteps;

  const navigate = useCallback(
    (dir: "forward" | "backward") => {
      if (isAnimating) return;
      setAnimDir(dir);
      setIsAnimating(true);
      setTimeout(() => {
        if (dir === "forward") setCurrentStep((s) => s + 1);
        else setCurrentStep((s) => s - 1);
        setIsAnimating(false);
      }, 180);
    },
    [isAnimating]
  );

  const handleGenerate = async () => {
    navigate("forward");
    setResult("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setResult(full);
      }
    } catch {
      setResult("❌ 오류가 발생했습니다. API 설정을 확인하거나 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `업무자동화_프롬프트_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailSend = () => {
    // In production: call your own email API endpoint
    if (!email || !result) return;
    const subject = encodeURIComponent("업무 자동화 시스템 프롬프트 결과");
    const body = encodeURIComponent(result);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    setEmailSent(true);
  };

  const updateFormData = (key: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const progress = isResultStep ? 100 : Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
                  업무 자동화 워크시트
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">4단계로 완성하는 AI 프롬프트</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-violet-600">{progress}%</p>
              <p className="text-xs text-slate-400">완료</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Step nav pills */}
      {!isResultStep && (
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {STEPS_CONFIG.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === idx;
              const isDone = currentStep > idx;
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (idx < currentStep) {
                      setAnimDir("backward");
                      setCurrentStep(idx);
                    }
                  }}
                  disabled={idx > currentStep}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                    whitespace-nowrap transition-all duration-200 border
                    ${isActive
                      ? `bg-gradient-to-r ${step.color} text-white border-transparent shadow-md`
                      : isDone
                        ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 cursor-pointer"
                        : "bg-white text-slate-400 border-slate-200 opacity-50 cursor-not-allowed"
                    }`}
                >
                  {isDone ? <Check size={12} /> : <Icon size={12} />}
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <div
          className={`transition-all duration-200 ${
            isAnimating
              ? animDir === "forward"
                ? "opacity-0 translate-x-4"
                : "opacity-0 -translate-x-4"
              : "opacity-100 translate-x-0"
          }`}
        >
          {/* Result step */}
          {isResultStep ? (
            <div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">결과 확인</h2>
                </div>
                <p className="text-sm text-slate-500">AI가 생성한 업무 자동화 시스템 프롬프트입니다</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <ResultPanel
                  result={result}
                  isLoading={isLoading}
                  onDownload={handleDownload}
                  onCopy={handleCopy}
                  copied={copied}
                  email={email}
                  onEmailChange={setEmail}
                  onEmailSend={handleEmailSend}
                  emailSent={emailSent}
                  rating={rating}
                  onRating={setRating}
                />
              </div>
              <button
                onClick={() => {
                  navigate("backward");
                }}
                className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft size={16} />
                이전 단계로 돌아가기
              </button>
            </div>
          ) : (
            /* Form steps */
            <div>
              {/* Step header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const s = STEPS_CONFIG[currentStep];
                    const Icon = s.icon;
                    return (
                      <>
                        <div
                          className={`w-7 h-7 rounded-xl bg-gradient-to-br ${s.color}
                            flex items-center justify-center shadow-sm`}
                        >
                          <Icon size={14} className="text-white" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">{s.label}</h2>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                {currentStep === 0 && (
                  <BasicsPanel data={formData.basics} onChange={(v) => updateFormData("basics", v)} />
                )}
                {currentStep === 1 && (
                  <Step1Panel data={formData.step1} onChange={(v) => updateFormData("step1", v)} />
                )}
                {currentStep === 2 && (
                  <Step2Panel data={formData.step2} onChange={(v) => updateFormData("step2", v)} />
                )}
                {currentStep === 3 && (
                  <Step3Panel data={formData.step3} onChange={(v) => updateFormData("step3", v)} />
                )}
                {currentStep === 4 && (
                  <Step4Panel data={formData.step4} onChange={(v) => updateFormData("step4", v)} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom nav */}
      {!isResultStep && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <button
              onClick={() => navigate("backward")}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200
                text-slate-600 font-semibold text-sm hover:bg-slate-50
                transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              <ChevronLeft size={16} />
              이전
            </button>

            <div className="flex-1 flex justify-center gap-1.5">
              {STEPS_CONFIG.map((_, idx) => (
                <div
                  key={idx}
                  className={`rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? "w-6 h-2 bg-violet-500"
                      : idx < currentStep
                        ? "w-2 h-2 bg-violet-300"
                        : "w-2 h-2 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {isLastStep ? (
              <button
                onClick={handleGenerate}
                disabled={formData.step4.tools.length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl
                  bg-gradient-to-r from-violet-500 to-rose-500 text-white font-bold text-sm
                  hover:from-violet-600 hover:to-rose-600
                  transition-all duration-200 shadow-md shadow-violet-200
                  active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={15} />
                프롬프트 생성
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => navigate("forward")}
                className="flex items-center gap-2 px-5 py-3 rounded-xl
                  bg-slate-900 text-white font-semibold text-sm
                  hover:bg-slate-700 transition-all duration-200 active:scale-95"
              >
                다음
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
