import { Router, Request, Response } from 'express';
import multibase, { getInstanceName } from '../lib/multibaseClient.js';
import { getSupabaseClient, getSupabaseUrl, getAnonKey } from '../lib/supabaseClient.js';

const router = Router();

// Test 1: Get Realtime config via Multibase API
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const response = await multibase.get(`/api/instances/${instanceName}/realtime/config`);

    res.json({
      success: true,
      test: 'Realtime Config',
      data: response.data,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Realtime Config',
      error: error.response?.data || error.message,
    });
  }
});

// Test 2: Get Realtime stats via Multibase API
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const response = await multibase.get(`/api/instances/${instanceName}/realtime/stats`);

    res.json({
      success: true,
      test: 'Realtime Stats',
      data: response.data,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Realtime Stats',
      error: error.response?.data || error.message,
    });
  }
});

// Test 3: Subscribe to a channel, broadcast a message, verify reception
router.post('/subscribe-test', async (_req: Request, res: Response) => {
  const TEST_CHANNEL = '_test_checker_channel';

  try {
    const supabase = await getSupabaseClient();

    const result = await new Promise<{ success: boolean; data?: any; error?: string }>(
      (resolve) => {
        const timeout = setTimeout(() => {
          channel.unsubscribe();
          resolve({
            success: false,
            error: 'Timeout: No message received within 8 seconds',
          });
        }, 8000);

        const channel = supabase
          .channel(TEST_CHANNEL, { config: { broadcast: { self: true } } })
          .on('broadcast', { event: 'test-event' }, (payload) => {
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve({
              success: true,
              data: {
                receivedPayload: payload,
                message: 'Broadcast message received successfully',
              },
            });
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // Once subscribed, send a broadcast message
              await channel.send({
                type: 'broadcast',
                event: 'test-event',
                payload: {
                  message: 'Hello from Multibase Checker',
                  timestamp: new Date().toISOString(),
                },
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({
                success: false,
                error: `Channel subscription failed: ${status}`,
              });
            }
          });
      }
    );

    res.json({
      ...result,
      test: 'Realtime Subscribe & Broadcast',
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Realtime Subscribe & Broadcast',
      error: error.message || error,
    });
  }
});

// Test 4: Return connection info for frontend direct-connect test
router.get('/connection-info', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      test: 'Realtime Connection Info',
      data: {
        supabaseUrl: await getSupabaseUrl(),
        anonKey: await getAnonKey(),
        channelName: '_test_frontend_channel',
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'Realtime Connection Info',
      error: error.message || error,
    });
  }
});

export default router;
