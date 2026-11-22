// Imported only by Playwright's disposable-database run.
import { createSign, generateKeyPairSync } from 'node:crypto';

const upstream = globalThis.fetch;
const google = 'https://accounts.google.com';
const googleToken = 'https://oauth2.googleapis.com/token';
const googleKeys = 'https://www.googleapis.com/oauth2/v3/certs';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const keyId = 'test-key';

function identity(code) {
  const [run, user, provider] = code.split(':');
  return {
    id: `${run}-${user}-${provider}`,
    email: `${run}-${user}@example.test`,
    name: `Test ${user}`,
  };
}

function googleIdToken(profile) {
  const json = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = [
    json({ alg: 'RS256', kid: keyId }),
    json({
      iss: google,
      aud: process.env.AUTH_GOOGLE_ID,
      iat: now,
      exp: now + 300,
      sub: profile.id,
      email: profile.email,
      email_verified: true,
      name: profile.name,
    }),
  ].join('.');
  const signature = createSign('RSA-SHA256')
    .update(body)
    .sign(privateKey, 'base64url');
  return `${body}.${signature}`;
}

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);

  if (url.href === `${google}/.well-known/openid-configuration`) {
    return Response.json({
      issuer: google,
      authorization_endpoint: `${google}/o/oauth2/v2/auth`,
      token_endpoint: googleToken,
      userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwks_uri: googleKeys,
      code_challenge_methods_supported: ['S256'],
      id_token_signing_alg_values_supported: ['RS256'],
    });
  }
  if (url.href === googleKeys) {
    return Response.json({
      keys: [
        {
          ...publicKey.export({ format: 'jwk' }),
          kid: keyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    });
  }
  if (url.href === googleToken) {
    const body =
      input instanceof Request ? await input.clone().text() : init?.body;
    const code = new URLSearchParams(body).get('code');
    return Response.json({
      access_token: code,
      token_type: 'Bearer',
      id_token: googleIdToken(identity(code)),
    });
  }
  if (
    url.origin === 'https://graph.facebook.com' &&
    url.pathname.endsWith('/oauth/access_token')
  ) {
    const body =
      input instanceof Request ? await input.clone().text() : init?.body;
    const code = new URLSearchParams(body).get('code');
    return Response.json({ access_token: code, token_type: 'Bearer' });
  }
  if (
    url.origin === 'https://graph.facebook.com' &&
    url.pathname.endsWith('/me')
  ) {
    const headers = new Headers(
      input instanceof Request ? input.headers : init?.headers,
    );
    const code = headers.get('authorization')?.replace(/^Bearer /, '');
    return Response.json(identity(code));
  }
  return upstream(input, init);
};
