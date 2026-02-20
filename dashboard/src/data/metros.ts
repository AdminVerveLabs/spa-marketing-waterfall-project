import type { MetroData } from '@/types';

export const METROS: MetroData = {
  US: {
    AL: { name: "Alabama", cities: [
      { city: "Birmingham", lat: 33.5207, lng: -86.8025, metro_name: "Birmingham, AL", yelp_location: "Birmingham, AL" },
    ]},
    AZ: { name: "Arizona", cities: [
      { city: "Phoenix", lat: 33.4484, lng: -112.074, metro_name: "Phoenix, AZ", yelp_location: "Phoenix, AZ" },
      { city: "Tucson", lat: 32.2226, lng: -110.9747, metro_name: "Tucson, AZ", yelp_location: "Tucson, AZ" },
      { city: "Scottsdale", lat: 33.4942, lng: -111.9261, metro_name: "Scottsdale, AZ", yelp_location: "Scottsdale, AZ" },
    ]},
    CA: { name: "California", cities: [
      { city: "Los Angeles", lat: 34.0522, lng: -118.2437, metro_name: "Los Angeles, CA", yelp_location: "Los Angeles, CA" },
      { city: "San Francisco", lat: 37.7749, lng: -122.4194, metro_name: "San Francisco, CA", yelp_location: "San Francisco, CA" },
      { city: "San Diego", lat: 32.7157, lng: -117.1611, metro_name: "San Diego, CA", yelp_location: "San Diego, CA" },
      { city: "San Jose", lat: 37.3382, lng: -121.8863, metro_name: "San Jose, CA", yelp_location: "San Jose, CA" },
      { city: "Sacramento", lat: 38.5816, lng: -121.4944, metro_name: "Sacramento, CA", yelp_location: "Sacramento, CA" },
    ]},
    CO: { name: "Colorado", cities: [
      { city: "Denver", lat: 39.7392, lng: -104.9903, metro_name: "Denver, CO", yelp_location: "Denver, CO" },
      { city: "Colorado Springs", lat: 38.8339, lng: -104.8214, metro_name: "Colorado Springs, CO", yelp_location: "Colorado Springs, CO" },
    ]},
    CT: { name: "Connecticut", cities: [
      { city: "Hartford", lat: 41.7658, lng: -72.6734, metro_name: "Hartford, CT", yelp_location: "Hartford, CT" },
    ]},
    FL: { name: "Florida", cities: [
      { city: "Miami", lat: 25.7617, lng: -80.1918, metro_name: "Miami, FL", yelp_location: "Miami, FL" },
      { city: "Orlando", lat: 28.5383, lng: -81.3792, metro_name: "Orlando, FL", yelp_location: "Orlando, FL" },
      { city: "Tampa", lat: 27.9506, lng: -82.4572, metro_name: "Tampa, FL", yelp_location: "Tampa, FL" },
      { city: "Jacksonville", lat: 30.3322, lng: -81.6557, metro_name: "Jacksonville, FL", yelp_location: "Jacksonville, FL" },
      { city: "Fort Lauderdale", lat: 26.1224, lng: -80.1373, metro_name: "Fort Lauderdale, FL", yelp_location: "Fort Lauderdale, FL" },
    ]},
    GA: { name: "Georgia", cities: [
      { city: "Atlanta", lat: 33.749, lng: -84.388, metro_name: "Atlanta, GA", yelp_location: "Atlanta, GA" },
    ]},
    HI: { name: "Hawaii", cities: [
      { city: "Honolulu", lat: 21.3069, lng: -157.8583, metro_name: "Honolulu, HI", yelp_location: "Honolulu, HI" },
    ]},
    IL: { name: "Illinois", cities: [
      { city: "Chicago", lat: 41.8781, lng: -87.6298, metro_name: "Chicago, IL", yelp_location: "Chicago, IL" },
    ]},
    IN: { name: "Indiana", cities: [
      { city: "Indianapolis", lat: 39.7684, lng: -86.1581, metro_name: "Indianapolis, IN", yelp_location: "Indianapolis, IN" },
    ]},
    KY: { name: "Kentucky", cities: [
      { city: "Louisville", lat: 38.2527, lng: -85.7585, metro_name: "Louisville, KY", yelp_location: "Louisville, KY" },
    ]},
    LA: { name: "Louisiana", cities: [
      { city: "New Orleans", lat: 29.9511, lng: -90.0715, metro_name: "New Orleans, LA", yelp_location: "New Orleans, LA" },
    ]},
    MA: { name: "Massachusetts", cities: [
      { city: "Boston", lat: 42.3601, lng: -71.0589, metro_name: "Boston, MA", yelp_location: "Boston, MA" },
    ]},
    MD: { name: "Maryland", cities: [
      { city: "Baltimore", lat: 39.2904, lng: -76.6122, metro_name: "Baltimore, MD", yelp_location: "Baltimore, MD" },
    ]},
    MI: { name: "Michigan", cities: [
      { city: "Detroit", lat: 42.3314, lng: -83.0458, metro_name: "Detroit, MI", yelp_location: "Detroit, MI" },
    ]},
    MN: { name: "Minnesota", cities: [
      { city: "Minneapolis", lat: 44.9778, lng: -93.265, metro_name: "Minneapolis, MN", yelp_location: "Minneapolis, MN" },
    ]},
    MO: { name: "Missouri", cities: [
      { city: "Kansas City", lat: 39.0997, lng: -94.5786, metro_name: "Kansas City, MO", yelp_location: "Kansas City, MO" },
      { city: "St. Louis", lat: 38.627, lng: -90.1994, metro_name: "St. Louis, MO", yelp_location: "St. Louis, MO" },
    ]},
    NC: { name: "North Carolina", cities: [
      { city: "Charlotte", lat: 35.2271, lng: -80.8431, metro_name: "Charlotte, NC", yelp_location: "Charlotte, NC" },
      { city: "Raleigh", lat: 35.7796, lng: -78.6382, metro_name: "Raleigh, NC", yelp_location: "Raleigh, NC" },
    ]},
    NV: { name: "Nevada", cities: [
      { city: "Las Vegas", lat: 36.1699, lng: -115.1398, metro_name: "Las Vegas, NV", yelp_location: "Las Vegas, NV" },
    ]},
    NY: { name: "New York", cities: [
      { city: "New York City", lat: 40.7128, lng: -74.006, metro_name: "New York City, NY", yelp_location: "New York, NY" },
      { city: "Buffalo", lat: 42.8864, lng: -78.8784, metro_name: "Buffalo, NY", yelp_location: "Buffalo, NY" },
    ]},
    OH: { name: "Ohio", cities: [
      { city: "Columbus", lat: 39.9612, lng: -82.9988, metro_name: "Columbus, OH", yelp_location: "Columbus, OH" },
      { city: "Cleveland", lat: 41.4993, lng: -81.6944, metro_name: "Cleveland, OH", yelp_location: "Cleveland, OH" },
      { city: "Cincinnati", lat: 39.1031, lng: -84.512, metro_name: "Cincinnati, OH", yelp_location: "Cincinnati, OH" },
    ]},
    OK: { name: "Oklahoma", cities: [
      { city: "Oklahoma City", lat: 35.4676, lng: -97.5164, metro_name: "Oklahoma City, OK", yelp_location: "Oklahoma City, OK" },
    ]},
    OR: { name: "Oregon", cities: [
      { city: "Portland", lat: 45.5152, lng: -122.6784, metro_name: "Portland, OR", yelp_location: "Portland, OR" },
    ]},
    PA: { name: "Pennsylvania", cities: [
      { city: "Philadelphia", lat: 39.9526, lng: -75.1652, metro_name: "Philadelphia, PA", yelp_location: "Philadelphia, PA" },
      { city: "Pittsburgh", lat: 40.4406, lng: -79.9959, metro_name: "Pittsburgh, PA", yelp_location: "Pittsburgh, PA" },
    ]},
    TN: { name: "Tennessee", cities: [
      { city: "Nashville", lat: 36.1627, lng: -86.7816, metro_name: "Nashville, TN", yelp_location: "Nashville, TN" },
      { city: "Memphis", lat: 35.1495, lng: -90.049, metro_name: "Memphis, TN", yelp_location: "Memphis, TN" },
    ]},
    TX: { name: "Texas", cities: [
      { city: "Austin", lat: 30.2672, lng: -97.7431, metro_name: "Austin, TX", yelp_location: "Austin, TX" },
      { city: "Houston", lat: 29.7604, lng: -95.3698, metro_name: "Houston, TX", yelp_location: "Houston, TX" },
      { city: "Dallas", lat: 32.7767, lng: -96.797, metro_name: "Dallas, TX", yelp_location: "Dallas, TX" },
      { city: "San Antonio", lat: 29.4241, lng: -98.4936, metro_name: "San Antonio, TX", yelp_location: "San Antonio, TX" },
      { city: "Fort Worth", lat: 32.7555, lng: -97.3308, metro_name: "Fort Worth, TX", yelp_location: "Fort Worth, TX" },
    ]},
    UT: { name: "Utah", cities: [
      { city: "Salt Lake City", lat: 40.7608, lng: -111.891, metro_name: "Salt Lake City, UT", yelp_location: "Salt Lake City, UT" },
    ]},
    VA: { name: "Virginia", cities: [
      { city: "Virginia Beach", lat: 36.8529, lng: -75.978, metro_name: "Virginia Beach, VA", yelp_location: "Virginia Beach, VA" },
      { city: "Richmond", lat: 37.5407, lng: -77.436, metro_name: "Richmond, VA", yelp_location: "Richmond, VA" },
    ]},
    WA: { name: "Washington", cities: [
      { city: "Seattle", lat: 47.6062, lng: -122.3321, metro_name: "Seattle, WA", yelp_location: "Seattle, WA" },
    ]},
    WI: { name: "Wisconsin", cities: [
      { city: "Milwaukee", lat: 43.0389, lng: -87.9065, metro_name: "Milwaukee, WI", yelp_location: "Milwaukee, WI" },
    ]},
    DC: { name: "Washington D.C.", cities: [
      { city: "Washington", lat: 38.9072, lng: -77.0369, metro_name: "Washington, DC", yelp_location: "Washington, DC" },
    ]},
  },
  CA: {
    ON: { name: "Ontario", cities: [
      { city: "Toronto", lat: 43.6532, lng: -79.3832, metro_name: "Toronto, ON", yelp_location: "Toronto, ON" },
      { city: "Ottawa", lat: 45.4215, lng: -75.6972, metro_name: "Ottawa, ON", yelp_location: "Ottawa, ON" },
      { city: "Hamilton", lat: 43.2557, lng: -79.8711, metro_name: "Hamilton, ON", yelp_location: "Hamilton, ON" },
      { city: "London", lat: 42.9849, lng: -81.2453, metro_name: "London, ON", yelp_location: "London, ON" },
      { city: "Kitchener", lat: 43.4516, lng: -80.4925, metro_name: "Kitchener, ON", yelp_location: "Kitchener, ON" },
    ]},
    AB: { name: "Alberta", cities: [
      { city: "Edmonton", lat: 53.5461, lng: -113.4938, metro_name: "Edmonton, AB", yelp_location: "Edmonton, AB" },
      { city: "Calgary", lat: 51.0447, lng: -114.0719, metro_name: "Calgary, AB", yelp_location: "Calgary, AB" },
    ]},
    BC: { name: "British Columbia", cities: [
      { city: "Vancouver", lat: 49.2827, lng: -123.1207, metro_name: "Vancouver, BC", yelp_location: "Vancouver, BC" },
      { city: "Victoria", lat: 48.4284, lng: -123.3656, metro_name: "Victoria, BC", yelp_location: "Victoria, BC" },
    ]},
    QC: { name: "Quebec", cities: [
      { city: "Montreal", lat: 45.5017, lng: -73.5673, metro_name: "Montreal, QC", yelp_location: "Montreal, QC" },
      { city: "Quebec City", lat: 46.8139, lng: -71.208, metro_name: "Quebec City, QC", yelp_location: "Quebec City, QC" },
    ]},
    MB: { name: "Manitoba", cities: [
      { city: "Winnipeg", lat: 49.8951, lng: -97.1384, metro_name: "Winnipeg, MB", yelp_location: "Winnipeg, MB" },
    ]},
    SK: { name: "Saskatchewan", cities: [
      { city: "Saskatoon", lat: 52.1332, lng: -106.6700, metro_name: "Saskatoon, SK", yelp_location: "Saskatoon, SK" },
      { city: "Regina", lat: 50.4452, lng: -104.6189, metro_name: "Regina, SK", yelp_location: "Regina, SK" },
    ]},
    NS: { name: "Nova Scotia", cities: [
      { city: "Halifax", lat: 44.6488, lng: -63.5752, metro_name: "Halifax, NS", yelp_location: "Halifax, NS" },
    ]},
  },
};
