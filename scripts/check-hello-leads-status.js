// Enhanced Hello Leads & V0 Integration Status Checker
console.log('🔍 Checking Hello Leads & V0 Integration Status...\n');

// Check environment variables
const apiKey = process.env.HELLO_LEADS_API_KEY || 
               process.env.HELLOLEADS_API_KEY || 
               process.env.Heallo_Leads_API_Key_Token || '';

const listKey = process.env.HELLO_LEADS_LIST_KEY || 
                process.env.HELLOLEADS_LIST_KEY || 
                process.env.Heallo_Leads_QuickITQuote_List_Key || '';

const v0ApiKey = process.env.V0_API_Key || process.env.UI_API_Key || process.env.V0_API_KEY || '';

const endpoint = process.env.HELLO_LEADS_ENDPOINT || 
                 process.env.HELLOLEADS_ENDPOINT || 
                 'https://app.helloleads.io/index.php/api/leads/add';

console.log('📋 Configuration Status:');
console.log('='.repeat(50));
console.log(`✅ Hello Leads API Key: ${apiKey ? '✓ Set (' + apiKey.substring(0, 8) + '...)' : '❌ Missing'}`);
console.log(`✅ Hello Leads List Key: ${listKey ? '✓ Set (' + listKey.substring(0, 8) + '...)' : '❌ Missing'}`);
console.log(`✅ V0 API Key: ${v0ApiKey ? '✓ Set (' + v0ApiKey.substring(0, 8) + '...)' : '❌ Missing'}`);
console.log(`✅ Endpoint: ${endpoint}`);

const isHelloLeadsReady = Boolean(apiKey && listKey);
const isV0Ready = Boolean(v0ApiKey);

console.log(`\n🎯 Integration Status:`);
console.log(`Hello Leads CRM: ${isHelloLeadsReady ? '✅ READY' : '❌ NEEDS SETUP'}`);
console.log(`V0 AI Chat: ${isV0Ready ? '✅ READY' : '❌ NEEDS SETUP'}`);

if (!isHelloLeadsReady) {
    console.log('\n📝 To setup Hello Leads integration:');
    console.log('1. Get your API Key and List Key from Hello Leads');
    console.log('2. Add them to .env file:');
    console.log('   Heallo_Leads_API_Key_Token=your_api_key_here');
    console.log('   HELLO_LEADS_LIST_KEY=your_list_key_here');
    console.log('3. Restart the server');
    console.log('4. Run: node scripts/test-hello-leads.mjs');
} else {
    console.log('\n🚀 Integration is configured and ready!');
    console.log('📞 Every quote request will be automatically sent to Hello Leads CRM');
    console.log('🧪 Run test: node scripts/test-hello-leads.mjs');
}

console.log('\n📚 For detailed setup guide, see: HELLO_LEADS_SETUP.md');