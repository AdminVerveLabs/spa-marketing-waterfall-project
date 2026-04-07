  
**Spa Marketing Waterfall**

Metered Enrollment System

*Project Scope & Implementation Specification*

VerveLabs

March 2026

# **1\. Executive Summary**

This document specifies the implementation of a metered enrollment system that controls how contacts flow from Supabase into Apollo sequences. The goal is to match sequence enrollment to actual rep calling capacity, preventing task backlog while maintaining an aggressive sales cadence.

## **1.1 Problem Statement**

The current system enrolls contacts into Apollo sequences in batches of \~1,000. With a rep capacity of \~150 calls/day and a Day 1/1/3/5/7 cadence, this creates several issues:

* Sequence timing becomes meaningless (Day 2 tasks appear before Day 1 is complete)

* Task backlog grows uncontrollably

* Callbacks requested in Orum don't reliably sync back to Apollo

* No visibility into which contacts are actively being worked

## **1.2 Solution Overview**

Keep Apollo doing what it does well (sequences, task timing, dispositions). Add one n8n workflow that meters enrollment based on current sequence capacity. Use Apollo Plays for all state transitions.

| Component | Responsibility | If It Fails |
| :---- | :---- | :---- |
| Apollo Sequences | Manages Day 1/1/3/5/7 timing, creates tasks | Whole system stops (same as today) |
| Apollo Plays | State transitions on call outcomes | Dispositions don't update stages |
| Orum | Dials tasks from Apollo | Rep calls manually from Apollo |
| n8n Workflow | Daily enrollment of new contacts | No new contacts enter; current work continues |
| Supabase | Holds pending contacts, tracks enrollment | n8n can't find new contacts to enroll |

The worst-case failure mode is enrollment pauses. Contacts already in sequence continue to receive calls on schedule. This is significantly more resilient than managing all task creation through n8n.

# **2\. Investigation Phase**

Before implementing changes, Claude Code must investigate the current state of the system. This ensures we understand existing patterns and don't break working functionality.

## **2.1 Supabase Schema Investigation**

Run the following queries to understand current state:

### **2.1.1 Check existing contacts table structure**

\-- Get current contacts table columns  
SELECT column\_name, data\_type, is\_nullable  
FROM information\_schema.columns  
WHERE table\_name \= 'contacts'  
ORDER BY ordinal\_position;

### **2.1.2 Check for existing Apollo-related fields**

\-- Look for any existing Apollo tracking  
SELECT column\_name FROM information\_schema.columns  
WHERE table\_name \= 'contacts'  
AND column\_name LIKE '%apollo%' OR column\_name LIKE '%sequence%';

### **2.1.3 Sample contact records**

\-- Check sample data to understand current state  
SELECT id, first\_name, last\_name, apollo\_contact\_id,  
       apollo\_synced\_at, created\_at  
FROM contacts LIMIT 10;

Document findings: What Apollo-related columns already exist? What is the current sync status of contacts?

## **2.2 n8n Workflow Investigation**

Review existing workflows to understand current patterns:

### **2.2.1 Existing workflows to examine**

* Apollo Sync Workflow: How does it currently push contacts to Apollo?

* Report Creator Workflow: What triggers it? What data does it produce?

* Any scheduled workflows: What cron patterns are in use?

### **2.2.2 Key patterns to preserve**

* API authentication method (header format, key storage)

* Supabase connection configuration

* Error handling patterns

* Rate limiting implementation (delays between API calls)

* Batch processing approach (Split In Batches settings)

IMPORTANT: The existing Apollo sync workflow has working API patterns. Copy the exact HTTP request node configuration, headers, and authentication approach. Do not reinvent.

## **2.3 Apollo Configuration Investigation**

Document current Apollo setup via API and UI:

### **2.3.1 API calls to run**

// Get existing sequences  
GET https://api.apollo.io/api/v1/emailer\_campaigns/search

// Get existing contact stages  
GET https://api.apollo.io/api/v1/contact\_stages

// Get existing custom fields  
GET https://api.apollo.io/api/v1/typed\_custom\_fields

### **2.3.2 Document in Apollo UI**

* Current sequences: names, IDs, step configuration

* Current Plays: what triggers exist, what actions are configured

* Current contact stages (if any)

* Current disposition mappings in Orum integration

# **3\. System Architecture**

## **3.1 Data Flow**

The system follows a controlled flow where Supabase is the source of pending contacts, n8n controls enrollment rate, and Apollo manages all outreach timing.

