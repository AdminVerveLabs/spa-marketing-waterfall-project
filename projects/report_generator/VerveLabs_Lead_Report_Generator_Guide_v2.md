# VerveLabs — Sales Lead Report Generator (v2)

## Purpose

This guide tells Claude Code exactly how to generate a cleaned, tiered, sales-ready `.xlsx` report from the VerveLabs Supabase database. Run this after any pipeline enrichment pass (new metro, re-enrichment, etc.) to produce a downloadable report for the sales team.

**What changed in v2:**
- New 4-tier contactability-based tiering system (1a/1b/2a/2b)
- Social media columns (Instagram, Facebook, TikTok, YouTube, LinkedIn)
- Owner confirmation, cultural affinity, contact source tracking
- Contactability SQL filter (only pull sendable leads + all others separately)
- Metro grouping (suburbs → parent metro)
- Tier vs. Score explainer on Summary sheet
- Per-metro sheets, Tier 2a/2b breakout sheets, and "All Other Leads" sheet
- Updated junk category list

---

## 1. Data Source

Query the Supabase REST API or SQL Editor to pull companies joined with their best contact (owner preferred) and aggregated social profiles.

### Database Tables

- **`companies`** — business records with enrichment data
- **`contacts`** — people associated with each company (may have multiple per company)
- **`social_profiles`** — social media presence (one row per platform per company)

### Supabase SQL Query

```sql
SELECT
  c.lead_score,
  c.discovery_metro,
  c.city || ', ' || c.state AS metro,
  c.name AS company_name,
  c.category,
  c.estimated_size,
  c.enrichment_status,
  COALESCE(ct.first_name || ' ' || ct.last_name, NULL) AS contact_name,
  ct.role AS contact_role,
  ct.is_owner AS owner,
  ct.email_business AS contact_email,
  ct.phone_direct AS contact_phone,
  ct.cultural_affinity,
  ct.linkedin_url,
  ct.source AS contact_source,
  c.phone AS company_phone,
  c.domain AS website,
  c.address,
  c.city,
  c.state,
  c.google_rating,
  c.google_review_count AS google_reviews,
  c.has_online_booking AS has_booking,
  c.booking_platform,
  c.on_groupon,

  -- Social profiles (aggregated into 1 row per company)
  sp.social_platforms,
  sp.instagram_url,
  sp.instagram_followers,
  sp.facebook_url,
  sp.facebook_followers,
  sp.tiktok_url,
  sp.youtube_url,
  sp.total_social_followers,
  sp.most_recent_post

FROM companies c

-- Best contact (1 per company, owner preferred)
LEFT JOIN LATERAL (
  SELECT *
  FROM contacts
  WHERE company_id = c.id
  ORDER BY
    is_owner DESC,
    (email_business IS NOT NULL) DESC,
    (phone_direct IS NOT NULL) DESC,
    created_at ASC
  LIMIT 1
) ct ON true

-- Social profiles (aggregated into 1 row per company)
LEFT JOIN LATERAL (
  SELECT
    string_agg(platform, ', ' ORDER BY platform) AS social_platforms,
    MAX(profile_url) FILTER (WHERE platform = 'instagram') AS instagram_url,
    MAX(follower_count) FILTER (WHERE platform = 'instagram') AS instagram_followers,
    MAX(profile_url) FILTER (WHERE platform = 'facebook') AS facebook_url,
    MAX(follower_count) FILTER (WHERE platform = 'facebook') AS facebook_followers,
    MAX(profile_url) FILTER (WHERE platform = 'tiktok') AS tiktok_url,
    MAX(profile_url) FILTER (WHERE platform = 'youtube') AS youtube_url,
    COALESCE(SUM(follower_count), 0) AS total_social_followers,
    MAX(last_post_date) AS most_recent_post
  FROM social_profiles
  WHERE company_id = c.id
) sp ON true

WHERE
  c.enrichment_status != 'needs_review'

  AND c.category NOT IN (
    'Transportation Service',
    'Car repair and maintenance service',
    'Corporate Office',
    'Car Rental Agency',
    'Educational Institution',
    'Association / Organization',
    'Storage Facility',
    'Shipping Service',
    'Car Dealer'
  )

ORDER BY c.lead_score DESC, c.google_review_count DESC;
```

> **Note:** This query returns ALL companies (sendable + not sendable). The Python script handles tiering and splits them into appropriate sheets. Do NOT add a contactability filter in SQL — we want "All Other Leads" for the separate tab.

### Environment Variables Required

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
```

### Fetching via REST API (Python)

```python
import requests, os

