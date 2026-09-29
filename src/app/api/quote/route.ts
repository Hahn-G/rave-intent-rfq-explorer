import { z } from 'zod';
import { getQuote } from '@/services/quote';
import { errorResponse, QuoteError } from '@/lib/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 8192)
      throw new QuoteError('INVALID_INPUT', 'Request body is too large.', 413);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new QuoteError('INVALID_INPUT', 'Request body must be valid JSON.');
    }
    const parsed = z
      .object({ intent: z.unknown(), mode: z.enum(['live', 'mock']).default('live') })
      .strict()
      .safeParse(json);
    if (!parsed.success)
      throw new QuoteError('INVALID_INPUT', 'Expected { intent, mode: "live" | "mock" }.');
    return Response.json(
      await getQuote(parsed.data.intent, parsed.data.mode, process.env.BEBOP_API_KEY?.trim()),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
