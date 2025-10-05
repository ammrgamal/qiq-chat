// api/admin/learning-suggestions.js - Manage AI learning suggestions
import aiLearningLog from '../../rules-engine/src/aiLearningLog.js';
import dbService from '../../rules-engine/src/dbService.js';

/**
 * API Handler for managing AI learning suggestions
 * Endpoints:
 * - GET: Get pending suggestions
 * - POST: Approve/Reject a suggestion
 * - GET with ?stats=true: Get statistics
 */
export default async function handler(req, res) {
  try {
    // Connect to database
    await dbService.connect();

    // GET: Get pending suggestions or statistics
    if (req.method === 'GET') {
      const { stats, limit = 50, topFailing } = req.query;

      // Get statistics
      if (stats === 'true') {
        const statistics = await aiLearningLog.getStatistics();
        return res.status(200).json({
          ok: true,
          statistics
        });
      }

      // Get top failing queries
      if (topFailing === 'true') {
        const queries = await aiLearningLog.getTopFailingQueries(Number(limit) || 20);
        return res.status(200).json({
          ok: true,
          failingQueries: queries
        });
      }

      // Get pending suggestions
      const suggestions = await aiLearningLog.getPendingSuggestions(Number(limit) || 50);
      return res.status(200).json({
        ok: true,
        suggestions,
        count: suggestions.length
      });
    }

    // POST: Approve or reject a suggestion
    if (req.method === 'POST') {
      const { action, logId, reason, approvedBy } = req.body;

      if (!action || !logId) {
        return res.status(400).json({
          ok: false,
          error: 'action and logId are required'
        });
      }

      if (action === 'approve') {
        await aiLearningLog.approveSuggestion(logId, approvedBy || 'Admin');
        return res.status(200).json({
          ok: true,
          message: 'Suggestion approved successfully',
          logId
        });
      }

      if (action === 'reject') {
        if (!reason) {
          return res.status(400).json({
            ok: false,
            error: 'reason is required for rejection'
          });
        }
        await aiLearningLog.rejectSuggestion(logId, reason, approvedBy || 'Admin');
        return res.status(200).json({
          ok: true,
          message: 'Suggestion rejected successfully',
          logId
        });
      }

      return res.status(400).json({
        ok: false,
        error: 'Invalid action. Use "approve" or "reject"'
      });
    }

    // Method not allowed
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Learning suggestions API error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  } finally {
    try {
      await dbService.disconnect();
    } catch (disconnectError) {
      console.warn('Failed to disconnect database:', disconnectError.message);
    }
  }
}
