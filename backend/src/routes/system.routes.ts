import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createSystem, getSystems, getSystemById, deleteSystem } from '../controllers/system.controller';
import { validateBody } from '../middleware/validation';

const router = Router();

router.post('/', authenticate, validateBody(['name', 'description', 'type']), createSystem);
router.get('/', authenticate, getSystems);
router.get('/:id', authenticate, getSystemById);
router.delete('/:id', authenticate, deleteSystem);

export default router;
