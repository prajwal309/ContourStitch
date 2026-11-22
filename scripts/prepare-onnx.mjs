import { mkdir, copyFile, readdir } from 'node:fs/promises';
const source = new URL(
  '../node_modules/onnxruntime-web/dist/',
  import.meta.url,
);
const destination = new URL('../public/models/onnx/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of await readdir(source))
  if (
    name.startsWith('ort-wasm-simd-threaded') &&
    (name.endsWith('.wasm') || name.endsWith('.mjs'))
  )
    await copyFile(new URL(name, source), new URL(name, destination));
