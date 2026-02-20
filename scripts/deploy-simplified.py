"""
Deploy the simplified workflow to n8n via REST API.
Reads workflows/generated/simplified-workflow.json and PUTs it to the n8n API.
"""
import json
import urllib.request
import sys
import os

API_URL = "http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMGY2ZWExMC1hYWMyLTRkZDctYTdiYy1kZjExODQ1MzFhMDYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcxMzg2Mjk1LCJleHAiOjE3NzM5NjQ4MDB9.2uC2lGG4T-KiH47DqvN5KMSoK9-MIZpFlSA-iK53E4c"
WORKFLOW_ID = "yxvQst30sWlNIeZq"

BASE_DIR = r'C:\Users\zackm\OneDrive\Documents\GitHub\spa-marketing_waterfall_project'
WORKFLOW_FILE = os.path.join(BASE_DIR, 'workflows', 'generated', 'simplified-workflow.json')

def main():
    # Read the simplified workflow
    print(f"Reading workflow from {WORKFLOW_FILE}...")
    with open(WORKFLOW_FILE, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    print(f"  Nodes: {len(wf['nodes'])}")
    print(f"  Connections: {len(wf['connections'])} sources")

    # Build the PUT payload — only include API-allowed settings keys
    allowed_settings = {'executionOrder', 'saveExecutionProgress', 'executionTimeout',
                        'saveDataErrorExecution', 'saveDataSuccessExecution',
                        'saveManualExecutions', 'timezone', 'errorWorkflow'}
    raw_settings = wf.get('settings', {})
    clean_settings = {k: v for k, v in raw_settings.items() if k in allowed_settings}

    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': clean_settings,
    }

    data = json.dumps(payload).encode('utf-8')
    print(f"  Payload size: {len(data)} bytes")

    # PUT to n8n API
    url = f"{API_URL}/workflows/{WORKFLOW_ID}"
    print(f"Deploying to {url}...")

    req = urllib.request.Request(
        url,
        data=data,
        method='PUT',
        headers={
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': API_KEY,
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            body = resp.read().decode('utf-8')
            result = json.loads(body)
            print(f"\nDeploy SUCCESS (HTTP {status})")
            print(f"  Workflow ID: {result.get('id', 'unknown')}")
            print(f"  Name: {result.get('name', 'unknown')}")
            print(f"  Active: {result.get('active', 'unknown')}")
            print(f"  Nodes: {len(result.get('nodes', []))}")
            print(f"  Updated: {result.get('updatedAt', 'unknown')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"\nDeploy FAILED (HTTP {e.code})")
        print(f"  Response: {body[:2000]}")
        sys.exit(1)
    except Exception as e:
        print(f"\nDeploy ERROR: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
