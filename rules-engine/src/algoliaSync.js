// algoliaSync.js - Sync enriched product data to Algolia
// NOTE: To force awaiting the enrichment pipeline (so features/specs/value_statement/use_cases
// are guaranteed present before indexing), set environment variable ENRICHMENT_AWAIT=1
// before running a full sync. Otherwise enrichment may be opportunistic / partial.
import algoliasearch from 'algoliasearch';
import dotenv from 'dotenv';
import logger from './logger.js';
import dbService from './dbService.js';
import { promises as fs } from 'fs';
import path from 'path';
import enrichmentPipeline from './enrichmentPipeline.js';

// Load environment variables
dotenv.config({ path: '../.env' });

class AlgoliaSyncService {
  constructor() {
    this.algoliaAppId = process.env.ALGOLIA_APP_ID;
    this.algoliaApiKey = process.env.ALGOLIA_ADMIN_API_KEY;
    this.indexName = process.env.ALGOLIA_INDEX_NAME || 'quickitquote_products';
    this.client = null;
    this.index = null;
    this.maxRecordSize = 10000; // 10KB max
    this.maxArrayItems = 20;
  }

  /**
   * Initialize Algolia client
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.algoliaAppId || !this.algoliaApiKey) {
      throw new Error('Algolia credentials not configured. Set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY in .env');
    }

    try {
      this.client = algoliasearch(this.algoliaAppId, this.algoliaApiKey);
      this.index = this.client.initIndex(this.indexName);
      logger.success(`Algolia client initialized for index: ${this.indexName}`);
    } catch (error) {
      logger.error('Failed to initialize Algolia client', error);
      throw error;
    }
  }

  /**
   * Sync enriched products to Algolia
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync results
   */
  async syncProducts(options = {}) {
    const {
      fullSync = false,
      batchSize = 1000,
      lastSyncTime = null,
      purgeMissing = false
    } = options;

    try {
      await this.initialize();

      // Get products to sync
      let effectiveLastSync = lastSyncTime;
      const stateFile = path.join(process.cwd(), 'rules-engine', '.algolia-sync-state.json');
      if (!fullSync && !effectiveLastSync){
        try {
          const raw = await fs.readFile(stateFile,'utf8');
          const st = JSON.parse(raw);
          if (st && st.lastSyncTime) effectiveLastSync = st.lastSyncTime;
        } catch {}
      }

      const products = await this.getProductsForSync(fullSync, effectiveLastSync);
      
      if (products.length === 0) {
        logger.info('No products to sync');
        return {
          success: true,
          synced: 0,
          failed: 0,
          skipped: 0
        };
      }

      logger.info(`Syncing ${products.length} products to Algolia...`);

    // Transform products to Algolia format (async for enrichment ordering)
    const transformed = await Promise.all(products.map(p => this.transformToAlgolia(p)));
    const algoliaRecords = transformed.filter(r => r !== null);

      // Batch upload to Algolia
      const results = await this.batchUpload(algoliaRecords, batchSize);

      // Purge missing objects (mirror) if requested or for full sync + flag
      if ((purgeMissing || fullSync) && algoliaRecords.length > 0){
        try {
          const dbIds = new Set(algoliaRecords.map(r=>r.objectID));
          const indexIds = await this.collectAllObjectIDs();
            const toDelete = indexIds.filter(id => !dbIds.has(id));
          if (toDelete.length){
            logger.warn(`Purging ${toDelete.length} objects no longer in DB (mirror mode)`);
            // Chunk deletes to avoid large payloads
            const chunkSize = 800;
            for (let i=0;i<toDelete.length;i+=chunkSize){
              const chunk = toDelete.slice(i,i+chunkSize);
              await this.index.deleteObjects(chunk);
            }
          } else {
            logger.info('Mirror purge: no stale objects found');
          }
        } catch(e){ logger.error('Mirror purge failed', e); }
      }

      // Persist last sync time
      try {
        const nowIso = new Date().toISOString();
        await fs.writeFile(stateFile, JSON.stringify({ lastSyncTime: nowIso }, null, 2));
        logger.info(`Saved sync state (${nowIso})`);
      } catch(e){ logger.warn('Failed to write sync state file', e); }

      logger.success(`Sync complete: ${results.synced} synced, ${results.failed} failed`);

      return results;

    } catch (error) {
      logger.error('Algolia sync failed', error);
      throw error;
    }
  }

