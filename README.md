# QuickITQuote (qiq-chat)

> AI-powered quoting system with product catalog, intelligent chat, and automated enrichment

## 🎯 Overview

QuickITQuote is a comprehensive, bilingual (Arabic/English) quoting and catalog system that combines AI-powered features with professional business tools. The system includes product enrichment, intelligent chat, CRM integration, and advanced search capabilities.

## 🚀 Key Features

### 💎 Product Enrichment Engine (NEW)
- **AI-Powered Content Generation**: Automatic descriptions, features, specs, FAQ
- **Smart Image Fetching**: Google Custom Search with white background detection
- **QuoteWerks Integration**: Full database integration with 30+ custom fields
- **Algolia Synchronization**: Real-time search index mirroring
- **Batch Processing**: Process 20+ products with progress tracking
- **Self-Learning Rules**: Intelligent product and category rules
- 📚 [Full Documentation](enrichment-engine/README.md)

### 🤖 AI Chat Assistant
- Bilingual support (Arabic/English)
- Product recommendations
- Technical consulting
- V0 API + OpenAI integration

### 🔍 Advanced Search (Algolia)
- Fast, faceted search
- Real-time filtering
- Category-based browsing
- Product details modal

### 💼 Quote Management
- Smart shopping cart
- Auto-save to localStorage
- Tax calculations
- Email delivery
- Professional PDF generation

### 🔗 CRM Integration (Hello Leads)
- Automatic lead capture
- Quote submission tracking
- Activity logging
- Customer management

### 📊 Admin Dashboard
- User management
- Quotation tracking
- Activity monitoring
- System configuration
- Enrichment statistics

## 📁 Project Structure

```
qiq-chat/
├── enrichment-engine/          # NEW: AI-powered product enrichment
│   ├── src/                    # Core modules
│   ├── config/                 # Database configuration
│   ├── db/                     # SQL schema
│   ├── logs/                   # Processing logs
│   ├── README.md               # Full documentation
│   ├── SETUP.md                # Setup guide
│   └── INTEGRATION.md          # Integration patterns
│
├── rules-engine/               # Product classification & auto-approval
│   ├── src/                    # AI services
│   ├── config/                 # Configuration
│   └── db/                     # Database schema
│
├── api/                        # Backend API endpoints
│   ├── admin/                  # Admin routes
│   ├── users/                  # User management
│   ├── storage/                # Data storage
│   └── _lib/                   # Shared utilities
│
├── public/                     # Frontend assets
│   ├── js/                     # JavaScript modules
│   ├── css/                    # Stylesheets
│   └── fonts/                  # Arabic fonts
│
├── scripts/                    # Utility scripts
├── __tests__/                  # Unit tests
├── server.js                   # Express server
└── package.json                # Dependencies
```

## 🛠️ Installation

### Prerequisites

- **Node.js** 18 or higher
- **SQL Server** (for enrichment engine)
- **API Keys**:
  - OpenAI or Google Gemini (for AI features)
  - Algolia (for search)
  - Google Custom Search (optional, for images)
  - Hello Leads (for CRM)

### Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/ammrgamal/qiq-chat.git
   cd qiq-chat
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Create .env file in root directory
   cp .env.example .env
   
   # Edit .env with your API keys
   OPENAI_API_KEY=sk-xxxxxxxxxxxx
   GOOGLE_API_KEY=xxxxxxxxxxxx
   ALGOLIA_APP_ID=xxxxxxxxxxxx
   ALGOLIA_API_KEY=xxxxxxxxxxxx
   ```

3. **Start the Server**
   ```bash
   npm start
   # Server runs on http://localhost:3039
   ```

4. **Setup Enrichment Engine** (Optional)
   ```bash
   cd enrichment-engine
   npm install
   npm run verify
   # Follow setup guide: SETUP.md
   ```

## 📚 Module Documentation

### Enrichment Engine
Complete AI-powered product enrichment system:
- [README](enrichment-engine/README.md) - Feature overview
- [SETUP](enrichment-engine/SETUP.md) - Installation guide
- [INTEGRATION](enrichment-engine/INTEGRATION.md) - Integration patterns
- [PROJECT_SUMMARY](enrichment-engine/PROJECT_SUMMARY.md) - Executive summary

### Rules Engine
Product classification and auto-approval:
- [README](rules-engine/README.md) - Classification system
- [SETUP](rules-engine/SETUP.md) - Configuration
- [INTEGRATION](rules-engine/INTEGRATION.md) - Usage examples

### Main Application
- [Project Instructions](project-instructions.md) - Development guide
- [AI System Complete](AI_SYSTEM_COMPLETE.md) - System overview (Arabic)
- [Hello Leads Setup](HELLO_LEADS_SETUP.md) - CRM integration

## 🎨 Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Landing page |
| AI Chat | `/ai-chat.html` | Intelligent assistant |
| Products | `/products-list.html` | Product catalog |
| Quote | `/quote.html` | Quote builder |
| Admin | `/admin.html` | Admin dashboard |

## 🔧 Configuration

### Environment Variables

```bash
# AI Providers
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
GOOGLE_API_KEY=xxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-flash

# Search
ALGOLIA_APP_ID=xxxxxxxxxxxx
ALGOLIA_API_KEY=xxxxxxxxxxxx
ALGOLIA_INDEX_NAME=woocommerce_products

# CRM
Heallo_Leads_API_Key_Token=xxxxxxxxxxxx
Heallo_Leads_QuickITQuote_List_Key=xxxxxxxxxxxx

# Image Search (Optional)
GOOGLE_CX_ID=xxxxxxxxxxxx

