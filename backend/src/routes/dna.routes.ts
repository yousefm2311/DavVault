import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDeveloperDNA, compareCodeStyle } from '../controllers/dna.controller';
import { validateBody } from '../middleware/validation';

const router = Router();

router.get('/', authenticate, getDeveloperDNA);
router.post('/compare', authenticate, validateBody(['code']), compareCodeStyle);

export default router;
