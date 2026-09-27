import type { NextConfig } from 'next';
const isDev=process.env.NODE_ENV==='development';
// Next's bootstrap uses inline scripts; WASM needs wasm-unsafe-eval, not general eval in production.
const csp=["default-src 'self'",`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'","connect-src 'self'","media-src 'self' blob:","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","frame-ancestors 'none'","form-action 'self'"].join('; ');
const nextConfig:NextConfig={async headers(){return [{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:csp},{key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=()'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Content-Type-Options',value:'nosniff'}]}];}};
export default nextConfig;
