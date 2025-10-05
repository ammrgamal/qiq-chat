# Changelog

All notable changes to the Rules Engine module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-05

### Added
- Initial release of Rules Engine module
- AI-powered product classification using OpenAI GPT or Google Gemini
- Auto-approval system based on configurable rules
- SQL Server integration with comprehensive schema
- Database tables: AI_Log, Rules_Item, Rules_Category
- Batch processing with progress tracking
- Colorful CLI logging with progress bars
- Sample data generator with 20 test products
- Comprehensive error handling and fallback mechanisms
- Module export for programmatic use
- Database service for CRUD operations
- Auto-approval rules engine
- Configuration files for database and environment
- Complete documentation (README, SETUP guide)
- Installation scripts for Linux/Mac and Windows
- Sample categories: Networking, Servers, Storage, Software, Accessories

### Features
- **AI Classification**: Automatically categorizes products into relevant categories
- **Confidence Scoring**: AI provides confidence scores (0-100) for classifications
- **Auto-Approval Logic**: Smart rules for determining which products can be auto-approved
- **Multi-Provider Support**: Works with OpenAI, Google Gemini, or rule-based fallback
- **Batch Processing**: Process multiple products efficiently with progress tracking
- **Database Logging**: Comprehensive logging of all AI interactions and decisions
- **Price-Based Rules**: Category-specific price limits for auto-approval
- **Graceful Degradation**: Falls back to rule-based classification if AI unavailable
- **Rate Limiting**: Built-in delays to avoid overwhelming APIs
- **Session Management**: Proper database connection pooling and cleanup

### Technical Details
- **Node.js**: ES Modules (type: module)
- **Dependencies**: 
  - chalk ^5.3.0 (colored console output)
  - cli-progress ^3.12.0 (progress bars)
  - dotenv ^16.4.5 (environment configuration)
  - mssql ^11.0.1 (SQL Server connectivity)
  - openai ^4.67.1 (OpenAI API client)
- **Database**: SQL Server with T-SQL schema
- **AI Models**: 
  - OpenAI: gpt-4o-mini (configurable)
  - Gemini: gemini-1.5-flash (configurable)

### Auto-Approval Rules (v1.0.0)
- Networking: Auto-approve up to $5,000
- Software: Auto-approve up to $3,000
- Accessories: Auto-approve up to $1,000
- Storage: Auto-approve up to $10,000
- Servers: Never auto-approve (always requires review)
- Minimum confidence threshold: 70%
- Only "Standard" classification items can be auto-approved

### Database Schema
- **AI_Log**: 13 columns tracking AI processing and performance
- **Rules_Item**: 18 columns for product rules and metadata
- **Rules_Category**: 11 columns for category definitions
- Indexes on key fields for performance
- Sample data included for testing

### Documentation
- README.md: Complete usage guide with examples
- SETUP.md: Step-by-step installation instructions
- .env.example: Environment variable template
- CHANGELOG.md: Version history and changes
- Inline code comments throughout all modules

### Known Limitations
- Requires SQL Server (not compatible with MySQL/PostgreSQL)
- AI API calls are synchronous (no parallel processing)
- 500ms delay between API calls to avoid rate limiting
- No built-in caching mechanism for repeated classifications
- Database schema must be created manually

### Security
- API keys read from environment variables (not hardcoded)
- Database credentials in separate config file
- .gitignore includes sensitive files
- No sensitive data logged to console
- SQL injection protection via parameterized queries

## [Unreleased]

### Planned Features
- Support for additional AI providers (Claude, Llama)
- Redis caching for repeated product classifications
- REST API endpoints for remote classification
- Web dashboard for monitoring and configuration
- Parallel processing for batch operations
- MySQL/PostgreSQL adapter support
- Enhanced product matching algorithms
- Machine learning model training on historical data
- Integration with QuoteWerks CRM API
- Email notifications for approval decisions
- Audit trail with change tracking
- Role-based access control for rules management

---

## Version History

- **1.0.0** (2024-10-05): Initial release

## Contributing

This module is part of the QuickITQuote (qiq-chat) project. For contributions and bug reports, please refer to the main project repository.

## License

Copyright © 2024 QuickITQuote Team. All rights reserved.
