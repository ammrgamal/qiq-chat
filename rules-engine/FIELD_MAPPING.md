# Field Mapping Reference

Complete field mapping for AI enrichment and Algolia sync.

## AI Enrichment → SQL Products Table

| AI Output Field | SQL Field | Type | Max Length | Description |
|-----------------|-----------|------|------------|-------------|
| `shortDescription` | `ShortDescription` | NVARCHAR | 200 chars | Concise product summary |
| `extendedDescription` | `ExtendedDescription` | NVARCHAR | 4000 chars | Detailed product description |
| `features` | `CustomMemo01` | NVARCHAR | MAX | Bullet-point feature list |
| `specifications` | `CustomMemo02` | NVARCHAR | MAX | Technical specs (key:value) |
| `faq` | `CustomMemo03` | NVARCHAR | MAX | Q&A format (3-5 questions) |
| `marketingMessage` | `CustomMemo04` | NVARCHAR | MAX | Marketing pitch (2-3 sentences) |
| `rules` | `CustomMemo05` | NVARCHAR | MAX | Business rules, compatibility notes |
| `bundleSuggestions` | `CustomText01` | NVARCHAR | MAX | Comma-separated product suggestions |
| `keywords` | `KeywordList` | NVARCHAR | MAX | Comma-separated search keywords |
| `imageFile` | `ImageFile` | NVARCHAR | 255 | Image URL or filename |
| `confidence` | `AIConfidence` | DECIMAL(5,2) | - | AI confidence score (0-100) |
| - | `AIProcessed` | BIT | - | Processing flag (0 or 1) |
| - | `AIProcessedDate` | DATETIME | - | Processing timestamp |
| - | `LastModified` | DATETIME | - | Auto-updated on enrichment |

## SQL Products Table → Algolia Index

| SQL Field | Algolia Field | Type | Transform | Notes |
|-----------|---------------|------|-----------|-------|
| `ManufacturerPartNumber` | `mpn` | string | - | Manufacturer part number |
| `ManufacturerPartNumber` | `objectID` | string | - | Primary unique identifier |
| `ManufacturerPartNumber` | `sku` | string | - | Stock keeping unit |
| `InternalPartNumber` | `objectID` (fallback) | string | - | If MPN is empty |
| `ID` | `objectID` (fallback) | string | `product-${ID}` | If both MPN & InternalPN empty |
| `Manufacturer` | `brand` | string | - | Manufacturer/brand name |
| `ProductName` | `name` | string | - | Product name |
| `ShortDescription` | `ShortDescription` | string | Truncate ≤500 | Short description |
| `ExtendedDescription` | `ExtendedDescription` | string | Truncate ≤4000 | Extended description |
| `Category` | `category` | string | - | Product category |
| `UnitOfMeasure` | `unit` | string | - | Unit of measure |
| `Price` | `price` | number | parseFloat | Product price |
| `Cost` | `cost` | number | parseFloat | Product cost |
| `ListPrice` | `list_price` | number | parseFloat | List/MSRP price |
| `Availability` | `availability` | enum | 1→"Stock", 0→"on back order" | Availability status |
| `Availability` | `availability_weight` | number | 1→100, 0→50 | Sorting weight |
| `ImageFile` | `image` | string | Normalize: \ → / | Image URL |
| - | `spec_sheet` | string | - | Spec sheet URL (if available) |
| - | `link` | string | - | Product page URL (if available) |
| `KeywordList` | `tags` | string[] | Split by comma/semicolon | Search tags |
| `CustomMemo01-05` | `custom_memo` | string[] | Split, dedupe, combine | Custom memo fields |
| `CustomText01-20` | `custom_text` | string[] | Split, dedupe, combine | Custom text fields |
| `Discontinued` | `Discontinued` | boolean | - | Discontinued flag |
| `LastModified` | `LastModified` | ISO string | toISOString() | Last modified date |
| `AIConfidence` | `_ai_confidence` | number | - | AI enrichment confidence |
| `AIProcessed` | `_ai_processed` | boolean | - | AI processing flag |

## CustomMemo Fields Detail

| Field | Purpose | AI Content | Format |
|-------|---------|------------|--------|
| `CustomMemo01` | **Features** | Key product features | • Bullet list (one per line)<br>• Start with bullet symbol<br>• 5-10 features |
| `CustomMemo02` | **Specifications** | Technical specifications | • Key: Value format<br>• One spec per line<br>• 8-15 specs |
| `CustomMemo03` | **FAQ** | Common questions & answers | • Q: Question?<br>• A: Answer.<br>• 3-5 Q&A pairs |
| `CustomMemo04` | **Marketing** | Marketing message | • 2-3 sentences<br>• Value proposition<br>• Business benefits |
| `CustomMemo05` | **Rules** | Business rules | • Compatibility notes<br>• Ordering requirements<br>• Special conditions |

## CustomText Fields Detail

| Field Range | Purpose | Content |
|-------------|---------|---------|
| `CustomText01` | **Bundle Suggestions** | Comma-separated list of 3-5 complementary products |
| `CustomText02-20` | **Reserved** | Available for future use or additional AI content |

## Algolia Search Configuration

### Searchable Attributes (in order)
1. `sku`
2. `mpn`
3. `name`
4. `brand`
5. `category`
6. `custom_memo`
7. `custom_text`
8. `tags`

