import { handleMercuryActionRequest } from '@/server/mercury/actions';

export async function POST(request: Request): Promise<Response> {
  return handleMercuryActionRequest(request);
}
