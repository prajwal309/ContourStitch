import { afterEach, describe, expect, it, vi } from 'vitest';
import { withMediaPipeStartupLogging } from '@/lib/vision/media-pipe-logging';

afterEach(() => vi.restoreAllMocks());

describe('MediaPipe startup logging', () => {
  it('routes only the XNNPACK INFO line away from the error console', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infos = vi.spyOn(console, 'info').mockImplementation(() => {});

    await withMediaPipeStartupLogging(async () => {
      console.error('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.');
      console.error('A real inference error');
    });

    expect(infos).toHaveBeenCalledWith(
      'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.',
    );
    expect(errors).toHaveBeenCalledWith('A real inference error');
    expect(console.error).toBe(errors);
  });

  it('restores console behavior and propagates initialization failures', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('Model initialization failed');

    await expect(
      withMediaPipeStartupLogging(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(console.error).toBe(errors);
  });
});
