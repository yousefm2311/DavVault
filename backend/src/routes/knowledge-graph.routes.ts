import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getNeighborhood, getEntityRelationships } from '../controllers/knowledge-graph.controller';

const router = Router();

// All graph routes require authentication
router.get('/neighborhood',                       authenticate, getNeighborhood);
router.get('/entity/:entityType/:entityId/relationships', authenticate, getEntityRelationships);

export default router;
