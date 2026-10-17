import { createRemoteJWKSet, jwtVerify } from 'jose';

const CENTRAL_API_URL = process.env.CENTRAL_API_URL || 'https://aurikrex-central.pxxl.click';
const getS2sSecret = () => process.env.AURIKREX_CENTRAL_S2S_SECRET || '';


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

export async function getCoinBalance(userId: string | number) {
  const s2sSecret = getS2sSecret();
  try {
    const response = await fetch(
      `${CENTRAL_API_URL}/api/v1/coins/balance?userId=${encodeURIComponent(String(userId))}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(s2sSecret ? { 'X-Central-Api-Key': s2sSecret } : {}),
        },
      },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('Coin balance fetch error:', error);
    return null;
  }
}

export async function deductCoins(userId: string | number, appId: string = 'aurikrex_bytes', featureName: string = 'ai_summary') {
  const s2sSecret = getS2sSecret();
  if (!s2sSecret) {
    console.warn('[Central] AURIKREX_CENTRAL_S2S_SECRET is not configured');
    return null;
  }
  try {
    const response = await fetch(`${CENTRAL_API_URL}/api/v1/coins/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Central-Api-Key': s2sSecret,
      },
      body: JSON.stringify({
        userId: String(userId),
        appId,
        featureName,
        idempotencyKey: `bytes_${featureName}_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      }),
    });

    if (response.status === 402) {
      const errData = await response.json().catch(() => ({}));
      return { error: true, status: 402, code: 'OUT_OF_COINS', remainingCoins: errData?.currentBalance ?? 0 };
    }

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