  async collectAllObjectIDs(){
    const ids = [];
    try {
      await this.index.browseObjects({ batch: batch => {
        for (const obj of batch){ if (obj && obj.objectID) ids.push(obj.objectID); }
      }});
    } catch(e){ logger.warn('Failed to browse objects for purge', e); }
    return ids;
  }

  /**
   * Get products from database for syncing
   * @param {boolean} fullSync - Whether to sync all products
   * @param {string} lastSyncTime - Last sync timestamp
   * @returns {Promise<Array>} Array of products
   */
  async getProductsForSync(fullSync, lastSyncTime) {
    try {
      let query;
      
      if (fullSync) {
        // Full sync: get all AI-processed products
        query = `
          SELECT * FROM dbo.Rules_Item
          WHERE AIProcessed = 1 AND IsActive = 1
          ORDER BY ModifiedDate DESC
        `;
      } else if (lastSyncTime) {
        // Incremental sync: get products modified since last sync
        query = `
          SELECT * FROM dbo.Rules_Item
          WHERE AIProcessed = 1 
            AND IsActive = 1
            AND (ModifiedDate > @lastSyncTime OR AIProcessedDate > @lastSyncTime)
          ORDER BY ModifiedDate DESC
        `;
      } else {
        // Default: get all AI-processed products from last 24 hours
        query = `
          SELECT * FROM dbo.Rules_Item
          WHERE AIProcessed = 1 
            AND IsActive = 1
            AND AIProcessedDate > DATEADD(hour, -24, GETDATE())
          ORDER BY ModifiedDate DESC
        `;
      }

      const result = await dbService.query(query, { lastSyncTime });
      return result.recordset || [];

    } catch (error) {
      logger.error('Failed to fetch products for sync', error);
      throw error;
    }
  }

