

**Apollo Sync Workflow**

n8n Implementation Specification

VerveLabs

February 2026  •  v1.0

*Automated Supabase → Apollo pipeline for company accounts, contacts, and custom field sync*

# **1\. Overview**

This document specifies the n8n workflow that automatically syncs enriched spa/massage business data from Supabase to Apollo.io. The workflow triggers after the report creator completes each pipeline run, creating or updating both company accounts and contacts in Apollo with all enriched fields mapped to custom fields.

## **1.1 What This Workflow Does**

* **Creates Apollo custom fields** programmatically on first run (lead\_score, booking\_platform, on\_groupon, etc.)

* **Upserts company Accounts** in Apollo with full enriched data from the companies table

* **Upserts people as Contacts** linked to their company account, with deduplication enabled

* **Tags every record** with a run identifier (e.g., vervelabs-austin-2026-02-25) for filtering and list creation in Apollo

* **Handles rate limits** with batching (25 records) and wait nodes to stay within Apollo Professional plan limits

## **1.2 Trigger & Placement**

The Apollo sync workflow is a separate n8n workflow triggered after the report creator workflow completes. It polls Supabase for companies where enrichment\_status \= 'fully\_enriched' and apollo\_synced\_at IS NULL (or older than the last enriched\_at). This pattern matches the existing report creator trigger approach.

## **1.3 Apollo API Details**

| Parameter | Value |
| :---- | :---- |
| Plan | Professional |
| Rate Limit | \~100 requests/min general, \~10/min bulk operations |
| Bulk Create Contacts | Up to 100 per request |
| Bulk Create Accounts | Up to 100 per request (no dedup — workflow handles it) |
| Auth Header | x-api-key: YOUR\_MASTER\_KEY (master key required) |
| Base URL | https://api.apollo.io/api/v1 |
| Dedup (Contacts) | run\_dedupe=true on create; searches by email first |
| Dedup (Accounts) | Search by domain before create; update if found |

# **2\. Supabase Schema Additions**

Add tracking columns to the existing companies and contacts tables so the workflow knows what has been synced and can do upserts on subsequent runs.

## **2.1 SQL Migration**

\-- Add Apollo tracking columns to companies  
ALTER TABLE companies  
  ADD COLUMN IF NOT EXISTS apollo\_account\_id TEXT,  
  ADD COLUMN IF NOT EXISTS apollo\_synced\_at TIMESTAMPTZ;

\-- Add Apollo tracking columns to contacts  
ALTER TABLE contacts  
  ADD COLUMN IF NOT EXISTS apollo\_contact\_id TEXT,  
  ADD COLUMN IF NOT EXISTS apollo\_synced\_at TIMESTAMPTZ;

\-- Index for sync queries  
CREATE INDEX IF NOT EXISTS idx\_companies\_apollo\_sync  
  ON companies (enrichment\_status, apollo\_synced\_at);

# **3\. Workflow Architecture**

The workflow consists of 5 sequential phases. Each phase completes before the next begins. Processing uses batches of 25 companies to stay within VPS memory limits and Apollo rate limits.

| Phase | Name | Purpose | Apollo Endpoint |
| :---- | :---- | :---- | :---- |
| 1 | Setup Custom Fields | Create missing custom fields | POST /fields |
| 2 | Fetch Unsynced Data | Query Supabase for records to sync | N/A (Supabase) |
| 3 | Upsert Accounts | Create/update company accounts | POST /accounts, PATCH /accounts/{id} |
| 4 | Upsert Contacts | Create/update contact records | POST /contacts, PATCH /contacts/{id} |
| 5 | Mark Synced | Update Supabase tracking columns | N/A (Supabase) |

# **4\. Phase 1: Custom Field Setup**

On every run, the workflow checks if required custom fields exist in Apollo. If any are missing, it creates them. This is idempotent — existing fields are skipped.

## **4.1 Account Custom Fields (Companies)**