url = f"{os.environ['SUPABASE_URL']}/rest/v1/rpc/get_lead_report"
headers = {
    "apikey": os.environ["SUPABASE_SERVICE_KEY"],
    "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_KEY']}",
    "Content-Type": "application/json"
}
response = requests.post(url, headers=headers)
data = response.json()
```

If using a CSV export instead:
```python
import pandas as pd
df = pd.read_csv('export.csv')
```

---

## 2. Cleaning Rules

Apply these transformations in order.

### 2a. Remove Junk Records

```python
JUNK_CATEGORIES = [
    'Transportation Service',
    'Car repair and maintenance service',
    'Corporate Office',
    'Car Rental Agency',
    'Educational Institution',
    'Association / Organization',
    'Storage Facility',
    'Shipping Service',
    'Car Dealer',
]
df = df[~df['category'].isin(JUNK_CATEGORIES)].copy()
```

> **Why these exist:** Google Places and Yelp sometimes return businesses that match on acronyms (e.g., "RMT" = Registered Massage Therapist but also "RMT Henderson" = a transport company). Massage schools and professional associations also get pulled in but aren't sales prospects.

### 2b. Normalize Null Values

```python
for col in df.columns:
    df[col] = df[col].replace(['null', '', 'None'], pd.NA)
```

### 2c. Simplify Category Labels

Yelp returns verbose multi-category strings. Collapse them into clean labels:

```python
def simplify_category(cat):
    if pd.isna(cat): return 'Unknown'
    cat_lower = cat.lower()
    if 'spa' in cat_lower and 'massage' in cat_lower: return 'Massage Spa'
    if 'day spa' in cat_lower: return 'Day Spa'
    if 'spa' in cat_lower: return 'Spa'
    if 'massage' in cat_lower: return 'Massage'
    if 'wellness' in cat_lower: return 'Wellness Center'
    if 'chiro' in cat_lower: return 'Chiropractor'
    if 'physical therap' in cat_lower: return 'Physical Therapist'
    if 'nail salon' in cat_lower: return 'Nail Salon'
    if 'hair salon' in cat_lower or 'beauty salon' in cat_lower: return 'Salon'
    if 'medical' in cat_lower or 'doctor' in cat_lower or 'health' in cat_lower: return 'Health & Medical'
    return cat

df['category_clean'] = df['category'].apply(simplify_category)
```

### 2d. Metro Grouping

Suburbs get grouped into their parent metro area so reports aren't fragmented across 50+ tiny city entries:

```python
def normalize_metro(row):
    metro = str(row.get('metro', ''))
    state = str(row.get('state', ''))

    # Arizona - Sedona area
    if state == 'AZ' and any(x in metro for x in [
        'Sedona', 'Cornville', 'Cottonwood', 'Camp Verde',
        'Rimrock', 'Big Park', 'Clarkdale', 'Flagstaff'
    ]):
        return 'Sedona Area, AZ'

    # Arizona - Phoenix metro
    if state == 'AZ' and any(x in metro for x in [
        'Scottsdale', 'Phoenix', 'Tempe', 'Mesa', 'Glendale',
        'Gilbert', 'Paradise Valley', 'Chandler', 'Fountain Hills',
        'Carefree', 'Apache Junction'
    ]):
        return 'Phoenix Metro, AZ'

    # Tennessee → Nashville
    if state == 'TN': return 'Nashville Area, TN'

    # Texas → Austin
    if state == 'TX': return 'Austin Area, TX'

    # California → San Diego
    if state == 'CA': return 'San Diego Area, CA'

    # Idaho → Boise
    if state == 'ID': return 'Boise Area, ID'

    return metro

df['metro_group'] = df.apply(normalize_metro, axis=1)
```

> **Extending this:** When adding new metros, add the suburb-to-parent mappings here. Use `discovery_metro` from the SQL query as a reference for which metros are in play.

### 2e. Deduplicate

```python
df = df.drop_duplicates(subset=['company_name'], keep='first')
```

---

## 3. Tiering Logic

Tier every lead by **contactability** — can the sales team actually reach this business? Four tiers based on verified contact data quality.

```python
def assign_tier(row):
    has_name = pd.notna(row.get('contact_name')) and str(row.get('contact_name', '')).strip() != ''
    has_email = pd.notna(row.get('contact_email')) and str(row.get('contact_email', '')).strip() != ''
    has_cphone = pd.notna(row.get('contact_phone')) and str(row.get('contact_phone', '')).strip() != ''
    has_website = pd.notna(row.get('website')) and str(row.get('website', '')).strip() != ''
    has_rating = pd.notna(row.get('google_rating'))
    has_co_phone = pd.notna(row.get('company_phone')) and str(row.get('company_phone', '')).strip() != ''

    # Tier 1a: Contact name + email + phone (gold standard)
    if has_name and has_email and has_cphone:
        return '1a - Name + Email + Phone'

    # Tier 1b: Contact name + at least one channel
    if has_name and (has_email or has_cphone):
        return '1b - Name + Channel'

    # Tier 2a: Direct contact phone + website (no name)
    if has_cphone and has_website:
        return '2a - Phone + Website'

    # Tier 2b: Company phone + website + rating (cold call quality)
    if has_co_phone and has_website and has_rating:
        return '2b - Co.Phone + Web + Rating'

    # Everything else
    return 'Other'

