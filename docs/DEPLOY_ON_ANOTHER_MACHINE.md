# Cai dat SmartStudy AI tren may khac bang Docker

Tai lieu nay dung de cai full stack local-first tren mot may moi bang Docker Compose:
frontend Nginx, API, worker, PostgreSQL pgvector, Redis va MinIO. Day khong phai
huong dan migrate AWS.

Neu ban moi lam quen Docker Compose, doc them
`docs/DOCKER_COMPOSE_BEGINNER_GUIDE.md`. Tom tat ngan gon: cau hinh `.env`,
chay `docker compose up -d --build`, Compose se tu build va start frontend,
API, worker, database, Redis, MinIO, bucket init va migration.

## 1. Dieu kien tren may moi

- Docker Engine / Docker Desktop co Compose v2.
- Git.
- Port web `8080` mo cho nguoi dung truy cap. Cac port noi bo mac dinh bind
  `127.0.0.1`: API `3000`, PostgreSQL `5432`, Redis `6379`, MinIO `9000`,
  MinIO console `9001`.
- Neu dung AI that, chuan bi API key Anthropic hoac Gemini. Neu chi muon test
  cai dat, de mac dinh `mock`.

## 2. Cai dat mot lenh

Thay `SERVER_IP_OR_DOMAIN` bang IP/domain cua may moi, vi du
`192.168.1.50` hoac `study.example.com`.

Windows PowerShell:

```powershell
git clone https://github.com/cong-thanh1/SmartStudy.git SmartStudyAI; Set-Location SmartStudyAI; .\scripts\setup-deploy-env.ps1 -PublicUrl "http://SERVER_IP_OR_DOMAIN:8080" -LlmProvider mock; docker compose up -d --build
```

Linux/macOS:

```bash
git clone https://github.com/cong-thanh1/SmartStudy.git SmartStudyAI && cd SmartStudyAI && bash scripts/setup-deploy-env.sh --public-url "http://SERVER_IP_OR_DOMAIN:8080" --llm-provider mock && docker compose up -d --build
```

Mo ung dung tai:

```text
http://SERVER_IP_OR_DOMAIN:8080
```

Script setup se tao `.env`, sinh password PostgreSQL, password MinIO,
`JWT_SECRET`, seed password va dat `STORAGE_PUBLIC_ENDPOINT` bang URL web.
Khong commit file `.env`.

Sau khi `.env` dung, khong can chay tung service rieng. Compose tu xu ly thu tu:
database/Redis/MinIO healthy truoc, `minio-init` tao bucket, `migrate` chay
Prisma migration, roi API/worker/frontend khoi dong.

## 3. Cai dat voi provider AI that

Anthropic:

```bash
bash scripts/setup-deploy-env.sh --public-url "http://SERVER_IP_OR_DOMAIN:8080" --llm-provider anthropic --anthropic-api-key "YOUR_ANTHROPIC_API_KEY"
docker compose up -d --build
```

Gemini:

```bash
bash scripts/setup-deploy-env.sh --public-url "http://SERVER_IP_OR_DOMAIN:8080" --llm-provider gemini --gemini-api-key "YOUR_GEMINI_API_KEY"
docker compose up -d --build
```

Tren PowerShell, dung cac tham so tuong ung:

```powershell
.\scripts\setup-deploy-env.ps1 -PublicUrl "http://SERVER_IP_OR_DOMAIN:8080" -LlmProvider anthropic -AnthropicApiKey "YOUR_ANTHROPIC_API_KEY"
docker compose up -d --build
```

## 4. Kiem tra sau khi cai

```bash
docker compose config -q
docker compose ps
curl http://localhost:8080/healthz
curl http://localhost:3000/health
```

Tren PowerShell:

```powershell
docker compose config -q
docker compose ps
Invoke-RestMethod http://localhost:8080/healthz
Invoke-RestMethod http://localhost:3000/health
```

`frontend`, `api`, `worker`, `postgres`, `redis`, `minio` can o trang thai
healthy/running. Lan dau xu ly tai lieu co the tai model embedding BGE-M3 vao
volume `embedding-model-cache`, nen mat lau hon cac lan sau.

## 5. Vi sao upload file van chay qua cong 8080

Frontend Nginx proxy:

- `/api/...` -> service `api:3000`
- `/<MINIO_BUCKET>/...` -> service `minio:9000`

Vi vay `STORAGE_PUBLIC_ENDPOINT` nen la URL web ma trinh duyet dang mo, vi du
`http://SERVER_IP_OR_DOMAIN:8080`. Presigned upload URL se cung origin voi
frontend, tranh loi CORS khi cai tren may khac.

Neu doi `MINIO_BUCKET`, Compose tu truyen ten bucket vao Nginx. Sau khi doi
`.env`, chay lai:

```bash
docker compose up -d --build frontend api worker
```

## 6. Cap nhat phien ban moi

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Migration Prisma chay qua service `migrate` moi lan stack khoi dong, nen schema
duoc cap nhat truoc khi API va worker start.

## 7. Dung, restart va xem log

```bash
docker compose restart
docker compose logs -f api worker frontend
docker compose down
```

Chi dung lenh nay khi muon xoa toan bo data local:

```bash
docker compose down -v
```

## 8. Loi thuong gap

- `.env already exists`: them `-Force` tren PowerShell hoac `--force` tren bash
  neu muon ghi de `.env`.
- Port `8080` da bi dung: chay script voi `-WebPort 8081 -PublicUrl
  "http://SERVER_IP_OR_DOMAIN:8081"` hoac `--web-port 8081 --public-url
  "http://SERVER_IP_OR_DOMAIN:8081"`.
- Docker khong start duoc: kiem tra Docker Engine/Docker Desktop da chay.
- Browser upload loi host/CORS: kiem tra `STORAGE_PUBLIC_ENDPOINT` trong `.env`
  phai trung URL nguoi dung dang mo.

## 9. Mo rong AWS sau nay

Setup hien tai la local-first nhung da tach provider bang bien `.env`. Co the
them dich vu AWS bang cach implement adapter moi va doi provider tu `.env`, vi
du Bedrock cho LLM, SQS cho queue, Cognito cho auth, S3/RDS/Aurora cho storage
va database.

Khong nen goi AWS SDK truc tiep trong service nghiep vu. Them adapter vao
provider factory, dang ky provider, roi doi bien:

```dotenv
LLM_PROVIDER=bedrock
QUEUE_PROVIDER=sqs
AUTH_PROVIDER=cognito
```

Neu adapter AWS chua duoc implement, app se fail-fast luc start. Day la dung
thiet ke de tranh chay sai cau hinh.
