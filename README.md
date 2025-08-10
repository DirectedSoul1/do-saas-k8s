# do-saas-k8s
# SaaS Web Application Deployment on DigitalOcean Kubernetes (DOKS)

## Overview
This project demonstrates deploying a stateless Node.js web application to **DigitalOcean Kubernetes (DOKS)** with the following capabilities:

- **Scalability** – Horizontal Pod Autoscaler (HPA) to handle traffic spikes.
- **Performance** – Optimized CPU/memory limits for consistent response times.
- **Reliability** – Pod Disruption Budgets (PDB) to ensure high availability during upgrades.
- **Cost Optimization** – Cluster autoscaling with minimal baseline nodes.

---

## Architecture

**Flow:**
1. **User** → DigitalOcean Load Balancer → NGINX Ingress Controller
2. Ingress routes to `web` **Kubernetes Service**.
3. Service routes to multiple pod replicas of the web app.
4. Pods pull their container image from a **private DigitalOcean Container Registry (DOCR)** using a Kubernetes pull secret.

**Key Components:**
- **DigitalOcean Kubernetes Cluster** – Managed control plane, 2-node pool (autoscaling to 6 nodes)
- **NGINX Ingress Controller** – HTTP routing
- **Horizontal Pod Autoscaler** – CPU-based scaling
- **Pod Disruption Budget** – Min available pods during updates
- **DO Container Registry** – Secure image storage

---

## Prerequisites
- DigitalOcean account with payment method added
- GitHub account for storing code
- **DigitalOcean API Token** with full access (created in DO Console)
- Local machine or GitHub Codespaces with:
  - Docker
  - kubectl
  - doctl (DigitalOcean CLI)

---

## Setup Steps

### 1. Create a Private Container Registry
1. In the DigitalOcean Console → **Container Registry** → Create new registry.
2. Example name: `saas-registry-1`
3. Save registry URL:

registry.digitalocean.com/saas-registry-1


---

### 2. Create Kubernetes Cluster
1. DO Console → **Kubernetes** → Create cluster.
2. Region: `LON1` (London)
3. Node pool: `s-2vcpu-4gb`, min 2 nodes, max 6 nodes (autoscaling enabled).
4. Leave default VPC settings.

---

### 3. Install NGINX Ingress Controller
1. In DO Console → Kubernetes → Marketplace → Install **NGINX Ingress Controller**.
2. Wait until pods in `ingress-nginx` namespace are `Running`.

---

### 4. Configure CLI Access
Download the kubeconfig from DO Console:
```bash
mkdir -p ~/.kube
# Place kubeconfig here, e.g. ~/.kube/config
export KUBECONFIG=~/.kube/config
kubectl get nodes
```

### 5. Build and Push Application Image

Login to DOCR:
```
doctl registry login

Build and Push:

docker build -t registry.digitalocean.com/saas-registry-1/saas-app:latest .
docker push registry.digitalocean.com/saas-registry-1/saas-app:latest
```

### 6. Create Kubernetes Namespace & Secrets

```
kubectl create namespace prod
kubectl create secret docker-registry registry-saas-registry-1 \
  --docker-server=registry.digitalocean.com \
  --docker-username=<YOUR_DO_API_TOKEN> \
  --docker-password=<YOUR_DO_API_TOKEN> \
  -n prod
```

### 7. Deploy the Application

Example deployment.yaml:
```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: registry.digitalocean.com/saas-registry-1/saas-app:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "250m"
            memory: "256Mi"
      imagePullSecrets:
      - name: registry-saas-registry-1
```

### 8. Add a Service & Ingress

```
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: prod
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  namespace: prod
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web
            port:
              number: 80
```

### 9. Apply Manifests
```
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

### 10. Enable Horizontal Pod Autoscaler
```
kubectl autoscale deployment web \
  --cpu-percent=60 --min=3 --max=6 -n prod
```

### 11. Get External IP
```
kubectl get svc -n ingress-nginx
```

Open the EXTERNAL-IP in your browser to test.

Testing
Scale Test: Run load with curl in a loop and check HPA scaling pods up.

Rolling Update Test: Push a new image tag and apply the deployment to watch zero-downtime deployment.

### Cost Estimate

| Resource                  | Cost (USD/month) |
| ------------------------- | ---------------- |
| 2 × s-2vcpu-4gb nodes     | \~\$24           |
| Load Balancer             | \~\$12           |
| Container Registry (Free) | \$0              |
| Total (baseline)          | \~\$36           |

Future Enhancements
TLS with cert-manager and Let’s Encrypt

Managed Postgres for persistence

CDN via DigitalOcean Spaces

Prometheus/Grafana monitoring

### Cleanup

1️⃣ Delete the Kubernetes Cluster
This is the biggest cost item.

```
doctl kubernetes cluster list
doctl kubernetes cluster delete <cluster-id>
Or in the DO dashboard:
Kubernetes → Select Cluster → Destroy
```

2️⃣ Delete the Load Balancer
If you installed the NGINX Ingress Controller, it created a DigitalOcean Load Balancer that will continue billing even after workloads are deleted.

In the DO dashboard:
Networking → Load Balancers → Delete

3️⃣ Delete the Container Registry
Container registries themselves are free only if they’re empty and inactive, but keeping them with images can incur costs after the trial.

```
doctl registry delete saas-registry-1
Or in dashboard:
Container Registry → Settings → Delete Registry
```

4️⃣ Delete Volumes (Block Storage)
If you created any persistent volumes (PVCs), they are backed by block storage that bills hourly.

```
doctl compute volume list
doctl compute volume delete <volume-id>
Or in dashboard:
Volumes → Delete
```

5️⃣ Delete Reserved IPs

Reserved IPs also bill hourly if not released.
```
doctl compute reserved-ip list
doctl compute reserved-ip delete <ip>
```

6️⃣ Delete VPC Networks
Custom VPCs don’t cost money, but it’s good hygiene to remove unused ones.
```
doctl vpcs list
doctl vpcs delete <vpc-id>

```

7️⃣ Double-check Billing Page

In the DO dashboard:
Settings → Billing → Invoices → Check “Active Resources”