df['tier'] = df.apply(assign_tier, axis=1)
```

### Tier Definitions

| Tier | Meaning | How to Work It |
|------|---------|----------------|
| **1a - Name + Email + Phone** | Best leads. Contact name, email, and phone all present. | Call by name, follow up by email. |
| **1b - Name + Channel** | Contact name + either email or phone. | Call by name (or email if no phone). |
| **2a - Phone + Website** | Direct contact phone + website but no contact name. | Research the website, then call. |
| **2b - Co.Phone + Web + Rating** | Company phone + website + Google rating. Enough for a cold call. | Call and ask for the owner/manager. |
| **Other** | Missing key data. Not sendable yet. | Included in "All Other Leads" tab for reference. May become sendable after further enrichment. |

### Splitting Sendable vs Other

```python
sendable = df[df['tier'] != 'Other'].copy()
other = df[df['tier'] == 'Other'].copy()
```

### Sort Order

```python
TIER_SORT = {
    '1a - Name + Email + Phone': 0,
    '1b - Name + Channel': 1,
    '2a - Phone + Website': 2,
    '2b - Co.Phone + Web + Rating': 3,
    'Other': 4,
}

sendable['tier_sort'] = sendable['tier'].map(TIER_SORT)
sendable = sendable.sort_values(
    ['tier_sort', 'lead_score', 'google_reviews'],
    ascending=[True, False, False]
).reset_index(drop=True)

other = other.sort_values(
    ['lead_score', 'google_reviews'],
    ascending=[False, False]
).reset_index(drop=True)
```

---

## 4. Output Column Mapping

Rename internal database columns to sales-friendly labels:

```python
OUTPUT_COLUMNS = {
    'tier':              'Tier',
    'lead_score':        'Score',
    'metro_group':       'Metro',
    'company_name':      'Business Name',
    'category_clean':    'Category',
    'estimated_size':    'Est. Size',
    'contact_name':      'Contact Name',
    'contact_role':      'Role',
    'owner':             'Owner?',
    'contact_email':     'Contact Email',
    'contact_phone':     'Contact Phone',
    'company_phone':     'Business Phone',
    'cultural_affinity': 'Cultural Affinity',
    'linkedin_url':      'LinkedIn',
    'website':           'Website',
    'address':           'Address',
    'city':              'City',
    'state':             'State',
    'google_rating':     'Rating',
    'google_reviews':    'Reviews',
    'booking_platform':  'Booking Platform',
    'on_groupon':        'On Groupon?',
    'instagram_url':     'Instagram',
    'facebook_url':      'Facebook',
    'tiktok_url':        'TikTok',
    'social_platforms':  'Social Platforms',
    'contact_source':    'Contact Source',
}
```

> **Note:** Only include columns that exist in a given export. Use `available = {k: v for k, v in OUTPUT_COLUMNS.items() if k in df.columns}` to skip missing ones gracefully.

### Boolean Formatting

Convert True/False to Yes/No for readability:
```python
if isinstance(val, bool):
    val = 'Yes' if val else 'No'
```

### Column Widths

```python
COLUMN_WIDTHS = {
    'Tier': 26, 'Score': 7, 'Metro': 20, 'Business Name': 32,
    'Category': 14, 'Est. Size': 10, 'Contact Name': 22, 'Role': 12,
    'Owner?': 8, 'Contact Email': 30, 'Contact Phone': 16,
    'Business Phone': 16, 'Cultural Affinity': 26, 'LinkedIn': 30,
    'Website': 26, 'Address': 38, 'City': 14, 'State': 7,
    'Rating': 7, 'Reviews': 9, 'Booking Platform': 16,
    'On Groupon?': 11, 'Instagram': 30, 'Facebook': 30,
    'TikTok': 28, 'Social Platforms': 25, 'Contact Source': 13,
}
```

---

## 5. Excel Report Structure

Generate a `.xlsx` file with **multiple sheets** using `openpyxl`.

### Tier Colors

```python
TIER_COLORS = {
    '1a - Name + Email + Phone': '92D050',   # bright green
    '1b - Name + Channel':       'C6EFCE',   # green
    '2a - Phone + Website':      'FCE4D6',   # light orange
    '2b - Co.Phone + Web + Rating': 'F2F2F2', # light grey
    'Other':                      'FFFFFF',   # white
}
```

### Sheet 1: "Summary"

Tab color: `#4472C4` (blue)

Contents (all computed from the cleaned data, not hardcoded):

1. **Title**: "VerveLabs - Sales Lead Report"
2. **Subtitle**: "Generated {date} | {N} qualified leads across {X} metros"
3. **Note**: "Filtered from {total} total records. Only sendable leads included (must have phone/email + website or rating)."
4. **Tier Breakdown**: Count per tier + total
5. **Metro Breakdown**: Table with columns: Metro, Total, Tier 1a, Tier 1b, Tier 2a, Tier 2b
6. **Quick Stats**:
   - Total Qualified Leads
   - With Contact Name
   - Confirmed Owners
   - With Contact Email
   - With Contact Phone
   - With Website
   - With Booking Platform
   - With Instagram
   - With Facebook
   - With LinkedIn
   - With Cultural Affinity
   - Avg Google Rating
   - Avg Google Reviews
7. **Tier Guide**: Color-coded rows explaining each tier with action guidance
8. **Tier vs. Score Explainer** (see section 5a below)

### Sheet 2: "All Leads"

Tab color: `#70AD47` (green)

