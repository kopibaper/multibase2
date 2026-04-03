import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import multibase, { getInstanceName } from '../lib/multibaseClient.js';

const router = Router();

const TEST_TABLE = '_test_items';

// Test 1: Create test table via Multibase SQL execution
router.post('/create-table', async (_req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const sql = `
      CREATE TABLE IF NOT EXISTS public.${TEST_TABLE} (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        value TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Enable RLS but allow all for testing
      ALTER TABLE public.${TEST_TABLE} ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_all_${TEST_TABLE}" ON public.${TEST_TABLE};
      CREATE POLICY "allow_all_${TEST_TABLE}" ON public.${TEST_TABLE}
        FOR ALL USING (true) WITH CHECK (true);
    `;
    const response = await multibase.post(`/api/instances/${instanceName}/sql`, { sql });
    res.json({
      success: true,
      test: 'Create Test Table',
      data: response.data,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Create Test Table',
      error: error.response?.data || error.message,
    });
  }
});

// Test 2: Insert data via Supabase Client
router.post('/insert', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TEST_TABLE)
      .insert([
        { name: 'Test Item 1', value: 'Hello from Multibase Checker' },
        { name: 'Test Item 2', value: 'Integration test data' },
        { name: 'Test Item 3', value: `Timestamp: ${new Date().toISOString()}` },
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      test: 'Insert Data',
      data: { insertedRows: data?.length, rows: data },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Insert Data',
      error: error.message || error,
    });
  }
});

// Test 3: Read data via Supabase Client
router.get('/read', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error, count } = await supabase
      .from(TEST_TABLE)
      .select('*', { count: 'exact' })
      .order('id', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      test: 'Read Data',
      data: { totalRows: count, rows: data },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Read Data',
      error: error.message || error,
    });
  }
});

// Test 4: Update data via Supabase Client
router.put('/update', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();

    // First get an item to update
    const { data: items } = await supabase.from(TEST_TABLE).select('id').limit(1).single();

    if (!items) throw new Error('No items found to update');

    const { data, error } = await supabase
      .from(TEST_TABLE)
      .update({ value: `Updated at ${new Date().toISOString()}` })
      .eq('id', items.id)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      test: 'Update Data',
      data: { updatedRow: data?.[0] },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Update Data',
      error: error.message || error,
    });
  }
});

// Test 5: Delete data via Supabase Client
router.delete('/delete', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();

    // Delete only one row
    const { data: items } = await supabase.from(TEST_TABLE).select('id').limit(1).single();

    if (!items) throw new Error('No items found to delete');

    const { data, error } = await supabase.from(TEST_TABLE).delete().eq('id', items.id).select();

    if (error) throw error;

    res.json({
      success: true,
      test: 'Delete Data',
      data: { deletedRow: data?.[0] },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Delete Data',
      error: error.message || error,
    });
  }
});

// Test 6: Cleanup - drop test table
router.delete('/cleanup', async (_req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const sql = `DROP TABLE IF EXISTS public.${TEST_TABLE} CASCADE;`;
    const response = await multibase.post(`/api/instances/${instanceName}/sql`, { sql });
    res.json({
      success: true,
      test: 'Cleanup (Drop Table)',
      data: response.data,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Cleanup (Drop Table)',
      error: error.response?.data || error.message,
    });
  }
});

export default router;
