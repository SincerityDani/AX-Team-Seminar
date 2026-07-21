// 📁 파일 경로: app/api/generate/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 26;

// ─── Rate Limiting (in-memory, per-process) ───────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;        // 최대 요청 수
const RATE_WINDOW_MS = 60_000; // 1분

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
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─── Input Validation ─────────────────────────────────────────────────────────
const MAX_FIELD_LENGTH = 2000;   // 필드 하나당 최대 글자 수
const MAX_STEPS = 20;            // 프로세스 단계 최대 개수
const MAX_TOOLS = 10;            // AI 도구 최대 선택 수

// Prompt Injection 패턴 — 명백한 공격 시도만 차단
const INJECTION_PATTERNS = [
  /ignore (all |previous |above |prior )?instructions?/i,
  /disregard (all |previous |above |prior )?instructions?/i,
  /you are now/i,
  /new (role|persona|identity|instructions?)/i,
  /system\s*prompt/i,
  /\[system\]/i,
  /<<<.*>>>/,  // 우리 구분자 위조 방지
];

function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text));
}

function sanitizeString(value: unknown, maxLen = MAX_FIELD_LENGTH): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, maxLen);
  if (containsInjection(trimmed)) return "[보안 필터에 의해 제거된 내용]";
  return trimmed;
}

function validateAndSanitize(raw: unknown): WorksheetData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;

  try {
    const basics = d.basics as Record<string, unknown> || {};
    const step1 = d.step1 as Record<string, unknown> || {};
    const step2 = d.step2 as Record<string, unknown> || {};
    const step3 = d.step3 as Record<string, unknown> || {};
    const step4 = d.step4 as Record<string, unknown> || {};

    const rawSteps = Array.isArray(step3.steps) ? step3.steps.slice(0, MAX_STEPS) : [];
    const steps: Step[] = rawSteps.map((s: unknown) => {
      const step = s as Record<string, unknown>;
      const validTags: InefficientTag[] = ["반복 작업", "실수 위험", "시간 소모", "판단 필요", "수작업"];
      const tags = Array.isArray(step.tags)
        ? (step.tags as unknown[]).filter((t): t is InefficientTag => validTags.includes(t as InefficientTag))
        : [];
      return {
        id: sanitizeString(step.id, 50),
        label: sanitizeString(step.label, 200),
        efficient: typeof step.efficient === "boolean" ? step.efficient : true,
        tags,
      };
    });

    const validModes: UsageMode[] = ["chat", "document", "repeat"];
    const rawMode = step4.usageMode;
    const usageMode: UsageMode | "" = validModes.includes(rawMode as UsageMode) ? rawMode as UsageMode : "";

    const rawTools = Array.isArray(step4.tools) ? step4.tools : [];
    const validTools = ["ChatGPT", "Gemini", "Claude", "Codex", "Copilot", "기타"];
    const tools = rawTools
      .slice(0, MAX_TOOLS)
      .filter((t): t is string => typeof t === "string" && validTools.includes(t));

    return {
      basics: {
        name: sanitizeString(basics.name, 100),
        organization: sanitizeString(basics.organization, 200),
      },
      step1: {
        taskDescription: sanitizeString(step1.taskDescription),
        frequency: sanitizeString(step1.frequency, 200),
        essentialReason: sanitizeString(step1.essentialReason),
      },
      step2: {
        inputSpec: sanitizeString(step2.inputSpec),
        outputSpec: sanitizeString(step2.outputSpec),
      },
      step3: { steps },
      step4: { tools, usageMode },
    };
  } catch {
    return null;
  }
}

type InefficientTag = "반복 작업" | "실수 위험" | "시간 소모" | "판단 필요" | "수작업";
type UsageMode = "chat" | "document" | "repeat";

interface Step {
  id: string;
  label: string;
  efficient: boolean;
  tags: InefficientTag[];
}

interface WorksheetData {
  basics: { name: string; organization: string };
  step1: { taskDescription: string; frequency: string; essentialReason: string };
  step2: { inputSpec: string; outputSpec: string };
  step3: { steps: Step[] };
  step4: { tools: string[]; usageMode: UsageMode | "" };
}

