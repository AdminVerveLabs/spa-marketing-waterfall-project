# VerveLabs — Sales Lead Report Generator

## Purpose

This guide tells Claude Code exactly how to generate a cleaned, tiered, sales-ready `.xlsx` report from the VerveLabs Supabase database. Run this after any pipeline enrichment pass (new metro, re-enrichment, etc.) to produce a downloadable report for the sales team.

---

## 1. Data Source

Query the Supabase REST API to pull companies joined with their best contact (owner preferred). The database has two relevant tables:

- **`companies`** — business records with enrichment data
- **`contacts`** — people associated with each company (may have multiple per company)

### Supabase Query

Use the Supabase REST API with the service role key. The query joins companies with their best contact (prioritizing `is_owner = true`).

```sql
SELECT
  c.lead_score,
  c.city || ', ' || c.state AS metro,
  c.name AS company_name,
  c.category,
  ct.first_name || ' ' || ct.last_name AS contact_name,
  ct.role AS contact_role,
  ct.email_business AS contact_email,
  ct.phone_direct AS contact_phone,
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
  c.estimated_size,
  ct.source AS contact_source,
  c.enrichment_status
FROM companies c
LEFT JOIN contacts ct ON ct.company_id = c.id
  AND ct.is_owner = TRUE
ORDER BY c.lead_score DESC, c.google_review_count DESC;
```

> **Note:** If a company has multiple owner contacts, this may return duplicates. Deduplicate by `company_name` after fetching, keeping the row with the most complete contact info.

### Environment Variables Required

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
```

### Fetching via REST API (Node.js or Python)

**Python example:**
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

Alternatively, query the companies table directly with a select + embedded contact:

```
GET /rest/v1/companies?select=*,contacts(*)&enrichment_status=neq.needs_review
```

If using a CSV export instead (e.g., from Supabase dashboard), read it with:
```python
import pandas as pd
df = pd.read_csv('export.csv')
```

---

## 2. Cleaning Rules

Apply these transformations in order.

### 2a. Remove Junk Records

Filter out any rows where `category` matches these non-spa/massage business types:

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
]
df = df[~df['category'].isin(JUNK_CATEGORIES)]
```

> **Why these exist:** Google Places and Yelp sometimes return businesses that match on acronyms (e.g., "RMT" = Registered Massage Therapist but also "RMT Henderson" = a transport company). Massage schools and professional associations also get pulled in but aren't sales prospects.

### 2b. Normalize Null Values

The CSV export and Supabase REST API represent nulls differently. Normalize them:

```python
for col in df.columns:
    df[col] = df[col].replace('null', pd.NA)
    df[col] = df[col].replace('', pd.NA)
    df[col] = df[col].replace('None', pd.NA)
```

### 2c. Simplify Category Labels

The raw categories from Yelp are verbose multi-category strings. Collapse them into clean labels:

```python
def simplify_category(cat):
    if pd.isna(cat):
        return 'Unknown'
    cat_lower = cat.lower()
    if 'spa' in cat_lower and 'massage' in cat_lower:
        return 'Massage Spa'
    if 'spa' in cat_lower:
        return 'Spa'
    if 'massage' in cat_lower:
        return 'Massage'
    if 'wellness' in cat_lower:
        return 'Wellness Center'
    if 'chiro' in cat_lower:
        return 'Chiropractor'
    if 'physical therap' in cat_lower:
        return 'Physical Therapist'
    if 'medical' in cat_lower or 'doctor' in cat_lower or 'health' in cat_lower:
        return 'Health & Medical'
    return cat

df['category_clean'] = df['category'].apply(simplify_category)
```

### 2d. Deduplicate

If the join produced duplicate company rows:
```python
df = df.drop_duplicates(subset=['company_name'], keep='first')
```

---

## 3. Tiering Logic

Assign every lead to one of three tiers based on data completeness. This determines call priority for the sales team.

```python
def assign_tier(row):
    has_name = pd.notna(row['contact_name']) and str(row['contact_name']).strip() != ''
    has_website = pd.notna(row['website']) and str(row['website']).strip() != ''
    has_rating = pd.notna(row['google_rating'])
    has_phone = pd.notna(row['company_phone']) and str(row['company_phone']).strip() != ''
    has_verified_email = row.get('company_email_status') == 'verified'

    if has_name and has_phone and has_website and has_rating:
        if has_verified_email:
            return '1 - Ready (Name + Email)'
        return '1 - Ready (Name)'
    elif has_phone and has_website and has_rating:
        return '2 - Dial (No Name)'
    else:
        return '3 - Incomplete'

df['tier'] = df.apply(assign_tier, axis=1)
```

