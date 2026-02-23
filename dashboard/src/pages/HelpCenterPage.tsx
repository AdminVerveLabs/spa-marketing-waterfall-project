import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const HELP_VIDEO_PATH = 'walkthrough.mp4';

interface HelpSection {
  title: string;
  content: React.ReactNode;
}

const helpSections: HelpSection[] = [
  {
    title: "Welcome to VerveLabs Run Manager",
    content: (
      <>
        <p>This is an internal tool that manages the lead discovery and enrichment pipeline for spamarketing.com.</p>
        <p>It automates the process of finding massage therapy and spa businesses across North American metro areas, gathering detailed information about each business, identifying owners and key contacts, and producing sales-ready reports your team can use for outreach.</p>
        <p><strong>What it does in plain terms:</strong> You tell it which city to search. It finds every massage and spa business in that area using Google and Yelp, visits their websites, figures out what booking platform they use, whether they run paid ads, finds their social media profiles, identifies the owner or manager, looks up their email and phone number, and packages everything into a scored, prioritized Excel report.</p>
        <p>The entire process is automated. You just pick the city and click start.</p>
      </>
    ),
  },
  {
    title: "Important Rules",
    content: (
      <>
        <p><strong>Only one run at a time.</strong> This is the most important rule. The system runs on a server with limited memory. If two runs execute simultaneously, the server will crash and both runs will fail. The dashboard enforces this — if a run is already active, your new run will be queued and start automatically when the current one finishes.</p>
        <p><strong>Don't manually trigger runs in n8n.</strong> All runs should go through this dashboard. Running directly in n8n bypasses the queue and status tracking, which can cause conflicts.</p>
        <p><strong>Let runs finish.</strong> Once a run starts, let it complete. There's no "cancel" button because stopping a run mid-pipeline can leave data in a partially enriched state. If something looks stuck, check the "What to do if a run fails" section below before taking action.</p>
        <p><strong>Closing your browser is fine.</strong> The pipeline runs on the server, not in your browser. You can close the dashboard, go for lunch, and check back later. The run will complete regardless.</p>
        <p><strong>API credits are real money.</strong> Each run uses credits from Google Places, Apollo, NamSor, SociaVault, and Apify. A typical metro run costs roughly $5–15 in API calls depending on the number of businesses found. Don't run the same metro repeatedly without reason — use re-runs intentionally.</p>
      </>
    ),
  },
  {
    title: "How the Pipeline Works",
    content: (
      <>
        <p>When you start a run, here's what happens behind the scenes:</p>
        <p><strong>Step 1 — Discover businesses.</strong> The system searches Google Places and Yelp for your search queries (like "massage therapy", "day spa") within your chosen radius. It collects every matching business: name, phone, address, website, Google rating, and reviews. Duplicates found on both platforms are automatically merged.</p>
        <p><strong>Step 2 — Enrich companies.</strong> For each discovered business, the system visits their website and analyzes it. It detects what booking platform they use (Jane App, Acuity, Mindbody, Vagaro, etc.), whether they run Google or Facebook ads, what social media profiles they have, and estimates the business size based on team pages.</p>
        <p><strong>Step 3a — Find people.</strong> The system identifies who owns or manages each business. It checks Apollo's database, scrapes "About" and "Team" pages on websites, and detects solo practitioners. Each identified person becomes a contact record.</p>
        <p><strong>Step 3b — Enrich social profiles.</strong> For every social media profile found (Facebook, Instagram, TikTok), the system pulls follower counts, post counts, and last post dates. This tells you how active the business is online.</p>
        <p><strong>Step 4 — Enrich contacts.</strong> For each contact found, the system looks up their direct email (via Hunter.io), verifies it, checks for a LinkedIn profile, finds a direct phone number, and runs their name through NamSor for cultural affinity data to help personalize outreach.</p>
        <p>After all steps complete, the system generates a report and marks the run as completed.</p>
        <p>The pipeline processes companies in batches of 25 to avoid overloading the server. For a metro with 100 businesses, that's 4 batches running one after another.</p>
      </>
    ),
  },
  {
    title: "Starting a Run",
    content: (
      <>
        <p><strong>The metro table</strong> on the Dashboard and New Run pages shows every city that has been run before, along with its current status and when it was last processed. This helps you avoid re-running a city that was just completed yesterday, and lets you spot cities that are overdue for a refresh.</p>
        <ul>
          <li><strong>Status</strong> tells you the result of the most recent run for that metro: completed (green), running (amber), failed (red), or queued (gray).</li>
          <li><strong>Last Run</strong> shows when the most recent run finished. If a metro hasn't been run in 30+ days, it's a good candidate for a re-run to catch new businesses.</li>
        </ul>
        <p><strong>To start a new run:</strong></p>
        <ol>
          <li>Go to "New Run" in the sidebar</li>
          <li>Select the country (US or Canada)</li>
          <li>Select the state or province</li>
          <li>Select the city — the latitude, longitude, and Yelp location will auto-fill</li>
          <li>Choose your search radius</li>
          <li>Choose or customize your search queries</li>
          <li>Click "Start Pipeline"</li>
        </ol>
        <p><strong>Search radius</strong> controls how far from the city center the system looks. The radius is measured from the lat/lng coordinates of the selected city.</p>
        <ul>
          <li><strong>5 km</strong> — tight urban core only. Use for dense cities like Manhattan or downtown Toronto.</li>
          <li><strong>10 km (default)</strong> — covers most of a mid-size city. Good for Austin, Nashville, Boise.</li>
          <li><strong>15 km</strong> — includes surrounding suburbs. Good for spread-out cities like Phoenix or Houston.</li>
          <li><strong>25 km</strong> — wide search. Covers a large metro area. Use for sparse markets where businesses are spread out.</li>
        </ul>
        <p>Larger radius = more businesses found = longer run time = more API credits. Start with 10 km and expand if you feel like you're missing businesses.</p>
        <p><strong>Search queries</strong> are the actual terms the system types into Google Places. Each query runs as a separate search, and the results are merged and deduplicated.</p>
        <p>The default set is: "massage therapy", "massage clinic", "RMT", "spa massage", "massage therapist". This casts a wide net for massage-focused businesses.</p>
        <p>The "Spa Focus" template uses: "day spa", "med spa", "wellness spa", "beauty spa". Use this if you're targeting the spa market specifically.</p>
        <p>You can also type your own queries. Separate them with commas. Each term becomes its own Google Places search, so "massage therapy" and "massage therapist" will return overlapping but slightly different results — the system deduplicates automatically.</p>
        <p><strong>Tip:</strong> More queries = more thorough coverage but longer run time. 4–6 queries is the sweet spot.</p>
      </>
    ),
  },
  {
    title: "How Long Does a Run Take?",
    content: (
      <>
        <p>This depends on the metro size:</p>
        <ul>
          <li><strong>Small metro (30–50 businesses):</strong> 15–20 minutes</li>
          <li><strong>Medium metro (50–100 businesses):</strong> 20–35 minutes</li>
          <li><strong>Large metro (100–200 businesses):</strong> 35–60 minutes</li>
        </ul>
        <p>These are rough estimates. The biggest variable is how many businesses have websites to analyze and how many contacts need email/phone enrichment.</p>
        <p>If a run has been going for more than 90 minutes, something is probably wrong. Check the "What to do if a run fails" section.</p>
        <p>Don't refresh the page obsessively. The status updates when you load the page. Check back every 10–15 minutes.</p>
      </>
    ),
  },
  {
    title: "Re-Runs",
    content: (
      <>
        <p>A re-run processes the same metro with the same configuration as a previous run. Use the "Re-run" button on any completed or failed run in the History page.</p>
        <p><strong>What re-runs do:</strong></p>
        <ul>
          <li>Run the full pipeline again for that metro</li>
          <li>Discover any NEW businesses that have appeared since the last run</li>
          <li>Re-enrich existing businesses with updated data (new reviews, website changes, etc.)</li>
          <li>Find new contacts if ownership has changed</li>
          <li>Generate a fresh report</li>
        </ul>
        <p><strong>What re-runs don't do:</strong></p>
        <ul>
          <li>They don't delete previous data. New results merge with existing records.</li>
          <li>They don't duplicate businesses. The system deduplicates on phone number and domain.</li>
          <li>They don't waste credits on unchanged data. Most enrichment steps skip records that already have complete data.</li>
        </ul>
        <p><strong>When to re-run:</strong></p>
        <ul>
          <li>A metro hasn't been run in 30+ days and you want fresh data</li>
          <li>A previous run failed and you want to try again</li>
          <li>You want to expand the search radius or add new search queries (edit the queued run first, or start a new run with different settings)</li>
        </ul>
      </>
    ),
  },
  {
    title: "What To Do If a Run Fails",
    content: (
      <>
        <p>Don't panic. Failures happen and data is not lost.</p>
        <p><strong>Check the error message.</strong> On the Run History page, failed runs show the error in small red text. Common causes:</p>
        <ul>
          <li><strong>"Apify memory error" or similar</strong> — the Yelp or social media scraper ran out of memory. The system automatically retries this once. If it fails twice, it skips that data source and continues. You can re-run later.</li>
          <li><strong>"Timed out"</strong> — the run took longer than 90 minutes and was automatically marked as failed. This usually means the server got overloaded. Wait 10 minutes, then re-run.</li>
          <li><strong>"Offer expired" or task runner errors</strong> — the n8n server's internal task runner fell behind. This is a server resource issue. Wait a few minutes and re-run.</li>
        </ul>
        <p><strong>If a run is stuck on "running" for over 90 minutes:</strong> The system will automatically mark it as failed after 90 minutes. If you don't want to wait, you can manually check n8n to see if anything is still executing.</p>
        <p><strong>If runs keep failing repeatedly:</strong> After 3 consecutive failures, the system pauses the queue. This prevents a crash loop. Check the n8n logs on the server before resuming.</p>
        <p><strong>Your data is safe.</strong> Partial data from a failed run is still in the database. A re-run will pick up where things left off thanks to deduplication.</p>
      </>
    ),
  },
  {
    title: "The Report",
    content: (
      <>
        <p>When a run completes, the system automatically generates an Excel (.xlsx) report for that metro. This is the deliverable your sales team uses for outreach.</p>
        <p><strong>How to access it:</strong></p>
        <ul>
          <li>The report is automatically emailed to the configured recipients when the run completes</li>
          <li>You can also download it from the Run History page — look for the download icon in the Report column</li>
          <li>Reports are stored permanently and can be re-downloaded anytime</li>
        </ul>
        <p><strong>What's in the report:</strong></p>
        <p>The report has multiple sheets:</p>
        <ul>
          <li><strong>Summary</strong> — high-level stats: total businesses found, contact counts, tier breakdown, scoring explanation</li>
          <li><strong>Tier 1a — Email + Call</strong> — the best leads. These have a verified contact name, verified email, AND verified phone number. Your sales team can both email and call these people by name.</li>
          <li><strong>Tier 1b — Call Only</strong> — leads with a verified contact name and verified phone, but no verified email. Phone outreach only.</li>
          <li><strong>Tier 2 — Dial (Business Phone)</strong> — businesses with a working phone number but no identified contact person. The sales team calls the business line and asks for the owner.</li>
          <li><strong>Tier 3 — Research Needed</strong> — businesses found but missing key contact data. May need manual research before outreach.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Understanding Tiers vs. Scores",
    content: (
      <>
        <p>These two systems measure different things and are designed to work together.</p>
        <p><strong>Tier = "Can we reach them?"</strong> Tiers are about contactability. A Tier 1a lead has everything your sales team needs to make contact: a name, a verified email, a verified phone. A Tier 3 lead was found but doesn't have enough contact information for effective outreach yet. Tiers determine what ACTION the sales team takes.</p>
        <p><strong>Score = "How much do they need us?"</strong> Scores measure business need signals. A business with no website gets points (they need digital help). No online booking gets points. A solo practitioner gets points (high need, fewer resources). A business with a full website, online booking, and active social media scores lower — they probably already have marketing support.</p>
        <p><strong>Why high-score leads are often in low tiers:</strong> This is not a bug. The most in-need businesses (score 25+) are often solo practitioners with no website and no booking system. They're the ideal customer — but they're also the hardest to find contact info for, which puts them in Tier 3. Meanwhile, Tier 1 leads (easy to contact) tend to be more established businesses with lower need scores.</p>
        <p><strong>How to use both together:</strong> Within each tier, sort by score. A Tier 1a lead with a score of 20 is a better call than a Tier 1a with a score of 5. A Tier 2 lead with a score of 25 is absolutely worth the effort of calling the business line. Tier 3 leads with high scores are worth flagging for manual research — if you can find the owner's info, they're prime prospects.</p>
      </>
    ),
  },
  {
    title: "Helpful Fields in the Report",
    content: (
      <>
        <p>Here's what the key columns mean and why they matter:</p>
        <ul>
          <li><strong>Business Name / Phone / Address</strong> — basic business info from Google Places and Yelp</li>
          <li><strong>Category</strong> — simplified business type (Massage, Day Spa, Wellness Center, Chiropractor, etc.)</li>
          <li><strong>Google Rating / Review Count</strong> — credibility indicators. Low reviews + low rating = newer or struggling business</li>
          <li><strong>Has Website</strong> — whether the business has a website at all. No website = strong need signal</li>
          <li><strong>Booking Platform</strong> — what online booking system they use (Jane App, Acuity, Mindbody, Vagaro, Square, or none). "None" = opportunity</li>
          <li><strong>Has Paid Ads</strong> — whether Google Ads or Meta Pixel was detected on their website. If yes, they already invest in marketing. If no, they may not know about it.</li>
          <li><strong>Estimated Size</strong> — solo, small, or medium based on team page analysis. Solo practitioners are highest-need prospects.</li>
          <li><strong>Contact Name</strong> — the identified owner, manager, or practitioner</li>
          <li><strong>Email (Verified)</strong> — a deliverable email address. "verified" means Hunter.io confirmed it's a real inbox.</li>
          <li><strong>Phone (Verified)</strong> — a working phone number. If it says "mobile" in the phone type column, even better — it's likely a direct line.</li>
          <li><strong>LinkedIn</strong> — a link to the contact's LinkedIn profile, if found. Useful for researching before outreach.</li>
          <li><strong>Cultural Affinity</strong> — the contact's likely cultural background from NamSor. Use this to personalize outreach language and approach.</li>
          <li><strong>Lead Score</strong> — numeric score based on business need signals. Higher = more likely to need marketing help.</li>
          <li><strong>On Groupon / On Yelp</strong> — whether the business appears on these platforms. Groupon presence is a strong buying signal — they're already spending on customer acquisition.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Bug Reports",
    content: (
      <>
        <p>If something doesn't work right, use the Bug Reports page to let us know.</p>
        <p><strong>To submit a bug:</strong></p>
        <ol>
          <li>Go to "Bug Reports" in the sidebar</li>
          <li>Select which page the problem is on</li>
          <li>Choose severity: "Broken" (can't complete a task), "Annoying" (works but frustrating), or "Cosmetic" (looks wrong but works fine)</li>
          <li>Describe what happened and what you expected</li>
          <li>Optionally add steps to reproduce</li>
          <li>Submit — the bug is saved and visible on the same page</li>
        </ol>
        <p><strong>Bug statuses:</strong></p>
        <ul>
          <li><strong>Open</strong> — reported, not yet looked at</li>
          <li><strong>Investigating</strong> — someone is looking into it</li>
          <li><strong>Fixed</strong> — the issue has been resolved</li>
          <li><strong>Won't Fix</strong> — the issue is known but won't be addressed (with a reason)</li>
        </ul>
        <p>Anyone can update the status of a bug using the dropdown in the bug list. If you reported something and it was fixed, check back and confirm it's actually resolved.</p>
        <p>Some technical information is captured automatically when you submit (your browser version, the page URL, and any recent console errors). This helps with debugging — you don't need to worry about collecting it.</p>
      </>
    ),
  },
  {
    title: "Admin: Adding Users and Metros",
    content: (
      <>
        <p><strong>Adding a new user:</strong></p>
        <p>Users are managed in Supabase, not in this dashboard.</p>
        <ol>
          <li>Log into the Supabase dashboard (supabase.com → your project)</li>
          <li>Go to Authentication → Users</li>
          <li>Click "Add User" → enter their email and a temporary password</li>
          <li>Share the credentials with them — they'll use them to log into this dashboard</li>
          <li>There are no roles or permissions — all users have the same access</li>
        </ol>
        <p><strong>Adding a new metro:</strong></p>
        <p>Metro data (the cities available in the New Run dropdown) is stored as a static file in the app code. To add a new city:</p>
        <ol>
          <li>Open <code>src/data/metros.ts</code> in the codebase</li>
          <li>Find the correct country and state section</li>
          <li>Add a new entry with: city name, latitude, longitude, metro_name (format: "City, ST"), and yelp_location (same as metro_name)</li>
          <li>Commit and redeploy the dashboard</li>
        </ol>
        <p>Use Google Maps to find accurate lat/lng coordinates: right-click any location → the coordinates appear at the top of the menu.</p>
        <p>If you need to add a new state or province that doesn't exist yet, add the full state object with its name and an array containing the new city.</p>
        <p>Changes require a code change and redeployment. If you're not comfortable doing this, ask the developer to add it.</p>
      </>
    ),
  },
];

export function HelpCenterPage() {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoChecked, setVideoChecked] = useState(false);

  useEffect(() => {
    supabase.storage
      .from('help-assets')
      .list('', { limit: 100 })
      .then(({ data }) => {
        const found = data?.some((f) => f.name === HELP_VIDEO_PATH);
        if (found) {
          const { data: urlData } = supabase.storage
            .from('help-assets')
            .getPublicUrl(HELP_VIDEO_PATH);
          setVideoUrl(urlData.publicUrl);
        }
        setVideoChecked(true);
      })
      .catch(() => setVideoChecked(true));
  }, []);

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Help Center</h1>
        <p className="text-slate-500 text-sm mt-1">Everything you need to know about using the Run Manager</p>
      </div>

      {/* Video Section */}
      <div className="mb-8">
        {videoChecked && !videoUrl && (
          <div
            className="rounded-xl flex flex-col items-center justify-center py-16 px-8"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Video size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">Walkthrough video coming soon</p>
          </div>
        )}
        {videoUrl && (
          <div className="flex justify-center">
            <video
              src={videoUrl}
              controls
              className="rounded-xl"
              style={{ maxWidth: 800, width: '100%', border: '1px solid rgba(255,255,255,0.06)' }}
            />
          </div>
        )}
      </div>

      {/* Accordion Sections */}
      <div className="space-y-2">
        {helpSections.map((section, i) => {
          const isOpen = expanded.has(i);
          return (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                {isOpen ? (
                  <ChevronDown size={16} style={{ color: '#3ecfad', flexShrink: 0 }} />
                ) : (
                  <ChevronRight size={16} className="text-slate-600" style={{ flexShrink: 0 }} />
                )}
                <span
                  className="text-sm font-medium"
                  style={{ color: isOpen ? '#3ecfad' : '#e2e8f0' }}
                >
                  {section.title}
                </span>
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-0 ml-7 help-content">
                  <div className="text-slate-400 text-sm leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:space-y-1.5 [&_strong]:text-slate-300 [&_code]:text-teal-400 [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs">
                    {section.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
