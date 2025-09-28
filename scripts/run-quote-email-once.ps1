<#
  Start the qiq-chat server on a temp port, send a single /api/quote-email
  request (action=send) to the provided client email, print a short summary,
  and then shut the server down.

  Usage (PowerShell):
    ./scripts/run-quote-email-once.ps1 -Port 3047 -ClientEmail "you@example.com"

  Notes:
  - Loads .env for keys (Resend/OpenAI/etc)
  - Sets AUTO_APPROVE/FAST_MODE for a speedy run
  - Falls back to Resend onboarding sender if needed
#>
param(
  [int]$Port = 3047,
  [string]$ClientEmail = 'client@example.com'
)

$ErrorActionPreference = 'Stop'

$env:AUTO_APPROVE = '1'
$env:FAST_MODE    = '1'

function Import-DotEnv {
  param([string]$Path = ".env")
  if (-not (Test-Path $Path)) { return }
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

function Test-ServerHealthy {
  param([int]$Port)
  try {
    $resp = Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 2
    return ($resp.StatusCode -eq 200)
  } catch { return $false }
}

Import-DotEnv

Stop-ProcessesOnPort -Port $Port
Start-Sleep -Milliseconds 300
$serverProcess = $null
$serverStartedHere = $false

try {
  $serverProcess = Start-Process -NoNewWindow -FilePath node -ArgumentList "server.js $Port" -PassThru
  $serverStartedHere = $true

  # Wait for health
  $deadline = (Get-Date).AddSeconds(15)
  while (-not (Test-ServerHealthy -Port $Port) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (-not (Test-ServerHealthy -Port $Port)) { throw "Server did not become healthy on port $Port" }

  Write-Host "Health: OK on port $Port"
  try {
    $h = Invoke-RestMethod -Uri "http://localhost:$Port/health"
    if ($null -ne $h -and $null -ne $h.env) { $h.env | ConvertTo-Json -Depth 6 | Write-Host }
  } catch {}

  # Build payload
  $qtNum = "QT-EMAIL-" + (Get-Date).ToString('yyyyMMdd-HHmmss')
  $payload = @{
    action = 'send'
    number = $qtNum
    date = (Get-Date).ToString('yyyy-MM-dd')
    currency = 'USD'
    client = @{ name = 'Quick Test Client'; email = $ClientEmail }
    project = @{ name = 'Email Flow Test'; site = 'HQ' }
    items = @(
      @{ name='Kaspersky EDR Optimum'; pn='KL4851RPAFS'; qty=100; unit_price=3.2; image='https://via.placeholder.com/80' },
      @{ name='Fortinet FortiGate 40F'; pn='FG-40F'; qty=1; unit_price=499.99; image='https://via.placeholder.com/80' },
      @{ description='Managed Switch 24-Port'; pn='SW-24'; qty=2; unit_price=129.5 }
    )
  } | ConvertTo-Json -Depth 6

  Write-Host "POST /api/quote-email → $ClientEmail"
  $res = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/quote-email" -Body $payload -ContentType 'application/json'

  # Print concise summary
  $pdfLen = ($res.pdfBase64 | ForEach-Object { $_.Length })
  $csvLen = ($res.csvBase64 | ForEach-Object { $_.Length })
  Write-Host ("pdfBase64 length: {0}" -f ($pdfLen | Select-Object -First 1))
  Write-Host ("csvBase64 length: {0}" -f ($csvLen | Select-Object -First 1))
  if ($res.email) {
    if ($res.email.admin) { Write-Host ("Admin email → provider={0} id={1}" -f ($res.email.admin.provider), ($res.email.admin.id)) }
    if ($res.email.client){ Write-Host ("Client email → provider={0} id={1}" -f ($res.email.client.provider), ($res.email.client.id)) }
  }
  if ($res.helloleads) { Write-Host ("HelloLeads ok={0}" -f ($res.helloleads.ok)) }

} catch {
  Write-Error $_
} finally {
  if ($serverStartedHere -and $serverProcess) {
    try { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
