# Docker Compose guide cho nguoi moi

Muc tieu cua setup nay: nguoi moi chi can cai Docker, cau hinh `.env`, roi
chay `docker compose up -d --build`. Docker Compose se tu build va khoi dong
toan bo service can thiet de SmartStudy AI chay duoc.

Ban khong can cai rieng PostgreSQL, Redis, MinIO, Node.js API hay worker tren
may host. Tat ca cac thanh phan nay chay trong container.

## 1. Docker Compose se chay nhung gi?

Khi chay `docker compose up -d --build`, Compose se khoi dong:

| Service | Vai tro | Mo cong ra may host |
|---|---|---|
| `frontend` | Giao dien web React, chay qua Nginx | `WEB_PORT`, mac dinh `8080` |
| `api` | Backend REST API | mac dinh chi bind `127.0.0.1:3000` |
| `worker` | Xu ly job nen: PDF, chunk, embedding | khong mo cong |
| `postgres` | Database PostgreSQL co pgvector | mac dinh chi bind `127.0.0.1:5432` |
| `redis` | Queue/cache cho worker | mac dinh chi bind `127.0.0.1:6379` |
| `minio` | Storage S3-compatible cho file upload | mac dinh chi bind `127.0.0.1:9000` |
| `minio-init` | Tao bucket MinIO luc khoi dong | chay xong roi thoat |
| `migrate` | Chay Prisma migration truoc API/worker | chay xong roi thoat |

Sau khi stack len thanh cong, nguoi dung chi can mo frontend:

```text
http://localhost:8080
```

Neu cai tren may server cho may khac truy cap, dung IP/domain cua server:

```text
http://SERVER_IP_OR_DOMAIN:8080
```

## 2. File nao can cau hinh?

Chi can cau hinh file `.env` o thu muc goc repo.

Khuyen nghi dung script co san de tao `.env` an toan:

Windows PowerShell:

```powershell
.\scripts\setup-deploy-env.ps1 -PublicUrl "http://localhost:8080" -LlmProvider mock
```

Linux/macOS:

```bash
bash scripts/setup-deploy-env.sh --public-url "http://localhost:8080" --llm-provider mock
```

Script nay se:

- copy `.env.example` thanh `.env`
- sinh `POSTGRES_PASSWORD`
- sinh `MINIO_ROOT_PASSWORD`
- sinh `JWT_SECRET`
- sinh `SEED_USER_PASSWORD`
- dat `STORAGE_PUBLIC_ENDPOINT` theo URL frontend
- dat `LLM_PROVIDER`

Neu muon tu lam thu cong:

```bash
cp .env.example .env
```

Sau do sua cac bien bat buoc:

```dotenv
POSTGRES_PASSWORD=your-postgres-password
MINIO_ROOT_PASSWORD=your-minio-password
STORAGE_SECRET_KEY=your-minio-password
JWT_SECRET=your-random-secret-at-least-32-characters
STORAGE_PUBLIC_ENDPOINT=http://localhost:8080
LLM_PROVIDER=mock
```

Khong commit `.env` len Git vi file nay co secret.

## 3. Lenh chay local co ban

Lan dau chay:

```bash
docker compose up -d --build
```

Kiem tra trang thai:

```bash
docker compose ps
```

Kiem tra health:

```bash
curl http://localhost:8080/healthz
curl http://localhost:3000/health
```

Tren PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/healthz
Invoke-RestMethod http://localhost:3000/health
```

Xem log:

```bash
docker compose logs -f api worker frontend
```

Dung stack nhung giu du lieu:

```bash
docker compose down
```

Xoa ca container va data local:

```bash
docker compose down -v
```

Chi dung `down -v` khi ban chac chan muon xoa database, Redis, MinIO va cache
model embedding.

## 4. Chay tren may khac trong LAN/server

Neu cai tren mot may khac, vi du server co IP `192.168.1.50`, tao `.env` bang:

Windows PowerShell:

```powershell
.\scripts\setup-deploy-env.ps1 -PublicUrl "http://192.168.1.50:8080" -LlmProvider mock
docker compose up -d --build
```

Linux/macOS:

```bash
bash scripts/setup-deploy-env.sh --public-url "http://192.168.1.50:8080" --llm-provider mock
docker compose up -d --build
```

Sau do mo:

```text
http://192.168.1.50:8080
```

`STORAGE_PUBLIC_ENDPOINT` phai trung URL frontend ma browser dang mo. Bien nay
quan trong vi upload PDF dung presigned URL den MinIO. Trong setup Compose,
frontend Nginx proxy ca API va MinIO:

- `/api/...` -> `api:3000`
- `/<MINIO_BUCKET>/...` -> `minio:9000`

Nho vay browser chi can truy cap cong web `8080`.

## 5. Dung AI mock hay API key that?

De cai dat va test luong ung dung co ban, dung:

```dotenv
LLM_PROVIDER=mock
```

Che do `mock` khong can API key va phu hop de kiem tra Docker, auth, database,
upload flow va UI.

Neu muon dung Anthropic:

```dotenv
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key
```

Neu muon dung Gemini:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
```

Sau khi sua `.env`, restart:

```bash
docker compose up -d --build
```

## 6. Local-first nhung co the mo rong AWS

Hien tai stack mac dinh chay local:

| Thanh phan | Local mac dinh | Huong AWS sau nay |
|---|---|---|
| Storage | MinIO qua `s3-compatible` | Amazon S3, giu adapter S3-compatible va doi env |
| Database | PostgreSQL + pgvector trong Docker | Amazon RDS/Aurora PostgreSQL co pgvector |
| Queue | Redis/BullMQ | Co the them `SqsQueueProvider` |
| LLM | `mock`, Anthropic hoac Gemini | Co the them `BedrockLLMProvider` |
| Embedding | Local BGE-M3 | Co the them Bedrock/Titan/Cohere embedding adapter |
| Auth | JWT + Postgres | Co the them Cognito adapter neu can |
| Logs | Docker logs | Co the day len CloudWatch khi deploy AWS |

Nguyen tac mo rong: code nghiep vu khong goi truc tiep AWS SDK. Moi dich vu di
qua port/interface va duoc chon o provider factory bang bien `.env`.

Mot so bien provider quan trong:

```dotenv
STORAGE_PROVIDER=s3-compatible
VECTOR_STORE=pgvector
LLM_PROVIDER=anthropic
EMBEDDING_PROVIDER=local
AUTH_PROVIDER=jwt
QUEUE_PROVIDER=redis
EMAIL_PROVIDER=smtp
```

Khi them AWS, khong sua toan bo app. Them adapter moi, dang ky vao provider
factory, roi doi bien env. Vi du:

```dotenv
LLM_PROVIDER=bedrock
QUEUE_PROVIDER=sqs
AUTH_PROVIDER=cognito
```

Luu y: neu provider AWS chua duoc implement trong code, chi doi `.env` se lam
app fail-fast luc start. Day la hanh vi dung de tranh chay sai cau hinh.

## 7. Checklist cho nguoi moi

1. Cai Docker.
2. Clone repo.
3. Tao `.env` bang script setup.
4. Chay `docker compose up -d --build`.
5. Chay `docker compose ps` va dam bao service healthy/running.
6. Mo `http://localhost:8080` hoac URL server.
7. Khi loi, xem `docker compose logs -f api worker frontend`.

Neu Docker Desktop chua chay, Compose se fail truoc khi app kip khoi dong.