function buildPrompt(data: WorksheetData): string {
  const { basics, step1, step2, step3, step4 } = data;

  const extStep4 = step4 as Record<string, unknown>;
  const extStep3 = step3 as Record<string, unknown>;

  const constraints = (extStep4.constraints as string) || "";
  const hasPersonalData = !!(extStep4.hasPersonalData as boolean);
  const hasConfidentialData = !!(extStep4.hasConfidentialData as boolean);
  const inefficiencyAnalysis = (extStep3.inefficiencyAnalysis as Record<string, string>) || {};

  const toolList = step4.tools.join(", ") || "미선택";

  const allSteps = step3.steps
    .map((s, i) => {
      const tagLine = !s.efficient && s.tags.length > 0 ? ` (${s.tags.join(", ")})` : "";
      return `  ${i + 1}. ${s.efficient ? "✅" : "⚠️"} ${s.label}${tagLine}`;
    })
    .join("\n");

  const constraintGuide = hasPersonalData
    ? "⚠️ 개인정보 포함 — PoC 테스트 시 반드시 마스킹된 가상 데이터 사용. 실제 데이터 AI 입력 금지."
    : hasConfidentialData
    ? "⚠️ 경영/기밀 정보 포함 — 완전한 픽션 더미 데이터로만 테스트. 실제 수치/명칭 사용 금지."
    : "✅ 특별한 데이터 제약 없음 — 실제와 유사한 형태의 샘플 데이터 사용 가능.";

  const dataLabel = hasPersonalData ? "개인정보 완전 마스킹" : hasConfidentialData ? "픽션 데이터로 대체" : "실제와 유사한 형태";

  const systemInstruction = `당신은 업무 자동화 전문 컨설턴트이자 AI 프롬프트 엔지니어입니다.
사용자가 제공한 업무 분석 데이터를 바탕으로, 기존 프로세스를 유지하며 AI를 끼워 넣는 것이 아니라
업무의 본질적 목적만 유지하고 AI를 전제로 프로세스를 새로 설계하는 것이 목표입니다.

반드시 아래 3개 섹션을 순서대로 출력하십시오. 구분자를 정확히 유지하세요.

<<<DIAGNOSIS>>>
## 비효율 진단 및 AI 적용 영역 분석

### 업무 본질 재정의
이 업무의 핵심 목적(Why)을 한 문장으로 명확히 정의하세요.
기존 방식의 제약(시스템 한계, 관행, 규정)과 그 제약이 없다면 어떤 단계가 불필요해지는지 분석하세요.

### 비효율 원인 진단
아래 3관점에서 구체적으로 어디서 낭비가 발생하는지 분석하세요:
- 과부하: 정보량/시간 초과로 발생하는 낭비
- 불균형: 특정 시점 몰림으로 발생하는 병목
- 비가치: 본질과 무관한 형식적 작업

### AI 적용 영역 분류
각 프로세스 단계를 분류하고 구체적 자동화 방법을 제시하세요:

🟢 대체 가능 (AI가 사람을 완전히 대신)
- [단계명]: [적용 가능한 AI 기능] → [구체적 처리 방법]

🟡 증강 가능 (사람이 하되 AI가 보조)
- [단계명]: [AI가 도울 수 있는 부분] → [사람이 최종 확인해야 하는 이유]

🔴 사람 필수 (AI는 정보 제공만)
- [단계명]: [사람 판단이 필요한 이유] → [AI가 보조할 수 있는 범위]

💡 새로운 가능성 (지금은 안 하지만 AI로 가능)
- [현재 하지 않지만 이 업무 맥락에서 AI로 새롭게 할 수 있는 것 1~2가지]

### 예상 효과
- 시간 절감: [현재 소요 시간 기반 수치 예측]
- 오류율 감소: [구체적 근거]
- PoC 최우선 구현 추천: [🟢 단계 중 임팩트 가장 큰 것]
<<<\/DIAGNOSIS>>>

<<<PROMPT>>>
[기존 프로세스를 그대로 자동화하는 것이 아니라, 업무의 목적(Why)만 유지하고 AI 기반으로 새로 설계된 시스템 프롬프트]

# 역할 (Role)
[소속/직무]에서 [업무명]을 담당하는 AI 어시스턴트입니다.
목표는 [업무 본질 목적]을 달성하는 것이며, 기존 수작업 프로세스를 AI 기반으로 재설계하여 처리합니다.

# 재설계된 업무 프로세스
[기존 프로세스를 버리고, 🟢 대체 가능 단계를 AI가 처리하는 새로운 흐름으로 설계]
각 단계마다 AI가 수행할 구체적 처리 로직을 포함하세요.

# Input 수신 방법
[데이터를 어떻게 입력받는지 — 활용 도구에 맞게]

## Input 템플릿 (복사해서 사용)
\`\`\`
[실제 업무 데이터에 맞는 빈 양식]
\`\`\`

# Output 형식
[실제 표나 구조화된 형태로 — 예상 Output 샘플 포함]

# 제약 및 예외 처리
${constraintGuide}
[실제 발생 가능한 예외와 AI 대응]
- 판단 불가능한 경우: 임의 처리 금지, 어떤 정보가 필요한지 명시하여 사용자에게 재요청
<<<\/PROMPT>>>

<<<POC>>>
## Codex PoC 설계 가이드

### PoC 핵심 가설
[🟢 대체 가능 단계]를 AI로 처리하면 [예상 효과]를 달성할 수 있다.

### 구현 범위 (🟢 단계만, 외부 시스템 연동 불필요한 것 우선)
[🟡/🔴는 제외]

### 데이터 설계
${constraintGuide}

#### 테스트용 가상 데이터 (즉시 사용 가능)
[업무 특성에 맞게 현실감 있는 가상 데이터 3~5건 — ${dataLabel}]

### Codex 구현 단계
⚡ 30분 (기본):
1. [구현할 기능과 방법]

⚡⚡ 2시간 (심화):
2. [추가 구현 기능]

⚡⚡⚡ 반나절 (완성):
3. [고급 기능]

### 예상 Output 샘플
[PoC 성공 시 나와야 하는 결과물 — 실제 표 형식으로]

### 기술 스택
- LLM: ${toolList}
- 파일 처리: [Input 형태에 따라]
- UI: [Codex로 빠르게 만들 수 있는 최소 형태]

### 성공 기준
- 테스트: 10건 중 X건 이상 정확 처리
- 시간: 기존 대비 X% 단축

### PoC → 실제 도입 체크리스트
[보안 검토 / 시스템 연동 / 내부 승인 / 파일럿 운영]
<<<\/POC>>>

[핵심 원칙]
- 구분자를 정확히 유지할 것
- 기존 프로세스 단순 자동화가 아니라 목적(Why) 기반으로 재설계할 것
- 사용자 입력을 단순 열거하지 말고 실행 가능한 수준으로 구체화할 것
- 한국어로 작성할 것`;

  const userInstruction = `## 업무 분석 데이터

### 기본 정보
- 소속/직무: ${basics.organization || "미입력"}

### 업무 내용
- 핵심 업무: ${step1.taskDescription || "미입력"}
- 빈도/규모: ${step1.frequency || "미입력"}
- 업무 존재 목적(Why): ${step1.essentialReason || "미입력"}

### Input / Output
[Input]
${step2.inputSpec || "미입력"}

[Output]
${step2.outputSpec || "미입력"}

### 프로세스 단계
${allSteps || "미입력"}

### 비효율 분석
- 과부하: ${inefficiencyAnalysis.overload || "미입력"}
- 불균형: ${inefficiencyAnalysis.imbalance || "미입력"}
- 비가치: ${inefficiencyAnalysis.nonValue || "미입력"}

### 사용 도구
${toolList}

### 제약 조건
${constraints || "없음"}
- 개인정보 포함: ${hasPersonalData ? "예" : "아니오"}
- 경영/기밀 정보 포함: ${hasConfidentialData ? "예" : "아니오"}`;

  return JSON.stringify({ system: systemInstruction, user: userInstruction });
}



