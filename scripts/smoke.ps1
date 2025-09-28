<#
  Simple smoke test for qiq-chat with AUTO_APPROVE and FAST_MODE
  - Reuses an existing healthy server on the chosen port
  - Otherwise frees the port and starts a temporary server
  - Stops the temporary server on exit to avoid EADDRINUSE on next runs
#>
param(
  [int]$Port = 3010
)

$ErrorActionPreference = 'Stop'

$env:AUTO_APPROVE = '1'
$env:FAST_MODE    = '1'

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
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue |
            Sort-Object -Unique
    foreach ($pid in $pids) {
      if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
    }
  } catch {
    # Fallback via netstat parsing
    try {
      $lines = netstat -ano | Select-String -Pattern (":$Port ")
      foreach ($line in $lines) {
        $parts = ($line.ToString().Trim() -split '\s+')
        $pid = $parts[-1]
        if ($pid -match '^[0-9]+$') { Stop-Process -Id [int]$pid -Force -ErrorAction SilentlyContinue }
      }
    } catch {}
  }
}

$serverStartedHere = $false
$serverProcess = $null

if (-not (Test-ServerHealthy -Port $Port)) {
  # Free the port then start server
  Stop-ProcessesOnPort -Port $Port
  Start-Sleep -Milliseconds 300
  $serverProcess = Start-Process -NoNewWindow -FilePath node -ArgumentList "server.js $Port" -PassThru
  $serverStartedHere = $true
  # Wait until health is ready (max ~8s)
  $deadline = (Get-Date).AddSeconds(8)
  while (-not (Test-ServerHealthy -Port $Port) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-ServerHealthy -Port $Port)) {
    Write-Error "Server did not become healthy on port $Port"
    if ($serverProcess) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
    exit 1
  }
}

Write-Host "Health:" (Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 2).StatusCode

try {
  # Register
  $regBody = @{ company='Acme Ltd'; email='user@demo.local'; phone='+201234567890'; password='secret123' } | ConvertTo-Json
  $reg = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/users/register" -Body $regBody -ContentType 'application/json'
  $reg | ConvertTo-Json -Compress | Write-Host

  # Login
  $loginBody = @{ email='user@demo.local'; password='secret123' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/users/login" -Body $loginBody -ContentType 'application/json'
  $token = $login.token
  Write-Host "Token length:" ($token | Measure-Object -Character).Characters

  # Me
  $headers = @{ Authorization = ('Bearer ' + $token) }
  $me = Invoke-RestMethod -Method Get -Uri "http://localhost:$Port/api/users/me" -Headers $headers
  $me | ConvertTo-Json -Compress | Write-Host

  # Save quotation without project name (AUTO_APPROVE should default it)
  $qBody = @{ project=@{ }; totals=@{ grand=1234 }; currency='USD' } | ConvertTo-Json
  $save = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/users/quotations" -Headers $headers -Body $qBody -ContentType 'application/json'
  $save | ConvertTo-Json -Compress | Write-Host

  # Chat quick
  $chatBody = @{ messages = @(@{ role='user'; content='kaspersky edr' }) } | ConvertTo-Json
  $chat = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/chat" -Body $chatBody -ContentType 'application/json'
  $chat | ConvertTo-Json -Compress | Write-Host
} finally {
  if ($serverStartedHere -and $serverProcess) {
    try { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
