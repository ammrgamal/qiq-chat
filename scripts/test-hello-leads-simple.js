// Simple test script for Hello Leads integration
console.log('Testing Hello Leads Integration...');

const testData = {
    number: 'Q-TEST-001',
    date: new Date().toISOString().slice(0,10),
    client: { 
        name: 'شركة الاختبار', 
        contact: 'أحمد محمد', 
        email: 'test@example.com', 
        phone: '+966501234567' 
    },
    project: { 
        name: 'مشروع تجريبي', 
        requester_role: 'مهندس', 
        expected_closing_date: '2025-10-15' 
    },
    items: [
        { description: 'سويتش 24 بورت', pn: 'SW-24', qty: 2 }
    ]
};

console.log('Test data:', JSON.stringify(testData, null, 2));

// Test without actual API call first
console.log('✅ Test data prepared successfully');
console.log('Note: To test actual API, make sure you have HELLO_LEADS_API_KEY and HELLO_LEADS_LIST_KEY set in .env file');