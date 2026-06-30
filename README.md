# 업무 자동화 4단계 워크시트

> AI를 활용한 업무 자동화 시스템 프롬프트를 4단계로 완성하는 웹 서비스

---

## 📁 프로젝트 구조

```
automation-worksheet/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts        ← 스트리밍 API 라우트 (Edge Runtime)
│   ├── globals.css             ← Tailwind 전역 스타일
│   ├── layout.tsx              ← 루트 레이아웃
│   └── page.tsx                ← 메인 워크시트 페이지 (Single Page)
├── .env.example                ← 환경변수 예시 (복사 후 .env.local로 변경)
├── .gitignore
├── netlify.toml                ← Netlify 배포 설정 (Next.js 플러그인 포함)
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🚀 로컬 실행 방법

### 1. 의존성 설치

```bash
npm install
# 또는
yarn install
# 또는
pnpm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열고 사용할 AI API 키를 입력하세요.

```env
# OpenAI 사용 시 (GPT-4o-mini)
OPENAI_API_KEY=sk-your-key-here

# 또는 Gemini 사용 시 (gemini-1.5-flash)
GEMINI_API_KEY=your-gemini-key-here
```

> ⚠️ API 키를 설정하지 않아도 **데모 모드**로 실행됩니다. Mock 스트리밍으로 전체 플로우를 체험할 수 있어요.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

## ☁️ Vercel 배포 방법

### 방법 1: GitHub 연동 (권장)

1. GitHub에 레포지토리 생성 후 코드 푸시
2. [vercel.com](https://vercel.com) → New Project → GitHub 레포 선택
3. **Environment Variables** 탭에서 API 키 추가:
   - `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`
4. Deploy 클릭

### 방법 2: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

### ✅ Vercel Hobby 10초 타임아웃 대응

이 프로젝트는 **Edge Runtime** (`export const runtime = "edge"`)을 사용하여 스트리밍 응답을 처리합니다. Edge 함수는 Vercel Hobby 플랜에서 최대 **25초**까지 실행 가능하므로 10초 제한 문제가 발생하지 않습니다.

---

## 🌐 Netlify 배포 방법

이 프로젝트에는 `netlify.toml`이 포함되어 있어 별도 설정 없이 바로 배포 가능합니다.

1. GitHub에 레포지토리 생성 후 코드 푸시 (반드시 `app/` 폴더 구조 그대로 유지)
2. [app.netlify.com](https://app.netlify.com) → Add new site → Import an existing project → GitHub 레포 선택
3. Netlify가 `netlify.toml`을 자동으로 인식하여 다음 설정을 적용합니다:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Plugin: `@netlify/plugin-nextjs` (Next.js App Router, API Routes, Edge Runtime 자동 변환)
4. **Site settings → Environment variables**에서 API 키 추가:
   - `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`
5. Deploy site 클릭

### ⚠️ 레포 구조 주의사항

Next.js는 정확히 `app/page.tsx`, `app/layout.tsx`, `app/api/generate/route.ts` 같은 폴더 경로를 요구합니다. GitHub에 파일을 올릴 때 zip 압축 파일을 그대로 올리거나, 파일들을 폴더 구조 없이 평평하게(flat) 올리면 `Couldn't find any pages or app directory` 에러가 발생합니다. 반드시 압축을 해제한 뒤, 디렉토리 구조를 그대로 유지하며 커밋하세요.

---

## 🔧 주요 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 스타일링 | Tailwind CSS |
| 아이콘 | Lucide React |
| AI 백엔드 | OpenAI GPT-4o-mini / Google Gemini 1.5 Flash |
| 스트리밍 | Fetch Streams API (Edge Runtime) |
| 배포 | Vercel Hobby |

---

## 🎯 서비스 사용 흐름

```
기초 정보 입력
    ↓
Step 1: 발견 — 번거로운 업무 파악
    ↓
Step 2: 정의 — Input/Output 명세
    ↓
Step 3: 분해 — 세부 프로세스 단계 추가 + 효율/비효율 토글
    ↓
Step 4: 전환 — AI 도구 선택
    ↓
[프롬프트 생성] 버튼 클릭
    ↓
Edge API(/api/generate) → LLM 스트리밍 호출
    ↓
실시간 타이핑 출력 → 복사 / .txt 다운로드 / 이메일 / 별점 평가
```

---

## ⚙️ API 우선순위

1. `OPENAI_API_KEY` 있음 → **OpenAI GPT-4o-mini** 사용
2. `GEMINI_API_KEY` 있음 → **Google Gemini 1.5 Flash** 사용  
3. 둘 다 없음 → **데모 모드** (Mock 스트리밍, API 비용 없음)

---

## 📝 커스터마이징 가이드

### AI 도구 목록 변경

`app/page.tsx` 상단의 `AI_TOOLS` 배열을 수정하세요:

```ts
const AI_TOOLS = ["ChatGPT", "Gemini", "Claude", "Copilot", "Perplexity", "기타"];
```

### LLM 프롬프트 템플릿 수정

`app/api/generate/route.ts`의 `buildPrompt()` 함수를 수정하세요.

### 모델 변경

- OpenAI: `route.ts`의 `"gpt-4o-mini"` → `"gpt-4o"` 등으로 변경
- Gemini: `"gemini-1.5-flash"` → `"gemini-1.5-pro"` 등으로 변경
