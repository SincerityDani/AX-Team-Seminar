// 📁 파일 경로: app/api/test/route.ts

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 26;

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestRequest {
  systemPrompt: string;
  hasPersonalData: boolean;
  hasConfidentialData: boolean;
  inputSpec: string;
  outputSpec: string;
  taskDescription: string;
}

// ─── 가상 데이터 생성 프롬프트 ───────────────────────────────────────────────

function buildMockDataPrompt(req: TestRequest): string {
  const dataConstraint = req.hasPersonalData
    ? "개인정보(이름, 생년월일, 계좌번호, 연락처 등)는 완전히 가상으로 만들고, 실제처럼 보이지만 절대 실존하지 않는 데이터를 사용하세요. 예: 홍길동→테스트유저A, 실제 계좌번호→000-000-001"
    : req.hasConfidentialData
    ? "경영/기밀 정보는 완전한 픽션 데이터로 대체하세요. 실제 회사명, 수치, 전략 등은 사용하지 마세요."
    : "실제 업무와 유사한 형태의 현실감 있는 샘플 데이터를 만드세요.";

  const system = `당신은 AI 프롬프트 테스트를 위한 가상 데이터 생성 전문가입니다.
사용자의 업무 맥락에 맞는 현실적인 테스트 데이터를 생성하고,
해당 데이터를 주어진 시스템 프롬프트로 처리한 결과를 시뮬레이션합니다.

[데이터 생성 규칙]
${dataConstraint}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "mockData": {
    "description": "이 가상 데이터에 대한 한 줄 설명",
    "items": [
      { "label": "항목명", "value": "가상값" }
    ]
  },
  "testResult": {
    "summary": "AI 처리 결과 요약 (2~3문장)",
    "output": "실제 Output 형태로 구조화된 결과 (표나 목록 형태)"
  }
}`;

  const user = `업무 설명: ${req.taskDescription}

Input 데이터 사양:
${req.inputSpec}

Output 형태:
${req.outputSpec}

위 업무에 맞는 현실감 있는 가상 테스트 데이터 1건을 생성하고,
아래 시스템 프롬프트로 처리했을 때의 결과를 시뮬레이션해주세요.

[시스템 프롬프트]
${req.systemPrompt.slice(0, 2000)}`;

  return JSON.stringify({ system, user });
}

// ─── LLM 호출 ────────────────────────────────────────────────────────────────

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
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
          generationConfig: { maxOutputTokens: 1200 },
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
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // 데모 모드
  return JSON.stringify({
    mockData: {
      description: "테스트용 가상 데이터 (데모 모드)",
      items: [
        { label: "항목 1", value: "가상 값 A" },
        { label: "항목 2", value: "가상 값 B" },
        { label: "항목 3", value: "가상 값 C" },
      ],
    },
    testResult: {
      summary: "AI가 입력 데이터를 분석하여 처리했습니다. 실제 API 키를 설정하면 더 구체적인 결과를 받을 수 있습니다. (데모 모드)",
      output: "| 항목 | 결과 |\n|------|------|\n| 처리 상태 | 완료 ✅ |\n| 검증 결과 | 정상 |",
    },
  });
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
    const body: TestRequest = await req.json();

    if (!body.systemPrompt || body.systemPrompt.trim().length < 10) {
      return new Response(JSON.stringify({ error: "시스템 프롬프트가 없습니다." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(buildMockDataPrompt(body));
    const raw = await callLLM(parsed.system, parsed.user);

    try {
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(clean);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // JSON 파싱 실패 시 raw 텍스트를 output으로 래핑
      return new Response(JSON.stringify({
        mockData: {
          description: "가상 테스트 데이터",
          items: [{ label: "테스트 데이터", value: "가상 데이터가 생성되었습니다." }],
        },
        testResult: {
          summary: "AI가 프롬프트를 처리했습니다.",
          output: raw,
        },
      }), { headers: { "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("Test route error:", err);
    return new Response(JSON.stringify({ error: "테스트 중 오류가 발생했습니다." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
