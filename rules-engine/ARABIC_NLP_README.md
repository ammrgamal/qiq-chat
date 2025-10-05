# Arabic Synonym & NLP Enhancement

## Overview

This feature enables full bilingual (Arabic–English) understanding within the Rules Engine, AI Enrichment, and Algolia Search layer. Users can now search and interact with products using Arabic queries (e.g., "فايروول فورتينت" → "Fortinet Firewall").

## Core Components

### 1. Arabic NLP Module (`arabicNLP.js`)

Provides comprehensive Arabic text processing utilities:

- **Detection**: Identifies Arabic text using Unicode range `\u0600-\u06FF`
- **Normalization**: 
  - Removes diacritics (تشكيل)
  - Removes elongated letters (e.g., "فااايروول" → "فايروول")
  - Unifies variants: أ/إ/آ → ا, ة → ه
  - Converts Arabic numerals to Western (٨٠ → 80)
- **Translation**: Uses OpenAI/Gemini API to translate Arabic brand names and technical terms
- **Transliteration**: Generates phonetic transliterations as fallback
- **Caching**: In-memory cache to reduce API costs

### 2. AI Learning Log (`aiLearningLog.js`)

Self-learning layer that tracks and improves Arabic query matching:

- Logs failed queries with Arabic content
- Generates AI suggestions for new synonyms
- Auto-approves suggestions with ≥90% confidence
- Provides review interface for manual approval/rejection
- Tracks statistics and top failing queries

### 3. Enrichment Service Integration

The enrichment service now:
- Generates bilingual synonyms during product enrichment
- Stores English synonyms in `CustomMemo07`
- Stores Arabic synonyms in `CustomMemo08`
- Both arrays are merged in Algolia as `search_synonyms`

### 4. Rules Engine Integration

The rules engine now:
- Preprocesses Arabic product names before classification
- Normalizes and translates Arabic input
- Applies identical classification logic to Arabic or English queries

### 5. Search API Integration

Both `/api/search` and `/api/chat` now:
- Detect Arabic queries automatically
- Preprocess and translate to English
- Log failed Arabic queries for learning
- Search using translated/normalized terms

## Database Schema

### AI_Learning_Log Table

```sql
CREATE TABLE dbo.AI_Learning_Log (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    QueryText NVARCHAR(500) NOT NULL,
    NormalizedQuery NVARCHAR(500) NULL,
    IsArabic BIT NOT NULL DEFAULT 0,
    UserId NVARCHAR(100) NULL,
    SessionId NVARCHAR(100) NULL,
    Context NVARCHAR(MAX) NULL,
    SearchResultsCount INT NULL,
    AISuggestion NVARCHAR(MAX) NULL,
    Confidence DECIMAL(5,2) NULL,
    Status NVARCHAR(50) NULL,
    ApprovedDate DATETIME NULL,
    ApprovedBy NVARCHAR(100) NULL,
    RejectedDate DATETIME NULL,
    RejectedBy NVARCHAR(100) NULL,
    RejectionReason NVARCHAR(MAX) NULL,
    LogDate DATETIME NOT NULL DEFAULT GETDATE()
);
```

### Custom Memo Fields (Updated)

- **CustomMemo07**: English Synonyms (JSON array)
- **CustomMemo08**: Arabic Synonyms (JSON array)

## Usage Examples

### Testing Arabic NLP

```bash
# Run all tests
node rules-engine/src/test-arabic-nlp.js

# Run specific tests
node rules-engine/src/test-arabic-nlp.js --detect --normalize
node rules-engine/src/test-arabic-nlp.js --translate
node rules-engine/src/test-arabic-nlp.js --synonyms
```

### API Usage

#### Get Pending Learning Suggestions

```bash
GET /api/admin/learning-suggestions
GET /api/admin/learning-suggestions?limit=100
```

#### Get Statistics

```bash
GET /api/admin/learning-suggestions?stats=true
```

#### Get Top Failing Queries

```bash
GET /api/admin/learning-suggestions?topFailing=true&limit=20
```

