# Quick Setup Script for Hello Leads Integration

Write-Host "🚀 Quick Setup for Hello Leads CRM Integration" -ForegroundColor Green
Write-Host "=" * 50

# Check if .env exists
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
} else {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    @"
# Hello Leads CRM Configuration
# Get these values from your HelloLeads account
HELLO_LEADS_API_KEY=your_api_key_here
HELLO_LEADS_LIST_KEY=your_list_key_here
HELLO_LEADS_ENDPOINT=https://app.helloleads.io/index.php/api/leads/add

# Server Configuration
PORT=3039
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ .env file created" -ForegroundColor Green
}

# Check Node modules
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}

# Show status
Write-Host "`n🔍 Checking integration status..." -ForegroundColor Blue
node scripts/check-hello-leads-status.js

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file and add your actual Hello Leads API keys"
Write-Host "2. Run: npm start (to start the server)"
Write-Host "3. Test: node scripts/test-hello-leads.mjs"
Write-Host "4. Check: http://localhost:3039 in browser"

Write-Host "`n📚 For detailed guide, read: HELLO_LEADS_SETUP.md" -ForegroundColor Blue