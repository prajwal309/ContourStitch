import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:3000';
const runs = Number(process.argv[3] ?? 5);
const browser = await chromium.launch({
  args: ['--enable-precise-memory-info'],
});

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

try {
  const results = [];
  for (let run = 0; run < runs; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const stats = {
          firstDraw: null,
          frames: 0,
          calls: 0,
          bufferBytes: 0,
          sampling: false,
        };
        window.mannequinBenchmark = stats;
        let framePending = false;
        const pendingBuffer = new WeakMap();
        const bufferSizes = new WeakMap();
        const deletedBuffers = new WeakSet();
        const boundBuffers = new WeakMap();
        for (const { prototype } of [WebGL2RenderingContext]) {
          const bind = prototype.bindBuffer;
          prototype.bindBuffer = function (...args) {
            let targets = boundBuffers.get(this);
            if (!targets) {
              targets = new Map();
              boundBuffers.set(this, targets);
            }
            targets.set(args[0], args[1]);
            return bind.apply(this, args);
          };
          const upload = prototype.bufferData;
          prototype.bufferData = function (...args) {
            const buffer = boundBuffers.get(this)?.get(args[0]);
            const data = args[1];
            if (buffer && data != null) {
              const size = typeof data === 'number' ? data : data.byteLength;
              if (size !== undefined) {
                stats.bufferBytes += size - (bufferSizes.get(buffer) ?? 0);
                bufferSizes.set(buffer, size);
                if (args[0] === this.ELEMENT_ARRAY_BUFFER)
                  pendingBuffer.set(this, buffer);
              }
            }
            return upload.apply(this, args);
          };
          const remove = prototype.deleteBuffer;
          prototype.deleteBuffer = function (buffer) {
            if (buffer && !deletedBuffers.has(buffer)) {
              stats.bufferBytes -= bufferSizes.get(buffer) ?? 0;
              deletedBuffers.add(buffer);
            }
            return remove.call(this, buffer);
          };
          for (const name of ['drawArrays', 'drawElements']) {
            const draw = prototype[name];
            prototype[name] = function (...args) {
              if (
                stats.firstDraw === null &&
                args[0] === this.TRIANGLES &&
                pendingBuffer.has(this)
              )
                stats.firstDraw = performance.now();
              if (stats.sampling) {
                stats.calls += 1;
                if (!framePending) {
                  framePending = true;
                  stats.frames += 1;
                  queueMicrotask(() => {
                    framePending = false;
                  });
                }
              }
              return draw.apply(this, args);
            };
          }
        }
      });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.demo-stage').scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => window.mannequinBenchmark.firstDraw !== null,
        null,
        { timeout: 20000 },
      );
      const cdp = await context.newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = await cdp.send('Runtime.getHeapUsage');
      const samples = await page.evaluate(async () => {
        const stats = window.mannequinBenchmark;
        const resource = performance
          .getEntriesByType('resource')
          .filter((entry) =>
            /\/models\/quaternius-female\//.test(new URL(entry.name).pathname),
          );
        const time = performance.now();
        stats.sampling = true;
        await new Promise((resolve) => setTimeout(resolve, 4200));
        stats.sampling = false;
        return {
          firstDrawMs: stats.firstDraw,
          assetRequests: resource.length,
          assetsReadyMs: Math.max(
            ...resource.map(({ responseEnd }) => responseEnd),
          ),

          assetBytes: resource.reduce(
            (total, entry) => total + entry.encodedBodySize,
            0,
          ),
          webglBufferBytes: stats.bufferBytes,
          drawCallsPerFrame: stats.calls / stats.frames,
          fps: (stats.frames * 1000) / (performance.now() - time),
        };
      });
      results.push({ ...samples, pageHeapBytes: heap.usedSize });
    } finally {
      await context.close();
    }
  }
  console.log(
    JSON.stringify(
      {
        browser: browser.version(),
        median: Object.fromEntries(
          Object.keys(results[0]).map((key) => [
            key,
            median(results.map((run) => run[key])),
          ]),
        ),
        runs: results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
