import type { VisionFrame } from '@/lib/vision/types';
import { observeFrame } from './observe';

self.addEventListener('message', (event: MessageEvent<VisionFrame>) => {
  self.postMessage(observeFrame(event.data));
});