### Tier Definitions (for the sales team)

| Tier | Meaning | How to Work It |
|------|---------|----------------|
| **1 - Ready (Name + Email)** | Has contact name AND verified email. Best leads. | Call and ask for them by name. Can also email. |
| **1 - Ready (Name)** | Has contact name but no verified email. | Call and ask for them by name. |
| **2 - Dial (No Name)** | Has phone, website, and Google rating but no contact name. | Call the business and ask for the owner/manager. |
| **3 - Incomplete** | Missing website or Google rating. Likely closed, barely operating, or not a real prospect. | Low priority. May need manual research before calling. |

### Sort Order

Sort the final output so the best leads appear first:

```python
tier_order = {
    '1 - Ready (Name + Email)': 0,
    '1 - Ready (Name)': 1,
    '2 - Dial (No Name)': 2,
    '3 - Incomplete': 3
}
df['tier_sort'] = df['tier'].map(tier_order)
df = df.sort_values(
    ['tier_sort', 'lead_score', 'google_reviews'],
    ascending=[True, False, False]
).reset_index(drop=True)
```

---

## 4. Output Column Mapping

Rename internal database columns to sales-friendly labels:

```python
OUTPUT_COLUMNS = {
    'tier':                'Tier',
    'lead_score':          'Score',
    'metro':               'Metro',
    'company_name':        'Business Name',
    'category_clean':      'Category',
    'contact_name':        'Contact Name',
    'contact_role':        'Role',
    'contact_email':       'Contact Email',
    'contact_phone':       'Contact Phone',
    'company_phone':       'Business Phone',
    'company_email':       'Business Email',
    'company_email_status':'Email Status',
    'website':             'Website',
    'address':             'Address',
    'city':                'City',
    'state':               'State',
    'google_rating':       'Rating',
    'google_reviews':      'Reviews',
    'has_booking':         'Online Booking?',
    'booking_platform':    'Booking Platform',
    'estimated_size':      'Est. Size',
}

out = df[list(OUTPUT_COLUMNS.keys())].rename(columns=OUTPUT_COLUMNS)
```

> **Note:** If certain columns don't exist in a given export (e.g., `company_email`, `company_email_status`), skip them gracefully rather than erroring. The tiering logic should fall back to treating missing email status as "not verified."

### Boolean Formatting

Convert True/False to Yes/No for readability:
```python
if isinstance(val, bool):
    val = 'Yes' if val else 'No'
```

---

## 5. Excel Report Structure

Generate a `.xlsx` file with **3 sheets** using `openpyxl`.

### Sheet 1: "Summary"

Tab color: `#4472C4` (blue)

Contents (all built from the cleaned data, not hardcoded):

1. **Title**: "VerveLabs - Lead List Summary"
2. **Subtitle**: "Generated from {N} cleaned leads | {metro_list}"
3. **Tier Breakdown**: Count of leads per tier
4. **Metro Breakdown**: Count of leads per metro area
5. **Quick Stats**:
   - Total Leads
   - With Contact Name (count)
   - With Verified Email (count)
   - With Online Booking (count)
   - Avg Google Rating
   - Avg Google Reviews
6. **Tier Guide**: Short explanation of each tier (see tier definitions above)

### Sheet 2: "All Leads"

Tab color: `#70AD47` (green)

Full dataset with:
- **Header row**: Dark blue background (`#2F5496`), white bold Arial 10pt text, centered, wrap text
- **Freeze panes**: `A2` (frozen header row)
- **Auto-filter**: Enabled on all columns
- **Row coloring by tier**:
  - `1 - Ready (Name + Email)`: Bright green (`#C6EFCE`)
  - `1 - Ready (Name)`: Light green (`#E2EFDA`)
  - `2 - Dial (No Name)`: Light orange (`#FCE4D6`)
  - `3 - Incomplete`: Light grey (`#F2F2F2`)
- **Cell formatting**:
  - Font: Arial 10pt
  - Bottom border: Thin, light grey (`#D9D9D9`)
  - Rating: Format `0.0`
  - Reviews: Format `#,##0`
  - Score: Center-aligned
  - Empty cells for null/NA values (no "None" or "NaN" text)

