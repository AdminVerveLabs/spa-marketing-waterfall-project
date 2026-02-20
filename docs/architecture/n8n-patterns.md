# n8n Patterns & Known Quirks

## Critical: Multi-Path Convergence Bug

When 2+ paths feed into one node, n8n creates separate execution batches per upstream path.

### What Breaks
- `$('NodeName').item.json` — pairs with wrong items (gets item from last batch only)
- `$('NodeName').all()` — returns duplicates across batches
- Merge (Append) nodes — fire per-batch, not after all batches, causing duplication
- Code nodes with `$('NodeName').all()` — same duplication as Merge nodes

### What Was Tried (All Failed)
1. Direct convergence (3 paths → 1 IF node) — only last batch paired correctly
2. Merge (Append) nodes before convergence — duplicated items across batches
3. Code nodes using `$('NodeName').all()` to collect — picked up duplicates
4. "Wait for All Inputs" toggle — doesn't exist in this n8n version

### Convergence Points in Current Workflow
These are ALL locations where 2+ paths merge and need fixing:

**Step 4:**
- Merge Email Results + Skip Email Pass Through + No Domain Skip Email → (previously Needs NamSor?, now Collect Email Results)
- Parse Verifier Response + Skip Verification → (previously Needs NamSor?, now Collect Verified Results)
- Parse NamSor Response + Skip NamSor → (previously Prepare Contact Update, now Collect NamSor Results)
- Update Contact in Supabase + Has Updates? false → Run Summary4

**Step 3a:** (currently working, but may have latent issues)
- 5 Validate & Clean Contact nodes → Insert Contact to Supabase (works because insert node reads `$json` directly, no pairing needed)

### Safe Patterns
- Reading stats: `$('NodeName').all()` is fine for counting/summarizing (Run Summary nodes)
- Single-path flow: No batching issues when paths don't converge
- Direct `$input.item.json`: Safe when the node has exactly 1 upstream connection

## Code Node Patterns

### runOnceForEachItem
```javascript
// Current item data
const item = $input.item.json;

// Paired upstream item (⚠️ ONLY safe with single upstream path)
const upstream = $('NodeName').item.json;

// Return single object (NOT array)
return { json: { ...item, newField: value } };
```

### runOnceForAllItems
```javascript
// All input items
const items = $input.all();

// All items from a named node
const items = $('NodeName').all();

// First item shortcut
const first = $input.first().json;

// Return array of objects
return items.map(i => ({ json: i.json }));
```

### Common Mistakes
- `runOnceForEachItem` returning `[{json:...}]` instead of `{json:...}`
- `runOnceForAllItems` returning `{json:...}` instead of `[{json:...}]`
- Using `response.body` instead of `response.data` with HTTP fullResponse
- Missing `typeValidation: "loose"` on IF nodes
- Not handling Apollo phone objects: `{sanitized_number: "..."}` format

## HTTP Request Patterns

### Supabase
```
Headers:
  apikey: $env.SUPABASE_SERVICE_KEY
  Authorization: Bearer $env.SUPABASE_SERVICE_KEY
  Content-Type: application/json

SELECT: GET  /rest/v1/table?select=col1,col2&filter=eq.value
INSERT: POST /rest/v1/table  + Prefer: resolution=merge-duplicates
UPDATE: PATCH /rest/v1/table?id=eq.{id}  + Prefer: return=minimal
```

### Website Fetching
MUST include User-Agent header or most sites return empty:
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

### Error Handling
Always set `onError: "continueRegularOutput"` on HTTP nodes to prevent single failures from breaking batch processing.
