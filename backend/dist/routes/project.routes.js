"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const project_controller_1 = require("../controllers/project.controller");
const router = (0, express_1.Router)();
// Configure temp upload storage
const tempUploadDir = path_1.default.resolve(__dirname, '../../uploads/temp');
if (!fs_1.default.existsSync(tempUploadDir)) {
    fs_1.default.mkdirSync(tempUploadDir, { recursive: true });
}
const upload = (0, multer_1.default)({
    dest: tempUploadDir,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limits
    fileFilter: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext !== '.zip') {
            return cb(new Error('Only ZIP files are supported.'));
        }
        cb(null, true);
    },
});
// Secure all endpoints with authentication middleware
router.post('/upload', auth_1.authenticate, upload.single('project'), project_controller_1.uploadProject);
router.get('/', auth_1.authenticate, project_controller_1.getProjects);
router.get('/:id', auth_1.authenticate, project_controller_1.getProjectById);
router.delete('/:id', auth_1.authenticate, project_controller_1.deleteProject);
router.get('/:id/overview', auth_1.authenticate, project_controller_1.getProjectOverview);
router.get('/:id/files', auth_1.authenticate, project_controller_1.getProjectFiles);
router.get('/:projectId/files/:fileId', auth_1.authenticate, project_controller_1.getFileContent);
router.get('/:id/health', auth_1.authenticate, project_controller_1.getProjectHealth);
router.get('/:id/graph', auth_1.authenticate, project_controller_1.getProjectGraph);
exports.default = router;
