import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mcpRoutes from './routes/mcp.js';
import databaseRoutes from './routes/database.js';
import storageRoutes from './routes/storage.js';
import functionsRoutes from './routes/functions.js';
import realtimeRoutes from './routes/realtime.js';
import { initSupabaseClient } from './lib/supabaseClient.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'multibase-system-checker',
    timestamp: new Date().toISOString(),
    config: {
      multibaseApi: process.env.MULTIBASE_API_URL || 'http://localhost:3001',
      instanceName: process.env.INSTANCE_NAME || 'dein-project',
      supabaseUrl: process.env.SUPABASE_URL || '(not set)',
    },
  });
});

// Test routes
app.use('/api/tests/mcp', mcpRoutes);
app.use('/api/tests/db', databaseRoutes);
app.use('/api/tests/storage', storageRoutes);
app.use('/api/tests/functions', functionsRoutes);
app.use('/api/tests/realtime', realtimeRoutes);

app.listen(PORT, async () => {
  console.log(`\n🧪 Multibase System Checker Backend`);
  console.log(`   Server:    http://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/api/health`);
  console.log(`   Multibase: ${process.env.MULTIBASE_API_URL || 'http://localhost:3001'}`);
  console.log(`   Instance:  ${process.env.INSTANCE_NAME || 'dein-project'}`);
  console.log(`   Supabase:  [fetching from Multibase API...]`);

  // Pre-warm Supabase credentials from Multibase API
  try {
    await initSupabaseClient();
    console.log(`   Status:    ✅ Ready\n`);
  } catch (err: any) {
    console.warn(`   Status:    ⚠️  Supabase credentials not pre-loaded: ${err.message}`);
    console.warn(`   (Will retry on first request)\n`);
  }
});
