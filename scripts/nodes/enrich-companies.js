// Enrich Companies — Single Code node replacing entire Step 2 + Step 3b pipeline
// Mode: runOnceForAllItems
// Input: { metro, company_ids } from sub-workflow webhook, OR trigger from main workflow
// Output: summary → Find Contacts (includes metro + company_ids for chain)
//
// For each discovered company: domain backfill, website scrape, Google Details,
// company update, social profiles insert. All via this.helpers.httpRequest().

const inputData = $input.first().json;
// n8n Webhook v2 wraps POST body under .body; unwrap for sub-workflow mode
const payload = inputData.body || inputData;
const metro = payload.metro || payload.metro_name;
const companyIds = payload.company_ids || null;
if (!metro) {
  throw new Error('Enrich Companies: missing metro in input. Expected metro or metro_name field.');
}
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const googleApiKey = $env.GOOGLE_PLACES_API_KEY;
const sbHeaders = { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey };
const sbWriteHeaders = { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

// ═══ CONFIG (previously in Enrichment Config Set node) ═══
const SKIP_GOOGLE_DETAILS = false;
const HTTP_TIMEOUT = 15000;

// ═══ CONSTANTS ═══

const BLOCKED_DOMAINS = ['wixsite.com','wix.com','setmore.com','schedulista.com','glossgenius.com','square.site','genbook.com','jane.app','acuityscheduling.com','mindbodyonline.com','mindbody.io','vagaro.com','fresha.com','schedulicity.com','booksy.com','massagebook.com','noterro.com','clinicsense.com','calendly.com','squarespace.com'];

const bookingSignatures = {
  'jane_app': ['jane.app', 'janeapp.com'],
  'acuity': ['acuityscheduling.com', 'squareup.com/appointments', 'app.acuityscheduling.com'],
  'mindbody': ['mindbodyonline.com', 'clients.mindbodyonline.com', 'mindbody.io', 'healcode.com'],
  'square': ['square.site', 'squareup.com'],
  'vagaro': ['vagaro.com'],
  'fresha': ['fresha.com', 'shedul.com'],
  'schedulicity': ['schedulicity.com'],
  'schedulista': ['schedulista.com'],
  'booksy': ['booksy.com'],
  'massagebook': ['massagebook.com'],
  'genbook': ['genbook.com'],
  'noterro': ['noterro.com'],
  'clinicsense': ['clinicsense.com'],
  'wix_bookings': ['wix.com/booking', 'bookings.wixapps.net'],
  'calendly': ['calendly.com']
};

const bookingPatterns = ['book now', 'book online', 'book appointment', 'schedule now', 'schedule online', 'book a massage', 'online booking'];

const adSignatures = [
  'googleadservices.com', 'googlesyndication.com', 'googleads.g.doubleclick.net',
  'google_conversion', 'conversion_async', 'ads/ga-audiences',
  'fbevents.js', 'fbq(', 'snap.licdn.com', 'linkedin.com/insight',
  'analytics.tiktok.com', 'tiktok.com/i18n/pixel', 'ads-twitter.com', 'static.ads-twitter.com'
];

const socialPatterns = {
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/gi,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/gi,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/gi,
  x: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9._-]+/gi,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[a-zA-Z0-9._-]+/gi
};

const junkEmailDomains = [
  'sentry.io', 'schema.org', 'w3.org', 'wordpress.com', 'wordpress.org',
  'squarespace.com', 'wix.com', 'gravatar.com', 'facebook.com', 'twitter.com',
  'instagram.com', 'youtube.com', 'linkedin.com', 'pinterest.com', 'tiktok.com',
  'cloudflare.com', 'googleapis.com', 'googletagmanager.com', 'google-analytics.com',
  'gstatic.com', 'jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com',
  'bootstrapcdn.com', 'fontawesome.com', 'typekit.net', 'fonts.googleapis.com',
  'example.com', 'example.org', 'test.com', 'localhost',
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'yopmail.com'
];

const junkLocalPatterns = [
  /^noreply$/i, /^no-reply$/i, /^donotreply$/i, /^do-not-reply$/i,
  /^postmaster$/i, /^mailer-daemon$/i, /^webmaster$/i, /^root$/i,
  /^null$/i, /^test$/i, /^admin$/i, /^abuse$/i
];

const roleBasedPrefixes = ['info', 'contact', 'hello', 'office', 'reception',
  'frontdesk', 'front.desk', 'appointments', 'booking', 'bookings',
  'schedule', 'scheduling', 'inquiries', 'inquiry', 'general', 'team', 'staff',
  'support', 'sales', 'billing'];

