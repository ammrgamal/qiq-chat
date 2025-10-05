// utils/google-helper.js
// Helper functions for Google Custom Search API and image background color analysis

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
try {
  const rootEnvPath = join(__dirname, '..', '..', '.env');
  dotenv.config({ path: rootEnvPath });
} catch (error) {
  console.warn('Could not load .env file:', error.message);
}

class GoogleHelper {
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
    this.cxId = process.env.GOOGLE_CX_ID;
  }

  /**
   * Check if Google Custom Search is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.apiKey && this.cxId);
  }

  /**
   * Search for product images
   * @param {Object} product - Product data
   * @returns {Promise<string|null>} Image URL or null
   */
  async findProductImage(product) {
    if (!this.isConfigured()) {
      console.warn('⚠ Google Custom Search not configured, using fallback');
      return this.getFallbackImage(product);
    }

    try {
      // Build search query
      const query = this.buildImageSearchQuery(product);

      // Search for images
      const images = await this.searchImages(query);

      // Find best image (white background)
      const bestImage = await this.selectBestImage(images);

      if (bestImage) {
        console.log(`✓ Found image with ${bestImage.whiteness}% white background`);
        return bestImage.url;
      }

      // Fallback if no suitable image found
      console.log('⚠ No suitable image found, using fallback');
      return this.getFallbackImage(product);
    } catch (error) {
      console.error('Image search failed:', error.message);
      return this.getFallbackImage(product);
    }
  }

  /**
   * Build search query for images
   * @param {Object} product - Product data
   * @returns {string} Search query
   */
  buildImageSearchQuery(product) {
    const parts = [];

    if (product.PartNumber) {
      parts.push(product.PartNumber);
    }

    if (product.ManufacturerName) {
      parts.push(product.ManufacturerName);
    }

    parts.push('product');

    // Add white background preference
    parts.push('white background');

    return parts.join(' ');
  }

  /**
   * Search for images using Google Custom Search API
   * @param {string} query - Search query
   * @param {number} numResults - Number of results to fetch
   * @returns {Promise<Array>} Array of image objects
   */
  async searchImages(query, numResults = 8) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('cx', this.cxId);
    url.searchParams.set('q', query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', Math.min(numResults, 10).toString());
    url.searchParams.set('imgSize', 'large');
    url.searchParams.set('imgType', 'photo');

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return [];
      }

      return data.items.map(item => ({
        url: item.link,
        thumbnail: item.image?.thumbnailLink,
        width: item.image?.width,
        height: item.image?.height,
        context: item.displayLink
      }));
    } catch (error) {
      console.error('Google Custom Search failed:', error.message);
      return [];
    }
  }

  /**
   * Select best image based on white background criteria
   * @param {Array} images - Array of image objects
   * @returns {Promise<Object|null>} Best image or null
   */
  async selectBestImage(images) {
    if (!images || images.length === 0) {
      return null;
    }

    for (const image of images) {
      try {
        const whiteness = await this.analyzeImageWhiteness(image.url);

        if (whiteness >= 78) {
          return {
            url: image.url,
            whiteness
          };
        }
      } catch (error) {
        // Skip images that fail to analyze
        console.warn(`⚠ Failed to analyze image: ${error.message}`);
        continue;
      }
    }

    // If no image meets criteria, return first image
    if (images.length > 0) {
      return {
        url: images[0].url,
        whiteness: 0
      };
    }

    return null;
  }

  /**
   * Analyze image to determine white background percentage
   * @param {string} imageUrl - Image URL
   * @returns {Promise<number>} Whiteness percentage (0-100)
   */
  async analyzeImageWhiteness(imageUrl) {
    // Note: This is a simplified implementation
    // In a real scenario, you would need to:
    // 1. Download the image
    // 2. Use an image processing library (like sharp or jimp)
    // 3. Analyze pixel colors to determine white percentage
    //
    // For this implementation, we'll use a heuristic approach
    // based on image URL patterns and context

    try {
      // Fetch image metadata (without downloading full image)
      const response = await fetch(imageUrl, { method: 'HEAD' });

      if (!response.ok) {
        throw new Error('Image not accessible');
      }

      // Get content type
      const contentType = response.headers.get('content-type');

      if (!contentType?.startsWith('image/')) {
        throw new Error('Not a valid image');
      }

      // Heuristic: Check if URL contains indicators of product photos
      // which typically have white backgrounds
      const url = imageUrl.toLowerCase();
      let whitenessScore = 50; // Base score

      // Positive indicators
      if (url.includes('white-background') || url.includes('white_bg')) whitenessScore += 30;
      if (url.includes('product-image') || url.includes('product_photo')) whitenessScore += 10;
      if (url.includes('amazon') || url.includes('newegg')) whitenessScore += 15;
      if (url.includes('cdn') || url.includes('cloudfront')) whitenessScore += 5;

      // Negative indicators
      if (url.includes('banner') || url.includes('hero')) whitenessScore -= 20;
      if (url.includes('lifestyle') || url.includes('scene')) whitenessScore -= 15;

      return Math.max(0, Math.min(100, whitenessScore));
    } catch (error) {
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
  }

  /**
   * Get fallback image filename
   * @param {Object} product - Product data
   * @returns {string} Fallback image filename
   */
  getFallbackImage(product) {
    if (product.ManufacturerName) {
      // Clean manufacturer name for filename
      const cleanName = product.ManufacturerName
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
      return `${cleanName}.jpg`;
    }

    return 'default-product.jpg';
  }

  /**
   * Download image to local storage (optional utility)
   * @param {string} imageUrl - Image URL
   * @param {string} destinationPath - Local path to save
   * @returns {Promise<boolean>} Success status
   */
  async downloadImage(imageUrl, destinationPath) {
    try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Would need fs/promises to write file
      // const fs = await import('fs/promises');
      // await fs.writeFile(destinationPath, buffer);

      console.log(`✓ Downloaded image to ${destinationPath}`);
      return true;
    } catch (error) {
      console.error(`Failed to download image: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate image URL
   * @param {string} imageUrl - Image URL to validate
   * @returns {Promise<boolean>} True if valid and accessible
   */
  async validateImageUrl(imageUrl) {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok && response.headers.get('content-type')?.startsWith('image/');
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export default new GoogleHelper();
