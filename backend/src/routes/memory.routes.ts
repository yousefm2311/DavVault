import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMemories, getMemoryById, createMemory, updateMemory, deleteMemory } from '../controllers/memory.controller';

const router = Router();

// All memory routes require authentication
router.get('/',     authenticate, getMemories);
router.post('/',    authenticate, createMemory);
router.get('/:id',    authenticate, getMemoryById);
router.patch('/:id',  authenticate, updateMemory);
router.delete('/:id', authenticate, deleteMemory);

export default router;
