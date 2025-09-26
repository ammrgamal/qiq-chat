# Test Hello Leads Integration Script
param(
    [string]$Port = "3039",
    [string]$ApiKey = "",
    [string]$ListKey = ""
)

Write-Host "=== Testing Hello Leads Integration ===" -ForegroundColor Green

# Check if API keys are provided via parameters
if ($ApiKey -and $ListKey) {
    $env:HELLO_LEADS_API_KEY = $ApiKey
    $env:HELLO_LEADS_LIST_KEY = $ListKey
    Write-Host "Using provided API credentials" -ForegroundColor Yellow
}

# Check for environment variables
if (-not $env:HELLO_LEADS_API_KEY -or -not $env:HELLO_LEADS_LIST_KEY) {
    Write-Host "Warning: Hello Leads API credentials not found!" -ForegroundColor Red
    Write-Host "Please set HELLO_LEADS_API_KEY and HELLO_LEADS_LIST_KEY environment variables" -ForegroundColor Red
    Write-Host "Or run with: .\test-hello-leads-integration.ps1 -ApiKey 'your_key' -ListKey 'your_list_key'" -ForegroundColor Red
}

# Start server in background
Write-Host "Starting server on port $Port..." -ForegroundColor Blue
$serverJob = Start-Job -ScriptBlock {
    param($Port)
    Set-Location $using:PWD
    $env:PORT = $Port
    if ($using:env:HELLO_LEADS_API_KEY) { $env:HELLO_LEADS_API_KEY = $using:env:HELLO_LEADS_API_KEY }
    if ($using:env:HELLO_LEADS_LIST_KEY) { $env:HELLO_LEADS_LIST_KEY = $using:env:HELLO_LEADS_LIST_KEY }
    node server.js
} -ArgumentList $Port

# Wait for server to start
Start-Sleep -Seconds 3

try {
    # Test Hello Leads endpoint
    Write-Host "Testing Hello Leads endpoint..." -ForegroundColor Blue
    
    $testData = @{
        number = "Q-TEST-$(Get-Date -Format 'MMddHHmm')"
        date = Get-Date -Format "yyyy-MM-dd"
        client = @{
            name = "شركة اختبار ذ.م.م"
            contact = "أحمد محمد"
            email = "ahmed@testcompany.com"
            phone = "+966501234567"
        }
        project = @{
            name = "مشروع تجريبي"
            requester_role = "مهندس شبكات"
            expected_closing_date = "2025-10-15"
        }
        items = @(
            @{
                description = "سويتش 24 بورت"
                pn = "SW-24P-GIG"
                qty = 2
            },
            @{
                description = "راوتر إنتربرايز"
                pn = "RTR-ENT-001"
                qty = 1
            }
        )
    }
    
    $json = $testData | ConvertTo-Json -Depth 10 -Compress
    $uri = "http://localhost:$Port/api/hello-leads"
    
    $response = Invoke-RestMethod -Uri $uri -Method POST -Body $json -ContentType "application/json"
    
    Write-Host "✅ Hello Leads Integration Test Results:" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 5)" -ForegroundColor White
    
    # Test health endpoint
    Write-Host "`nTesting health endpoint..." -ForegroundColor Blue
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:$Port/health" -Method GET
    Write-Host "Health Status:" -ForegroundColor Green
    Write-Host "$($healthResponse | ConvertTo-Json -Depth 3)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Test Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseContent = $reader.ReadToEnd()
        Write-Host "Error Response: $responseContent" -ForegroundColor Red
    }
} finally {
    # Clean up
    Write-Host "`nCleaning up..." -ForegroundColor Blue
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
    Write-Host "Test completed!" -ForegroundColor Green
}