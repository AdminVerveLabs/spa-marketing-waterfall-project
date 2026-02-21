// Clear convergence-suppression flag from previous execution
// Batch Dispatcher replaces Collapse to Single2 in the parallelized architecture
const staticData = $getWorkflowStaticData('global');
delete staticData._collapse2_fired;
delete staticData._batch_dispatcher_fired;

// Dynamic Metro Config — reads metro_name from webhook query parameter
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
};

const webhookData = $('Webhook').first().json;
const metroName = (webhookData.query && webhookData.query.metro_name) || '';

if (!metroName) {
  throw new Error('Missing required query parameter: metro_name. Use ?metro_name=City, ST');
}

const metro = METROS[metroName];
if (!metro) {
  const available = Object.keys(METROS).join(', ');
  throw new Error(`Unknown metro: "${metroName}". Available: ${available}`);
}

return [{
  json: {
    metro_name: metroName,
    latitude: metro.latitude,
    longitude: metro.longitude,
    radius_meters: metro.radius_meters,
    search_queries: 'massage therapy,massage clinic,massage therapist,spa massage,therapeutic massage,deep tissue massage,sports massage,bodywork,day spa,wellness spa,relaxation massage,licensed massage therapist',
    yelp_location: metro.yelp_location
  }
}];
