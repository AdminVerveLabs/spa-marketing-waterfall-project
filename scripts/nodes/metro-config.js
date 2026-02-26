// Metro Config — reads from POST body (dashboard) or GET query param (legacy curl)
// Outputs: metro_name, latitude, longitude, radius_meters, search_queries, yelp_location, run_id

// Clear convergence-suppression flags from previous execution
const staticData = $getWorkflowStaticData('global');
delete staticData._collapse2_fired;
delete staticData._batch_dispatcher_fired;

// Hardcoded metro lookup — fallback for legacy GET triggers
const METROS = {
  'Austin, TX':     { latitude: '30.2672',  longitude: '-97.7431',  yelp_location: 'Austin, TX', radius_meters: '15000' },
  'Denver, CO':     { latitude: '39.7392',  longitude: '-104.9903', yelp_location: 'Denver, CO', radius_meters: '15000' },
  'Phoenix, AZ':    { latitude: '33.4484',  longitude: '-112.0740', yelp_location: 'Phoenix, AZ', radius_meters: '15000' },
  'Toronto, ON':    { latitude: '43.6532',  longitude: '-79.3832',  yelp_location: 'Toronto, ON', radius_meters: '15000' },
  'San Diego, CA':  { latitude: '32.7157',  longitude: '-117.1611', yelp_location: 'San Diego, CA', radius_meters: '15000' },
  'Boise, ID':      { latitude: '43.6150',  longitude: '-116.2023', yelp_location: 'Boise, ID', radius_meters: '25000' },
  'Portland, OR':   { latitude: '45.5152',  longitude: '-122.6784', yelp_location: 'Portland, OR', radius_meters: '15000' },
  'Nashville, TN':  { latitude: '36.1627',  longitude: '-86.7816',  yelp_location: 'Nashville, TN', radius_meters: '15000' },
  'Asheville, NC':  { latitude: '35.5951',  longitude: '-82.5515',  yelp_location: 'Asheville, NC', radius_meters: '15000' },
  'Sedona, AZ':     { latitude: '34.8697',  longitude: '-111.7610', yelp_location: 'Sedona, AZ', radius_meters: '15000' },
  'Scottsdale, AZ': { latitude: '33.4942',  longitude: '-111.9261', yelp_location: 'Scottsdale, AZ', radius_meters: '15000' },
  'Tampa, FL':      { latitude: '27.9506',  longitude: '-82.4572',  yelp_location: 'Tampa, FL', radius_meters: '15000' },
  // Rural / small markets (40km radius)
  'Price, UT':       { latitude: '39.5994',  longitude: '-110.8107', yelp_location: 'Price, UT', radius_meters: '40000' },
  'Sterling, CO':    { latitude: '40.6255',  longitude: '-103.2078', yelp_location: 'Sterling, CO', radius_meters: '40000' },
  'Vernal, UT':      { latitude: '40.4555',  longitude: '-109.5287', yelp_location: 'Vernal, UT', radius_meters: '40000' },
  'Riverton, WY':    { latitude: '42.8616',  longitude: '-108.3801', yelp_location: 'Riverton, WY', radius_meters: '40000' },
  'Scottsbluff, NE': { latitude: '41.8666',  longitude: '-103.6672', yelp_location: 'Scottsbluff, NE', radius_meters: '40000' },
  'Lewistown, MT':   { latitude: '47.0494',  longitude: '-109.4281', yelp_location: 'Lewistown, MT', radius_meters: '40000' },
  'Alice, TX':       { latitude: '27.7523',  longitude: '-98.0697',  yelp_location: 'Alice, TX', radius_meters: '40000' },
  'Elko, NV':        { latitude: '40.8324',  longitude: '-115.7631', yelp_location: 'Elko, NV', radius_meters: '40000' },
  'Durango, CO':     { latitude: '37.2753',  longitude: '-107.8801', yelp_location: 'Durango, CO', radius_meters: '40000' },
  'Clovis, NM':      { latitude: '34.4048',  longitude: '-103.2052', yelp_location: 'Clovis, NM', radius_meters: '40000' },
  // Resort / small-town markets (40km radius)
  'Hot Springs, AR':        { latitude: '34.5037',  longitude: '-93.0552',  yelp_location: 'Hot Springs, AR', radius_meters: '40000' },
  'Steamboat Springs, CO':  { latitude: '40.4850',  longitude: '-106.8317', yelp_location: 'Steamboat Springs, CO', radius_meters: '40000' },
  'Jackson, WY':            { latitude: '43.4799',  longitude: '-110.7624', yelp_location: 'Jackson, WY', radius_meters: '40000' },
  'Taos, NM':               { latitude: '36.4072',  longitude: '-105.5731', yelp_location: 'Taos, NM', radius_meters: '40000' },
  'Ashland, OR':             { latitude: '42.1946',  longitude: '-122.7095', yelp_location: 'Ashland, OR', radius_meters: '40000' },
};

const DEFAULT_QUERIES = 'massage therapy,massage clinic,massage therapist,spa massage,therapeutic massage,deep tissue massage,sports massage,bodywork,day spa,wellness spa,relaxation massage,licensed massage therapist';

const webhookData = $('Webhook').first().json;

// Try POST body first (dashboard sends JSON body)
const postBody = webhookData.body || {};
const queryParams = webhookData.query || {};

let metroName = postBody.metro_name || queryParams.metro_name || '';
let runId = postBody.run_id || null;
let latitude = postBody.latitude || null;
let longitude = postBody.longitude || null;
let radiusMeters = postBody.radius_meters || null;
let searchQueries = postBody.search_queries || null;
let yelpLocation = postBody.yelp_location || null;

if (!metroName) {
  throw new Error('Missing metro_name. POST JSON body with metro_name, or use GET ?metro_name=City, ST');
}

// If dashboard provided full config, use it directly
if (latitude && longitude) {
  console.log(`Metro Config: using dashboard-provided config for "${metroName}" (run_id: ${runId || 'none'})`);

  // search_queries may be a comma-separated string or already correct
  const queries = typeof searchQueries === 'string' ? searchQueries : DEFAULT_QUERIES;

  return [{
    json: {
      metro_name: metroName,
      latitude: String(latitude),
      longitude: String(longitude),
      radius_meters: String(radiusMeters || '15000'),
      search_queries: queries,
      yelp_location: yelpLocation || metroName,
      run_id: runId
    }
  }];
}

// Fallback: legacy GET trigger with hardcoded lookup
const metro = METROS[metroName];
if (!metro) {
  const available = Object.keys(METROS).join(', ');
  throw new Error(`Unknown metro: "${metroName}". Available: ${available}`);
}

console.log(`Metro Config: using hardcoded lookup for "${metroName}" (legacy GET, no run_id)`);

return [{
  json: {
    metro_name: metroName,
    latitude: metro.latitude,
    longitude: metro.longitude,
    radius_meters: metro.radius_meters,
    search_queries: DEFAULT_QUERIES,
    yelp_location: metro.yelp_location,
    run_id: null
  }
}];
