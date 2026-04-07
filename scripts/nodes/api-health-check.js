// API Health Check — Pre-flight check before pipeline processing
// Mode: runOnceForAllItems
// Position: between Metro Config and Mark Running in main workflow
// Throws on failure to trigger Error Handler; converts silent degradation to loud failure
// Optional: skip with skip_health_check in webhook body

const items = $input.all();
const metroConfig = items[0].json;

// Allow skipping for testing
if (metroConfig.skip_health_check === 'true' || metroConfig.skip_health_check === true) {
  console.log('API Health Check: skipped (skip_health_check=true)');
  return items;
}

const checks = [];

// Apollo health check
try {
  const apollo = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://api.apollo.io/api/v1/auth/health',
    headers: { 'x-api-key': $env.APOLLO_API_KEY, 'Content-Type': 'application/json' },
    json: true,
    timeout: 5000
  });
  checks.push({ api: 'apollo', ok: true });
} catch(e) {
  checks.push({ api: 'apollo', ok: false, error: e.message });
}

// Hunter account check (returns remaining credits)
try {
  const hunter = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://api.hunter.io/v2/account?api_key=' + $env.HUNTER_API_KEY,
    json: true,
    timeout: 5000
  });
  const searches = hunter && hunter.data && hunter.data.requests && hunter.data.requests.searches;
  const remaining = searches ? searches.available : 0;
  checks.push({ api: 'hunter', ok: remaining > 50, remaining: remaining });
} catch(e) {
  checks.push({ api: 'hunter', ok: false, error: e.message });
}

// NamSor check
try {
  await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://v2.namsor.com/NamSorAPIv2/api2/json/apiUsage',
    headers: { 'X-API-KEY': $env.NAMSOR_API_KEY, 'Accept': 'application/json' },
    json: true,
    timeout: 5000
  });
  checks.push({ api: 'namsor', ok: true });
} catch(e) {
  checks.push({ api: 'namsor', ok: false, error: e.message });
}

console.log('API Health Check results: ' + JSON.stringify(checks));

const failed = checks.filter(function(c) { return !c.ok; });
if (failed.length > 0) {
  const details = failed.map(function(f) { return f.api + ': ' + (f.error || 'low credits'); }).join(', ');
  throw new Error('API pre-flight failed: ' + details);
}

console.log('API Health Check: all APIs healthy');
return items;
