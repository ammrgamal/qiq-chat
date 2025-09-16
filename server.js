const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') filePath = './index.html';

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // Handle API endpoints
  if (req.url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    if (req.url === '/api/search') {
      // Mock search data
      const mockData = {
        hits: [
          {
            name: "Kaspersky Endpoint Security for Business",
            sku: "KES-BSN-100",
            price: "45.99",
            manufacturer: "Kaspersky",
            image: "https://via.placeholder.com/68/059669/fff?text=KES",
            link: "#"
          },
          {
            name: "Kaspersky Anti-Virus Professional",
            sku: "KAV-PRO-50", 
            price: "29.99",
            manufacturer: "Kaspersky",
            image: "https://via.placeholder.com/68/2563eb/fff?text=KAV",
            link: "#"
          },
          {
            name: "Kaspersky Internet Security Premium",
            sku: "KIS-PREM-25",
            price: "39.99", 
            manufacturer: "Kaspersky",
            image: "https://via.placeholder.com/68/dc2626/fff?text=KIS",
            link: "#"
          }
        ]
      };
      res.end(JSON.stringify(mockData));
    } else if (req.url === '/api/chat') {
      res.end(JSON.stringify({
        reply: "شكرًا لاستفسارك! تم العثور على نتائج في الجدول أسفل الشات."
      }));
    } else {
      res.writeHead(404);
      res.end('API endpoint not found');
    }
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});