Full sendable dataset with:
- **Header row**: Dark blue background (`#2F5496`), white bold Arial 10pt, centered, wrap text
- **Freeze panes**: `A2`
- **Auto-filter**: Enabled on all columns
- **Row coloring by tier** (see TIER_COLORS above)
- **Cell formatting**: Arial 10pt, bottom border thin light grey (`#D9D9D9`), Rating: `0.0`, Reviews: `#,##0`, Score/Owner?/Reviews: center-aligned
- Empty cells for null/NA values (no "None" or "NaN" text)

### Sheet 3: "Tier 1 - Priority"

Tab color: `#92D050` (bright green)

Same formatting as "All Leads" but filtered to Tier 1a + 1b only. This is the "start here" tab.

### Sheet 4: "Tier 2a - Direct Phone"

Tab color: `#FCE4D6` (light orange)

Filtered to Tier 2a only. Leads with a direct contact phone but no name.

### Sheet 5: "Tier 2b - Cold Call"

Tab color: `#F2F2F2` (grey)

Filtered to Tier 2b only. Company phone + website + rating.

### Sheet 6: "All Other Leads"

Tab color: `#D9D9D9` (darker grey)

All records that did NOT qualify for Tiers 1a/1b/2a/2b. These are missing critical data (no phone + website combo, no rating, etc.). Sorted by lead_score descending. Included so the client can see the full scope and track how many convert to sendable after future enrichment runs.

### Sheets 7+: Per-Metro Tabs

One sheet per metro group (e.g., "Austin", "Phoenix", "Nashville", "Sedona", "SanDiego", "Boise"). Tab color: `#4472C4` (blue). Contains only sendable leads for that metro, same formatting as "All Leads".

Use short names for the tab labels:
```python
short = mg.split(',')[0].replace(' Area', '').replace(' Metro', '').replace(' ', '')
```

---

## 5a. Tier vs. Score Explainer

Include this section on the Summary sheet after the Tier Guide. It explains why high scores often appear in lower tiers.

**Content:**

> **Understanding Tier vs. Score**
>
> These measure different things. Tier = can we reach them? Score = do they need us?
>
> **TIER = "Can we reach them?"**
> Based on contact data quality: name, phone, email, website.
> Tier 1a (bright green) = name + email + phone. Tier 2b (gray) = company phone + website + rating.
>
> **SCORE = "How much do they need us?"**
> Solo practitioner (+20), on Groupon (+15), no website (+10), no booking (+10),
> runs paid ads (+5), under 20 reviews (+5). Higher = more signals they need help.
>
> **WHY HIGH SCORES CAN APPEAR IN LOWER TIERS** (red header)
> Scoring rewards missing things (no website = +10). But those gaps also reduce reachability.
> Tier 1 leads are established businesses — easy to reach but fewer "needs help" signals.
>
> **HOW TO USE:** Work Tier 1a first, then 1b, then 2a/2b. Within each tier, prioritize by score.
> A Tier 1b with score 25 > Tier 1b with score 5. High-scoring "Other" leads are worth revisiting later.

---

## 6. File Naming Convention

```
VerveLabs_Sales_Leads_{metro_slug}_{YYYY-MM-DD}.xlsx
```

Examples:
- `VerveLabs_Sales_Leads_Austin_TX_2026-02-21.xlsx` (single metro)
- `VerveLabs_Sales_Leads_Boise_ID_2026-02-21.xlsx` (single metro)
- `VerveLabs_Sales_Leads_5_Metros_2026-02-21.xlsx` (multi-metro)

---

## 7. Complete Reference Script

Full Python script that performs all steps. Assumes CSV input — adapt the top section for Supabase REST API.

