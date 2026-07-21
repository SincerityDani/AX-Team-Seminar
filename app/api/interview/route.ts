// 📁 파일 경로: app/api/interview/route.ts

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 26;

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// ─── Input Validation ─────────────────────────────────────────────────────────
const MAX_ANSWER_LENGTH = 3000;
const INJECTION_PATTERNS = [
  /ignore (all |previous |above |prior )?instructions?/i,
  /disregard (all |previous |above |prior )?instructions?/i,
  /you are now/i,
  /new (role|persona|identity|instructions?)/i,
  /system\s*prompt/i,
];

function sanitize(text: string): string {
  const trimmed = text.trim().slice(0, MAX_ANSWER_LENGTH);
  if (INJECTION_PATTERNS.some(p => p.test(trimmed))) return "[보안 필터에 의해 제거된 내용]";
  return trimmed;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormAnswers {
  q1: string; // 업무 소개
  q2: string; // 핵심 업무
  q3: string; // Input/Output 데이터 형태
  q4: string; // 비효율 3관점
  q5: string; // 업무 존재 목적
  q6: string; // 제약 조건
}

interface CoachRequest {
  mode: "coach";          // 답변 충분성 코칭
  questionIndex: number;  // 0~5 (q1~q6)
  answer: string;         // 현재 질문 답변
  allAnswers: FormAnswers; // 전체 답변 현황
}

interface AnalyzeRequest {
  mode: "analyze";        // 최종 분석 (generate/route.ts로 넘기기 전 데이터 정제)
  answers: FormAnswers;
}

type InterviewRequest = CoachRequest | AnalyzeRequest;

// ─── 질문별 충분성 기준 ───────────────────────────────────────────────────────

const QUESTION_CRITERIA = [
  {
    label: "업무 소개",
    minLength: 50,
    checks: [
      { desc: "조직 목표 언급", test: (a: string) => a.length > 30 },
      { desc: "본인 역할 언급", test: (a: string) => /담당|맡|책임|처리|관리|운영|지원|작성|검토|분석/.test(a) },
    ],
    coaching: "조직의 목표와 본인의 업무가 어떻게 연결되는지 조금 더 구체적으로 써주시면 더 정확한 분석이 가능해요.",
  },
  {
    label: "핵심 업무",
    minLength: 30,
    checks: [
      { desc: "구체적 업무명", test: (a: string) => a.length > 20 },
      { desc: "무겁거나 번거로운 이유", test: (a: string) => /시간|오래|반복|번거|힘들|많|복잡|귀찮|매번|일일이/.test(a) },
    ],
    coaching: "그 업무가 왜 무겁거나 번거로운지 이유도 함께 써주시면 비효율 원인을 더 정확하게 찾을 수 있어요.",
  },
  {
    label: "Input/Output 데이터",
    minLength: 40,
    checks: [
      { desc: "Input 형태", test: (a: string) => /input|인풋|입력|자료|데이터|파일|엑셀|이메일|문서|시스템|받|수집/.test(a.toLowerCase()) },
      { desc: "Output 형태", test: (a: string) => /output|아웃풋|출력|결과|보고|제출|전달|만들|작성|표|리포트/.test(a.toLowerCase()) },
      { desc: "활용처/수신자", test: (a: string) => /누구|팀|부서|담당|경영|상사|고객|전달|제출|보고/.test(a) },
    ],
    coaching: "Input이 어디서 오는지(시스템명, 외부 수신 등), Output이 누구에게 어떻게 전달되는지도 써주시면 좋겠어요.",
  },
  {
    label: "비효율 구간",
    minLength: 40,
    checks: [
      { desc: "비효율 구간 특정", test: (a: string) => a.length > 30 },
      { desc: "원인 언급", test: (a: string) => /때문|이유|원인|발생|생기|없어|안|못|어려|힘들/.test(a) },
    ],
    coaching: "과부하(정보량/시간), 불균형(업무 몰림), 비가치(단순 반복) 중 해당하는 부분과 왜 그런지 이유를 구체적으로 써주세요.",
  },
  {
    label: "업무 존재 목적",
    minLength: 30,
    checks: [
      { desc: "가치 중심 서술", test: (a: string) => /위해|목적|가치|필요|중요|의미|역할|기여|달성|결과/.test(a) },
    ],
    coaching: "단순히 '급여 지급을 위해'처럼 절차적 이유보다, 이 업무가 조직에 어떤 가치를 만드는지 관점으로 써주시면 더 의미 있는 재설계가 나와요.",
  },
  {
    label: "제약 조건",
    minLength: 20,
    checks: [
      { desc: "제약 유형 언급", test: (a: string) => /개인정보|보안|법령|규정|가이드|내부|시스템|접근|권한|제한|없|해당/.test(a) },
    ],
    coaching: "개인정보, 경영 정보 유출 여부, 법령/내부 규범 준수 사항 등을 구체적으로 알려주시면 PoC 설계에 자동으로 반영돼요. 특별한 제약이 없다면 '없음'이라고 써주세요.",
  },
];

// ─── AI 코치 시스템 프롬프트 ──────────────────────────────────────────────────

function buildCoachPrompt(questionIndex: number, answer: string, allAnswers: FormAnswers): string {
  const q = QUESTION_CRITERIA[questionIndex];
  const failedChecks = q.checks.filter(c => !c.test(answer));
  const isSufficient = answer.length >= q.minLength && failedChecks.length === 0;

  const context = `
현재 질문: Q${questionIndex + 1} — ${q.label}
사용자 답변: "${answer}"
답변 길이: ${answer.length}자
충분성 판단: ${isSufficient ? "충분함" : "보완 필요"}
${failedChecks.length > 0 ? `부족한 부분: ${failedChecks.map(c => c.desc).join(", ")}` : ""}

전체 답변 현황:
Q1 (업무 소개): ${allAnswers.q1 ? "작성됨" : "미작성"}
Q2 (핵심 업무): ${allAnswers.q2 ? "작성됨" : "미작성"}
Q3 (Input/Output): ${allAnswers.q3 ? "작성됨" : "미작성"}
Q4 (비효율): ${allAnswers.q4 ? "작성됨" : "미작성"}
Q5 (존재 목적): ${allAnswers.q5 ? "작성됨" : "미작성"}
Q6 (제약 조건): ${allAnswers.q6 ? "작성됨" : "미작성"}`;

  const systemPrompt = `당신은 업무 자동화 워크시트 작성을 돕는 AI 코치입니다.
사용자가 현재 질문에 답변을 작성하면, 답변이 충분한지 판단하고 피드백을 줍니다.

[응답 규칙]
- 반드시 JSON으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
- sufficient: true면 칭찬 한 줄 + 다음으로 넘어가도 된다는 안내
- sufficient: false면 구체적으로 어떤 내용을 추가해야 하는지 안내
- message는 2문장 이내, 친근하고 간결하게
- 한국어로 작성

응답 형식:
{
  "sufficient": true 또는 false,
  "message": "피드백 메시지"
}`;

  return JSON.stringify({ system: systemPrompt, user: context });
}

// ─── 데이터 정제 (generate API로 넘기기 위한 구조화) ─────────────────────────

function buildAnalyzePrompt(answers: FormAnswers): string {
  const systemPrompt = `당신은 업무 자동화 분석 전문가입니다.
사용자가 작성한 6개 질문 답변을 분석하여 반드시 아래 JSON 구조로만 응답하세요.
JSON 외에 어떤 텍스트도 출력하지 마세요.

{
  "basics": {
    "name": "",
    "organization": "Q1에서 파악한 소속/직무"
  },
  "step1": {
    "taskDescription": "Q2에서 파악한 핵심 업무 (구체적으로)",
    "frequency": "Q2/Q3에서 파악한 빈도와 규모",
    "essentialReason": "Q5의 업무 존재 목적"
  },
  "step2": {
    "inputSpec": "Q3에서 파악한 Input 데이터 형태와 출처",
    "outputSpec": "Q3에서 파악한 Output 형태와 수신자"
  },
  "step3": {
    "steps": [
      {
        "id": "1",
        "label": "프로세스 단계명 (Q2/Q3/Q4 답변에서 추론)",
        "efficient": true 또는 false,
        "tags": ["반복 작업", "실수 위험", "시간 소모", "판단 필요", "수작업"] 중 해당하는 것
      }
    ],
    "inefficiencyAnalysis": {
      "overload": "Q4에서 과부하 관련 내용",
      "imbalance": "Q4에서 불균형 관련 내용",
      "nonValue": "Q4에서 비가치 관련 내용"
    }
  },
  "step4": {
    "tools": [],
    "usageMode": "",
    "constraints": "Q6의 제약 조건 요약",
    "hasPersonalData": Q6에 개인정보 언급 여부 true/false,
    "hasConfidentialData": Q6에 경영/기밀 정보 언급 여부 true/false
  }
}`;

  const userPrompt = `다음 6개 질문 답변을 분석해주세요.

Q1 (업무 소개): ${answers.q1}

Q2 (핵심 업무): ${answers.q2}

Q3 (Input/Output): ${answers.q3}

Q4 (비효율 구간): ${answers.q4}

Q5 (업무 존재 목적): ${answers.q5}

Q6 (제약 조건): ${answers.q6}`;

  return JSON.stringify({ system: systemPrompt, user: userPrompt });
}

// ─── LLM 호출 헬퍼 ───────────────────────────────────────────────────────────

async function callLLM(system: string, user: string): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (nvidiaKey) {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nvidiaKey}` },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        max_tokens: 500,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // 데모 모드
  return JSON.stringify({ sufficient: true, message: "좋아요! 다음 질문으로 넘어가세요. (데모 모드)" });
}

// ─── Feedback 프롬프트 ────────────────────────────────────────────────────────

function buildFeedbackPrompt(answers: FormAnswers): string {
  const systemPrompt = `당신은 업무 자동화 워크시트 검토 전문가입니다.
사용자가 작성한 6개 질문 답변 전체를 한 번에 읽고, AI가 업무를 정확하게 분석하기 위해 꼭 필요한 정보가 충분한지 판단하세요.

[판단 기준]
AI가 업무를 이해하려면 반드시 이 3가지가 명확해야 합니다:
① 이 업무의 목적 (왜 존재하는가)
② Input → Output 흐름 (무엇이 들어오고 무엇이 나가는가)
③ 어디서 시간/에너지가 낭비되는가 (병목)

[응답 규칙]
반드시 아래 JSON 형식으로만 응답하세요. JSON 외 텍스트 절대 금지.

{
  "sufficient": true 또는 false,
  "summary": "전체 답변에 대한 한 줄 총평 (친근하고 간결하게, 충분하면 격려, 부족하면 핵심 이유)",
  "feedbacks": [
    {
      "question": "Q2 (핵심 업무)",
      "issue": "병목 구간이 구체적으로 드러나지 않았어요. 어느 단계에서 시간이 가장 많이 걸리는지 써주시면 더 정확한 분석이 가능해요."
    }
  ]
}

feedbacks는 정말 부족한 항목만 (최대 2개), 충분하면 빈 배열 []로 반환하세요.
모든 텍스트는 한국어로 작성하세요.`;

  const userPrompt = `다음 6개 질문 답변 전체를 검토해주세요.

Q1 (업무 소개 — 조직 목표와 연결): 
${answers.q1 || "(미작성)"}

Q2 (핵심 업무 — 무겁고 번거로운 이유):
${answers.q2 || "(미작성)"}

Q3 (Input/Output — 데이터 형태, 출처, 수신자):
${answers.q3 || "(미작성)"}

Q4 (비효율 구간 — 과부하/불균형/비가치 관점):
${answers.q4 || "(미작성)"}

Q5 (업무 존재 목적 — 조직에 만드는 가치):
${answers.q5 || "(미작성)"}

Q6 (제약 조건 — 보안/법령/개인정보):
${answers.q6 || "(미작성)"}`;

  return JSON.stringify({ system: systemPrompt, user: userPrompt });
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }), {
      status: 429, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const mode = body.mode;

    // ── 피드백 모드 (제출 후 1회 전체 검토) ──
    if (mode === "feedback") {
      const rawAnswers = body.answers || {};
      const answers: FormAnswers = {
        q1: sanitize(rawAnswers.q1 || ""),
        q2: sanitize(rawAnswers.q2 || ""),
        q3: sanitize(rawAnswers.q3 || ""),
        q4: sanitize(rawAnswers.q4 || ""),
        q5: sanitize(rawAnswers.q5 || ""),
        q6: sanitize(rawAnswers.q6 || ""),
      };

      // 데모 모드
      const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
      const openaiKey = process.env.OPENAI_API_KEY?.trim();
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      const hasKey = (!!nvidiaKey && nvidiaKey.length > 0)
        || (!!openaiKey && openaiKey.length > 0)
        || (!!geminiKey && geminiKey.length > 0);

      if (!hasKey) {
        // 데모: 간단한 로컬 체크
        const missingItems: { question: string; issue: string }[] = [];
        if (answers.q3.length < 30) {
          missingItems.push({ question: "Q3 (Input/Output)", issue: "Input과 Output의 데이터 형태를 더 구체적으로 작성해주세요." });
        }
        if (answers.q4.length < 30) {
          missingItems.push({ question: "Q4 (비효율 구간)", issue: "어느 단계에서 왜 비효율이 생기는지 구체적으로 써주세요." });
        }
        return new Response(JSON.stringify({
          sufficient: missingItems.length === 0,
          summary: missingItems.length === 0
            ? "전반적으로 잘 작성하셨어요! 분석을 시작할 수 있습니다. (데모 모드)"
            : "일부 항목을 보완하면 더 정확한 분석이 가능해요. (데모 모드)",
          feedbacks: missingItems,
        }), { headers: { "Content-Type": "application/json" } });
      }

      const parsed = JSON.parse(buildFeedbackPrompt(answers));
      const raw = await callLLM(parsed.system, parsed.user);

      try {
        const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(clean);
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
      } catch {
        // 파싱 실패 시 그냥 통과
        return new Response(JSON.stringify({
          sufficient: true,
          summary: "답변을 확인했어요. 분석을 시작할 수 있습니다.",
          feedbacks: [],
        }), { headers: { "Content-Type": "application/json" } });
      }
    }

    // ── 분석 모드 (6개 답변 → JSON 구조화) ──
    if (mode === "analyze") {
      const rawAnswers = body.answers || {};
      const answers: FormAnswers = {
        q1: sanitize(rawAnswers.q1 || ""),
        q2: sanitize(rawAnswers.q2 || ""),
        q3: sanitize(rawAnswers.q3 || ""),
        q4: sanitize(rawAnswers.q4 || ""),
        q5: sanitize(rawAnswers.q5 || ""),
        q6: sanitize(rawAnswers.q6 || ""),
      };

      const parsed = JSON.parse(buildAnalyzePrompt(answers));
      const raw = await callLLM(parsed.system, parsed.user);

      try {
        const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const result = JSON.parse(clean);
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ error: "분석 중 오류가 발생했습니다. 다시 시도해 주세요." }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "잘못된 요청입니다." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Interview route error:", err);
    return new Response(JSON.stringify({ error: "서버 오류가 발생했습니다." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
