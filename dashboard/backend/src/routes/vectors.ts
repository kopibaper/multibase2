import { Router } from 'express';
import { VectorService } from '../services/VectorService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

export function createVectorRoutes(vectorService: VectorService) {
  const router = Router({ mergeParams: true });

  // Extension status
  router.get('/status', requireAuth, requireScope(SCOPES.VECTORS.READ), async (req, res) => {
    try {
      const status = await vectorService.getStatus(req.params.name);
      return res.json(status);
    } catch (error: any) {
      logger.error(`Error getting vector status for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Enable pgvector extension
  router.post('/enable', requireAuth, requireScope(SCOPES.VECTORS.WRITE), async (req, res) => {
    try {
      const result = await vectorService.enableExtension(req.params.name);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error enabling pgvector for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // List vector columns
  router.get('/columns', requireAuth, requireScope(SCOPES.VECTORS.READ), async (req, res) => {
    try {
      const columns = await vectorService.listVectorColumns(req.params.name);
      return res.json({ columns });
    } catch (error: any) {
      logger.error(`Error listing vector columns for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Add a vector column
  router.post('/columns', requireAuth, requireScope(SCOPES.VECTORS.WRITE), async (req, res) => {
    try {
      const { tableSchema, tableName, columnName, dimension } = req.body;
      if (!tableName || !columnName || !dimension) {
        return res.status(400).json({ error: 'tableName, columnName, and dimension are required' });
      }
      const result = await vectorService.addVectorColumn(req.params.name, {
        tableSchema: tableSchema || 'public',
        tableName,
        columnName,
        dimension: parseInt(dimension, 10),
      });
      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error adding vector column for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // List vector indexes
  router.get('/indexes', requireAuth, requireScope(SCOPES.VECTORS.READ), async (req, res) => {
    try {
      const indexes = await vectorService.listIndexes(req.params.name);
      return res.json({ indexes });
    } catch (error: any) {
      logger.error(`Error listing vector indexes for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Create a vector index
  router.post('/indexes', requireAuth, requireScope(SCOPES.VECTORS.WRITE), async (req, res) => {
    try {
      const { tableSchema, tableName, columnName, indexType, metric, lists } = req.body;
      if (!tableName || !columnName || !indexType || !metric) {
        return res.status(400).json({ error: 'tableName, columnName, indexType, and metric are required' });
      }
      const result = await vectorService.createIndex(req.params.name, {
        tableSchema: tableSchema || 'public',
        tableName,
        columnName,
        indexType,
        metric,
        lists,
      });
      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error creating vector index for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Drop a vector index
  router.delete('/indexes/:indexName', requireAuth, requireScope(SCOPES.VECTORS.WRITE), async (req, res) => {
    try {
      const result = await vectorService.dropIndex(req.params.name, req.params.indexName);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error dropping vector index ${req.params.indexName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Similarity search
  router.post('/search', requireAuth, requireScope(SCOPES.VECTORS.READ), async (req, res) => {
    try {
      const { tableSchema, tableName, columnName, vector, k, metric } = req.body;
      if (!tableName || !columnName || !vector || !k) {
        return res.status(400).json({ error: 'tableName, columnName, vector, and k are required' });
      }
      const results = await vectorService.similaritySearch(req.params.name, {
        tableSchema: tableSchema || 'public',
        tableName,
        columnName,
        vector,
        k: parseInt(k, 10),
        metric: metric || 'cosine',
      });
      return res.json({ results });
    } catch (error: any) {
      logger.error(`Error running similarity search for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
