# Metered Enrollment — Configuration Reference

**Last updated:** 2026-03-26

## Apollo IDs (hardcoded in n8n Set Config node)

If any of these change in Apollo, update the Set Config node in the Daily Enrollment workflow (`mEcwH3Q3fR63ib6g`).

### Sequences
| Sequence | Apollo ID | Steps |
|----------|-----------|-------|
| Net New | `69c5a2b66a1872000dbd0cea` | 1 call (immediate) |
| Follow-up | `69c5a30ed65d5e0019686da3` | 4 calls (immediate, +2d, +2d, +2d) |
| Callback | `69c5a388ba4c7f0021dcd3a2` | 1 call (due date based) |

### Contact Stages
| Stage | Apollo ID | Category |
|-------|-----------|----------|
| New | `69c5a26ca429cd0011528a60` | — |
| Active | `69c5a276b7b20b000d85e8be` | in_progress |
| Callback | `69c5a27fd846c40011d57a58` | in_progress |
| Meeting Booked | `69c5a28c9f8b8c000dbd3979` | succeeded |
| Disqualified | `69c5a29abc403a00115f1f50` | failed |
| No Response | `69c5a2aee1ef6a001985db8d` | failed |

### Email Account
| Account | Apollo ID |
|---------|-----------|
| Send-from account | `69a5e63f85519c000d88630e` |

### Enrollment Config
| Setting | Value | Location |
|---------|-------|----------|
| max_active | 500 | Set Config node |
| Batch size | 25 | Split In Batches node |
| Schedule | Daily 6am | Schedule Trigger node |
| Rate limit | 700ms | Add to Net New node |

## n8n Workflow IDs
| Workflow | ID | Status |
|----------|----|--------|
| Daily Enrollment | `mEcwH3Q3fR63ib6g` | Inactive (Schedule Trigger disabled) |
| Call Activity Webhook | `kgtvLxRsgfd8iuCL` | Active |

## Webhook URL
- Call Activity: `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/call-activity-v1`
