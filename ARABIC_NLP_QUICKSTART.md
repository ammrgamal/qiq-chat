# Arabic NLP - Quick Start Guide

## 🚀 Quick Setup

### 1. Configure Environment

Add to your `.env` file:

```bash
# OpenAI (primary translator)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Google Gemini (fallback)
GEMINI_API=...
GEMINI_MODEL=gemini-1.5-flash
```

### 2. Setup Database

Run the schema creation script:

```bash
# Execute in your SQL Server
enrichment-engine/db/quoteworks-schema.sql
```

This creates the `AI_Learning_Log` table and updates field documentation.

### 3. Test Installation

```bash
# Test detection and normalization (no API required)
node rules-engine/src/test-arabic-nlp.js --detect --normalize

# Run interactive demo
node rules-engine/examples/arabic-nlp-demo.js 1
```

## 🔍 Quick Usage Examples

### Detect Arabic Text

```javascript
import arabicNLP from './rules-engine/src/arabicNLP.js';

const hasArabic = arabicNLP.containsArabic('فايروول فورتينت');
// Returns: true
```

### Normalize Arabic Text

```javascript
const normalized = arabicNLP.normalizeArabic('فَايَرْوُول');
// Returns: "فايروول"
```

### Translate Arabic to English

```javascript
const translation = await arabicNLP.translateToEnglish('فورتينت', 'brand');
console.log(translation.translated);    // "Fortinet"
console.log(translation.transliterated); // "Fortinet"
console.log(translation.confidence);     // 95
```

### Preprocess Search Query

```javascript
const result = await arabicNLP.preprocessQuery('عايز كابل فايبر 4 كور');
console.log(result.processed); // "Fiber Cable 4 Core"
console.log(result.isArabic);  // true
```

### Generate Product Synonyms

```javascript
const synonyms = await arabicNLP.generateSynonyms('Fortinet Firewall فايروول');
console.log(synonyms.english); // ["Fortinet", "Firewall"]
console.log(synonyms.arabic);  // ["فايروول"]
console.log(synonyms.merged);  // ["Fortinet", "Firewall", "فايروول"]
```

## 🧪 Testing Commands

```bash
# Test detection only
node rules-engine/src/test-arabic-nlp.js --detect

# Test normalization only
node rules-engine/src/test-arabic-nlp.js --normalize

# Test translation (requires API keys)
node rules-engine/src/test-arabic-nlp.js --translate

# Run all demos
node rules-engine/examples/arabic-nlp-demo.js

# Run specific demo
node rules-engine/examples/arabic-nlp-demo.js 1 2
```

## 📡 API Endpoints

### Get Learning Statistics

```bash
GET /api/admin/learning-suggestions?stats=true
```

Response:
```json
{
  "ok": true,
  "statistics": {
    "TotalLogs": 150,
    "Pending": 25,
    "AutoApproved": 100,
    "ManuallyApproved": 15,
    "Rejected": 10,
    "ArabicQueries": 120,
    "AvgConfidence": 85.5
  }
}
```

### Get Pending Suggestions

```bash
GET /api/admin/learning-suggestions?limit=50
```

### Get Top Failing Queries

```bash
GET /api/admin/learning-suggestions?topFailing=true&limit=20
```

### Approve a Suggestion

```bash
POST /api/admin/learning-suggestions
Content-Type: application/json

{
  "action": "approve",
  "logId": 123,
  "approvedBy": "Admin"
}
```

### Reject a Suggestion

```bash
POST /api/admin/learning-suggestions
Content-Type: application/json

{
  "action": "reject",
  "logId": 123,
  "reason": "Incorrect translation",
  "rejectedBy": "Admin"
}
```

## 🔧 Integration Examples

### In Search API

The search API automatically preprocesses Arabic queries:

```javascript
// In api/search.js
const result = await arabicNLP.preprocessQuery(userQuery);
const searchQuery = result.processed;
// Continue with Algolia search...
```

### In Chat API

