import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Activity, Project, File as DBFile, Snippet, ErrorSolution, ReusableSystem } from '../models';
import { searchService } from '../services/search.service';
import { isValidObjectIdString } from '../utils/access-control';

const serverErrorResponse = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected search API error occurred.',
  code,
});

const normalizeSearchLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 15;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
};

/**
 * Controller handler for hybrid keyword + semantic vector search.
 * Delegates actual retrieval and ranking to searchService.
 */
export const searchHybrid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { query, projectId } = req.body;
    const safeQuery = typeof query === 'string' ? query.trim().slice(0, 300) : '';
    if (!safeQuery) {
      return res.status(400).json({ error: 'Search query is required.', code: 'SEARCH_QUERY_REQUIRED' });
    }

    if (projectId && !isValidObjectIdString(projectId)) {
      return res.status(400).json({ error: 'Invalid projectId.', code: 'INVALID_OBJECT_ID' });
    }

    const userId = req.user.id;
    const limit = normalizeSearchLimit(req.body.limit);

    // Execute search via service layer
    const { results, debug } = await searchService.search({
      query: safeQuery,
      userId,
      projectId,
      limit
    });

    // Log the search action asynchronously
    void Activity.create({
      userId,
      action: 'search_query',
      entityType: 'project',
      entityId: projectId ? projectId : undefined,
      metadata: { query: safeQuery, limit }
    }).catch(err => console.error('[SearchController]: Failed to log search activity:', err));

    // Only expose debug metadata in development environments
    const showDebug = process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      results,
      ...(showDebug ? { debug } : {})
    });
  } catch (error: any) {
    if (error?.code === 'INVALID_OBJECT_ID') {
      return res.status(400).json({ error: 'Invalid projectId.', code: 'INVALID_OBJECT_ID' });
    }
    if (error?.code === 'PROJECT_NOT_FOUND') {
      return res.status(404).json({ error: 'Project not found.', code: 'PROJECT_NOT_FOUND' });
    }
    return serverErrorResponse(res, 'SEARCH_FAILED');
  }
};

/**
 * Controller handler for dashboard statistics numbers.
 */
export const getQuickStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [projectsCount, filesCount, snippetsCount, errorsCount, reusableSystemsCount, aiQueriesCount] = await Promise.all([
      Project.countDocuments({ userId: req.user.id }),
      DBFile.countDocuments({ userId: req.user.id }),
      Snippet.countDocuments({ userId: req.user.id }),
      ErrorSolution.countDocuments({ userId: req.user.id }),
      ReusableSystem.countDocuments({ userId: req.user.id }),
      Activity.countDocuments({ userId: req.user.id, action: 'ai_question', createdAt: { $gte: startOfMonth } }),
    ]);

    return res.status(200).json({
      stats: {
        projectsCount,
        filesCount,
        snippetsCount,
        errorsCount,
        reusableSystemsCount,
        aiQueriesCount,
      },
    });
  } catch {
    return serverErrorResponse(res, 'SEARCH_STATS_FAILED');
  }
};