  /**
   * Transform SQL product to Algolia record format
   * @param {Object} product - Product from SQL
   * @returns {Object|null} Algolia record or null if invalid
   */
  async transformToAlgolia(product) {
    try {
      // Build base record (raw fields first)
      const record = {
        // Core identifiers
        objectID: this.generateObjectID(product),
        sku: product.PartNumber || product.RuleID.toString(),
        mpn: product.PartNumber || '',
        name: product.ProductName || '',
        brand: product.Manufacturer || '',
        category: product.Category || '',
        subcategory: product.SubCategory || '',
        
        // Availability
        unit: 'EA', // Default unit
        availability: product.IsActive ? 'Stock' : 'on back order',
        availability_weight: product.IsActive ? 100 : 50,
        
        // Pricing
        price: product.MinPrice || 0,
        list_price: product.MaxPrice || 0,
        cost: 0, // Not available in Rules_Item
        
        // URLs (placeholders)
        image: this.normalizeUrl(product.ProductImage) || '',
        spec_sheet: '',
        link: '',
        
  // Descriptions (truncate after enrichment prep if needed)
  ShortDescription: product.ShortDescription || '',
  ExtendedDescription: product.LongDescription || '',
        
        // Metadata
        tags: this.parseKeywords(product.Keywords),
        Discontinued: !product.IsActive,
        LastModified: this.toISOString(product.ModifiedDate),
        
        // Enrichment data
        ai_processed: !!product.AIProcessed,
        ai_processed_date: this.toISOString(product.AIProcessedDate),
        auto_approve: !!product.AutoApprove,
        classification_type: product.Classification || 'Standard',
        classification_confidence: product.Confidence || 0,
        enrichment_confidence: product.EnrichmentConfidence || 0,
        lead_time_days: product.LeadTimeDays || 7,
        ai_version: product.AIVersion || null,
        lifecycle_stage: 'active',
        enrichment_version: null
      };

      // ------------------------------------------------------------------
      // Step 1: Attach structured enrichment fields from DB JSON columns
      // (do this BEFORE any derived calculations so they are included)
      // ------------------------------------------------------------------
      if (product.TechnicalSpecs) {
        record.specs = this.parseJSON(product.TechnicalSpecs) || undefined;
      }
      if (product.KeyFeatures) {
        record.features = this.limitArray(this.parseJSON(product.KeyFeatures), this.maxArrayItems);
      }
      if (product.FAQ) {
        record.faq = this.limitArray(this.parseJSON(product.FAQ), 10);
      }
      if (product.UpsellSuggestions) {
        record.upsells = this.limitArray(this.parseJSON(product.UpsellSuggestions), this.maxArrayItems);
      }
      if (product.BundleSuggestions) {
        record.bundles = this.limitArray(this.parseJSON(product.BundleSuggestions), this.maxArrayItems);
      }
      if (product.CustomerValue) {
        record.value_statement = product.CustomerValue;
      }

      // Merge Arabic and English synonyms for search early
      const englishSynonyms = this.parseJSON(product.CustomMemo07) || [];
      const arabicSynonyms = this.parseJSON(product.CustomMemo08) || [];
      if (englishSynonyms.length > 0 || arabicSynonyms.length > 0) {
        record.search_synonyms = [...englishSynonyms, ...arabicSynonyms];
      }

      // ------------------------------------------------------------------
      // Step 2: Optionally run enrichment pipeline (await if env flag set)
      // ------------------------------------------------------------------
      let enrichmentResult = null;
      const shouldAwait = process.env.ENRICHMENT_AWAIT === '1';
      try {
        if (enrichmentPipeline && shouldAwait) {
          enrichmentResult = await enrichmentPipeline.enrich({
            name: record.name,
            ProductName: record.name,
            manufacturer: record.brand,
            description: record.ExtendedDescription || record.ShortDescription || ''
          });
        }
      } catch (e) { logger.warn('Enrichment pipeline failed (non-fatal)', e); }

      if (enrichmentResult?.enriched) {
        record.enrichment_version = enrichmentPipeline.version || 1;
        // Merge features/specs
        if (enrichmentResult.features && Array.isArray(enrichmentResult.features)) {
          const existing = new Set(record.features || []);
            for (const f of enrichmentResult.features) { if (f && !existing.has(f)) existing.add(f); }
          record.features = Array.from(existing).slice(0, this.maxArrayItems);
        }
        if (enrichmentResult.specs && typeof enrichmentResult.specs === 'object') {
          record.specs = { ...(record.specs||{}), ...enrichmentResult.specs };
        }
        if (enrichmentResult.value_statement && !record.value_statement) {
          record.value_statement = enrichmentResult.value_statement;
        }
        if (enrichmentResult.short_benefit_bullets) {
          record.benefit_bullets = enrichmentResult.short_benefit_bullets;
        }
        if (enrichmentResult.use_cases) {
          record.use_cases = enrichmentResult.use_cases;
        }
        if (enrichmentResult.compliance_tags) {
          record.compliance_tags = enrichmentResult.compliance_tags;
        }
        if (typeof enrichmentResult.risk_score === 'number') {
          record.risk_score = enrichmentResult.risk_score;
        }
      }

      // ------------------------------------------------------------------
      // Step 3: Apply truncation AFTER enrichment merge
      // ------------------------------------------------------------------
      if (record.ExtendedDescription && record.ExtendedDescription.length > 1500) {
        record.ExtendedDescription = record.ExtendedDescription.slice(0,1497) + '...';
      }
      if (record.ShortDescription && record.ShortDescription.length > 300) {
        record.ShortDescription = record.ShortDescription.slice(0,297) + '...';
      }

      // ------------------------------------------------------------------
      // Step 4: Derived fields (price range, search blob, marketing, specs)
      // ------------------------------------------------------------------
      // Derive price range bucket for faceting
      const priceVal = record.price || 0;
      let priceRange = '0-99';
      if (priceVal >= 100 && priceVal < 500) priceRange = '100-499';
      else if (priceVal >= 500 && priceVal < 1000) priceRange = '500-999';
      else if (priceVal >= 1000 && priceVal < 2500) priceRange = '1000-2499';
      else if (priceVal >= 2500 && priceVal < 5000) priceRange = '2500-4999';
      else if (priceVal >= 5000 && priceVal < 10000) priceRange = '5000-9999';
      else if (priceVal >= 10000 && priceVal < 25000) priceRange = '10000-24999';
      else if (priceVal >= 25000 && priceVal < 50000) priceRange = '25000-49999';
      else if (priceVal >= 50000) priceRange = '50000+';
      record.price_range = priceRange;

      // Composite searchable field for boosting (include value_statement & use_cases)
      record.search_blob = [
        record.name,
        record.brand,
        record.category,
        record.subcategory,
        (record.tags||[]).join(' '),
        (record.features||[]).join(' '),
        record.value_statement,
        (record.use_cases||[]).join(' ')
      ].filter(Boolean).join(' | ');

      // Normalized specs (simple flatten / rename)
      if (record.specs) {
        const ns = {};
        try {
          for (const [k,v] of Object.entries(record.specs)){
            const key = k.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
            if (!key) continue;
            ns[key] = v;
          }
          record.normalized_specs = ns;
        } catch {}
      }

      // Marketing blurb combining short + value statement (post enrichment)
      if (!record.marketing_blurb){
        const vs = record.value_statement || '';
        const sd = record.ShortDescription || '';
        const combined = (vs && sd) ? `${sd} — ${vs}` : (sd || vs);
        if (combined) record.marketing_blurb = combined.slice(0, 400);
      }

      // Data quality score heuristic (recalculated after enrichment)
      const qParts = [];
      const addQ = (cond, weight) => { if (cond) qParts.push(weight); };
      addQ(!!record.ShortDescription, 10);
      addQ(!!record.ExtendedDescription, 10);
      addQ(Array.isArray(record.features) && record.features.length>0, 10);
      addQ(record.specs && Object.keys(record.specs).length>0, 15);
      addQ(Array.isArray(record.faq) && record.faq.length>=2, 5);
      addQ(Array.isArray(record.use_cases) && record.use_cases.length>0, 10);
      addQ(!!record.value_statement, 10);
      addQ(Array.isArray(record.search_synonyms) && record.search_synonyms.length>0, 10);
      addQ(Array.isArray(record.compliance_tags) && record.compliance_tags.length>0, 10);
      addQ(typeof record.warranty_months === 'number', 10);
      const rawScore = qParts.reduce((a,b)=>a+b,0);
      record.data_quality_score = rawScore;
      record.data_quality_bucket = rawScore >=70 ? 'high' : rawScore >=40 ? 'medium' : 'low';

      // Risk bucket derived from risk_score or heuristic fallback
      if (typeof record.risk_score === 'number') {
        record.risk_bucket = record.risk_score >=60 ? 'elevated' : record.risk_score >=40 ? 'moderate' : 'low';
      } else {
        // Lightweight heuristic if enrichment not awaited
        const lname = record.name.toLowerCase();
        const heuristicRisk = /server|storage/.test(lname) ? 65 : /switch|router/.test(lname) ? 40 : 20;
        record.risk_score = heuristicRisk;
        record.risk_bucket = heuristicRisk >=60 ? 'elevated' : heuristicRisk >=40 ? 'moderate' : 'low';
      }

      // Boost terms (subset of tags + key features) after enrichment
      const boost = [];
      (record.tags||[]).slice(0,5).forEach(t=>boost.push(t));
      (record.features||[]).slice(0,5).forEach(f=>{
        const tok = (f||'').split(/\s+/)[0];
        if (tok && !boost.includes(tok)) boost.push(tok);
      });
      if (boost.length) record.boost_terms = boost;

      // Apply size guard
      const recordSize = JSON.stringify(record).length;
      if (recordSize > this.maxRecordSize) {
        logger.warn(`Record too large (${recordSize} bytes): ${record.name}. Truncating...`);
        return this.truncateRecord(record);
      }

      return record;

    } catch (error) {
      logger.error(`Failed to transform product ${product.ProductName}`, error);
      return null;
    }
  }

