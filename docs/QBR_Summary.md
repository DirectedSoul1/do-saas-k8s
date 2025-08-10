# QBR – SaaS Web App on DigitalOcean Kubernetes (DOKS)

**Customer:** SaaS web application  


## Executive Summary
We deployed a stateless Node.js service to **DigitalOcean Kubernetes (DOKS)** in **LON1** with an **NGINX Ingress Controller**, a **DigitalOcean Load Balancer**, **Horizontal Pod Autoscaler (HPA)** at 60% CPU, and a **Pod Disruption Budget (PDB)**. Images are stored in a private **DigitalOcean Container Registry (DOCR)** (`registry.digitalocean.com/saas-registry-1`). The design meets the goals of **scalability, performance, reliability,** and **cost efficiency**.

## Current Architecture & Performance
- **Compute:** DOKS cluster, node pool `s-2vcpu-4gb`, min=2, max=6 (cluster autoscaler).
- **Networking:** NGINX Ingress + DO Load Balancer → public HTTP endpoint.
- **App:** Deployment `web` with 3 replicas; `/` and `/healthz` endpoints; readiness/liveness probes.
- **Scaling:** HPA target 60% CPU; scales pods 3→N under load; node pool scales as needed.
- **Availability:** PDB `minAvailable=2` ensures resilience during voluntary disruptions (upgrades/drains).
- **Registry:** Private DOCR with Kubernetes pull secret for secure image pulls.

## Cost Overview (baseline)
- 2× `s-2vcpu-4gb` nodes ≈ **$24/mo** (usage-based; scales up/down)
- 1× DO Load Balancer ≈ **$12/mo**
- DOCR **free tier** (sufficient for this demo)
> Baseline ≈ **$36/mo**; scales only when demand increases.

## Observations
- Health probes + Ingress yielded stable rollouts and clean pod readiness.
- HPA responds predictably to CPU bursts (demoed via brief load from Codespaces).
- Private registry auth was configured via imagePullSecret on the `prod` namespace and Deployment.

## Recommendations (Next Quarter)
1. **TLS/Domain:** Install **cert-manager** and issue Let’s Encrypt certs; configure host-based Ingress.
2. **Observability:** Enable DO Monitoring; consider Prometheus/Grafana for SLO dashboards (p95 latency, error rate).
3. **Persistence:** If stateful data is required, use **Managed PostgreSQL** and define `Readiness` checks for DB deps.
4. **CDN/Static:** For assets, add **Spaces + CDN** to reduce latency and egress cost.
5. **Policy & Guardrails:** Add `LimitRange`/`ResourceQuota`, Pod anti-affinity/topology spread, and namespace-level cost tags.
6. **CI/CD:** Keep GitHub Actions for image build; add deploy stage or use ArgoCD for GitOps.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Sudden traffic spike beyond HPA/cluster limits | Latency or errors | Raise HPA maxReplicas, enlarge autoscaler max nodes, enable CDN caching |
| Registry auth drift | Deploy failures | Keep DOCR secret attached to default SA in `prod`, rotate tokens on schedule |
| Cost creep | Overspend | Tag resources, monthly spend reviews, set budget alerts |
| Single-region outage | Downtime | Add second region with active/passive failover and DNS health checks |

## 30/60/90-Day Plan
- **30 days:** TLS + monitoring + alerts; finalize resource limits/requests.
- **60 days:** Add Managed Postgres (if needed), CDN for static assets, canary deployments.
- **90 days:** Multi-AZ validation, disaster recovery runbook, performance tuning under peak.
