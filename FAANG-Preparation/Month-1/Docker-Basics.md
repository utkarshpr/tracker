# Docker & Containers — Complete Study Notes (Basics → Internals)

Self-contained. No internet needed.

---

## Table of Contents

1. [What Is a Container?](#1-what-is-a-container)
2. [Linux Namespaces (The Isolation Mechanism)](#2-linux-namespaces-the-isolation-mechanism)
3. [Cgroups (The Resource Limiting Mechanism)](#3-cgroups-the-resource-limiting-mechanism)
4. [OverlayFS (The Layered Filesystem)](#4-overlayfs-the-layered-filesystem)
5. [Container Runtime Stack](#5-container-runtime-stack)
6. [Docker Networking](#6-docker-networking)
7. [Docker Storage](#7-docker-storage)
8. [Security](#8-security)
9. [Kubernetes Basics](#9-kubernetes-basics)
10. [Dockerfile Best Practices](#10-dockerfile-best-practices)
11. [Production Gotchas](#11-production-gotchas)
12. [Container Security Checklist](#12-container-security-checklist)

---

## 1. What Is a Container?

**Basics**: A **container** is a process (or group of processes) that is isolated from the rest of the system using Linux kernel features. It shares the host kernel — unlike a **VM** which has its own kernel.

```text
VM Model:                          Container Model:
┌─────────┬─────────┐              ┌─────────┬─────────┐
│  App A  │  App B  │              │  App A  │  App B  │
│  Libs   │  Libs   │              │  Libs   │  Libs   │
│  Guest  │  Guest  │              └────┬────┴────┬────┘
│   OS    │   OS    │                   │ shared  │
├─────────┴─────────┤              ┌────┴─────────┴────┘
│    Hypervisor     │              │   Host OS Kernel   │
├───────────────────┤              ├───────────────────┤
│     Hardware      │              │     Hardware       │
└───────────────────┘              └───────────────────┘
```

**Why containers exist**:
- "Works on my machine" problem: ship code with its exact runtime environment
- Faster startup than VMs (milliseconds vs seconds) — no OS boot
- Denser packing: 10x more containers than VMs per host
- Immutable deployments: same image in dev, staging, prod

> **💡 Key Insight:** Containers are not VMs. They are isolated processes sharing the host kernel — the isolation comes from namespaces and cgroups, not from virtualizing hardware.

> 🌍 **Real-World:** Spotify deploys 300+ microservices using Docker — each service's Dockerfile pins exact dependency versions, eliminating "works on my machine" bugs across 2000+ engineers. The same container image runs on a developer's laptop, in CI, and in production, guaranteeing identical runtime behavior.

**Key terms**:

| Term | Definition |
|------|------------|
| **Image** | Read-only layered filesystem template (like a class) |
| **Container** | Running instance of an image (like an object) |
| **Registry** | Stores and distributes images (Docker Hub, ECR, GCR) |
| **Dockerfile** | Instructions to build an image |

> 🌍 **Real-World:** Netflix stores thousands of container images in Amazon ECR (Elastic Container Registry). When a new microservice version is deployed, ECS pulls the immutable image tag (e.g., `my-service:sha-abc1234`) — not `latest` — so every deployment is fully reproducible and rollback is a one-line image tag change.

---

## 2. Linux Namespaces (The Isolation Mechanism)

**Namespaces** make a process think it has its own isolated view of system resources. Seven namespace types:

> 🌍 **Real-World:** Google's internal container system (Borg, predecessor to Kubernetes) has used Linux namespaces since 2004 to isolate billions of container-like tasks per week across its data centers. Every Gmail, Search, and YouTube request is served by workloads running in namespace-isolated containers on shared kernel hosts.

### 2.1 PID Namespace

Container's processes have their own PID numbering. **PID 1** inside container = different process on host.

```bash
# In container:  ps aux → PID 1 is your app
# On host:       ps aux → that same process has PID 8472

# Create a new PID namespace:
unshare --pid --fork --mount-proc /bin/bash
# Now: echo $$ → 1 (you're PID 1 in this namespace)
```

**Effect**: Container cannot see or signal host processes. Host process with PID 8472 is invisible inside container.

> 🌍 **Real-World:** AWS Lambda runs each function invocation inside a MicroVM (Firecracker) with a PID namespace so that the function process is always PID 1 in its own space. This prevents cross-invocation process visibility and is why `ps aux` inside a Lambda shows only the function itself.

### 2.2 Network Namespace (NET)

Each container gets its own network stack: interfaces, IP addresses, routing table, iptables rules, ports.

```bash
# Create network namespace:
ip netns add mynet
ip netns exec mynet ip addr    # shows only loopback

# Docker creates a veth pair:
# veth0 (host side) ←──── virtual cable ────→ eth0 (container side)
```

**Effect**: Two containers can both listen on port 8080 — they have separate port spaces. Docker connects containers via virtual ethernet pairs.

> 🌍 **Real-World:** Cloudflare runs thousands of co-tenant containers on shared hosts for its Workers platform. Network namespaces ensure each customer's Worker process gets its own isolated network stack — two customers can both bind to port 8080 on the same physical host without conflict.

### 2.3 Mount Namespace (MNT)

Container has its own filesystem mount table. Mounting/unmounting inside container doesn't affect host.

```bash
unshare --mount /bin/bash
mount --bind /tmp/mydir /mnt    # only visible in this namespace
```

**Effect**: Container's `/` is a completely different filesystem from host's `/`. Container mounts don't pollute host.

> 🌍 **Real-World:** GitHub Actions runs each CI job in a fresh container with its own mount namespace. This means a job can `npm install` thousands of files into `/node_modules` without any risk of polluting the host or leaking dependencies between concurrent job runs on the same runner machine.

### 2.4 UTS Namespace (hostname + domain name)

Container can have its own hostname.

```bash
unshare --uts /bin/bash
hostname mycontainer   # doesn't change host's hostname
```

> 🌍 **Real-World:** Kubernetes sets each Pod's hostname to the Pod name using the UTS namespace. This allows applications inside the Pod to call `gethostname()` and get their own Pod name (e.g., `my-deployment-7f4b9c-xkv2p`), which is used for logging, tracing, and service discovery without touching the underlying node's hostname.

### 2.5 IPC Namespace (Inter-Process Communication)

Container gets isolated POSIX message queues, System V semaphores, shared memory.

**Effect**: Container processes can't use IPC to communicate with host processes.

### 2.6 User Namespace

Map container UIDs to different host UIDs. Root (UID 0) inside container → UID 65534 on host.

```bash
# UID mapping example:
# Container UID 0 → Host UID 100000
# Container UID 1 → Host UID 100001
# ...
# Container UID 65535 → Host UID 165535
```

**Effect**: "Rootless containers" — run Docker without root on host. Security improvement.

> 🌍 **Real-World:** Red Hat's Podman (used extensively in OpenShift/Kubernetes enterprise deployments) defaults to rootless containers using user namespaces. At enterprise customers like Deutsche Bank, this means developers can run containers on shared CI machines without any sudo access — container root maps to an unprivileged UID on the host.

### 2.7 Cgroup Namespace

Container sees only its own cgroup hierarchy, not host's full cgroup tree.

### Checking Namespaces

```bash
# See namespaces for a process:
ls -la /proc/<pid>/ns/

# See namespaces for container process on host:
docker inspect <container> --format '{{.State.Pid}}'
ls -la /proc/<that-pid>/ns/
```

---

## 3. Cgroups (The Resource Limiting Mechanism)

**Basics**: **Control Groups (cgroups)** limit and account for resource usage (CPU, memory, I/O, network) for a group of processes. Without cgroups, one container could use all CPU/memory and starve others.

> **⚠️ Production Gotcha:** Always set both memory and CPU limits in production. A container without limits can consume all host resources and starve every other container on the node.

> 🌍 **Real-World:** Google runs its entire data center fleet using cgroups through Borg (and now Kubernetes). When a Gmail spam filter container starts using excessive CPU during a burst, cgroups throttle it automatically — preventing it from starving the latency-sensitive Gmail serving containers running on the same host.

### 3.1 Cgroups v1 Architecture

```text
/sys/fs/cgroup/
├── memory/
│   └── docker/
│       └── <container-id>/
│           ├── memory.limit_in_bytes    # hard limit
│           ├── memory.soft_limit_in_bytes
│           └── memory.usage_in_bytes   # current usage
├── cpu/
│   └── docker/<container-id>/
│       ├── cpu.shares                  # relative weight
│       └── cpu.cfs_quota_us            # hard CPU limit
└── blkio/
    └── docker/<container-id>/
        └── blkio.weight
```

### 3.2 Cgroups v2 (Unified Hierarchy)

Single `/sys/fs/cgroup/` hierarchy instead of per-resource hierarchies. All controllers under one tree.

```bash
# v2 container cgroup:
/sys/fs/cgroup/system.slice/docker-<id>.scope/
├── memory.max          # replaces memory.limit_in_bytes
├── memory.current      # current usage
├── cpu.max             # "quota period" format: "100000 1000000" = 10% CPU
└── cpu.weight          # replaces cpu.shares
```

> 🌍 **Real-World:** Meta (Facebook) migrated their entire container fleet to cgroups v2 as part of their shift to systemd-based container management. The unified hierarchy simplified their resource accounting tooling — instead of reading from a dozen separate cgroup v1 subsystem paths, their monitoring agent now reads from a single cgroup directory per container.

### 3.3 Docker Resource Limits → Cgroup Files

```bash
# Run container with limits:
docker run --memory=512m --cpus=2 nginx

# What Docker writes:
# memory.max = 536870912  (512 * 1024 * 1024)
# cpu.max = 200000 100000  (2 CPUs = 200% of 100ms period)
```

### 3.4 OOM Killer

When container exceeds memory limit, the kernel **OOM killer** terminates the most memory-hungry process in the cgroup. The container process (often PID 1) gets killed → container exits.

```bash
# Check if container was OOM-killed:
docker inspect <container> | grep OOMKilled
# → "OOMKilled": true
```

> 🌍 **Real-World:** Airbnb's data engineering team discovered that their Spark executor containers were being OOM-killed silently during large shuffle operations. The containers would disappear without error logs because the OOM killer killed PID 1 before any graceful shutdown could log the cause. They added `docker inspect` OOMKilled checks to their job monitoring to distinguish OOM failures from application errors.

### 3.5 CPU Throttling

```text
CFS (Completely Fair Scheduler) quota:
cpu.cfs_period_us = 100000  (100ms period)
cpu.cfs_quota_us  = 50000   (50ms per period = 0.5 CPU)

If container uses its 50ms quota in first 30ms of period:
→ throttled for remaining 70ms → CPU usage capped at 50%
```

> **💡 Key Insight:** CPU limits throttle (slow down) a container but do NOT kill it. Memory limits that are exceeded DO kill the container via the OOM killer. These behave very differently in production.

> 🌍 **Real-World:** Shopify found that aggressive CPU limits (`cpu.cfs_quota_us`) were causing tail-latency spikes in their Ruby on Rails containers. Even at 30% average CPU usage, bursts during GC would exhaust the quota and throttle the process mid-GC — causing P99 latency to spike 10×. They switched to CPU requests (cpu.shares) without hard limits for latency-sensitive services, accepting slightly less isolation for lower tail latency.

---

## 4. OverlayFS (The Layered Filesystem)

### 4.1 How Image Layers Work

Docker images are built in layers. Each Dockerfile instruction creates a new layer. Layers are **read-only** and shared between containers.

```text
Image: nginx:alpine
Layer 4: /etc/nginx/nginx.conf    (COPY instruction)
Layer 3: nginx binary             (RUN apk add nginx)
Layer 2: apk packages             (RUN apk update)
Layer 1: Alpine base              (FROM alpine:3.18)
```

> 🌍 **Real-World:** Docker Hub's official nginx image is pulled millions of times per day. Because of layer sharing, if your production hosts already have the `alpine:3.18` base layer cached, pulling a new nginx version only downloads the layers that changed (typically the nginx binary layer), not the entire image. Uber reported saving 60%+ in image pull time across their fleet by structuring Dockerfiles to maximize shared base layer reuse.

### 4.2 OverlayFS Mechanics

When a container starts, Docker creates an **OverlayFS** mount with 4 directories:

```text
lowerdir  = image layers (read-only, stacked bottom to top)
upperdir  = container layer (read-write, unique per container)
workdir   = temp directory for atomic ops (required by OverlayFS)
merged    = final view (what container sees at /)
```

```bash
# Docker OverlayFS mount:
mount -t overlay overlay \
  -o lowerdir=/var/lib/docker/overlay2/L1:L2:L3,\
     upperdir=/var/lib/docker/overlay2/<container-id>/diff,\
     workdir=/var/lib/docker/overlay2/<container-id>/work \
  /var/lib/docker/overlay2/<container-id>/merged
```

> 🌍 **Real-World:** GitHub's CI platform runs thousands of concurrent build containers on the same fleet of hosts. OverlayFS means all containers running `ubuntu:22.04`-based images share one copy of the base layers on disk — instead of 10,000 containers × 70MB = 700GB of duplicated base OS data, the shared lowerdir means the base occupies ~70MB once, and each container only adds its own small upperdir diff.

### 4.3 Copy-on-Write (CoW)

**Reading** a file: if file exists in lowerdir → served directly from there (no copy).
**Modifying** a file: file is copied to upperdir first, then modified. Lowerdir untouched.

```text
Container A reads /etc/nginx/nginx.conf → reads from lowerdir (fast, no copy)
Container A writes /etc/nginx/nginx.conf →
  1. Copy file from lowerdir to A's upperdir
  2. Modify in upperdir
  3. Container sees modified version in merged
  4. lowerdir (shared image layer) unchanged
  5. Container B still sees original file
```

> **💡 Key Insight:** Copy-on-Write means the first write to any file from the base image incurs a copy cost. For write-heavy workloads (e.g., databases), mount a volume instead so writes go directly to the volume, bypassing CoW entirely.

> 🌍 **Real-World:** MongoDB's official Docker documentation explicitly warns against storing data files in the container's writable layer. Pinterest, which runs MongoDB in containers, mounts a dedicated EBS volume as a Docker volume — MongoDB's write-heavy WiredTiger storage engine writes directly to the volume, completely bypassing OverlayFS CoW overhead. This yielded a 3× improvement in write throughput vs. storing data in the container layer.

### 4.4 Layer Sharing

```text
10 containers running nginx:alpine
→ lowerdir is SHARED among all 10 containers (one copy on disk)
→ Each container has its own upperdir (~500KB initially for metadata)
→ Disk usage: 1x image size + 10x (small container diffs)
→ Without layers: 10x image size
```

### Checking Layers

```bash
# See overlay mounts:
docker inspect <container> | jq '.[0].GraphDriver.Data'
# Shows: LowerDir, UpperDir, WorkDir, MergedDir

# On host:
mount | grep overlay
# Shows the actual mount command Docker used
```

---

## 5. Container Runtime Stack

### 5.1 The Full Stack

```text
User (docker CLI)
       ↓ REST API (Unix socket /var/run/docker.sock)
   dockerd (Docker daemon)
       ↓ gRPC
   containerd (container lifecycle manager)
       ↓ 
   containerd-shim (per container, keeps container running if containerd dies)
       ↓ OCI spec (config.json)
   runc (actually creates the container using Linux syscalls)
       ↓
   Linux kernel (namespaces + cgroups + OverlayFS)
```

### 5.2 Each Component

**dockerd**: High-level Docker features — image builds, networking, volumes, Swarm. Talks to containerd for actual container operations. Can be replaced entirely (Kubernetes doesn't use dockerd).

**containerd**: CNCF project. Container lifecycle: pull images, create/start/stop containers, snapshots. Used directly by Kubernetes via **CRI** (Container Runtime Interface). Does NOT create containers itself.

> 🌍 **Real-World:** Amazon EKS and Google GKE both use containerd directly as their container runtime (bypassing dockerd entirely). When AWS migrated EKS nodes from Docker to containerd in 2022, they reported a ~10% reduction in node startup time and eliminated a class of container-escape vulnerabilities related to the Docker daemon socket being exposed inside Pods.

**containerd-shim**: One shim per container. Purpose: decouple container's stdio from containerd. If containerd restarts or upgrades, containers keep running (shim stays alive). Reaps zombie processes.

**runc**: OCI-compliant container runtime. Reads `config.json` (OCI spec), calls Linux syscalls to:
1. Create namespaces (`clone(CLONE_NEWPID | CLONE_NEWNET | ...)`)
2. Set up cgroups
3. Mount OverlayFS
4. Execute container entrypoint

### 5.3 OCI Spec

**Open Container Initiative (OCI)** defines:

| Spec | Purpose |
|------|---------|
| **Image spec** | Format for container images (layers, manifests, configs) |
| **Runtime spec** | Format for describing a container to run (`config.json`) |
| **Distribution spec** | API for image registries |

`config.json` contains: root filesystem path, namespaces to create, cgroup limits, capabilities to drop, seccomp profile, mounts, process to execute.

> 🌍 **Real-World:** AWS Firecracker (used by Lambda) implements the OCI runtime spec but uses microVMs instead of Linux namespaces for isolation. Because it conforms to OCI, the same container images and tooling work transparently — Lambda runs your Docker image without modification, while replacing runc's namespace-based isolation with a hardware-virtualized boundary for stronger multi-tenant security.

### 5.4 What Happens on `docker run nginx`

```text
1. docker CLI → POST /containers/create to dockerd
2. dockerd → tells containerd to create container
3. containerd → pulls image if not cached (downloads layers, extracts to snapshots)
4. containerd → creates OCI config.json from image config + user args
5. containerd → spawns containerd-shim
6. shim → runs runc with config.json
7. runc → calls clone() syscall with namespace flags → creates new namespaces
8. runc → writes to /sys/fs/cgroup/ to set resource limits
9. runc → sets up OverlayFS mount
10. runc → drops capabilities, applies seccomp
11. runc → exec()s nginx process (now running in isolated environment)
12. runc exits (container is now owned by shim)
```

> **📖 Real-World Example:** When Kubernetes moved from dockershim to containerd in v1.24, this removed the `dockerd` layer entirely. Kubernetes now talks directly to containerd via CRI, reducing latency and eliminating a failure point — but `docker` CLI commands no longer work on Kubernetes nodes without extra setup.

---

## 6. Docker Networking

### 6.1 Network Modes

| Mode | Isolation | Performance | Use Case |
|------|-----------|-------------|----------|
| **Bridge** (default) | Full namespace isolation | Moderate (veth overhead) | General-purpose container networking |
| **Host** (`--network=host`) | None — shares host namespace | Highest (no veth) | High-performance, latency-sensitive workloads |
| **Overlay** | Cross-host isolation | Moderate (VXLAN encapsulation) | Multi-host Swarm / Kubernetes |
| **None** | Full isolation | N/A | Batch jobs, no network needed |

#### Bridge (default)

```text
Host network namespace:
  docker0 bridge: 172.17.0.1/16
  veth8a3f2c (host end) → connected to container's eth0
  iptables NAT: MASQUERADE for outbound traffic

Container network namespace:
  eth0: 172.17.0.2/16
  gateway: 172.17.0.1

Traffic flow (container → internet):
  container eth0 → veth pair → docker0 bridge → iptables MASQUERADE → host eth0 → internet
```

> 🌍 **Real-World:** Docker Compose uses bridge networking by default for local development — all containers in a `docker-compose.yml` get placed on a shared user-defined bridge network and can reach each other by service name (`db`, `redis`, `web`). Companies like Atlassian use this so developers can run the entire Jira/Confluence stack locally with `docker compose up`, with each service resolving the others by name exactly as it does in production.

#### Host Network (`--network=host`)

Container shares host's network namespace. No isolation. Container listening on :8080 = host listening on :8080. Highest performance (no veth overhead).

> 🌍 **Real-World:** Cloudflare runs its `cloudflared` tunnel daemon with `--network=host` on customer edge nodes. Because the daemon needs to bind to specific host IPs and ports, and processes millions of packets per second, veth overhead would be unacceptable — host networking gives direct access to the NIC at full kernel bypass speed.

#### Overlay Network (multi-host, used by Swarm/Kubernetes)

```text
Host A (172.16.0.1)           Host B (172.16.0.2)
  Container 10.0.0.1             Container 10.0.0.2
        ↓                               ↓
  VXLAN encapsulation          VXLAN encapsulation
  UDP packet: src=172.16.0.1 dst=172.16.0.2, payload=container traffic
```

**VXLAN** (Virtual Extensible LAN): encapsulates L2 frames in UDP packets. Allows containers on different hosts to be on the same virtual L2 network.

> 🌍 **Real-World:** Kubernetes clusters on AWS EKS use VPC CNI (Container Network Interface) which bypasses VXLAN entirely and assigns real VPC IP addresses to each Pod. This means Pod-to-Pod traffic crosses the AWS fabric at full line rate with no encapsulation overhead — critical for Netflix's inter-service streaming traffic where each service may fan out to dozens of downstream services per request.

#### None

No networking. Container has only loopback interface.

### 6.2 DNS Resolution

Docker runs an embedded DNS server at `127.0.0.11`. Containers in the same user-defined network resolve each other by name:

```text
# Container "web" can reach container "db":
getaddrinfo("db") → 127.0.0.11 (Docker DNS) → returns db container's IP
```

> 🌍 **Real-World:** Docker's embedded DNS at `127.0.0.11` is the foundation for service discovery in Docker Compose. At companies like Basecamp, the entire Ruby on Rails stack (app + Postgres + Redis + Sidekiq) is orchestrated with Compose — the app container resolves `postgres` and `redis` by name using Docker DNS, so the connection strings are identical between a developer's MacBook and a production-like staging environment.

### 6.3 Port Publishing

```bash
docker run -p 8080:80 nginx
```

```text
iptables rule Docker adds:
-A DOCKER -p tcp --dport 8080 -j DNAT --to-destination 172.17.0.2:80
-A POSTROUTING -s 172.17.0.2/32 -p tcp --dport 80 -j MASQUERADE
```

> **⚠️ Production Gotcha:** Publishing a port with `-p` adds iptables rules that bypass `ufw`/`firewalld`. Even if your firewall blocks port 8080, Docker's iptables rules can still expose it. Always place containers behind a reverse proxy and control access at the cloud security group level.

> 🌍 **Real-World:** Traefik (a reverse proxy built specifically for Docker) watches the Docker socket for container events and automatically configures routing rules when containers start/stop. Algolia uses Traefik in front of their Docker containers — when a new API service container starts with a `traefik.http.routers.api.rule=Host("api.algolia.com")` label, Traefik instantly picks it up with zero downtime configuration reload, no iptables manipulation needed.

---

## 7. Docker Storage

### 7.1 Volumes vs Bind Mounts vs tmpfs

| Type | Location | Managed by | Use Case |
|------|----------|------------|----------|
| **Volume** | `/var/lib/docker/volumes/` | Docker | DB data, persistent app data |
| **Bind mount** | Anywhere on host | Host OS | Dev (hot reload source code) |
| **tmpfs** | RAM only | Kernel | Secrets, temp files |

```bash
# Volume (preferred for production):
docker run -v mydata:/var/lib/mysql mysql
# Docker creates /var/lib/docker/volumes/mydata/_data

# Bind mount (dev workflow):
docker run -v $(pwd):/app node npm run dev
# Host directory mounted directly into container

# tmpfs (in-memory, not persisted):
docker run --tmpfs /run:rw,size=64m nginx
```

> 🌍 **Real-World:** GitLab CI uses Docker volumes to share build artifacts between pipeline stages. A `build` stage compiles binaries into a named volume, and the subsequent `test` and `deploy` stages mount the same volume to access them — avoiding re-downloading or re-building, cutting pipeline time from 20 minutes to under 5 minutes in typical Java projects.

> 🌍 **Real-World:** HashiCorp Vault (secrets management) is commonly run in Docker with `--tmpfs /vault/data` so that the in-memory secret store never touches disk. At Square, secrets injected into payment processing containers are stored in tmpfs mounts — even if an attacker gains host access and takes a disk snapshot, no plaintext secrets appear because they existed only in RAM.

### 7.2 Layer Caching

Docker builds images using cache. Each instruction is a cache key:

```dockerfile
FROM node:18          # Layer 1: cached
WORKDIR /app          # Layer 2: cached
COPY package*.json .  # Layer 3: cache key = file hash
RUN npm install       # Layer 4: cached IF package.json unchanged
COPY . .              # Layer 5: always changes (source code)
RUN npm run build     # Layer 6: always re-runs
```

> **💡 Key Insight:** **Optimization**: Copy dependency files first, install, THEN copy source code. Invalidating layer 5 doesn't re-run layer 4 (npm install). This can save minutes per build in CI/CD pipelines.

> 🌍 **Real-World:** Airbnb's frontend monorepo build times dropped from 12 minutes to 90 seconds by restructuring their Dockerfile to copy `package.json` and `yarn.lock` before the source code — `yarn install` (the expensive step) is now cached on every PR unless dependencies actually change. With hundreds of PR builds per day, this optimization saves multiple hours of CI compute daily.

---

## 8. Security

### 8.1 Linux Capabilities

**Root** is broken into ~40 **capabilities**. Containers drop most by default.

```bash
# Default dropped capabilities:
CAP_SYS_ADMIN   # mount, ioctl, kernel module load — very dangerous
CAP_NET_ADMIN   # modify network interfaces
CAP_SYS_PTRACE  # strace other processes
CAP_SYS_BOOT    # reboot

# What containers keep (default):
CAP_CHOWN       # chown files
CAP_NET_BIND_SERVICE  # bind ports < 1024
CAP_KILL        # send signals to own processes

# Further restrict:
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE nginx
```

> **⚠️ Production Gotcha:** `CAP_SYS_ADMIN` is effectively root. Never grant it to a container unless absolutely necessary — it allows kernel module loading, mounting arbitrary filesystems, and can be used to escape the container.

> 🌍 **Real-World:** Sysdig (container security company) analyzed 10 million containers in production and found that only 6% of containers actually needed any capabilities beyond the default Docker set. Companies like Palo Alto Networks run their container security agents with `--cap-drop=ALL --cap-add=SYS_PTRACE` — only the single capability needed for process inspection, nothing else.

### 8.2 Seccomp

**Seccomp** (Secure Computing Mode) is a system call filter that blocks dangerous syscalls.

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    {"names": ["read","write","open","close","stat"], "action": "SCMP_ACT_ALLOW"},
    {"names": ["mount","reboot","kexec_load"], "action": "SCMP_ACT_ERRNO"}
  ]
}
```

Docker's default seccomp profile blocks ~44 syscalls including `reboot`, `kexec_load`, `create_module`.

> 🌍 **Real-World:** Google's gVisor (used in Google Cloud Run) takes seccomp to the extreme by intercepting ALL syscalls and routing them through a user-space kernel written in Go. When a container calls `open()`, gVisor intercepts it before it reaches the Linux kernel. This completely eliminates entire classes of kernel exploits — every Cloud Run function runs in gVisor, providing stronger isolation than standard seccomp profiles alone.

### 8.3 AppArmor / SELinux

**Mandatory Access Control (MAC)** policies applied to the container process.

```bash
# Docker applies docker-default AppArmor profile:
# Blocks: /proc/sys/kernel/** writes, /sys/** writes
# Allows: normal file ops, networking

# Check:
docker inspect <container> | grep AppArmor
```

> 🌍 **Real-World:** Red Hat OpenShift enforces SELinux MCS (Multi-Category Security) labels on all containers by default. Each container gets a unique label like `s0:c123,c456` — the kernel's SELinux policy prevents Container A from reading files written by Container B even if they share the same host filesystem path. At financial institutions running OpenShift (e.g., Deutsche Bank), this provides a hardware-enforced isolation layer that satisfies PCI-DSS container isolation requirements.

### 8.4 Rootless Docker

Run Docker daemon as non-root user. Uses user namespaces to map container root → unprivileged host user.

```bash
# Install rootless Docker:
dockerd-rootless-setuptool.sh install

# Container root (UID 0) → host UID 100000
# Security: container breakout doesn't give host root
```

> **💡 Key Insight:** Defense-in-depth for containers has four layers: Capabilities (what root can do), Seccomp (what syscalls are allowed), AppArmor/SELinux (what files/resources the process can touch), and User Namespaces (whether container root maps to host root). Production hardening uses all four.

> 🌍 **Real-World:** GitHub's Codespaces runs each developer's cloud development environment as a rootless container. If a developer accidentally runs malicious code that escapes the container, the process runs as an unprivileged UID on the host — it cannot access other users' environments or modify the host system. This is how GitHub safely runs thousands of untrusted developer workloads on shared infrastructure.

---

## 9. Kubernetes Basics

### 9.1 What Kubernetes Does

**Kubernetes** orchestrates containers across multiple nodes: scheduling, scaling, self-healing, service discovery, rolling updates.

```text
Control Plane (master):            Worker Nodes:
┌────────────────────┐           ┌──────────────────┐
│  kube-apiserver    │           │  kubelet          │
│  etcd              │──────────▶│  kube-proxy       │
│  kube-scheduler    │           │  container runtime│
│  kube-controller   │           │  (containerd)     │
└────────────────────┘           └──────────────────┘
```

> 🌍 **Real-World:** Spotify migrated from a manually managed microservice fleet to Kubernetes (on GKE) to handle auto-scaling for peak music streaming demand. When a new album drops and traffic spikes 10×, Kubernetes Horizontal Pod Autoscaler detects the CPU/RPS increase and spins up additional replicas within 60 seconds — without any on-call engineer intervention. Before Kubernetes, Spotify engineers had to manually scale capacity for major releases.

### 9.2 Pod Internals

A **Pod** is the smallest deployable unit. Contains one or more containers sharing:
- Same network namespace (same IP, can communicate via localhost)
- Same IPC namespace
- Optionally same PID namespace (for process inspection)

```text
Pod:
├── pause container (infra container)
│   - Created first, holds network + IPC namespaces
│   - Runs minimal "pause" binary (just sleeps)
│   - Other containers join its namespaces
│   - If app container crashes and restarts, IP is preserved (pause is still running)
├── app-container-1 (joins pause's namespaces)
└── sidecar-container (joins pause's namespaces)
```

> **💡 Key Insight:** **Why the pause container?** Namespace lifetimes are tied to processes. If app container crashes and PID 1 exits, the namespace is destroyed → IP changes on restart. The pause container decouples namespace lifetime from app container lifetime — the Pod keeps its IP even when the app crashes and restarts.

> 🌍 **Real-World:** Istio (the service mesh used at Lyft, eBay, and Salesforce) injects an Envoy proxy as a sidecar container into every application Pod. Both the app container and the Envoy sidecar share the same network namespace (via the pause container) — so Envoy can intercept all inbound and outbound traffic by manipulating iptables rules within that shared namespace, without the app needing any code changes.

### 9.3 kubelet

**kubelet** runs on every worker node. Watches kube-apiserver for Pods assigned to this node. For each Pod:
1. Calls CRI (containerd) to pull images and start containers
2. Mounts volumes
3. Runs liveness/readiness probes
4. Reports status back to API server

> 🌍 **Real-World:** Pinterest runs 1,000+ Kubernetes nodes, each running a kubelet that manages 30–50 Pods. When Pinterest's image processing service fails its liveness probe (the probe calls `/health` and gets a 500), the kubelet automatically restarts that container — Pinterest engineers estimate this self-healing behavior eliminates ~40% of what would otherwise require manual on-call pages.

### 9.4 Service Types

| Service Type | Scope | Mechanism | Use Case |
|-------------|-------|-----------|----------|
| **ClusterIP** (default) | Internal only | iptables VIP → Pod IPs | Internal service-to-service communication |
| **NodePort** | External via node IP | NodeIP:30000-32767 → ClusterIP | Dev/testing, non-cloud environments |
| **LoadBalancer** | External via cloud LB | Cloud LB → NodePort → ClusterIP | Production internet-facing services |
| **ExternalName** | Internal DNS alias | CNAME → external hostname | Bridging cluster DNS to external services |

```text
ClusterIP (default):
  - Internal DNS: my-service.namespace.svc.cluster.local
  - Stable IP (VIP) that load-balances to Pod IPs
  - kube-proxy writes iptables rules for this VIP

NodePort:
  - Exposes service on every node's IP at a static port (30000-32767)
  - External traffic → NodeIP:NodePort → ClusterIP → Pod

LoadBalancer:
  - Requests cloud provider to provision external load balancer
  - External traffic → Cloud LB → NodePort → ClusterIP → Pod

ExternalName:
  - CNAME record in cluster DNS → external service
  - No proxying; pure DNS
```

> 🌍 **Real-World:** Airbnb uses Kubernetes LoadBalancer services backed by AWS ALB (Application Load Balancer) to expose their booking API to the internet. Each microservice that needs external traffic gets its own ALB provisioned automatically by the AWS Load Balancer Controller — when an engineer deploys a new service with `type: LoadBalancer`, the controller creates a real AWS ALB with health checks within 60 seconds, no manual cloud console work required.

### 9.5 kube-proxy Modes

#### iptables mode (default)

```text
Service VIP → iptables DNAT rules (probabilistic load balancing)
Request to ClusterIP:80 → randomly DNATed to one of pod IPs
```

```bash
# iptables rules for service with 3 pods:
-A KUBE-SVC-XXXX -m statistic --mode random --probability 0.33 -j KUBE-SEP-POD1
-A KUBE-SVC-XXXX -m statistic --mode random --probability 0.50 -j KUBE-SEP-POD2
-A KUBE-SVC-XXXX -j KUBE-SEP-POD3

# Problem: O(n) rule scan per packet, poor performance with 10k+ services
```

#### IPVS mode (large clusters)

```text
Uses Linux IPVS (IP Virtual Server) in kernel
Hash table lookup: O(1) per packet regardless of service count
Supports: round-robin, least-conn, destination-hash, source-hash
```

> **💡 Key Insight:** At ~1000+ services, iptables mode starts causing measurable latency due to linear rule scanning. IPVS mode uses kernel hash tables for O(1) lookups — switch to IPVS mode for large clusters.

> 🌍 **Real-World:** Alibaba Cloud's ACK (Alibaba Container Service for Kubernetes) switches to IPVS mode by default on clusters with more than 1,000 services. At Alibaba's scale — their internal Kubernetes clusters have 10,000+ services during Singles' Day — the difference between O(N) iptables scanning and O(1) IPVS hash lookup translates to measurable milliseconds of per-request latency reduction across billions of daily requests.

### 9.6 Deployment → ReplicaSet → Pod

```yaml
# Deployment (desired state: 3 replicas of nginx:1.25)
#   ↓ creates
# ReplicaSet (ensures 3 Pods exist at all times)
#   ↓ creates
# Pod-1, Pod-2, Pod-3

# Rolling update (RollingUpdate strategy):
#   1. Create new ReplicaSet with nginx:1.26
#   2. Scale up new RS: +1 Pod
#   3. Scale down old RS: -1 Pod
#   4. Repeat until new RS has 3 Pods, old RS has 0
#   Configurable: maxSurge (extra pods during update), maxUnavailable
```

> 🌍 **Real-World:** GitHub deploys their main Rails application to Kubernetes using rolling Deployments hundreds of times per day. With `maxUnavailable: 0` and `maxSurge: 1`, a new version of the app is brought up alongside the old one before any old Pod is taken down — ensuring zero-downtime deploys even for the GitHub.com homepage that serves millions of developers simultaneously.

### 9.7 etcd in Kubernetes

All cluster state stored in **etcd**: pods, services, configmaps, secrets, deployments.

```bash
# Kubernetes talks to etcd via kube-apiserver only
# Direct etcd access for debugging:
ETCDCTL_API=3 etcdctl get /registry/pods/default/my-pod

# Losing etcd without backup = losing entire cluster
# Backup: etcdctl snapshot save backup.db
```

> **⚠️ Production Gotcha:** etcd is the single source of truth for your entire cluster. Losing etcd without a backup means losing all cluster state — every Deployment, Secret, ConfigMap, and Service definition. Back it up regularly with `etcdctl snapshot save` and store backups off-cluster.

> 🌍 **Real-World:** Weaveworks (GitOps pioneers) lost an entire production Kubernetes cluster when their etcd data was corrupted during an in-place upgrade gone wrong. They had no off-cluster etcd backup. Recovery required manually reconstructing ~200 Deployment YAML files from git history. They subsequently wrote Flux CD (GitOps operator) as a direct result — treating git as the source of truth means the cluster state can always be rebuilt from git, making etcd loss recoverable.

### 9.8 Ingress

**Ingress** routes HTTP/HTTPS traffic from outside the cluster to Services based on hostname/path.

```text
internet → cloud LB → Ingress Controller (nginx/traefik/HAProxy)
                         ↓ (based on routing rules)
                  Service-A or Service-B
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /v1
        backend:
          service:
            name: api-v1-service
            port:
              number: 80
```

> 🌍 **Real-World:** Stack Overflow runs nginx Ingress Controller on their Kubernetes clusters to route traffic across their Q&A platform, teams product, and API endpoints — all behind a single cloud load balancer IP. Path-based routing (`/api/v1` → api-service, `/teams` → teams-service) lets them independently deploy and scale each service while presenting a unified domain to users.

---

## 10. Dockerfile Best Practices

```dockerfile
# Multi-stage build — final image has NO build tools
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download                 # cached layer (only re-runs if go.mod changes)
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM gcr.io/distroless/static       # minimal base, no shell, no package manager
COPY --from=builder /app/server /server
USER nonroot:nonroot                # never run as root
EXPOSE 8080
ENTRYPOINT ["/server"]              # exec form (not shell form) — signals forwarded directly
```

> **💡 Key Insight:** **Multi-stage builds** are the single most impactful Dockerfile optimization. A Go binary built in `golang:1.21` (~800MB) can be shipped in `distroless/static` (~2MB). Smaller images mean faster pulls, smaller attack surface, and lower registry storage costs.

> 🌍 **Real-World:** Cloudflare uses multi-stage Docker builds for their Go-based edge services. Their `cloudflared` tunnel binary goes from a ~900MB `golang:alpine` build image to a ~8MB final image using `FROM scratch`. When deployed to 270+ data center locations, that 112× size reduction translates to faster rollout propagation — a new version reaches all edge nodes in minutes instead of hours.

**Key rules**:

| # | Rule | Why |
|---|------|-----|
| 1 | Use multi-stage builds | Build image can have GCC; final has nothing |
| 2 | Order instructions by frequency of change (most stable first) | Maximizes cache hit rate |
| 3 | Combine RUN commands | Reduces layer count; avoids stale cache |
| 4 | Use `.dockerignore` | Exclude `node_modules/`, `.git/`, `*.log` from build context |
| 5 | Pin image versions | `FROM node:18.19.0-alpine3.19` not `FROM node:latest` |
| 6 | Run as non-root | `USER 1001` or named user |
| 7 | Use exec form for ENTRYPOINT | `["./app"]` not `./app` — shell form wraps in `/bin/sh -c`, signals don't reach your process |

```dockerfile
# Combining RUN commands (Rule 3):
RUN apt-get update && apt-get install -y pkg && rm -rf /var/lib/apt/lists/*
```

> 🌍 **Real-World:** Snyk (container security) scanned 4 million Docker images and found that 44% used `FROM ubuntu:latest` or similar unpinned base images. When Log4Shell (CVE-2021-44228) was disclosed, companies with pinned base images could update to a patched version and redeploy within hours — companies using `latest` had to first figure out which version they were actually running. Netflix mandates pinned digest-based image references (`FROM node@sha256:abc...`) in all production Dockerfiles.

---

## 11. Production Gotchas

### 11.1 PID 1 Problem

Container's PID 1 must handle signals AND reap **zombie processes**. Your app as PID 1 often doesn't do this.

```dockerfile
# Problem: shell form creates shell as PID 1, app as child
CMD ./myapp   # → sh -c ./myapp (PID 1=sh, PID 2=myapp) SIGTERM → sh exits, myapp killed

# Solution 1: exec form (app IS PID 1):
ENTRYPOINT ["./myapp"]

# Solution 2: use tini as PID 1 (init process):
RUN apk add tini
ENTRYPOINT ["/sbin/tini", "--", "./myapp"]
```

> **⚠️ Production Gotcha:** Using shell form (`CMD ./myapp`) means `sh` is PID 1. When Kubernetes sends SIGTERM for graceful shutdown, `sh` receives it — but shell doesn't forward signals to child processes by default. Your app never gets the SIGTERM and is hard-killed after the grace period.

> 🌍 **Real-World:** Uber discovered this the hard way when their Go microservices were using shell-form CMD in Dockerfiles. During rolling deploys, Kubernetes sent SIGTERM to PID 1 (the shell wrapper), which exited immediately without forwarding the signal — in-flight gRPC calls were hard-killed, causing `UNAVAILABLE` errors to downstream callers. Switching to exec-form ENTRYPOINT and implementing graceful shutdown reduced deploy-related errors by ~90%.

### 11.2 Signal Handling / Graceful Shutdown

```text
docker stop sends SIGTERM → waits 10s → sends SIGKILL
If your app doesn't catch SIGTERM → SIGKILL → in-flight requests dropped
```

```bash
# Go graceful shutdown example:
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
<-quit
# graceful shutdown: stop accepting new requests, finish in-flight
server.Shutdown(ctx)
```

> 🌍 **Real-World:** Twitter (now X) processes billions of API requests daily through containerized services. They enforce a `terminationGracePeriodSeconds: 60` in all Kubernetes Pod specs and require every service to implement SIGTERM handling that drains in-flight requests. Without this, every rolling deploy would silently drop ~0.1% of requests — at Twitter's scale that would mean millions of failed requests per deployment.

### 11.3 Image Size

| Base Image | Size | Shell | Use Case |
|-----------|------|-------|----------|
| **Distroless** | ~2MB | No | Production — minimal attack surface |
| **Alpine** | ~5MB | ash | Dev-friendly, small production images |
| `ubuntu:latest` | ~70MB | bash | Avoid for final production images |

> **💡 Key Insight:** Distroless images have no shell, no package manager, and no extra binaries. If an attacker gains code execution inside a distroless container, they have almost no tools to work with — no `curl`, no `wget`, no `bash`. This significantly limits post-exploitation.

> 🌍 **Real-World:** Google uses distroless base images for all their internal Go and Java services. When a code execution vulnerability was found in a third-party library used in Google's ad serving containers, the attacker couldn't pivot further — no shell, no curl, no package manager meant the blast radius was contained to just that process. Google open-sourced their distroless images specifically to push the industry toward minimal attack surfaces.

### 11.4 Layer Cache Busting

```dockerfile
# BAD: apt-get update and install in different RUN = cached separately
RUN apt-get update
RUN apt-get install -y curl   # might install old curl from stale cache

# GOOD: always together
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
```

> **⚠️ Production Gotcha:** Splitting `apt-get update` and `apt-get install` into separate `RUN` instructions is a common source of stale package versions in production images. The update layer gets cached and reused, while the install layer runs against an outdated package index.

> 🌍 **Real-World:** In 2022, a company running a fintech payment service discovered their production containers had a 14-month-old version of OpenSSL because their Dockerfile had `RUN apt-get update` as a separate cached layer that hadn't been invalidated in over a year. The `apt-get install openssl` layer was re-running on every build but fetching from the stale cached index. Trivy image scanning (integrated into CI) would have caught this — they now run `trivy image` on every build.

### 11.5 Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O- http://localhost:8080/health || exit 1
```

Without `HEALTHCHECK`, Kubernetes considers container healthy as soon as it starts (before app is ready).

> 🌍 **Real-World:** Lyft uses readiness and liveness probes on all Kubernetes services. Their API gateway implements a `/ready` endpoint that checks whether the service has finished loading its configuration cache from DynamoDB on startup — without the readiness probe, Kubernetes would route traffic to the Pod before it was ready, causing request failures for the first 5–10 seconds after each deploy. Proper health checks eliminated this class of deploy-related user-visible errors entirely.

### 11.6 Resource Limits in Production

Always set both **requests** AND **limits** in Kubernetes:

```yaml
resources:
  requests:
    memory: "128Mi"   # scheduler uses this for placement
    cpu: "250m"       # 0.25 CPU cores
  limits:
    memory: "256Mi"   # OOM killed if exceeded
    cpu: "500m"       # throttled if exceeded (NOT killed)
```

> **⚠️ Production Gotcha:** **No limits = noisy neighbor problem** — one runaway container starves others on the same node. Setting **Requests = Limits** gives you the "Guaranteed" QoS class — these Pods are never throttled or evicted first under node pressure.

> 🌍 **Real-World:** Robinhood experienced a production incident where a single data ingestion Pod entered an infinite retry loop and consumed all memory on a node, triggering OOM kills of unrelated trading services. They subsequently enforced Kubernetes LimitRanges (cluster-level policy that sets default limits on all Pods) and required explicit resource requests/limits as a PR check — PRs without resource definitions are now blocked by CI.

---

## 12. Container Security Checklist

```bash
# 1. Scan image for vulnerabilities:
docker scout cves nginx:latest
trivy image nginx:latest

# 2. Read-only root filesystem:
docker run --read-only nginx
# Application writes to /tmp: --tmpfs /tmp

# 3. No new privileges:
docker run --security-opt=no-new-privileges nginx
# Prevents setuid binaries from gaining privileges

# 4. Drop all capabilities, add only needed:
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE nginx

# 5. Disable inter-container communication:
docker network create --driver bridge --opt com.docker.network.bridge.enable_icc=false mynet

# 6. Run as non-root in Dockerfile:
USER 10001
```

```yaml
# 7. Kubernetes Pod Security Standards:
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
```

> **📖 Real-World Example:** At Google, every internal container runs with `--cap-drop=ALL`, `--read-only`, `--security-opt=no-new-privileges`, and a custom seccomp profile. Combining all seven items in this checklist is the difference between a container escape becoming an "interesting log event" versus a full host compromise.

> 🌍 **Real-World:** Datadog's Agent container (installed on millions of hosts) must run with `CAP_SYS_PTRACE` and access to `/proc` to collect system metrics, but Datadog ships separate slim and full images — the slim agent uses only what is needed for container metrics without host-level capabilities. This security-by-default approach means that customers who don't need host-level metrics aren't exposed to the elevated privileges required for them.


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Docker / Containers)

| # | Concept | Why | Done |
|---|---------|-----|------|
| 1 | Namespaces vs cgroups | Isolation vs limits | [ ] |
| 2 | Image layers / union FS | Build size & caching | [ ] |
| 3 | PID 1 & signal handling | Graceful shutdown | [ ] |
| 4 | Multi-stage builds | Smaller, safer images | [ ] |
| 5 | Non-root + drop capabilities | Security baseline | [ ] |
| 6 | Healthchecks vs liveness/readiness | K8s interview crossover | [ ] |
| 7 | Networking: bridge/host/overlay | Service communication | [ ] |
| 8 | Volumes vs bind mounts | Data persistence | [ ] |
| 9 | Resource limits (CPU/mem) | Noisy neighbor | [ ] |
| 10 | Distroless / scratch images | Attack surface | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Containers are process isolation + resource limits — not VMs. Know what is shared with the host.

---

## 🛠️ PRACTICAL — Docker Labs

### Lab 1: Multi-stage Build
Write a Dockerfile for a Go or Java app: build stage + slim runtime. Compare image sizes.

### Lab 2: OOM Behavior
Run a container with `-m 128m` that allocates more. Observe kill. Explain how you'd set requests/limits in K8s.

### Lab 3: Security Checklist Drill
From memory, list 7 hardening flags (`--cap-drop`, read-only FS, etc.) and why each matters.
