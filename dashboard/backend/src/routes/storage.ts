import { Router } from 'express';
import { StorageService } from '../services/StorageService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import multer from 'multer';
import { reloadNginxGateway } from '../services/NginxGatewayGenerator';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

const upload = multer();

export function createStorageRoutes(storageService: StorageService) {
  const router = Router({ mergeParams: true });

  // List buckets
  router.get('/buckets', requireAuth, requireScope(SCOPES.STORAGE.READ), async (req, res) => {
    try {
      const { name } = req.params;
      const buckets = await storageService.listBuckets(name);
      res.json({ buckets });
    } catch (error: any) {
      logger.error(`Error listing buckets for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create bucket
  router.post('/buckets', requireAuth, requireScope(SCOPES.STORAGE.WRITE), async (req, res) => {
    try {
      const { name } = req.params;
      const { bucketName, isPublic } = req.body;
      const bucket = await storageService.createBucket(name, bucketName, isPublic);
      res.json(bucket);
    } catch (error: any) {
      logger.error(`Error creating bucket for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete bucket
  router.delete('/buckets/:bucketId', requireAuth, requireScope(SCOPES.STORAGE.WRITE), async (req, res) => {
    try {
      const { name, bucketId } = req.params;
      await storageService.deleteBucket(name, bucketId);
      res.json({ message: 'Bucket deleted' });
    } catch (error: any) {
      logger.error(`Error deleting bucket for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // List files
  router.get('/files/:bucketId/:path(*)?', requireAuth, requireScope(SCOPES.STORAGE.READ), async (req, res) => {
    try {
      const { name, bucketId, path: filePath } = req.params;
      const files = await storageService.listFiles(name, bucketId, filePath || '');
      res.json({ files });
    } catch (error: any) {
      logger.error(`Error listing files for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload file
  router.post('/files/:bucketId', requireAuth, requireScope(SCOPES.STORAGE.WRITE), upload.single('file'), async (req, res) => {
    try {
      const { name, bucketId } = req.params;
      const file = req.file;
      const { path: filePath } = req.body;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Combine path and filename if needed, or assume filePath includes full path
      // Usually filePath comes from body as "folder/filename.ext" or just "folder/"
      // Let's assume filePath is the full destination path including filename

      const destinationPath = filePath || file.originalname;

      const data = await storageService.uploadFile(
        name,
        bucketId,
        destinationPath,
        file.buffer,
        file.mimetype
      );
      res.json(data);
    } catch (error: any) {
      logger.error(`Error uploading file for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete file
  router.delete('/files/:bucketId/:path(*)', requireAuth, requireScope(SCOPES.STORAGE.WRITE), async (req, res) => {
    try {
      const { name, bucketId, path: filePath } = req.params;
      await storageService.deleteFile(name, bucketId, filePath);
      res.json({ message: 'File deleted' });
    } catch (error: any) {
      logger.error(`Error deleting file for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Public URL
  router.get('/url/:bucketId/:path(*)', requireAuth, requireScope(SCOPES.STORAGE.READ), async (req, res) => {
    try {
      const { name, bucketId, path: filePath } = req.params;
      const data = await storageService.getPublicUrl(name, bucketId, filePath);
      res.json(data);
    } catch (error: any) {
      logger.error(`Error getting public url for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Signed URL
  router.post('/signed-url/:bucketId', requireAuth, requireScope(SCOPES.STORAGE.WRITE), async (req, res) => {
    try {
      const { name, bucketId } = req.params;
      const { path: filePath, expiresIn } = req.body;
      const data = await storageService.createSignedUrl(name, bucketId, filePath, expiresIn);
      res.json(data);
    } catch (error: any) {
      logger.error(`Error creating signed url for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Invalidate CDN cache for this instance (reloads nginx gateway)
  router.post('/cache/invalidate', requireAuth, requireScope(SCOPES.STORAGE.WRITE), async (req, res) => {
    try {
      await reloadNginxGateway();
      return res.json({ success: true, message: 'CDN cache invalidated — nginx reloaded.' });
    } catch (error: any) {
      logger.error(`Error invalidating cache for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to invalidate cache' });
    }
  });

  return router;
}
