# DocMind — Claude Code CLI 실행 가이드

## 프로젝트 개요

**DocMind**는 AWS Bedrock 기반 실시간 RAG(Retrieval-Augmented Generation) 데모 웹앱이다.
사용자가 PDF를 업로드하면 즉시 RAG 파이프라인이 구축되고, 문서 기반 Q&A 채팅이 가능하다.

### 완성된 모습

1. 사용자가 웹페이지에 접속한다
2. PDF를 드래그앤드롭하거나, 샘플 PDF 버튼을 클릭한다
3. 업로드 즉시 RAG 파이프라인이 자동 실행된다:
   - 텍스트 추출 → 청킹 → 임베딩 → 인덱싱 → Ready
   - 각 단계의 진행 상태가 실시간으로 시각화된다 (프로그레스바, 카운터, 통계)
4. 파이프라인 완료 후 채팅창이 활성화된다
5. 한국어 또는 영어로 질문하면, 문서 기반 답변이 스트리밍으로 표시된다
6. 답변 아래에 출처(관련 청크)와 유사도 점수가 표시된다
7. Vercel에 배포되어 누구나 URL로 접속 가능하다

### 기술 스택

| 항목 | 기술 |
|------|------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| PDF Parsing | PDF.js (CDN, client-side) |
| Embedding | Bedrock `amazon.titan-embed-text-v2:0` |
| Generation | Bedrock `anthropic.claude-3-5-haiku-20241022-v1:0` |
| Vector Search | Server-side in-memory cosine similarity |
| Deployment | Vercel (via Vercel CLI) |

### 아키텍처

```
[브라우저 - Client]
  ├─ PDF 업로드 (드래그앤드롭, 5페이지 이하)
  ├─ PDF.js로 텍스트 추출
  ├─ 청크 분할 (500토큰, 50 오버랩)
  │
  └─ POST /api/rag/ingest ──→ [Vercel Serverless]
       청크 텍스트 전송           → Bedrock Titan Embedding
                                  → 벡터 + 청크를 응답에 포함
                              ←── { chunks, embeddings } 반환

[질문 시]
  └─ POST /api/rag/query ───→ [Vercel Serverless]
       질문 + 이전 chunks/embeddings  → 질문 임베딩 (Titan)
                                       → 코사인 유사도 검색 (Top-3)
                                       → Bedrock Claude Haiku 호출
                                   ←── 답변 스트리밍 + 출처 반환
```

**핵심 설계:**
- 서버가 임베딩 + 검색 + 생성을 모두 처리한다
- 브라우저는 PDF 파싱, UI, 파이프라인 시각화만 담당한다
- Vercel 서버리스는 stateless이므로, 질문 시 클라이언트가 청크+임베딩을 함께 전송한다
- 5페이지 이하 PDF → 최대 ~20개 청크 → 데이터 크기가 작아서 이 방식이 가능하다
- 별도 벡터 DB나 외부 스토리지 없이 동작한다

### 환경변수 (.env.local)

