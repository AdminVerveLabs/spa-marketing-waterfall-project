# Claude Code Task: Add Help Center to Dashboard

## Overview

Add a "Help" page to the dashboard sidebar (below Bug Reports). The page displays a video at the top (loaded from Supabase Storage) and below it, expandable accordion sections of help content. All content is provided below — just render it as-is.

## Video Setup

Store the video in Supabase Storage bucket `help-assets`. The video file will be uploaded manually later.

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('help-assets', 'help-assets', true);
```

- Display with a standard HTML `<video>` tag with controls (not an iframe), max-width ~800px, centered
- Construct the public URL directly using `getPublicUrl()` (no `.list()` call needed)
- Use the `<video>` element's `onError` event to detect missing files and show the "Walkthrough video coming soon" placeholder
- Store the video filename as a constant so it's easy to update (e.g. `const HELP_VIDEO_PATH = 'walkthrough.mp4'`)

## Page Layout

- Page title: "Help Center" with subtitle "Everything you need to know about using the Run Manager"
- Video section at top
- Below: accordion sections, one per topic below
- First section ("Welcome") expanded by default, all others collapsed
- Users can expand multiple sections at once
- Match existing dashboard dark theme styling

---

## Help Content

Render each section below as an expandable accordion panel. The section titles are the panel headers. Content should be rendered as styled markdown (paragraphs, bold, lists where used). Keep the visual style clean — no decorative elements, just readable text.

---

### 1. Welcome to VerveLabs Run Manager

This is an internal tool that manages the lead discovery and enrichment pipeline for spamarketing.com.

It automates the process of finding massage therapy and spa businesses across North American metro areas, gathering detailed information about each business, identifying owners and key contacts, and producing sales-ready reports your team can use for outreach.

**What it does in plain terms:** You tell it which city to search. It finds every massage and spa business in that area using Google and Yelp, visits their websites, figures out what booking platform they use, whether they run paid ads, finds their social media profiles, identifies the owner or manager, looks up their email and phone number, and packages everything into a scored, prioritized Excel report.

The entire process is automated. You just pick the city and click start.

---

### 2. Important Rules

**Only one run at a time.** This is the most important rule. The system runs on a server with limited memory. If two runs execute simultaneously, the server will crash and both runs will fail. The dashboard enforces this — if a run is already active, your new run will be queued and start automatically when the current one finishes.

**Don't manually trigger runs in n8n.** All runs should go through this dashboard. Running directly in n8n bypasses the queue and status tracking, which can cause conflicts.

**Let runs finish.** Once a run starts, let it complete. There's no "cancel" button because stopping a run mid-pipeline can leave data in a partially enriched state. If something looks stuck, check the "What to do if a run fails" section below before taking action.

**Closing your browser is fine.** The pipeline runs on the server, not in your browser. You can close the dashboard, go for lunch, and check back later. The run will complete regardless.

**API credits are real money.** Each run uses credits from Google Places, Apollo, NamSor, SociaVault, and Apify. A typical metro run costs roughly $5–15 in API calls depending on the number of businesses found. Don't run the same metro repeatedly without reason — use re-runs intentionally.

---

### 3. How the Pipeline Works

When you start a run, here's what happens behind the scenes:

**Step 1 — Discover businesses.** The system searches Google Places and Yelp for your search queries (like "massage therapy", "day spa") within your chosen radius. It collects every matching business: name, phone, address, website, Google rating, and reviews. Duplicates found on both platforms are automatically merged.

**Step 2 — Enrich companies.** For each discovered business, the system visits their website and analyzes it. It detects what booking platform they use (Jane App, Acuity, Mindbody, Vagaro, etc.), whether they run Google or Facebook ads, what social media profiles they have, and estimates the business size based on team pages.

**Step 3a — Find people.** The system identifies who owns or manages each business. It checks Apollo's database, scrapes "About" and "Team" pages on websites, and detects solo practitioners. Each identified person becomes a contact record.

**Step 3b — Enrich social profiles.** For every social media profile found (Facebook, Instagram, TikTok), the system pulls follower counts, post counts, and last post dates. This tells you how active the business is online.

**Step 4 — Enrich contacts.** For each contact found, the system looks up their direct email (via Hunter.io), verifies it, checks for a LinkedIn profile, finds a direct phone number, and runs their name through NamSor for cultural affinity data to help personalize outreach.

After all steps complete, the system generates a report and marks the run as completed.

The pipeline processes companies in batches of 25 to avoid overloading the server. For a metro with 100 businesses, that's 4 batches running one after another.

---

### 4. Starting a Run

**The metro table** on the Dashboard and New Run pages shows every city that has been run before, along with its current status and when it was last processed. This helps you avoid re-running a city that was just completed yesterday, and lets you spot cities that are overdue for a refresh.

- **Status** tells you the result of the most recent run for that metro: completed (green), running (amber), failed (red), or queued (gray).
- **Last Run** shows when the most recent run finished. If a metro hasn't been run in 30+ days, it's a good candidate for a re-run to catch new businesses.

**To start a new run:**

1. Go to "New Run" in the sidebar
2. Select the country (US or Canada)
3. Select the state or province
4. Select the city — the latitude, longitude, and Yelp location will auto-fill
5. Choose your search radius
6. Choose or customize your search queries
7. Click "Start Pipeline"

**Search radius** controls how far from the city center the system looks. The radius is measured from the lat/lng coordinates of the selected city.

- **5 km** — tight urban core only. Use for dense cities like Manhattan or downtown Toronto.
- **10 km (default)** — covers most of a mid-size city. Good for Austin, Nashville, Boise.
- **15 km** — includes surrounding suburbs. Good for spread-out cities like Phoenix or Houston.
- **25 km** — wide search. Covers a large metro area. Use for sparse markets where businesses are spread out.

Larger radius = more businesses found = longer run time = more API credits. Start with 10 km and expand if you feel like you're missing businesses.

**Search queries** are the actual terms the system types into Google Places. Each query runs as a separate search, and the results are merged and deduplicated.

The default set is: "massage therapy", "massage clinic", "RMT", "spa massage", "massage therapist". This casts a wide net for massage-focused businesses.

The "Spa Focus" template uses: "day spa", "med spa", "wellness spa", "beauty spa". Use this if you're targeting the spa market specifically.

You can also type your own queries. Separate them with commas. Each term becomes its own Google Places search, so "massage therapy" and "massage therapist" will return overlapping but slightly different results — the system deduplicates automatically.

**Tip:** More queries = more thorough coverage but longer run time. 4–6 queries is the sweet spot.

---

### 5. How Long Does a Run Take?

This depends on the metro size:

- **Small metro (30–50 businesses):** 15–20 minutes
- **Medium metro (50–100 businesses):** 20–35 minutes
- **Large metro (100–200 businesses):** 35–60 minutes

These are rough estimates. The biggest variable is how many businesses have websites to analyze and how many contacts need email/phone enrichment.

If a run has been going for more than 90 minutes, something is probably wrong. Check the "What to do if a run fails" section.

Don't refresh the page obsessively. The status updates when you load the page. Check back every 10–15 minutes.

---

### 6. Re-Runs

A re-run processes the same metro with the same configuration as a previous run. Use the "Re-run" button on any completed or failed run in the History page.

**What re-runs do:**
- Run the full pipeline again for that metro
- Discover any NEW businesses that have appeared since the last run
- Re-enrich existing businesses with updated data (new reviews, website changes, etc.)
- Find new contacts if ownership has changed
- Generate a fresh report

**What re-runs don't do:**
- They don't delete previous data. New results merge with existing records.
- They don't duplicate businesses. The system deduplicates on phone number and domain.
- They don't waste credits on unchanged data. Most enrichment steps skip records that already have complete data.

**When to re-run:**
- A metro hasn't been run in 30+ days and you want fresh data
- A previous run failed and you want to try again
- You want to expand the search radius or add new search queries (edit the queued run first, or start a new run with different settings)

---

### 7. What To Do If a Run Fails

Don't panic. Failures happen and data is not lost.

**Check the error message.** On the Run History page, failed runs show the error in small red text. Common causes:

- **"Apify memory error" or similar** — the Yelp or social media scraper ran out of memory. The system automatically retries this once. If it fails twice, it skips that data source and continues. You can re-run later.
- **"Timed out"** — the run took longer than 90 minutes and was automatically marked as failed. This usually means the server got overloaded. Wait 10 minutes, then re-run.
- **"Offer expired" or task runner errors** — the n8n server's internal task runner fell behind. This is a server resource issue. Wait a few minutes and re-run.

**If a run is stuck on "running" for over 90 minutes:**
The system will automatically mark it as failed after 90 minutes. If you don't want to wait, you can manually check n8n to see if anything is still executing.

**If runs keep failing repeatedly:**
After 3 consecutive failures, the system pauses the queue. This prevents a crash loop. Check the n8n logs on the server before resuming.

**Your data is safe.** Partial data from a failed run is still in the database. A re-run will pick up where things left off thanks to deduplication.

---

### 8. The Report

When a run completes, the system automatically generates an Excel (.xlsx) report for that metro. This is the deliverable your sales team uses for outreach.

**How to access it:**
- The report is automatically emailed to the configured recipients when the run completes
- You can also download it from the Run History page — look for the download icon in the Report column
- Reports are stored permanently and can be re-downloaded anytime

**What's in the report:**

The report has multiple sheets:

- **Summary** — high-level stats: total businesses found, contact counts, tier breakdown, scoring explanation
- **Tier 1a — Email + Call** — the best leads. These have a verified contact name, verified email, AND verified phone number. Your sales team can both email and call these people by name.
- **Tier 1b — Call Only** — leads with a verified contact name and verified phone, but no verified email. Phone outreach only.
- **Tier 2 — Dial (Business Phone)** — businesses with a working phone number but no identified contact person. The sales team calls the business line and asks for the owner.
- **Tier 3 — Research Needed** — businesses found but missing key contact data. May need manual research before outreach.

---

### 9. Understanding Tiers vs. Scores

These two systems measure different things and are designed to work together.

**Tier = "Can we reach them?"**
Tiers are about contactability. A Tier 1a lead has everything your sales team needs to make contact: a name, a verified email, a verified phone. A Tier 3 lead was found but doesn't have enough contact information for effective outreach yet. Tiers determine what ACTION the sales team takes.

**Score = "How much do they need us?"**
Scores measure business need signals. A business with no website gets points (they need digital help). No online booking gets points. A solo practitioner gets points (high need, fewer resources). A business with a full website, online booking, and active social media scores lower — they probably already have marketing support.

**Why high-score leads are often in low tiers:**
This is not a bug. The most in-need businesses (score 25+) are often solo practitioners with no website and no booking system. They're the ideal customer — but they're also the hardest to find contact info for, which puts them in Tier 3. Meanwhile, Tier 1 leads (easy to contact) tend to be more established businesses with lower need scores.

**How to use both together:**
Within each tier, sort by score. A Tier 1a lead with a score of 20 is a better call than a Tier 1a with a score of 5. A Tier 2 lead with a score of 25 is absolutely worth the effort of calling the business line. Tier 3 leads with high scores are worth flagging for manual research — if you can find the owner's info, they're prime prospects.

---

### 10. Helpful Fields in the Report

Here's what the key columns mean and why they matter:

- **Business Name / Phone / Address** — basic business info from Google Places and Yelp
- **Category** — simplified business type (Massage, Day Spa, Wellness Center, Chiropractor, etc.)
- **Google Rating / Review Count** — credibility indicators. Low reviews + low rating = newer or struggling business
- **Has Website** — whether the business has a website at all. No website = strong need signal
- **Booking Platform** — what online booking system they use (Jane App, Acuity, Mindbody, Vagaro, Square, or none). "None" = opportunity
- **Has Paid Ads** — whether Google Ads or Meta Pixel was detected on their website. If yes, they already invest in marketing. If no, they may not know about it.
- **Estimated Size** — solo, small, or medium based on team page analysis. Solo practitioners are highest-need prospects.
- **Contact Name** — the identified owner, manager, or practitioner
- **Email (Verified)** — a deliverable email address. "verified" means Hunter.io confirmed it's a real inbox.
- **Phone (Verified)** — a working phone number. If it says "mobile" in the phone type column, even better — it's likely a direct line.
- **LinkedIn** — a link to the contact's LinkedIn profile, if found. Useful for researching before outreach.
- **Cultural Affinity** — the contact's likely cultural background from NamSor. Use this to personalize outreach language and approach.
- **Lead Score** — numeric score based on business need signals. Higher = more likely to need marketing help.
- **On Groupon / On Yelp** — whether the business appears on these platforms. Groupon presence is a strong buying signal — they're already spending on customer acquisition.

---

### 11. Bug Reports

If something doesn't work right, use the Bug Reports page to let us know.

**To submit a bug:**
1. Go to "Bug Reports" in the sidebar
2. Select which page the problem is on
3. Choose severity: "Broken" (can't complete a task), "Annoying" (works but frustrating), or "Cosmetic" (looks wrong but works fine)
4. Describe what happened and what you expected
5. Optionally add steps to reproduce
6. Submit — the bug is saved and visible on the same page

**Bug statuses:**
- **Open** — reported, not yet looked at
- **Investigating** — someone is looking into it
- **Fixed** — the issue has been resolved
- **Won't Fix** — the issue is known but won't be addressed (with a reason)

Anyone can update the status of a bug using the dropdown in the bug list. If you reported something and it was fixed, check back and confirm it's actually resolved.

Some technical information is captured automatically when you submit (your browser version, the page URL, and any recent console errors). This helps with debugging — you don't need to worry about collecting it.

---

### 12. Admin: Adding Users and Metros

**Adding a new user:**
Users are managed in Supabase, not in this dashboard.
1. Log into the Supabase dashboard (supabase.com → your project)
2. Go to Authentication → Users
3. Click "Add User" → enter their email and a temporary password
4. Share the credentials with them — they'll use them to log into this dashboard
5. There are no roles or permissions — all users have the same access

**Adding a new metro:**
Metro data (the cities available in the New Run dropdown) is stored as a static file in the app code. To add a new city:
1. Open `src/data/metros.ts` in the codebase
2. Find the correct country and state section
3. Add a new entry with: city name, latitude, longitude, metro_name (format: "City, ST"), and yelp_location (same as metro_name)
4. Commit and redeploy the dashboard

Use Google Maps to find accurate lat/lng coordinates: right-click any location → the coordinates appear at the top of the menu.

If you need to add a new state or province that doesn't exist yet, add the full state object with its name and an array containing the new city.

Changes require a code change and redeployment. If you're not comfortable doing this, ask the developer to add it.

---

## End of Content
