# QuickITQuote Chat - GitHub Copilot Instructions

**ALWAYS follow these instructions first and only fallback to additional search or context gathering if the information here is incomplete or found to be in error.**

QuickITQuote Chat is an Arabic-language web application for IT product quotation and management. It consists of a static HTML/CSS/JavaScript frontend with Node.js serverless functions designed for Vercel deployment. The application integrates with Algolia search and OpenAI for intelligent product recommendations.

## Working Effectively

### Initial Setup (Required for all work)
1. **Install dependencies** - takes <1 second, NEVER CANCEL:
   ```bash
   npm install
   ```

2. **Install development tools** (if not already available):
   ```bash
   npm install -g vercel http-server
   ```

### Development Server Options

#### Option 1: Static Frontend Testing (Recommended for UI changes)
Start a simple HTTP server to test the frontend (API calls will fail gracefully):
```bash
npx http-server . -p 3000
```
- **Startup time**: Instant
- **Access URL**: http://127.0.0.1:3000
- **Use case**: Frontend development, UI testing, layout verification

#### Option 2: Full Application with Vercel (Requires authentication)
For complete functionality including API endpoints:
```bash
vercel dev
```
- **Startup time**: 10-30 seconds after authentication
- **Requires**: Vercel CLI authentication and environment variables
- **Use case**: Full application testing, API development

### Environment Variables (Required for full functionality)
The application requires these environment variables for API functionality:
- `ALGOLIA_APP_ID` - Algolia application ID
- `ALGOLIA_API_KEY` - Algolia search API key
- `ALGOLIA_INDEX` - Algolia index name (defaults to "woocommerce_products")
- `ALGOLIA_AGENT_ID` - Algolia Agent Studio ID
- `OPENAI_API_KEY` - OpenAI API key for chat functionality

**Note**: Frontend works without these variables but API calls will return 500 errors.

## Manual Validation Requirements

### ALWAYS test these scenarios after making changes:

#### Frontend Validation (using http-server)
1. **Chat Interface**:
   - Load http://127.0.0.1:3000
   - Type a test message in the Arabic input field
   - Click "إرسال" (Send) button
   - Verify error message appears in Arabic: "حصل خطأ أثناء الاتصال بالخادم"

2. **Custom Quote Form**:
   - Fill in company name, user count, email fields
   - Select priority from dropdown
   - Click "إرسال الطلب" (Submit Request)
   - Verify form submission attempts (will fail gracefully without backend)

3. **UI Responsiveness**:
   - Test Arabic RTL (right-to-left) text rendering
   - Verify all buttons and forms are clickable
   - Check table layout for BOQ (Bill of Quantities) section

#### Full Application Validation (using vercel dev)
1. **Complete Chat Flow**:
   - Submit product search queries
   - Verify Algolia search integration
   - Test product addition to BOQ table
   - Export BOQ to CSV/XLSX formats

2. **User Account System**:
   - Test registration form
   - Test login functionality
   - Verify JWT token handling

## Repository Structure

### Frontend Files
- `index.html` - Main application page with Arabic interface
- `quote.html` - Standalone custom quote page
- `public/` - Static assets directory
  - `public/css/styles.css` - Main stylesheet with RTL support
  - `public/js/` - JavaScript modules:
    - `ui-chat.js` - Chat interface and BOQ management
    - `api.js` - API communication functions
    - `account.js` - User authentication
    - `quote-form.js` - Custom quote form handling

### Backend API Files (Serverless Functions)
- `api/` - Vercel serverless functions directory
  - `api/agent.js` - Algolia Agent Studio integration
  - `api/search.js` - Product search via Algolia
  - `api/chat.js` - Chat functionality with OpenAI
  - `api/quote.js` - Quote request handling
  - `api/users/` - User authentication endpoints
    - `login.js`, `register.js`, `logout.js`, `me.js`

### Configuration Files
- `package.json` - Node.js dependencies (minimal: algoliasearch only)
- `.gitignore` - Excludes node_modules, .env files, build artifacts
- `index.js` - Entry point (simple search function)

## Common Tasks

### Repository Root Structure
```
.
├── .github/copilot-instructions.md
├── .gitignore
├── api/                    # Serverless functions
├── index.html             # Main application
├── index.js              # Simple entry point
├── package.json          # Dependencies
├── public/               # Static assets
├── quote.html           # Standalone quote page
└── node_modules/        # Dependencies (excluded from git)
```

### Dependencies Information
- **Production dependencies**: `algoliasearch@^4.24.0`
- **Development dependencies**: None in package.json (install globally as needed)
- **Node.js requirement**: >=18 (specified in package.json engines)

### Key Features
1. **Multilingual Interface**: Arabic (RTL) with English fallbacks
2. **Product Search**: Algolia-powered search with intelligent filtering
3. **BOQ Management**: Add products to Bill of Quantities, export to Excel/CSV
4. **Chat Interface**: OpenAI-powered conversational product recommendations
5. **User System**: JWT-based authentication with registration/login
6. **Quote Requests**: Custom quotation form for specific requirements

## Known Limitations and Workarounds

### API Limitations
- **No test environment**: API functions require live Algolia/OpenAI credentials
- **CORS restrictions**: Some external CDN resources may be blocked in development
- **ES6 modules**: Some browser console errors expected due to module format differences

### Development Environment
- **Vercel authentication required**: For full API testing, must authenticate with Vercel CLI
- **Environment variables**: Not included in repository, must be configured separately
- **No build process**: Application is served as static files, no compilation needed

### Validation Notes
- **Frontend-only testing sufficient** for UI changes and layout modifications
- **Full environment required** only for API functionality testing
- **Error handling graceful** - application shows user-friendly Arabic error messages when APIs unavailable

## Performance Characteristics
- **npm install**: <1 second (only 16 packages)
- **Static server startup**: Instant
- **Frontend load time**: <2 seconds
- **API response times**: Dependent on external services (Algolia, OpenAI)

## Browser Compatibility
- **Target browsers**: Modern browsers with ES6 support
- **RTL support**: Required for Arabic text rendering
- **JavaScript required**: Application is client-side JavaScript heavy

## Security Considerations
- **API keys**: Never commit to repository, use environment variables
- **JWT tokens**: Handled client-side for user authentication
- **CORS**: Configured for external API access (Algolia, OpenAI)