// Find Contacts — Single Code node replacing entire Step 3a pipeline
// Mode: runOnceForAllItems
// Input: { metro, company_ids } from upstream Enrich Companies, OR main workflow trigger
// Output: summary → Enrich Contacts (includes metro + company_ids for chain)
//
// For each company without contacts: solo detection, Apollo search/enrich,
// about page scraping, name extraction, validation, Supabase insert.

const inputData = $input.first().json;
// n8n Webhook v2 wraps POST body under .body; unwrap defensively
const payload = inputData.body || inputData;
const metro = payload.metro || payload.metro_name;
const companyIds = payload.company_ids || null;
if (!metro) {
  throw new Error('Find Contacts: missing metro in input. Expected metro or metro_name field.');
}
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const apolloApiKey = $env.APOLLO_API_KEY;
const sbHeaders = { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey };

// ═══ CONFIG (previously in Step 3a Config Set node) ═══
const SKIP_APOLLO = false;
const SKIP_WEBSITE_SCRAPE = false;
const APOLLO_ENRICH_ENABLED = true;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ COMMON FIRST NAMES ═══
const commonFirstNames = new Set([
  'aaron','abby','abigail','adam','adrian','adriana','aiden','aimee','alana','albert',
  'alec','alexa','alexander','alexandra','alexis','alice','alicia','alina','alison','allison',
  'alyssa','amanda','amber','amelia','amy','ana','andrea','andrew','angela','angelica',
  'angie','anita','ann','anna','anne','annie','anthony','april','aria','ariana',
  'ashley','audrey','austin','autumn','ava','avery','bailey','barbara','beatrice','becky',
  'bella','ben','benjamin','beth','bethany','betty','beverly','bianca','blake','bonnie',
  'brad','bradley','brandi','brandon','brandy','breanna','brenda','brent','brett','brian',
  'briana','brianna','bridget','brittany','brittney','brooke','bruce','bryan','caitlin','caleb',
  'cameron','camila','candace','cara','carina','carl','carla','carlos','carly','carmen',
  'carol','carolina','caroline','carolyn','carrie','casey','cassandra','cassidy','catherine','cathy',
  'cecilia','celeste','celia','chad','charlene','charles','charlie','charlotte','chase','chelsea',
  'cheryl','chloe','chris','christa','christian','christina','christine','christopher','cindy','claire',
  'clara','claudia','cody','colleen','connor','constance','corey','corinne','courtney','craig',
  'crystal','cynthia','daisy','dale','dana','daniel','daniela','danielle','daphne','darlene',
  'darren','dave','david','dawn','dean','deanna','debbie','deborah','debra','denise',
  'derek','desiree','destiny','diana','diane','dianne','dolores','dominic','donna','doris',
  'dorothy','douglas','drew','dustin','dylan','eddie','edith','edward','eileen','elaine',
  'elena','elisa','elizabeth','ella','ellen','ellie','emily','emma','eric','erica',
  'erika','erin','ernest','esther','ethan','eugene','eva','evan','evelyn','faith',
  'faye','felicia','fiona','florence','frances','frank','gabriel','gabriela','gabriella','gabrielle',
  'gail','gary','gavin','genevieve','george','georgia','gerald','gina','giselle','gladys',
  'glen','glenn','gloria','grace','grant','greg','gregory','gretchen','hailey','haley',
  'hannah','harold','harriet','harry','hayden','hazel','heather','heidi','helen','henry',
  'hillary','holly','hope','howard','hunter','ian','irene','iris','isaac','isabel',
  'isabella','ivy','jack','jackie','jackson','jacob','jacqueline','jade','jaime','jake',
  'james','jamie','jan','jane','janet','janice','jared','jasmine','jason','jay',
  'jean','jeanette','jeanne','jeff','jeffrey','jenna','jennifer','jenny','jeremy','jerry',
  'jesse','jessica','jill','jillian','jim','jimmy','jo','joan','joann','joanna',
  'joanne','jocelyn','jodi','jody','joe','joel','johanna','john','johnny','jolene',
  'jon','jonathan','jordan','jorge','jose','joseph','josephine','josh','joshua','joy',
  'joyce','juan','judith','judy','julia','julian','juliana','julie','june','justin',
  'kaitlyn','kara','karen','karina','karl','kate','katelyn','katherine','kathleen','kathryn',
  'kathy','katie','katrina','kay','kayla','keith','kelley','kelli','kelly','kelsey',
  'ken','kendra','kenneth','kenny','kerry','kevin','kim','kimberly','kirsten','krista',
  'kristen','kristin','kristina','kristy','kyle','kylie','lacey','lana','lance','larry',
  'laura','lauren','laurie','leah','lee','leigh','lena','leo','leon','leslie',
  'lexy','liam','lillian','lily','linda','lindsay','lindsey','lisa','logan','lois',
  'lora','lorena','lori','lorraine','louis','louise','lucia','luis','luke','lydia',
  'lynn','mackenzie','madeline','madison','maggie','malik','mallory','mandy','marc','marcia',
  'marco','marcus','margaret','maria','mariah','marie','marilyn','marina','mario','marisa',
  'marissa','mark','marlene','marsha','martha','martin','mary','mason','matt','matthew',
  'maureen','max','maya','megan','meghan','melanie','melinda','melissa','melody','meredith',
  'mia','michael','michele','michelle','miguel','mike','mildred','mindy','miranda','misty',
  'mitchell','molly','monica','monique','morgan','mya','nadia','nancy','naomi','natalia',
  'natalie','natasha','nathan','nathaniel','neil','nelson','nicholas','nicole','nina','noah',
  'noel','nora','norma','olivia','owen','paige','pam','pamela','patricia','patrick',
  'patty','paul','paula','pauline','peggy','penny','peter','philip','phyllis','priscilla',
  'rachel','ralph','ramona','randall','randy','ray','raymond','rebecca','regina','renee',
  'rhonda','ricardo','richard','rick','ricky','riley','rita','rob','robert','roberta',
  'robin','rochelle','rodney','roger','ronald','rosa','rosalie','rose','rosemary','roxanne',
  'ruby','russell','ruth','ryan','sabrina','sally','samantha','samuel','sandra','sandy',
  'sara','sarah','savannah','scott','sean','selena','serena','seth','shana','shane',
  'shannon','sharon','shawn','sheila','shelby','shelley','shelly','sheri','sherri','sherry',
  'shirley','sierra','silvia','simone','sofia','sonia','sonya','sophia','stacey','stacy',
  'stella','stephanie','stephen','steve','steven','sue','summer','susan','suzanne','sydney',
  'sylvia','tabitha','tamara','tammy','tanya','tara','tatiana','taylor','teresa','terri',
  'terry','tess','tessa','theresa','thomas','tiffany','tim','timothy','tina','tito',
  'todd','tom','tommy','toni','tony','tonya','tracey','traci','tracy','travis',
  'tricia','trisha','troy','tyler','valerie','vanessa','vera','veronica','vicki','vicky',
  'victoria','vincent','violet','virginia','vivian','wade','walter','wanda','warren','wayne',
  'wendy','wesley','whitney','william','willie','wilma','xavier','yolanda','yvette','yvonne',
  'zachary','zoe'
]);