**Column widths:**
```python
COLUMN_WIDTHS = {
    'Tier': 22, 'Score': 7, 'Metro': 14, 'Business Name': 35,
    'Category': 16, 'Contact Name': 22, 'Role': 12,
    'Contact Email': 28, 'Contact Phone': 16, 'Business Phone': 16,
    'Business Email': 30, 'Email Status': 12, 'Website': 28,
    'Address': 42, 'City': 14, 'State': 7, 'Rating': 7,
    'Reviews': 9, 'Online Booking?': 14, 'Booking Platform': 16,
    'Est. Size': 10,
}
```

### Sheet 3: "Tier 1 - Priority"

Tab color: `#C6EFCE` (green)

Same structure/formatting as "All Leads" but **filtered to only Tier 1 rows** (both "Name + Email" and "Name" variants). This is the "start here" tab for the sales team.

---

## 6. File Naming Convention

```
VerveLabs_Sales_Leads_{metro_slug}_{YYYY-MM-DD}.xlsx
```

Examples:
- `VerveLabs_Sales_Leads_Austin_TX_2025-06-15.xlsx`
- `VerveLabs_Sales_Leads_All_Metros_2025-06-15.xlsx`

If generating for a single metro, use that metro's slug. If generating for all metros combined, use `All_Metros`.

---

## 7. Complete Reference Script

Below is the full Python script that performs all steps. This assumes a CSV input — adapt the top section if reading from Supabase REST API directly.

