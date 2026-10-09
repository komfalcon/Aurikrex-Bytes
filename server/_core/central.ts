import { createRemoteJWKSet, jwtVerify } from 'jose';

const CENTRAL_API_URL = process.env.CENTRAL_API_URL || 'https://aurikrex-central.pxxl.click';
const S2S_SECRET = process.env.AURIKREX_CENTRAL_S2S_SECRET || '';


const jwksUrl = new URL(`${CENTRAL_API_URL}/.well-known/jwks.json`);
const JWKS = createRemoteJWKSet(jwksUrl);

export async function verifyCentralToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
    });
    return payload;
  } catch (err) {
    console.error('Failed to verify central token:', err);
    return null;
  }
}

export async function deductCoins(userId: string | number, appId: string = 'aurikrex_bytes', featureName: string = 'ai_summary') {
  try {
    const response = await fetch(`${CENTRAL_API_URL}/api/v1/coins/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Central-Api-Key': S2S_SECRET,
      },
      body: JSON.stringify({
        userId: String(userId),
        appId,
        featureName,
        idempotencyKey: `bytes_${featureName}_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Coin deduction failed:', response.status, errorText);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Coin deduction error:', error);
    return null;
  }
}
