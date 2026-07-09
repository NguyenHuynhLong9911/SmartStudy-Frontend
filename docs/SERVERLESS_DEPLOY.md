# SmartStudy Backend Serverless Deploy

## Kien truc sau refactor

- Frontend van deploy tren AWS Amplify.
- Backend HTTP chay trong Lambda `api`, public qua API Gateway HTTP API.
- Upload PDF van dung presigned S3 URL: frontend PUT truc tiep len S3, API chi tao URL va metadata.
- Xu ly PDF tach thanh Lambda `documentProcessor`, duoc kich hoat boi SQS.
- Database van la PostgreSQL hien tai qua `DATABASE_URL`; Prisma client duoc khoi tao khi Lambda cold start.
- Auth hien tai van la JWT noi bo (`AUTH_PROVIDER=jwt`).

## Nhung diem Express cu khong phu hop Lambda

- `src/api.ts` goi `app.listen(...)`, chi phu hop server/process dai han.
- `src/worker.ts` dung BullMQ worker va `setInterval(...)` de giu process song, khong phu hop Lambda.
- Queue Redis/BullMQ can consumer chay lien tuc; Lambda nen dung event source nhu SQS.
- Chua co CORS middleware rieng cho preflight tu Amplify/API Gateway.
- Khoi tao dependency nam truc tiep trong `api.ts`, nen kho chia se giua local server va Lambda handler.

## File quan trong da thay doi

- `backend/src/bootstrap.ts`: gom khoi tao Prisma, repositories, providers va services dung chung cho local API, API Lambda va worker Lambda.
- `backend/src/api.ts`: local server chi con listen va shutdown; khong con chua logic khoi tao service rieng.
- `backend/src/handler.ts`: export Lambda handlers `api` va `processDocument`.
- `backend/src/app.ts`: them CORS middleware truoc JSON parser va routes.
- `backend/src/middleware/cors.ts`: xu ly `OPTIONS`, `Authorization`, `Content-Type`, va origin tu env.
- `backend/src/provider-factory.ts`: ho tro `QUEUE_PROVIDER=sqs`.
- `backend/src/adapters/queue/sqs-queue-config.ts`: doc cau hinh SQS tu env.
- `backend/src/adapters/queue/sqs-queue-provider.ts`: enqueue job vao SQS; worker Lambda consume qua event source mapping.
- `backend/serverless.yml`: dinh nghia API Lambda, document processor Lambda, SQS queue, DLQ, IAM va env.
- `backend/package.json`: them dependency/script cho Lambda + Serverless Framework.
- `.env.example`: them CORS va SQS env mau.

## Bien moi truong can co

Bat buoc:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=minimum-32-characters-secret
STORAGE_BUCKET=your-s3-bucket
CORS_ALLOWED_ORIGINS=https://your-amplify-domain.amplifyapp.com
```

Neu dung Anthropic:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

Neu dung Gemini:

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
```

Serverless se tu dat:

```bash
QUEUE_PROVIDER=sqs
SQS_QUEUE_URL=<CloudFormation Ref DocumentProcessingQueue>
DOCUMENT_PROCESSING_QUEUE=<stage queue name>
```

## Deploy tung buoc

1. Cai Node.js 20.11+ tren may deploy. Node 24 portable cung dung duoc cho build/deploy local.

2. Cai dependency va refresh lockfile:

```bash
cd backend
npm install
```

3. Kiem tra build va test:

```bash
npm run typecheck
npm test
npm run build
```

4. Tao hoac xac nhan PostgreSQL hien tai co the truy cap tu Lambda.

Neu DB nam trong VPC rieng, can bo sung `vpc` trong `serverless.yml` voi subnet/security group cho Lambda.

5. Chay migration tren DB production:

```bash
npm run prisma:migrate:deploy
```

6. Export env production:

```bash
set DATABASE_URL=postgresql://...
set JWT_SECRET=...
set STORAGE_BUCKET=...
set CORS_ALLOWED_ORIGINS=https://your-amplify-domain.amplifyapp.com
set ANTHROPIC_API_KEY=...
```

Tren macOS/Linux dung `export KEY=value`.

7. Deploy backend:

```bash
npm run deploy:serverless -- --stage prod --region ap-southeast-1
```

8. Lay API endpoint tu output cua Serverless, vi du:

```text
https://abc123.execute-api.ap-southeast-1.amazonaws.com
```

9. Cap nhat Amplify env:

```bash
VITE_API_URL=https://abc123.execute-api.ap-southeast-1.amazonaws.com/api/v1
```

Sau do redeploy frontend tren Amplify.

10. Test nhanh:

```bash
curl https://abc123.execute-api.ap-southeast-1.amazonaws.com/health
```

Ky vong:

```json
{"service":"smartstudy-api","status":"ok"}
```

## Upload PDF

Luon di theo flow hien tai:

1. Frontend goi `POST /api/v1/documents/upload-url`.
2. Backend tra presigned S3 PUT URL.
3. Frontend upload PDF truc tiep len S3.
4. Frontend goi `POST /api/v1/documents/:documentId/complete`.
5. API Lambda verify S3 metadata va enqueue SQS.
6. Worker Lambda doc PDF tu S3, extract text, tao embeddings, luu chunks vao PostgreSQL/pgvector.

Bucket S3 can cho phep CORS PUT tu Amplify domain. Vi du:

```json
[
  {
    "AllowedOrigins": ["https://your-amplify-domain.amplifyapp.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Luu y van hanh

- Lambda khong nen dung Redis worker dai han. Local dev van co the dung `QUEUE_PROVIDER=redis` va `npm run dev:worker`.
- Neu database gioi han connection, nen dung RDS Proxy hoac pooler tuong duong.
- `EMBEDDING_PROVIDER=local` co the lam worker Lambda nang va cold start lau vi tai model HuggingFace. Neu production can Bedrock embeddings, can them adapter Bedrock tuong ung truoc khi set `EMBEDDING_PROVIDER=bedrock`.
- Neu dung S3 AWS native, khong can `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY`; Lambda role trong `serverless.yml` se cap quyen.
- Neu dung MinIO/S3-compatible ben ngoai AWS, dat `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`.
