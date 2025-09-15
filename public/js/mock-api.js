/* Mock API for testing UI functionality */
window.mockSearchResults = [
  {
    name: "Kaspersky Endpoint Security for Business",
    price: "299.99",
    sku: "KES-ADV-1Y",
    image: "https://via.placeholder.com/40x40?text=KES",
    link: "https://example.com/kaspersky"
  },
  {
    name: "Kaspersky Security Center",
    price: "199.99", 
    sku: "KSC-STD-1Y",
    image: "https://via.placeholder.com/40x40?text=KSC",
    link: "https://example.com/ksc"
  },
  {
    name: "Kaspersky Endpoint Detection and Response",
    price: "Price on request",
    sku: "EDR-ENT-1Y",
    image: "https://via.placeholder.com/40x40?text=EDR",
    link: "https://example.com/edr"
  },
  {
    name: "Kaspersky Anti-Virus 2024",
    price: "39.99",
    sku: "KAV-2024",
    image: "https://via.placeholder.com/40x40?text=KAV",
    link: "https://example.com/kav"
  },
  {
    name: "Kaspersky Internet Security",
    price: "49.99",
    sku: "KIS-2024",
    image: "https://via.placeholder.com/40x40?text=KIS", 
    link: "https://example.com/kis"
  }
];

// Override API calls for testing
const originalRunSearch = window.runSearch;
const originalRunChat = window.runChat;

// Mock search function
window.runSearch = async function(query, hitsPerPage = 5) {
  console.log('Mock search for:', query);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
  return window.mockSearchResults;
};

// Mock chat function  
window.runChat = async function(messages) {
  console.log('Mock chat with messages:', messages);
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
  return "هذا رد تجريبي من النظام. يمكنك البحث عن منتجات Kaspersky في الجدول أدناه.";
};