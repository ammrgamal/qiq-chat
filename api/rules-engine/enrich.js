// api/rules-engine/enrich.js - API endpoint for product enrichment
import { processInput } from '../../rules-engine/src/rulesEngine.js';
import enrichmentService from '../../rules-engine/src/enrichmentService.js';
import dbService from '../../rules-engine/src/dbService.js';
import algoliaSync from '../../rules-engine/src/algoliaSync.js';

/**
 * API Handler for product enrichment
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { product, partNumber, syncToAlgolia = false } = req.body;

    // Validate input
    if (!product && !partNumber) {
      return res.status(400).json({
        ok: false,
        error: 'Product object or partNumber is required'
      });
    }

    // If partNumber provided, fetch from database
    let productData = product;
    if (partNumber && !product) {
      try {
        await dbService.connect();
        const result = await dbService.query(
          'SELECT * FROM dbo.Rules_Item WHERE PartNumber = @partNumber',
          { partNumber }
        );
        
        if (!result.recordset || result.recordset.length === 0) {
          return res.status(404).json({
            ok: false,
            error: 'Product not found'
          });
        }
        
        productData = result.recordset[0];
      } catch (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to fetch product from database'
        });
      }
    }

    // Check if already processed
    if (productData.AIProcessed === true || productData.AIProcessed === 1) {
      // Return existing enriched data
      return res.status(200).json({
        ok: true,
        alreadyProcessed: true,
        product: {
          partNumber: productData.PartNumber,
          name: productData.ProductName,
          shortDescription: productData.ShortDescription,
          longDescription: productData.LongDescription,
          image: productData.ProductImage,
          confidence: productData.EnrichmentConfidence,
          processedDate: productData.AIProcessedDate
        }
      });
    }

    // Check if product needs enrichment
    if (!enrichmentService.needsEnrichment(productData)) {
      return res.status(200).json({
        ok: true,
        enrichmentNeeded: false,
        product: {
          partNumber: productData.PartNumber || productData.partNumber,
          name: productData.ProductName || productData.name
        }
      });
    }

    // Enrich the product
    const enrichmentResult = await enrichmentService.enrichProduct(productData);

    if (!enrichmentResult.success) {
      return res.status(500).json({
        ok: false,
        error: enrichmentResult.error || 'Enrichment failed'
      });
    }

    // Save to database
    try {
      await dbService.connect();
      
      // Update or insert product rule
      const updateQuery = `
        UPDATE dbo.Rules_Item
        SET 
          ShortDescription = @shortDescription,
          LongDescription = @longDescription,
          TechnicalSpecs = @technicalSpecs,
          KeyFeatures = @keyFeatures,
          FAQ = @faq,
          Prerequisites = @prerequisites,
          ProfessionalServices = @professionalServices,
          ProductImage = @productImage,
          UpsellSuggestions = @upsellSuggestions,
          BundleSuggestions = @bundleSuggestions,
          CustomerValue = @customerValue,
          EnrichmentConfidence = @enrichmentConfidence,
          AIProcessed = @aiProcessed,
          AIProcessedDate = GETDATE(),
          ModifiedDate = GETDATE()
        WHERE PartNumber = @partNumber
      `;

      await dbService.query(updateQuery, {
        partNumber: productData.PartNumber || productData.partNumber,
        shortDescription: enrichmentResult.enrichedData.ShortDescription,
        longDescription: enrichmentResult.enrichedData.LongDescription,
        technicalSpecs: enrichmentResult.enrichedData.TechnicalSpecs,
        keyFeatures: enrichmentResult.enrichedData.KeyFeatures,
        faq: enrichmentResult.enrichedData.FAQ,
        prerequisites: enrichmentResult.enrichedData.Prerequisites,
        professionalServices: enrichmentResult.enrichedData.ProfessionalServices,
        productImage: enrichmentResult.enrichedData.ProductImage,
        upsellSuggestions: enrichmentResult.enrichedData.UpsellSuggestions,
        bundleSuggestions: enrichmentResult.enrichedData.BundleSuggestions,
        customerValue: enrichmentResult.enrichedData.CustomerValue,
        enrichmentConfidence: enrichmentResult.enrichedData.EnrichmentConfidence,
        aiProcessed: enrichmentResult.enrichedData.AIProcessed
      });

      // Log enrichment to AI_Log
      await dbService.logAIProcess({
        inputText: JSON.stringify(productData),
        outputText: JSON.stringify(enrichmentResult.enrichedData),
        aiProvider: 'enrichment',
        status: 'Success',
        processingTimeMs: enrichmentResult.processingTimeMs
      });

    } catch (dbError) {
      console.error('Database update failed:', dbError);
      // Continue even if DB update fails - return enriched data
    }

    // Optionally sync to Algolia
    if (syncToAlgolia) {
      try {
        await algoliaSync.syncProducts({ 
          fullSync: false,
          lastSyncTime: new Date(Date.now() - 60000).toISOString() // Last minute
        });
      } catch (syncError) {
        console.error('Algolia sync failed:', syncError);
        // Don't fail the request if sync fails
      }
    }

    // Return enriched product data
    return res.status(200).json({
      ok: true,
      enriched: true,
      requiresReview: enrichmentResult.requiresReview,
      confidence: enrichmentResult.confidence,
      product: {
        partNumber: productData.PartNumber || productData.partNumber,
        name: productData.ProductName || productData.name,
        shortDescription: enrichmentResult.enrichedData.ShortDescription,
        longDescription: enrichmentResult.enrichedData.LongDescription,
        image: enrichmentResult.enrichedData.ProductImage,
        technicalSpecs: enrichmentResult.enrichedData.TechnicalSpecs ? 
          JSON.parse(enrichmentResult.enrichedData.TechnicalSpecs) : null,
        keyFeatures: enrichmentResult.enrichedData.KeyFeatures ? 
          JSON.parse(enrichmentResult.enrichedData.KeyFeatures) : null,
        customerValue: enrichmentResult.enrichedData.CustomerValue
      },
      processingTimeMs: enrichmentResult.processingTimeMs,
      fieldsEnriched: enrichmentResult.fieldsEnriched
    });

  } catch (error) {
    console.error('Enrichment API error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
}
