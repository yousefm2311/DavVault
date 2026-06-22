import fs from 'fs';
import path from 'path';
import { safePathResolve } from '../middleware/security';

export interface IStorageService {
  saveFile(projectId: string, relativePath: string, content: Buffer | string): Promise<string>;
  getFile(fileStoragePath: string): Promise<Buffer>;
  deleteProjectFiles(projectId: string): Promise<void>;
}

class LocalStorageService implements IStorageService {
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(
      process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '../../uploads')
    );
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  async saveFile(projectId: string, relativePath: string, content: Buffer | string): Promise<string> {
    const projectDir = path.join(this.baseUploadDir, projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Resolve and sanitize path to prevent directory traversal
    const destinationPath = safePathResolve(projectDir, relativePath);
    const parentDir = path.dirname(destinationPath);
    
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(destinationPath, content);
    
    // Return relative storage path (from base uploads dir)
    return path.relative(this.baseUploadDir, destinationPath);
  }

  async getFile(fileStoragePath: string): Promise<Buffer> {
    const fullPath = safePathResolve(this.baseUploadDir, fileStoragePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found at storage path: ${fileStoragePath}`);
    }
    return fs.promises.readFile(fullPath);
  }

  async deleteProjectFiles(projectId: string): Promise<void> {
    const projectDir = safePathResolve(this.baseUploadDir, projectId);
    if (fs.existsSync(projectDir)) {
      await fs.promises.rm(projectDir, { recursive: true, force: true });
    }
  }
}

// Export singleton instance of storage service
export const storageService = new LocalStorageService();
