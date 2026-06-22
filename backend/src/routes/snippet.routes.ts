import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createSnippet, getSnippets, getSnippetById, deleteSnippet } from '../controllers/snippet.controller';
import { validateBody } from '../middleware/validation';

const router = Router();

router.post('/', authenticate, validateBody(['title', 'code', 'language']), createSnippet);
router.get('/', authenticate, getSnippets);
router.get('/:id', authenticate, getSnippetById);
router.delete('/:id', authenticate, deleteSnippet);

export default router;
