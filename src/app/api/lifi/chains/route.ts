import { LiFiClient } from '@/clients/lifi';
import { errorResponse } from '@/lib/errors';
export async function GET() {
  try {
    return Response.json(await new LiFiClient().supportedChains(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
