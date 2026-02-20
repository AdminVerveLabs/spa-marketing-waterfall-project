# Workflows Directory

## How to Export from n8n

1. Open the workflow in n8n editor
2. Click the three-dot menu (top right) → **Download**
3. Save the JSON file to `workflows/current/`
4. Name it descriptively: `spa-waterfall-full-YYYY-MM-DD.json`

**IMPORTANT:** Export the FULL workflow, not just isolated steps. The full workflow contains all nodes and connections needed for investigation.

If the workflow is too large to export cleanly, export each step separately:
- `step1-discover.json`
- `step2-enrich-companies.json`
- `step3a-find-people.json`
- `step4-enrich-people.json`

## How to Import to n8n

1. In n8n, click **Add Workflow** (top right)
2. Click **Import from File**
3. Select the JSON from `workflows/generated/`
4. Review all nodes before activating
5. Check environment variables are set

## Backup Convention

Before modifying any workflow:
```
cp workflows/current/file.json workflows/backups/file-YYYYMMDD-HHMM.json
```

## Current Files

Place your exported n8n workflow JSON here. The investigation plan (Phase 1) starts by reading these files.
