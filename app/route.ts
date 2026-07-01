import { NextRequest } from "next/server";

export const runtime = "edge";

interface Step {
  id: string;
  label: string;
  efficient: boolean;
}

interface WorksheetData {
  basics: {
    name: string;
    organization: string;
  };
  step1: {
    taskDescription: string;
    frequency: string;
    essentialReason: string;
  };
  step2: {
    inputSpec: string;
    outputSpec: string;
  };
  step3: {
    steps: Step[];
  };
  step4: {
    tools: string[];
  };
}

function buildPrompt(data: WorksheetData): string {
  const { basics, step1, step2, step3, step4 } = data;

  const efficientSteps = step3.steps
    .filter((s) => s.efficient)
    .map((s, i) => `  ${i + 1}. ✅ [효율] ${s.label}`)
    .join("\n");

  const inefficientSteps = step3.steps
    .filter((s) => !s.efficient)
    .map((s, i) => `  ${i + 1}. ⚠️ [비효율] ${s.label}`)
    .join("\n");

  const allSteps = step3.steps
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.efficient ? "✅ [효율]" : "⚠️ [비효율]"} ${s.label}`
    )
    .join("\n");

  const toolList = step4.tools.join(", ");

  const systemInstruction = `당신은 업무 자동화 프롬프트 전문가입니다.
사용자가 제공한 워크시트 데이터를 바탕으로, 실무에서 즉시 사용 가능한 고품질 AI 시스템 프롬프트를 생성하세요.
반드시 마크다운 형식으로 출력하며, 최종 시스템 프롬프트는 코드 블록(triple backtick)으로 감싸주세요.
한국어로 작성하되, 전문적이고 실용적인 톤을 유지하세요.`;

  const userInstruction = `## 📋 업무 자동화 워크시트 데이터

### 기초 정보
- **작성자:** ${basics.name || "미입력"}
- **소속/직무:** ${basics.organization || "미입력"}

---

### Step 1: 발견 — 번거로운 업무 파악
- **번거로운 업무 내용:** ${step1.taskDescription || "미입력"}
- **빈도 및 소요 시간:** ${step1.frequency || "미입력"}
- **업무의 본질적 존재 이유:** ${step1.essentialReason || "미입력"}

---

### Step 2: 정의 — Input / Output 명세
- **AI에 넣을 Input 데이터 사양:**
${step2.inputSpec || "미입력"}

- **AI에게 기대하는 Output 형태:**
${step2.outputSpec || "미입력"}

---

### Step 3: 분해 — 세부 프로세스 단계
${allSteps || "단계 미입력"}

**효율 단계:**
${efficientSteps || "  (없음)"}

**비효율 단계 (자동화 우선 대상):**
${inefficientSteps || "  (없음)"}

---

### Step 4: 전환 — 사용할 AI 도구
- **선택한 도구:** ${toolList || "미선택"}

---

## 🎯 생성 지시사항

위 워크시트 데이터를 기반으로 아래 구조를 따르는 최적화된 AI 시스템 프롬프트를 생성하세요:

**프롬프트 조립 규칙:**
"당신은 [직무] 전문가를 보조하는 AI 어시스턴트입니다. 목표는 사용자가 요청한 [번거로운 업무]를 자동화하는 것입니다. 이 업무의 본질적 목적은 [존재 이유]이므로 이를 준수하십시오.

- 업무 프로세스: [Step 3 세부 단계 및 효율/비효율 마킹 반영]
- Input 데이터 사양: [Step 2 Input]
- Output 희망 형태: [Step 2 Output]

이 조건과 [Step 4 선택 도구]의 특성에 맞춰 최적화된 고품질 프롬프트를 마크다운 코드 블록 형태로 출력하세요."

출력 형식:
1. 먼저 간략한 분석 요약 (2-3문장)
2. 비효율 단계 개선 제언 (bullet)
3. 최종 시스템 프롬프트 (코드 블록)
4. 사용 팁 1-2가지`;

  return JSON.stringify({ system: systemInstruction, user: userInstruction });
}

export async function POST(req: NextRequest) {
  try {
    const data: WorksheetData = await req.json();
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
        "meta/llama-3.3-70b-instruct",
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
    throw new Error(`${providerLabel} API error: ${response.status} ${errorBody}`);
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
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini API error: ${response.status} ${errorBody}`);
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
