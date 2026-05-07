// T013 — KRX Open API data fetcher (Korean Futures)
// KRX Open API: https://openapi.krx.co.kr
//
// TODO: The KRX Open API requires institutional registration and a specific
// application process. The endpoint structure for OHLCV data is:
//   POST https://openapi.krx.co.kr/contents/COM/GenerateOTP.jspx  (get OTP)
//   POST https://openapi.krx.co.kr/contents/SRT/...               (actual data)
//
// Until the exact endpoint paths and request format are confirmed, this
// implementation returns mock data for development and falls back gracefully.
// Replace the TODO sections with the real API calls once credentials are
// obtained and the endpoint structure is confirmed.

import https from 'https';
import type { Candle } from '../types';

// SSL workaround for environments with cert issues (development only)
const agent =
  process.env.NODE_ENV !== 'production'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

const KRX_BASE_URL = 'https://openapi.krx.co.kr';

/**
 * Generate mock OHLCV data for a given date range.
 * Used as fallback when real API is unavailable.
 */
function generateMockCandles(
  symbol: string,
  startDate: string,
  endDate: string
): Candle[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const candles: Candle[] = [];

  // Base price varies by symbol (for realism)
  const basePrice = symbol.startsWith('101') ? 350000 : 100000;
  let price = basePrice;

  const oneDayMs = 86400000;
  let cursor = start;

  while (cursor <= end) {
    const date = new Date(cursor);
    // Skip weekends (0=Sunday, 6=Saturday)
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const change = (Math.random() - 0.5) * basePrice * 0.02;
      price = Math.max(basePrice * 0.5, price + change);
      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);

      candles.push({
        timestamp: cursor,
        open: Math.round(price),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(price + (Math.random() - 0.5) * basePrice * 0.005),
        volume: Math.round(Math.random() * 10000 + 1000),
      });
    }
    cursor += oneDayMs;
  }

  return candles;
}

/**
 * Attempt to fetch OHLCV from KRX Open API.
 *
 * TODO: Replace this stub with real KRX API calls once the endpoint
 * structure and authentication flow are confirmed.
 *
 * KRX API authentication requires:
 * 1. Register at https://openapi.krx.co.kr
 * 2. Obtain an API key (KRX_API_KEY)
 * 3. Call the OTP generation endpoint first
 * 4. Use OTP in the actual data request
 *
 * Typical KRX data endpoints (subject to change — verify with official docs):
 * - Futures daily OHLCV: /contents/GLB/000001/0001/.../download.jspx
 *
 * @param symbol    e.g. "101C6000" (KOSPI200 futures contract code)
 * @param startDate ISO date string "YYYY-MM-DD"
 * @param endDate   ISO date string "YYYY-MM-DD"
 */
export async function fetchOHLCV(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<Candle[]> {
  const apiKey = process.env.KRX_API_KEY;

  if (!apiKey) {
    console.warn(
      '[KRX] KRX_API_KEY not set — returning mock data for development'
    );
    return generateMockCandles(symbol, startDate, endDate);
  }

  try {
    // TODO: Step 1 — Generate OTP token
    // The KRX API requires an OTP handshake before each data request.
    // Uncomment and fill in the correct endpoint once confirmed:
    //
    // const otpResponse = await fetch(`${KRX_BASE_URL}/contents/COM/GenerateOTP.jspx`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: new URLSearchParams({
    //     code: 'MKD_13_1_1_1',  // TODO: confirm correct code for futures OHLCV
    //     apikey: apiKey,
    //   }),
    //   // @ts-expect-error — agent for SSL override
    //   agent,
    // });
    // const otp = await otpResponse.text();

    // TODO: Step 2 — Fetch actual data using OTP
    // const dataResponse = await fetch(`${KRX_BASE_URL}/contents/SRT/...`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: new URLSearchParams({
    //     code: otp,
    //     isuCd: symbol,
    //     strtDd: startDate.replace(/-/g, ''),
    //     endDd: endDate.replace(/-/g, ''),
    //   }),
    //   // @ts-expect-error — agent for SSL override
    //   agent,
    // });
    // const data = await dataResponse.json();
    // return parseKrxResponse(data);

    // Until the above TODOs are implemented, return mock data
    console.warn(
      '[KRX] Real API integration not yet implemented — returning mock data'
    );
    return generateMockCandles(symbol, startDate, endDate);
  } catch (error) {
    console.error('[KRX] API call failed, falling back to mock data:', error);
    return generateMockCandles(symbol, startDate, endDate);
  }
}

// Suppress unused import warning — agent is referenced in TODO comments
void agent;
void KRX_BASE_URL;
