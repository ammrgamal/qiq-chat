<#
  Simple smoke test for qiq-chat with AUTO_APPROVE and FAST_MODE
  - Loads .env into environment variables for this session
  - Always frees the port and starts a fresh temporary server to pick up new env
  - Stops the temporary server on exit to avoid EADDRINUSE on next runs
#>
param(
  [int]$Port = 3010
)

$ErrorActionPreference = 'Stop'

$env:AUTO_APPROVE = '1'
$env:FAST_MODE    = '1'

function Import-DotEnv {
  param([string]$Path = ".env")
  if (-not (Test-Path $Path)) { return }
  # Iterate line-by-line for Windows PowerShell 5.x compatibility
  Get-Content -Path $Path | ForEach-Object {
    $line = ($_ | Out-String).Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $kv = $line.Split('=',2)
    if ($kv.Count -ge 2) {
      $key = $kv[0].Trim()
      $val = $kv[1].Trim()
      if ($key) { Set-Item -Path ("Env:" + $key) -Value $val -ErrorAction SilentlyContinue }
    }
  }
}

function Test-ServerHealthy {
  param([int]$Port)
  try {
    $resp = Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 2
    return ($resp.StatusCode -eq 200)
  } catch { return $false }
}

function Stop-ProcessesOnPort {
  param([int]$Port)
  try {
    $procIds = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
               Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue |
               Sort-Object -Unique
    foreach ($procId in $procIds) {
      if ($procId) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    }
  } catch {
    # Fallback via netstat parsing
    try {
      $lines = netstat -ano | Select-String -Pattern (":$Port ")
      foreach ($line in $lines) {
        $parts = ($line.ToString().Trim() -split '\s+')
        $procId = $parts[-1]
        if ($procId -match '^[0-9]+$') { Stop-Process -Id [int]$procId -Force -ErrorAction SilentlyContinue }
      }
    } catch {}
  }
}

Import-DotEnv

# Always free the port then start server fresh with current env
Stop-ProcessesOnPort -Port $Port
Start-Sleep -Milliseconds 300
$serverProcess = Start-Process -NoNewWindow -FilePath node -ArgumentList "server.js $Port" -PassThru
$serverStartedHere = $true
# Wait until health is ready (max ~12s)
$deadline = (Get-Date).AddSeconds(12)
while (-not (Test-ServerHealthy -Port $Port) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}
if (-not (Test-ServerHealthy -Port $Port)) {
  Write-Error "Server did not become healthy on port $Port"
  if ($serverProcess) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
  exit 1
}

Write-Host "Health:" (Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 2).StatusCode
try {
  $h = Invoke-RestMethod -Uri "http://localhost:$Port/health"
  if ($null -ne $h -and $null -ne $h.env) {
    $h.env | ConvertTo-Json -Depth 6 | Write-Host
  }
} catch {}

try {
  # Register
  $regBody = @{ company='Acme Ltd'; email='user@demo.local'; phone='+201234567890'; password='secret123' } | ConvertTo-Json
  $reg = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/users/register" -Body $regBody -ContentType 'application/json'
  $reg | ConvertTo-Json -Depth 6 | Write-Host

  # Login
  $loginBody = @{ email='user@demo.local'; password='secret123' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/users/login" -Body $loginBody -ContentType 'application/json'
  $token = $login.token
  Write-Host "Token length:" ($token | Measure-Object -Character).Characters

  # Me
  $headers = @{ Authorization = ('Bearer ' + $token) }
  $me = Invoke-RestMethod -Method Get -Uri "http://localhost:$Port/api/users/me" -Headers $headers
  $me | ConvertTo-Json -Depth 6 | Write-Host

  # Save quotation with explicit project name to avoid env reliance
  $qBody = @{ project=@{ name=("Project " + (Get-Date).ToString('yyyy-MM-dd')) }; totals=@{ grand=1234 }; currency='USD' } | ConvertTo-Json
  $save = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/users/quotations" -Headers $headers -Body $qBody -ContentType 'application/json'
  $save | ConvertTo-Json -Depth 6 | Write-Host

  # Chat quick
  $chatBody = @{ messages = @(@{ role='user'; content='kaspersky edr' }) } | ConvertTo-Json
  $chat = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/chat" -Body $chatBody -ContentType 'application/json'
  $chat | ConvertTo-Json -Depth 6 | Write-Host

  # Search quick (Algolia-backed)
  $sBody = @{ query='kaspersky'; hitsPerPage=3 } | ConvertTo-Json
  try { (Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/search" -Body $sBody -ContentType 'application/json') | ConvertTo-Json -Depth 6 | Write-Host } catch { $_.Exception.Message | Write-Host }
} finally {
  if ($serverStartedHere -and $serverProcess) {
    try { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