```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

---

## 에이전트 역할 정의

이 프로젝트를 수행할 때, 너(Claude)는 스테이지에 따라 다음 역할을 전환하며 수행한다:

| 역할 | 담당 | 활동 스테이지 |
|------|------|-------------|
| **PM** | 요구사항 검증, 스테이지 간 체크리스트 확인, 진행 판단 | 모든 스테이지 전환 시 |
| **Architect** | 프로젝트 구조, API 설계, 데이터 흐름 설계 | Stage 1 |
| **Developer** | 코드 구현, 라이브러리 설치, 파일 생성 | Stage 2, 3, 4 |
| **Designer** | UI/UX 설계, Tailwind 스타일링, 반응형 처리 | Stage 3 |
| **QA** | 각 스테이지 테스트, 버그 발견 및 수정 | 모든 스테이지 종료 시 |
| **DevOps** | 빌드, 환경변수, Vercel 배포 | Stage 5, 6 |

**역할 전환 규칙:**
- 각 스테이지 시작 시 "🎭 [역할] 모드로 전환합니다" 출력
- PM은 매 스테이지 시작/종료 시 체크리스트를 확인한다
- QA는 매 스테이지 종료 시 테스트를 수행하고 PASS/FAIL을 판정한다
- FAIL 시 Developer로 돌아가 수정 후 재테스트한다

---

## 실행 방법

아래 스테이지를 **순서대로** 실행한다.
각 스테이지의 프롬프트를 Claude Code CLI에 입력하면 된다.

**실행 전 준비:**
1. 로컬 Mac에 Node.js 18+, npm 설치 확인
2. 작업 디렉토리 생성: `mkdir ~/projects/docmind && cd ~/projects/docmind`
3. 이 문서를 프로젝트 루트에 저장: `DOCMIND_PLAN.md`
4. 샘플 PDF 2개를 프로젝트 루트에 저장 (별도 제공):
   - `NovaTech_X100_Installation_Guide.pdf`
   - `NovaTech_G500_Gateway_Manual.pdf`

---

## Stage 1: Project Scaffolding & Architecture

**역할:** PM → Architect → QA

### 프롬프트

```
DOCMIND_PLAN.md를 읽고, Stage 1을 수행해.

[PM] 먼저 이 프로젝트의 요구사항을 정리해서 출력해:
- 핵심 기능 목록
- 기술 스택 확인
- 파일 구조 확인

[Architect] 다음을 수행해:
1. Next.js 14 프로젝트 초기화 (App Router, TypeScript)
   - npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
2. 필요한 패키지 설치:
   - @aws-sdk/client-bedrock-runtime
   - pdfjs-dist
3. 프로젝트 디렉토리 구조 생성 (빈 파일도 생성):
   ```
   app/
     page.tsx
     layout.tsx
     globals.css
     api/
       rag/
         ingest/route.ts    # 청크 임베딩 처리
         query/route.ts     # 질문 → 검색 → 생성
     components/
       PdfUploader.tsx
       RagPipeline.tsx
       ChatInterface.tsx
       SourceViewer.tsx
   lib/
     chunker.ts
     vectorSearch.ts
     bedrock.ts
   public/
     samples/               # 여기에 샘플 PDF 복사
   ```
4. 샘플 PDF 파일을 public/samples/로 복사
5. .env.local 템플릿 생성 (키 값은 placeholder)
6. .gitignore에 .env.local 포함 확인

[QA] 테스트:
- `npm run dev`가 에러 없이 실행되는지 확인
- localhost:3000 접속 시 기본 페이지가 뜨는지 확인
- 모든 디렉토리와 파일이 올바르게 생성되었는지 확인
- 패키지가 정상 설치되었는지 package.json 확인

결과를 PASS/FAIL로 판정하고, FAIL이면 수정 후 재테스트.
PASS면 "✅ Stage 1 Complete"를 출력해.
```

---

## Stage 2: Backend — API Routes & Core Logic

**역할:** PM → Developer → QA

### 프롬프트

```
DOCMIND_PLAN.md를 읽고, Stage 2를 수행해. Stage 1이 완료된 상태여야 한다.

[PM] Stage 2 목표 확인:
- Bedrock API 연동 (Titan Embedding + Claude Haiku)
- 청킹 로직 구현
- 벡터 검색 로직 구현
- 2개의 API Route 구현 (/api/rag/ingest, /api/rag/query)

[Developer] 다음 파일을 구현해:

