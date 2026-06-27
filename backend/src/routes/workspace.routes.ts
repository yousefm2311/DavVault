import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getWorkspaceMembers, addWorkspaceMember, removeWorkspaceMember } from '../controllers/workspace.controller';
import { validateBody } from '../middleware/validation';

const router = Router();

router.get('/members', authenticate, getWorkspaceMembers);
router.post('/members', authenticate, validateBody(['email']), addWorkspaceMember);
router.delete('/members/:userId', authenticate, removeWorkspaceMember);

export default router;