```python
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import date

# ============================================================
# CONFIG
# ============================================================
INPUT_FILE = 'supabase_export.csv'
OUTPUT_DIR = '/output/'
TODAY = date.today().strftime('%Y-%m-%d')

JUNK_CATEGORIES = [
    'Transportation Service',
    'Car repair and maintenance service',
    'Corporate Office',
    'Car Rental Agency',
    'Educational Institution',
    'Association / Organization',
    'Storage Facility',
    'Shipping Service',
    'Car Dealer',
]

OUTPUT_COLUMNS = {
    'tier':              'Tier',
    'lead_score':        'Score',
    'metro_group':       'Metro',
    'company_name':      'Business Name',
    'category_clean':    'Category',
    'estimated_size':    'Est. Size',
    'contact_name':      'Contact Name',
    'contact_role':      'Role',
    'owner':             'Owner?',
    'contact_email':     'Contact Email',
    'contact_phone':     'Contact Phone',
    'company_phone':     'Business Phone',
    'cultural_affinity': 'Cultural Affinity',
    'linkedin_url':      'LinkedIn',
    'website':           'Website',
    'address':           'Address',
    'city':              'City',
    'state':             'State',
    'google_rating':     'Rating',
    'google_reviews':    'Reviews',
    'booking_platform':  'Booking Platform',
    'on_groupon':        'On Groupon?',
    'instagram_url':     'Instagram',
    'facebook_url':      'Facebook',
    'tiktok_url':        'TikTok',
    'social_platforms':  'Social Platforms',
    'contact_source':    'Contact Source',
}

COLUMN_WIDTHS = {
    'Tier': 26, 'Score': 7, 'Metro': 20, 'Business Name': 32,
    'Category': 14, 'Est. Size': 10, 'Contact Name': 22, 'Role': 12,
    'Owner?': 8, 'Contact Email': 30, 'Contact Phone': 16,
    'Business Phone': 16, 'Cultural Affinity': 26, 'LinkedIn': 30,
    'Website': 26, 'Address': 38, 'City': 14, 'State': 7,
    'Rating': 7, 'Reviews': 9, 'Booking Platform': 16,
    'On Groupon?': 11, 'Instagram': 30, 'Facebook': 30,
    'TikTok': 28, 'Social Platforms': 25, 'Contact Source': 13,
}

TIER_SORT = {
    '1a - Name + Email + Phone': 0,
    '1b - Name + Channel': 1,
    '2a - Phone + Website': 2,
    '2b - Co.Phone + Web + Rating': 3,
    'Other': 4,
}

TIER_COLORS = {
    '1a - Name + Email + Phone': '92D050',
    '1b - Name + Channel':       'C6EFCE',
    '2a - Phone + Website':      'FCE4D6',
    '2b - Co.Phone + Web + Rating': 'F2F2F2',
    'Other':                      'FFFFFF',
}

# ============================================================
# STEP 1: LOAD DATA
# ============================================================
df = pd.read_csv(INPUT_FILE)

# ============================================================
# STEP 2: CLEAN
# ============================================================
df = df[~df['category'].isin(JUNK_CATEGORIES)].copy()

for col in df.columns:
    df[col] = df[col].replace(['null', '', 'None'], pd.NA)

def simplify_category(cat):
    if pd.isna(cat): return 'Unknown'
    cat_lower = cat.lower()
    if 'spa' in cat_lower and 'massage' in cat_lower: return 'Massage Spa'
    if 'day spa' in cat_lower: return 'Day Spa'
    if 'spa' in cat_lower: return 'Spa'
    if 'massage' in cat_lower: return 'Massage'
    if 'wellness' in cat_lower: return 'Wellness Center'
    if 'chiro' in cat_lower: return 'Chiropractor'
    if 'physical therap' in cat_lower: return 'Physical Therapist'
    if 'nail salon' in cat_lower: return 'Nail Salon'
    if 'hair salon' in cat_lower or 'beauty salon' in cat_lower: return 'Salon'
    if 'medical' in cat_lower or 'doctor' in cat_lower or 'health' in cat_lower: return 'Health & Medical'
    return cat

df['category_clean'] = df['category'].apply(simplify_category)

def normalize_metro(row):
    metro = str(row.get('metro', ''))
    state = str(row.get('state', ''))
    if state == 'AZ' and any(x in metro for x in ['Sedona', 'Cornville', 'Cottonwood', 'Camp Verde', 'Rimrock', 'Big Park', 'Clarkdale', 'Flagstaff']):
        return 'Sedona Area, AZ'
    if state == 'AZ':
        return 'Phoenix Metro, AZ'
    if state == 'TN':
        return 'Nashville Area, TN'
    if state == 'TX':
        return 'Austin Area, TX'
    if state == 'CA':
        return 'San Diego Area, CA'
    if state == 'ID':
        return 'Boise Area, ID'
    return metro

df['metro_group'] = df.apply(normalize_metro, axis=1)

df = df.drop_duplicates(subset=['company_name'], keep='first')

# ============================================================
# STEP 3: TIER
# ============================================================
def assign_tier(row):
    has_name = pd.notna(row.get('contact_name')) and str(row.get('contact_name', '')).strip() != ''
    has_email = pd.notna(row.get('contact_email')) and str(row.get('contact_email', '')).strip() != ''
    has_cphone = pd.notna(row.get('contact_phone')) and str(row.get('contact_phone', '')).strip() != ''
    has_website = pd.notna(row.get('website')) and str(row.get('website', '')).strip() != ''
    has_rating = pd.notna(row.get('google_rating'))
    has_co_phone = pd.notna(row.get('company_phone')) and str(row.get('company_phone', '')).strip() != ''

    if has_name and has_email and has_cphone:
        return '1a - Name + Email + Phone'
    if has_name and (has_email or has_cphone):
        return '1b - Name + Channel'
    if has_cphone and has_website:
        return '2a - Phone + Website'
    if has_co_phone and has_website and has_rating:
        return '2b - Co.Phone + Web + Rating'
    return 'Other'

df['tier'] = df.apply(assign_tier, axis=1)

# Split sendable vs other
sendable = df[df['tier'] != 'Other'].copy()
other = df[df['tier'] == 'Other'].copy()

sendable['tier_sort'] = sendable['tier'].map(TIER_SORT)
sendable = sendable.sort_values(
    ['tier_sort', 'lead_score', 'google_reviews'],
    ascending=[True, False, False]
).reset_index(drop=True)

other = other.sort_values(
    ['lead_score', 'google_reviews'],
    ascending=[False, False]
).reset_index(drop=True)

# ============================================================
# STEP 4: SELECT & RENAME COLUMNS
# ============================================================
available = {k: v for k, v in OUTPUT_COLUMNS.items() if k in sendable.columns}
out = sendable[list(available.keys())].rename(columns=available)
out_other = other[list(available.keys())].rename(columns=available)

# ============================================================
# STEP 5: BUILD XLSX
# ============================================================
wb = Workbook()

# --- Shared styles ---
hdr_fill = PatternFill('solid', fgColor='2F5496')
hdr_font = Font(name='Arial', bold=True, size=10, color='FFFFFF')
cell_font = Font(name='Arial', size=10)
thin_border = Border(bottom=Side(style='thin', color='D9D9D9'))
sub_font = Font(name='Arial', bold=True, size=11, color='2F5496')
normal_font = Font(name='Arial', size=11)
bold_font = Font(name='Arial', bold=True, size=11)
note_font = Font(name='Arial', size=10, color='666666')
warn_font = Font(name='Arial', size=10, color='808080')

headers = list(out.columns)

def write_lead_sheet(ws, data):
    """Write a lead data sheet with standard formatting."""
    for ci, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=ci, value=h)
        c.font = hdr_font
        c.fill = hdr_fill
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(headers))}1'

    for ri, (_, rd) in enumerate(data.iterrows(), 2):
        tier = rd['Tier']
        fc = TIER_COLORS.get(tier, 'FFFFFF')
        rf = PatternFill('solid', fgColor=fc)
        for ci, cn in enumerate(headers, 1):
            val = rd[cn]
            if pd.isna(val): val = ''
            elif isinstance(val, bool): val = 'Yes' if val else 'No'
            c = ws.cell(row=ri, column=ci, value=val)
            c.font = cell_font
            c.fill = rf
            c.border = thin_border
            if cn == 'Rating' and val != '': c.number_format = '0.0'
            if cn in ('Score', 'Owner?', 'Reviews'):
                c.alignment = Alignment(horizontal='center')
            if cn == 'Reviews' and val != '': c.number_format = '#,##0'

    for ci, h in enumerate(headers, 1):
        ws.column_dimensions[get_column_letter(ci)].width = COLUMN_WIDTHS.get(h, 15)


# ============================================================
# SHEET: SUMMARY
# ============================================================
ws = wb.active
ws.title = 'Summary'
ws.sheet_properties.tabColor = '4472C4'

metro_list = sorted(out['Metro'].dropna().unique())

ws['A1'] = 'VerveLabs - Sales Lead Report'
ws['A1'].font = Font(name='Arial', bold=True, size=18, color='2F5496')
ws['A2'] = f'Generated {TODAY} | {len(out)} qualified leads across {len(metro_list)} metros'
ws['A2'].font = Font(name='Arial', size=11, color='808080')
ws['A3'] = f'Filtered from {len(df)} total records. Only sendable leads in main tabs. "All Other Leads" tab has {len(out_other)} additional records.'
ws['A3'].font = Font(name='Arial', size=10, italic=True, color='A0A0A0')

row = 5

# Tier Breakdown
ws.cell(row=row, column=1, value='Tier Breakdown').font = sub_font
row += 1
tier_counts = out['Tier'].value_counts()
for tn in ['1a - Name + Email + Phone', '1b - Name + Channel', '2a - Phone + Website', '2b - Co.Phone + Web + Rating']:
    ct = tier_counts.get(tn, 0)
    ws.cell(row=row, column=1, value=f'  {tn}').font = normal_font
    ws.cell(row=row, column=2, value=ct).font = bold_font
    row += 1
ws.cell(row=row, column=1, value=f'  Total Sendable').font = Font(name='Arial', bold=True, size=11)
ws.cell(row=row, column=2, value=len(out)).font = Font(name='Arial', bold=True, size=11)
row += 1
ws.cell(row=row, column=1, value=f'  Other (not yet sendable)').font = Font(name='Arial', size=11, color='999999')
ws.cell(row=row, column=2, value=len(out_other)).font = Font(name='Arial', size=11, color='999999')
row += 2

# Metro Breakdown (table with tier counts)
ws.cell(row=row, column=1, value='Metro Breakdown').font = sub_font
row += 1
metro_headers = ['Metro', 'Total', 'Tier 1a', 'Tier 1b', 'Tier 2a', 'Tier 2b']
for ci, h in enumerate(metro_headers, 1):
    ws.cell(row=row, column=ci, value=h).font = Font(name='Arial', bold=True, size=10, color='2F5496')
row += 1
for mg in sorted(metro_list):
    m = out[out['Metro'] == mg]
    tc = m['Tier'].value_counts()
    ws.cell(row=row, column=1, value=mg).font = normal_font
    ws.cell(row=row, column=2, value=len(m)).font = bold_font
    ws.cell(row=row, column=3, value=tc.get('1a - Name + Email + Phone', 0)).font = normal_font
    ws.cell(row=row, column=4, value=tc.get('1b - Name + Channel', 0)).font = normal_font
    ws.cell(row=row, column=5, value=tc.get('2a - Phone + Website', 0)).font = normal_font
    ws.cell(row=row, column=6, value=tc.get('2b - Co.Phone + Web + Rating', 0)).font = normal_font
    row += 1

row += 1

# Quick Stats
ws.cell(row=row, column=1, value='Quick Stats').font = sub_font
row += 1
stats = [
    ('Total Qualified Leads', len(out)),
    ('With Contact Name', int(out['Contact Name'].notna().sum())),
    ('Confirmed Owners', int((out.get('Owner?', pd.Series(dtype=str)) == 'Yes').sum())),
    ('With Contact Email', int(out['Contact Email'].notna().sum())),
    ('With Contact Phone', int(out['Contact Phone'].notna().sum())),
    ('With Website', int(out['Website'].notna().sum())),
    ('With Booking Platform', int(out['Booking Platform'].notna().sum())),
    ('With Instagram', int(out['Instagram'].notna().sum())),
    ('With Facebook', int(out['Facebook'].notna().sum())),
    ('With LinkedIn', int(out['LinkedIn'].notna().sum())),
    ('With Cultural Affinity', int(out['Cultural Affinity'].notna().sum())),
    ('Avg Google Rating', round(out['Rating'].mean(), 1) if out['Rating'].notna().any() else 'N/A'),
    ('Avg Google Reviews', int(out['Reviews'].mean()) if out['Reviews'].notna().any() else 'N/A'),
]
for label, val in stats:
    ws.cell(row=row, column=1, value=f'  {label}').font = normal_font
    ws.cell(row=row, column=2, value=val).font = bold_font
    row += 1

row += 1

# Tier Guide (color-coded)
ws.cell(row=row, column=1, value='Tier Guide').font = sub_font
row += 1
guides = [
    ('1a - Name + Email + Phone', '92D050', 'Best leads. Call by name, follow up by email.'),
    ('1b - Name + Channel', 'C6EFCE', 'Contact name + either email or phone. Call by name.'),
    ('2a - Phone + Website', 'FCE4D6', 'Direct contact phone + website but no name. Research the site, then call.'),
    ('2b - Co.Phone + Web + Rating', 'F2F2F2', 'Company phone + website + Google rating. Call and ask for the owner.'),
]
for tn, color, desc in guides:
    c = ws.cell(row=row, column=1, value=f'  {tn}')
    c.font = Font(name='Arial', bold=True, size=10)
    c.fill = PatternFill('solid', fgColor=color)
    ws.cell(row=row, column=2, value=desc).font = note_font
    ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=6)
    row += 1

row += 1

# Tier vs Score Explainer
ws.cell(row=row, column=1, value='Understanding Tier vs. Score').font = sub_font
row += 1
ws.cell(row=row, column=1, value='These measure different things. Tier = can we reach them? Score = do they need us?').font = Font(name='Arial', bold=True, size=10, color='444444')
ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
row += 2

ws.cell(row=row, column=1, value='TIER = "Can we reach them?"').font = Font(name='Arial', bold=True, size=10, color='2F5496')
ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
row += 1
for line in [
    'Based on contact data quality: name, phone, email, website.',
    'Tier 1a (bright green) = name + email + phone. Tier 2b (gray) = company phone + website + rating.',
]:
    ws.cell(row=row, column=1, value=line).font = warn_font
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    row += 1

row += 1
ws.cell(row=row, column=1, value='SCORE = "How much do they need us?"').font = Font(name='Arial', bold=True, size=10, color='2F5496')
ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
row += 1
for line in [
    'Solo practitioner (+20), on Groupon (+15), no website (+10), no booking (+10),',
    'runs paid ads (+5), under 20 reviews (+5). Higher = more signals they need help.',
]:
    ws.cell(row=row, column=1, value=line).font = warn_font
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    row += 1

row += 1
ws.cell(row=row, column=1, value='WHY HIGH SCORES CAN APPEAR IN LOWER TIERS').font = Font(name='Arial', bold=True, size=10, color='C00000')
ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
row += 1
for line in [
    'Scoring rewards missing things (no website = +10). But those gaps also reduce reachability.',
    'Tier 1 leads are established businesses — easy to reach but fewer "needs help" signals.',
    '',
    'HOW TO USE: Work Tier 1a first, then 1b, then 2a/2b. Within each tier, prioritize by score.',
]:
    ws.cell(row=row, column=1, value=line).font = warn_font
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    row += 1

ws.column_dimensions['A'].width = 55
ws.column_dimensions['B'].width = 65
for ci in range(3, 7):
    ws.column_dimensions[get_column_letter(ci)].width = 14


# ============================================================
# SHEET: ALL LEADS (sendable only)
# ============================================================
ws_all = wb.create_sheet('All Leads')
ws_all.sheet_properties.tabColor = '70AD47'
write_lead_sheet(ws_all, out)


# ============================================================
# SHEET: TIER 1 - PRIORITY
# ============================================================
t1 = out[out['Tier'].str.startswith('1')]
if len(t1) > 0:
    ws_t1 = wb.create_sheet('Tier 1 - Priority')
    ws_t1.sheet_properties.tabColor = '92D050'
    write_lead_sheet(ws_t1, t1)


# ============================================================
# SHEET: TIER 2a - DIRECT PHONE
# ============================================================
t2a = out[out['Tier'] == '2a - Phone + Website']
if len(t2a) > 0:
    ws_2a = wb.create_sheet('Tier 2a - Direct Phone')
    ws_2a.sheet_properties.tabColor = 'FCE4D6'
    write_lead_sheet(ws_2a, t2a)


# ============================================================
# SHEET: TIER 2b - COLD CALL
# ============================================================
t2b = out[out['Tier'] == '2b - Co.Phone + Web + Rating']
if len(t2b) > 0:
    ws_2b = wb.create_sheet('Tier 2b - Cold Call')
    ws_2b.sheet_properties.tabColor = 'F2F2F2'
    write_lead_sheet(ws_2b, t2b)


# ============================================================
# SHEET: ALL OTHER LEADS (not sendable)
# ============================================================
if len(out_other) > 0:
    ws_other = wb.create_sheet('All Other Leads')
    ws_other.sheet_properties.tabColor = 'D9D9D9'
    write_lead_sheet(ws_other, out_other)


# ============================================================
# SHEETS: PER-METRO TABS (sendable only)
# ============================================================
for mg in sorted(metro_list):
    m_data = out[out['Metro'] == mg]
    if len(m_data) > 0:
        short = mg.split(',')[0].replace(' Area', '').replace(' Metro', '').replace(' ', '')
        ws_m = wb.create_sheet(f'{short}')
        ws_m.sheet_properties.tabColor = '4472C4'
        write_lead_sheet(ws_m, m_data)


# ============================================================
# STEP 6: SAVE
# ============================================================
metros = out['Metro'].dropna().unique()
if len(metros) == 1:
    metro_slug = list(metros)[0].replace(', ', '_').replace(' ', '_')
else:
    metro_slug = f'{len(metros)}_Metros'

filename = f'VerveLabs_Sales_Leads_{metro_slug}_{TODAY}.xlsx'
output_path = f'{OUTPUT_DIR}{filename}'
wb.save(output_path)

print(f'Report saved: {output_path}')
print(f'Sendable: {len(out)}')
print(f'Other: {len(out_other)}')
for tn in TIER_SORT.keys():
    if tn == 'Other': continue
    print(f'  {tn}: {tier_counts.get(tn, 0)}')
```