1. lib/bedrock.ts
   - BedrockRuntimeClient 초기화 (환경변수에서 크레덴셜 읽기)
   - embedText(text: string): Promise<number[]>
     → amazon.titan-embed-text-v2:0 호출, 1024차원 벡터 반환
     → 요청: { inputText, dimensions: 1024, normalize: true }
   - embedTexts(texts: string[]): Promise<number[][]>
     → 병렬 처리 (동시 최대 5개, rate limit 방지)
     → 각 청크 완료 시 progress callback 지원: onProgress?: (completed: number, total: number) => void
   - generateAnswer(question: string, contexts: string[]): AsyncGenerator<string>
     → anthropic.claude-3-5-haiku-20241022-v1:0 호출 (streaming)
     → Bedrock Messages API 형식 사용 (anthropic_version: "bedrock-2023-05-31")
     → system prompt: "You are a helpful assistant that answers questions based ONLY on the provided document context. If the answer is not found in the context, say you couldn't find it. Answer in the same language as the question. Be concise but thorough."
     → streaming response를 yield로 반환

2. lib/chunker.ts
   - chunkText(text: string): Chunk[]
   - Chunk = { id: string, text: string, index: number, charStart: number, charEnd: number, preview: string }
   - 전략:
     → 우선 "\n\n"(빈줄)로 분할
     → 각 섹션이 500토큰 초과하면 "\n"으로 추가 분할
     → 그래도 초과하면 문장 단위("." 기준)로 분할
     → 청크 간 50토큰 오버랩 적용
     → 토큰 추정: 영어는 단어수 × 1.3, 한글은 글자수 × 0.5 (대략적 추정 사용, tiktoken 불필요)
   - preview는 청크의 처음 100자

3. lib/vectorSearch.ts
   - cosineSimilarity(a: number[], b: number[]): number
   - searchSimilar(queryEmbedding: number[], chunkEmbeddings: number[][], topK: number): { index: number, score: number }[]
     → topK=3, score 0.3 미만 필터링

4. app/api/rag/ingest/route.ts
   - POST 핸들러
   - Request body: { chunks: string[] } (청크 텍스트 배열)
   - 각 청크를 Titan Embedding으로 임베딩
   - Response: { embeddings: number[][], dimension: 1024 }
   - 에러 처리: AWS 크레덴셜 없거나 Bedrock 호출 실패 시 적절한 에러 메시지

5. app/api/rag/query/route.ts
   - POST 핸들러
   - Request body: { question: string, chunks: string[], embeddings: number[][] }
   - 처리 흐름:
     a. 질문을 Titan으로 임베딩
     b. 코사인 유사도로 Top-3 청크 검색
     c. 검색된 청크 + 질문을 Claude Haiku에 전달
     d. Streaming 응답 반환 (ReadableStream)
   - Response format: Server-Sent Events (text/event-stream)
     → data: {"type": "sources", "sources": [{"text": "...", "score": 0.89, "index": 2}]}
     → data: {"type": "token", "token": "답변"}
     → data: {"type": "done"}

[QA] 테스트:
1. lib 함수 단위 테스트:
   - chunker: 긴 텍스트를 넣어서 청크가 올바르게 분할되는지 확인
   - vectorSearch: 간단한 벡터로 코사인 유사도 계산이 맞는지 확인
2. API Route 테스트 (curl 또는 코드로):
   - .env.local에 실제 AWS 키가 없으면 mock으로 테스트
   - .env.local에 실제 AWS 키가 있으면:
     → POST /api/rag/ingest에 테스트 청크 2개 전송 → 임베딩 반환 확인
     → POST /api/rag/query에 질문 + 청크 + 임베딩 전송 → 스트리밍 답변 확인
3. TypeScript 컴파일 에러 없는지 확인: `npx tsc --noEmit`

결과를 PASS/FAIL로 판정. PASS면 "✅ Stage 2 Complete" 출력.
```

---

## Stage 3: Frontend — UI Components

**역할:** PM → Designer → Developer → QA

### 프롬프트

```
DOCMIND_PLAN.md를 읽고, Stage 3를 수행해. Stage 2가 완료된 상태여야 한다.

