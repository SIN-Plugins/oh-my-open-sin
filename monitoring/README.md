# SIN Monitoring Stack

Enterprise-grade monitoring for oh-my-open-sin with Prometheus + Grafana (100% free, self-hosted).

## Quick Start

### 1. Start Health Server
```bash
chmod +x ~/.config/opencode/bin/sin-health-server.ts
nohup tsx ~/.config/opencode/bin/sin-health-server.ts &>/tmp/sin-health-server.log &
```

### 2. Start Monitoring Stack
```bash
cd monitoring/

# For Mac (host.docker.internal)
docker compose up -d

# For Linux/OCI VM
sed -i 's/host.docker.internal/localhost/g' prometheus.yml
docker compose up -d
```

### 3. Access Dashboards

- **Grafana:** http://localhost:3000
  - User: `admin`
  - Password: `sin-admin` (change immediately!)
  
- **Prometheus:** http://localhost:9090
  - Query: `sin_overall_health`
  
- **Health JSON:** http://localhost:8787/health
- **Metrics:** http://localhost:8787/metrics

## Fleet Sync (Mac → OCI → HF)

1. Copy `monitoring/` to VMs via `sin-sync`
2. On each VM:
   ```bash
   cd ~/sin-monitoring
   sed -i 's/host.docker.internal/localhost/g' prometheus.yml
   docker compose up -d
   ```
3. Each node runs local Health Server → local Prometheus → Grafana visualizes per-node

## Metrics Namespace

All metrics use `sin_*` prefix:
- `sin_overall_health` - Overall system health (0-1)
- `sin_budget_pct` - Budget usage percentage
- `sin_telemetry_cost_usd` - Total cost in USD
- `sin_telemetry_total_tokens` - Total tokens consumed
- `sin_chrome_profiles_healthy` - Chrome profile health
- `sin_github_app_auth_valid` - GitHub App auth status
- `sin_proxy_reachable` - Proxy reachability
- `sin_fleet_sync_drift_hours` - Fleet sync drift
- `sin_fleet_stale_sessions` - Stale session count
- `sin_proxy_latency_ms` - Proxy latency

## Dashboard Panels

1. Overall Health Score
2. Budget Usage %
3. Total Cost (USD)
4. Chrome Healthy
5. GitHub Auth
6. Proxy Reachable
7. Tokens & Cost Over Time
8. Phase Breakdown Table
9. Sync Drift (h)
10. Stale Sessions
11. Proxy Latency (ms)

## Cleanup

```bash
docker compose down -v  # Remove containers + volumes
```
