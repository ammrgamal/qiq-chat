# Simple smoke test for qiq-chat with AUTO_APPROVE and FAST_MODE
param(
  [int]$Port = 3010
)

$env:AUTO_APPROVE = '1'
$env:FAST_MODE    = '1'

Start-Process -NoNewWindow -FilePath node -ArgumentList "server.js $Port"
Start-Sleep -Seconds 1

Write-Host "Health:" (Invoke-WebRequest "http://localhost:$Port/health" -UseBasicParsing).StatusCode

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
