import { toast } from 'sonner';

interface WebhookPayload {
  run_id: string;
  metro_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  search_queries: string[];
  yelp_location: string;
  country: string;
  state: string;
  city: string;
}

export async function triggerPipelineRun(payload: WebhookPayload): Promise<void> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('VITE_N8N_WEBHOOK_URL not set — skipping webhook trigger');
    toast.info('Run queued — webhook not configured yet');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        latitude: String(payload.latitude),
        longitude: String(payload.longitude),
        radius_meters: String(payload.radius_meters),
        search_queries: payload.search_queries.join(','),
      }),
    });
  } catch (err) {
    console.error('Webhook trigger failed:', err);
    toast.error('Failed to trigger pipeline — run is still queued');
  }
}
