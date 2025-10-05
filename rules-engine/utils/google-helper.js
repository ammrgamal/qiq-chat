// google-helper.js - Google Custom Search helper for product images
import dotenv from 'dotenv';

// Load environment variables from root .env
dotenv.config({ path: '../../.env' });

/**
 * Google Helper class for image search and white background detection
 */
class GoogleHelper {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleCxId = process.env.GOOGLE_CX_ID;
    this.retryLimit = 2;
    
    if (!this.googleApiKey || !this.googleCxId) {
      console.warn('⚠ Warning: Google Custom Search not configured. Image search will be skipped.');
    }
  }

  /**
   * Check if Google Custom Search is configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return !!(this.googleApiKey && this.googleCxId);
  }

  /**
   * Search for product images using Google Custom Search
   * @param {Object} product - Product object
   * @param {number} numResults - Number of results to fetch (default: 8)
   * @returns {Promise<Array>} Array of image results
   */
  async searchImages(product, numResults = 8) {
    if (!this.isConfigured()) {
      console.log(`⊘ Skipping image search for ${product.ProductName} - Google API not configured`);
      return [];
    }

    try {
      const searchQuery = `${product.Manufacturer} ${product.ProductName} ${product.MPN || ''}`.trim();
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCxId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=${numResults}&imgType=photo`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log(`⊘ No images found for ${product.ProductName}`);
        return [];
      }

      return data.items.map(item => ({
        url: item.link,
        thumbnail: item.image?.thumbnailLink,
        width: item.image?.width,
        height: item.image?.height,
        contextLink: item.image?.contextLink,
        title: item.title
      }));
    } catch (error) {
      console.error(`✗ Failed to search images for ${product.ProductName}:`, error.message);
      return [];
    }
  }

  /**
   * Analyze image for white background percentage
   * @param {string} imageUrl - Image URL
   * @returns {Promise<number>} White background percentage (0-100)
   */
  async analyzeWhiteBackground(imageUrl) {
    try {
      // Fetch image data
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      
      // Simple heuristic: check if image is likely to have white background
      // In a production system, you would use an image processing library
      // For now, we'll use file size and dimensions as a proxy
      const size = buffer.byteLength;
      
      // Smaller file sizes with image metadata often indicate cleaner backgrounds
      // This is a simplified approach - in production, use sharp or jimp to analyze pixels
      if (size < 100000) { // Less than 100KB
        return 85; // Likely clean/white background
      } else if (size < 300000) { // Less than 300KB
        return 70;
      } else {
        return 60;
      }
    } catch (error) {
      console.error(`✗ Failed to analyze image ${imageUrl}:`, error.message);
      return 0;
    }
  }

  /**
   * Find best image with white background
   * @param {Array} images - Array of image objects
   * @param {number} threshold - Minimum white background percentage (default: 78)
   * @returns {Promise<Object|null>} Best image or null
   */
  async findBestImage(images, threshold = 78) {
    if (!images || images.length === 0) {
      return null;
    }

    // Analyze all images for white background
    const analyzedImages = [];
    for (const image of images) {
      const whitePercentage = await this.analyzeWhiteBackground(image.url);
      analyzedImages.push({
        ...image,
        whitePercentage
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Sort by white background percentage (descending)
    analyzedImages.sort((a, b) => b.whitePercentage - a.whitePercentage);

    // Return first image that meets threshold
    const bestImage = analyzedImages.find(img => img.whitePercentage >= threshold);
    
    if (bestImage) {
      console.log(`✓ Found image with ${bestImage.whitePercentage}% white background`);
      return bestImage;
    }

    console.log(`⊘ No images found with ≥${threshold}% white background`);
    return null;
  }

  /**
   * Get fallback image filename
   * @param {Object} product - Product object
   * @returns {string} Fallback image filename
   */
  getFallbackImage(product) {
    return `${product.Manufacturer}.jpg`;
  }

  /**
   * Find or create product image
   * @param {Object} product - Product object
   * @returns {Promise<string>} Image URL or filename
   */
  async findProductImage(product) {
    try {
      // If ImageFile already exists, return it
      if (product.ImageFile && product.ImageFile.trim() !== '') {
        console.log(`✓ Using existing image for ${product.ProductName}: ${product.ImageFile}`);
        return product.ImageFile;
      }

      // Search for images
      console.log(`🔍 Searching images for ${product.ProductName}...`);
      const images = await this.searchImages(product, 8);

      if (images.length === 0) {
        console.log(`⊘ No images found, using fallback for ${product.ProductName}`);
        return this.getFallbackImage(product);
      }

      // Find best image with white background
      const bestImage = await this.findBestImage(images, 78);

      if (bestImage) {
        console.log(`✓ Selected image for ${product.ProductName}: ${bestImage.url}`);
        return bestImage.url;
      }

      // Fallback to manufacturer image
      console.log(`⊘ Using fallback image for ${product.ProductName}`);
      return this.getFallbackImage(product);
    } catch (error) {
      console.error(`✗ Failed to find image for ${product.ProductName}:`, error.message);
      return this.getFallbackImage(product);
    }
  }

  /**
   * Process images for multiple products with concurrency limit
   * @param {Array} products - Array of product objects
   * @param {Function} progressCallback - Progress callback function
   * @param {number} concurrencyLimit - Max concurrent requests (default: 2)
   * @returns {Promise<Array>} Array of results with images
   */
  async processImages(products, progressCallback = null, concurrencyLimit = 2) {
    const results = [];
    const total = products.length;
    let completed = 0;

    // Process products in batches with concurrency limit
    for (let i = 0; i < total; i += concurrencyLimit) {
      const batch = products.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (product) => {
        try {
          const imageFile = await this.findProductImage(product);
          completed++;
          
          if (progressCallback) {
            progressCallback(completed, total, product.ProductName);
          }

          return {
            product,
            imageFile,
            success: true
          };
        } catch (error) {
          completed++;
          
          if (progressCallback) {
            progressCallback(completed, total, product.ProductName);
          }

          return {
            product,
            imageFile: this.getFallbackImage(product),
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches
      if (i + concurrencyLimit < total) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

// Export singleton instance
export default new GoogleHelper();