### Facet Attributes
- `brand` (filterable)
- `category` (filterable)
- `unit` (filterable)
- `availability` (filterable)
- `discontinued` (filterable)
- `tags` (filterable)

### Custom Ranking
1. `desc(availability_weight)` - In-stock products first
2. `asc(price)` - Lower prices first
3. `asc(name)` - Alphabetical by name

### Attributes to Retrieve
All fields except large text fields are retrieved by default. Snippets are used for:
- `ExtendedDescription:40` (40 words)
- `ShortDescription:20` (20 words)

## Data Type Conversions

### Numbers
```javascript
// SQL → Algolia
price: parseFloat(product.Price) || 0
cost: parseFloat(product.Cost) || 0
list_price: parseFloat(product.ListPrice) || 0
availability_weight: product.Availability === 1 ? 100 : 50
```

### Booleans
```javascript
// SQL → Algolia
Discontinued: product.Discontinued === 1
_ai_processed: product.AIProcessed === 1
```

### Strings
```javascript
// SQL → Algolia (with normalization)
image: product.ImageFile.replace(/\\/g, '/')
ShortDescription: product.ShortDescription.substring(0, 500)
ExtendedDescription: product.ExtendedDescription.substring(0, 4000)
```

### Arrays
```javascript
// SQL → Algolia (split and dedupe)
tags: product.KeywordList.split(/[,;\n]+/).map(s => s.trim()).filter(s => s)
custom_memo: [
  ...product.CustomMemo01.split(/[,;\n]+/),
  ...product.CustomMemo02.split(/[,;\n]+/),
  // ... up to CustomMemo05
].map(s => s.trim()).filter(s => s).filter((v, i, a) => a.indexOf(v) === i)
```

### Dates
```javascript
// SQL → Algolia
LastModified: new Date(product.LastModified).toISOString()
// Output: "2024-01-01T12:00:00.000Z"
```

## Size Limits

| Field | Max Size | Action if Exceeded |
|-------|----------|-------------------|
| Algolia record | 10 KB | Truncate large fields |
| `ShortDescription` | 500 chars | Truncate with "..." |
| `ExtendedDescription` | 4000 chars | Truncate with "..." |
| `custom_memo` array | 20 items | Take first 20 |
| `custom_text` array | 50 items | Take first 50 |
| `tags` array | 30 items | Take first 30 |

## Example Transformations

### Input (SQL Product)
```sql
ID: 123
ManufacturerPartNumber: 'WS-C2960-24TT-L'
Manufacturer: 'Cisco'
ProductName: 'Cisco Catalyst 2960 24-Port Switch'
ShortDescription: 'Managed Layer 2 switch'
Price: 1499.99
Availability: 1
ImageFile: 'images\cisco\catalyst-2960.jpg'
CustomMemo01: 'Feature 1\nFeature 2\nFeature 3'
CustomText01: 'SFP Module, Power Cable, Rack Kit'
KeywordList: 'cisco,switch,network,managed,2960'
AIConfidence: 95.5
AIProcessed: 1
```

### Output (Algolia Record)
```json
{
  "objectID": "WS-C2960-24TT-L",
  "sku": "WS-C2960-24TT-L",
  "mpn": "WS-C2960-24TT-L",
  "name": "Cisco Catalyst 2960 24-Port Switch",
  "brand": "Cisco",
  "price": 1499.99,
  "availability": "Stock",
  "availability_weight": 100,
  "image": "images/cisco/catalyst-2960.jpg",
  "ShortDescription": "Managed Layer 2 switch",
  "custom_memo": ["Feature 1", "Feature 2", "Feature 3"],
  "custom_text": ["SFP Module", "Power Cable", "Rack Kit"],
  "tags": ["cisco", "switch", "network", "managed", "2960"],
  "_ai_confidence": 95.5,
  "_ai_processed": true
}
```

## Validation Rules

### Required Fields
- `objectID` (must be unique)
- `name`
- `brand`

### Optional but Recommended
- `price`
- `image`
- `ShortDescription`
- `availability`

### Auto-Generated
- `availability_weight` (from `Availability`)
- `LastModified` (current timestamp if missing)
- `_ai_processed` (from `AIProcessed`)

## Special Handling

### Empty/Null Values
```javascript
// Strings: convert null to empty string
field: product.Field || ''

// Numbers: convert null to 0
price: parseFloat(product.Price) || 0

// Arrays: convert null to empty array
tags: product.Tags ? product.Tags.split(',') : []

// Booleans: convert null to false
Discontinued: product.Discontinued === 1
```

### URL Normalization
```javascript
// Convert backslashes to forward slashes (Windows paths)
image: product.ImageFile.replace(/\\/g, '/')

// DO NOT encode spaces (keep "Product Image.jpg" as is)
// DO NOT add domain (relative paths preferred)
```

### Text Truncation
```javascript
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
```

## Performance Notes

- **Batch Size:** 100 records per sync batch (optimal)
- **Deduplication:** Applied to arrays before sync
- **Encoding:** UTF-8 for all text fields
- **Compression:** Algolia handles compression automatically
- **Indexing:** Async, typically completes in 1-5 seconds per batch

---

**Last Updated:** 2024  
**Version:** 1.0.0