export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  // Content-Type 검사
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.json();
    const data = validateAndSanitize(rawBody);

    if (!data) {
      return new Response(JSON.stringify({ error: "입력 데이터가 올바르지 않습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(buildPrompt(data));

    // Detect which AI provider to use based on available env vars.
    // Trim and explicitly check length to avoid stray whitespace or
    // empty-string env vars being treated as "configured".
    const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const hasNvidia = !!nvidiaKey && nvidiaKey.length > 0;
    const hasOpenAI = !!openaiKey && openaiKey.length > 0;
    const hasGemini = !!geminiKey && geminiKey.length > 0;

    if (!hasNvidia && !hasOpenAI && !hasGemini) {
      // Demo mode: stream a mock response when no API keys are configured
      const mockResponse = generateMockResponse(data);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const chunks = mockResponse.match(/.{1,30}/g) || [];
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 30));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Priority: NVIDIA NIM (free, no card, OpenAI-compatible) → Gemini → OpenAI
    if (hasNvidia) {
      return await streamOpenAICompatible(
        parsed.system,
        parsed.user,
        nvidiaKey!,
        "https://integrate.api.nvidia.com/v1",
        "meta/llama-3.1-8b-instruct",
        "NVIDIA NIM"
      );
    } else if (hasGemini) {
      return await streamGemini(parsed.system, parsed.user, geminiKey!);
    } else {
      return await streamOpenAICompatible(
        parsed.system,
        parsed.user,
        openaiKey!,
        "https://api.openai.com/v1",
        "gpt-4o-mini",
        "OpenAI"
      );
    }
  } catch (err) {
    console.error("Generate error:", err);
    // Surface the real error reason as a readable stream chunk so the
    // frontend (which reads the response body as plain text) can show
    // something more useful than a generic failure message.
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`❌ 오류가 발생했습니다.\n\n상세 내용: ${message}`)
        );
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

async function streamOpenAICompatible(
  system: string,
  user: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  providerLabel: string
): Promise<Response> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 2000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`${providerLabel} API error: ${response.status}`, errorBody);
    throw new Error(`AI 서비스 오류가 발생했습니다. (코드: ${response.status})`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.trim() !== "");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.choices?.[0]?.delta?.content || "";
                if (text) controller.enqueue(encoder.encode(text));
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function streamGemini(
  system: string,
  user: string,
  apiKey: string
): Promise<Response> {
  const fullPrompt = `${system}\n\n${user}`;

  // Use the ?key= query param (confirmed working via direct browser test)
  // rather than the x-goog-api-key header, since some edge/proxy runtimes
  // can strip or mangle custom headers before the request reaches Google.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(
    apiKey
  )}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }], role: "user" }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    // 내부 에러 상세는 서버 로그에만 기록, 클라이언트에는 일반 메시지만
    const errorBody = await response.text().catch(() => "");
    console.error(`Gemini API error: ${response.status}`, errorBody);
    throw new Error(`AI 서비스 오류가 발생했습니다. (코드: ${response.status})`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6);
                const parsed = JSON.parse(jsonStr);
                const text =
                  parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (text) controller.enqueue(encoder.encode(text));
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function generateMockResponse(data: WorksheetData): string {
  const org = data.basics.organization || "해당 직무";
  const task = data.step1.taskDescription || "반복 업무";
  const tools = data.step4.tools.join(", ") || "AI 도구";
  const steps = data.step3.steps;

  const inefficientCount = steps.filter((s) => !s.efficient).length;

  return `## 🔍 분석 요약

입력하신 워크시트를 분석한 결과, **${org}** 분야의 "${task}" 업무에서 총 ${steps.length}개 단계 중 **${inefficientCount}개의 비효율 단계**가 자동화 우선 대상으로 식별되었습니다. ${tools}를 활용하면 반복적인 처리 시간을 크게 단축할 수 있습니다.

---

## ⚡ 비효율 단계 개선 제언

${
  steps
    .filter((s) => !s.efficient)
    .map((s) => `- **${s.label}**: AI 자동 처리 또는 템플릿화로 개선 가능`)
    .join("\n") || "- 모든 단계가 효율적으로 분류되었습니다."
}

---

## 🤖 최종 시스템 프롬프트

\`\`\`
당신은 ${org} 전문가를 보조하는 AI 어시스턴트입니다.

목표는 사용자가 요청한 "${task}" 업무를 자동화하는 것입니다.
이 업무의 본질적 목적은 "${data.step1.essentialReason || "핵심 가치 실현"}"이므로 이를 반드시 준수하십시오.

## 업무 프로세스

${steps.map((s, i) => `${i + 1}. ${s.efficient ? "✅ [효율]" : "⚠️ [자동화 대상]"} ${s.label}`).join("\n") || "세부 단계를 입력하세요."}

## Input 데이터 사양

${data.step2.inputSpec || "Input 데이터를 정의하세요."}

## Output 희망 형태

${data.step2.outputSpec || "Output 형태를 정의하세요."}

## 처리 지침

1. 위 Input 데이터를 순서대로 검토하세요.
2. 비효율 단계는 자동으로 처리하고, 효율 단계는 기존 방식을 유지하세요.
3. 최종 Output은 지정된 형태로 정확하게 반환하세요.
4. 불명확한 Input이 있을 경우, 처리를 중단하고 구체적인 확인을 요청하세요.
5. ${tools} 환경에 최적화된 방식으로 응답을 구성하세요.
\`\`\`

---

## 💡 사용 팁

- 이 프롬프트를 ${tools}의 **시스템 프롬프트(System Prompt)** 또는 **맞춤 지침** 칸에 붙여넣으세요.
- 반복 사용 시 Input 형식을 고정 템플릿으로 만들어 두면 효율이 더 높아집니다.

---
*⚠️ 데모 모드: 실제 AI 생성 결과를 보려면 \`.env.local\`에 \`OPENAI_API_KEY\` 또는 \`GEMINI_API_KEY\`를 설정하세요.*`;
}