const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;

const teamPatterns = [
  /our\s+team/i, /meet\s+(?:the\s+)?team/i, /our\s+(?:therapists|practitioners|staff|massage\s+therapists)/i,
  /meet\s+(?:our|the)\s+(?:therapists|practitioners|staff)/i
];

const soloSignals = ['sole proprietor', 'solo practice', 'independent massage',
  'i am a licensed', "i'm a licensed", 'about me', 'my practice', 'my approach',
  'my services', 'i specialize', 'i provide'];

// ═══ HELPER FUNCTIONS ═══

function isDomainBlocked(domain) {
  if (!domain) return false;
  const lower = domain.toLowerCase();
  return BLOCKED_DOMAINS.some(b => lower === b || lower.endsWith('.' + b));
}

function detectBookingFromDomain(domain) {
  if (!domain) return { has_online_booking: false, booking_platform: null };
  const lower = domain.toLowerCase();
  for (const [platform, sigs] of Object.entries(bookingSignatures)) {
    for (const sig of sigs) {
      if (lower.includes(sig)) return { has_online_booking: true, booking_platform: platform };
    }
  }
  return { has_online_booking: false, booking_platform: null };
}

function analyzeWebsiteHtml(rawHtml, domain) {
  const result = {
    has_online_booking: false, booking_platform: null, has_paid_ads: false,
    estimated_size: null, social_links_found: [], emails_found: [], best_email: null,
    _website_fetch_status: 'success'
  };

  // Domain-based booking detection first
  const domainBooking = detectBookingFromDomain(domain);
  result.has_online_booking = domainBooking.has_online_booking;
  result.booking_platform = domainBooking.booking_platform;

  if (!rawHtml || typeof rawHtml !== 'string') {
    result._website_fetch_status = 'empty_response';
    return result;
  }

  const html = rawHtml.toLowerCase();
  const htmlOriginal = rawHtml;

  // Email extraction
  const allEmailMatches = htmlOriginal.match(emailRegex) || [];
  mailtoRegex.lastIndex = 0;
  const mailtoEmails = new Set();
  let mailtoMatch;
  while ((mailtoMatch = mailtoRegex.exec(htmlOriginal)) !== null) {
    mailtoEmails.add(mailtoMatch[1].toLowerCase());
  }

  const uniqueEmails = [...new Set(allEmailMatches.map(e => e.toLowerCase()))];
  const scoredEmails = [];

  for (const email of uniqueEmails) {
    const [localPart, emailDomain] = email.split('@');
    if (!emailDomain) continue;
    if (junkEmailDomains.some(d => emailDomain.includes(d))) continue;
    if (junkLocalPatterns.some(p => p.test(localPart))) continue;
    if (/^\d+$/.test(localPart)) continue;

    let score = 0;
    if (domain && emailDomain.includes(domain.replace('www.', ''))) score += 20;
    if (mailtoEmails.has(email)) score += 10;
    if (roleBasedPrefixes.some(p => localPart === p || localPart.startsWith(p + '.'))) score += 5;
    scoredEmails.push({ email, score, from_mailto: mailtoEmails.has(email) });
  }

  scoredEmails.sort((a, b) => b.score - a.score);
  result.emails_found = scoredEmails.slice(0, 5);
  result.best_email = scoredEmails.length > 0 ? scoredEmails[0].email : null;

  // HTML-based booking detection
  if (!result.has_online_booking) {
    for (const [platform, sigs] of Object.entries(bookingSignatures)) {
      for (const sig of sigs) {
        if (html.includes(sig)) {
          result.booking_platform = platform;
          result.has_online_booking = true;
          break;
        }
      }
      if (result.has_online_booking) break;
    }
  }
  if (!result.has_online_booking) {
    for (const pattern of bookingPatterns) {
      if (html.includes(pattern)) {
        result.has_online_booking = true;
        result.booking_platform = 'unknown';
        break;
      }
    }
  }

  // Paid ads detection
  for (const sig of adSignatures) {
    if (html.includes(sig)) { result.has_paid_ads = true; break; }
  }

  // Social links extraction
  const seenPlatforms = new Set();
  for (const [platform, regex] of Object.entries(socialPatterns)) {
    regex.lastIndex = 0;
    const matches = htmlOriginal.match(regex) || [];
    for (const url of matches) {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('/sharer') || lowerUrl.includes('/share') ||
          lowerUrl.includes('/intent') || lowerUrl.includes('/login') ||
          lowerUrl.includes('/help') || lowerUrl.includes('/about') ||
          lowerUrl.includes('/policies') || lowerUrl.includes('/privacy')) continue;
      if (!seenPlatforms.has(platform)) {
        result.social_links_found.push({ platform, url: url.replace(/\/+$/, '') });
        seenPlatforms.add(platform);
      }
    }
  }

  // Team size estimation
  let hasTeamPage = false;
  for (const p of teamPatterns) { if (p.test(htmlOriginal)) { hasTeamPage = true; break; } }
  if (hasTeamPage) {
    const namePatterns = htmlOriginal.match(/<h[2-4][^>]*>[^<]{2,40}<\/h[2-4]>/gi) || [];
    const staffLinks = htmlOriginal.match(/\/(?:team|staff|therapist|practitioner)s?\/[a-z-]+/gi) || [];
    const memberCount = Math.max(namePatterns.length, staffLinks.length);
    if (memberCount <= 1) result.estimated_size = 'solo';
    else if (memberCount <= 5) result.estimated_size = 'small';
    else result.estimated_size = 'medium';
  } else {
    if (soloSignals.some(s => html.includes(s))) result.estimated_size = 'solo';
  }

  return result;
}