```python
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import date

# ============================================================
# CONFIG
# ============================================================
INPUT_FILE = 'supabase_export.csv'  # or fetch from API
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
]

OUTPUT_COLUMNS = {
    'tier':                'Tier',
    'lead_score':          'Score',
    'metro':               'Metro',
    'company_name':        'Business Name',
    'category_clean':      'Category',
    'contact_name':        'Contact Name',
    'contact_role':        'Role',
    'contact_email':       'Contact Email',
    'contact_phone':       'Contact Phone',
    'company_phone':       'Business Phone',
    'company_email':       'Business Email',
    'company_email_status':'Email Status',
    'website':             'Website',
    'address':             'Address',
    'city':                'City',
    'state':               'State',
    'google_rating':       'Rating',
    'google_reviews':      'Reviews',
    'has_booking':         'Online Booking?',
    'booking_platform':    'Booking Platform',
    'estimated_size':      'Est. Size',
}

COLUMN_WIDTHS = {
    'Tier': 22, 'Score': 7, 'Metro': 14, 'Business Name': 35,
    'Category': 16, 'Contact Name': 22, 'Role': 12,
    'Contact Email': 28, 'Contact Phone': 16, 'Business Phone': 16,
    'Business Email': 30, 'Email Status': 12, 'Website': 28,
    'Address': 42, 'City': 14, 'State': 7, 'Rating': 7,
    'Reviews': 9, 'Online Booking?': 14, 'Booking Platform': 16,
    'Est. Size': 10,
}

TIER_COLORS = {
    '1 - Ready (Name + Email)': 'C6EFCE',
    '1 - Ready (Name)':         'E2EFDA',
    '2 - Dial (No Name)':       'FCE4D6',
    '3 - Incomplete':           'F2F2F2',
}

TIER_SORT_ORDER = {
    '1 - Ready (Name + Email)': 0,
    '1 - Ready (Name)': 1,
    '2 - Dial (No Name)': 2,
    '3 - Incomplete': 3,
}

# ============================================================
# STEP 1: LOAD DATA
# ============================================================
df = pd.read_csv(INPUT_FILE)

# ============================================================
# STEP 2: CLEAN
# ============================================================
# Remove junk
df = df[~df['category'].isin(JUNK_CATEGORIES)].copy()

# Normalize nulls
for col in df.columns:
    df[col] = df[col].replace(['null', '', 'None'], pd.NA)

# Simplify categories
def simplify_category(cat):
    if pd.isna(cat):
        return 'Unknown'
    cat_lower = cat.lower()
    if 'spa' in cat_lower and 'massage' in cat_lower:
        return 'Massage Spa'
    if 'spa' in cat_lower:
        return 'Spa'
    if 'massage' in cat_lower:
        return 'Massage'
    if 'wellness' in cat_lower:
        return 'Wellness Center'
    if 'chiro' in cat_lower:
        return 'Chiropractor'
    if 'physical therap' in cat_lower:
        return 'Physical Therapist'
    if 'medical' in cat_lower or 'doctor' in cat_lower or 'health' in cat_lower:
        return 'Health & Medical'
    return cat

df['category_clean'] = df['category'].apply(simplify_category)

# Deduplicate
df = df.drop_duplicates(subset=['company_name'], keep='first')

# ============================================================
# STEP 3: TIER
# ============================================================
def assign_tier(row):
    has_name = pd.notna(row.get('contact_name')) and str(row.get('contact_name', '')).strip() != ''
    has_website = pd.notna(row.get('website')) and str(row.get('website', '')).strip() != ''
    has_rating = pd.notna(row.get('google_rating'))
    has_phone = pd.notna(row.get('company_phone')) and str(row.get('company_phone', '')).strip() != ''
    has_verified_email = row.get('company_email_status') == 'verified'

    if has_name and has_phone and has_website and has_rating:
        if has_verified_email:
            return '1 - Ready (Name + Email)'
        return '1 - Ready (Name)'
    elif has_phone and has_website and has_rating:
        return '2 - Dial (No Name)'
    else:
        return '3 - Incomplete'

df['tier'] = df.apply(assign_tier, axis=1)

# Sort
df['tier_sort'] = df['tier'].map(TIER_SORT_ORDER)
df = df.sort_values(
    ['tier_sort', 'lead_score', 'google_reviews'],
    ascending=[True, False, False]
).reset_index(drop=True)

# ============================================================
# STEP 4: SELECT & RENAME COLUMNS
# ============================================================
# Only include columns that exist in the dataframe
available_cols = {k: v for k, v in OUTPUT_COLUMNS.items() if k in df.columns}
out = df[list(available_cols.keys())].rename(columns=available_cols)

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

# ============================================================
# SHEET 1: SUMMARY
# ============================================================
ws_sum = wb.active
ws_sum.title = 'Summary'
ws_sum.sheet_properties.tabColor = '4472C4'

metros = out['Metro'].dropna().unique()
metro_str = ' & '.join(sorted(metros)) if len(metros) > 0 else 'Unknown'

ws_sum['A1'] = 'VerveLabs - Lead List Summary'
ws_sum['A1'].font = Font(name='Arial', bold=True, size=16, color='2F5496')
ws_sum['A2'] = f'Generated from {len(out)} cleaned leads | {metro_str}'
ws_sum['A2'].font = Font(name='Arial', size=11, color='808080')

row = 4
ws_sum.cell(row=row, column=1, value='Tier Breakdown').font = sub_font
row += 1
tier_counts = out['Tier'].value_counts()
for tier_name in TIER_SORT_ORDER.keys():
    count = tier_counts.get(tier_name, 0)
    ws_sum.cell(row=row, column=1, value=f'  {tier_name}').font = normal_font
    ws_sum.cell(row=row, column=2, value=count).font = bold_font
    row += 1

row += 1
ws_sum.cell(row=row, column=1, value='Metro Breakdown').font = sub_font
row += 1
for metro, count in out['Metro'].value_counts().items():
    ws_sum.cell(row=row, column=1, value=f'  {metro}').font = normal_font
    ws_sum.cell(row=row, column=2, value=count).font = bold_font
    row += 1

row += 1
ws_sum.cell(row=row, column=1, value='Quick Stats').font = sub_font
row += 1

stats = [
    ('Total Leads', len(out)),
    ('With Contact Name', int(out['Contact Name'].notna().sum())),
    ('With Verified Email', int((out.get('Email Status', pd.Series()) == 'verified').sum())),
    ('With Online Booking', int((out.get('Online Booking?', pd.Series()) == True).sum()) if 'Online Booking?' in out.columns else 0),
    ('Avg Google Rating', round(out['Rating'].mean(), 1) if 'Rating' in out.columns else 'N/A'),
    ('Avg Google Reviews', int(out['Reviews'].mean()) if 'Reviews' in out.columns else 'N/A'),
]
for label, val in stats:
    ws_sum.cell(row=row, column=1, value=f'  {label}').font = normal_font
    ws_sum.cell(row=row, column=2, value=val).font = bold_font
    row += 1

row += 2
ws_sum.cell(row=row, column=1, value='Tier Guide').font = sub_font
row += 1
guides = [
    'Tier 1 (Name + Email): Has contact name AND verified email. Call by name. Can also email.',
    'Tier 1 (Name): Has contact name but no verified email. Call by name.',
    'Tier 2 (Dial): Has phone, website, and rating but no name. Call and ask for the owner.',
    'Tier 3 (Incomplete): Missing website or rating. Lower priority, may need manual research.',
]
for g in guides:
    ws_sum.cell(row=row, column=1, value=g).font = Font(name='Arial', size=10, color='666666')
    ws_sum.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    row += 1

ws_sum.column_dimensions['A'].width = 45
ws_sum.column_dimensions['B'].width = 12


def write_lead_sheet(ws, data, headers):
    """Write a lead data sheet with standard formatting."""
    # Header row
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = hdr_font
        cell.fill = hdr_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f'A1:{get_column_letter(len(headers))}1'

    # Data rows
    for row_idx, (_, row_data) in enumerate(data.iterrows(), 2):
        tier = row_data['Tier']
        fill_color = TIER_COLORS.get(tier, 'FFFFFF')
        row_fill = PatternFill('solid', fgColor=fill_color)

        for col_idx, col_name in enumerate(headers, 1):
            val = row_data[col_name]
            if pd.isna(val):
                val = ''
            elif isinstance(val, bool):
                val = 'Yes' if val else 'No'

            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = cell_font
            cell.fill = row_fill
            cell.border = thin_border

            if col_name == 'Rating' and val != '':
                cell.number_format = '0.0'
            if col_name == 'Score':
                cell.alignment = Alignment(horizontal='center')
            if col_name == 'Reviews':
                cell.number_format = '#,##0'

    # Column widths
    for col_idx, header in enumerate(headers, 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = COLUMN_WIDTHS.get(header, 15)


# ============================================================
# SHEET 2: ALL LEADS
# ============================================================
ws_all = wb.create_sheet('All Leads')
ws_all.sheet_properties.tabColor = '70AD47'
headers = list(out.columns)
write_lead_sheet(ws_all, out, headers)

# ============================================================
# SHEET 3: TIER 1 - PRIORITY
# ============================================================
ws_t1 = wb.create_sheet('Tier 1 - Priority')
ws_t1.sheet_properties.tabColor = 'C6EFCE'
t1_data = out[out['Tier'].str.startswith('1 -')]
write_lead_sheet(ws_t1, t1_data, headers)

# ============================================================
# STEP 6: SAVE
# ============================================================
# Determine metro slug for filename
if len(metros) == 1:
    metro_slug = metros[0].replace(', ', '_').replace(' ', '_')
else:
    metro_slug = 'All_Metros'

filename = f'VerveLabs_Sales_Leads_{metro_slug}_{TODAY}.xlsx'
output_path = f'{OUTPUT_DIR}{filename}'
wb.save(output_path)

print(f'Report saved: {output_path}')
print(f'Total leads: {len(out)}')
print(f'Tier 1: {len(t1_data)}')
print(f'Tier 2: {len(out[out["Tier"].str.startswith("2 -")])}')
print(f'Tier 3: {len(out[out["Tier"].str.startswith("3 -")])}')
```

