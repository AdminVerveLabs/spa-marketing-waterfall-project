// Fetch Next Pending — Queue Wrapper node (q3-fetch-next)
// Mode: runOnceForAllItems
// Fetches the next pending metro from pipeline_queue and atomically claims it.
// Includes circuit breaker to stop processing when consecutive failures are detected.

const { supabase_url: url, supabase_key: key } = $input.first().json;
const headers = {
  apikey: key,
  Authorization: 'Bearer ' + key,
  'Content-Type': 'application/json'
};

// ── Circuit breaker: stop if too many recent failures ──────────────────
const CIRCUIT_BREAKER_THRESHOLD = 3; // consecutive failures in window
const CIRCUIT_BREAKER_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

const recentFailures = await this.helpers.httpRequest({
  method: 'GET',
  url: url + '/rest/v1/pipeline_runs',
  qs: {
    triggered_by: 'eq.queue_wrapper',
    status: 'eq.failed',
    created_at: 'gte.' + new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_MS).toISOString(),
    select: 'id',
    order: 'created_at.desc',
    limit: CIRCUIT_BREAKER_THRESHOLD
  },
  headers: { apikey: key, Authorization: 'Bearer ' + key },
  json: true
});

if (recentFailures && recentFailures.length >= CIRCUIT_BREAKER_THRESHOLD) {
  // Also check if there's been a recent SUCCESS — if so, the failures are intermittent, not systemic
  const recentSuccess = await this.helpers.httpRequest({
    method: 'GET',
    url: url + '/rest/v1/pipeline_runs',
    qs: {
      triggered_by: 'eq.queue_wrapper',
      status: 'eq.completed',
      created_at: 'gte.' + new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_MS).toISOString(),
      select: 'id',
      limit: 1
    },
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    json: true
  });

  if (!recentSuccess || recentSuccess.length === 0) {
    console.log('CIRCUIT BREAKER TRIPPED: ' + recentFailures.length + ' consecutive failures in last 3 hours with no successes. Pausing queue.');
    return [{ json: { hasMetro: false, message: 'Circuit breaker tripped: ' + recentFailures.length + ' consecutive failures in last 3 hours' } }];
  }
}

// ── Step 1: Find the oldest, highest-priority pending metro ────────────
const pending = await this.helpers.httpRequest({
  method: 'GET',
  url: url + '/rest/v1/pipeline_queue',
  qs: {
    status: 'eq.pending',
    or: '(retry_after.is.null,retry_after.lte.' + new Date().toISOString() + ')',
    order: 'priority.desc,queued_at.asc',
    limit: 1
  },
  headers: { apikey: key, Authorization: 'Bearer ' + key },
  json: true
});

if (!pending || pending.length === 0) {
  return [{ json: { hasMetro: false, message: 'No pending metros in queue' } }];
}

const metro = pending[0];

// ── Step 2: Atomically claim it (PATCH only succeeds if still pending) ─
const claimed = await this.helpers.httpRequest({
  method: 'PATCH',
  url: url + '/rest/v1/pipeline_queue',
  qs: {
    id: 'eq.' + metro.id,
    status: 'eq.pending'
  },
  headers: { ...headers, Prefer: 'return=representation' },
  body: {
    status: 'running',
    started_at: new Date().toISOString()
  },
  json: true
});

if (!claimed || claimed.length === 0) {
  return [{ json: { hasMetro: false, message: 'Metro claimed by another execution' } }];
}

const item = claimed[0];
return [{
  json: {
    hasMetro: true,
    queue_id: item.id,
    metro_name: item.metro_name,
    state: item.state,
    country: item.country,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    radius_meters: item.radius_meters,
    population: item.population,
    run_id: item.run_id,
    supabase_url: url,
    supabase_key: key
  }
}];