The chat API also supports Arabic preprocessing:

```javascript
// In api/chat.js
if (arabicNLP.containsArabic(query)) {
  const preprocessed = await arabicNLP.preprocessQuery(query);
  searchQuery = preprocessed.processed;
}
```

### In Enrichment Service

Products get bilingual synonyms during enrichment:

```javascript
// In enrichmentService.js
const synonyms = await arabicNLP.generateSynonyms(productName, 'product');
enrichedData.CustomMemo07 = JSON.stringify(synonyms.english);
enrichedData.CustomMemo08 = JSON.stringify(synonyms.arabic);
```

## 📊 Database Queries

### View Failed Arabic Queries

```sql
SELECT TOP 20 
  QueryText, 
  NormalizedQuery,
  Confidence,
  LogDate
FROM dbo.AI_Learning_Log
WHERE IsArabic = 1 
  AND SearchResultsCount = 0
ORDER BY LogDate DESC;
```

### Get Auto-Approved Suggestions

```sql
SELECT 
  QueryText,
  AISuggestion,
  Confidence,
  ApprovedDate
FROM dbo.AI_Learning_Log
WHERE Status = 'AutoApproved'
ORDER BY ApprovedDate DESC;
```

### Get Top Failing Queries

```sql
SELECT TOP 10
  QueryText,
  COUNT(*) AS FailCount,
  AVG(Confidence) AS AvgConfidence
FROM dbo.AI_Learning_Log
WHERE SearchResultsCount = 0
GROUP BY QueryText
ORDER BY FailCount DESC;
```

## 🎯 Common Patterns

### Pattern 1: Search with Arabic Support

```javascript
// 1. Preprocess query
const preprocessed = await arabicNLP.preprocessQuery(userQuery);

// 2. Search Algolia
const results = await algoliaIndex.search(preprocessed.processed);

// 3. Log if no results found
if (results.hits.length === 0 && preprocessed.isArabic) {
  await aiLearningLog.logFailedQuery({
    query: userQuery,
    searchResults: [],
    context: { preprocessed }
  });
}
```

### Pattern 2: Product Enrichment

```javascript
// 1. Generate synonyms
const synonyms = await arabicNLP.generateSynonyms(productName);

// 2. Store in database
await db.query(`
  UPDATE Products 
  SET CustomMemo07 = @englishSynonyms,
      CustomMemo08 = @arabicSynonyms
  WHERE PartNumber = @partNumber
`, {
  englishSynonyms: JSON.stringify(synonyms.english),
  arabicSynonyms: JSON.stringify(synonyms.arabic),
  partNumber: product.partNumber
});
```

### Pattern 3: Cache Management

```javascript
// Get cache statistics
const stats = arabicNLP.getCacheStats();
console.log(`Cache size: ${stats.size} entries`);

// Clear cache if needed
arabicNLP.clearCache();
```

## 🐛 Troubleshooting

### Translation not working?

1. Check API keys are set in `.env`
2. Verify API key has credits
3. Check network connectivity
4. Review error logs

### Learning log not saving?

1. Verify database connection
2. Check `AI_Learning_Log` table exists
3. Review database permissions

### Cache not working?

1. Cache is in-memory (cleared on restart)
2. Check stats: `arabicNLP.getCacheStats()`
3. Clear manually: `arabicNLP.clearCache()`

## 📚 More Resources

- **Full Documentation**: `rules-engine/ARABIC_NLP_README.md`
- **Implementation Details**: `ARABIC_NLP_IMPLEMENTATION.md`
- **Tests**: `rules-engine/src/__tests__/arabicNLP.test.js`
- **Demos**: `rules-engine/examples/arabic-nlp-demo.js`

## 🆘 Support

For issues or questions:
1. Check logs in `rules-engine/logs/rules-engine.log`
2. Review `AI_Learning_Log` table
3. Run test scripts
4. Contact development team

---

**Last Updated**: October 2025  
**Version**: 1.0.0