# Email (Optional)
RESEND_API_KEY=xxxxxxxxxxxx
```

### Database Configuration

For enrichment engine, configure `enrichment-engine/config/dbConfig.json`:

```json
{
  "user": "your_username",
  "password": "your_password",
  "server": "localhost",
  "database": "QuoteWerksDB",
  "options": {
    "encrypt": false,
    "trustServerCertificate": true
  }
}
```

## 🚀 Usage Examples

### Running Enrichment Engine

```bash
# Navigate to enrichment engine
cd enrichment-engine

# Verify setup
npm run verify

# Process 20 products
npm start

# Process custom batch size
node src/index.js 50

# Sync to Algolia
npm run sync

# View statistics
npm run stats
```

### API Integration

```javascript
// In your qiq-chat code
import enrichmentEngine from './enrichment-engine/src/enrichmentEngine.js';

// Initialize and process
await enrichmentEngine.initialize();
const result = await enrichmentEngine.processBatch(20);
await enrichmentEngine.shutdown();
```

### Using Rules Engine

```javascript
import { processInput } from './rules-engine/src/rulesEngine.js';

// Classify a product
const result = await processInput({
  name: 'Cisco Catalyst Switch',
  partNumber: 'WS-C2960-24TT-L',
  manufacturer: 'Cisco',
  price: 1499.99
});

console.log(result.classification); // { category, confidence, ... }
console.log(result.approval);       // { approved, reason, ... }
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npm run test:search

# Verify enrichment setup
cd enrichment-engine && npm run verify
```

## 📊 Monitoring

### Health Check
```
GET /health
```

Returns status of all services:
- OpenAI API
- Gemini API
- Algolia
- Hello Leads
- Resend Email

### Enrichment Statistics
```bash
cd enrichment-engine
node src/index.js --stats
```

Shows:
- Recent batch results
- AI provider statistics
- Success rates
- Processing times

## 🔐 Security

- API keys in environment variables (not in code)
- Database credentials in config files (gitignored)
- CORS protection
- Rate limiting
- Helmet security headers
- Input validation

## 🌍 Deployment

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Import repository in Vercel dashboard
   - Configure environment variables
   - Deploy

3. **Configure Build**
   ```json
   {
     "builds": [
       { "src": "server.js", "use": "@vercel/node" }
     ]
   }
   ```

### Environment Variables in Vercel

Add all environment variables from `.env` in Vercel dashboard settings.

## 🤝 Integration Patterns

### 1. Standalone Enrichment
```bash
# Cron job for daily enrichment
0 2 * * * cd /path/to/enrichment-engine && npm start
```

### 2. API Integration
```javascript
app.post('/api/enrich', async (req, res) => {
  const result = await enrichmentEngine.processBatch(20);
  res.json(result);
});
```

### 3. Webhook Integration
```javascript
// Receive enrichment completion
app.post('/api/webhooks/enrichment', (req, res) => {
  const { batchId, stats } = req.body;
  // Handle completion
});
```

## 📈 Performance

### Enrichment Engine
- **Processing Speed**: ~2-3 seconds per product
- **Batch Size**: 20 products (configurable)
- **API Calls**: Rate limited to 1/second
- **Success Rate**: Typically >95%

### Main Application
- **Response Time**: <200ms average
- **Search Latency**: <50ms (Algolia)
- **Concurrent Users**: Scalable via Vercel

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check SQL Server is running
systemctl status mssql-server  # Linux
services.msc                   # Windows

# Verify credentials in config/dbConfig.json
```

**API Key Errors**
```bash
# Verify keys are in .env file (root directory)
cat .env | grep API_KEY

# Check key format
# OpenAI: starts with "sk-"
# Gemini: alphanumeric string
```

**No Products Found**
```sql
-- Check products exist
SELECT COUNT(*) FROM Products WHERE ManufacturerPartNo IS NOT NULL;

-- Reset processed flag
UPDATE Products SET CustomText11 = NULL WHERE CustomText11 = 'TRUE';
```

For more troubleshooting, see:
- [Enrichment Engine SETUP.md](enrichment-engine/SETUP.md)
- [Rules Engine SETUP.md](rules-engine/SETUP.md)

## 📞 Support

For issues or questions:
1. Check the documentation in respective module directories
2. Review error logs in `enrichment-engine/logs/`
3. Check database logs in `Enrichment_Log` table
4. Enable debug mode: `NODE_ENV=development npm start`

## 🗺️ Roadmap

### Completed ✅
- [x] AI Chat Assistant
- [x] Product Catalog with Algolia
- [x] Quote Management
- [x] PDF Generation
- [x] Hello Leads Integration
- [x] Admin Dashboard
- [x] Rules Engine
- [x] **Enrichment Engine** (NEW)

### In Progress 🚧
- [ ] Multi-language content (Arabic/English)
- [ ] Advanced image analysis
- [ ] Video content generation
- [ ] Real-time enrichment

### Planned 📋
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Machine learning feedback
- [ ] Automated datasheet parsing
- [ ] Social media integration

## 📄 License

Proprietary - QuickITQuote Project

## 👥 Contributors

- **Ammr Gamal** - Project Owner
- Development Team

## 🎉 Highlights

### Recent Additions

**Enrichment Engine v1.0.0** (Latest)
- Complete AI-powered product enrichment
- 30+ QuoteWerks custom fields mapped
- Google Custom Search for images
- Algolia synchronization
- 60,000+ words of documentation
- Production-ready with comprehensive logging

**System Integration**
- All modules working seamlessly
- Professional code quality
- Extensive documentation
- Multiple integration patterns
- Security best practices

---

**Made with ❤️ by the QuickITQuote Team**

For detailed documentation on specific modules, see their respective README files.
