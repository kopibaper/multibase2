import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../lib/supabaseClient.js';

const router = Router();

const TEST_BUCKET = 'test-bucket';
const TEST_FILE_NAME = 'test-file.txt';
const TEST_FILE_CONTENT = 'Hello from Multibase System Checker! 🚀 This is a test file.';

// Test 1: Create test bucket
router.post('/create-bucket', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();

    // Try to delete existing bucket first (cleanup from previous run)
    await supabase.storage.deleteBucket(TEST_BUCKET).catch(() => {});

    const { data, error } = await supabase.storage.createBucket(TEST_BUCKET, {
      public: true,
    });

    if (error) throw error;

    res.json({
      success: true,
      test: 'Create Storage Bucket',
      data: { bucket: data },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Create Storage Bucket',
      error: error.message || error,
    });
  }
});

// Test 2: Upload a test file
router.post('/upload', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();
    const fileBuffer = new TextEncoder().encode(TEST_FILE_CONTENT);

    const { data, error } = await supabase.storage
      .from(TEST_BUCKET)
      .upload(TEST_FILE_NAME, fileBuffer, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (error) throw error;

    res.json({
      success: true,
      test: 'Upload File',
      data: { path: data?.path, fullPath: data?.fullPath },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Upload File',
      error: error.message || error,
    });
  }
});

// Test 3: List files in bucket
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.storage.from(TEST_BUCKET).list('', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;

    res.json({
      success: true,
      test: 'List Files',
      data: {
        fileCount: data?.length,
        files: data?.map((f) => ({
          name: f.name,
          size: f.metadata?.size,
          mimetype: f.metadata?.mimetype,
        })),
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'List Files',
      error: error.message || error,
    });
  }
});

// Test 4: Download file and verify content
router.get('/download', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.storage.from(TEST_BUCKET).download(TEST_FILE_NAME);

    if (error) throw error;

    const text = await data.text();
    const contentMatch = text === TEST_FILE_CONTENT;

    res.json({
      success: contentMatch,
      test: 'Download & Verify File',
      data: {
        downloadedContent: text,
        expectedContent: TEST_FILE_CONTENT,
        contentMatch,
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Download & Verify File',
      error: error.message || error,
    });
  }
});

// Test 5: Get public URL
router.get('/public-url', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();
    const { data } = supabase.storage.from(TEST_BUCKET).getPublicUrl(TEST_FILE_NAME);

    res.json({
      success: !!data?.publicUrl,
      test: 'Get Public URL',
      data: { publicUrl: data?.publicUrl },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Get Public URL',
      error: error.message || error,
    });
  }
});

// Test 6: Cleanup - delete file and bucket
router.delete('/cleanup', async (_req: Request, res: Response) => {
  try {
    const supabase = await getSupabaseClient();

    // Delete file
    const { error: fileError } = await supabase.storage.from(TEST_BUCKET).remove([TEST_FILE_NAME]);

    // Empty bucket completely
    const { data: files } = await supabase.storage.from(TEST_BUCKET).list('');
    if (files && files.length > 0) {
      await supabase.storage.from(TEST_BUCKET).remove(files.map((f) => f.name));
    }

    // Delete bucket
    const { error: bucketError } = await supabase.storage.deleteBucket(TEST_BUCKET);

    if (fileError) throw fileError;
    if (bucketError) throw bucketError;

    res.json({
      success: true,
      test: 'Cleanup (Delete File + Bucket)',
      data: { deleted: true },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Cleanup (Delete File + Bucket)',
      error: error.message || error,
    });
  }
});

export default router;
