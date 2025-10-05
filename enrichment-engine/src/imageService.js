// imageService.js - Image fetching and processing with Google Custom Search API
import dotenv from 'dotenv';
import axios from 'axios';
import logger from './logger.js';

// Load environment variables from root .env
dotenv.config({ path: '../.env' });

class ImageService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleCxId = process.env.GOOGLE_CX_ID;
    
    if (!this.googleApiKey || !this.googleCxId) {
      logger.warn('Google Custom Search API not configured - image fetching disabled');
    } else {
      logger.info('Google Custom Search API configured');
    }
  }

  /**
   * Fetch product image using Google Custom Search API
   * @param {Object} product - Product object
   * @returns {Promise<Object>} Image data with URL and confidence
   */
  async fetchProductImage(product) {
    if (!this.googleApiKey || !this.googleCxId) {
      logger.debug('Image fetching skipped - API not configured');
      return this.getFallbackImage(product);
    }

    try {
      // Build search query
      const searchQuery = this.buildImageSearchQuery(product);
      
      logger.debug(`Searching for image: ${searchQuery}`);
      
      // Call Google Custom Search API
      const images = await this.searchImages(searchQuery);
      
      if (!images || images.length === 0) {
        logger.warn(`No images found for ${product.ManufacturerPartNo}`);
        return this.getFallbackImage(product);
      }

      // Find image with white background (confidence >= 78%)
      const whiteBackgroundImage = await this.findWhiteBackgroundImage(images);
      
      if (whiteBackgroundImage) {
        logger.success(`Found white background image for ${product.ManufacturerPartNo}`);
        return {
          url: whiteBackgroundImage.url,
          confidence: whiteBackgroundImage.confidence,
          source: 'google',
          hasWhiteBackground: true
        };
      }

      // Return first image if no white background found
      logger.info(`Using first available image for ${product.ManufacturerPartNo}`);
      return {
        url: images[0].link,
        confidence: 60,
        source: 'google',
        hasWhiteBackground: false
      };
    } catch (error) {
      logger.error(`Failed to fetch image for ${product.ManufacturerPartNo}`, error);
      return this.getFallbackImage(product);
    }
  }

  /**
   * Build image search query
   * @param {Object} product - Product object
   * @returns {string} Search query
   */
  buildImageSearchQuery(product) {
    const parts = [
      product.Manufacturer || '',
      product.ManufacturerPartNo || '',
      product.Description || ''
    ].filter(p => p).join(' ');
    
    return `${parts} product image white background`;
  }

  /**
   * Search for images using Google Custom Search API
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of image results
   */
  async searchImages(query) {
    try {
      const url = 'https://www.googleapis.com/customsearch/v1';
      const params = {
        key: this.googleApiKey,
        cx: this.googleCxId,
        q: query,
        searchType: 'image',
        num: 10,
        imgSize: 'medium',
        imgType: 'photo',
        safe: 'active'
      };

      const response = await axios.get(url, { params });
      
      if (!response.data.items) {
        return [];
      }

      return response.data.items;
    } catch (error) {
      logger.error('Google Image Search API error', error);
      throw error;
    }
  }

  /**
   * Find image with white background
   * @param {Array} images - Array of image results
   * @returns {Promise<Object|null>} Image with white background or null
   */
  async findWhiteBackgroundImage(images) {
    for (const image of images) {
      try {
        const confidence = await this.analyzeImageBackground(image.link);
        
        if (confidence >= 78) {
          return {
            url: image.link,
            confidence: confidence
          };
        }
      } catch (error) {
        logger.debug(`Failed to analyze image: ${image.link}`);
        continue;
      }
    }
    
    return null;
  }

  /**
   * Analyze image background to detect white background
   * This is a simplified version - in production, you might use image analysis services
   * @param {string} imageUrl - Image URL
   * @returns {Promise<number>} Confidence score (0-100)
   */
  async analyzeImageBackground(imageUrl) {
    // Note: This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Download the image
    // 2. Use sharp or similar library to analyze pixels
    // 3. Calculate percentage of white/light pixels in background
    // 4. Return confidence score
    
    // For now, we'll use heuristics based on URL patterns
    const url = imageUrl.toLowerCase();
    
    // Higher confidence for known product image sites
    if (url.includes('amazon') || url.includes('newegg') || 
        url.includes('cdw') || url.includes('bhphoto')) {
      return 85;
    }
    
    // Medium confidence for manufacturer sites
    if (url.includes('cisco') || url.includes('dell') || 
        url.includes('hp') || url.includes('lenovo')) {
      return 80;
    }
    
    // Lower confidence for unknown sources
    return 70;
  }

  /**
   * Get fallback image based on manufacturer
   * @param {Object} product - Product object
   * @returns {Object} Fallback image data
   */
  getFallbackImage(product) {
    const manufacturer = (product.Manufacturer || 'unknown').toLowerCase();
    
    // Use manufacturer logo as fallback
    const fallbackUrl = `/images/manufacturers/${manufacturer}.jpg`;
    
    return {
      url: fallbackUrl,
      confidence: 50,
      source: 'fallback',
      hasWhiteBackground: false,
      manufacturer: manufacturer
    };
  }

  /**
   * Batch fetch images for multiple products
   * @param {Array} products - Array of products
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} Array of image results
   */
  async batchFetchImages(products, onProgress) {
    const results = [];
    let processed = 0;
    
    for (const product of products) {
      try {
        // Skip if image already exists
        if (product.ImageFile || product.CustomText05) {
          logger.debug(`Skipping ${product.ManufacturerPartNo} - image already exists`);
          results.push({
            product,
            skipped: true,
            reason: 'Image already exists'
          });
        } else {
          const imageData = await this.fetchProductImage(product);
          results.push({
            product,
            imageData,
            success: true
          });
          
          // Rate limiting - Google Custom Search has daily limits
          await this.delay(500);
        }
      } catch (error) {
        results.push({
          product,
          error: error.message,
          success: false
        });
      }
      
      processed++;
      if (onProgress) {
        onProgress(processed, products.length);
      }
    }
    
    return results;
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default new ImageService();
