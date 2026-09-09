import { handleMercuryActionRequest } from '@/server/mercury/actions';

export async function POST(request: Request): Promise<Response> {
  const response = await handleMercuryActionRequest(request);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
