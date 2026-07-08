param(
  [string]$PublicUrl = "",
  [int]$WebPort = 8080,
  [ValidateSet("mock", "anthropic", "gemini")]
  [string]$LlmProvider = "mock",
  [string]$AnthropicApiKey = "",
  [string]$GeminiApiKey = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$examplePath = Join-Path $repoRoot ".env.example"
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $examplePath)) {
  throw ".env.example was not found at $examplePath"
}

if ((Test-Path $envPath) -and -not $Force) {
  throw ".env already exists. Re-run with -Force to overwrite it."
}

if ([string]::IsNullOrWhiteSpace($PublicUrl)) {
  $PublicUrl = "http://localhost:$WebPort"
}

function New-HexSecret {
  param([int]$Bytes = 32)

  $bytes = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }

  return -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function Set-EnvValue {
  param(
    [string]$Content,
    [string]$Name,
    [string]$Value
  )

  $pattern = "(?m)^$([regex]::Escape($Name))=.*$"
  $line = "$Name=$Value"

  if ([regex]::IsMatch($Content, $pattern)) {
    $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
      param($match)
      return $line
    }
    return [regex]::Replace($Content, $pattern, $evaluator)
  }

  return $Content.TrimEnd() + [Environment]::NewLine + $line + [Environment]::NewLine
}

$postgresPassword = "ssai_pg_$(New-HexSecret 16)"
$minioPassword = "ssai_minio_$(New-HexSecret 16)"
$jwtSecret = New-HexSecret 48
$seedPassword = "Ssai_$(New-HexSecret 10)!"

$content = Get-Content -Raw $examplePath
$content = Set-EnvValue $content "POSTGRES_PASSWORD" $postgresPassword
$content = Set-EnvValue $content "DATABASE_URL" "postgresql://smartstudy:$postgresPassword@localhost:5432/smartstudy"
$content = Set-EnvValue $content "MINIO_ROOT_PASSWORD" $minioPassword
$content = Set-EnvValue $content "STORAGE_SECRET_KEY" $minioPassword
$content = Set-EnvValue $content "STORAGE_PUBLIC_ENDPOINT" $PublicUrl
$content = Set-EnvValue $content "JWT_SECRET" $jwtSecret
$content = Set-EnvValue $content "SEED_USER_PASSWORD" $seedPassword
$content = Set-EnvValue $content "WEB_PORT" $WebPort.ToString()
$content = Set-EnvValue $content "VITE_API_URL" "/api/v1"
$content = Set-EnvValue $content "LLM_PROVIDER" $LlmProvider
$content = Set-EnvValue $content "ANTHROPIC_API_KEY" $AnthropicApiKey
$content = Set-EnvValue $content "GEMINI_API_KEY" $GeminiApiKey

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($envPath, $content, $utf8NoBom)

Write-Host "Created $envPath"
Write-Host "Run: docker compose up -d --build"
Write-Host "Open: $PublicUrl"