---

## 8. Extending This Report

### Adding New Metros

No code changes needed. The script dynamically detects metros from the data. Just ensure the new metro's data is in Supabase before exporting.

### Adding New Junk Categories

Append to `JUNK_CATEGORIES` list when new false positives are discovered. Common patterns to watch for:
- Businesses matching on "RMT" (Registered Massage Therapist acronym)
- Schools and training programs
- Professional associations and licensing boards
- Completely unrelated businesses with "body" or "touch" in the name

### Adding New Tiers

If phone validation is added (Step 4+), consider splitting Tier 2:
- `2a - Dial (Verified Phone)`: Phone confirmed working
- `2b - Dial (Unverified Phone)`: Phone not yet validated

### Adding New Columns

If new enrichment steps add data (e.g., social media follower count, last social post date), add them to `OUTPUT_COLUMNS` and `COLUMN_WIDTHS` dictionaries. The `write_lead_sheet` function handles any number of columns automatically.

### Filtering by Metro

To generate a single-metro report, add a filter after loading:
```python
METRO_FILTER = 'Austin, TX'  # or None for all
if METRO_FILTER:
    df = df[df['metro'] == METRO_FILTER]
```

---

## 9. Quality Checks

After generating any report, verify:

1. **Zero junk records**: No transportation, car repair, schools, or associations
2. **No null text in cells**: Empty cells, not "None" or "NaN" strings
3. **Tier counts make sense**: Tier 1 should be smallest, Tier 3 should shrink as enrichment improves
4. **No duplicate businesses**: `Business Name` column should have zero duplicates
5. **Phone numbers present**: 95%+ of rows should have a Business Phone
6. **Tier 1 has names**: Every Tier 1 row must have a non-empty Contact Name

---

## 10. Dependencies

```
pip install pandas openpyxl
```

No other dependencies required. The script uses only standard openpyxl formatting — no LibreOffice recalculation needed since there are no formulas.
