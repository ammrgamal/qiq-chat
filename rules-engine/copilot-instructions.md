# Copilot Instructions for Rules Engine

## Primary Task

Generate a Node.js script (`rules-engine.js`) that enriches QuoteWerks products using OpenAI + Google APIs and syncs processed data with Algolia.

## Requirements

### 1. Database Connection
- Connect to QuoteWerks SQL Server database
- Use configuration from `config/dbConfig.json`
- Use connection pooling for efficiency
- Handle connection errors gracefully

### 2. Product Selection
- Read products from QuoteWerks database
- **Testing Mode**: Process 20 random products initially
- **Production Mode**: Process all unprocessed products
- Skip rows where `AIProcessed` (CustomNumber02) = TRUE
- Configurable via `TEST_LIMIT` constant:
  ```javascript
  const TEST_LIMIT = 20; // Set to null for all products
  ```

### 3. AI Content Generation (OpenAI)

Generate the following content for each product:

#### Short Description (CustomMemo01)
- If empty, generate from main Description
- Max 200 characters
- Clear, concise product summary

#### Long Features List (CustomText07)
- 5-7 key features
- Bullet-point format
- Technical and business value

#### Specifications Table (CustomText08)
- Technical specifications in table format
- Based on product description and part number
- Include dimensions, weight, power, connectivity

#### FAQ (CustomText06)
- 3-5 common questions with answers
- Focus on compatibility, installation, support

#### Marketing Message (CustomMemo10)
- Value proposition and benefits
- Why purchase this product
- Use cases and applications

#### Upsell Suggestions (CustomMemo09)
- Related products for bundle/upsell
- Compatible accessories
- Service offerings

#### Category Classification
- CustomText01: Main category
- CustomText02: Subcategory
- Based on product type and manufacturer

#### AI Rules
- CustomText09: Product-specific rules
- CustomText10: Category-level rules

### 4. Image Fetching (Google Custom Search API)

**Only execute if ImageFile is empty:**

1. Call Google Custom Search API with product name and manufacturer
2. Try first 8 image results
3. For each image:
   - Download and analyze
   - Calculate white background percentage
   - Select first image with ≥78% white background
4. Fallback: Use `{Manufacturer}.jpg` if no suitable image found
5. Store final URL in ImageFile field

### 5. Database Updates

Update the following fields for each processed product:

```sql
UPDATE Products SET
  CustomMemo01 = @shortDescription,
  CustomText01 = @category,
  CustomText02 = @subcategory,
  CustomText03 = @prerequisites,
  CustomText04 = @relatedItems,
  CustomText05 = @servicesScope,
  CustomText06 = @faq,
  CustomText07 = @features,
  CustomText08 = @specifications,
  CustomText09 = @aiRuleProduct,
  CustomText10 = @aiRuleCategory,
  CustomNumber01 = @confidence,
  CustomNumber02 = 1, -- AIProcessed flag
  CustomMemo09 = @upsellSuggestions,
  CustomMemo10 = @marketingMessage,
  ImageFile = @imageUrl,
  AIProcessedDate = GETDATE()
WHERE PartNumber = @partNumber
```

### 6. Logging

#### AI Processing Log (AI_Log table)
```javascript
{
  InputText: JSON.stringify(productData),
  OutputText: JSON.stringify(aiResponse),
  AIProvider: 'OpenAI' or 'Gemini',
  Model: 'gpt-4o-mini' or model name,
  TokensUsed: number,
  ProcessingTimeMs: number,
  Status: 'Success' | 'Error' | 'Partial',
  Metadata: JSON with additional info
}
```

#### File Logging (logs/rules-engine.log)
- Each step with timestamp
- Success/error messages
- Product name and part number
- Processing time per product
- API call counts
- Total summary

### 7. Progress Display

Use `cli-progress` package:
```javascript
const progressBar = new cliProgress.SingleBar({
  format: 'Processing |{bar}| {percentage}% | {value}/{total} Products | ETA: {eta}s'
});
```

### 8. Summary Report

At completion, display:
- Total products processed
- Success count
- Error count
- Total processing time
- Average time per product
- API calls made (OpenAI + Google)
- Images fetched
- Confidence score distribution

### 9. Error Handling

- Wrap all API calls in try-catch blocks
- Retry failed API calls (max 3 attempts with exponential backoff)
- Log all errors to both console and file
- Continue processing remaining products on error
- Mark partial success products appropriately

### 10. API Call Optimization

**Minimize API calls by:**
- Batching requests where possible
- Caching manufacturer information
- Reusing category rules for similar products
- Only calling Google API when ImageFile is empty
- Using efficient prompts to get all content in fewer calls

### 11. Code Quality Requirements

- **Modular**: Use helper functions in `utils/` directory
- **Commented**: Clear comments explaining each step
- **Optimized**: Minimize redundant operations
- **ES6+**: Use modern JavaScript features (async/await, destructuring)
- **Error Messages**: Descriptive error messages with context
- **Configuration**: Easy to configure via constants at top of file

## Example Usage

```javascript
// Run in test mode (20 products)
node rules-engine.js

// Run in production mode (all products)
// Change TEST_LIMIT to null in code, then:
node rules-engine.js
```

## Configuration Constants

```javascript
// At top of rules-engine.js
const TEST_LIMIT = 20; // null for all products
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const IMAGE_WHITE_THRESHOLD = 78; // percentage
const IMAGE_CHECK_LIMIT = 8; // first N images to check
```

## Dependencies

Required npm packages:
- `mssql` - SQL Server connection
- `openai` - OpenAI API
- `axios` - HTTP requests (Google API)
- `dotenv` - Environment variables
- `cli-progress` - Progress bar
- `chalk` - Colored console output
- `sharp` - Image analysis (for white background detection)
- `jimp` - Alternative image processing

## Environment Variables

Required in `.env`:
```
OPENAI_API_KEY=your_key
GOOGLE_API_KEY=your_key
GOOGLE_CX_ID=your_cx_id
```

## Helper Functions to Use

From `utils/ai-helper.js`:
- `generateProductContent(product)` - Generate all AI content
- `calculateConfidence(product, response)` - Calculate confidence score

From `utils/google-helper.js`:
- `searchProductImage(productName, manufacturer)` - Search for image
- `analyzeImageBackground(imageUrl)` - Check white background percentage

From `utils/sql-helper.js`:
- `connectDatabase()` - Connect to SQL Server
- `getUnprocessedProducts(limit)` - Get products to process
- `updateProduct(partNumber, data)` - Update product fields
- `logAIProcess(logData)` - Log to AI_Log table

## Success Criteria

1. ✅ Connects to SQL Server successfully
2. ✅ Reads products (20 for testing, all for production)
3. ✅ Skips already processed products
4. ✅ Generates all required AI content
5. ✅ Fetches images only when needed
6. ✅ Selects images with white background
7. ✅ Updates all fields correctly
8. ✅ Logs each step to file and database
9. ✅ Shows progress bar during processing
10. ✅ Displays summary report at completion
11. ✅ Handles errors gracefully
12. ✅ Code is modular, commented, and optimized

## Notes

- Use the existing `mapping-reference.md` for field definitions
- Refer to `schema.sql` for database structure
- Check `utils/` directory for helper functions
- Test with 20 products before running on full dataset
- Monitor API usage to stay within limits
- Review logs after each run for issues