| Field Name | Type | Apollo Type | Source Column |
| :---- | :---- | :---- | :---- |
| Lead Score | Number | number | companies.lead\_score |
| Has Website | Boolean | boolean | companies.has\_website |
| Has Online Booking | Boolean | boolean | companies.has\_online\_booking |
| Booking Platform | Text | text | companies.booking\_platform |
| Has Paid Ads | Boolean | boolean | companies.has\_paid\_ads |
| On Groupon | Boolean | boolean | companies.on\_groupon |
| On Yelp | Boolean | boolean | companies.on\_yelp |
| Google Review Count | Number | number | companies.google\_review\_count |
| Google Rating | Number | number | companies.google\_rating |
| Estimated Size | Text | text | companies.estimated\_size |
| Enrichment Status | Text | text | companies.enrichment\_status |
| Category | Text | text | companies.category |
| VerveLabs Run Tag | Text | text | Generated per run |

## **4.2 Contact Custom Fields**

| Field Name | Type | Apollo Type | Source Column |
| :---- | :---- | :---- | :---- |
| Cultural Affinity | Text | text | contacts.cultural\_affinity |
| Is Owner | Boolean | boolean | contacts.is\_owner |
| Contact Role | Text | text | contacts.role |
| Contact Source | Text | text | contacts.source |
| VerveLabs Run Tag | Text | text | Generated per run |

## **4.3 Code Node: Setup Custom Fields**

*This Code node runs once at workflow start. It checks existing fields and creates any that are missing. Mode: runOnceForAllItems.*

// Phase 1: Setup Custom Fields  
// Mode: runOnceForAllItems

const APOLLO\_API\_KEY \= $('Set Config').item.json.apollo\_api\_key;  
const BASE\_URL \= 'https://api.apollo.io/api/v1';

const ACCOUNT\_FIELDS \= \[  
  { label: 'Lead Score', field\_type: 'number' },  
  { label: 'Has Website', field\_type: 'boolean' },  
  { label: 'Has Online Booking', field\_type: 'boolean' },  
  { label: 'Booking Platform', field\_type: 'text\_field' },  
  { label: 'Has Paid Ads', field\_type: 'boolean' },  
  { label: 'On Groupon', field\_type: 'boolean' },  
  { label: 'On Yelp', field\_type: 'boolean' },  
  { label: 'Google Review Count', field\_type: 'number' },  
  { label: 'Google Rating', field\_type: 'number' },  
  { label: 'Estimated Size', field\_type: 'text\_field' },  
  { label: 'Enrichment Status', field\_type: 'text\_field' },  
  { label: 'Category', field\_type: 'text\_field' },  
  { label: 'VerveLabs Run Tag', field\_type: 'text\_field' },  
\];

const CONTACT\_FIELDS \= \[  
  { label: 'Cultural Affinity', field\_type: 'text\_field' },  
  { label: 'Is Owner', field\_type: 'boolean' },  
  { label: 'Contact Role', field\_type: 'text\_field' },  
  { label: 'Contact Source', field\_type: 'text\_field' },  
  { label: 'VerveLabs Run Tag', field\_type: 'text\_field' },  
\];

