import { Router } from 'express';
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import searchRoutes from './search.routes';
import aiRoutes from './ai.routes';
import snippetRoutes from './snippet.routes';
import errorRoutes from './error.routes';
import dnaRoutes from './dna.routes';
import systemRoutes from './system.routes';
import timemachineRoutes from './timemachine.routes';
import workspaceRoutes from './workspace.routes';
import aiExtensionsRoutes from './ai-extensions.routes';
import subscriptionRoutes from './subscription.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/search', searchRoutes);
router.use('/ai', aiRoutes);
router.use('/snippets', snippetRoutes);
router.use('/errors', errorRoutes);
router.use('/developer-dna', dnaRoutes);
router.use('/systems', systemRoutes);
router.use('/time-machine', timemachineRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/ai-extensions', aiExtensionsRoutes);
router.use('/subscription', subscriptionRoutes);

export default router;