---

## 8. Extending This Report

### Adding New Metros

1. No code changes needed for the report script — it dynamically detects metros.
2. Add the suburb-to-parent mapping in `normalize_metro()` for new metros.
3. Ensure the new metro's data is in Supabase before exporting.

### Adding New Junk Categories

Append to `JUNK_CATEGORIES` when new false positives are discovered. Common patterns:
- Businesses matching on "RMT" acronym (transport, motorsports)
- Schools and training programs
- Professional associations and licensing boards
- Unrelated businesses with "body" or "touch" in the name

### Adding New Columns

If new enrichment steps add data (e.g., phone verification status, email verification status, outreach channel count), add them to `OUTPUT_COLUMNS` and `COLUMN_WIDTHS`. The `write_lead_sheet` function handles any number of columns automatically.

### Upgrading Tiering

If phone/email verification columns are added to the contacts table (`phone_status`, `email_status`), the tiering can be tightened:

```python
# Enhanced tiering with verification
has_verified_email = row.get('contact_email_status') == 'verified'
has_usable_email = row.get('contact_email_status') in ['verified', 'accept_all']
has_verified_phone = row.get('contact_phone_status') == 'valid'
```

### Filtering by Metro

To generate a single-metro report, add a filter after loading:
```python
METRO_FILTER = 'Austin, TX'  # or None for all
if METRO_FILTER:
    df = df[df['discovery_metro'] == METRO_FILTER]
```