[PM] Stage 3 목표 확인:
- 4개 컴포넌트 구현 (PdfUploader, RagPipeline, ChatInterface, SourceViewer)
- 깔끔한 엔터프라이즈 UI 디자인
- 한국어/영어 모두 지원
- 반응형 (모바일 대응)

[Designer] UI 설계 원칙:
- 톤: 깔끔한 엔터프라이즈/테크 느낌
- 컬러: 진한 남색(#1a365d) 기반 + 화이트 + 오렌지 액센트(#ed8936, AWS Bedrock 느낌)
- 폰트: system-ui (별도 폰트 로드 불필요)
- 카드 기반 레이아웃, 적절한 여백과 라운딩
- 파이프라인 시각화는 수평 스텝퍼 형태로 (모바일에서는 수직)
- 전체 레이아웃은 단일 페이지, max-width 1024px 중앙 정렬

[Developer] 다음 컴포넌트를 구현해:

1. app/components/PdfUploader.tsx
   - 드래그앤드롭 영역 (점선 테두리, 호버 시 색상 변경)
   - 클릭으로 파일 선택도 가능
   - 5페이지 초과 시: "This demo supports PDFs with 5 pages or fewer." 알림
   - PDF가 아닌 파일 거부
   - 샘플 PDF 버튼 2개:
     → "📄 Try: X100 Sensor Manual"
     → "📄 Try: G500 Gateway Manual"
     → 클릭 시 public/samples/에서 fetch하여 동일한 업로드 플로우 실행
   - 업로드 상태: idle → uploading → processing
   - PDF.js로 텍스트 추출 (클라이언트에서 수행)
   - 페이지 수 체크도 클라이언트에서 수행
   - 텍스트 추출 완료 시 onTextExtracted(text: string, pageCount: number) 콜백 호출

2. app/components/RagPipeline.tsx — ★ 핵심 컴포넌트
   - 5단계 파이프라인 시각화:
     Step 1: Text Extraction (📄)
     Step 2: Chunking (✂️)
     Step 3: Embedding (🧮)
     Step 4: Indexing (📊)
     Step 5: Ready (✅)
   - 각 단계 상태: waiting | active | completed | error
   - active 상태: 스피너 또는 프로그레스바 애니메이션
   - completed 상태: 체크마크 + 통계 표시
     → Step 1: "{n} characters extracted from {p} pages"
     → Step 2: "{n} chunks created (~500 tokens each)"
     → Step 3: "{completed}/{total} chunks embedded" (실시간 카운터 업데이트)
     → Step 4: "Vector index built ({dim}-dimensional)"
     → Step 5: "Ready! Ask anything about your document."
   - 단계 간 연결선 또는 화살표 표시
   - 전체 경과 시간 표시 (우측 상단)
   - Props:
     → currentStep: number (1-5)
     → stepDetails: { characters?: number, pages?: number, chunks?: number, embeddedCount?: number, totalChunks?: number, dimension?: number }
     → elapsedTime: number (ms)
     → error?: string

3. app/components/ChatInterface.tsx
   - 파이프라인 완료 전: 비활성 상태 (회색 처리, "Complete the pipeline above to start chatting")
   - 파이프라인 완료 후: 활성화
   - 메시지 목록 (스크롤, 최신 메시지로 자동 스크롤)
   - 사용자 메시지: 우측 정렬, 파란색 배경
   - AI 답변: 좌측 정렬, 회색 배경, 스트리밍 중 타이핑 애니메이션
   - 입력창 + 전송 버튼 (Enter로도 전송)
   - 예시 질문 버튼 (파이프라인 완료 시 표시):
     → "X100 센서의 동작 온도 범위는?"
     → "G500에서 센서가 안 잡힐 때?"
     → "What connectivity options does X100 have?"
     → "How many sensors can G500 handle?"
   - 로딩 상태: AI 답변 생성 중 "Thinking..." 표시
   - Props:
     → isReady: boolean
     → onSendMessage: (message: string) => Promise<void>
     → messages: Message[]

4. app/components/SourceViewer.tsx
   - 답변 아래에 접이식(collapsible)으로 표시
   - "📎 Sources (3 chunks found)" 클릭하면 펼침
   - 각 출처:
     → 유사도 점수 (프로그레스바 + 퍼센트)
     → 청크 미리보기 텍스트 (최대 200자, 더보기 가능)
     → "Chunk {n}" 라벨
   - Props:
     → sources: { text: string, score: number, index: number }[]

5. app/page.tsx — 전체 통합
   - 상태 관리 (useState):
     → pipelineStep, stepDetails, elapsedTime
     → chunks, embeddings (API 응답 저장)
     → messages (채팅 기록)
     → isReady (파이프라인 완료 여부)
   - 플로우:
     a. PdfUploader에서 텍스트 추출 완료 → 파이프라인 시작
     b. 청킹 (lib/chunker.ts 호출) → Step 2 완료
     c. /api/rag/ingest 호출 (청크별 progress 업데이트) → Step 3 완료
     d. 인덱싱 완료 표시 → Step 4 완료
     e. Ready → Step 5, 채팅 활성화
     f. 질문 시 /api/rag/query 호출 → 스트리밍 답변 표시 + 출처 표시

6. app/layout.tsx
   - 메타데이터: title "DocMind — AI Document Assistant", description 설정
   - 기본 폰트, 배경색 설정

7. app/globals.css
   - Tailwind 기본 설정
   - 커스텀 애니메이션 (파이프라인 스텝 전환, 스피너 등)

[QA] 테스트:
1. `npm run dev`로 실행
2. 브라우저에서 확인:
   - 메인 페이지 정상 렌더링
   - PDF 드래그앤드롭 영역 표시
   - 샘플 PDF 버튼 표시
   - 5페이지 초과 PDF 업로드 시 에러 메시지
   - PDF 업로드 시 파이프라인 시각화 동작 (AWS 키 없으면 임베딩 단계에서 에러 — OK)
   - 채팅 UI가 비활성 상태로 표시
   - 반응형: 브라우저 폭을 좁혀서 모바일 뷰 확인
3. TypeScript 에러 없음 확인: `npx tsc --noEmit`
4. 콘솔 에러 없음 확인

결과를 PASS/FAIL로 판정. PASS면 "✅ Stage 3 Complete" 출력.
```

---

## Stage 4: Integration & End-to-End Test

**역할:** PM → Developer → QA

### 프롬프트

```
DOCMIND_PLAN.md를 읽고, Stage 4를 수행해. Stage 3이 완료된 상태여야 한다.

[PM] Stage 4 목표:
- 프론트엔드 + 백엔드 통합 테스트
- 전체 플로우가 end-to-end로 동작하는지 검증
- 엣지 케이스 처리
- AWS 키 없는 환경에서도 graceful하게 동작

[Developer] 다음을 확인하고 수정해:

1. End-to-End 플로우 점검:
   - PDF 업로드 → 텍스트 추출 → 청킹 → /api/rag/ingest 호출 → 파이프라인 시각화 완료 → 채팅 활성화
   - 질문 입력 → /api/rag/query 호출 → 스트리밍 답변 → 출처 표시
   - 전체 플로우에서 데이터가 올바르게 전달되는지 확인

2. 엣지 케이스 처리:
   - AWS 크레덴셜 미설정 시: 파이프라인 Step 3에서 명확한 에러 메시지 표시
     ("AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local")
   - 빈 PDF (텍스트 없는 이미지 PDF): "No text could be extracted. This PDF may contain only images."
   - 네트워크 에러: 재시도 버튼 제공
   - 매우 짧은 PDF (청크 1개): 정상 동작 확인
   - 연속 질문: 이전 대화가 유지되고 새 질문도 정상 동작

3. UX 개선:
   - 새 PDF 업로드 시: 이전 채팅 기록 클리어, 파이프라인 리셋
   - 파이프라인 진행 중 PDF 재업로드 방지 (또는 취소 후 새로 시작)
   - 질문 전송 중 입력창 비활성화 (중복 전송 방지)
   - 스트리밍 중 스크롤 자동 이동

4. 성능 확인:
   - 샘플 PDF (6페이지이지만 텍스트 기준으로는 적절) 처리 시간 측정
   - 파이프라인 경과 시간이 정확히 표시되는지 확인

[QA] End-to-End 테스트 시나리오:

시나리오 1: 샘플 PDF 테스트
- "Try: X100 Sensor Manual" 클릭
- 파이프라인 5단계 모두 완료 확인
- "X100 센서의 온도 범위는?" 질문 → 답변에 "-40°C ~ +125°C" 포함 확인
- 출처 표시 확인

시나리오 2: 영어 질문
- "What connectivity options does the X100 support?" 질문
- 영어로 답변 오는지 확인
- Wi-Fi, BLE, LoRaWAN, Ethernet 중 일부 포함 확인

시나리오 3: G500 매뉴얼 전환
- "Try: G500 Gateway Manual" 클릭
- 이전 채팅 클리어 확인
- 새 파이프라인 실행 확인
- "G500에서 센서가 안 잡힐 때?" 질문 → 관련 트러블슈팅 답변 확인

시나리오 4: 엣지 케이스
- 이미지만 있는 PDF 업로드 시도 → 에러 메시지 확인
- 빈 질문 전송 시도 → 전송 안 됨 확인

모든 시나리오 PASS면 "✅ Stage 4 Complete" 출력.
FAIL 항목이 있으면 수정 후 해당 시나리오만 재테스트.
```

---

## Stage 5: Build & Pre-deployment Check

**역할:** PM → DevOps → QA

### 프롬프트

```
DOCMIND_PLAN.md를 읽고, Stage 5를 수행해. Stage 4가 완료된 상태여야 한다.

[PM] Stage 5 목표:
- Production 빌드 성공
- 빌드 경고/에러 해결
- Vercel 배포 준비

[DevOps] 다음을 수행해:

1. Production 빌드 테스트:
   ```
   npm run build
   ```
   - 에러가 있으면 모두 수정
   - 경고(warning)도 가능하면 해결 (특히 TypeScript, ESLint 관련)

2. 빌드 결과 확인:
   - .next 폴더 생성 확인
   - API Route가 serverless function으로 번들링되었는지 확인
   - 번들 사이즈 확인 (과도하게 크지 않은지)

3. Production 모드 로컬 테스트:
   ```
   npm run start
   ```
   - localhost:3000 접속하여 기본 동작 확인

4. 환경변수 체크리스트:
   - .env.local에 AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION이 설정되어 있는지 확인
   - Vercel 배포 시 동일 환경변수가 필요함을 README에 명시

5. next.config.js 확인:
   - 서버리스 함수 타임아웃 설정 (필요 시)
   - 외부 패키지 설정 (@aws-sdk가 서버에서만 사용되도록)

6. README.md 생성:
   - 프로젝트 설명 (DocMind: AI Document Assistant powered by AWS Bedrock RAG)
   - 기술 스택
   - 로컬 실행 방법 (npm install → .env.local 설정 → npm run dev)
   - Vercel 배포 방법
   - 환경변수 목록
   - 스크린샷 placeholder

[QA] 테스트:
1. `npm run build` 에러 없음 (exit code 0)
2. `npm run start` 후 localhost:3000 정상 접속
3. Production 모드에서 샘플 PDF 테스트 1회 수행
4. README.md 내용 확인

PASS면 "✅ Stage 5 Complete" 출력.
```

---

## Stage 6: Vercel Deployment

**역할:** PM → DevOps → QA

### 프롬프트

```
DOCMIND_PLAN.md를 읽고, Stage 6를 수행해. Stage 5가 완료된 상태여야 한다.

[PM] Stage 6 목표:
- Vercel에 프로덕션 배포
- 환경변수 설정
- 배포 후 동작 검증

[DevOps] 다음을 수행해:

1. Vercel CLI 설치 확인:
   ```
   npm i -g vercel
   ```

2. Vercel 프로젝트 설정:
   ```
   vercel
   ```
   - 프롬프트에 따라 설정 (프로젝트 이름: docmind)
   - Framework: Next.js 자동 감지

3. 환경변수 설정:
   ```
   vercel env add AWS_ACCESS_KEY_ID
   vercel env add AWS_SECRET_ACCESS_KEY
   vercel env add AWS_REGION
   ```
   - 각각 Production, Preview, Development 환경 모두에 설정

4. 프로덕션 배포:
   ```
   vercel --prod
   ```

5. 배포 URL 확인 및 출력

[QA] 배포 후 테스트 (배포된 URL에서):
1. 메인 페이지 정상 로드
2. 샘플 PDF 버튼 → 파이프라인 실행 → 채팅 동작
3. 한국어 질문/영어 질문 모두 테스트
4. 모바일 브라우저에서 접속 테스트 (또는 DevTools 모바일 뷰)
5. 응답 속도 체감 확인

모든 항목 PASS면:
"✅ Stage 6 Complete"
"🎉 DocMind 배포 완료!"
"🔗 URL: [배포된 URL]"
출력.
```

---

## 트러블슈팅 가이드

### 자주 발생하는 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| Bedrock API 403 에러 | IAM 권한 부족 | AWS 콘솔에서 BedrockFullAccess 정책 추가, 또는 Bedrock 모델 액세스 활성화 (Model access 페이지) |
| Titan Embedding 호출 실패 | 리전에서 모델 미지원 | us-east-1 또는 us-west-2 사용 |
| Claude Haiku 호출 실패 | Bedrock에서 모델 활성화 안됨 | AWS 콘솔 > Bedrock > Model access에서 Anthropic Claude 활성화 |
| Vercel 서버리스 타임아웃 | PDF가 너무 크거나 네트워크 느림 | 5페이지 제한 유지, Vercel Pro 플랜 고려 |
| PDF.js 텍스트 추출 실패 | 이미지 PDF (스캔) | OCR 미지원 알림 표시 |
| CORS 에러 | Next.js API Route 설정 문제 | same-origin이므로 발생하면 안 됨, 확인 필요 |
| 빌드 시 @aws-sdk 에러 | 클라이언트 번들에 포함됨 | next.config.js에서 serverExternalPackages 설정 |

### Bedrock 모델 액세스 활성화 방법

AWS 콘솔에서 반드시 수행해야 함:
1. AWS Console > Amazon Bedrock > Model access (좌측 메뉴)
2. "Manage model access" 클릭
3. 다음 모델 체크:
   - Amazon > Titan Text Embeddings V2
   - Anthropic > Claude 3.5 Haiku
4. "Save changes"
5. 활성화까지 몇 분 소요될 수 있음

---

## 체크리스트 요약

| Stage | 핵심 산출물 | 완료 기준 |
|-------|-----------|----------|
| 1 | 프로젝트 구조 + 빈 파일 | `npm run dev` 정상 실행 |
| 2 | API Routes + lib 유틸리티 | TypeScript 컴파일 통과 + API 응답 확인 |
| 3 | UI 컴포넌트 4개 + 통합 페이지 | 브라우저에서 전체 UI 렌더링 + 파이프라인 시각화 동작 |
| 4 | E2E 통합 | 샘플 PDF로 전체 플로우 동작, 한국어/영어 질문 답변 |
| 5 | Production 빌드 | `npm run build` 성공 + Production 모드 동작 |
| 6 | Vercel 배포 | 배포 URL에서 전체 기능 동작 |
