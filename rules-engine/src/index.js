#!/usr/bin/env node
// index.js - Main entry point for Rules Engine
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';
import rulesEngine from './rulesEngine.js';

// Load environment variables from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Generate sample test products
 * @param {number} count - Number of products to generate
 * @returns {Array} Array of sample products
 */
function generateSampleProducts(count = 20) {
  const sampleProducts = [
    {
      name: 'Cisco Catalyst 2960-24TT-L Switch',
      partNumber: 'WS-C2960-24TT-L',
      manufacturer: 'Cisco',
      description: '24-port Ethernet switch with 10/100 ports',
      price: 1499.99
    },
    {
      name: 'Dell PowerEdge R740 Server',
      partNumber: 'R740-7321',
      manufacturer: 'Dell',
      description: 'Dual Xeon Silver 4210R, 64GB RAM, 2x 480GB SSD',
      price: 8999.99
    },
    {
      name: 'NetApp FAS2750 Storage System',
      partNumber: 'FAS2750-BASE-R6',
      manufacturer: 'NetApp',
      description: 'Hybrid storage array with 24x 1.2TB SAS drives',
      price: 45000.00
    },
    {
      name: 'Microsoft Office 365 E3 License',
      partNumber: 'MS-O365-E3-USER',
      manufacturer: 'Microsoft',
      description: 'Annual subscription per user',
      price: 240.00
    },
    {
      name: 'HP ProLiant DL380 Gen10',
      partNumber: 'DL380-G10-8',
      manufacturer: 'HP',
      description: '2U rack server with Intel Xeon Gold',
      price: 6500.00
    },
    {
      name: 'Ubiquiti UniFi Dream Machine Pro',
      partNumber: 'UDM-PRO',
      manufacturer: 'Ubiquiti',
      description: 'All-in-one network appliance with routing and switching',
      price: 379.00
    },
    {
      name: 'APC Smart-UPS 3000VA',
      partNumber: 'SMT3000RM2U',
      manufacturer: 'APC',
      description: 'Rack-mountable UPS with LCD display',
      price: 1899.00
    },
    {
      name: 'VMware vSphere Standard License',
      partNumber: 'VMW-VSPHERE-STD',
      manufacturer: 'VMware',
      description: 'Server virtualization platform',
      price: 995.00
    },
    {
      name: 'Juniper EX4300-48T Switch',
      partNumber: 'EX4300-48T',
      manufacturer: 'Juniper',
      description: '48-port Gigabit Ethernet switch',
      price: 3200.00
    },
    {
      name: 'Lenovo ThinkSystem SR650',
      partNumber: 'SR650-7X06',
      manufacturer: 'Lenovo',
      description: '2U rack server with dual Intel Xeon',
      price: 7200.00
    },
    {
      name: 'Synology DS1821+ NAS',
      partNumber: 'DS1821PLUS',
      manufacturer: 'Synology',
      description: '8-bay NAS with AMD Ryzen processor',
      price: 1099.00
    },
    {
      name: 'Fortinet FortiGate 100F Firewall',
      partNumber: 'FG-100F',
      manufacturer: 'Fortinet',
      description: 'Next-generation firewall appliance',
      price: 2500.00
    },
    {
      name: 'CAT6A Ethernet Cable - 100ft',
      partNumber: 'CAT6A-100FT',
      manufacturer: 'Generic',
      description: 'Shielded Cat 6A cable for 10Gbps',
      price: 45.00
    },
    {
      name: 'Aruba 2930F 48G Switch',
      partNumber: 'JL262A',
      manufacturer: 'Aruba',
      description: 'Layer 3 managed switch with 48 ports',
      price: 2800.00
    },
    {
      name: 'Veeam Backup & Replication License',
      partNumber: 'VEEAM-BACKUP-STD',
      manufacturer: 'Veeam',
      description: 'Backup solution for virtual environments',
      price: 550.00
    },
    {
      name: 'Supermicro SuperServer 1029P-MTR',
      partNumber: '1029P-MTR',
      manufacturer: 'Supermicro',
      description: 'High-performance 1U server',
      price: 5800.00
    },
    {
      name: 'TP-Link TL-SG1024DE Switch',
      partNumber: 'TL-SG1024DE',
      manufacturer: 'TP-Link',
      description: '24-port Gigabit Easy Smart switch',
      price: 179.99
    },
    {
      name: 'Pure Storage FlashArray//X70',
      partNumber: 'FA-X70-BASE',
      manufacturer: 'Pure Storage',
      description: 'All-flash storage array',
      price: 85000.00
    },
    {
      name: 'Logitech C920 HD Pro Webcam',
      partNumber: 'C920',
      manufacturer: 'Logitech',
      description: '1080p video calling and recording',
      price: 79.99
    },
    {
      name: 'Tripp Lite 42U Server Rack',
      partNumber: 'SR42UB',
      manufacturer: 'Tripp Lite',
      description: 'Enclosure cabinet with doors and side panels',
      price: 1299.00
    }
  ];

  return sampleProducts.slice(0, Math.min(count, sampleProducts.length));
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Display banner
    logger.banner('QuickITQuote Rules Engine');
    
    console.log(`
🚀 Welcome to the Rules Engine Module!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This module classifies IT products using AI and determines auto-approval
rules based on category, price, and other factors.

Environment Configuration:
  • Database: ${process.env.DATABASE || 'config/dbConfig.json'}
  • OpenAI API: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}
  • Gemini API: ${process.env.GOOGLE_API_KEY || process.env.Gemini_API ? '✓ Configured' : '✗ Not configured'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // Check if we should use custom products or sample data
    const useCustomProducts = process.argv.includes('--custom');
    
    if (useCustomProducts) {
      logger.info('Custom product mode - waiting for product data...');
      logger.warn('Note: Custom mode requires product data to be passed programmatically');
      return;
    }

    // Generate sample products
    const sampleSize = parseInt(process.argv[2]) || 20;
    const products = generateSampleProducts(sampleSize);
    
    logger.info(`Generated ${products.length} sample products for testing`);
    logger.info('Starting batch processing...\n');

    // Initialize and process
    await rulesEngine.initialize();
    const result = await rulesEngine.processProducts(products);

    // Display final results
    logger.success(`\n✅ Processing Complete!`);
    logger.info(`Results saved to database tables:`);
    logger.info(`  • AI_Log: Processing logs and AI responses`);
    logger.info(`  • Rules_Item: Product classification rules`);
    logger.info(`  • Rules_Category: Category definitions\n`);

    // Shutdown
    await rulesEngine.shutdown();

    // Exit with appropriate code
    process.exit(result.errorCount > 0 ? 1 : 0);

  } catch (error) {
    logger.error('Fatal error in main execution', error);
    
    // Try to shutdown gracefully
    try {
      await rulesEngine.shutdown();
    } catch (shutdownError) {
      logger.error('Error during emergency shutdown', shutdownError);
    }

    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.warn('\n\nReceived SIGINT, shutting down gracefully...');
  try {
    await rulesEngine.shutdown();
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.warn('\n\nReceived SIGTERM, shutting down gracefully...');
  try {
    await rulesEngine.shutdown();
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
  process.exit(0);
});

// Run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error', error);
    process.exit(1);
  });
}

// Export for use as module
export { rulesEngine, generateSampleProducts };
export default main;
