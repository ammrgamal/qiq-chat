// aiLearningLog.js - Self-learning layer for tracking and improving Arabic queries
import logger from './logger.js';
import dbService from './dbService.js';
import arabicNLP from './arabicNLP.js';

class AILearningLog {
  constructor() {
    this.autoApproveThreshold = 0.90; // Auto-approve if confidence >= 90%
  }

  /**
   * Log a query that failed to match products
   * @param {Object} queryData - Query information
   * @returns {Promise<number>} Log entry ID
   */
  async logFailedQuery(queryData) {
    const {
      query,
      userId = null,
      sessionId = null,
      context = {},
      searchResults = [],
      aiSuggestion = null
    } = queryData;

    try {
      // Analyze query
      const isArabic = arabicNLP.containsArabic(query);
      const normalized = isArabic ? arabicNLP.normalizeArabic(query) : query;
      
      // Get AI suggestion if not provided
      let suggestion = aiSuggestion;
      let confidence = 0;
      
      if (!suggestion && isArabic) {
        const translation = await arabicNLP.translateToEnglish(query, 'query');
        suggestion = {
          originalQuery: query,
          normalizedQuery: normalized,
          translatedQuery: translation.translated,
          transliterated: translation.transliterated,
          confidence: translation.confidence || 0,
          provider: translation.provider
        };
        confidence = translation.confidence || 0;
      }

      // Store in database
      const logData = {
        QueryText: query,
        NormalizedQuery: normalized,
        IsArabic: isArabic,
        UserId: userId,
        SessionId: sessionId,
        Context: JSON.stringify(context),
        SearchResultsCount: searchResults.length,
        AISuggestion: JSON.stringify(suggestion),
        Confidence: confidence,
        Status: confidence >= this.autoApproveThreshold ? 'AutoApproved' : 'PendingReview',
        LogDate: new Date()
      };

      const result = await dbService.query(
        `INSERT INTO dbo.AI_Learning_Log 
        (QueryText, NormalizedQuery, IsArabic, UserId, SessionId, Context, 
         SearchResultsCount, AISuggestion, Confidence, Status, LogDate)
        VALUES 
        (@QueryText, @NormalizedQuery, @IsArabic, @UserId, @SessionId, @Context,
         @SearchResultsCount, @AISuggestion, @Confidence, @Status, @LogDate);
        SELECT SCOPE_IDENTITY() AS LogID;`,
        logData
      );

      const logId = result.recordset[0].LogID;
      
      // Auto-approve if confidence is high enough
      if (confidence >= this.autoApproveThreshold) {
        await this.autoApproveSuggestion(logId, suggestion);
        logger.info(`Auto-approved learning suggestion for query: ${query} (confidence: ${confidence})`);
      } else {
        logger.info(`Logged failed query for review: ${query} (confidence: ${confidence})`);
      }

      return logId;
    } catch (error) {
      logger.error('Failed to log query', error);
      throw error;
    }
  }

  /**
   * Auto-approve a high-confidence suggestion
   * Updates synonyms in product database
   * @param {number} logId - Learning log entry ID
   * @param {Object} suggestion - AI suggestion
   * @returns {Promise<void>}
   */
  async autoApproveSuggestion(logId, suggestion) {
    try {
      // Extract synonyms from suggestion
      const arabicTerms = [suggestion.originalQuery, suggestion.normalizedQuery].filter(Boolean);
      const englishTerms = [suggestion.translatedQuery, suggestion.transliterated].filter(Boolean);
      
      // Update learning log status
      await dbService.query(
        `UPDATE dbo.AI_Learning_Log 
         SET Status = 'AutoApproved', 
             ApprovedDate = GETDATE(),
             ApprovedBy = 'System'
         WHERE LogID = @logId`,
        { logId }
      );

      logger.success(`Auto-approved suggestion for log ID: ${logId}`);
    } catch (error) {
      logger.error('Failed to auto-approve suggestion', error);
      throw error;
    }
  }

  /**
   * Get pending suggestions for manual review
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Pending suggestions
   */
  async getPendingSuggestions(limit = 50) {
    try {
      const result = await dbService.query(
        `SELECT TOP (@limit)
           LogID, QueryText, NormalizedQuery, IsArabic,
           AISuggestion, Confidence, LogDate, Context
         FROM dbo.AI_Learning_Log
         WHERE Status = 'PendingReview'
         ORDER BY Confidence DESC, LogDate DESC`,
        { limit }
      );

      return result.recordset.map(row => ({
        logId: row.LogID,
        query: row.QueryText,
        normalized: row.NormalizedQuery,
        isArabic: row.IsArabic,
        suggestion: JSON.parse(row.AISuggestion || '{}'),
        confidence: row.Confidence,
        logDate: row.LogDate,
        context: JSON.parse(row.Context || '{}')
      }));
    } catch (error) {
      logger.error('Failed to get pending suggestions', error);
      return [];
    }
  }