function extractDomainFromPlaces(company, places) {
  if (!places || places.length === 0) return null;

  const companyName = (company.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const companyPhone = (company.phone || '').replace(/[^\d]/g, '');

  let bestMatch = null;
  let bestScore = 0;

  for (const place of places) {
    const placeName = ((place.displayName && place.displayName.text) || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
    let score = 0;

    const companyWords = companyName.split(/\s+/).filter(w => w.length > 2);
    const placeWords = placeName.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = companyWords.filter(w => placeWords.some(pw => pw.includes(w) || w.includes(pw)));
    score = companyWords.length > 0 ? matchingWords.length / companyWords.length : 0;

    const placePhone = (place.internationalPhoneNumber || place.nationalPhoneNumber || '').replace(/[^\d]/g, '');
    if (companyPhone && placePhone && (placePhone.includes(companyPhone.slice(-10)) || companyPhone.includes(placePhone.slice(-10)))) {
      score += 0.5;
    }

    if (score > bestScore && score >= 0.4) { bestScore = score; bestMatch = place; }
  }

  if (!bestMatch) return null;

  const website = bestMatch.websiteUri || '';
  let domain = null;
  if (website) {
    const match = website.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
    if (match) domain = match[1];
  }

  // Check domain against blocklist
  if (domain && isDomainBlocked(domain)) domain = null;

  return {
    domain,
    google_place_id: bestMatch.id || null,
    google_rating: bestMatch.rating || null,
    google_review_count: bestMatch.userRatingCount || null,
    _match_score: bestScore
  };
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ FETCH COMPANIES ═══

// Batch mode: query by company IDs; Legacy mode: query by metro + status
let companyQueryParams;
if (companyIds && companyIds.length > 0) {
  companyQueryParams = `id=in.(${companyIds.join(',')})`;
} else {
  companyQueryParams = `enrichment_status=in.(discovered,partially_enriched)&discovery_metro=eq.${encodeURIComponent(metro)}`;
}

const companies = await this.helpers.httpRequest({
  method: 'GET',
  url: `${supabaseUrl}/rest/v1/companies?${companyQueryParams}&order=discovered_at.asc&limit=1000&select=id,name,phone,domain,address,city,state,country,google_place_id,category,has_website,google_review_count,google_rating,source_urls,on_yelp,on_groupon`,
  headers: sbHeaders,
  json: true
});

if (!Array.isArray(companies) || companies.length === 0) {
  console.log('No companies to enrich for metro: ' + metro);
  return [{ json: { step: 'enrich_companies', processed: 0, message: 'No companies to enrich' } }];
}

console.log(`Enrich Companies: ${companies.length} companies to process for ${metro}`);

// ═══ STATS ═══
const stats = {
  processed: 0, domainBackfilled: 0, websitesFetched: 0, websiteErrors: 0,
  bookingDetected: 0, paidAdsDetected: 0, socialFromWebsite: 0, socialProfilesInserted: 0,
  googleDetailsProcessed: 0, companyUpdates: 0, updateErrors: 0, errors: 0
};

// ═══ MAIN LOOP ═══

for (const company of companies) {
  try {
    let domain = company.domain;
    let backfillPatch = {};
    let has_website = company.has_website;

    // ── 1. Domain backfill if needed ──
    if (!domain && has_website) {
      try {
        const placesResp = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://places.googleapis.com/v1/places:searchText',
          headers: {
            'X-Goog-FieldMask': 'places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount',
            'X-Goog-Api-Key': googleApiKey,
            'Content-Type': 'application/json'
          },
          body: { textQuery: `${company.name} ${company.city} ${company.state}`, maxResultCount: 3 },
          json: true
        });

        const result = extractDomainFromPlaces(company, placesResp.places || []);
        if (result) {
          if (result.domain) {
            domain = result.domain;
            has_website = true;
            backfillPatch.domain = domain;
            backfillPatch.has_website = true;
          }
          if (result.google_place_id && !company.google_place_id) backfillPatch.google_place_id = result.google_place_id;
          if (result.google_rating && !company.google_rating) backfillPatch.google_rating = result.google_rating;
          if (result.google_review_count && !company.google_review_count) backfillPatch.google_review_count = result.google_review_count;
          stats.domainBackfilled++;
        }
        await delay(200);
      } catch(e) {
        console.log(`Domain backfill error for ${company.name}: ${e.message}`);
      }
    }

    // ── 2. Website scrape ──
    let websiteData = {
      has_online_booking: false, booking_platform: null, has_paid_ads: false,
      estimated_size: null, social_links_found: [], emails_found: [], best_email: null,
      _website_fetch_status: 'skipped'
    };

    if (domain && !isDomainBlocked(domain)) {
      try {
        const resp = await this.helpers.httpRequest({
          method: 'GET',
          url: `https://${domain}`,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          returnFullResponse: true,
          timeout: HTTP_TIMEOUT,
          json: false,
        });
        const rawHtml = resp.body || '';
        if (typeof rawHtml === 'string' && rawHtml.length > 100) {
          websiteData = analyzeWebsiteHtml(rawHtml, domain);
          stats.websitesFetched++;
        } else {
          websiteData._website_fetch_status = 'empty_response';
          stats.websiteErrors++;
        }
      } catch(e) {
        websiteData._website_fetch_status = 'error';
        // Still check domain for booking platform signals
        const domainBooking = detectBookingFromDomain(domain);
        websiteData.has_online_booking = domainBooking.has_online_booking;
        websiteData.booking_platform = domainBooking.booking_platform;
        stats.websiteErrors++;
      }
    } else if (domain && isDomainBlocked(domain)) {
      // Blocked domain — still detect booking platform from domain
      const domainBooking = detectBookingFromDomain(domain);
      websiteData.has_online_booking = domainBooking.has_online_booking;
      websiteData.booking_platform = domainBooking.booking_platform;
      websiteData._website_fetch_status = 'skipped_blocked_domain';
    } else {
      // No domain — check company's existing domain for booking signals
      const domainBooking = detectBookingFromDomain(company.domain);
      websiteData.has_online_booking = domainBooking.has_online_booking;
      websiteData.booking_platform = domainBooking.booking_platform;
      websiteData._website_fetch_status = 'skipped_no_website';
    }

    if (websiteData.has_online_booking) stats.bookingDetected++;
    if (websiteData.has_paid_ads) stats.paidAdsDetected++;
    stats.socialFromWebsite += websiteData.social_links_found.length;

    // ── 3. Google Places Details ──
    let googleDetails = {
      opening_hours: null, business_status: null, photo_count: 0,
      price_level: null, additional_types: [], _fetch_status: 'skipped'
    };

    const placeId = company.google_place_id || backfillPatch.google_place_id;
    if (placeId && !SKIP_GOOGLE_DETAILS) {
      try {
        const details = await this.helpers.httpRequest({
          method: 'GET',
          url: `https://places.googleapis.com/v1/places/${placeId}`,
          headers: {
            'X-Goog-FieldMask': 'currentOpeningHours,regularOpeningHours,types,photos,priceLevel,businessStatus',
            'X-Goog-Api-Key': googleApiKey
          },
          json: true
        });

        if (details && !details.error) {
          if (details.regularOpeningHours && details.regularOpeningHours.periods) {
            googleDetails.opening_hours = details.regularOpeningHours;
          } else if (details.currentOpeningHours && details.currentOpeningHours.periods) {
            googleDetails.opening_hours = details.currentOpeningHours;
          }
          googleDetails.business_status = details.businessStatus || null;
          if (details.photos && Array.isArray(details.photos)) googleDetails.photo_count = details.photos.length;
          googleDetails.price_level = details.priceLevel || null;
          if (details.types && Array.isArray(details.types)) googleDetails.additional_types = details.types;
          googleDetails._fetch_status = 'success';
          stats.googleDetailsProcessed++;
        }
        await delay(100);
      } catch(e) {
        googleDetails._fetch_status = 'error';
        console.log(`Google Details error for ${company.name}: ${e.message}`);
      }
    }

    // ── 4. Build update payload ──
    const now = new Date().toISOString();
    const updatePayload = {
      has_online_booking: websiteData.has_online_booking || false,
      booking_platform: websiteData.booking_platform || null,
      has_paid_ads: websiteData.has_paid_ads || false,
      estimated_size: websiteData.estimated_size || null,
      enrichment_status: 'partially_enriched',
      enriched_at: now
    };

    // Backfill data
    if (backfillPatch.domain) updatePayload.domain = backfillPatch.domain;
    if (backfillPatch.google_place_id) updatePayload.google_place_id = backfillPatch.google_place_id;
    if (backfillPatch.google_rating) updatePayload.google_rating = backfillPatch.google_rating;
    if (backfillPatch.google_review_count) updatePayload.google_review_count = backfillPatch.google_review_count;
    if (backfillPatch.has_website) updatePayload.has_website = backfillPatch.has_website;
    if (has_website && !company.has_website) updatePayload.has_website = has_website;

    // Website-scraped email
    if (websiteData.best_email) updatePayload.email = websiteData.best_email;

    // Google Details — store opening hours as JSON
    // (opening_hours, business_status, photo_count, price_level stored in company row)
    if (googleDetails._fetch_status === 'success') {
      if (googleDetails.opening_hours) updatePayload.opening_hours = googleDetails.opening_hours;
      if (googleDetails.business_status) updatePayload.business_status = googleDetails.business_status;
      if (googleDetails.photo_count) updatePayload.photo_count = googleDetails.photo_count;
      if (googleDetails.price_level) updatePayload.price_level = googleDetails.price_level;
    }

    // ── 5. PATCH company in Supabase ──
    try {
      await this.helpers.httpRequest({
        method: 'PATCH',
        url: `${supabaseUrl}/rest/v1/companies?id=eq.${company.id}`,
        headers: sbWriteHeaders,
        body: updatePayload,
        json: true
      });
      stats.companyUpdates++;
    } catch(e) {
      console.log(`Company update error for ${company.name} (${company.id}): ${e.message}`);
      stats.updateErrors++;
    }

    // ── 6. Insert social profiles if found ──
    if (websiteData.social_links_found.length > 0) {
      const rows = websiteData.social_links_found.map(link => ({
        company_id: company.id,
        platform: link.platform,
        profile_url: link.url,
        follower_count: null,
        post_count: null,
        last_post_date: null,
        scraped_at: now
      }));

      try {
        await this.helpers.httpRequest({
          method: 'POST',
          url: `${supabaseUrl}/rest/v1/social_profiles`,
          headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: rows,
          json: true
        });
        stats.socialProfilesInserted += rows.length;
      } catch(e) {
        console.log(`Social profiles insert error for ${company.name}: ${e.message}`);
      }
    }

    stats.processed++;
    if (stats.processed % 25 === 0) {
      console.log(`  Progress: ${stats.processed}/${companies.length} companies enriched`);
    }
  } catch(e) {
    console.log(`FATAL error enriching ${company.name}: ${e.message}`);
    stats.errors++;
  }
}

// ═══ SUMMARY ═══
const summary = {
  step: 'enrich_companies',
  metro,
  run_completed_at: new Date().toISOString(),
  companies_processed: stats.processed,
  domain_backfilled: stats.domainBackfilled,
  websites_fetched: stats.websitesFetched,
  website_errors: stats.websiteErrors,
  booking_platforms_detected: stats.bookingDetected,
  paid_ads_detected: stats.paidAdsDetected,
  social_links_from_websites: stats.socialFromWebsite,
  social_profiles_inserted: stats.socialProfilesInserted,
  google_details_processed: stats.googleDetailsProcessed,
  company_updates: stats.companyUpdates,
  update_errors: stats.updateErrors,
  fatal_errors: stats.errors,
  message: `Enriched ${stats.processed} companies. ${stats.websitesFetched} websites fetched, ${stats.socialProfilesInserted} social profiles, ${stats.bookingDetected} booking platforms, ${stats.paidAdsDetected} paid ads. ${stats.updateErrors} update errors, ${stats.errors} fatal errors.`
};

console.log('=== STEP 2: ENRICH COMPANIES SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

// Pass metro + company_ids through for the next node in the chain
return [{ json: { ...summary, metro, company_ids: companyIds } }];
