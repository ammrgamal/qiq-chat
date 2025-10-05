// verify-setup.js - Verify enrichment engine setup
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '../.env' });

console.log(`
╔════════════════════════════════════════════════════════════╗
║        Enrichment Engine - Setup Verification              ║
╚════════════════════════════════════════════════════════════╝
`);

let errors = 0;
let warnings = 0;

// Check Node.js version
console.log('📋 Checking Prerequisites...\n');

const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion >= 18) {
  console.log(`✅ Node.js version: ${nodeVersion} (OK)`);
} else {
  console.log(`❌ Node.js version: ${nodeVersion} (Need v18 or higher)`);
  errors++;
}

// Check if dependencies are installed
console.log('\n📦 Checking Dependencies...\n');

const requiredDeps = [
  'algoliasearch',
  'axios',
  'chalk',
  'cli-progress',
  'dotenv',
  'mssql',
  'openai',
  'sharp'
];

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const installedDeps = packageJson.dependencies || {};

requiredDeps.forEach(dep => {
  if (installedDeps[dep]) {
    console.log(`✅ ${dep}: ${installedDeps[dep]}`);
  } else {
    console.log(`❌ ${dep}: Not found in package.json`);
    errors++;
  }
});

// Check if node_modules exists
if (fs.existsSync('node_modules')) {
  console.log('\n✅ node_modules directory exists');
} else {
  console.log('\n❌ node_modules directory not found. Run: npm install');
  errors++;
}

// Check configuration files
console.log('\n⚙️  Checking Configuration...\n');

// Check database config
if (fs.existsSync('config/dbConfig.json')) {
  console.log('✅ config/dbConfig.json exists');
  try {
    const dbConfig = JSON.parse(fs.readFileSync('config/dbConfig.json', 'utf8'));
    if (dbConfig.server && dbConfig.database && dbConfig.user) {
      console.log('   ├─ Server:', dbConfig.server);
      console.log('   ├─ Database:', dbConfig.database);
      console.log('   └─ User:', dbConfig.user);
    } else {
      console.log('⚠️  Database config incomplete');
      warnings++;
    }
  } catch (error) {
    console.log('❌ Database config invalid JSON');
    errors++;
  }
} else {
  console.log('❌ config/dbConfig.json not found');
  console.log('   Copy from: config/dbConfig.example.json');
  errors++;
}

// Check environment variables
console.log('\n🔑 Checking API Keys...\n');

// Check OpenAI
if (process.env.OPENAI_API_KEY) {
  const key = process.env.OPENAI_API_KEY;
  if (key.startsWith('sk-')) {
    console.log(`✅ OPENAI_API_KEY: Configured (${key.substring(0, 10)}...)`);
  } else {
    console.log('⚠️  OPENAI_API_KEY: Invalid format (should start with "sk-")');
    warnings++;
  }
} else {
  console.log('⚠️  OPENAI_API_KEY: Not configured');
  warnings++;
}

// Check Gemini
if (process.env.GOOGLE_API_KEY) {
  const key = process.env.GOOGLE_API_KEY;
  console.log(`✅ GOOGLE_API_KEY: Configured (${key.substring(0, 10)}...)`);
} else {
  console.log('⚠️  GOOGLE_API_KEY: Not configured');
  warnings++;
}

// At least one AI provider is required
if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
  console.log('❌ No AI provider configured! Need at least OpenAI or Gemini API key');
  errors++;
}

// Check optional keys
if (process.env.GOOGLE_CX_ID) {
  console.log('✅ GOOGLE_CX_ID: Configured (for image fetching)');
} else {
  console.log('ℹ️  GOOGLE_CX_ID: Not configured (optional - for image fetching)');
}

if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_ADMIN_API_KEY) {
  console.log('✅ Algolia: Configured (for search sync)');
} else {
  console.log('ℹ️  Algolia: Not configured (optional - for search sync)');
}

// Check directories
console.log('\n📁 Checking Directories...\n');

if (fs.existsSync('logs')) {
  console.log('✅ logs/ directory exists');
} else {
  console.log('⚠️  logs/ directory not found (will be created automatically)');
}

// Summary
console.log('\n' + '═'.repeat(60));
console.log('\n📊 Verification Summary:\n');

if (errors === 0 && warnings === 0) {
  console.log('🎉 Perfect! All checks passed!');
  console.log('\n✨ Your enrichment engine is ready to use!\n');
  console.log('Next steps:');
  console.log('  1. Ensure SQL Server is running and accessible');
  console.log('  2. Run the database schema: db/quoteworks-schema.sql');
  console.log('  3. Test with: node src/index.js 5');
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error${errors > 1 ? 's' : ''} found`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning${warnings > 1 ? 's' : ''} found`);
  }
  
  console.log('\n📝 Action Required:\n');
  
  if (errors > 0) {
    console.log('Critical issues must be fixed before running the engine:');
    console.log('  • Install dependencies: npm install');
    console.log('  • Configure database: config/dbConfig.json');
    console.log('  • Set API keys in parent .env file');
  }
  
  if (warnings > 0) {
    console.log('\nWarnings (optional features):');
    console.log('  • Add AI provider keys for better results');
    console.log('  • Configure Google Custom Search for images');
    console.log('  • Configure Algolia for search synchronization');
  }
}

console.log('\n' + '═'.repeat(60));
console.log('\n📚 Documentation:');
console.log('  • README.md - Feature overview');
console.log('  • SETUP.md - Detailed setup guide');
console.log('  • INTEGRATION.md - Integration patterns');
console.log('  • PROJECT_SUMMARY.md - Executive summary');
console.log('\n');

process.exit(errors > 0 ? 1 : 0);
