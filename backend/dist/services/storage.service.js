"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const security_1 = require("../middleware/security");
class LocalStorageService {
    baseUploadDir;
    constructor() {
        this.baseUploadDir = path_1.default.resolve(process.env.LOCAL_STORAGE_DIR || path_1.default.join(__dirname, '../../uploads'));
        if (!fs_1.default.existsSync(this.baseUploadDir)) {
            fs_1.default.mkdirSync(this.baseUploadDir, { recursive: true });
        }
    }
    async saveFile(projectId, relativePath, content) {
        const projectDir = path_1.default.join(this.baseUploadDir, projectId);
        if (!fs_1.default.existsSync(projectDir)) {
            fs_1.default.mkdirSync(projectDir, { recursive: true });
        }
        // Resolve and sanitize path to prevent directory traversal
        const destinationPath = (0, security_1.safePathResolve)(projectDir, relativePath);
        const parentDir = path_1.default.dirname(destinationPath);
        if (!fs_1.default.existsSync(parentDir)) {
            fs_1.default.mkdirSync(parentDir, { recursive: true });
        }
        await fs_1.default.promises.writeFile(destinationPath, content);
        // Return relative storage path (from base uploads dir)
        return path_1.default.relative(this.baseUploadDir, destinationPath);
    }
    async getFile(fileStoragePath) {
        const fullPath = (0, security_1.safePathResolve)(this.baseUploadDir, fileStoragePath);
        if (!fs_1.default.existsSync(fullPath)) {
            throw new Error(`File not found at storage path: ${fileStoragePath}`);
        }
        return fs_1.default.promises.readFile(fullPath);
    }
    async deleteProjectFiles(projectId) {
        const projectDir = (0, security_1.safePathResolve)(this.baseUploadDir, projectId);
        if (fs_1.default.existsSync(projectDir)) {
            await fs_1.default.promises.rm(projectDir, { recursive: true, force: true });
        }
    }
}
// Export singleton instance of storage service
exports.storageService = new LocalStorageService();