SUPABASE                    N8N                      APOLLO                 ORUM  
─────────────────────────────────────────────────────────────────────────────────

contacts                    Daily Enrollment         Main Sequence          Dial Queue  
(pending)      ─────────►   Workflow        ─────►   (cap: 500\)    ─────►   (tasks)  
                            \- Check capacity                                  │  
                            \- Enroll if slots                                 │  
                                                                              │  
                                                     ◄─────────────────────────  
                                                     Disposition logged  
                                                            │  
                                                            ▼  
                                                     Apollo Plays  
                                                     \- Update stage  
                                                     \- Move to Callbacks  
                                                     \- Remove from sequence

## **3.2 Capacity-Based Enrollment Logic**

The enrollment workflow runs daily and only adds contacts when there is capacity:

MAX\_ACTIVE \= 500

active\_count \= Apollo API: count contacts where stage \= 'Active'  
available\_slots \= MAX\_ACTIVE \- active\_count

if available\_slots \> 0:  
    contacts\_to\_enroll \= Supabase: get top {available\_slots}  
                         WHERE sequence\_enrolled\_at IS NULL  
                         ORDER BY lead\_score DESC  
      
    for each contact:  
        Apollo API: add to Net New Sequence  
        Supabase: set sequence\_enrolled\_at \= NOW()  
else:  
    log: 'Sequence at capacity, no enrollment today'

## **3.3 Self-Regulating Behavior**

The system automatically adjusts to rep capacity:

| Scenario | What Happens | Result |
| :---- | :---- | :---- |
| Rep has slow day (80 calls) | Fewer contacts complete sequence | Next day enrolls fewer new contacts |
| Rep crushes it (200 calls) | More contacts complete/disqualify | Next day enrolls more new contacts |
| Rep takes vacation | No calls, no completions | Enrollment pauses automatically |
| n8n workflow fails | No new enrollment | Current 500 keep getting worked |

# **4\. Apollo Configuration**

## **4.1 Contact Stages**

Create the following contact stages in Apollo (Settings \> Deals & Pipeline \> Contact Stages):

| Stage Name | Purpose | How Contacts Arrive |
| :---- | :---- | :---- |
| New | Synced from Supabase, not yet enrolled | Default stage on Apollo sync |
| Active | Currently in a call sequence | Play triggers on sequence enrollment |
| Callback | Requested callback | Play triggers on callback disposition |
| Meeting Booked | Success \- meeting scheduled | Play triggers on meeting disposition |
| Disqualified | Wrong fit, wrong number, etc. | Play triggers on DQ dispositions |
| Exhausted | Completed Follow-up sequence, never connected | Play triggers on Follow-up sequence finish |

## **4.2 Net New Sequence**

For fresh contacts that have never been called. Single call task \- if no answer, they move to Follow-up sequence.

| Step | Type | Delay | Notes |
| :---- | :---- | :---- | :---- |
| 1 | Call | Immediate | First attempt ever |

## **4.3 Follow-up Sequence**

For contacts who didn't connect on previous attempt(s). Contains the remaining 4 calls of the Day 1/1/3/5/7 cadence.

| Step | Type | Delay | Notes |
| :---- | :---- | :---- | :---- |
| 1 | Call | Immediate | Second attempt (same day as first) |
| 2 | Call | 2 business days | Day 3 attempt |
| 3 | Call | 2 business days | Day 5 attempt |
| 4 | Call | 2 business days | Day 7 final attempt |

## **4.4 Callback Sequence**

For contacts who requested a callback. Single task with due date set by rep.

| Step | Type | Delay | Notes |
| :---- | :---- | :---- | :---- |
| 1 | Call | Based on task due date | Due date set by rep |

## **4.5 Apollo Plays**

Create the following Plays to automate state transitions:

### **Play 1: Enrolled in Net New \- Mark Active**

| Setting | Value |
| :---- | :---- |
| Trigger | Contact added to sequence |
| Condition | Sequence \= Net New |
| Action | Update contact stage → Active |

### **Play 2: No Answer \- Move to Follow-up**

| Setting | Value |
| :---- | :---- |
| Trigger | Call logged |
| Condition | Disposition IN (No Answer, Left Voicemail, Gatekeeper) AND Sequence \= Net New |
| Action 1 | Remove from Net New sequence |
| Action 2 | Add to Follow-up sequence |

### **Play 3: Callback Requested**

