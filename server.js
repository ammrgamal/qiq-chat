const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;

// Mock data for testing
const mockSearchResults = [
  {
    objectID: "1",
    sku: "KASK-EDR-01",
    name: "Kaspersky Endpoint Detection & Response",
    description: "Advanced endpoint security solution with machine learning detection",
    price: 120.50,
    image: "https://via.placeholder.com/40x40?text=KAS",
    link: "#",
    pn: "KASK-EDR-01"
  },
  {
    objectID: "2", 
    sku: "MSFT-O365-E5",
    name: "Microsoft Office 365 E5",
    description: "Complete productivity suite with advanced security features",
    price: 57.00,
    image: "https://via.placeholder.com/40x40?text=O365",
    link: "#",
    pn: "MSFT-O365-E5"
  },
  {
    objectID: "3",
    sku: "VMWR-VCNT-STD", 
    name: "VMware vCenter Server Standard",
    description: "Centralized management platform for virtual infrastructure",
    price: 4250.00,
    image: "https://via.placeholder.com/40x40?text=VMW",
    link: "#",
    pn: "VMWR-VCNT-STD"
  },
  {
    objectID: "4",
    sku: "CTXS-XDS-ADV",
    name: "Citrix Virtual Apps and Desktops Advanced", 
    description: "Virtual desktop infrastructure solution",
    price: 180.75,
    image: "https://via.placeholder.com/40x40?text=CTX",
    link: "#",
    pn: "CTXS-XDS-ADV"
  },
  {
    objectID: "5",
    sku: "FRTN-FGT-100F",
    name: "Fortinet FortiGate 100F Firewall",
    description: "Next-generation firewall with integrated security features",
    price: 1250.00,
    image: "https://via.placeholder.com/40x40?text=FGT", 
    link: "#",
    pn: "FRTN-FGT-100F"
  }
];

function getContentType(ext) {
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  return types[ext] || 'text/plain';
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { query } = JSON.parse(body);
        const filteredResults = mockSearchResults.filter(item => 
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()) ||
          item.sku.toLowerCase().includes(query.toLowerCase())
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hits: filteredResults }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: "تم استلام استفسارك. يرجى استخدام البحث أعلاه للحصول على نتائج المنتجات.",
        searchQuery: JSON.parse(body).message 
      }));
    });
    return;
  }

  // Static file serving
  let filePath = '';
  if (pathname === '/') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/quote.html') {
    filePath = path.join(__dirname, 'public', 'quote.html');
  } else if (pathname.startsWith('/public/')) {
    filePath = path.join(__dirname, pathname);
  } else {
    filePath = path.join(__dirname, pathname);
  }

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = getContentType(ext);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 Internal Server Error</h1>');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});