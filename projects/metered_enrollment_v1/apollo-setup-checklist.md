# Apollo Manual Setup Checklist

**Status:** Pending — Zack to complete in Apollo UI before Phase 4 (n8n workflow)

---

## 1. Contact Stages (Settings > Deals & Pipeline > Contact Stages)

- [ ] **New** — Default stage on Apollo sync
- [ ] **Active** — Currently in a call sequence
- [ ] **Callback** — Requested callback
- [ ] **Meeting Booked** — Success, meeting scheduled
- [ ] **Disqualified** — Wrong fit, wrong number, etc.
- [ ] **Exhausted** — Completed Follow-up sequence, never connected

**After creating, record the Active stage ID:**
- Active Stage ID: `___________________________`

---

## 2. Sequences

### 2.1 Net New Sequence
- [ ] Create sequence named "Net New"
- [ ] Add Step 1: Call task, Immediate
- [ ] No other steps (single call — Plays handle movement)

Net New Sequence ID: `___________________________`

### 2.2 Follow-up Sequence
- [ ] Create sequence named "Follow-up"
- [ ] Step 1: Call, Immediate
- [ ] Step 2: Call, +2 business days
- [ ] Step 3: Call, +2 business days
- [ ] Step 4: Call, +2 business days

Follow-up Sequence ID: `___________________________`

### 2.3 Callback Sequence
- [ ] Create sequence named "Callback"
- [ ] Step 1: Call, Due date based (set by rep)

Callback Sequence ID: `___________________________`

---

## 3. Plays (Settings > Plays)

### Play 1: Enrolled in Net New → Mark Active
- [ ] Trigger: Contact added to sequence
- [ ] Condition: Sequence = Net New
- [ ] Action: Update contact stage → Active

### Play 2: No Answer → Move to Follow-up
- [ ] Trigger: Call logged
- [ ] Condition: Disposition IN (No Answer, Left Voicemail, Gatekeeper) AND Sequence = Net New
- [ ] Action 1: Remove from Net New sequence
- [ ] Action 2: Add to Follow-up sequence

### Play 3: Callback Requested
- [ ] Trigger: Call logged
- [ ] Condition: Disposition IN (Busy - Call Later, Answered - Follow Up Required)
- [ ] Action 1: Remove from current sequence
- [ ] Action 2: Add to Callback sequence
- [ ] Action 3: Update contact stage → Callback

### Play 4: Meeting Booked
- [ ] Trigger: Call logged
- [ ] Condition: Disposition = Answered - Booked Meeting
- [ ] Action 1: Remove from sequence
- [ ] Action 2: Update contact stage → Meeting Booked

### Play 5: Disqualified
- [ ] Trigger: Call logged
- [ ] Condition: Disposition IN (Wrong Phone #, Answered - No Longer with Company, Answered - Already Have Solution, False Positive, Answered - Wrong Person No Referral)
- [ ] Action 1: Remove from sequence
- [ ] Action 2: Update contact stage → Disqualified

### Play 6: Follow-up Sequence Exhausted
- [ ] Trigger: Contact finished sequence
- [ ] Condition: Sequence = Follow-up
- [ ] Action: Update contact stage → Exhausted

### Play 7: Webhook to n8n (Optional)
- [ ] Trigger: Call logged
- [ ] Condition: None (all calls)
- [ ] Action: Send webhook to n8n webhook URL

---

## 4. Environment Variables (Coolify/n8n)

After creating sequences and stages, add these env vars:

- [ ] `APOLLO_NET_NEW_SEQUENCE_ID` = ___
- [ ] `APOLLO_FOLLOWUP_SEQUENCE_ID` = ___
- [ ] `APOLLO_CALLBACK_SEQUENCE_ID` = ___
- [ ] `APOLLO_ACTIVE_STAGE_ID` = ___

---

## 5. Verification

After all setup:
- [ ] Each stage appears in Apollo UI
- [ ] Each sequence has correct step count and timing
- [ ] Test Play 1 manually: add a contact to Net New → verify stage changes to Active
- [ ] Test Play 2 manually: log a "No Answer" call → verify contact moves to Follow-up
