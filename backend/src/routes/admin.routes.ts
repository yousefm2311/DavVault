import { Router } from 'express';
import { authenticate, isAdmin, isSuperAdmin } from '../middleware/auth';
import {
  forceDeleteProject,
  getAdminStats,
  getUserActivity,
  listAdminProjects,
  listAdminUsers,
  updatePlanLimits,
  updateUserRole,
  updateUserStatus,
} from '../controllers/admin.controller';

const router = Router();

router.use(authenticate, isAdmin);

router.get('/dashboard/stats', getAdminStats);
router.get('/users', listAdminUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);
router.get('/users/:id/activity', getUserActivity);
router.get('/projects', listAdminProjects);
router.delete('/projects/:id', forceDeleteProject);
router.put('/settings/limits', isSuperAdmin, updatePlanLimits);

export default router;
