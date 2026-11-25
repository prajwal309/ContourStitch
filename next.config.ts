import type { NextConfig } from 'next';
const isDev = process.env.NODE_ENV === 'development';
// Next's bootstrap uses inline scripts; WASM needs wasm-unsafe-eval, not general eval in production.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/models/quaternius-female/mannequin-v1.bin',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      ...['/sign-in', '/my-measurements', '/account'].map((source) => ({
        source,
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `${csp} https://accounts.google.com https://www.facebook.com`,
          },
        ],
      })),
    ];
  },
};
export default nextConfig;
