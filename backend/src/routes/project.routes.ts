import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanLimits } from '../middleware/limits';
import {
  uploadProject,
  getProjects,
  getProjectById,
  deleteProject,
  getProjectOverview,
  getProjectFiles,
  getFileContent,
  getProjectHealth,
  getProjectGraph,
  downloadProjectZip,
} from '../controllers/project.controller';

const router = Router();

// Configure temp upload storage
const tempUploadDir = path.resolve(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const upload = multer({
  dest: tempUploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limits
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return cb(new Error('Only ZIP files are supported.'));
    }
    cb(null, true);
  },
});

const uploadProjectZip = (req: Request, res: Response, next: NextFunction) => {
  upload.single('project')(req, res, (err: any) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'ZIP archive exceeds the maximum upload size.',
        code: 'UPLOAD_FILE_TOO_LARGE',
      });
    }

    if (err.message === 'Only ZIP files are supported.') {
      return res.status(400).json({
        error: 'Only ZIP files are supported.',
        code: 'UNSUPPORTED_ARCHIVE_TYPE',
      });
    }

    return res.status(400).json({
      error: 'Invalid project upload.',
      code: 'PROJECT_UPLOAD_VALIDATION_FAILED',
    });
  });
};

// Secure all endpoints with authentication middleware
router.post('/upload', authenticate, checkPlanLimits('project'), uploadProjectZip, uploadProject);
router.get('/', authenticate, getProjects);
router.get('/:id', authenticate, getProjectById);
router.delete('/:id', authenticate, deleteProject);
router.get('/:id/download', authenticate, downloadProjectZip);
router.get('/:id/overview', authenticate, getProjectOverview);
router.get('/:id/files', authenticate, getProjectFiles);
router.get('/:projectId/files/:fileId', authenticate, getFileContent);
router.get('/:id/health', authenticate, getProjectHealth);
router.get('/:id/graph', authenticate, getProjectGraph);

export default router;
