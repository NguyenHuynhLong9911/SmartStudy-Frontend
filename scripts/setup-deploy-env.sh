#!/usr/bin/env bash
set -euo pipefail

public_url=""
web_port="8080"
llm_provider="mock"
anthropic_api_key=""
gemini_api_key=""
force="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-url)
      public_url="$2"
      shift 2
      ;;
    --web-port)
      web_port="$2"
      shift 2
      ;;
    --llm-provider)
      llm_provider="$2"
      shift 2
      ;;
    --anthropic-api-key)
      anthropic_api_key="$2"
      shift 2
      ;;
    --gemini-api-key)
      gemini_api_key="$2"
      shift 2
      ;;
    --force)
      force="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$llm_provider" in
  mock|anthropic|gemini) ;;
  *)
    echo "--llm-provider must be one of: mock, anthropic, gemini" >&2
    exit 1
    ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
example_path="$repo_root/.env.example"
env_path="$repo_root/.env"

if [[ ! -f "$example_path" ]]; then
  echo ".env.example was not found at $example_path" >&2
  exit 1
fi

if [[ -f "$env_path" && "$force" != "true" ]]; then
  echo ".env already exists. Re-run with --force to overwrite it." >&2
  exit 1
fi

if [[ -z "$public_url" ]]; then
  public_url="http://localhost:${web_port}"
fi

rand_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

set_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      done = 1
      next
    }
    { print }
    END {
      if (!done) {
        print key "=" value
      }
    }
  ' "$env_path" > "$tmp"
  mv "$tmp" "$env_path"
}

cp "$example_path" "$env_path"

postgres_password="ssai_pg_$(rand_hex 16)"
minio_password="ssai_minio_$(rand_hex 16)"
jwt_secret="$(rand_hex 48)"
seed_password="Ssai_$(rand_hex 10)!"

set_value "POSTGRES_PASSWORD" "$postgres_password"
set_value "DATABASE_URL" "postgresql://smartstudy:${postgres_password}@localhost:5432/smartstudy"
set_value "MINIO_ROOT_PASSWORD" "$minio_password"
set_value "STORAGE_SECRET_KEY" "$minio_password"
set_value "STORAGE_PUBLIC_ENDPOINT" "$public_url"
set_value "JWT_SECRET" "$jwt_secret"
set_value "SEED_USER_PASSWORD" "$seed_password"
set_value "WEB_PORT" "$web_port"
set_value "VITE_API_URL" "/api/v1"
set_value "LLM_PROVIDER" "$llm_provider"
set_value "ANTHROPIC_API_KEY" "$anthropic_api_key"
set_value "GEMINI_API_KEY" "$gemini_api_key"

echo "Created $env_path"
echo "Run: docker compose up -d --build"
echo "Open: $public_url"
