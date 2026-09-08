import { billingErrorResponse } from '@/server/billing/errors';
import { processStripeWebhook } from '@/server/billing/stripe-service';

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get('stripe-signature');
    return Response.json(await processStripeWebhook(rawBody, signature));
  } catch (error) {
    return billingErrorResponse(error);
  }
}