| Setting | Value |
| :---- | :---- |
| Trigger | Call logged |
| Condition | Disposition IN (Busy \- Call Later, Answered \- Follow Up Required) |
| Action 1 | Remove from current sequence |
| Action 2 | Add to Callback sequence |
| Action 3 | Update contact stage → Callback |

### **Play 4: Meeting Booked**

| Setting | Value |
| :---- | :---- |
| Trigger | Call logged |
| Condition | Disposition \= Answered \- Booked Meeting |
| Action 1 | Remove from sequence |
| Action 2 | Update contact stage → Meeting Booked |

### **Play 5: Disqualified**

| Setting | Value |
| :---- | :---- |
| Trigger | Call logged |
| Condition | Disposition IN (Wrong Phone \#, Answered \- No Longer with Company, Answered \- Already Have Solution, False Positive, Answered \- Wrong Person No Referral) |
| Action 1 | Remove from sequence |
| Action 2 | Update contact stage → Disqualified |

### **Play 6: Follow-up Sequence Exhausted**

| Setting | Value |
| :---- | :---- |
| Trigger | Contact finished sequence |
| Condition | Sequence \= Follow-up |
| Action | Update contact stage → Exhausted |

### **Play 7: Webhook to n8n (Optional \- for reporting)**

| Setting | Value |
| :---- | :---- |
| Trigger | Call logged |
| Condition | None (all calls) |
| Action | Send webhook to {n8n\_webhook\_url} |

# **5\. Supabase Schema Changes**

## **5.1 Contacts Table Modifications**

Add the following columns to track enrollment state:

\-- Add enrollment tracking columns  
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS  
  sequence\_enrolled\_at TIMESTAMPTZ,  
  enrollment\_batch TEXT;

\-- Create index for enrollment queries  
CREATE INDEX IF NOT EXISTS idx\_contacts\_enrollment  
ON contacts (sequence\_enrolled\_at)  
WHERE sequence\_enrolled\_at IS NULL;

\-- Create index for batch tracking  
CREATE INDEX IF NOT EXISTS idx\_contacts\_enrollment\_batch  
ON contacts (enrollment\_batch);

## **5.2 Call Activity Table (Optional \- for reporting)**

If implementing the optional webhook logging:

CREATE TABLE IF NOT EXISTS call\_activity (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  contact\_id UUID REFERENCES contacts(id) ON DELETE CASCADE,  
  company\_id UUID REFERENCES companies(id) ON DELETE CASCADE,  
    
  \-- Call details from Apollo webhook  
  apollo\_call\_id TEXT,  
  call\_date TIMESTAMPTZ NOT NULL,  
  duration\_seconds INTEGER DEFAULT 0,  
  disposition TEXT,  
  recording\_url TEXT,  
  notes TEXT,  
    
  \-- Metadata  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

CREATE INDEX idx\_call\_activity\_contact ON call\_activity(contact\_id);  
CREATE INDEX idx\_call\_activity\_date ON call\_activity(call\_date DESC);

# **6\. n8n Workflow Specification**

## **6.1 Daily Enrollment Workflow**

This is the core workflow that meters contact enrollment.

### **6.1.1 Workflow Nodes**

| \# | Node Name | Type | Purpose |
| :---- | :---- | :---- | :---- |
| 1 | Schedule Trigger | Cron | Runs daily at 6am local time |
| 2 | Set Config | Set | Environment variables and constants |
| 3 | Get Active Count | HTTP Request | Apollo API: count contacts in Active stage |
| 4 | Calculate Slots | Code | MAX\_ACTIVE \- active\_count |
| 5 | IF Has Slots | IF | Check if available\_slots \> 0 |
| 6 | Get Pending Contacts | Supabase | Fetch contacts to enroll |
| 7 | Split In Batches | Split In Batches | Process 25 at a time |
| 8 | Add to Net New | HTTP Request | Apollo API: add contact to Net New sequence |
| 9 | Wait | Wait | Rate limit pause (700ms) |
| 10 | Mark Enrolled | Supabase | Update sequence\_enrolled\_at |
| 11 | Log Summary | Code | Log enrollment stats |

### **6.1.2 Set Config Node**

// Configuration values  
{  
  "apollo\_api\_key": "{{ $env.APOLLO\_API\_KEY }}",  
  "supabase\_url": "{{ $env.SUPABASE\_URL }}",  
  "supabase\_key": "{{ $env.SUPABASE\_SERVICE\_KEY }}",  
  "max\_active": 500,  
  "net\_new\_sequence\_id": "{{ $env.APOLLO\_NET\_NEW\_SEQUENCE\_ID }}",  
  "active\_stage\_id": "{{ $env.APOLLO\_ACTIVE\_STAGE\_ID }}",  
  "batch\_id": "batch-{{ $now.format('yyyy-MM-dd') }}"  
}

### **6.1.3 Get Active Count (HTTP Request)**

IMPORTANT: Copy the exact authentication pattern from the existing Apollo sync workflow.

Method: POST  
URL: https://api.apollo.io/api/v1/contacts/search

Headers:  
  Content-Type: application/json  
  Cache-Control: no-cache  
  x-api-key: {{ $node\['Set Config'\].json.apollo\_api\_key }}

Body:  
{  
  "contact\_stage\_ids": \["{{ $node\['Set Config'\].json.active\_stage\_id }}"\],  
  "page": 1,  
  "per\_page": 1  
}

// Response contains pagination.total\_entries

### **6.1.4 Calculate Slots (Code Node)**

const maxActive \= $('Set Config').item.json.max\_active;  
const activeCount \= $('Get Active Count').item.json.pagination.total\_entries || 0;  
const availableSlots \= Math.max(0, maxActive \- activeCount);

return \[{  
  json: {  
    active\_count: activeCount,  
    max\_active: maxActive,  
    available\_slots: availableSlots,  
    timestamp: new Date().toISOString()  
  }  
}\];

### **6.1.5 IF Has Slots**

Condition: {{ $json.available\_slots }} \> 0

### **6.1.6 Get Pending Contacts (Supabase)**

Operation: Select  
Table: contacts

Filters:  
  \- apollo\_contact\_id IS NOT NULL  
  \- sequence\_enrolled\_at IS NULL

Order: lead\_score DESC  
Limit: {{ $('Calculate Slots').item.json.available\_slots }}

Columns: id, apollo\_contact\_id, first\_name, last\_name, company\_id

### **6.1.7 Add to Net New Sequence (HTTP Request)**

IMPORTANT: Copy the exact request format from existing Apollo sync workflow.

Method: POST  
URL: https://api.apollo.io/api/v1/emailer\_campaigns/  
     {{ $node\['Set Config'\].json.net\_new\_sequence\_id }}/add\_contact\_ids

Headers:  
  Content-Type: application/json  
  Cache-Control: no-cache  
  x-api-key: {{ $node\['Set Config'\].json.apollo\_api\_key }}

Body:  
{  
  "contact\_ids": \["{{ $json.apollo\_contact\_id }}"\],  
  "send\_email\_from\_email\_account\_id": null  
}

### **6.1.8 Mark Enrolled (Supabase)**

Operation: Update  
Table: contacts

Filter: id \= {{ $json.id }}

Update:  
  sequence\_enrolled\_at: {{ $now.toISO() }}  
  enrollment\_batch: {{ $node\['Set Config'\].json.batch\_id }}

## **6.2 Webhook Receiver Workflow (Optional)**

Only implement if call activity logging is needed for reporting.

### **6.2.1 Workflow Nodes**

| \# | Node Name | Type | Purpose |
| :---- | :---- | :---- | :---- |
| 1 | Webhook | Webhook | Receives POST from Apollo Play |
| 2 | Parse Payload | Code | Extract call data from webhook |
| 3 | Insert Call Activity | Supabase | Write to call\_activity table |
| 4 | Respond | Respond to Webhook | Return 200 OK |

### **6.2.2 Parse Payload (Code Node)**

const payload \= $input.item.json;

// Apollo webhook payload structure \- verify with actual webhook  
return \[{  
  json: {  
    apollo\_call\_id: payload.call\_id || payload.id,  
    contact\_id: payload.contact?.id,  
    call\_date: payload.created\_at || new Date().toISOString(),  
    duration\_seconds: payload.duration || 0,  
    disposition: payload.disposition,  
    recording\_url: payload.recording\_url,  
    notes: payload.note  
  }  
}\];

# **7\. Environment Variables**

The following environment variables must be configured in n8n:

| Variable | Description | Where to Find |
| :---- | :---- | :---- |
| APOLLO\_API\_KEY | Apollo master API key | Apollo \> Settings \> Integrations \> API |
| APOLLO\_NET\_NEW\_SEQUENCE\_ID | ID of the Net New sequence | Apollo API or URL when viewing sequence |
| APOLLO\_FOLLOWUP\_SEQUENCE\_ID | ID of the Follow-up sequence | Apollo API or URL when viewing sequence |
| APOLLO\_CALLBACK\_SEQUENCE\_ID | ID of the Callback sequence | Apollo API or URL when viewing sequence |
| APOLLO\_ACTIVE\_STAGE\_ID | ID of the Active contact stage | Apollo API: GET /contact\_stages |
| SUPABASE\_URL | Supabase project URL | Supabase \> Settings \> API |
| SUPABASE\_SERVICE\_KEY | Supabase service role key | Supabase \> Settings \> API (service\_role) |

# **8\. Testing Checklist**

## **8.1 Pre-Implementation Tests**

1. Verify Apollo API authentication works with existing key

2. Verify Supabase connection and permissions

3. Count existing contacts with apollo\_contact\_id but no sequence enrollment

4. Identify any contacts currently stuck in sequences

## **8.2 Schema Migration Tests**

5. Run ALTER TABLE on contacts \- verify columns added

6. Verify indexes created successfully

7. Run test query to find pending contacts

## **8.3 Apollo Configuration Tests**

8. Create contact stages \- verify they appear in UI

9. Create Main Sequence \- verify step timing

10. Create Callbacks Sequence \- verify single step

11. Create each Play \- test with manual disposition

12. Verify Play triggers update contact stages correctly

## **8.4 n8n Workflow Tests**

13. Run enrollment workflow manually with small batch (5 contacts)

14. Verify contacts appear in Apollo sequence

15. Verify Supabase sequence\_enrolled\_at updated

16. Test with zero available slots \- verify workflow exits cleanly

17. Test error handling \- invalid contact ID

18. Verify rate limiting works (no 429 errors)

## **8.5 End-to-End Tests**

19. Enroll 20 contacts via workflow

20. Verify they appear in Orum dial queue

21. Make test calls with each disposition type

22. Verify Plays trigger correct stage transitions

23. Verify callback contacts appear in Callbacks sequence

24. Wait 24 hours \- verify Day 2 tasks appear for unanswered calls

25. Run enrollment again \- verify new contacts added to fill capacity

# **9\. Rollback Plan**

If issues arise, the system can be rolled back with minimal disruption:

## **9.1 Disable n8n Workflow**

* Deactivate the Daily Enrollment workflow in n8n

* Impact: No new contacts enrolled; current sequence continues

* Recovery: Reactivate when fixed

## **9.2 Revert to Manual Enrollment**

* If automated enrollment is problematic, add contacts to sequences manually in Apollo

* Supabase schema changes are non-destructive and can remain

## **9.3 Disable Apollo Plays**

* If Plays cause issues, deactivate them individually in Apollo \> Plays

* Contact stage updates would need to be done manually

## **9.4 Full Rollback**

If complete rollback is needed:

26. Deactivate all new Apollo Plays

27. Deactivate n8n enrollment workflow

28. (Optional) Archive new sequences

29. System reverts to previous manual enrollment process

Note: Supabase schema changes (new columns) do not need to be reverted \- they are additive and do not affect existing functionality.

# **10\. Success Metrics**

After implementation, measure success by:

| Metric | Target | How to Measure |
| :---- | :---- | :---- |
| Active contacts in sequence | 400-500 at any time | Apollo search by stage |
| Task backlog | \< 2 days worth of calls | Orum queue size |
| Sequence completion rate | 100% get all 5 attempts | Apollo sequence analytics |
| Callback follow-through | \> 90% callbacks made | Callbacks sequence metrics |
| System uptime | Enrollment runs daily | n8n execution history |

# **11\. Ongoing Maintenance**

## **11.1 Daily Checks (Automated)**

* n8n workflow runs at 6am \- check execution history weekly

* Monitor for failed executions in n8n

## **11.2 Weekly Checks**

* Review active contact count (should hover around 400-500)

* Check for contacts stuck in 'Active' stage longer than 2 weeks

* Review Callbacks sequence \- any callbacks more than 7 days old?

## **11.3 Monthly Checks**

* Review lead scoring rules \- are high-score contacts getting enrolled first?

* Check exhausted contacts \- any patterns worth adjusting?

* Review disqualification reasons \- any patterns to address in discovery?

## **11.4 Adjusting Capacity**

To change the enrollment cap:

30. Edit the Set Config node in n8n

31. Change max\_active from 500 to desired number

32. Save and ensure workflow is active

Recommended: Adjust in increments of 100 and monitor for a week before further changes.

*— End of Document —*