// API endpoint for product enrichment
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

try { dotenv.config(); } catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for rules-engine modules
async function loadEnrichmentService() {
  const rulesEnginePath = path.join(__dirname, '../../rules-engine/src');
  
  // Import required services
  const { default: dbService } = await import(path.join(rulesEnginePath, 'dbService.js'));
  const { default: productEnrichment } = await import(path.join(rulesEnginePath, 'productEnrichment.js'));
  const { default: logger } = await import(path.join(rulesEnginePath, 'logger.js'));
  
  return { dbService, productEnrichment, logger };
}

/**
 * POST /api/rules-engine/enrich
 * Enrich product data using AI
 * 
 * Body:
 * {
 *   "productId": "12345",           // Product ID or Part Number
 *   "partNumber": "WS-C2960-24TT-L" // Alternative to productId
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { productId, partNumber } = req.body;

    if (!productId && !partNumber) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameter: productId or partNumber'
      });
    }

    // Load enrichment services
    const { dbService, productEnrichment, logger } = await loadEnrichmentService();

    // Connect to database
    await dbService.connect();

    try {
      // Fetch product from database
      const productQuery = productId
        ? `SELECT * FROM Products WHERE ID = @id`
        : `SELECT * FROM Products WHERE ManufacturerPartNumber = @partNumber OR InternalPartNumber = @partNumber`;

      const params = productId ? { id: productId } : { partNumber };
      const result = await dbService.query(productQuery, params);

      if (!result.recordset || result.recordset.length === 0) {
        return res.status(404).json({
          ok: false,
          error: 'Product not found'
        });
      }

      const product = result.recordset[0];

      // Check if already enriched
      const checkQuery = `SELECT * FROM Product_Enrichment WHERE ProductID = @productId`;
      const enrichmentCheck = await dbService.query(checkQuery, { productId: product.ID });

      if (enrichmentCheck.recordset && enrichmentCheck.recordset.length > 0) {
        const existing = enrichmentCheck.recordset[0];
        if (existing.AIProcessed && existing.AIConfidence >= 90) {
          return res.status(200).json({
            ok: true,
            message: 'Product already enriched',
            enriched: true,
            data: existing,
            cached: true
          });
        }
      }

      // Enrich the product
      logger.info(`Enriching product: ${product.ProductName}`);
      const enrichedData = await productEnrichment.enrichProduct({
        ID: product.ID,
        name: product.ProductName,
        ProductName: product.ProductName,
        partNumber: product.ManufacturerPartNumber,
        PartNumber: product.ManufacturerPartNumber,
        manufacturer: product.Manufacturer,
        Manufacturer: product.Manufacturer,
        category: product.Category,
        Category: product.Category,
        description: product.ShortDescription,
        ShortDescription: product.ShortDescription,
        price: product.UnitPrice
      });

      // Save enriched data to database
      const insertQuery = `
        MERGE INTO Product_Enrichment AS target
        USING (SELECT @productID AS ProductID) AS source
        ON target.ProductID = source.ProductID
        WHEN MATCHED THEN
          UPDATE SET
            PartNumber = @partNumber,
            AIShortDescription = @aiShortDescription,
            AILongDescription = @aiLongDescription,
            AISpecsTable = @aiSpecsTable,
            AIFeatures = @aiFeatures,
            AIPrerequisites = @aiPrerequisites,
            AIServicesScope = @aiServicesScope,
            AIFAQ = @aiFAQ,
            AIUpsells = @aiUpsells,
            AIBundles = @aiBundles,
            AIValueStatement = @aiValueStatement,
            AIProductRules = @aiProductRules,
            AICategoryRules = @aiCategoryRules,
            AIImageURL = @aiImageURL,
            AIImageSource = @aiImageSource,
            AIProcessed = @aiProcessed,
            AIProcessedDate = GETDATE(),
            AIConfidence = @aiConfidence,
            AIProvider = @aiProvider,
            AIModel = @aiModel,
            RequiresReview = @requiresReview,
            ApprovalStatus = @approvalStatus,
            ModifiedDate = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (ProductID, PartNumber, AIShortDescription, AILongDescription, AISpecsTable, AIFeatures,
                  AIPrerequisites, AIServicesScope, AIFAQ, AIUpsells, AIBundles, AIValueStatement,
                  AIProductRules, AICategoryRules, AIImageURL, AIImageSource, AIProcessed, AIProcessedDate,
                  AIConfidence, AIProvider, AIModel, RequiresReview, ApprovalStatus)
          VALUES (@productID, @partNumber, @aiShortDescription, @aiLongDescription, @aiSpecsTable, @aiFeatures,
                  @aiPrerequisites, @aiServicesScope, @aiFAQ, @aiUpsells, @aiBundles, @aiValueStatement,
                  @aiProductRules, @aiCategoryRules, @aiImageURL, @aiImageSource, @aiProcessed, GETDATE(),
                  @aiConfidence, @aiProvider, @aiModel, @requiresReview, @approvalStatus);
      `;

      await dbService.query(insertQuery, {
        productID: enrichedData.productID,
        partNumber: enrichedData.partNumber,
        aiShortDescription: enrichedData.aiShortDescription,
        aiLongDescription: enrichedData.aiLongDescription,
        aiSpecsTable: enrichedData.aiSpecsTable,
        aiFeatures: enrichedData.aiFeatures,
        aiPrerequisites: enrichedData.aiPrerequisites,
        aiServicesScope: enrichedData.aiServicesScope,
        aiFAQ: enrichedData.aiFAQ,
        aiUpsells: enrichedData.aiUpsells,
        aiBundles: enrichedData.aiBundles,
        aiValueStatement: enrichedData.aiValueStatement,
        aiProductRules: enrichedData.aiProductRules,
        aiCategoryRules: enrichedData.aiCategoryRules,
        aiImageURL: enrichedData.aiImageURL,
        aiImageSource: enrichedData.aiImageSource,
        aiProcessed: enrichedData.aiProcessed,
        aiConfidence: enrichedData.aiConfidence,
        aiProvider: enrichedData.aiProvider,
        aiModel: enrichedData.aiModel,
        requiresReview: enrichedData.requiresReview,
        approvalStatus: enrichedData.approvalStatus
      });

      // Log the enrichment
      await dbService.logAIProcess({
        inputText: JSON.stringify({ productId: product.ID, productName: product.ProductName }),
        outputText: JSON.stringify(enrichedData),
        aiProvider: enrichedData.aiProvider,
        model: enrichedData.aiModel,
        processingTimeMs: enrichedData.processingTimeMs,
        status: 'Success',
        metadata: JSON.stringify({
          confidence: enrichedData.aiConfidence,
          requiresReview: enrichedData.requiresReview
        })
      });

      logger.success(`Product enriched successfully: ${product.ProductName}`);

      return res.status(200).json({
        ok: true,
        message: 'Product enriched successfully',
        enriched: true,
        data: {
          productId: enrichedData.productID,
          partNumber: enrichedData.partNumber,
          confidence: enrichedData.aiConfidence,
          aiProcessed: enrichedData.aiProcessed,
          requiresReview: enrichedData.requiresReview,
          approvalStatus: enrichedData.approvalStatus,
          processingTimeMs: enrichedData.processingTimeMs
        },
        cached: false
      });

    } finally {
      await dbService.disconnect();
    }

  } catch (error) {
    console.error('Enrichment API error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      message: error.message
    });
  }
}