function isLikelyFirstName(word) {
  return commonFirstNames.has((word || '').toLowerCase());
}

// ═══ SOLO PRACTITIONER DETECTION ═══

function checkSoloPractitioner(company) {
  const name = (company.name || '').trim();
  const estimatedSize = company.estimated_size;
  let isSolo = false, firstName = null, lastName = null;

  // Pattern 1: "by Name"
  const byPattern = name.match(/\bby\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
  if (byPattern) {
    if (isLikelyFirstName(byPattern[1]) || estimatedSize === 'solo') {
      isSolo = true; firstName = byPattern[1]; lastName = byPattern[2] || null;
    }
  }

  // Pattern 2: "with Name"
  if (!firstName) {
    const withPattern = name.match(/\bwith\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
    if (withPattern && (isLikelyFirstName(withPattern[1]) || estimatedSize === 'solo')) {
      isSolo = true; firstName = withPattern[1]; lastName = withPattern[2] || null;
    }
  }

  // Pattern 3: Possessive
  if (!firstName) {
    const possessiveMatch = name.match(/^([A-Z][a-z]+)'s\s+/i);
    if (possessiveMatch && isLikelyFirstName(possessiveMatch[1])) {
      isSolo = true; firstName = possessiveMatch[1];
    }
  }

  // Pattern 4: "FirstName LastName, LMT/CMT/RMT"
  if (!firstName) {
    const nameFirst = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[,|]\s*|\s+)(?:LMT|CMT|RMT|Licensed|Massage|Bodywork|Therapeutic|Wellness)/i);
    if (nameFirst && isLikelyFirstName(nameFirst[1]) && !commonFirstNames.has(nameFirst[2].toLowerCase())) {
      isSolo = true; firstName = nameFirst[1]; lastName = nameFirst[2];
    }
  }

  // Pattern 5: "FirstName LastName's Massage/Spa"
  if (!firstName) {
    const possessiveFullName = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)'s\s+(?:Massage|Bodywork|Wellness|Spa|Healing)/i);
    if (possessiveFullName && isLikelyFirstName(possessiveFullName[1])) {
      isSolo = true; firstName = possessiveFullName[1]; lastName = possessiveFullName[2];
    }
  }

  // Pattern 6: Three-part name with title
  if (!firstName) {
    const threePartName = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s+(?:LMT|CMT|RMT|Licensed)/i);
    if (threePartName && isLikelyFirstName(threePartName[1])) {
      isSolo = true; firstName = threePartName[1]; lastName = threePartName[3];
    }
  }

  // Pattern 7: Name after comma
  if (!firstName) {
    const commaNameMatch = name.match(/,\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*,?\s*(?:LMT|CMT|RMT|Licensed))?/i);
    if (commaNameMatch && isLikelyFirstName(commaNameMatch[1])) {
      isSolo = true; firstName = commaNameMatch[1]; lastName = commaNameMatch[2];
    }
  }

  if (estimatedSize === 'solo' && !isSolo) isSolo = true;

  // Reject if extracted first name matches city
  if (firstName && company.city && firstName.toLowerCase() === company.city.toLowerCase()) {
    firstName = null; lastName = null;
  }

  return { isSolo, firstName, lastName };
}