  /**
   * Manually approve a suggestion
   * @param {number} logId - Learning log entry ID
   * @param {string} approvedBy - User who approved
   * @returns {Promise<void>}
   */
  async approveSuggestion(logId, approvedBy = 'Manual') {
    try {
      // Get suggestion details
      const result = await dbService.query(
        `SELECT AISuggestion FROM dbo.AI_Learning_Log WHERE LogID = @logId`,
        { logId }
      );

      if (result.recordset.length === 0) {
        throw new Error(`Learning log entry not found: ${logId}`);
      }

      const suggestion = JSON.parse(result.recordset[0].AISuggestion || '{}');

      // Update status
      await dbService.query(
        `UPDATE dbo.AI_Learning_Log 
         SET Status = 'Approved', 
             ApprovedDate = GETDATE(),
             ApprovedBy = @approvedBy
         WHERE LogID = @logId`,
        { logId, approvedBy }
      );

      logger.success(`Manually approved suggestion for log ID: ${logId} by ${approvedBy}`);
    } catch (error) {
      logger.error('Failed to approve suggestion', error);
      throw error;
    }
  }

  /**
   * Reject a suggestion
   * @param {number} logId - Learning log entry ID
   * @param {string} reason - Rejection reason
   * @param {string} rejectedBy - User who rejected
   * @returns {Promise<void>}
   */
  async rejectSuggestion(logId, reason, rejectedBy = 'Manual') {
    try {
      await dbService.query(
        `UPDATE dbo.AI_Learning_Log 
         SET Status = 'Rejected', 
             RejectionReason = @reason,
             RejectedDate = GETDATE(),
             RejectedBy = @rejectedBy
         WHERE LogID = @logId`,
        { logId, reason, rejectedBy }
      );

      logger.info(`Rejected suggestion for log ID: ${logId} - Reason: ${reason}`);
    } catch (error) {
      logger.error('Failed to reject suggestion', error);
      throw error;
    }
  }

  /**
   * Get learning statistics
   * @returns {Promise<Object>} Learning stats
   */
  async getStatistics() {
    try {
      const result = await dbService.query(`
        SELECT 
          COUNT(*) AS TotalLogs,
          SUM(CASE WHEN Status = 'PendingReview' THEN 1 ELSE 0 END) AS Pending,
          SUM(CASE WHEN Status = 'AutoApproved' THEN 1 ELSE 0 END) AS AutoApproved,
          SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) AS ManuallyApproved,
          SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) AS Rejected,
          SUM(CASE WHEN IsArabic = 1 THEN 1 ELSE 0 END) AS ArabicQueries,
          AVG(CASE WHEN Confidence IS NOT NULL THEN Confidence ELSE 0 END) AS AvgConfidence
        FROM dbo.AI_Learning_Log
      `);

      return result.recordset[0];
    } catch (error) {
      logger.error('Failed to get learning statistics', error);
      return null;
    }
  }

  /**
   * Get top failing queries for analysis
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Top failing queries
   */
  async getTopFailingQueries(limit = 20) {
    try {
      const result = await dbService.query(
        `SELECT TOP (@limit)
           QueryText, 
           COUNT(*) AS FailCount,
           AVG(Confidence) AS AvgConfidence,
           MAX(LogDate) AS LastSeen,
           MAX(CASE WHEN IsArabic = 1 THEN 1 ELSE 0 END) AS IsArabic
         FROM dbo.AI_Learning_Log
         WHERE SearchResultsCount = 0
         GROUP BY QueryText
         ORDER BY FailCount DESC, LastSeen DESC`,
        { limit }
      );

      return result.recordset.map(row => ({
        query: row.QueryText,
        failCount: row.FailCount,
        avgConfidence: row.AvgConfidence,
        lastSeen: row.LastSeen,
        isArabic: row.IsArabic
      }));
    } catch (error) {
      logger.error('Failed to get top failing queries', error);
      return [];
    }
  }
}

// Export singleton instance
export default new AILearningLog();