// Fetch existing custom fields  
let existingFields \= \[\];  
try {  
  const res \= await fetch(\`${BASE\_URL}/fields\`, {  
    method: 'GET',  
    headers: {  
      'Content-Type': 'application/json',  
      'x-api-key': APOLLO\_API\_KEY,  
      'Cache-Control': 'no-cache'  
    }  
  });  
  const data \= await res.json();  
  existingFields \= data.fields || \[\];  
} catch (e) {  
  // If listing fails, proceed anyway \- creates are idempotent  
  console.log('Could not list existing fields:', e.message);  
}

const existingLabels \= new Set(  
  existingFields.map(f \=\> f.label?.toLowerCase())  
);

const results \= { created: \[\], skipped: \[\], errors: \[\] };

// Create account custom fields  
for (const field of ACCOUNT\_FIELDS) {  
  if (existingLabels.has(field.label.toLowerCase())) {  
    results.skipped.push(field.label);  
    continue;  
  }  
  try {  
    const res \= await fetch(\`${BASE\_URL}/fields\`, {  
      method: 'POST',  
      headers: {  
        'Content-Type': 'application/json',  
        'x-api-key': APOLLO\_API\_KEY  
      },  
      body: JSON.stringify({  
        label: field.label,  
        field\_type: field.field\_type,  
        modality: 'account'  
      })  
    });  
    if (res.ok) {  
      results.created.push(field.label);  
    } else {  
      const errData \= await res.json();  
      results.errors.push(  
        \`${field.label}: ${JSON.stringify(errData)}\`  
      );  
    }  
    // Rate limit: wait 700ms between calls  
    await new Promise(r \=\> setTimeout(r, 700));  
  } catch (e) {  
    results.errors.push(\`${field.label}: ${e.message}\`);  
  }  
}

// Create contact custom fields  
for (const field of CONTACT\_FIELDS) {  
  if (existingLabels.has(field.label.toLowerCase())) {  
    results.skipped.push(field.label);  
    continue;  
  }  
  try {  
    const res \= await fetch(\`${BASE\_URL}/fields\`, {  
      method: 'POST',  
      headers: {  
        'Content-Type': 'application/json',  
        'x-api-key': APOLLO\_API\_KEY  
      },  
      body: JSON.stringify({  
        label: field.label,  
        field\_type: field.field\_type,  
        modality: 'contact'  
      })  
    });  
    if (res.ok) {  
      results.created.push(field.label);  
    } else {  
      const errData \= await res.json();  
      results.errors.push(  
        \`${field.label}: ${JSON.stringify(errData)}\`  
      );  
    }  
    await new Promise(r \=\> setTimeout(r, 700));  
  } catch (e) {  
    results.errors.push(\`${field.label}: ${e.message}\`);  
  }  
}

return \[{  
  json: {  
    phase: 'custom\_fields\_setup',  
    ...results  
  }  
}\];

# **5\. Phase 2: Fetch Unsynced Data**

This phase queries Supabase for all fully\_enriched companies that have not been synced to Apollo yet (or have been re-enriched since last sync). It also fetches the associated contacts for each company.

## **5.1 Code Node: Fetch Companies \+ Contacts**

*Mode: runOnceForAllItems. Uses Supabase REST API with service key.*

// Phase 2: Fetch Unsynced Data from Supabase  
// Mode: runOnceForAllItems

const SUPABASE\_URL \= $('Set Config').item.json.supabase\_url;  
const SUPABASE\_KEY \= $('Set Config').item.json.supabase\_service\_key;  
const RUN\_TAG \= $('Set Config').item.json.run\_tag;

const headers \= {  
  'apikey': SUPABASE\_KEY,  
  'Authorization': \`Bearer ${SUPABASE\_KEY}\`,  
  'Content-Type': 'application/json',  
  'Prefer': 'return=representation'  
};

// Fetch companies needing sync  
// Condition: fully\_enriched AND (never synced OR re-enriched since last sync)  
const companiesRes \= await fetch(  
  \`${SUPABASE\_URL}/rest/v1/companies?enrichment\_status=eq.fully\_enriched\&or=(apollo\_synced\_at.is.null,enriched\_at.gt.apollo\_synced\_at)\&select=\*\&order=city,name\&limit=500\`,  
  { headers }  
);  
const companies \= await companiesRes.json();

if (\!companies || companies.length \=== 0\) {  
  return \[{ json: { phase: 'fetch', companies: \[\], message: 'No unsynced companies found' } }\];  
}

// Fetch contacts for these companies  
const companyIds \= companies.map(c \=\> c.id);  
const contactsRes \= await fetch(  
  \`${SUPABASE\_URL}/rest/v1/contacts?company\_id=in.(${companyIds.join(',')})\&select=\*\`,  
  { headers }  
);  
const contacts \= await contactsRes.json();

// Group contacts by company\_id  
const contactsByCompany \= {};  
for (const contact of contacts) {  
  if (\!contactsByCompany\[contact.company\_id\]) {  
    contactsByCompany\[contact.company\_id\] \= \[\];  
  }  
  contactsByCompany\[contact.company\_id\].push(contact);  
}

// Emit one item per company with its contacts attached  
return companies.map(company \=\> ({  
  json: {  
    company,  
    contacts: contactsByCompany\[company.id\] || \[\],  
    run\_tag: RUN\_TAG  
  }  
}));

# **6\. Phase 3: Upsert Accounts (Companies)**

For each company, the workflow searches Apollo for an existing account by domain. If found, it updates the account. If not found, it creates a new one. Custom fields are populated using the custom\_fields object in the API payload.

## **6.1 Important: Apollo Account Dedup**

Unlike contacts, Apollo's Account API does not have a built-in dedup parameter. The workflow searches by domain first (POST /accounts/search with q\_organization\_domains), and if a match is found, updates that account via PATCH. If no match, it creates via POST.

## **6.2 Code Node: Upsert Account**

*Mode: runOnceForEachItem. Processes one company at a time with rate limiting.*

// Phase 3: Upsert Account in Apollo  
// Mode: runOnceForEachItem

const APOLLO\_API\_KEY \= $('Set Config').item.json.apollo\_api\_key;  
const BASE\_URL \= 'https://api.apollo.io/api/v1';  
const company \= $input.item.json.company;  
const contacts \= $input.item.json.contacts;  
const run\_tag \= $input.item.json.run\_tag;

const apiHeaders \= {  
  'Content-Type': 'application/json',  
  'x-api-key': APOLLO\_API\_KEY,  
  'Cache-Control': 'no-cache'  
};

// Build custom fields payload  
// NOTE: Apollo custom field keys use the format from  
// GET /fields response. You may need to map label \-\> key  
// after first run. The keys look like: 'custom\_field\_abc123'  
const customFields \= {  
  'Lead Score': company.lead\_score || 0,  
  'Has Website': company.has\_website || false,  
  'Has Online Booking': company.has\_online\_booking || false,  
  'Booking Platform': company.booking\_platform || '',  
  'Has Paid Ads': company.has\_paid\_ads || false,  
  'On Groupon': company.on\_groupon || false,  
  'On Yelp': company.on\_yelp || false,  
  'Google Review Count': company.google\_review\_count || 0,  
  'Google Rating': parseFloat(company.google\_rating) || 0,  
  'Estimated Size': company.estimated\_size || '',  
  'Enrichment Status': company.enrichment\_status || '',  
  'Category': company.category || '',  
  'VerveLabs Run Tag': run\_tag  
};

let apolloAccountId \= company.apollo\_account\_id;  
let action \= 'skipped';

try {  
  // Step 1: Search for existing account by domain  
  if (company.domain && \!apolloAccountId) {  
    const searchRes \= await fetch(  
      \`${BASE\_URL}/accounts/search\`,  
      {  
        method: 'POST',  
        headers: apiHeaders,  
        body: JSON.stringify({  
          q\_organization\_domains: company.domain,  
          page: 1,  
          per\_page: 1  
        })  
      }  
    );  
    const searchData \= await searchRes.json();  
    if (searchData.accounts && searchData.accounts.length \> 0\) {  
      apolloAccountId \= searchData.accounts\[0\].id;  
    }  
    await new Promise(r \=\> setTimeout(r, 700));  
  }

  // Step 2: Build account payload  
  const accountPayload \= {  
    name: company.name,  
    domain: company.domain || undefined,  
    phone\_number: company.phone || undefined,  
    raw\_address: company.address || undefined,  
    city: company.city || undefined,  
    state: company.state || undefined,  
    country: company.country || 'US',  
    website\_url: company.domain  
      ? \`https://${company.domain}\` : undefined,  
    custom\_fields: customFields  
  };

  // Step 3: Update or Create  
  if (apolloAccountId) {  
    // UPDATE existing account  
    const updateRes \= await fetch(  
      \`${BASE\_URL}/accounts/${apolloAccountId}\`,  
      {  
        method: 'PATCH',  
        headers: apiHeaders,  
        body: JSON.stringify(accountPayload)  
      }  
    );  
    if (updateRes.ok) {  
      action \= 'updated';  
    } else {  
      const err \= await updateRes.json();  
      action \= \`update\_error: ${JSON.stringify(err)}\`;  
    }  
  } else {  
    // CREATE new account  
    const createRes \= await fetch(  
      \`${BASE\_URL}/accounts\`,  
      {  
        method: 'POST',  
        headers: apiHeaders,  
        body: JSON.stringify(accountPayload)  
      }  
    );  
    const createData \= await createRes.json();  
    if (createRes.ok && createData.account) {  
      apolloAccountId \= createData.account.id;  
      action \= 'created';  
    } else {  
      action \= \`create\_error: ${JSON.stringify(createData)}\`;  
    }  
  }

  // Rate limit pause  
  await new Promise(r \=\> setTimeout(r, 700));

} catch (e) {  
  action \= \`exception: ${e.message}\`;  
}

return {  
  json: {  
    company,  
    contacts,  
    run\_tag,  
    apollo\_account\_id: apolloAccountId,  
    account\_action: action  
  }  
};

# **7\. Phase 4: Upsert Contacts**

For each company's contacts, the workflow creates or updates the contact in Apollo, linked to the account created in Phase 3\. Deduplication is enabled via run\_dedupe=true which searches by email. Contacts without email are still pushed (as requested).

## **7.1 Code Node: Upsert Contacts**

*Mode: runOnceForEachItem. Processes each company's contacts sequentially.*

// Phase 4: Upsert Contacts in Apollo  
// Mode: runOnceForEachItem

const APOLLO\_API\_KEY \= $('Set Config').item.json.apollo\_api\_key;  
const BASE\_URL \= 'https://api.apollo.io/api/v1';  
const company \= $input.item.json.company;  
const contacts \= $input.item.json.contacts;  
const run\_tag \= $input.item.json.run\_tag;  
const apolloAccountId \= $input.item.json.apollo\_account\_id;

const apiHeaders \= {  
  'Content-Type': 'application/json',  
  'x-api-key': APOLLO\_API\_KEY,  
  'Cache-Control': 'no-cache'  
};

const contactResults \= \[\];

for (const contact of contacts) {  
  try {  
    let apolloContactId \= contact.apollo\_contact\_id;  
    let action \= 'skipped';

    const contactCustomFields \= {  
      'Cultural Affinity': contact.cultural\_affinity || '',  
      'Is Owner': contact.is\_owner || false,  
      'Contact Role': contact.role || 'unknown',  
      'Contact Source': contact.source || '',  
      'VerveLabs Run Tag': run\_tag  
    };

    const contactPayload \= {  
      first\_name: contact.first\_name || '',  
      last\_name: contact.last\_name || '',  
      organization\_name: company.name,  
      account\_id: apolloAccountId || undefined,  
      title: contact.role \=== 'owner' ? 'Owner'  
        : contact.role \=== 'manager' ? 'Manager'  
        : contact.role \=== 'practitioner'  
          ? 'Practitioner' : undefined,  
      email: contact.email\_business  
        || contact.email\_personal || undefined,  
      direct\_phone: contact.phone\_direct || undefined,  
      corporate\_phone: company.phone || undefined,  
      linkedin\_url: contact.linkedin\_url || undefined,  
      present\_raw\_address: contact.location  
        || company.address || undefined,  
      custom\_fields: contactCustomFields  
    };

    if (apolloContactId) {  
      // UPDATE existing contact  
      const updateRes \= await fetch(  
        \`${BASE\_URL}/contacts/${apolloContactId}\`,  
        {  
          method: 'PATCH',  
          headers: apiHeaders,  
          body: JSON.stringify(contactPayload)  
        }  
      );  
      action \= updateRes.ok ? 'updated' : 'update\_error';  
    } else {  
      // CREATE with dedup enabled  
      contactPayload.run\_dedupe \= true;  
      const createRes \= await fetch(  
        \`${BASE\_URL}/contacts\`,  
        {  
          method: 'POST',  
          headers: apiHeaders,  
          body: JSON.stringify(contactPayload)  
        }  
      );  
      const createData \= await createRes.json();  
      if (createRes.ok && createData.contact) {  
        apolloContactId \= createData.contact.id;  
        action \= 'created';  
      } else {  
        action \= \`create\_error: ${JSON.stringify(createData)}\`;  
      }  
    }

    contactResults.push({  
      supabase\_contact\_id: contact.id,  
      apollo\_contact\_id: apolloContactId,  
      name: \`${contact.first\_name} ${contact.last\_name}\`,  
      action  
    });

    // Rate limit: 700ms between API calls  
    await new Promise(r \=\> setTimeout(r, 700));

  } catch (e) {  
    contactResults.push({  
      supabase\_contact\_id: contact.id,  
      name: \`${contact.first\_name} ${contact.last\_name}\`,  
      action: \`exception: ${e.message}\`  
    });  
  }  
}

return {  
  json: {  
    company\_id: company.id,  
    company\_name: company.name,  
    apollo\_account\_id: apolloAccountId,  
    account\_action: $input.item.json.account\_action,  
    contact\_results: contactResults  
  }  
};

# **8\. Phase 5: Mark Synced in Supabase**

After successful Apollo sync, update the tracking columns in Supabase so these records are not re-processed on the next run (unless they get re-enriched).

## **8.1 Code Node: Update Sync Status**

*Mode: runOnceForEachItem. Updates each company and its contacts.*

// Phase 5: Mark Synced in Supabase  
// Mode: runOnceForEachItem

const SUPABASE\_URL \= $('Set Config').item.json.supabase\_url;  
const SUPABASE\_KEY \= $('Set Config').item.json.supabase\_service\_key;  
const item \= $input.item.json;  
const now \= new Date().toISOString();

const headers \= {  
  'apikey': SUPABASE\_KEY,  
  'Authorization': \`Bearer ${SUPABASE\_KEY}\`,  
  'Content-Type': 'application/json',  
  'Prefer': 'resolution=merge-duplicates'  
};

const results \= { company: null, contacts: \[\] };

try {  
  // Update company apollo\_account\_id \+ apollo\_synced\_at  
  if (item.apollo\_account\_id) {  
    const compRes \= await fetch(  
      \`${SUPABASE\_URL}/rest/v1/companies?id=eq.${item.company\_id}\`,  
      {  
        method: 'PATCH',  
        headers,  
        body: JSON.stringify({  
          apollo\_account\_id: item.apollo\_account\_id,  
          apollo\_synced\_at: now  
        })  
      }  
    );  
    results.company \= compRes.ok ? 'synced' : 'error';  
  }

  // Update each contact's apollo\_contact\_id \+ apollo\_synced\_at  
  for (const cr of (item.contact\_results || \[\])) {  
    if (cr.apollo\_contact\_id && cr.supabase\_contact\_id) {  
      const ctRes \= await fetch(  
        \`${SUPABASE\_URL}/rest/v1/contacts?id=eq.${cr.supabase\_contact\_id}\`,  
        {  
          method: 'PATCH',  
          headers,  
          body: JSON.stringify({  
            apollo\_contact\_id: cr.apollo\_contact\_id,  
            apollo\_synced\_at: now  
          })  
        }  
      );  
      results.contacts.push({  
        id: cr.supabase\_contact\_id,  
        status: ctRes.ok ? 'synced' : 'error'  
      });  
    }  
  }  
} catch (e) {  
  results.error \= e.message;  
}

return {  
  json: {  
    company\_id: item.company\_id,  
    company\_name: item.company\_name,  
    sync\_results: results  
  }  
};

# **9\. n8n Workflow Setup Guide**

## **9.1 Workflow Nodes (in order)**

| \# | Node Name | Type | Notes |
| :---- | :---- | :---- | :---- |
| 1 | Schedule Trigger | Cron | Runs after report creator (e.g. every 30 min, or use webhook from report workflow) |
| 2 | Set Config | Set Node | Sets apollo\_api\_key, supabase\_url, supabase\_service\_key, run\_tag (auto-generated) |
| 3 | Setup Custom Fields | Code | Phase 1: Creates missing custom fields in Apollo |
| 4 | Fetch Unsynced | Code | Phase 2: Queries Supabase for companies \+ contacts to sync |
| 5 | IF Has Data | IF | Check if any companies returned; stop if empty |
| 6 | Split In Batches | Split In Batches | Batch size: 25\. Processes companies in manageable chunks. |
| 7 | Upsert Account | Code | Phase 3: Search \+ create/update account in Apollo |
| 8 | Wait | Wait | 2 second pause between batches for rate limiting |
| 9 | Upsert Contacts | Code | Phase 4: Create/update contacts linked to account |
| 10 | Mark Synced | Code | Phase 5: Update Supabase tracking columns |
| 11 | Log Summary | Code | Logs final counts: created, updated, errors |

## **9.2 Set Config Node**

This Set node initializes all configuration values. The run\_tag is auto-generated from the current date and a metro identifier.

// Set Node fields:  
apollo\_api\_key:      {{ $env.APOLLO\_API\_KEY }}  
supabase\_url:        {{ $env.SUPABASE\_URL }}  
supabase\_service\_key:{{ $env.SUPABASE\_SERVICE\_KEY }}  
run\_tag:             vervelabs-{{ $now.format('yyyy-MM-dd-HHmm') }}

## **9.3 IF Has Data Node**

Condition: Check that the output from Fetch Unsynced contains items. Use expression: {{ $input.all().length \> 0 }}. If false (no data), workflow stops cleanly.

## **9.4 Environment Variables Required**

| Variable | Description |
| :---- | :---- |
| APOLLO\_API\_KEY | Apollo master API key (Settings \> Integrations \> API) |
| SUPABASE\_URL | Your Supabase project URL (e.g. https://xyz.supabase.co) |
| SUPABASE\_SERVICE\_KEY | Supabase service\_role key (bypasses RLS) |

# **10\. Custom Field Key Mapping (Post-First-Run)**

After the first run creates custom fields, Apollo assigns internal key IDs (e.g., custom\_field\_abc123). The code nodes reference fields by label name, which works with Apollo's API. However, if you encounter issues, you can map labels to keys by calling GET /fields and updating the code nodes to use the key IDs instead.

To get the mapping, run this in an n8n Code node:

const res \= await fetch(  
  'https://api.apollo.io/api/v1/fields',  
  {  
    headers: {  
      'x-api-key': 'YOUR\_MASTER\_KEY',  
      'Content-Type': 'application/json'  
    }  
  }  
);  
const data \= await res.json();  
const mapping \= data.fields  
  .filter(f \=\> f.label.startsWith('Lead') ||  
    f.label.startsWith('Has') ||  
    f.label.startsWith('On') ||  
    f.label.startsWith('Google') ||  
    f.label.startsWith('VerveLabs'))  
  .map(f \=\> ({ label: f.label, key: f.key }));  
return \[{ json: { field\_mapping: mapping } }\];

# **11\. List & Tagging Strategy**

Apollo does not have an API endpoint to programmatically create lists. Instead, this workflow uses two complementary strategies to organize records by run:

* **VerveLabs Run Tag custom field:** Every account and contact gets a run tag value like 'vervelabs-2026-02-25-0800'. In Apollo, you can filter by this field and save the filter as a list.

* **Apollo Tags (optional enhancement):** You can also use the 'label\_names' parameter on contact creation to auto-tag contacts. If the tag doesn't exist, Apollo creates it. Add label\_names: \[run\_tag\] to the contact payload.

## **11.1 Creating Lists in Apollo from Tags**

After a sync run completes, create filtered lists in Apollo's UI: go to People or Companies, filter by 'VerveLabs Run Tag' \= your run tag value, select all results, and click 'Add to list' \> 'Create new list'. This takes under 30 seconds and gives you a permanent list per run.

*For metro-specific lists, add the metro name to the run tag (e.g., vervelabs-austin-2026-02-25) and include a metro field in the Set Config node. The fetch query can be filtered by city to process one metro at a time.*

# **12\. Error Handling & Retry Logic**

* **HTTP 429 (Rate Limited):** The 700ms delay between API calls prevents most rate limiting. If 429s still occur, increase the delay to 1200ms or reduce batch size to 15\.

* **HTTP 403 (Forbidden):** Verify you're using a master API key. Non-master keys cannot access most write endpoints.

* **Duplicate contacts:** run\_dedupe=true on create handles this. Existing contacts matching by email are returned without creating duplicates.

* **Partial failures:** Each company processes independently. A failure on one company does not stop others. The Mark Synced phase only updates records that succeeded.

* **Workflow retry:** Safe to re-run. The Supabase query only picks up unsynced or re-enriched records. Already-synced records are skipped.

# **13\. Testing Checklist**

1. Run the SQL migration (Section 2.1) against your Supabase project

2. Set environment variables in n8n (APOLLO\_API\_KEY, SUPABASE\_URL, SUPABASE\_SERVICE\_KEY)

3. Run workflow manually with a small test batch (set LIMIT to 5 in the Supabase query)

4. Verify custom fields were created in Apollo (Settings \> Objects, fields, stages \> Account/Contact fields)

5. Verify accounts appear in Apollo (Companies tab, search by name)

6. Verify contacts appear linked to correct accounts (People tab, filter by VerveLabs Run Tag)

7. Check custom field values populated correctly on a sample account and contact

8. Verify Supabase tracking columns updated (apollo\_account\_id, apollo\_synced\_at)

9. Re-run workflow and confirm no duplicates created (idempotency check)

10. Enable schedule trigger and monitor first automated run

# **14\. Cost Impact**

The Apollo sync workflow uses only write/update operations, which do not consume Apollo enrichment credits. Creating contacts and accounts via API is free of credit charges. The only potential credit usage would be if you enable waterfall enrichment parameters on the create contact calls, which this workflow does not do.

API rate limit usage: For a typical run of 200 companies with 250 contacts, expect approximately 650-700 API calls (search \+ create/update per company \+ create/update per contact \+ field setup). At \~85 calls per minute (with 700ms delays), a full run takes approximately 8-10 minutes.