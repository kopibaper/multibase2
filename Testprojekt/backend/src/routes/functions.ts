import { Router, Request, Response } from 'express';
import multibase, { getInstanceName } from '../lib/multibaseClient.js';
import axios from 'axios';

const router = Router();

// Test 1: List edge functions via Multibase API
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const response = await multibase.get(`/api/instances/${instanceName}/functions`);
    const functions = response.data?.functions || response.data || [];

    res.json({
      success: true,
      test: 'List Edge Functions',
      data: {
        functionCount: Array.isArray(functions) ? functions.length : 0,
        functions,
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'List Edge Functions',
      error: error.response?.data || error.message,
    });
  }
});

// Test 2: Invoke an edge function
router.post('/invoke', async (req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const functionName = req.body?.functionName || 'main';
    const payload = req.body?.payload || { name: 'Multibase Tester' };

    // Invoke via Multibase API
    const response = await multibase.post(
      `/api/instances/${instanceName}/functions/${functionName}/invoke`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    res.json({
      success: true,
      test: `Invoke Function (${functionName})`,
      data: response.data,
    });
  } catch (error: any) {
    // Also try direct invocation via Supabase URL
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:4645';
      const anonKey = process.env.SUPABASE_ANON_KEY || '';
      const functionName = req.body?.functionName || 'main';
      const payload = req.body?.payload || { name: 'Multibase Tester' };

      const directResponse = await axios.post(
        `${supabaseUrl}/functions/v1/${functionName}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          timeout: 15000,
        }
      );

      res.json({
        success: true,
        test: `Invoke Function (${functionName}) [direct]`,
        data: directResponse.data,
      });
    } catch (directError: any) {
      res.json({
        success: false,
        test: 'Invoke Edge Function',
        error: error.response?.data || error.message,
        directError: directError.response?.data || directError.message,
      });
    }
  }
});

// Test 3: Get function logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const functionName = (req.query.functionName as string) || 'main';
    const response = await multibase.get(
      `/api/instances/${instanceName}/functions/${functionName}/logs`
    );

    res.json({
      success: true,
      test: `Function Logs (${functionName})`,
      data: response.data,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Function Logs',
      error: error.response?.data || error.message,
    });
  }
});

export default router;