// ═══ NAME EXTRACTION FROM HTML ═══

function extractNameFromHtml(html) {
  if (!html || html.length < 100) return null;
  const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const patterns = [
    /(?:owner|owned\s+by|founded\s+by|proprietor)[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /(?:hi,?\s+i'?m|hello,?\s+i'?m|my\s+name\s+is|i\s+am)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /(?:^|\s)about\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[,|]|\s+(?:LMT|CMT|RMT|Licensed))/i,
    /(?:^|\s)meet\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[,|]|\s+(?:LMT|CMT|RMT|Licensed|is\s+a|has\s+been))/i,
    /([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s+(?:LMT|CMT|RMT|Licensed\s+Massage)/i
  ];

  for (const pattern of patterns) {
    for (const source of [textOnly, html]) {
      const match = source.match(pattern);
      if (match) {
        const fn = match[1], ln = match[2];
        if (isLikelyFirstName(fn) && fn.length >= 2 && fn.length <= 20 && ln.length >= 2 && ln.length <= 20) {
          return { firstName: fn, lastName: ln };
        }
      }
    }
  }
  return null;
}

// ═══ NAME EXTRACTION FROM BUSINESS NAME (no domain fallback) ═══

function extractNameFromBusinessName(company) {
  const name = (company.name || '').trim();
  let firstName = null, lastName = null;

  const patterns = [
    { re: /\bby\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i, fi: 1, li: 2 },
    { re: /\bwith\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i, fi: 1, li: 2 },
    { re: /^([A-Z][a-z]+)'s\s+/i, fi: 1, li: null },
    { re: /^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*,?\s*(?:LMT|CMT|RMT|Licensed))/i, fi: 1, li: 2 },
    { re: /,\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)/i, fi: 1, li: 2 },
    { re: /^([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(?:Massage|Bodywork|Therapeutic|Wellness|Healing|Spa)/i, fi: 1, li: 2 },
  ];

  for (const p of patterns) {
    const m = name.match(p.re);
    if (m && isLikelyFirstName(m[p.fi])) {
      firstName = m[p.fi];
      lastName = p.li ? (m[p.li] || null) : null;
      // For pattern 6, reject if lastName is also a common first name
      if (p.re.source.includes('Massage|Bodywork') && lastName && isLikelyFirstName(lastName)) continue;
      break;
    }
  }

  return firstName ? { firstName, lastName } : null;
}

// ═══ CONTACT VALIDATION ═══

function validateAndCleanContact(contact) {
  const flags = [];

  function validateEmail(email, fieldName) {
    if (!email) return null;
    let cleaned = email.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(cleaned)) {
      flags.push(`${fieldName}_invalid_format`); return null;
    }
    const junkPatterns = [/^noreply@/, /^no-reply@/, /^donotreply@/, /^test@/, /^admin@example\./, /^sample@/, /^fake@/, /^placeholder@/, /^null@/, /^none@/, /^unknown@/, /^abuse@/, /^postmaster@/, /^mailer-daemon@/];
    if (junkPatterns.some(p => p.test(cleaned))) { flags.push(`${fieldName}_junk`); return null; }
    const rolePatterns = [/^info@/, /^contact@/, /^hello@/, /^support@/, /^sales@/, /^office@/, /^billing@/, /^reception@/, /^frontdesk@/, /^front\.desk@/, /^appointments@/, /^booking@/, /^bookings@/, /^schedule@/, /^scheduling@/, /^inquiries@/, /^inquiry@/, /^general@/, /^team@/, /^staff@/];
    if (rolePatterns.some(p => p.test(cleaned))) flags.push(`${fieldName}_role_based_kept`);
    const junkDomains = ['example.com', 'example.org', 'test.com', 'localhost', 'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'yopmail.com'];
    const domain = cleaned.split('@')[1];
    if (junkDomains.includes(domain)) { flags.push(`${fieldName}_junk_domain`); return null; }
    const localPart = cleaned.split('@')[0];
    if (/^\d+$/.test(localPart)) { flags.push(`${fieldName}_numeric_local`); return null; }
    return cleaned;
  }

  function validatePhone(phone, fieldName) {
    if (!phone) return null;
    if (typeof phone === 'object') phone = phone.sanitized_number || phone.raw_number || phone.number || '';
    let cleaned = phone.toString().trim().replace(/[^\d]/g, '');
    if (!cleaned || cleaned.length === 0) return null;
    if (cleaned.length === 11 && cleaned.startsWith('1')) { /* ok */ }
    else if (cleaned.length === 10) cleaned = '1' + cleaned;
    else if (cleaned.length < 10) { flags.push(`${fieldName}_too_short`); return null; }
    else if (cleaned.length > 11 && cleaned.length <= 15) {
      if (cleaned.startsWith('1')) return null;
      return '+' + cleaned;
    }
    else if (cleaned.length > 15) return null;
    const areaCode = cleaned.substring(1, 4);
    if (areaCode.startsWith('0') || areaCode.startsWith('1')) return null;
    return '+' + cleaned;
  }

  function cleanName(name, fieldName) {
    if (!name) return null;
    let cleaned = name.trim().replace(/\*+$/, '').trim();
    if (cleaned.length <= 1) return null;
    if (/^\d+$/.test(cleaned) || /\d/.test(cleaned)) return null;
    const junkNames = ['unknown', 'n/a', 'na', 'none', 'null', 'test', 'owner', 'manager', 'admin', 'info', 'contact'];
    if (junkNames.includes(cleaned.toLowerCase())) return null;
    const credentials = ['lmt', 'cmt', 'rmt', 'lmbt', 'lmp', 'bctmb', 'nctmb', 'nctm', 'cpt', 'cst', 'mld', 'nmt', 'amt', 'abmp'];
    if (credentials.includes(cleaned.toLowerCase())) return null;
    if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }
    return cleaned;
  }

  contact.email_business = validateEmail(contact.email_business, 'email_business');
  contact.email_personal = validateEmail(contact.email_personal, 'email_personal');
  contact.phone_direct = validatePhone(contact.phone_direct, 'phone_direct');
  contact.first_name = cleanName(contact.first_name, 'first_name');
  contact.last_name = cleanName(contact.last_name, 'last_name');
  if (!contact.first_name) flags.push('contact_has_no_valid_first_name');

  if (contact.linkedin_url) {
    if (!/linkedin\.com\/in\//i.test(contact.linkedin_url)) contact.linkedin_url = null;
    else if (!contact.linkedin_url.startsWith('http')) contact.linkedin_url = 'https://' + contact.linkedin_url;
  }

  if (contact.location) {
    contact.location = contact.location.trim();
    if (!contact.location || contact.location === ',' || contact.location.length < 2) contact.location = null;
  }

  return { contact, flags, hasValidContact: !!(contact.first_name) };
}

// ═══ APOLLO ROLE SCORING ═══

const ownerKeywords = ['owner', 'founder', 'ceo', 'proprietor', 'principal', 'co-founder'];
const managerKeywords = ['manager', 'director', 'general manager', 'gm', 'head'];
const practitionerKeywords = ['massage', 'therapist', 'lmt', 'cmt', 'rmt', 'bodywork', 'esthetician'];

// ═══ FETCH DATA FROM SUPABASE ═══

// 1. Fetch enriched companies — batch mode (by IDs) or legacy mode (by metro)
let companyQueryParams;
if (companyIds && companyIds.length > 0) {
  companyQueryParams = `id=in.(${companyIds.join(',')})`;
} else {
  companyQueryParams = `enrichment_status=in.(partially_enriched,fully_enriched)&discovery_metro=eq.${encodeURIComponent(metro)}`;
}

const companies = await this.helpers.httpRequest({
  method: 'GET',
  url: `${supabaseUrl}/rest/v1/companies?${companyQueryParams}&order=lead_score.desc,discovered_at.asc&limit=1000&select=id,name,phone,domain,address,city,state,country,google_place_id,category,estimated_size,has_website,google_review_count,google_rating`,
  headers: sbHeaders,
  json: true
});

if (!Array.isArray(companies) || companies.length === 0) {
  console.log('No enriched companies found for metro: ' + metro);
  return [{ json: { step: 'find_contacts', processed: 0, message: 'No companies to find contacts for' } }];
}

// 2. Fetch existing contacts (for dedup) — only company_id needed
const existingContacts = await this.helpers.httpRequest({
  method: 'GET',
  url: `${supabaseUrl}/rest/v1/contacts?select=company_id`,
  headers: sbHeaders,
  json: true
});

const existingSet = new Set();
if (Array.isArray(existingContacts)) {
  for (const c of existingContacts) {
    if (c.company_id) existingSet.add(c.company_id);
  }
}

// 3. Filter to companies without contacts
const needsContacts = companies.filter(c => c.id && !existingSet.has(c.id));

console.log(`Find Contacts: ${companies.length} companies total, ${existingSet.size} already have contacts, ${needsContacts.length} need people discovery for ${metro}`);

if (needsContacts.length === 0) {
  return [{ json: { step: 'find_contacts', processed: 0, message: 'All companies already have contacts' } }];
}

// ═══ STATS ═══
const stats = {
  processed: 0, soloDetected: 0, soloWithName: 0,
  apolloSearched: 0, apolloFound: 0, apolloEnriched: 0,
  websiteScraped: 0, websiteFoundName: 0,
  noDomainFallback: 0, noDomainFoundName: 0,
  contactsInserted: 0, validationIssues: 0, errors: 0
};

// ═══ MAIN LOOP ═══

let apolloBatchCount = 0;

for (const company of needsContacts) {
  try {
    let contact = null;
    let sourceMethod = 'none';

    // ── 1. Solo practitioner check ──
    const soloResult = checkSoloPractitioner(company);
    if (soloResult.isSolo) {
      stats.soloDetected++;
      if (soloResult.firstName) {
        stats.soloWithName++;
        contact = {
          company_id: company.id, first_name: soloResult.firstName, last_name: soloResult.lastName,
          role: 'owner', is_owner: true, email_business: null, email_personal: null,
          phone_direct: null, linkedin_url: null,
          location: [company.city, company.state].filter(Boolean).join(', ') || null,
          cultural_affinity: null, source: 'solo_detection'
        };
        sourceMethod = 'solo_detection';
      }
    }

    // ── 2. Apollo search (if not solo, has domain, enabled) ──
    if (!soloResult.isSolo && company.domain && !SKIP_APOLLO) {
      try {
        // Rate limiting: 3 per batch, 2s delay between batches
        apolloBatchCount++;
        if (apolloBatchCount > 3) {
          await delay(2000);
          apolloBatchCount = 1;
        }

        const apolloResp = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.apollo.io/api/v1/mixed_people/api_search',
          headers: {
            'Content-Type': 'application/json', 'Cache-Control': 'no-cache',
            'X-Api-Key': apolloApiKey
          },
          body: {
            q_organization_domains: company.domain,
            person_titles: ['owner', 'founder', 'ceo', 'proprietor', 'director', 'manager', 'massage therapist', 'licensed massage therapist'],
            per_page: 5
          },
          json: true
        });

        const people = apolloResp.people || [];
        stats.apolloSearched++;

        if (people.length > 0) {
          stats.apolloFound++;

          // Score people by role relevance
          let bestPerson = null, bestScore = -1;
          for (const person of people) {
            const title = (person.title || '').toLowerCase();
            let score = 0;
            if (ownerKeywords.some(k => title.includes(k))) score = 10;
            else if (managerKeywords.some(k => title.includes(k))) score = 5;
            else if (practitionerKeywords.some(k => title.includes(k))) score = 3;
            else score = 1;
            if (person.has_email === true || person.has_email === 'true') score += 1;
            if (score > bestScore) { bestScore = score; bestPerson = person; }
          }

          // Enrich if enabled
          if (APOLLO_ENRICH_ENABLED && bestPerson.id) {
            try {
              const enrichResp = await this.helpers.httpRequest({
                method: 'POST',
                url: 'https://api.apollo.io/api/v1/people/match',
                headers: {
                  'Content-Type': 'application/json', 'Cache-Control': 'no-cache',
                  'X-Api-Key': apolloApiKey
                },
                body: { id: bestPerson.id, reveal_personal_emails: true, reveal_phone_number: false },
                json: true
              });

              const person = enrichResp.person || enrichResp.match || enrichResp;
              if (person && person.first_name) {
                const title = (person.title || '').toLowerCase();
                let role = 'unknown', isOwner = false;
                if (['owner','founder','ceo','proprietor','principal','co-founder'].some(k => title.includes(k))) { role = 'owner'; isOwner = true; }
                else if (['manager','director','gm','general manager'].some(k => title.includes(k))) role = 'manager';
                else if (['massage','therapist','lmt','cmt','rmt','esthetician'].some(k => title.includes(k))) role = 'practitioner';

                let phoneNumber = null;
                if (person.phone_numbers && person.phone_numbers.length > 0) {
                  phoneNumber = person.phone_numbers[0].sanitized_number || person.phone_numbers[0].raw_number || null;
                }

                contact = {
                  company_id: company.id, first_name: person.first_name || null,
                  last_name: person.last_name || null, role, is_owner: isOwner,
                  email_business: person.email || null,
                  email_personal: (person.personal_emails && person.personal_emails[0]) || null,
                  phone_direct: phoneNumber, linkedin_url: person.linkedin_url || null,
                  location: [person.city, person.state].filter(Boolean).join(', ') || [company.city, company.state].filter(Boolean).join(', ') || null,
                  cultural_affinity: null, source: 'apollo'
                };
                sourceMethod = 'apollo_enriched';
                stats.apolloEnriched++;
              } else {
                // Enrichment returned no usable data — use search-only
                contact = {
                  company_id: company.id, first_name: bestPerson.first_name || null,
                  last_name: null, role: (bestPerson.title || '').toLowerCase().includes('owner') ? 'owner' : 'unknown',
                  is_owner: (bestPerson.title || '').toLowerCase().includes('owner'),
                  email_business: null, email_personal: null, phone_direct: null, linkedin_url: null,
                  location: [company.city, company.state].filter(Boolean).join(', ') || null,
                  cultural_affinity: null, source: 'apollo'
                };
                sourceMethod = 'apollo_search_only';
                stats.apolloEnriched++;
              }
            } catch(e) {
              // Enrich failed — use search-only data
              contact = {
                company_id: company.id, first_name: bestPerson.first_name || null,
                last_name: null, role: (bestPerson.title || '').toLowerCase().includes('owner') ? 'owner' : 'unknown',
                is_owner: (bestPerson.title || '').toLowerCase().includes('owner'),
                email_business: null, email_personal: null, phone_direct: null, linkedin_url: null,
                location: [company.city, company.state].filter(Boolean).join(', ') || null,
                cultural_affinity: null, source: 'apollo'
              };
              sourceMethod = 'apollo_search_only';
              stats.apolloEnriched++;
            }
          } else {
            // Enrichment disabled — use search-only
            contact = {
              company_id: company.id, first_name: bestPerson.first_name || null,
              last_name: null, role: (bestPerson.title || '').toLowerCase().includes('owner') ? 'owner' : 'unknown',
              is_owner: (bestPerson.title || '').toLowerCase().includes('owner'),
              email_business: null, email_personal: null, phone_direct: null, linkedin_url: null,
              location: [company.city, company.state].filter(Boolean).join(', ') || null,
              cultural_affinity: null, source: 'apollo'
            };
            sourceMethod = 'apollo_search_only';
            stats.apolloEnriched++;
          }
        } else {
          // Apollo found nobody — try about page
          if (company.domain && !SKIP_WEBSITE_SCRAPE) {
            const additionalPaths = ['/about', '/about-us', '/about-me', '/our-team', '/team', '/our-story'];
            let nameResult = null;
            let usedPath = '';

            for (const path of additionalPaths) {
              try {
                const resp = await this.helpers.httpRequest({
                  method: 'GET',
                  url: `https://${company.domain}${path}`,
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                  returnFullResponse: true, timeout: 10000, json: false,
                });
                const html = resp.body || '';
                if (typeof html === 'string' && html.length > 500) {
                  const found = extractNameFromHtml(html);
                  if (found) { nameResult = found; usedPath = path; break; }
                }
              } catch(e) { /* Path doesn't exist or timed out */ }
            }

            stats.websiteScraped++;
            if (nameResult) {
              stats.websiteFoundName++;
              contact = {
                company_id: company.id, first_name: nameResult.firstName, last_name: nameResult.lastName,
                role: 'owner', is_owner: true, email_business: null, email_personal: null,
                phone_direct: null, linkedin_url: null,
                location: [company.city, company.state].filter(Boolean).join(', ') || null,
                cultural_affinity: null, source: 'website'
              };
              sourceMethod = 'website_scrape_' + usedPath.replace('/', '');
            }
          }
        }
      } catch(e) {
        console.log(`Apollo error for ${company.name} (${company.domain}): ${e.message}`);
      }
    }

    // ── 3. No domain fallback — extract name from business name ──
    if (!contact && !company.domain) {
      stats.noDomainFallback++;
      const nameResult = extractNameFromBusinessName(company);
      if (nameResult) {
        stats.noDomainFoundName++;
        contact = {
          company_id: company.id, first_name: nameResult.firstName, last_name: nameResult.lastName,
          role: 'owner', is_owner: true, email_business: null, email_personal: null,
          phone_direct: null, linkedin_url: null,
          location: [company.city, company.state].filter(Boolean).join(', ') || null,
          cultural_affinity: null, source: 'manual'
        };
        sourceMethod = 'no_domain_name_extraction';
      }
    }

    // ── 4. Validate & clean contact ──
    if (contact) {
      const { contact: cleanedContact, flags, hasValidContact } = validateAndCleanContact(contact);
      if (flags.length > 0) stats.validationIssues++;

      // ── 5. Insert to Supabase (with dedup) ──
      if (hasValidContact) {
        try {
          await this.helpers.httpRequest({
            method: 'POST',
            url: `${supabaseUrl}/rest/v1/contacts?on_conflict=company_id,first_name,last_name,source`,
            headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
            body: cleanedContact,
            json: true
          });
          stats.contactsInserted++;
        } catch(e) {
          console.log(`Contact insert error for ${company.name}: ${e.message}`);
        }
      }
    }

    stats.processed++;
    if (stats.processed % 25 === 0) {
      console.log(`  Progress: ${stats.processed}/${needsContacts.length} companies checked for contacts`);
    }
  } catch(e) {
    console.log(`FATAL error finding contacts for ${company.name}: ${e.message}`);
    stats.errors++;
  }
}

// ═══ SUMMARY ═══
const summary = {
  step: 'find_contacts',
  metro,
  run_completed_at: new Date().toISOString(),
  companies_processed: stats.processed,
  solo_detected: stats.soloDetected,
  solo_with_name: stats.soloWithName,
  apollo_searched: stats.apolloSearched,
  apollo_found_people: stats.apolloFound,
  apollo_contacts_created: stats.apolloEnriched,
  website_scraped: stats.websiteScraped,
  website_names_found: stats.websiteFoundName,
  no_domain_fallback: stats.noDomainFallback,
  no_domain_names_found: stats.noDomainFoundName,
  contacts_inserted: stats.contactsInserted,
  validation_issues: stats.validationIssues,
  fatal_errors: stats.errors,
  message: `Found contacts for ${stats.contactsInserted} of ${stats.processed} companies. Sources: ${stats.soloWithName} solo, ${stats.apolloEnriched} Apollo, ${stats.websiteFoundName} website, ${stats.noDomainFoundName} name extraction. Validation issues: ${stats.validationIssues}.`
};

console.log('=== STEP 3a: FIND CONTACTS SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

// Pass metro + company_ids through for the next node in the chain
return [{ json: { ...summary, metro, company_ids: companyIds } }];