#### Approve a Suggestion

```bash
POST /api/admin/learning-suggestions
{
  "action": "approve",
  "logId": 123,
  "approvedBy": "Admin"
}
```

#### Reject a Suggestion

```bash
POST /api/admin/learning-suggestions
{
  "action": "reject",
  "logId": 123,
  "reason": "Incorrect translation",
  "rejectedBy": "Admin"
}
```

### Programmatic Usage

```javascript
import arabicNLP from './rules-engine/src/arabicNLP.js';

// Detect Arabic text
const hasArabic = arabicNLP.containsArabic('فايروول فورتينت');

// Normalize Arabic text
const normalized = arabicNLP.normalizeArabic('فَايَرْوُول');

// Translate to English
const translation = await arabicNLP.translateToEnglish('فورتينت', 'brand');
console.log(translation.translated); // "Fortinet"

// Preprocess a query
const preprocessed = await arabicNLP.preprocessQuery('عايز كابل فايبر 4 كور');
console.log(preprocessed.processed); // English translation

// Generate synonyms
const synonyms = await arabicNLP.generateSynonyms('Fortinet Firewall فايروول');
console.log(synonyms.merged); // Combined Arabic + English array
```

## Example Flow

**User Query**: `"عايز كابل فايبر 4 كور من كومسكوب"`

1. **Detection**: System detects Arabic characters
2. **Normalization**: `"كابل فايبر 4 كور كومسكوب"` (cleaned)
3. **Translation**: `"Fiber Cable 4 Core CommScope"`
4. **Search**: Algolia search using English translation
5. **Match**: Product found via `search_synonyms` field
6. **Learning**: If no match, log query for future synonym updates

## Performance Optimizations

1. **In-Memory Caching**: Translations are cached to reduce API costs
2. **Single Translation**: Each unique term is only translated once
3. **Batch Processing**: Multiple terms can be translated in parallel
4. **Rate Limiting**: Built-in delays to avoid API rate limits

## Configuration

Required environment variables:

```bash
# OpenAI (primary translator)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Google Gemini (fallback translator)
GEMINI_API=...
GEMINI_MODEL=gemini-1.5-flash

# Database (for learning log)
DB_SERVER=...
DB_DATABASE=...
DB_USER=...
DB_PASSWORD=...
```

## Future Enhancements

- [ ] Add language auto-detection using embeddings
- [ ] Integrate Azure Translator for fallback translations
- [ ] Extend `search_synonyms` field with confidence weights
- [ ] Persistent caching using Redis or SQLite
- [ ] Batch synonym generation for entire product catalog
- [ ] Admin UI for managing learning suggestions
- [ ] A/B testing for Arabic query performance

## Testing

### Unit Tests

```bash
npm test
```

### Integration Testing

1. Start the server
2. Test Arabic search queries via `/api/search`
3. Test Arabic chat queries via `/api/chat`
4. Verify learning logs in database
5. Review pending suggestions via admin API

### Example Test Queries

- `"فايروول فورتينت"` → Should find Fortinet Firewall products
- `"سويتش 24 منفذ"` → Should find 24-port switches
- `"كابل فايبر"` → Should find fiber cables
- `"راوتر واي فاي"` → Should find WiFi routers

## Troubleshooting

### No translations are working

- Check API keys are set correctly in `.env`
- Verify API key has sufficient credits
- Check network connectivity to OpenAI/Gemini APIs

### Learning log not saving

- Verify database connection settings
- Check that `AI_Learning_Log` table exists
- Run schema creation script: `enrichment-engine/db/quoteworks-schema.sql`

### Cache not working

- Cache is in-memory and cleared on restart
- Check cache stats with: `arabicNLP.getCacheStats()`
- Clear cache manually with: `arabicNLP.clearCache()`

## Support

For issues or questions:
1. Check logs in console output
2. Review database logs in `AI_Learning_Log`
3. Test individual components with `test-arabic-nlp.js`
4. Contact development team
