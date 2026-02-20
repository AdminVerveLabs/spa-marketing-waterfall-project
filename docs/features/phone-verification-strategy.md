# Phone Verification Strategy

## Context

Email verification is implemented (Hunter Email Verifier in Step 4). Phone verification is the equivalent for phone numbers. Three levels of confidence, each building on the previous.

---

## Level 1: Format Validation ✅ DONE

**What:** Structural checks — is this a plausible phone number?
**Where:** Layer 1 validation in Step 3a (Validate & Clean Contact nodes)
**Already implemented:**
- Strip to digits, normalize E.164 (+1 + 10 digits US/CA)
- Reject <10 digits, invalid area codes (0xx, 1xx)
- Handle Apollo object format `{sanitized_number: "..."}`
- Flag international (>11 digits)

**Confidence:** Low — "looks like a phone number" but could be disconnected, recycled, or wrong person.

---

## Level 2: Active Line Verification ✅ IMPLEMENTED (Session 20)

**What:** Is this number currently assigned to a carrier and in service?
**Where:** Step 4 (alongside email verification)

### Recommended Service: Telnyx Number Lookup

**Why Telnyx:**
- Cheapest per-lookup ($0.003)
- HLR lookup for mobile (pings carrier network for active SIM)
- CNAM lookup for landline (registered business/person name)
- Returns line type (mobile/landline/voip/toll-free)
- At 1000 contacts: ~$3 total

**Endpoint:** `GET https://api.telnyx.com/v2/number_lookup/{number}`
**Auth:** Bearer token
**Response includes:**
- `valid`: boolean
- `carrier.name`: carrier name (e.g., "AT&T")
- `carrier.type`: mobile / landline / voip
- `portability.status`: ported / not_ported
- `caller_name.caller_name`: CNAM registered name (if available)

**Alternative Options:**
| Service | Cost/lookup | HLR | CNAM | Line Type | Notes |
|---------|------------|-----|------|-----------|-------|
| Telnyx | $0.003 | ✅ | ✅ | ✅ | Best value |
| Twilio Lookup v2 | $0.015 | ❌ | $0.01 extra | ✅ | More expensive, no HLR |
| Vonage Insight Advanced | $0.03 | ✅ | ✅ | ✅ | Most detailed but priciest |
| NumVerify | Free-$0.003 | ❌ | ❌ | ✅ | Cheap but less reliable |

### Schema Addition (deployed as `scripts/deploy-phone-verification.sql`)
```sql
-- phone_status defaults to NULL (not 'unverified') — lesson from BUG-F010
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_status TEXT
    CHECK (phone_status IN ('valid', 'invalid', 'disconnected', 'voip')),
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_line_type TEXT
    CHECK (phone_line_type IN ('mobile', 'landline', 'voip', 'toll_free')),
  ADD COLUMN IF NOT EXISTS phone_carrier TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS phone_status TEXT
    CHECK (phone_status IN ('valid', 'invalid', 'disconnected', 'voip')),
  ADD COLUMN IF NOT EXISTS phone_line_type TEXT
    CHECK (phone_line_type IN ('mobile', 'landline', 'voip', 'toll_free'));

CREATE INDEX IF NOT EXISTS idx_contacts_phone_status ON contacts (phone_status)
  WHERE phone_direct IS NOT NULL AND phone_status IS NULL;
```

### Implementation (Step 4)
Same pattern as email verification:
1. Config toggle: `skip_phone_verifier: "true"/"false"`
2. Check: does contact have phone_direct AND phone_status = 'unverified'?
3. Call Telnyx Lookup API
4. Map response → phone_status, phone_line_type, phone_carrier
5. If invalid/disconnected → null out phone_direct, keep status for audit
6. Update Supabase

### Status Mapping
| Telnyx Response | phone_status | Action |
|----------------|-------------|--------|
| valid + mobile/landline | `valid` | Keep number |
| valid + voip | `voip` | Keep but flag (voip numbers can be temporary) |
| invalid | `invalid` | Null out phone_direct |
| not reachable / disconnected | `disconnected` | Null out phone_direct |

### Also Verify Company Phones
Company phone numbers (from Google Places/Yelp) should also be verified. These are the fallback when contacts don't have a direct number. Add phone_status to companies table too.

---

## Level 3: Identity Matching 🔲 FUTURE

**What:** Does this number actually belong to this person/business?
**Where:** Step 4 or Step 5 (scoring signal)
**When:** After Level 2 is working and pipeline is at scale

### What It Does
Cross-references the phone number against the contact/company name to confirm the number belongs to the right entity. A verified-but-wrong number is worse than no number.

### Services
| Service | Cost/lookup | What You Get |
|---------|------------|-------------|
| Telnyx CNAM | Included in Level 2 | Registered line name (often business name for landlines) |
| Twilio CNAM | $0.01 | Same — registered caller name |
| Ekata (Mastercard) | ~$0.10-0.50 | Full identity: name, address, business association |
| Whitepages Pro | ~$0.10-0.30 | Reverse lookup: name, address, business |
| Nomorobo | Varies | Spam/robocall flagging (useful for filtering out bad numbers) |

### How It Works
1. Get CNAM registered name from Level 2 lookup (Telnyx includes this)
2. Fuzzy match CNAM name against: company name, contact first+last name
3. Score the match:
   - Exact or close match → high confidence
   - Partial match (first name only) → medium confidence
   - No match → low confidence (number might be recycled or wrong)
4. Store match score as a signal for Step 5 scoring

### Schema Addition (Future)
```sql
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_cnam TEXT,
  ADD COLUMN IF NOT EXISTS phone_identity_match TEXT
    CHECK (phone_identity_match IN ('confirmed', 'partial', 'mismatch', 'unknown', NULL));
```

### When to Invest in Level 3
- After you have 500+ verified numbers from Level 2
- When you see cold call connect rates below target
- When wrong-number complaints become a pattern
- For high-value leads where you want maximum confidence before outreach

---

## Implementation Priority

| Level | Status | Effort | Cost at 1000 contacts | Recommendation |
|-------|--------|--------|----------------------|----------------|
| 1: Format | ✅ Done | — | $0 | Already in Layer 1 |
| 2: Active Line | ✅ Done (Session 20) | Medium | ~$3 (Telnyx) | Deployed, needs Telnyx account + API key to enable |
| 3: Identity | 🔲 Future | Low (if using Telnyx CNAM) | Included in Level 2 | Add after Level 2 is proven, use as scoring signal |

---

## Notes

- **Company phones vs contact phones:** Verify both. Company phones from Google Places are generally reliable but can be outdated. Contact direct phones from Apollo may be personal cell numbers.
- **VoIP numbers:** Don't auto-reject. Many small businesses use Google Voice, Grasshopper, or similar. Flag as `voip` and let scoring decide.
- **Toll-free numbers:** These are company numbers (1-800, 1-888, etc.). Valid for the company, but not useful for reaching a specific person. Store on company, not contact.
- **International numbers:** Telnyx supports international lookups. The +44, +1604 numbers in your Austin data (UK/Canada contacts) can be verified too.
