# Changelog

## 2026-04-06

### Features
- Locale-aware question examples and answer language — generate example questions and answers in Korean or English based on current locale setting (`d1ce4fb`)
- Locale toggle switch UI — replace language button with sliding toggle (한국어/EN) and update sample files (`c99a9be`)
- Major UX & architecture improvements (`e0a28b8`)

### Bug Fixes
- Trim AWS credentials to prevent invalid header character error (`5f0cdbe`)
- Resolve NGHTTP2_PROTOCOL_ERROR in embedding pipeline — force HTTP/1.1 via NodeHttpHandler, reduce batch concurrency, add retry with exponential backoff (`ca81944`)
- Trim AWS_REGION env var to prevent trailing space hostname error (`29031e1`)

## 2026-04-05

### Features
- Stage 2-5: full RAG pipeline implementation — text extraction, chunking, embedding, vector search, and streaming answer generation (`fc1832d`)
- Stage 1: project scaffolding & architecture — Next.js 14 + AWS Bedrock setup (`51e5231`)

### Bug Fixes
- Use local pdfjs worker to resolve module worker CORS issue (`5525c04`)
- Load pdfjs-dist from CDN to bypass Turbopack bundling errors (`b6eedaf`)
