import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createErrorSolution, getErrors, getErrorById, deleteError } from '../controllers/error.controller';
import { validateBody } from '../middleware/validation';

const router = Router();

router.post('/', authenticate, validateBody(['title', 'errorMessage', 'cause', 'solution']), createErrorSolution);
router.get('/', authenticate, getErrors);
router.get('/:id', authenticate, getErrorById);
router.delete('/:id', authenticate, deleteError);

export default router;
