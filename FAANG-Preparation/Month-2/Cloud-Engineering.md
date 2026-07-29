# Cloud Engineering — Complete Study Notes

---

## Table of Contents

- [PART 1: AWS CORE SERVICES](#part-1-aws-core-services)
  - [EC2 (Elastic Compute Cloud)](#ec2-elastic-compute-cloud)
    - [What it is / Basics](#1-what-it-is--basics)
    - [How it works internally](#2-how-it-works-internally)
    - [Instance Types — Full Breakdown](#3-instance-types--full-breakdown)
    - [Placement Groups](#4-placement-groups)
    - [AMI (Amazon Machine Image)](#5-ami-amazon-machine-image)
    - [User Data and cloud-init](#6-user-data-and-cloud-init)
    - [Auto Scaling Groups](#7-auto-scaling-groups)
    - [Edge Cases and Production Gotchas](#8-edge-cases-and-production-gotchas)
  - [VPC (Virtual Private Cloud)](#vpc-virtual-private-cloud)
    - [What it is / Basics](#1-what-it-is--basics-1)
    - [How it works internally](#2-how-it-works-internally-1)
    - [Subnet Types and Routing](#3-subnet-types-and-routing)
    - [Security Groups vs NACLs](#4-security-groups-vs-nacls)
    - [VPC Connectivity Options](#5-vpc-connectivity-options)
    - [Flow Logs](#6-flow-logs)
  - [Load Balancers (ELB)](#load-balancers-elb)
    - [What it is / Basics](#1-what-it-is--basics-2)
    - [ALB (Application Load Balancer) — Layer 7](#2-alb-application-load-balancer--layer-7)
    - [NLB (Network Load Balancer) — Layer 4](#3-nlb-network-load-balancer--layer-4)
    - [GWLB (Gateway Load Balancer) — Layer 3](#4-gwlb-gateway-load-balancer--layer-3)
    - [Edge Cases and Production Gotchas](#5-edge-cases-and-production-gotchas)
  - [S3 (Simple Storage Service)](#s3-simple-storage-service)
    - [What it is / Basics](#1-what-it-is--basics-3)
    - [How it works internally](#2-how-it-works-internally-2)
    - [Storage Classes](#3-storage-classes)
    - [Multipart Upload](#4-multipart-upload)
    - [Object Lifecycle Policies](#5-object-lifecycle-policies)
    - [Replication](#6-replication)
    - [Encryption](#7-encryption)
    - [Event Notifications and Integration](#8-event-notifications-and-integration)
    - [Presigned URLs](#9-presigned-urls)
    - [S3 Select and Athena](#10-s3-select-and-athena)
    - [Edge Cases and Production Gotchas](#11-edge-cases-and-production-gotchas)
  - [RDS and Aurora](#rds-and-aurora)
    - [RDS Multi-AZ](#1-rds-multi-az)
    - [RDS Read Replicas](#2-rds-read-replicas)
    - [Aurora Architecture](#3-aurora-architecture)
    - [RDS Proxy](#4-rds-proxy)
  - [IAM (Identity and Access Management)](#iam-identity-and-access-management)
    - [Policy Evaluation Logic](#1-policy-evaluation-logic)
    - [Key IAM Concepts](#2-key-iam-concepts)
    - [Credential Types and Rotation](#3-credential-types-and-rotation)
    - [Edge Cases and Production Gotchas](#4-edge-cases-and-production-gotchas)
  - [CloudWatch](#cloudwatch)
    - [Metrics](#1-metrics)
    - [Alarms](#2-alarms)
    - [Logs](#3-logs)
    - [Production Gotchas](#4-production-gotchas)
- [PART 2: ADVANCED AWS TOPICS](#part-2-advanced-aws-topics)
  - [Multi-Region Architecture](#multi-region-architecture)
    - [What it is / Basics](#1-what-it-is--basics-4)
    - [Patterns](#2-patterns)
    - [Route 53 Routing Policies](#3-route-53-routing-policies)
  - [Kubernetes on AWS (EKS)](#kubernetes-on-aws-eks)
    - [EKS Architecture](#1-eks-architecture)
    - [Networking — CNI](#2-networking--cni-container-network-interface)
    - [Storage — CSI](#3-storage--csi-container-storage-interface)
    - [HPA (Horizontal Pod Autoscaler)](#4-hpa-horizontal-pod-autoscaler)
    - [etcd — Deep Internals](#5-etcd--deep-internals)
  - [Service Mesh](#service-mesh)
    - [What it is / Basics](#1-what-it-is--basics-5)
    - [How it works internally](#2-how-it-works-internally-3)
    - [Production Gotchas for Service Mesh](#3-production-gotchas-for-service-mesh)
  - [Blue-Green and Canary Deployments](#blue-green-and-canary-deployments)
    - [Blue-Green](#1-blue-green)
    - [Canary](#2-canary)
  - [Disaster Recovery](#disaster-recovery)
    - [DR Strategies](#1-dr-strategies-in-order-of-cost-vs-rtorpo)
    - [RTO and RPO](#2-rto-and-rpo)
  - [Real-World AWS Usage](#real-world-aws-usage)

---

# PART 1: AWS CORE SERVICES

---

## EC2 (Elastic Compute Cloud)

### (1) What it is / Basics

**EC2** gives you a virtual machine on AWS hardware. You pick the OS (**AMI**), the hardware shape (**instance type**), the network (**VPC/subnet**), and attach storage (**EBS volumes**). The **hypervisor** (Nitro on modern instances, Xen on legacy) slices physical hardware into VMs and passes network/storage through dedicated hardware offload.

> **💡 Key Insight:** EC2 is a rent-by-the-second server. You decide its shape, but AWS owns the physical machine.

### (2) How it works internally

**Nitro Hypervisor**: AWS built its own hypervisor from scratch. Unlike Xen (which runs a privileged Domain-0 OS), Nitro offloads network and storage to dedicated Nitro cards (hardware). The hypervisor itself is stripped to near-zero — it has no device drivers, no OS, just the virtualization primitives. This means your instance gets almost all of the physical CPU; CPU steal is near zero on Nitro instances.

**Instance boot flow**:
1. AWS picks a physical host from your instance family pool.
2. Nitro card provisions an EBS volume backed by a remote NVMe-over-Fabric connection (for gp2/gp3).
3. UEFI/BIOS loads the AMI's kernel from EBS.
4. cloud-init runs user data on first boot.
5. IMDSv2 endpoint becomes available at `169.254.169.254` over a link-local route injected into the VPC routing table.

**T-class CPU Credits** (burstable instances):
- Each T-class instance has a CPU baseline (e.g., t3.micro = 10% of one vCPU).
- You earn credits when CPU is below baseline. You spend credits when CPU is above baseline.
- Credit earn rate: t3.micro earns 6 credits/hour. One credit = one vCPU at 100% for one minute.
- At steady state below baseline, you can accumulate up to 24 hours worth of credits.
- **T3 standard mode**: when credits are exhausted, CPU is throttled to baseline. **T3 unlimited**: CPU never throttled, but you pay per-vCPU-hour for burst above baseline (~$0.05/vCPU-hr). Unlimited is the default on t3/t3a; standard is default on t2.

> **⚠️ Production Gotcha:** A t3.micro running a noisy cron job can drain its entire credit bank overnight, then hit baseline (10% CPU) during the day at the worst possible time.

> 🌍 **Real-World:** Nitro's near-zero hypervisor overhead is why Amazon can offer "bare-metal" performance on virtualized instances — the 2019 announcement of `m5.metal` instances showed that Nitro VMs achieve 99%+ of bare-metal CPU performance. Airbnb runs their search indexing workloads on c6g (Graviton2) instances with Nitro, achieving 40% better price-performance than equivalent x86 instances for their compute-bound indexing tasks.

### (3) Instance Types — Full Breakdown

| Family | Optimized for | Examples | When to Use |
|--------|---------------|----------|-------------|
| M | General purpose, balanced | m7g, m6i, m5 | Web servers, app servers, small DBs |
| T | Burstable, low baseline | t3, t3a, t4g | Dev/test, low-traffic sites |
| C | Compute, high CPU:RAM ratio | c7g, c6i, c5n | Batch processing, ML inference, video encoding |
| R | Memory, high RAM:CPU ratio | r7g, r6i, r5 | In-memory DBs (Redis), analytics, SAP HANA |
| X | Extreme memory | x2gd, x1e | SAP HANA, large in-memory analytics |
| I | Storage, local NVMe SSDs | i4i, i3en | High IOPS databases, Cassandra, Kafka brokers |
| D | Dense storage, HDD | d3en | Data warehouses needing cheap high-capacity disk |
| P | GPU (NVIDIA A100/V100) | p4, p3 | ML training |
| G | GPU (NVIDIA T4, inference) | g5, g4dn | ML inference, GPU rendering |
| Inf | AWS Inferentia (custom ASIC) | inf2 | Low-cost, high-throughput ML inference |
| Trn | AWS Trainium | trn1 | Cost-effective ML training |

> **💡 Key Insight:** **Graviton (g suffix, e.g., m7g)**: ARM-based, AWS designed. 20-40% better price/performance than equivalent x86 for many workloads. Go, Java, Python, Node all run natively on ARM. The only blocker: x86-specific native extensions or Docker images without ARM manifests.

> 🌍 **Real-World:** Netflix migrated a large portion of their streaming infrastructure to Graviton3 (c7g) instances, reporting 40% cost reduction for their Java-based encoding workloads. Apple uses i3en instances (dense local NVMe) for Cassandra nodes in their iCloud infrastructure — local NVMe avoids the network round trip to EBS, giving Cassandra the sub-1ms write latency needed for real-time iCloud sync across 850M devices.

### (4) Placement Groups

**Cluster placement group**: All instances placed on hardware in the same rack or adjacent racks within an AZ. Gives 10 Gbps+ bandwidth between instances (vs. 5 Gbps standard) and single-digit microsecond latency. Used for: HPC, tightly coupled distributed computing. Tradeoff: single physical point of failure; if the rack loses power, all instances go down.

**Spread placement group**: Each instance on different underlying hardware. Max 7 instances per AZ per group. Used for: small sets of critical instances (Zookeeper, Kafka broker leaders) that must never fail simultaneously. Tradeoff: limited to 7, can't launch large fleets.

**Partition placement group**: Instances divided into logical partitions (up to 7 per AZ), each partition on different racks. Different partitions never share hardware. Used for: Cassandra, Hadoop, HDFS — systems that use partition-aware replication. You can query which partition each instance is in via instance metadata, and use that to configure your replication topology.

| Placement Group | Max Scale | Failure Domain | Best For |
|----------------|-----------|---------------|----------|
| Cluster | Unlimited | Single rack | HPC, low-latency compute |
| Spread | 7 per AZ | Per-instance hardware | Small sets of critical instances |
| Partition | 7 partitions per AZ | Per-partition rack | Distributed systems (Cassandra, Hadoop) |

> 🌍 **Real-World:** Financial services firms running high-frequency trading systems use cluster placement groups to get the 10 Gbps+ inter-instance bandwidth and microsecond latency needed for tick data processing. Databricks uses partition placement groups for their Spark cluster nodes — by knowing which rack each node is on (via partition metadata), Databricks configures HDFS replication to ensure data replicas span different racks, so a rack power failure never causes data loss.

### (5) AMI (Amazon Machine Image)

An **AMI** is a template for launching instances. It contains:
- One or more EBS snapshots (or S3-stored root device for instance-store)
- Launch permissions
- Block device mapping (which snapshot becomes which volume)

AMIs are region-specific. To use an AMI in another region, you copy it (AWS copies the underlying EBS snapshots). AMI IDs differ by region — hardcoding an AMI ID is a common bug when deploying multi-region.

**Creating custom AMIs**: Launch an instance, configure it, then `aws ec2 create-image`. AWS stops the instance (or takes a snapshot live, which may have in-flight writes), creates EBS snapshots, and registers the AMI.

**AMI sharing**: You can make AMIs public or share with specific AWS accounts. Public marketplace AMIs are scanned by AWS but still verify the source.

> 🌍 **Real-World:** HashiCorp Packer is the industry standard for building hardened AMIs in CI/CD pipelines — Netflix's Aminator tool (open-sourced) bakes application code directly into AMIs rather than pulling it at boot time, reducing instance startup time from minutes to seconds and ensuring that every launched instance is identical and tested. This "immutable infrastructure" pattern means a rollback is simply launching instances from the previous AMI version.

### (6) User Data and cloud-init

**User data** is a script (shell script or cloud-config YAML) that **cloud-init** runs on first boot. Default behavior: runs once on first launch only. To run on every boot: add `#cloud-config` with `runcmd` under the `bootcmd` directive (runs before cloud-init modules) or configure `/var/lib/cloud/instance/` state.

```bash
#!/bin/bash
# This runs once on first boot
yum update -y
amazon-linux-extras install docker -y
systemctl enable docker
systemctl start docker
```

Size limit: 16 KB. If you need more, download a script from S3 and execute it.

**IMDSv2**: The **Instance Metadata Service** at `169.254.169.254`. IMDSv1 allowed any process on the instance to query metadata via GET. SSRF attacks (like the Capital One breach) exploited this. IMDSv2 requires a PUT to get a token first, then use the token in subsequent requests. This prevents simple SSRF because the attacker's server can't follow the PUT → GET flow.

```bash
# IMDSv2 — required for new instances (you should enforce this in launch template)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

> **⚠️ Production Gotcha:** Enforce IMDSv2-only: `HttpTokens: required` in the launch template metadata options. Set at org level via SCP.

> 🌍 **Real-World:** The 2019 Capital One breach was caused by an SSRF vulnerability in a misconfigured WAF — an attacker sent a request that caused the WAF (running on EC2) to make a GET request to the IMDSv1 metadata endpoint, retrieving the instance's IAM role credentials. The attacker then used those credentials to exfiltrate 100M+ customer records from S3. IMDSv2's session-oriented token requirement prevents this exact attack pattern because SSRF exploits typically only follow GET redirects, not the required PUT token-request.

### (7) Auto Scaling Groups

**Launch template** (preferred over launch configuration, which is deprecated): specifies AMI, instance type, security groups, user data, IAM instance profile, key pair.

**Scaling policies**:
- **Target tracking**: "Keep average CPU at 60%." AWS automatically adjusts fleet size. Simplest and most reliable for most use cases.
- **Step scaling**: "If CPU > 70% add 2 instances; if CPU > 90% add 5 instances." Gives you control but more complex to tune.
- **Scheduled scaling**: Predictive — "At 8am Monday add 10 instances." Use for known traffic patterns.
- **Predictive scaling**: ML-based, analyzes historical data, provisions capacity before demand hits.

**Cooldown period**: After a scale-out event, the ASG waits (default 300s) before evaluating another scale event. Prevents thrashing (scale out → metric drops → scale in → metric spikes → repeat).

**Lifecycle hooks**: Pause instance before it enters or leaves service. On launch: pull config, run tests, register with service discovery. On terminate: deregister, drain connections, flush logs. Hook timeout: 1 hour default, can heartbeat to extend.

**Warm pools**: Pre-initialized instances sitting in Stopped state. When the ASG needs to scale out, it starts a warm instance (seconds) instead of launching a new one (minutes). Reduces cold-start latency for scale events.

> 🌍 **Real-World:** Shopify uses ASG target tracking during Black Friday to automatically scale their checkout fleet to 20× normal capacity — they configure target CPU at 60% to leave headroom for traffic spikes. Warm pools are critical: without pre-warmed instances, a sudden 10× traffic spike takes 5–8 minutes for new EC2 instances to boot, configure, and become healthy, causing a brief but costly degradation during the most revenue-critical window of the year.

### (8) Edge Cases and Production Gotchas

**Capacity issues**: Large instance types (p4, x1e) are in limited supply. Spot instances can be interrupted with 2-minute warning. **On-Demand Capacity Reservations** guarantee capacity but cost money even when unused. **Savings Plans** and **Reserved Instances** provide discounts (1-3 year terms).

**Instance store (ephemeral storage)**: Some instance types (i3, c5d) include local NVMe disks. Data is LOST when the instance stops or terminates. Only persists through reboots. Never store durable data here — use for cache, temp files, Kafka data if you have replication.

**EBS-optimized**: Network bandwidth dedicated to EBS I/O. Most modern instances are EBS-optimized by default. **gp3** volumes give 3000 IOPS baseline at no extra cost; gp2 baseline = 3 IOPS/GB (minimum 100 IOPS).

**Network performance**: Each instance type has a maximum network bandwidth. A c5.large has up to 10 Gbps; a c5.18xlarge has up to 25 Gbps. However, the 10/25 Gbps is burstable — baseline is lower. For sustained high network throughput: use instances with "up to X Gbps" carefully, test sustained throughput.

**Hibernation**: EC2 hibernate saves RAM contents to EBS, allowing fast resume. Limitations: RAM must fit in root EBS volume, instance must be EBS-backed, not available for all instance types. Root volume must be encrypted.

---

## VPC (Virtual Private Cloud)

### (1) What it is / Basics

A **VPC** is your isolated virtual network within AWS. You own the CIDR range, subnets, routing tables, and security rules. AWS provides the underlying network fabric (hardware) but you control all the logical constructs.

> **💡 Key Insight:** A VPC is like renting a floor in a data center. You lay out your own room dividers (subnets), install your own locks (security groups/NACLs), and punch holes to the outside world (internet gateway, NAT).

### (2) How it works internally

**The AWS network fabric**: Underneath, AWS runs a custom network hypervisor (part of Nitro). Traffic between instances in the same VPC is encapsulated (VXLAN or a proprietary protocol) at the Nitro card level. When a packet leaves an EC2 instance, the Nitro card adds headers identifying the source VPC + subnet + security group, routes it through the AWS backbone, and the destination Nitro card strips the headers before delivering. This is why:
- Security group rules are enforced at the Nitro card (hardware), not in software on the instance.
- VPC peering traffic never leaves the AWS backbone (no internet transit).
- Jumbo frames (9001 MTU) are supported within VPCs, which matters for network-intensive workloads.

**CIDR blocks**: AWS reserves 5 IPs per subnet:
- `.0`: Network address
- `.1`: VPC router
- `.2`: DNS server (always at VPC CIDR + 2)
- `.3`: Reserved for future use
- `.255`: Broadcast (not used, but reserved)

So a `/24` gives you 256 - 5 = 251 usable IPs. A `/16` gives 65,536 - 5 = 65,531 (though AWS reserves more at the subnet level).

> 🌍 **Real-World:** AWS's Nitro-enforced security groups are a significant security advantage over traditional firewalls — because rules are enforced in hardware at the Nitro card, a compromised instance cannot bypass its own security group rules (they are enforced before packets even reach the hypervisor). Netflix's VPC design uses security groups as the primary segmentation mechanism: their streaming API servers have security groups that only allow inbound traffic from their load balancers, and their databases only accept traffic from the application tier's security group ID.

### (3) Subnet Types and Routing

**Public subnet**: Has a route `0.0.0.0/0 → igw-xxxxxxxx` in its route table AND the instances have public IPs (or Elastic IPs). **Internet Gateway (IGW)** performs NAT for the public IP. The instance itself only sees its private IP; the IGW maintains a 1-to-1 NAT mapping.

**Private subnet**: No route to IGW. Route `0.0.0.0/0 → nat-xxxxxxxx` (**NAT Gateway** in a public subnet). NAT Gateway has an Elastic IP; it does many-to-one NAT. Instances can reach the internet (to pull packages, call APIs), but the internet cannot initiate connections to them.

**NAT Gateway vs NAT Instance**:

| | NAT Gateway | NAT Instance |
|---|---|---|
| Managed | Yes (AWS) | No (you manage EC2) |
| Bandwidth | Up to 100 Gbps | Instance type dependent |
| HA | Per-AZ, deploy one per AZ | Single point of failure unless you add logic |
| Cost | $0.045/hr + $0.045/GB | EC2 + data transfer |
| Use case | Production | Cost optimization (small workloads) |

> **📖 Real-World Example:** Deploy one NAT Gateway per AZ. Route each AZ's private subnets to the NAT in the same AZ. This avoids cross-AZ data transfer charges ($0.01/GB) and eliminates cross-AZ failure dependency.

> 🌍 **Real-World:** Stripe's infrastructure runs all application servers in private subnets with no public IPs — only their load balancers are in public subnets. Their application servers reach external payment networks (card networks, banks) via NAT Gateways. This architecture ensures that even if an application server is compromised, the attacker cannot receive inbound internet connections directly, significantly limiting lateral movement and data exfiltration paths.

### (4) Security Groups vs NACLs

**Security Groups** (stateful):
- Applied at the **ENI** (network interface) level — per instance, per Lambda function, per EFS mount target.
- **Stateful**: if you allow inbound port 443, the return traffic is automatically allowed. You never need to write an outbound rule for responses.
- Default: all inbound denied, all outbound allowed.
- Rules are "allow only" — no deny rules. To block traffic, you must not have an allow rule.
- Can reference other security groups as source/destination (very powerful for microservice segmentation).
- Changes apply immediately to all associated instances.

**NACLs** (stateless):
- Applied at the **subnet level** — all instances in the subnet are subject to it.
- **Stateless**: you must write explicit inbound AND outbound rules. If you allow inbound port 443, you must also allow outbound ephemeral ports (1024-65535) for the response.
- Rules evaluated in ascending order (rule 100 before 110). First match wins. There's an implicit `DENY *` at the end.
- Can have explicit DENY rules (use this to block specific IPs at subnet level).
- Takes 10-30 seconds for changes to propagate.

| | Security Groups | NACLs |
|---|---|---|
| Level | ENI (per-instance) | Subnet (all instances) |
| Statefulness | Stateful | Stateless |
| Rule types | Allow only | Allow + explicit Deny |
| Evaluation | All rules evaluated | First match wins (numeric order) |
| Propagation | Immediate | 10-30 seconds |

**When to use NACLs**: They are an extra layer, not a replacement for security groups. Use NACLs for:
- Blocking known bad IP ranges at the subnet level.
- Compliance requirements that mandate subnet-level controls.
- Broad network segmentation between tiers.

> 🌍 **Real-World:** Financial institutions on AWS use NACLs to implement PCI DSS network segmentation requirements — the cardholder data environment (CDE) subnet has NACLs that explicitly deny all traffic except from the specific payment processing application subnets, providing a subnet-level firewall that satisfies PCI DSS Requirement 1 (install and maintain a network security configuration). Security groups then provide the fine-grained per-instance rules within that boundary.

### (5) VPC Connectivity Options

**VPC Peering**:
- Direct private connection between two VPCs (same or different accounts/regions).
- **Non-transitive**: if VPC A peers with B, and B peers with C, A cannot reach C through B. You need A-C peering too.
- No bandwidth limit, no gateway, traffic stays on AWS backbone.
- Use case: simple 2-VPC connectivity. Gets messy with many VPCs (n*(n-1)/2 peerings).

**Transit Gateway (TGW)**:
- Regional router that connects VPCs and on-premises networks in a hub-and-spoke topology.
- **Transitive routing**: all attached VPCs can talk to each other through the TGW (if routing tables allow).
- Route tables per attachment: you can segment traffic (e.g., prod VPCs cannot reach dev VPCs).
- Supports: VPC attachments, VPN attachments, Direct Connect Gateway attachments.
- Cost: $0.05/hr per attachment + $0.02/GB data processed.
- Multi-region: TGW Inter-Region Peering connects TGWs across regions.

> 🌍 **Real-World:** Large enterprises with hundreds of AWS accounts use Transit Gateway as their central network hub — a company with 200 VPCs across 20 AWS accounts would need 200×199/2 = 19,900 VPC peering connections for full mesh connectivity, which is unmanageable. TGW reduces this to one attachment per VPC (200 attachments), with route tables controlling which VPCs can communicate. AWS's own Landing Zone Accelerator solution uses TGW as the backbone for multi-account network architectures.

**VPC Endpoints**:
- Private connection from your VPC to AWS services without going through the internet.
- **Gateway Endpoint** (free): S3 and DynamoDB only. Modifies route table — adds a route to the S3/DynamoDB prefix list. Traffic never leaves the AWS network but doesn't use a private IP in your VPC.
- **Interface Endpoint** (PrivateLink, ~$0.01/hr + $0.01/GB): Creates an ENI in your subnet with a private IP. DNS resolves the service name to this private IP. Works for most AWS services, your own services, and partner services. Supports security groups on the endpoint ENI.

> **⚠️ Production Gotcha:** When you create a VPC Interface Endpoint for a service like SQS, you need to enable "Private DNS" to override the public DNS name. But if you do this in a shared VPC or across accounts, DNS resolution behavior changes. Test DNS behavior explicitly.

> 🌍 **Real-World:** Datadog and Cloudflare use AWS PrivateLink to deliver their SaaS agents inside customer VPCs — instead of a customer's EC2 instances sending telemetry data over the public internet (which exposes it to inspection and adds latency), the Datadog agent sends data to a VPC Interface Endpoint that terminates inside AWS's network and forwards to Datadog's infrastructure privately. This is now the standard pattern for "SaaS in your VPC" integrations.

**Direct Connect**: Dedicated physical fiber from your data center to an AWS Direct Connect location. Provides consistent latency and throughput (unlike VPN which goes over the internet). 1 Gbps or 10 Gbps dedicated connections, or hosted connections (50 Mbps to 10 Gbps through Direct Connect partners). Direct Connect alone does NOT provide redundancy — use two Direct Connects or Direct Connect + VPN for HA.

**VPN (AWS Site-to-Site)**: IPSec tunnel over the internet. Two tunnels per connection for HA (terminate in different AZs). 1.25 Gbps max per tunnel.

### (6) Flow Logs

**VPC Flow Logs** capture IP traffic metadata at VPC, subnet, or ENI level. Records: source IP, destination IP, source port, destination port, protocol, packets, bytes, start/end time, action (ACCEPT/REJECT), log-status.

Does NOT capture: DNS queries, DHCP traffic, instance metadata traffic (`169.254.x.x`), Amazon Windows license activation.

Flow logs can go to CloudWatch Logs, S3, or Kinesis Data Firehose. Cost: standard CloudWatch ingestion/storage rates apply.

> **📖 Real-World Example:** Production use: security incident investigation, traffic baselining, compliance auditing. The data volume can be massive in busy VPCs — filter at the flow log level (not all traffic) if cost is a concern.

> 🌍 **Real-World:** Capital One (post-breach) invested heavily in VPC Flow Log analysis — they now route all flow logs to their SIEM via Kinesis Firehose, enabling real-time detection of unusual data transfer patterns (e.g., a single EC2 instance transferring gigabytes of data to an external IP at 2am). Cloudflare uses Flow Logs for capacity planning: by analyzing traffic patterns between their VPC subnets over weeks, they identify which cross-AZ data transfers are generating the most cost and restructure traffic routing to minimize inter-AZ charges.

---

## Load Balancers (ELB)

### (1) What it is / Basics

**AWS Elastic Load Balancing** is a managed service that distributes traffic across targets (EC2 instances, containers, Lambda functions, IP addresses). It automatically scales to handle traffic and performs health checks to stop routing to unhealthy targets.

### (2) ALB (Application Load Balancer) — Layer 7

**How it works**: **ALB** terminates TCP and TLS. It reads the HTTP headers, URL, query parameters, and request body (for gRPC). It makes routing decisions based on rules. Then it opens a new TCP connection to the target.

> **⚠️ Production Gotcha:** Because ALB opens a new connection to the target, the target sees the ALB's IP as the source. The original client IP is in `X-Forwarded-For` header. Source IP-based routing doesn't work natively — you need sticky sessions or session tokens.

**Listener rules** (evaluated in priority order):
- Forward (to a target group)
- Redirect (301/302)
- Fixed response (return static response)
- Authenticate (Cognito or OIDC — ALB can handle auth itself)

**Routing conditions**:
- Path: `/api/*` → backend-api target group, `/static/*` → S3/CDN
- Host header: `api.example.com` → api targets, `admin.example.com` → admin targets
- HTTP method: GET, POST, etc.
- Query string: `?version=2` routes to v2 target group
- HTTP header: custom headers, user-agent
- Source IP CIDR

**Target groups**: Collection of targets with a health check config. Can have EC2 instances, ECS tasks, Lambda functions, or IP addresses (for on-prem/peered VPC). Weight-based routing between multiple target groups enables canary deployments at the LB level.

**Sticky sessions**: ALB generates a cookie (`AWSALB`) that encodes which target the request was routed to. Subsequent requests with this cookie go to the same target for the duration (configurable, up to 7 days). Application-based stickiness uses your own cookie. Stickiness breaks even distribution — one target can get overloaded.

**Connection draining (deregistration delay)**: When you remove a target (or a health check fails), ALB stops sending new requests but waits up to 300s (configurable) for in-flight requests to complete. Critical for zero-downtime deployments.

**WebSocket and HTTP/2**: ALB natively supports WebSocket — the initial HTTP upgrade is handled, and the connection becomes a persistent WebSocket connection. ALB also speaks HTTP/2 to clients but downgrades to HTTP/1.1 to targets (targets don't need HTTP/2 support). gRPC is supported (gRPC uses HTTP/2).

**Access logs**: ALB can log every request to S3. Contains: client IP, request time, request line, response code, bytes, user-agent, SSL cipher, target processing time. Useful for traffic analysis and debugging.

> 🌍 **Real-World:** Canary deployments at Pinterest use ALB weighted target groups — 5% of traffic is directed to the "canary" target group running the new version, while 95% goes to the stable version. Pinterest monitors error rates and latency on both target groups in real time; if the canary shows elevated errors, they shift weights back to 0%/100% within seconds without any DNS change or deployment. This allows them to validate changes against real production traffic on a small user slice before full rollout.

### (3) NLB (Network Load Balancer) — Layer 4

**How it works**: **NLB** operates at TCP/UDP/TLS level. It does NOT terminate TCP — it passes the TCP connection through to the target. This means the target can see the original source IP natively (no `X-Forwarded-For` needed). NLB routes packets, not requests — a WebSocket or long-lived TCP connection stays on the same target for its lifetime.

**Static IPs**: Each NLB has a static IP per AZ (or you assign Elastic IPs). This is critical for on-premises systems that have firewall whitelist rules — you can give them the fixed IPs. ALBs don't have static IPs (their IPs change as they scale).

**Performance**: NLB can handle millions of requests per second. Sub-millisecond latency. It runs on specialized networking hardware, not general-purpose EC2. AWS claims NLB adds ~100 microseconds of latency (vs ALB adding ~1ms+).

**Use cases**: Gaming (real-time, latency-sensitive), IoT, VoIP, any protocol that isn't HTTP, internal microservice communication where you want pass-through behavior.

**Health checks**: TCP (can the target accept a TCP connection?), HTTP/HTTPS (does the target return 200?), or application-specific (TLS handshake). NLB health checks are faster (shorter intervals) than ALB.

| | ALB (Layer 7) | NLB (Layer 4) |
|---|---|---|
| Protocol | HTTP, HTTPS, gRPC, WebSocket | TCP, UDP, TLS |
| Source IP | `X-Forwarded-For` header | Native pass-through |
| Static IPs | No | Yes (per AZ) |
| Latency | ~1ms+ | ~100 microseconds |
| Routing logic | Path, host, header, query string | Port/IP only |
| Use case | Web apps, APIs | Gaming, IoT, VoIP, any non-HTTP protocol |

> 🌍 **Real-World:** Riot Games (League of Legends) uses NLB for their game server traffic — game clients maintain UDP connections to game servers, and NLB's sub-100-microsecond latency and UDP support are critical for real-time game state synchronization. NLB's static Elastic IPs allow Riot to publish fixed IP addresses to their game clients, which is necessary because game clients pre-validate server IPs for security before connecting.

### (4) GWLB (Gateway Load Balancer) — Layer 3

**GWLB** is purpose-built for inserting third-party virtual appliances (firewalls, IDS/IPS, deep packet inspection) into traffic flow transparently. Uses **GENEVE encapsulation** to send packets to appliances and receive them back. The appliances process packets and send them back; GWLB then forwards them. Traffic appears to originate from the original source (transparent inline inspection).

### (5) Edge Cases and Production Gotchas

**Idle timeout**: ALB has a default 60-second idle timeout. If your application uses long-polling or streaming, the connection will be dropped at 60s. Configure the ALB idle timeout to match your application's needs (up to 4000s). Also configure your web server and load balancer keep-alive to match.

**Health check misconfiguration**: If your health check path returns 200 only when the database is healthy, a DB outage will deregister all targets and take down your service.

> **📖 Real-World Example:** Use `/health/live` (always 200 if process is running) for load balancer checks, and `/health/ready` (checks dependencies) for orchestrators.

**DNS TTL and scale events**: ALB's DNS TTL is 60 seconds. When ALB scales out (adds new IPs), old DNS responses may not include new IPs. Ensure your clients respect the TTL and re-resolve. Hard-coded IPs break at scale events.

**Cross-zone load balancing**: By default, ALB distributes evenly across all registered targets in all enabled AZs (cross-zone is on). NLB cross-zone is disabled by default — traffic from a client in AZ-a goes only to targets in AZ-a. If you have uneven target distribution across AZs, NLB without cross-zone creates imbalance.

**Slow start mode**: New targets can overwhelm quickly. ALB slow start mode gradually ramps up traffic to a new target over 30-900 seconds. Useful for JVM apps that need JIT warmup.

> 🌍 **Real-World:** Slack uses ALB slow start mode for their JVM-based backend services — a newly launched Scala service instance needs 2–3 minutes of JIT compilation warmup before it can handle full production traffic without elevated p99 latency. With slow start configured at 120 seconds, new instances receive a small fraction of traffic initially, allowing the JVM to compile hot paths before bearing the full request load, preventing the "cold start spike" that previously caused elevated error rates during deployments.

---

## S3 (Simple Storage Service)

### (1) What it is / Basics

**S3** is AWS's object storage. An **object** = a key + value (data) + metadata. Flat namespace — there are no real directories, only key prefixes that look like paths. A **bucket** is the top-level container; object keys are globally unique within a bucket.

> **💡 Key Insight:** S3 is a giant hash map in the cloud. The key is your path-like string; the value is up to 5 TB of bytes. Everything else (versioning, lifecycle, access control) is metadata around this.

### (2) How it works internally

S3 is one of AWS's oldest services and is backed by custom distributed storage infrastructure. Internally:
- Data is stored in chunks across multiple storage nodes in multiple AZs.
- The **11 nines** (99.999999999%) durability is achieved by replicating data to multiple physical locations and running continuous data integrity checks (MD5 + CRC checksums, background scrubbing).
- Metadata (bucket configuration, object metadata, access controls) is stored in a separate metadata service backed by DynamoDB-like infrastructure.
- The S3 request path: your request hits an S3 front-end layer → metadata lookup to find storage nodes → data assembled and returned.

**Strong consistency (since December 2020)**: Before Dec 2020, S3 was eventually consistent for overwrites and deletes — you might read stale data after an update. Now S3 guarantees strong read-after-write consistency for all GET, PUT, DELETE, LIST operations. How: S3's metadata layer implements a distributed consensus protocol. The old "eventual consistency" was a limitation of the metadata caching layer that has been replaced.

**Request rate scaling**: S3 automatically scales to handle high request rates. Historically, prefix randomization was needed to distribute load (because S3 partitioned hot prefixes). AWS removed this limit in 2018 — S3 now supports at least 3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per prefix with no tuning. Effective parallelism: use multiple prefixes for extreme throughput.

> 🌍 **Real-World:** Netflix stores all video content on S3 — their Open Connect CDN appliances pull content from S3 origin buckets and cache it at ISP locations globally. Netflix's S3 usage is one of the largest in existence; they use multiple key prefixes per content type to distribute load across S3's internal partitioning, achieving the millions of GET requests per second needed to simultaneously serve 230M subscribers streaming video.

### (3) Storage Classes

| Class | Min Duration | Retrieval Time | Retrieval Cost | Use Case |
|-------|-------------|----------------|----------------|----------|
| Standard | None | Immediate | None | Frequently accessed data |
| Standard-IA | 30 days | Immediate | Per GB | Monthly backups, DR files |
| One Zone-IA | 30 days | Immediate | Per GB | Reproducible data, lower cost |
| Glacier Instant Retrieval | 90 days | Milliseconds | Per GB | Archive accessed once/quarter |
| Glacier Flexible | 90 days | 1 min to 12 hr | Per GB | Compliance archives |
| Glacier Deep Archive | 180 days | 12-48 hr | Per GB | Long-term regulatory archive |
| Intelligent-Tiering | None | Immediate (frequent) | Monitoring fee/object | Unknown or changing access patterns |

**Intelligent-Tiering internals**: Monitors access patterns per object. After 30 days without access, moves to infrequent tier. After 90 days, optionally to archive instant tier. After 180 days, to deep archive tier. Access moves objects back to frequent tier immediately.

> **⚠️ Production Gotcha:** Monitoring cost: $0.0025 per 1,000 objects — not worth it for small objects (below ~128 KB the monitoring fee exceeds storage savings).

> 🌍 **Real-World:** Airbnb stores all user-uploaded listing photos in S3 Standard for the first 30 days (when they receive the most traffic) and then transitions via lifecycle policy to Standard-IA — because 80% of photo views happen within the first 30 days of listing, and IA is 40% cheaper for infrequently accessed data. Dropbox migrated from S3 Standard to a custom storage backend (Magic Pocket) after growing to exabyte scale, citing S3's storage cost as their largest infrastructure expense and building their own erasure-coded storage system to reduce costs by 2×.

### (4) Multipart Upload

Required for objects > 5 GB. Recommended for > 100 MB (parallel upload, network error recovery).

Process:
1. `CreateMultipartUpload` → get upload ID
2. `UploadPart` (parts 1-10,000, each 5MB-5GB, last part can be smaller)
3. `CompleteMultipartUpload` with the list of ETags
4. S3 assembles parts server-side

Benefits: parallel upload (upload 10 parts simultaneously), network resilience (retry individual failed parts), large file support.

> **⚠️ Production Gotcha:** **Incomplete multipart uploads**: If your process dies after step 2, the parts stay in S3 and you're charged for them but the object never appears. Set a lifecycle rule to delete incomplete multipart uploads after N days. This is a common hidden cost issue.

> 🌍 **Real-World:** Video hosting platforms like Wistia and Vimeo use S3 multipart upload with parallelism for user video uploads — a 4 GB video is split into 40 parts of 100 MB each, uploaded in parallel across 10 threads, reducing upload time from 40 minutes (sequential) to 4 minutes (parallel). Each part can be retried independently on failure, making large video uploads resilient to network interruptions that would otherwise require restarting the entire upload.

### (5) Object Lifecycle Policies

Automatically transition objects between storage classes or expire them.

```json
{
  "Rules": [{
    "ID": "archive-old-logs",
    "Filter": { "Prefix": "logs/" },
    "Status": "Enabled",
    "Transitions": [
      { "Days": 30, "StorageClass": "STANDARD_IA" },
      { "Days": 90, "StorageClass": "GLACIER" }
    ],
    "Expiration": { "Days": 365 }
  }]
}
```

> 🌍 **Real-World:** Datadog uses S3 lifecycle policies to manage their metrics retention tiers — raw 1-second metrics are kept in S3 Standard for 15 months, then transitioned to Glacier for 24 months for compliance, then expired. This automated tiering saves millions of dollars annually versus keeping all raw metrics in Standard storage, while meeting their contractual data retention commitments to customers.

### (6) Replication

**Cross-Region Replication (CRR)**: Asynchronously replicate objects to a bucket in a different region. Requires versioning on both buckets. Use cases: disaster recovery, compliance (data must be in specific regions), reduce read latency by serving from region close to users.

**Same-Region Replication (SRR)**: Replicate within the same region. Use cases: aggregate logs from multiple source buckets, live replication between production and test environments, maintain a copy in a separate AWS account for security.

**Replication is not retroactive**: Only new objects created after replication is configured are replicated. Existing objects must be copied separately (use S3 Batch Operations).

**Replication time control (RTC)**: SLA that 99.99% of objects are replicated within 15 minutes. Adds cost. Without RTC, replication is best-effort (usually seconds to minutes, but no SLA).

> 🌍 **Real-World:** Financial services firms regulated under MiFID II use S3 CRR to maintain trade records in both an EU and a UK region post-Brexit, satisfying data residency requirements in both jurisdictions. Slack uses SRR to replicate workspace data from their primary S3 bucket to a separate security-isolated account — the replicated copy has a bucket policy that allows read-only access only to their forensics team, providing an immutable audit copy that cannot be deleted by a compromised production credential.

### (7) Encryption

**SSE-S3 (AES-256)**: AWS manages keys. Transparent — no user action needed. Lowest operational overhead.

**SSE-KMS**: Uses **AWS KMS** (Key Management Service). Each object encryption/decryption call makes an API call to KMS, which creates an audit trail in CloudTrail. **Customer Managed Keys (CMKs)** allow key rotation, key policy control, and cross-account access. Higher cost ($0.03 per 10,000 KMS API calls). High-throughput S3 workloads can hit KMS throttle limits (10,000 RPS default, can be increased).

**SSE-C**: You provide the encryption key in the request headers. AWS uses it to encrypt/decrypt and does NOT store the key. If you lose the key, you lose the data. More operational complexity, rarely needed (use SSE-KMS instead).

**Client-side encryption**: You encrypt before uploading, decrypt after downloading. AWS never sees the plaintext. Use AWS Encryption SDK or S3 client-side encryption library.

| Encryption Type | Key Management | Audit Trail | Operational Overhead |
|----------------|---------------|-------------|----------------------|
| SSE-S3 | AWS-managed | No | Lowest |
| SSE-KMS | AWS KMS / CMK | Yes (CloudTrail) | Medium |
| SSE-C | You provide per-request | No | High |
| Client-side | You manage entirely | No | Highest |

> 🌍 **Real-World:** Healthcare companies storing PHI (Protected Health Information) on S3 use SSE-KMS with Customer Managed Keys to satisfy HIPAA requirements — every S3 GET/PUT for PHI data generates a CloudTrail audit event showing which IAM principal accessed which KMS key. When a data breach investigation occurs, security teams query CloudTrail to reconstruct exactly which records were accessed and by whom. SSE-KMS also allows instant "crypto-shredding": deleting the KMS key renders all encrypted data permanently unreadable without physically deleting terabytes of S3 objects.

### (8) Event Notifications and Integration

S3 can trigger events on:
- `s3:ObjectCreated:*` (Put, Post, Copy, CompleteMultipartUpload)
- `s3:ObjectRemoved:*`
- `s3:ObjectRestore:*` (Glacier restore)
- `s3:Replication:*`

Destinations: Lambda, SNS topic, SQS queue, **EventBridge** (recommended for flexibility — EventBridge lets you route events to many destinations with filtering).

> **💡 Key Insight:** **EventBridge vs direct notification**: EventBridge adds slight latency (~seconds) but allows complex routing, multiple targets, archiving events, replaying events, cross-account delivery.

> 🌍 **Real-World:** Airbnb uses S3 event notifications to trigger their image processing pipeline — when a host uploads a listing photo (PUT to S3), the event fires a Lambda function that generates multiple thumbnail sizes (320px, 640px, 1280px), runs content moderation via AWS Rekognition, and writes the processed images back to S3. The entire process completes within 2–3 seconds of the original upload, entirely serverless, scaling automatically from 1 upload/min to 1,000 uploads/min without any infrastructure management.

### (9) Presigned URLs

**Presigned URLs** allow temporary, time-limited access to a specific object without requiring AWS credentials. The URL is signed with the requester's credentials (IAM user or role) and includes an expiry.

```python
import boto3

s3 = boto3.client('s3')
url = s3.generate_presigned_url(
    'get_object',
    Params={'Bucket': 'my-bucket', 'Key': 'private/file.pdf'},
    ExpiresIn=3600  # 1 hour
)
```

Use for: secure file download links (sent via email), upload from browser directly to S3 (bypassing your server, use `put_object` operation), sharing private objects with third parties.

**Presigned URL with POST (S3 presigned POST)**: More powerful for browser uploads — allows setting conditions (max file size, allowed content types, key prefix). Returns a form with hidden fields and action URL.

> 🌍 **Real-World:** Dropbox Paper and Notion use S3 presigned PUT URLs for file attachments — when you drag a file into a Notion page, the client requests a presigned PUT URL from Notion's API, then uploads the file directly from the browser to S3, bypassing Notion's servers entirely. This eliminates Notion's egress costs for file uploads and means upload speed is limited only by the user's internet connection and S3's ingestion rate, not Notion's application server bandwidth.

### (10) S3 Select and Athena

**S3 Select**: Run SQL on a single S3 object (CSV, JSON, Parquet). AWS scans and filters server-side, returning only matching data. Reduces bytes transferred. Performance: up to 400% improvement for queries that select a small subset. Limited to simple WHERE/SELECT, no JOINs.

**Athena**: Serverless SQL engine that queries S3 at scale. Presto-based. Schema-on-read: define schema (columns, types) over existing S3 files. Supports CSV, JSON, ORC, Avro, Parquet. Charges per data scanned ($5/TB). Key optimization: use Parquet/ORC (columnar, compressed) + partitioning (`year=/month=/day=` prefixes) to dramatically reduce data scanned.

> 🌍 **Real-World:** Cloudflare uses Athena to query their petabyte-scale CDN access logs stored in S3 as Parquet — a query over a full day's logs (hundreds of billions of rows) scans only the relevant Parquet column files rather than the entire row data, reducing scan from terabytes to gigabytes. Netflix uses Athena for ad-hoc analysis of their A/B test results stored in S3, letting data scientists run arbitrary SQL without provisioning any cluster infrastructure and paying only for the data scanned per query.

### (11) Edge Cases and Production Gotchas

**Eventual consistency for bucket operations**: While object operations are strongly consistent, bucket-level operations (creating/deleting buckets, changing bucket policies) are eventually consistent. After creating a bucket, there may be a brief delay before the bucket is accessible globally.

**List API performance**: `ListObjectsV2` returns up to 1,000 objects per call. For buckets with millions of objects, listing is slow and expensive. Design with known key patterns — use metadata DBs if you need fast listing/search.

**S3 object lock (WORM)**: **Write Once, Read Many**. **Compliance mode**: cannot be deleted or overwritten even by root account, for a retention period. **Governance mode**: can be overridden by users with special permissions. Used for regulatory compliance (SEC Rule 17a-4), ransomware protection.

**Byte-range fetches**: You can fetch partial objects with `Range: bytes=0-1023`. Useful for large files where you need only a header or specific section. Also used by multipart download logic.

---

## RDS and Aurora

### (1) RDS Multi-AZ

**How it works**: RDS provisions a standby replica in a different AZ. Writes to the primary are synchronously replicated to the standby using the database's native replication (or a shared storage layer, depending on the engine). "Synchronous" means the write acknowledgment to your application only happens after both the primary and standby have committed the write.

Implications:
- Write latency is higher than single-AZ (cross-AZ round trip adds ~1ms).
- The standby is NOT readable (it's there only for HA). Exception: MariaDB Multi-AZ can have a readable standby with a separate feature.
- **Automatic failover** takes 60-120 seconds: RDS detects failure, promotes standby, updates DNS CNAME to point to new primary. Your application must reconnect (connection pooling with retry handles this).
- Failover is triggered by: instance failure, AZ failure, OS patching (planned failover), or manual failover (testing).

> 🌍 **Real-World:** Stripe runs RDS Multi-AZ for their core payment processing PostgreSQL databases — the ~1ms latency overhead for synchronous standby replication is acceptable given that a hardware failure without Multi-AZ would cause data loss and 60–120 seconds of unavailability during manual failover. When AWS performs maintenance on the underlying EC2 host, RDS triggers an automatic planned failover to the standby, and Stripe's connection pool (PgBouncer) transparently reconnects within the ~10ms DNS propagation window, making the maintenance invisible to their payment APIs.

### (2) RDS Read Replicas

**Asynchronous replication**. The primary writes to a transaction log (binlog for MySQL, WAL for PostgreSQL). The replica streams and applies these changes. **Replication lag**: typically < 1 second on lightly loaded systems, but can grow to seconds or minutes under heavy write load.

**Read replicas are readable**: Route read-heavy queries here. Reduces load on primary.

**Promoting a replica**: You can promote a replica to a standalone DB (breaks replication). Useful for database migrations, creating a separate dev environment from production data.

**Cross-region read replicas**: Can create a replica in another region. Combines disaster recovery with read scaling. If primary region fails, you can promote the cross-region replica (RTO: minutes, some data loss based on lag = RPO).

**Multi-AZ vs Read Replica**:

| | Multi-AZ | Read Replica |
|---|---|---|
| Primary purpose | High Availability | Read scaling + optional DR |
| Readable | No (standby not readable) | Yes |
| Replication | Synchronous | Asynchronous |
| Failover | Automatic | Manual promotion |

> **💡 Key Insight:** Combine them: Multi-AZ primary + Read Replicas on top = both HA and read scaling.

> 🌍 **Real-World:** GitHub uses RDS read replicas to handle the enormous read load from their web frontend — when millions of developers browse repositories, those reads hit replicas rather than the primary. Their primary RDS instance handles only writes (push events, issue creation, PR merges), while 5–6 read replicas serve the bulk of the read traffic. GitHub monitors replication lag and routes reads to the primary when lag exceeds 100ms to maintain read-your-writes consistency for the repository owner immediately after a push.

### (3) Aurora Architecture

**Aurora** is fundamentally different from standard RDS. The compute (the DB engine process) is separated from storage.

**Aurora storage layer**:
- 6 copies of data across 3 AZs (2 copies per AZ).
- Storage is a distributed, log-structured system with quorum writes.
- **Write quorum**: 4 out of 6 nodes must acknowledge. This means: Aurora can survive losing 1 full AZ + 1 additional node and still serve writes.
- **Read quorum**: 3 out of 6. Can lose 2 entire AZs and still read.
- Storage auto-scales in 10 GB increments up to 128 TB.

> **💡 Key Insight:** **Why Aurora writes are fast despite multi-AZ replication**: Standard RDS syncs the full data page to the standby. Aurora only syncs the write-ahead log (4x less data). The storage nodes apply the log and reconstruct pages. Less data to transfer → lower write latency than standard Multi-AZ.

**Aurora replicas**: Up to 15 read replicas per Aurora cluster. All share the same storage layer — there is no data copy for replicas. Each replica is essentially just another DB engine reading from the same underlying storage. Replication lag: typically < 10 ms (sub-second guaranteed in practice).

**Aurora Global Database**:
- One primary region + up to 5 secondary regions.
- Storage-level replication: WAL segments replicated via dedicated replication infrastructure.
- Lag: typically < 1 second (physically limited by speed of light across regions).
- **RPO**: < 1 second. **RTO**: < 1 minute (promote secondary to primary).
- Secondary regions: read-only. Useful for: disaster recovery, low-latency reads for global users.

**Aurora Serverless v2**:
- Scales from 0.5 ACU (**Aurora Capacity Units**) to 128 ACU in fine-grained increments (0.5 ACU steps).
- 1 ACU ≈ 2 GB RAM + proportional CPU.
- Scales in seconds (not minutes like Serverless v1).
- No connection limit per se (Aurora Serverless manages this internally), but connection handling via RDS Proxy is still recommended.
- Best for: variable workloads, dev/test, applications with unpredictable spikes.

> 🌍 **Real-World:** Samsung uses Aurora Global Database for their Samsung Account service (authentication for 500M+ devices) — their primary Aurora cluster is in us-east-1, with read replicas in ap-northeast-1 (Korea) and eu-west-1 (Europe). Korean users authenticating on their Samsung phones get sub-5ms reads from the Seoul replica rather than 200ms+ to the US primary, dramatically improving login speed. The Global Database's < 1 second cross-region lag means user profile updates propagate to all regions within seconds.

### (4) RDS Proxy

**Problem it solves**: Database connections are expensive — each PostgreSQL connection uses ~5-10 MB RAM and a process/thread. Lambda functions can create thousands of connections simultaneously during a spike, overwhelming the database. **RDS Proxy** is a connection pooler that sits between your app and the DB.

**How it works**: RDS Proxy maintains a pool of persistent connections to the DB engine. Application connections go to the Proxy; the Proxy multiplexes them onto the smaller pool of DB connections. The Proxy handles authentication (supports IAM authentication and Secrets Manager rotation without requiring app restarts).

**Modes**:
- **Transaction pooling** (default): a DB connection is held only for the duration of a transaction, then returned to the pool. This gives high multiplexing but doesn't work for applications that use session-level features (temp tables, advisory locks, `pg_advisory_lock`).
- **Session pooling**: each application connection maps to one DB connection for its lifetime.

**Failover**: RDS Proxy is highly available and maintains connections through DB failover events, reducing the failover time for applications (proxy re-routes connections to the new primary, apps don't need to reconnect).

> 🌍 **Real-World:** Serverless architectures with AWS Lambda famously struggle with the "Lambda + RDS" connection explosion problem — a Lambda function handling 10,000 concurrent requests would try to open 10,000 database connections, crashing PostgreSQL's default 100-connection limit instantly. RDS Proxy solves this: Lambda functions connect to the proxy, which multiplexes all 10,000 Lambda connections onto 20 actual database connections, reducing PostgreSQL memory usage from 100 GB (10,000 × 10 MB/connection) to 200 MB. Stripe uses RDS Proxy for their Lambda-based async processing pipelines for exactly this reason.

---

## IAM

> ⭐ **IMPORTANT CONCEPT:** In IAM, an explicit Deny always wins — design least privilege and never rely on Allow overlapping a Deny.

 (Identity and Access Management)

### (1) Policy Evaluation Logic

When AWS evaluates whether to allow a request, it checks in this order:

1. **Explicit Deny**: If any policy (SCP, resource-based, identity-based, permission boundary) has a Deny for the action, request is denied. Period.
2. **Organizational SCP**: If there's an SCP that doesn't allow the action, request is denied (even if identity policy allows it).
3. **Resource-based policy**: If there's a resource-based policy (S3 bucket policy, Lambda resource policy) that explicitly allows the principal, access is granted (cross-account: both identity and resource policy needed; same account: either is sufficient).
4. **Identity-based policy**: Does the IAM user/role have an allow?
5. **Permission boundary**: If set, is the action within the boundary?
6. **Session policy**: If using assumed roles with session policies, is the action allowed?
7. **Implicit deny**: If none of the above explicitly allowed, request is denied.

> **💡 Key Insight:** An explicit Deny always wins. There is no "Deny override" — if any policy denies, that's final regardless of other allow policies.

> 🌍 **Real-World:** Financial institutions use the "explicit deny wins" behavior for break-glass scenarios — a central security SCP denies `s3:DeleteBucket` across all accounts in the organization. Even if a rogue administrator creates an IAM policy granting themselves `s3:*`, the SCP-level deny cannot be overridden, preventing catastrophic data deletion. This "guardrail" pattern is the foundation of AWS Control Tower's preventive controls.

### (2) Key IAM Concepts

**Policies**: JSON documents with Effect (Allow/Deny), Action (service:Operation), Resource (ARN), Condition.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject"
    ],
    "Resource": "arn:aws:s3:::my-bucket/*",
    "Condition": {
      "StringEquals": { "aws:RequestedRegion": "us-east-1" },
      "Bool": { "aws:SecureTransport": "true" }
    }
  }]
}
```

**SCPs (Service Control Policies)**: Applied at the AWS Organizations level to accounts or OUs. They are guardrails — they restrict the maximum permissions that any IAM entity in the account can have. SCPs don't grant permissions; they only restrict. Even the root account is subject to SCPs (except for billing and a few account-level operations).

Example SCP to prevent disabling CloudTrail:

```json
{
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "cloudtrail:StopLogging",
      "cloudtrail:DeleteTrail"
    ],
    "Resource": "*"
  }]
}
```

**Permission Boundaries**: An advanced feature that sets the maximum permissions an IAM entity (user or role) can have. Used by central security teams to let developers create roles, but constrain what those roles can do. Example: dev team can create roles, but those roles can never have `iam:*` or `s3:DeleteBucket` even if the developer tries to grant it.

**IRSA (IAM Roles for Service Accounts)**:
- Problem: Kubernetes pods need AWS access. Old solution: assign IAM role to EC2 node → all pods on that node share credentials.
- IRSA: Kubernetes service accounts annotated with an IAM role ARN. EKS configures **OIDC federation**. When a pod needs AWS credentials, it calls the AWS STS endpoint with a signed JWT from Kubernetes. STS validates the JWT against the OIDC provider and returns temporary credentials scoped to the specific pod's service account.
- Result: pod-level IAM credentials. A compromised pod can only access what its service account's role allows.

> 🌍 **Real-World:** Airbnb uses IRSA extensively in their EKS clusters — their search indexing pods have an IAM role that allows only `s3:GetObject` on the search data bucket, while their image resizing pods have a separate role allowing `s3:PutObject` on the thumbnail bucket. Before IRSA, all pods on a node shared the node's EC2 instance profile, meaning a compromised search pod could access the same S3 buckets as the payment processing pods — a significant blast radius reduction.

### (3) Credential Types and Rotation

**Long-term credentials (access key ID + secret)**: Avoid for humans. If you must use them (legacy systems), rotate every 90 days, enable MFA, restrict by source IP in policy conditions.

**Temporary credentials via STS (AssumeRole)**: Standard for applications. Max duration: 12 hours for AssumeRole, 36 hours for roles with a longer session policy. These rotate automatically.

**Instance profiles**: IAM roles attached to EC2 instances. The AWS SDK automatically fetches and refreshes temporary credentials from the metadata service.

> **⚠️ Production Gotcha:** Never hard-code credentials in your application when running on AWS — use instance profiles (EC2), ECS task roles, or Lambda execution roles.

> 🌍 **Real-World:** HashiCorp Vault is used by many enterprises to centralize secrets management and automatically rotate IAM access keys — Vault requests a new AWS IAM access key on each checkout (TTL: 1 hour), ensuring that leaked credentials expire within hours rather than persisting for months. Netflix uses a similar approach with their internal "Lemur" certificate manager: all AWS credentials used by Netflix services are short-lived STS tokens refreshed every 15 minutes, so even a credential exfiltration event has a narrow exploitation window.

### (4) Edge Cases and Production Gotchas

**Cross-account resource access**: Two approaches:
1. **Resource-based policy**: attach a policy to the S3 bucket/Lambda/SQS allowing the other account's principal. Single-step, no role assumption needed.
2. **Role assumption**: Account A creates a role that Account B's IAM entities can assume via `sts:AssumeRole`. The role's trust policy lists Account B as a trusted principal.

For most services: use resource-based policies for simplicity. For EC2, ECS, Lambda (services that don't support resource-based policies for cross-account execution), use role assumption.

**IAM condition keys for extra security**:
- `aws:PrincipalOrgID`: restrict access to only principals in your AWS Organization (protects against confused deputy attacks in resource policies).
- `aws:SourceIp`: restrict API calls to specific IP ranges.
- `aws:MultiFactorAuthPresent`: require MFA for sensitive operations.
- `aws:RequestedRegion`: restrict to specific regions.

**IAM Access Analyzer**: Finds resource policies that allow external access (outside your account or org). Generates access previews. Validates policies syntactically and semantically. Use in CI/CD pipeline to prevent accidentally public S3 buckets or overly permissive resource policies.

> 🌍 **Real-World:** Expedia uses IAM Access Analyzer in their CI/CD pipeline — every infrastructure-as-code (Terraform) pull request that modifies S3 bucket policies or IAM roles triggers an Access Analyzer scan, and any policy that would create external access outside their AWS Organization automatically fails the PR check. This prevented an incident where an engineer accidentally made a logging bucket public while testing, catching the misconfiguration before it reached production.

---

## CloudWatch

### (1) Metrics

**Default metrics**: AWS services emit metrics automatically. EC2: CPUUtilization, NetworkIn/Out, DiskReadOps. Default resolution: 5 minutes. **Detailed monitoring** (extra cost): 1-minute resolution for EC2.

**Custom metrics**: Your application emits metrics via `PutMetricData` API. Resolution options: 1-second (high resolution), 10-second, 30-second, 1-minute. High-resolution metrics cost more but enable faster alarm evaluation.

**EMF (Embedded Metric Format)**: Log a specially structured JSON object to stdout/CloudWatch Logs. CloudWatch parses it and creates metrics automatically. Zero extra API calls, same cost as log ingestion (much cheaper than `PutMetricData` at scale).

```json
{
  "_aws": {
    "Timestamp": 1621900000000,
    "CloudWatchMetrics": [{
      "Namespace": "MyApp",
      "Dimensions": [["ServiceName", "Environment"]],
      "Metrics": [{"Name": "ProcessingTime", "Unit": "Milliseconds"}]
    }]
  },
  "ServiceName": "order-service",
  "Environment": "prod",
  "ProcessingTime": 123.4
}
```

**Metric math**: Combine metrics with expressions (sum, average, percentile, rate). Example: calculate error rate = errors/requests * 100 without storing a separate metric.

> 🌍 **Real-World:** Lyft uses CloudWatch custom metrics with EMF for their ride matching service — each time a ride is matched (or fails to match), the Lambda function logs a structured JSON with matching latency, driver-rider distance, and outcome. CloudWatch automatically extracts these as metrics, allowing Lyft's on-call engineers to monitor p99 matching latency in real time and get paged when it exceeds SLA thresholds, all without running any separate metrics infrastructure.

### (2) Alarms

**Threshold alarm**: ALARM when metric > 90% for 3 consecutive 5-minute periods.

**Anomaly detection alarm**: Uses ML to establish a band of "normal" values (auto-adjusts for time-of-day, day-of-week patterns). ALARM when value falls outside the band. Great for irregular workloads.

**Composite alarms**: Combine multiple alarms with AND/OR. Example: ALARM only if (CPU is high AND memory is high). Reduces false positives.

**Alarm states**: OK, ALARM, INSUFFICIENT_DATA. Alarm actions: SNS notification, EC2 action (stop/start/reboot), Auto Scaling, Systems Manager OpsCenter.

**Alarm evaluation**: An alarm needs N consecutive data points in ALARM state before transitioning. This introduces intentional delay to avoid flapping on transient spikes. Set this based on your SLA requirements.

> 🌍 **Real-World:** Amazon uses composite CloudWatch alarms for their order processing pipeline — a single "OrderProcessingDegraded" alarm fires only when BOTH the SQS queue depth AND the Lambda error rate are elevated. Without composite alarms, the queue depth alarm would page on-call engineers every time a deployment caused a brief Lambda cold start spike (false positive). The composite alarm reduces on-call fatigue by ~70% by requiring both signals simultaneously before paging.

### (3) Logs

**Log groups and streams**: A **log group** (e.g., `/aws/lambda/my-function`) contains **log streams**. Each Lambda invocation writes to a separate stream. Retention: configurable from 1 day to 10 years (default: never expires = pay forever).

> **⚠️ Production Gotcha:** Always set a retention policy on every log group — the default "never expire" means you pay for logs indefinitely.

**Logs Insights**: Query language for log analysis. Can query multiple log groups simultaneously. Supports parsing, filtering, aggregation, time-series visualization.

```text
fields @timestamp, @message
| filter @message like /ERROR/
| parse @message "user=* action=*" as user, action
| stats count() by action
| sort count desc
| limit 20
```

**Subscriptions**: Stream log data in real-time to Lambda, Kinesis Firehose, or Kinesis Data Streams for processing and forwarding (to Elasticsearch, Splunk, etc.).

> 🌍 **Real-World:** Twilio uses CloudWatch Logs Insights for real-time incident investigation — when their SMS delivery service shows elevated error rates, on-call engineers run Logs Insights queries across 50+ Lambda log groups simultaneously to find which carrier endpoints are returning errors, reducing mean time to identify (MTTI) from 20 minutes (manually grepping logs) to under 2 minutes. Splunk (ironically) uses CloudWatch Subscriptions to ingest their own AWS Lambda logs into their SIEM for security monitoring, streaming log data via Kinesis Firehose with sub-minute latency.

### (4) Production Gotchas

**CloudWatch costs**: Log ingestion ($0.50/GB), storage ($0.03/GB/month), Logs Insights queries ($0.005/GB scanned). Verbose logging in high-traffic services can generate massive costs. Filter logs at the agent level (CloudWatch Agent, Fluent Bit) or use log levels aggressively.

**Metric cardinality**: Each unique combination of dimension values creates a separate metric (time series). With 1000 users × 50 APIs = 50,000 metrics. Each metric: $0.30/month. At scale, keep dimension cardinality low. Use X-Ray or distributed tracing (not CloudWatch) for per-request details.

> 🌍 **Real-World:** A startup running on AWS discovered their CloudWatch bill was $40,000/month because each of their 500,000 users had a user-ID dimension on API latency metrics — creating 500,000 × 10 APIs = 5M CloudWatch metric time series at $0.30/each = $1.5M/month. The fix: aggregate by user cohort (free tier, paid tier, enterprise) rather than individual user ID, reducing metrics from 5M to 30 and the CloudWatch bill to under $100/month. Always design metric dimensions for aggregation, not individual identity.

---

# PART 2: ADVANCED AWS TOPICS

---

## Multi-Region Architecture

### (1) What it is / Basics

**Multi-region** means deploying your application in more than one AWS region simultaneously. The motivation is typically one or more of: disaster recovery (survive full region failure), reduced latency for global users, data residency compliance, or regulatory requirements.

### (2) Patterns

**Active-Passive**:
- Primary region handles all traffic.
- Secondary region has all infrastructure deployed but idle (or running at minimum scale).
- Route 53 health check monitors the primary endpoint. If it fails, Route 53 fails over to secondary.
- **RTO** (Recovery Time Objective): 1-5 minutes (Route 53 health check interval + TTL propagation).
- **RPO** (Recovery Point Objective): depends on replication lag to secondary.
- Cost: ~2x infrastructure (secondary sits mostly idle). Can reduce cost by running secondary at lower scale (scale up during failover).

**Active-Active**:
- All regions handle traffic simultaneously.
- Route 53 latency-based routing (or geolocation) directs users to the nearest region.
- No wasted capacity — all regions are useful.
- The hard part: handling writes. With two active regions, a user's writes in region A must be visible to reads in region B (and vice versa). Options:
  - **Write to home region only** (route writes to primary, reads from any): still active-active for reads.
  - **DynamoDB Global Tables**: truly active-active, any region can write. Last-writer-wins on conflicts (based on timestamp, which requires clock synchronization). For most use cases, this is acceptable if your update semantics are idempotent or conflicts are rare.
  - **Conflict avoidance by design**: partition users to regions (user ID hash → region). User always goes to their home region for writes.

**Data Replication Options**:

| Service | Mechanism | Lag | RPO | Notes |
|---------|-----------|-----|-----|-------|
| DynamoDB Global Tables | Active-active, async | < 1s typically | Seconds | LWW conflicts |
| Aurora Global | Primary → secondary, storage-level | < 1s | < 1s | Secondary is read-only |
| S3 CRR with RTC | Async, SLA: 99.99% in 15 min | Minutes typically | 15 min with RTC | Only new objects |
| RDS cross-region replica | Async WAL | Seconds-minutes | Seconds-minutes | Manual promotion |

> 🌍 **Real-World:** Netflix runs active-active across three AWS regions (us-east-1, eu-west-1, ap-northeast-1) — European viewers are routed to eu-west-1 by Route 53 latency-based routing, Asian viewers to ap-northeast-1, and Americas to us-east-1. If us-east-1 has an outage, Route 53 health checks detect it within 30 seconds and shift all traffic to the other two regions. Netflix's Chaos Engineering practice includes randomly failing entire AWS regions in production (during business hours) to ensure their multi-region failover actually works.

### (3) Route 53 Routing Policies

- **Simple**: One IP. No health checks.
- **Weighted**: Split traffic by percentage. 90/10 for canary deployments across regions.
- **Latency-based**: Route to the region with lowest latency for the user's IP (AWS measures latency from regions to user IP prefixes). Not geographic — uses measured latency.
- **Geolocation**: Route by geographic location of user (country, continent, US state). Guarantees data residency — users in EU always go to EU region.
- **Geoproximity (Traffic Flow only)**: Like geolocation but with bias — you can shift the boundary, sending more or less traffic to a region.
- **Failover**: Primary + secondary. Health check on primary. Fails over to secondary when primary is unhealthy.
- **Multi-value answer**: Returns up to 8 healthy records. Client-side load balancing. Not a replacement for LB but adds health check filtering.

**Health checks**: Can check HTTP/HTTPS endpoints, TCP endpoints, or other CloudWatch alarms. Checks come from multiple AWS health checker locations globally. Minimum 18 health checkers by default.

> **⚠️ Production Gotcha:** Your origin must be accessible from all Route 53 health checker IPs (or use CloudWatch alarm-based health check which checks from within your account).

> 🌍 **Real-World:** Twilio uses Route 53 Geolocation routing to satisfy data residency requirements — EU customers' call metadata is routed exclusively to Twilio's eu-west-1 deployment, ensuring it never transits or is processed in the US, satisfying GDPR data localization requirements. Spotify uses latency-based routing for their audio streaming API — a user in Stockholm gets routed to eu-west-1 (Stockholm region) regardless of their geographic country, because latency measurement accounts for actual internet routing, not just geographic proximity.

---

## Kubernetes on AWS (EKS)

### (1) EKS Architecture

**EKS** manages the Kubernetes **control plane** (API server, etcd, controller manager, scheduler). AWS runs these on managed infrastructure across multiple AZs. You run **worker nodes** (EC2 instances or Fargate) in your VPC.

**Control plane components**:
- **API server**: receives kubectl commands and API calls. Validates and processes requests. Stateless — can be scaled horizontally.
- **etcd**: distributed key-value store. Stores all cluster state. The source of truth. Writes require Raft consensus. EKS backs this on dedicated instances with regular automated backups.
- **kube-scheduler**: assigns pods to nodes. Considers: node capacity, node selector, affinity/anti-affinity, taints/tolerations, resource requests.
- **kube-controller-manager**: runs control loops (node controller, replication controller, endpoints controller, etc.). Each controller watches desired state in etcd and reconciles actual state.

**Worker node components**:
- **kubelet**: node agent. Watches pod specs from API server. Starts/stops containers via container runtime. Reports node and pod status.
- **kube-proxy**: maintains network rules (iptables or ipvs) for pod-to-service communication. In EKS with VPC-CNI, kube-proxy handles Service IP routing.
- **Container runtime**: containerd (default in modern EKS). Previously Docker (which wrapped containerd). Kubernetes removed Docker support in 1.24.

> 🌍 **Real-World:** Airbnb runs one of the largest EKS deployments in existence — over 1,000 microservices across thousands of EC2 nodes. They use EKS's managed node groups to automatically handle Kubernetes version upgrades and OS patches by rolling nodes one AZ at a time, maintaining service availability during maintenance. When Airbnb had a production incident where their kube-scheduler was overloaded (too many pending pods), they mitigated it by horizontally scaling the scheduler — possible because EKS exposes the control plane configuration for advanced users.

### (2) Networking — CNI (Container Network Interface)

**AWS VPC CNI (amazon-vpc-cni-k8s)**: Each pod gets a real VPC IP address (not an overlay network IP). This is unusual — most CNI plugins (Calico, Flannel, Cilium) use overlay networks (VXLAN/IP-in-IP).

**How VPC CNI works**:
- The CNI plugin pre-allocates ENIs (Elastic Network Interfaces) on each node and "warms" them with IP addresses.
- When a pod starts, an IP from the pre-allocated pool is assigned.
- Pod traffic goes directly to the VPC network fabric — no encapsulation overhead.
- Pods are routable from anywhere in the VPC (including on-premises via Direct Connect).

> **⚠️ Production Gotcha:** **Tradeoff of VPC CNI**: You need enough IPs in your subnets. A large node (m5.xlarge) can have up to 15 ENIs × 15 IPs = 225 pod IPs. A /24 subnet with 251 usable IPs running 3 such nodes → you can run maybe 75 pods per node before IP exhaustion. Use /19 or larger subnets for EKS, or enable **prefix delegation** (assigns /28 prefixes to ENIs instead of individual IPs — 16x more IPs per ENI).

**Cilium**: Alternative CNI. Uses **eBPF** (extended Berkeley Packet Filter) in Linux kernel to implement network policies and service routing, bypassing iptables. Benefits: higher performance (iptables is O(n) rules; eBPF is O(1) hash table lookup), better observability (Hubble). Increasingly adopted for large clusters.

> 🌍 **Real-World:** Datadog migrated their EKS clusters from the VPC CNI to Cilium — at 5,000+ pods per cluster, iptables-based kube-proxy was generating 30,000+ iptables rules and taking 45 seconds to update after a pod change. Cilium's eBPF implementation handles the same routing with O(1) hash table lookups, reducing rule update time from 45 seconds to under 1 second and improving pod-to-pod bandwidth by 15%.

### (3) Storage — CSI (Container Storage Interface)

**CSI** is the standard interface between Kubernetes and storage providers. AWS CSI drivers:

**EBS CSI Driver**: Provisions EBS volumes as PersistentVolumes. Dynamic provisioning: create a PVC, the driver creates an EBS volume and attaches it to the node. EBS volumes are AZ-specific — a pod using an EBS PV can only run in the AZ where the volume lives. For stateful workloads: use node affinity to pin pods to the correct AZ, or use EFS.

**EFS CSI Driver**: AWS EFS is a managed NFS. Multiple pods (across nodes, across AZs) can mount the same EFS filesystem simultaneously. Useful for shared storage (ML model artifacts, CMS content). Higher latency than EBS (~1ms vs ~0.1ms). Throughput scales with storage size (provisioned throughput mode) or bursts based on credit system (Bursting mode).

| | EBS CSI | EFS CSI |
|---|---|---|
| Type | Block storage (NVMe) | Network file system (NFS) |
| Sharing | Single pod/node | Multiple pods across AZs |
| Latency | ~0.1ms | ~1ms |
| AZ constraint | AZ-specific | Cross-AZ |
| Best for | Databases, stateful apps | Shared content, ML artifacts |

> 🌍 **Real-World:** Shopify uses EFS CSI for their machine learning model serving on EKS — a trained recommendation model (10–50 GB) is written to EFS once by the training job, then mounted read-only simultaneously by dozens of model serving pods across all AZs. Without EFS, they would need to copy the model to EBS volumes in each AZ separately, adding 10–30 minutes to model deployment time. EFS's shared mount allows the new model to be available to all serving pods within seconds of the training job completing.

### (4) HPA (Horizontal Pod Autoscaler)

**How it works**:
1. Metrics server collects CPU/memory from each node's kubelet.
2. HPA controller queries Metrics API every 15 seconds.
3. HPA calculates desired replica count: `desiredReplicas = ceil(currentReplicas × (currentMetricValue / desiredMetricValue))`.
4. HPA scales deployment/statefulset to desired replicas.

**Scale-up vs scale-down delay**: HPA scales up quickly (within one evaluation period). Scale-down is delayed (5 minutes by default) to prevent thrashing — a spike shouldn't cause scale-up then immediate scale-down.

**Custom metrics HPA**: Scale on business metrics (queue depth, request latency, custom application metrics). Requires:
1. Emit custom metrics to CloudWatch or Prometheus.
2. Deploy an adapter (CloudWatch adapter, Prometheus adapter, KEDA).
3. HPA uses the custom metric via the External Metrics API.

**KEDA (Kubernetes Event-Driven Autoscaling)**: Extends HPA with scalers for specific event sources (SQS queue depth, Kafka consumer lag, Cron, HTTP request rate). Can scale deployments to zero (not possible with native HPA — minimum is 1 unless combined with VPA or custom logic).

> 🌍 **Real-World:** Zalando (European e-commerce) uses KEDA with Kafka consumer lag as the scaling metric for their order processing pods on EKS — when Black Friday traffic causes the order Kafka topic to accumulate 500,000+ unprocessed messages, KEDA scales their order processor from 5 pods to 200 pods within 2 minutes, draining the lag. After traffic subsides, pods scale back to 5 over 10 minutes. This event-driven scaling is far more responsive than CPU-based HPA, which would only scale after processors were already at 100% CPU.

### (5) etcd — Deep Internals

**etcd** uses the **Raft consensus algorithm**:
- Leader elected among etcd nodes.
- All writes go to the leader.
- Leader appends to its log, sends to followers.
- Write acknowledged to client only after majority of nodes have written (quorum = n/2 + 1).
- For 3-node etcd: quorum = 2. Can survive 1 node failure.
- For 5-node etcd: quorum = 3. Can survive 2 node failures.

> **⚠️ Production Gotcha:** **etcd is the bottleneck for large clusters**: Every Kubernetes object write goes through etcd. At ~5,000 nodes, etcd write latency becomes a limiting factor. Solutions: partition etcd (separate etcd clusters for different data — API server can be configured for this), use larger etcd instances (nvme-backed for low write latency), tune compaction.

**etcd compaction and defragmentation**: etcd uses **MVCC** — every write creates a new version. Old versions accumulate. Compaction removes old versions; defragmentation reclaims disk space. EKS handles this automatically. For self-managed etcd: configure `--auto-compaction-mode` and `--auto-compaction-retention`.

> 🌍 **Real-World:** Cloudflare's internal Kubernetes clusters at 5,000+ nodes hit etcd write latency issues — every pod creation, deletion, and status update generates an etcd write, and at that scale etcd was handling 10,000+ writes/second with p99 latency exceeding 100ms. Their solution was splitting etcd into separate clusters per resource type: one etcd cluster for pod/node state (high write rate), another for secrets/configmaps (low write rate), reducing write contention by 60% and bringing p99 below 20ms.

---

## Service Mesh

### (1) What it is / Basics

A **service mesh** is an infrastructure layer that handles service-to-service communication in a microservices architecture. Instead of each service implementing retry logic, circuit breaking, mTLS, and distributed tracing, the mesh handles all of this transparently.

> **💡 Key Insight:** Imagine every service in your cluster has a security guard (the sidecar proxy) that intercepts all traffic in and out. The security guard handles authentication (mTLS), enforces access policies, reports on traffic (observability), and follows the retry/circuit-breaker rules (traffic management). Your service code talks to "localhost" — it doesn't know the sidecar is there.

### (2) How it works internally

**Data plane**: **Sidecar proxies** (typically Envoy) injected into every pod as an additional container. Init containers modify iptables rules to redirect all pod traffic through the sidecar. The application thinks it's talking directly to other services; actually, all traffic goes through sidecar → network → sidecar.

**Control plane (Istio/istiod)**:
- Pushes configuration to all sidecars via **xDS** (discovery service) protocol.
- Issues certificates for mTLS (acts as an internal certificate authority using **SPIFFE/SVID**).
- Aggregates telemetry.

**mTLS**: Every service has a certificate (SPIFFE identity: `spiffe://cluster/ns/default/sa/order-service`). When service A calls service B: both sides present their certificates, verify the other's identity. Even if an attacker gets onto your cluster network, they can't impersonate a service (no certificate). Key rotation is automatic (hourly by default in Istio).

**Traffic management**: Istio VirtualService and DestinationRule resources configure routing. Example: send 10% of traffic to v2 of a service, 90% to v1. Header-based routing: requests with `x-canary: true` go to the canary. Fault injection: inject 5% random failures to test resilience.

> 🌍 **Real-World:** Lyft built Envoy (the proxy used by Istio's data plane) to solve their own service mesh problems — before Envoy, each Lyft microservice implemented its own retry, circuit breaking, and timeout logic in multiple languages (Python, Go, Java), leading to inconsistent resilience behavior. Envoy standardized all of this in a sidecar, making every service automatically resilient. Today, Envoy handles over 2 million requests per second across Lyft's infrastructure.

### (3) Production Gotchas for Service Mesh

> **⚠️ Production Gotcha:** **CPU and memory overhead**: Each Envoy sidecar consumes ~50-100 MB RAM and ~10% of a CPU core at moderate load. In a cluster with 1000 pods: 100 GB extra RAM + 100 CPU cores overhead just for sidecars. Not trivial. Consider **ambient mesh** (Istio's new mode that removes per-pod sidecars in favor of node-level proxies).

**Debugging complexity**: Traffic goes through two extra hops (client sidecar, server sidecar). If something fails, is it the app, the sidecar, or the network? Requires understanding Envoy configuration, Istio resources, and distributed tracing.

**Service mesh is overkill if**: You have < 20 services, you already implement mTLS at the application level, or you don't need fine-grained traffic control. Start without a mesh; add it when the pain points appear.

> 🌍 **Real-World:** Airbnb adopted Istio for their 300+ microservice EKS deployment — the main driver was mTLS enforcement. Before Istio, any compromised pod on the cluster could make requests to any other service using plain HTTP, providing no authentication between services. With Istio, every service-to-service call requires a valid SPIFFE certificate, and network policies enforce that only authorized services can connect. Airbnb reports that Istio's mTLS reduced their blast radius from "any pod can talk to any service" to "only explicitly authorized service-to-service paths."

---

## Blue-Green and Canary Deployments

### (1) Blue-Green

Two identical environments: **Blue** (current production) and **Green** (new version).

**Process**:
1. Deploy new version to Green environment (same size as Blue).
2. Run smoke tests against Green.
3. Switch traffic (DNS, load balancer, or feature flag) from Blue → Green instantly.
4. Monitor metrics. If problems detected, switch back to Blue (seconds).
5. After confidence: deprovision Blue.

**Where to switch**:
- Route 53 weighted routing (weighted: Blue=0, Green=100)
- ALB target group weights (switch in one update)
- ECS deployment controller (built-in blue/green via CodeDeploy)

**Cost**: You temporarily run 2x the infrastructure. For large fleets this is expensive. Justify it: the risk mitigation of instant rollback is worth the cost for critical releases.

**Database migrations**: The hard part. Green deploys with schema changes. If Blue and Green have incompatible schemas, switching back (Blue) breaks Green's DB state. Strategy: **expand-contract migrations** (additive changes first, then remove old columns after Blue is deprovisioned).

> 🌍 **Real-World:** Amazon itself uses blue-green deployments for AWS service updates — when AWS Lambda gets a new runtime version, they deploy it to the Green environment, run automated canary tests, then shift Route 53 weighted routing from Blue to Green over several hours, monitoring error rates at each step. If any Lambda region shows elevated errors during the shift, they immediately weight back to Blue and investigate. This is how AWS achieves "near-zero downtime" service updates across millions of customer functions.

### (2) Canary

Gradually shift traffic from old version to new.

**Process**: 1% → 5% → 10% → 25% → 50% → 100%, with monitoring between each step.

**Metrics for auto-rollback**: Error rate (5xx %). Latency P99. Business metrics (conversion rate, checkout success). Rollback trigger: if error rate on canary > 2x production baseline, auto-rollback. Tools: **AWS CodeDeploy** (alarms-based rollback), **Argo Rollouts** (sophisticated canary with metrics analysis).

**Feature flags (LaunchDarkly, Unleash, AWS AppConfig)**: Decouple deployment from release. Code is deployed to 100% of fleet; feature is enabled for 1% of users (by user ID, country, account tier). Benefits: instant kill switch (toggle off), A/B testing without redeployment, dark launching (deploy then gradually enable).

| | Blue-Green | Canary |
|---|---|---|
| Traffic switch | Instant (all-or-nothing) | Gradual (1% → 100%) |
| Rollback speed | Instant | Gradual reversal |
| Infrastructure cost | 2x temporarily | Minimal extra |
| Risk exposure | Minimal (tested before switch) | Limited (small % of users) |
| Best for | Critical releases needing instant rollback | Validating with real traffic progressively |

> 🌍 **Real-World:** Facebook (Meta) ships code to production multiple times per day using a "push" system that implements canary deployments — a code change first hits 0.1% of users (internal employees), then 1%, then 10%, then 50%, then 100%, with automated rollback if error rates exceed thresholds at any stage. Feature flags (using their internal "Gatekeeper" system) allow Facebook to deploy code to 100% of servers but enable features for only specific user cohorts, separating deployment risk from release risk and enabling instant kill-switch without a code rollback.

---

## Disaster Recovery

### (1) DR Strategies (in order of cost vs RTO/RPO)

**Backup and Restore**:
- Cheapest. RPO: hours. RTO: hours.
- Regular backups to S3/Glacier. In a disaster: restore backups to a new environment.
- Appropriate for non-critical, low-traffic internal tools.

**Pilot Light**:
- Core systems running at minimal scale in DR region (database replication running).
- In disaster: scale up compute (launch EC2 from AMI, scale ECS tasks), point traffic to DR.
- RPO: minutes. RTO: 10s of minutes.

**Warm Standby**:
- Full stack running in DR region at reduced scale (maybe 20% capacity).
- In disaster: scale up, redirect traffic.
- RPO: seconds. RTO: minutes.

**Active-Active**:
- Full traffic in both regions simultaneously.
- RPO: ~0. RTO: ~0 (traffic already flowing).
- Highest cost, highest complexity.

| Strategy | RPO | RTO | Cost | Complexity |
|----------|-----|-----|------|------------|
| Backup & Restore | Hours | Hours | Lowest | Low |
| Pilot Light | Minutes | 10s of minutes | Low | Medium |
| Warm Standby | Seconds | Minutes | Medium | Medium |
| Active-Active | ~0 | ~0 | Highest | Highest |

> 🌍 **Real-World:** Stripe uses an active-active multi-region architecture because their RTO and RPO requirements are near-zero — a payment processing outage directly costs merchants revenue and damages trust irreparably. Their engineering blog describes how they partition customers across regions (some customers' data is "home" to us-east-1, others to eu-west-1) and route writes to the home region to avoid write conflicts, while reads can be served from any region. This gives them < 1 second RPO and zero-second RTO for regional failures.

### (2) RTO and RPO

**RPO (Recovery Point Objective)**: Maximum acceptable data loss. If RPO = 1 hour, you can afford to lose at most 1 hour of data.

**RTO (Recovery Time Objective)**: Maximum acceptable downtime. If RTO = 15 minutes, you must be back online within 15 minutes of a failure.

Designing to these numbers:

| Target | Mechanism |
|--------|-----------|
| RPO = 0 | Synchronous replication (Multi-AZ), active-active |
| RPO minutes | Async replication (RDS read replica, Aurora Global) |
| RPO hours | Periodic backups |
| RTO = 0 | Active-active |
| RTO minutes | Warm standby + automation |
| RTO hours | Pilot light + manual runbook |

> 🌍 **Real-World:** Healthcare systems storing patient data (EHR systems) typically require RPO < 4 hours and RTO < 8 hours per HIPAA contingency plan requirements — this maps to a Pilot Light DR strategy where the database is continuously replicated to a DR region, but application servers are only launched when needed. Epic Systems (largest EHR vendor) recommends Aurora Global Database for their AWS deployments to achieve RPO < 1 second and RTO < 5 minutes, meeting even the most stringent hospital SLAs for critical patient care systems.

---

## Real-World AWS Usage

> **📖 Real-World Example:** How major companies use AWS in production:

```text
Netflix:
  3 AWS regions (us-east-1, eu-west-1, ap-northeast-1) — active-active
  Uses: EC2 (Graviton3), S3 (video storage), DynamoDB, Kinesis (Kafka alternative)
  Chaos Engineering: Netflix Chaos Monkey randomly kills EC2 instances in prod
  Why: test that systems remain available when individual instances fail

Airbnb:
  Aurora MySQL for booking and payments (writes to primary, reads from replicas)
  S3 for all user-uploaded images (presigned URLs for direct upload from browser)
  EKS for microservices (uses IRSA for service-level AWS permissions)
  ElastiCache Redis for caching search results

Spotify:
  Primarily GCP, but multi-cloud for some workloads
  AWS: CloudFront CDN for audio streaming to 600M users
  Why: CDN edge locations closest to users = lower buffering

Slack (Salesforce):
  AWS EC2 + EKS for all compute
  RDS for workspace data, ElastiCache for presence/typing indicators
  SQS for guaranteed message delivery between services

Stripe:
  AWS for everything (us-east-1 primary, eu-west-1 secondary)
  Uses RDS Proxy to handle connection pooling at scale
  VPC with strict security groups (no public internet exposure for DB)
  Key: SOC 2 Type II compliance via IAM + CloudTrail + GuardDuty

Real AWS Incidents to Learn From:
  us-east-1 2021 Kinesis outage: cascaded to many AWS services (CloudWatch, Cognito)
    Root cause: metadata API capacity issue, triggered cascading failures
    Lesson: design for regional failures, have multi-region fallback

  us-east-1 2017 S3 outage (Typo incident): engineer ran wrong command
    PUT was throttled → services relying on S3 for config failed (GitHub, Docker Hub)
    Root cause: S3 metadata service overwhelmed by incorrect high-rate command
    Lesson: S3 is not 100% reliable; use CDN or local fallback for critical config

  EC2 Nitro Hypervisor:
    AWS Nitro offloads networking and storage to dedicated hardware (not the EC2 CPU)
    Pre-Nitro: hypervisor used 10-20% of CPU for I/O
    Nitro: near bare-metal performance for I/O, CPU fully available to your app

VPC Best Practices (used by enterprise companies):
  Public subnets:    Load balancers, NAT Gateways only
  Private subnets:   App servers, databases (no direct internet access)
  Peering/TGW:       Connect VPCs across accounts (central networking account pattern)
  PrivateLink:       SaaS providers (Stripe, Datadog) deliver services inside your VPC
  Flow Logs → S3:    Audit all network traffic, feed into SIEM for security
```

---

## Important Concepts Checklist — Cloud Engineering

### VPC & Networking
- [ ] Public vs private subnet; route tables; IGW vs NAT
- [ ] Security Group (stateful) vs NACL (stateless)
- [ ] VPC peering / Transit Gateway / PrivateLink — when each
- [ ] Flow Logs → S3/CloudWatch for forensics

### IAM
- [ ] Policy evaluation: explicit deny > allow; identity + resource policies
- [ ] Least privilege; avoid `*` on `Action`/`Resource` in prod
- [ ] Roles for EC2/EKS (IRSA) vs long-lived access keys
- [ ] STS AssumeRole for cross-account

### Compute & LB
- [ ] ASG + health checks; draining on deploy
- [ ] ALB (L7) vs NLB (L4) decision
- [ ] Placement groups tradeoffs (cluster/spread/partition)

### Data
- [ ] RDS Multi-AZ vs read replicas (HA vs scale reads)
- [ ] Aurora storage architecture (awareness)
- [ ] RDS Proxy / connection pooling why
- [ ] S3 storage classes + lifecycle; presigned URLs

### Ops & DR
- [ ] CloudWatch metrics/alarms/logs basics
- [ ] RTO vs RPO; pilot light → warm standby → active-active
- [ ] Multi-region patterns + Route 53 routing policies
- [ ] Blue/green and canary on ALB/EKS

> ⭐ **IMPORTANT CONCEPT:** Cloud interviews reward **network isolation + IAM least privilege + HA topology** more than memorizing every instance family.

---

## Practical Labs — AWS VPC / IAM / RDS

### Lab 1 — VPC Sketch (paper or console, 30–45 min)

> 🛠️ **PRACTICAL:** Draw then (optionally) click: 1 VPC `/16`, 2 AZs × (public + private subnet), IGW, 1 NAT, public RT → IGW, private RT → NAT.

```text
Checklist:
  [ ] ALB in public subnets
  [ ] App ASG in private subnets
  [ ] RDS in private subnets (no public accessibility)
  [ ] SG: ALB :443 from 0.0.0.0/0; App :8080 only from ALB SG; RDS :5432 only from App SG
  [ ] NACL left default unless you have a reason
```

**Interview narration:** "Users hit ALB; apps never have public IPs; DB only accepts app SG."

### Lab 2 — IAM Least-Privilege Drill

```text
Scenario: EC2 app must read `s3://my-bucket/configs/*` and write logs to `s3://my-bucket/logs/*`.

Bad:  Action: s3:*, Resource: *
Better:
  Read statement: s3:GetObject on arn:...:configs/*
  Write statement: s3:PutObject on arn:...:logs/*
  ListBucket with prefix condition if needed

Also: attach via Instance Profile role — no access keys on disk.
```

> 🛠️ **PRACTICAL:** Write the JSON policy on paper once. Explain Deny vs missing Allow.

### Lab 3 — RDS HA Mental Lab

```text
1. Enable Multi-AZ: sync standby, automatic failover ~1–2 min — RPO~0 for instance failure
2. Add read replica: async, lag possible — scale reads, NOT a substitute for Multi-AZ alone
3. App config: write endpoint = primary; read endpoint = replica set
4. Failover test plan: reboot with failover; measure RTO; confirm app reconnects (RDS Proxy helps)
```

### Lab 4 — Incident Tabletop (15 min)

```text
Symptom: API 5xx spike; RDS CPU 100%; connections at max.
Walkthrough:
  - Check ASG size / connection pool sizing
  - PgBouncer/RDS Proxy?
  - Hot query / missing index?
  - Fail open cache? load shed?
Write a 5-bullet remediation plan.
```

### Lab 5 — DR Numbers

Pick a service you know. Fill:

| Metric | Your choice | Mechanism |
|--------|-------------|-----------|
| RPO | | |
| RTO | | |
| Strategy | backup / pilot / warm / active-active | |
| Who pages | | |

> 🛠️ **PRACTICAL:** If you cannot fill RPO/RTO, your cloud design is incomplete for Staff-level interviews.
