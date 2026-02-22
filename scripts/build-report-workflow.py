#!/usr/bin/env python3
"""Build the Report Generator n8n workflow JSON from JS source files."""

import json
import os

SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), 'nodes', 'report-generator')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'workflows', 'generated', 'report-generator-workflow.json')


def read_js(filename):
    path = os.path.join(SCRIPTS_DIR, filename)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def build_workflow():
    fetch_js = read_js('fetch-report-data.js')
    generate_js = read_js('generate-report.js')
    send_email_js = read_js('send-email.js')

    workflow = {
        "name": "Report Generator v0",
        "nodes": [
            {
                "id": "a1b2c3d4-0001-4000-8000-000000000001",
                "name": "Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 2,
                "position": [260, 300],
                "webhookId": "report-generator-v1",
                "parameters": {
                    "path": "report-generator-v1",
                    "httpMethod": "POST",
                    "responseMode": "responseNode",
                    "options": {}
                }
            },
            {
                "id": "a1b2c3d4-0002-4000-8000-000000000002",
                "name": "Respond to Webhook",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1.1,
                "position": [480, 300],
                "parameters": {
                    "respondWith": "json",
                    "responseBody": "={\"status\": \"accepted\", \"message\": \"Report generation started\"}",
                    "options": {}
                }
            },
            {
                "id": "a1b2c3d4-0003-4000-8000-000000000003",
                "name": "Fetch Report Data",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [700, 300],
                "parameters": {
                    "jsCode": fetch_js,
                    "mode": "runOnceForAllItems"
                }
            },
            {
                "id": "a1b2c3d4-0004-4000-8000-000000000004",
                "name": "Generate & Upload Report",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [920, 300],
                "parameters": {
                    "jsCode": generate_js,
                    "mode": "runOnceForAllItems"
                }
            },
            {
                "id": "a1b2c3d4-0005-4000-8000-000000000005",
                "name": "Send Email via Resend",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [1140, 300],
                "parameters": {
                    "jsCode": send_email_js,
                    "mode": "runOnceForAllItems"
                }
            }
        ],
        "connections": {
            "Webhook": {
                "main": [
                    [{"node": "Respond to Webhook", "type": "main", "index": 0}]
                ]
            },
            "Respond to Webhook": {
                "main": [
                    [{"node": "Fetch Report Data", "type": "main", "index": 0}]
                ]
            },
            "Fetch Report Data": {
                "main": [
                    [{"node": "Generate & Upload Report", "type": "main", "index": 0}]
                ]
            },
            "Generate & Upload Report": {
                "main": [
                    [{"node": "Send Email via Resend", "type": "main", "index": 0}]
                ]
            }
        },
        "settings": {
            "executionOrder": "v1",
            "saveManualExecutions": True,
            "saveDataErrorExecution": "all",
            "saveDataSuccessExecution": "all"
        }
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(workflow, f, indent=2, ensure_ascii=False)

    print(f"Report Generator workflow written to: {OUTPUT_PATH}")
    print(f"  Nodes: {len(workflow['nodes'])}")
    for n in workflow['nodes']:
        print(f"    - {n['name']} ({n['type']})")


if __name__ == '__main__':
    build_workflow()