### Filtering by Contactability in SQL

If you want to pre-filter in SQL rather than pulling everything:
```sql
-- Add to WHERE clause to only pull sendable leads
AND (
  (ct.phone_direct IS NOT NULL AND c.domain IS NOT NULL)
  OR (ct.email_business IS NOT NULL)
  OR (c.phone IS NOT NULL AND c.domain IS NOT NULL AND c.google_rating IS NOT NULL)
)
```

> **Note:** If using this SQL filter, you won't get "All Other Leads" for the separate tab. Recommended to pull everything and let the Python script split.

---

## 9. Quality Checks

After generating any report, verify:

1. **Zero junk records**: No transportation, car repair, car dealers, schools, or associations
2. **No null text in cells**: Empty cells, not "None" or "NaN" strings
3. **Tier counts are logical**: Tier 1 should be smallest, Other should shrink as enrichment improves
4. **No duplicate businesses**: `Business Name` column should have zero duplicates
5. **Tier 1a/1b all have contact names**: Every Tier 1 row must have a non-empty Contact Name
6. **Tier 1a all have email AND phone**: Every 1a row must have both
7. **Other tab has no sendable leads**: Verify no records in "All Other Leads" would qualify for Tiers 1-2
8. **Social columns populated**: Instagram/Facebook should be present for 30-60%+ of records
9. **Per-metro sheets sum to All Leads**: Total rows across metro tabs should equal All Leads

---

## 10. Dependencies

```
pip install pandas openpyxl
```

No other dependencies required. The script uses only standard openpyxl formatting — no LibreOffice recalculation needed since there are no formulas.