  /**
   * Generate stable objectID for product
   * @param {Object} product - Product object
   * @returns {string} Object ID
   */
  generateObjectID(product) {
    // Prefer PartNumber, fall back to RuleID
    if (product.PartNumber && product.PartNumber.trim()) {
      return product.PartNumber.trim();
    }
    return `RULE_${product.RuleID}`;
  }

  /**
   * Normalize file URL
   * @param {string} url - URL string
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    // Replace backslashes with forward slashes, don't encode spaces
    return url.replace(/\\/g, '/');
  }

  /**
   * Parse comma-separated keywords to array
   * @param {string} keywords - Comma-separated keywords
   * @returns {Array} Array of keywords
   */
  parseKeywords(keywords) {
    if (!keywords) return [];
    return keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 50); // Max 50 tags
  }

  /**
   * Parse JSON string safely
   * @param {string} jsonString - JSON string
   * @returns {any} Parsed object or default
   */
  parseJSON(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('Failed to parse JSON field', error);
      return null;
    }
  }

  /**
   * Truncate string to max length
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated string
   */
  truncateString(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Limit array to max items
   * @param {Array} arr - Array to limit
   * @param {number} maxItems - Maximum items
   * @returns {Array} Limited array
   */
  limitArray(arr, maxItems) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, maxItems);
  }

  /**
   * Convert date to ISO string
   * @param {Date|string} date - Date object or string
   * @returns {string} ISO date string
   */
  toISOString(date) {
    if (!date) return '';
    try {
      return new Date(date).toISOString();
    } catch (error) {
      return '';
    }
  }

  /**
   * Truncate record to fit size limit
   * @param {Object} record - Algolia record
   * @returns {Object} Truncated record
   */
  truncateRecord(record) {
    // Progressively truncate fields
    if (record.ExtendedDescription) {
      record.ExtendedDescription = this.truncateString(record.ExtendedDescription, 2000);
    }
    if (record.ShortDescription) {
      record.ShortDescription = this.truncateString(record.ShortDescription, 300);
    }
    if (record.features) {
      record.features = this.limitArray(record.features, 10);
    }
    if (record.faq) {
      record.faq = this.limitArray(record.faq, 5);
    }
    
    // If still too large, remove optional fields
    const size = JSON.stringify(record).length;
    if (size > this.maxRecordSize) {
      delete record.faq;
      delete record.specs;
    }

    return record;
  }

  /**
   * Batch upload records to Algolia
   * @param {Array} records - Array of Algolia records
   * @param {number} batchSize - Batch size
   * @returns {Promise<Object>} Upload results
   */
  async batchUpload(records, batchSize) {
    const results = {
      synced: 0,
      failed: 0,
      errors: []
    };

    // Split into batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        await this.index.saveObjects(batch);
        results.synced += batch.length;
        logger.info(`Uploaded batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message
        });
        logger.error(`Failed to upload batch ${Math.floor(i / batchSize) + 1}`, error);
        
        // If >10% failures, abort
        if (results.failed / records.length > 0.1) {
          throw new Error('Too many failures, aborting sync');
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Apply Algolia index settings
   * @returns {Promise<void>}
   */
  async applyIndexSettings() {
    const settings = {
      searchableAttributes: [
        'sku',
        'mpn',
        'name',
        'brand',
        'category',
        'subcategory',
        'search_synonyms',
        'tags',
        'ShortDescription',
        'ExtendedDescription',
        'features',
        'marketing_blurb',
        'use_cases',
        'boost_terms',
        'search_blob'
      ],
      attributesForFaceting: [
        'brand',
        'category',
        'subcategory',
        'unit',
        'availability',
        'auto_approve',
        'classification_type',
        'Discontinued',
        'tags',
        'price_range',
        'ai_version',
        'data_quality_bucket',
        'risk_bucket',
        'lifecycle_stage',
        'enrichment_version'
      ],
      customRanking: [
        'desc(availability_weight)',
        'desc(enrichment_confidence)',
        'asc(price)',
        'desc(classification_confidence)',
        'desc(lead_time_days)',
        'asc(name)'
      ],
      attributesToSnippet: [
        'ExtendedDescription:40',
        'ShortDescription:20'
      ],
      attributesToHighlight: [
        'sku',
        'mpn',
        'name',
        'tags',
        'features'
      ],
      removeWordsIfNoResults: 'allOptional',
      ignorePlurals: true,
      typoTolerance: 'min',
      decompoundQuery: true
    };

    try {
      await this.index.setSettings(settings);
      logger.success('Algolia index settings applied successfully');
    } catch (error) {
      logger.error('Failed to apply Algolia index settings', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new AlgoliaSyncService();

// CLI interface for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new AlgoliaSyncService();
  
  const args = process.argv.slice(2);
  const fullSync = args.includes('--full');
  const applySettings = args.includes('--apply-settings');

  (async () => {
    try {
      logger.banner('Algolia Sync Service');
      
      if (applySettings) {
        logger.info('Applying index settings...');
        await service.initialize();
        await service.applyIndexSettings();
      } else {
        logger.info(`Starting ${fullSync ? 'full' : 'incremental'} sync...`);
        const results = await service.syncProducts({ fullSync });
        logger.success(`Sync complete: ${results.synced} products synced`);
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Sync failed', error);
      process.exit(1);
    }
  })();
}
