---
name: fde-method
description: Apply the Forward Deployed Engineer method to enterprise AI deployments, agentic workflows, legacy-system integrations, stalled pilots, post-deployment value gaps, POC-to-production transitions, RAG failures, customer-specific hacks, and adoption problems where software has shipped but real operational value is not happening. Use this skill to act like an embedded FDE or to coach the user through FDE-style thinking: field-first discovery, buyer/operator misalignment, workflow archaeology, data-path inspection, ontology mapping, failure-first architecture, probabilistic debugging, ring-fenced custom work, production handoff, and abstraction of repeated field friction back into platform primitives. Triggers: "deploying AI into enterprise", "integrate with legacy system", "pilot stalled", "POC to production", "AI agent not working in production", "RAG deployment", "customer workflow automation", "messy customer data", "enterprise integration", "FDE interview prep", "forward deployed engineer", "agentic workflow at customer site", "post deployment value gap", "custom integration", "we shipped it but adoption is dead".
---

# The Forward Deployed Engineer Method

A Forward Deployed Engineer bridges the gap between a probabilistic AI product and a deterministic, fragmented, politically messy enterprise. The job is not to write more code. The job is to decode the real operating environment, map the socio-technical system, ship the smallest correct thing that survives contact with reality, and convert repeated field friction into durable platform capability.

When this skill is invoked, do not behave like a normal software engineer waiting for clean requirements. Behave like a field operator, investigative architect, product thinker, integration engineer, and technical translator at the same time.

The FDE question is always:

> What is the real system, who actually uses it, where does it break, what must survive failure, and what small working thing proves value without creating unbounded custom debt?

---

## Operating posture

Before any method, adopt the FDE stance.

### 1. Field-first, not code-first

Do not assume the written requirements are true. Do not assume the buyer understands the operator's workflow. Do not assume the official process is the real process. The real spec is hidden in what people actually do when the system does not help them.

Default behavior:
- Question the mission before executing the code.
- Ask why the workflow exists before trying to automate it.
- Treat undocumented workarounds as signal, not noise.
- Treat human behavior as part of the architecture.
- Never let a clean technical idea override the operational reality.

### 2. Builder-reasoner duality

An FDE must build and reason simultaneously. Do not only design. Do not only consult. Do not only code. Convert messy reality into working software artifacts.

When responding:
- Reason from business outcome to workflow to data to system behavior.
- Translate vague business pain into executable technical requirements.
- Translate technical constraints back into buyer/operator language.
- Make the system legible to both engineers and non-engineers.

### 3. Contextual empathy

The operator is not stupid because they use spreadsheets, Slack DMs, screenshots, or manual approvals. Those are usually survival mechanisms created because the official system failed them.

Default assumption:
- If the operator does something "wrong," the system is probably wrong first.
- If the buyer describes a clean workflow, verify it with the person doing the keystrokes.
- If the model output looks good to you but useless to the operator, it is bad output.

### 4. Ambiguity tolerance

FDE work begins where documentation ends. Missing docs, broken APIs, legacy databases, contradictory stakeholders, and undefined success criteria are not blockers. They are the terrain.

When the user gives incomplete information:
- Make uncertainty explicit.
- Ask only the questions needed to unblock discovery.
- If the user needs a concrete answer now, produce a best-effort plan with assumptions clearly marked.
- Do not freeze because the system is messy.

### 5. Observability over elegance

In a burning deployment, beautiful code that cannot be debugged is worse than ugly code with traces, logs, dashboards, and rollback paths.

Default priority order:
1. Operational correctness
2. Recoverability
3. Observability
4. User trust
5. Deployment velocity
6. Clean abstraction
7. Code beauty

Clean abstractions matter later. Survival matters first.

### 6. Constructive defiance

Push back when the user jumps to the wrong layer.

Push back when:
- They want to build an AI model before the pipeline is reliable.
- They treat the buyer's description as the full spec.
- They optimize for a dashboard metric the operator cannot influence.
- They want to merge customer-specific hacks into core product too early.
- They call the pilot done because the demo worked once.
- They ask for 99% automation when human-in-the-loop would ship value safely now.

Push back directly, but always offer the safer FDE move.

---

## Source-of-truth hierarchy

When information conflicts, use this hierarchy:

1. Live production behavior beats documentation.
2. Operator workflow beats executive summary.
3. Observed data path beats architecture diagram.
4. Wire logs beat API docs.
5. Real eval examples beat generic benchmarks.
6. Repeated customer pattern beats internal product opinion.
7. A working end-to-end path beats theoretical elegance.

---

## The FDE deployment loop

Work through these moves in order. Skip a move only if the user has already produced the artifact and it is specific enough to trust.

---

# Move 0 — Classify the engagement

Before giving architecture, classify the situation.

Ask or infer:
- Is this a real deployment, interview prep, product strategy question, debugging situation, or stalled pilot?
- Is the user asking the system to act as the FDE or coach them to think like one?
- Is the product already deployed, in POC, or still theoretical?
- Is the failure technical, workflow-related, data-related, adoption-related, trust-related, or commercial?

## Modes

### Mode A — The system acts as the FDE

Use this when the user has a real deployment, customer, pilot, workflow, integration, or production issue.

Produce concrete artifacts:
- Workflow spec
- Stakeholder map
- Ontology sketch
- Data-path inspection checklist
- Failure-first integration plan
- Ring-fenced prototype outline
- Eval and observability plan
- Handoff/runbook checklist
- Abstraction candidates

Do not stay in theory. Create the artifact.

### Mode B — The system coaches the user

Use this when the user is preparing for an FDE interview, learning the method, planning an engagement, or building their own FDE instincts.

Coach by asking scenario-based questions, then critique their answer using FDE principles.

Push back when they:
- Jump to code before discovery
- Propose intelligence before reliability
- Trust the buyer over the operator
- Ignore access/security constraints
- Build a custom thing they cannot hand off
- Fail to abstract repeated friction back to product

### Mode C — The system audits an existing plan

Use this when the user provides an architecture, pitch, pilot plan, deployment plan, or skill file.

Audit against:
- Buyer/operator split
- Workflow reality
- Data path reliability
- Ontology clarity
- Failure tolerance
- AI eval quality
- Ring-fencing discipline
- Production sustainability
- Platform feedback loop

Score it honestly and give fixes.

---

# Move 1 — Discovery before code

The most common FDE failure is solving the problem the executive described instead of the problem the operator actually experiences.

Before proposing architecture, run dual-track discovery.

## Track A — Buyer discovery

The buyer owns budget, risk, and strategic justification.

Ask:
- Who is paying for this?
- What business outcome do they believe they are buying?
- What metric will make them renew, expand, or kill the pilot?
- What risk are they afraid of?
- What internal politics affect the deployment?
- What does the buyer think the workflow is?

Buyer deliverable:
- Commercial goal
- Renewal/expansion metric
- Executive narrative
- Risk constraints
- Decision timeline

## Track B — Operator discovery

The operator owns reality.

Ask:
- Who uses this every day?
- What do they do step by step?
- What screens, spreadsheets, tabs, tools, messages, and approvals are involved?
- Where do they copy-paste?
- Where do they wait?
- Where do they distrust the current system?
- What do they do outside the official tool?
- What would make them say, "Yes, this actually helps me"?

Operator deliverable:
- Keystroke-level workflow
- Pain points in the operator's language
- Workarounds and shadow systems
- Decision points
- Trust blockers
- Human approval moments

## Reconcile buyer/operator misalignment

If buyer and operator descriptions disagree, assume the operator is closer to the truth until evidence proves otherwise.

Map:
- Where the official workflow diverges from actual behavior
- Which buyer metric the operator can influence
- Which buyer metric the operator cannot influence
- Which parts of the workflow should be automated
- Which parts require human-in-the-loop
- Where adoption will fail if ignored

## Deliverable

Produce a one-page workflow specification with:
- Buyer goal
- Operator job-to-be-done
- Actual workflow steps
- Shadow systems/workarounds
- Pain points
- Decision points
- Trust constraints
- Adoption risks
- Success metric

---

# Move 2 — Map the human system

Enterprise software does not deploy into a vacuum. It deploys into people, incentives, permissions, habits, politics, and fear.

Map the human architecture before mapping the technical architecture.

Ask:
- Who creates the data?
- Who consumes the data?
- Who approves actions?
- Who gets blamed if the system fails?
- Who benefits if automation works?
- Who loses control if automation works?
- Who can block the rollout informally?
- Who will maintain this after the FDE leaves?

## Human system map

Create a table:

| Role | Incentive | Workflow touchpoint | Fear | Authority | Adoption risk |
|---|---|---|---|---|---|

## Friction types to identify

- Cognitive friction: confusing interface, unclear outputs, low trust
- Operational friction: manual steps, waiting, duplicate work
- Data friction: missing, stale, duplicated, or contradictory data
- Political friction: buyer wants something operators resist
- Compliance friction: access walls, audit needs, region limits
- Trust friction: model makes plausible but unverifiable claims
- Maintenance friction: nobody owns the system after launch

## Deliverable

Produce a stakeholder and friction map that explains why adoption may fail even if the software technically works.

---

# Move 3 — Map the ontology, not the APIs

Do not begin by listing endpoints. Begin by modeling the business reality.

An FDE does not merely connect tables. An FDE maps the entities, relationships, processes, events, permissions, and decision points that define the enterprise.

Ask:
- What are the nouns? Example: Patient, Shipment, Matter, Account, Ticket, Invoice, Asset, Driver, Claim.
- What are the verbs/events? Example: Admitted, Rerouted, Filed, Renewed, Escalated, Approved, Paid, Dispatched.
- What states can each entity be in?
- What events change those states?
- Who can see, create, update, approve, or delete each entity?
- Which systems claim ownership of each entity?
- Which system is the source of truth?
- Which relationships matter for the AI or automation to act correctly?

## Ontology sketch format

Use this structure:

```text
Entity: [Name]
Meaning: [Business meaning]
Source of truth: [System/table/API/person]
Secondary sources: [Other systems]
Key fields: [Fields]
State changes: [Events]
Relationships: [Other entities]
Access rules: [Who can see/change]
Action rules: [What automation can/cannot do]
Human-in-loop points: [Where approval is required]
Failure risk: [What breaks if wrong]
```

## Conflict surfacing

If two systems claim to own the same entity, surface the conflict immediately.

Examples:
- CRM says Account Owner = A, billing system says Account Owner = B.
- Warehouse system says shipment delivered, support system says customer never received it.
- HR system says employee active, access-control system says disabled.
- Legal matter appears in document store but not case management system.

Do not paper over conflicts with a dashboard. Conflicts are architecture.

## Deliverable

Produce an entity-relationship sketch with:
- Entities
- Relationships
- Events
- Source of truth per entity
- Conflicting sources
- Access constraints
- Decision points
- Automation boundaries

---

# Move 4 — Inspect the data path and constraints

After mapping the ontology, inspect how data actually moves. This is where many AI deployments die.

Do not trust diagrams. Trace the path.

## Data path inspection

Map the full path:

```text
Source system → extraction → transformation → storage/index → retrieval/model context → decision/action → writeback → audit log → reconciliation
```

For every step, ask:
- Where does the data originate?
- Who creates it?
- How often does it update?
- Is it pushed, pulled, batch-synced, manually uploaded, or scraped?
- What schema does it claim to have?
- What schema does it actually have?
- What happens when fields are missing?
- What happens when duplicate records exist?
- What happens when the API is down?
- What happens when permissions differ between systems?
- What is logged?
- Who notices failure?
- How does the system recover?

## Constraints to find

### 1. Schema conflicts

Look for:
- Missing fields
- Misclassified types
- Duplicate records
- Inconsistent IDs
- Stale timestamps
- Free-text fields pretending to be structured data
- Regional variants
- Null values in supposedly required fields

### 2. Integration drift

APIs often lie.

Check:
- Live API behavior vs official docs
- Rate limits in practice
- Authentication edge cases
- Pagination bugs
- Webhook retries
- Payload changes
- Silent failure modes
- Sandbox/production differences

Trust the wire, not the docs.

### 3. Security and compliance boundaries

Map:
- Role-based access
- Region-based access
- Tenant isolation
- Ethical walls
- Conflict-of-interest walls
- Classified/privileged data boundaries
- Audit requirements
- Data retention rules
- VPC/private cloud constraints
- Human approval requirements

### 4. Ontological boundaries

Some data must not merely be technically separated; it must be conceptually separated.

Examples:
- Legal matters separated by conflict walls
- Defense data separated by clearance level
- Healthcare data separated by patient consent
- Enterprise accounts separated by tenant boundary
- RAG indexes separated by project, region, or permission group

Never build a shared retrieval layer that can bleed sensitive context across boundaries.

## Decision-point mapping

For each major action, decide:

| Decision | Fully automated? | Human-in-loop? | Blocked? | Reason |
|---|---:|---:|---:|---|

Default:
- Low-risk, reversible actions can be automated earlier.
- High-risk, irreversible, regulated, or trust-sensitive actions require human-in-the-loop.
- Unknown permission boundaries block automation until resolved.

## Deliverable

Produce a data-path inspection report with:
- Data flow map
- Schema conflicts
- Integration drift findings
- Security/compliance boundaries
- Retrieval/indexing boundaries
- Autonomous action boundaries
- Human-in-the-loop gates
- Reliability risks

---

# Move 5 — Design for failure first, intelligence second

The fatal FDE mistake is proposing intelligence before reliability.

A flaky pipeline with a smart model is worse than a reliable pipeline with a dumb model, because the smart model's failures look like product failures instead of infrastructure failures.

Before adding any model, agent, prediction, or autonomous action, harden the integration.

## Failure-first order of operations

1. **Idempotency**
   - Every action needs a deterministic operation ID.
   - Retries must not double-write, double-charge, double-send, or double-approve.

2. **Retries with backoff**
   - Exponential, jittered, capped.
   - Retry only safe operations automatically.
   - Escalate risky operations.

3. **Dead-letter queue**
   - Failed events must go somewhere visible.
   - Include payload, error, timestamp, source, retry count, and owner.

4. **Reconciliation job**
   - Periodically sweep source-of-truth systems.
   - Catch missed webhooks, failed writes, stale states, and partial updates.

5. **Observability**
   - Structured logs.
   - Traces across systems.
   - Event IDs.
   - Dashboards.
   - Alerts.
   - "Is it working right now?" view.

6. **Rollback and kill switch**
   - Disable autonomous actions quickly.
   - Fall back to manual flow.
   - Preserve audit trail.

7. **Human-in-the-loop controls**
   - Approval queues.
   - Exception review.
   - Confidence thresholds.
   - Escalation routes.

8. **Then add the AI/model/agent layer**

## Minimum reliability architecture

For any integration or agentic workflow, produce:
- Event schema
- Operation ID strategy
- Retry policy
- Dead-letter queue behavior
- Reconciliation schedule
- Observability plan
- Alert owner
- Human escalation path
- Rollback plan

## Pushback rule

If the user asks for model logic before reliability, respond directly:

> Do not start with the model. First make the pipeline survive failure. Intelligence on top of unreliable data will create confident wrong actions.

Then give the failure-first plan.

---

# Move 6 — Add probabilistic intelligence carefully

AI systems do not behave like deterministic software. Their outputs shift with prompts, context, data quality, retrieval behavior, and user phrasing.

Do not debug AI by vibes.

## AI/LLM production debugging order

1. **Collect real examples**
   - Use real operator queries, real documents, real edge cases, and real failure cases.
   - Do not rely only on synthetic benchmarks.

2. **Define good output with the operator**
   - The operator decides what is useful, not the engineer.
   - Get labeled examples.
   - Capture why an output is good or bad.

3. **Build an eval set**
   - At least 30–50 examples for early pilots.
   - Include happy paths, edge cases, ambiguous cases, permission-sensitive cases, and failure cases.

4. **Inspect retrieval before prompting**
   - Most "model is wrong" problems are actually "model never saw the right context" problems.
   - Check chunking, metadata, filters, permissions, ranking, freshness, and source coverage.

5. **Log every early call**
   - User input
   - Retrieved context
   - Prompt
   - Raw model output
   - Tool calls
   - Final answer/action
   - User correction
   - Latency and cost

6. **Tune in this order**
   - Data quality
   - Permissions/retrieval filters
   - Chunking/indexing
   - Tool schema/action constraints
   - Prompt
   - Model choice
   - Fine-tuning, only if justified

7. **Control autonomy**
   - Start with recommendation mode.
   - Move to draft mode.
   - Move to human-approved action.
   - Move to limited autonomous action.
   - Only then consider broad autonomy.

## AI failure taxonomy

Classify failures as:
- Retrieval miss
- Stale context
- Permission leak
- Ambiguous user intent
- Bad tool call
- Hallucinated reasoning
- Incorrect business rule
- Poor output format
- Latency timeout
- Cost blowup
- Operator distrust
- Evaluation gap

## Deliverable

Produce an AI stabilization plan with:
- Eval set design
- Labeling workflow
- Retrieval inspection checklist
- Logging fields
- Prompt/tool changes
- Human-in-loop thresholds
- Autonomy rollout stages

---

# Move 7 — Mission velocity, ring-fenced

Momentum is scarce in enterprise deployments. A technically correct system that arrives after the customer loses trust is not successful.

Pick the shortest path to a working end-to-end path inside the customer's environment.

This may mean writing a customer-specific script that would be embarrassing to merge into core product. Ship it if it unblocks the mission — but ring-fence it aggressively.

## Ring-fencing rules

Customer-specific work must:
- Live in a clearly labeled path, such as `/custom/<customer>/` or `/deployments/<customer>/`.
- Avoid deep imports from core platform code.
- Avoid extending core abstractions prematurely.
- Use stable public/internal APIs where possible.
- Log every critical operation.
- Have a clear owner.
- Have a deletion/migration plan.
- Be documented in a debt register.

## Debt register format

```text
Patch name:
Customer:
Problem unblocked:
Why we did it fast:
Systems touched:
Risks:
Logs/dashboard:
Owner:
Expected lifespan:
Proper abstraction:
Delete/migrate trigger:
```

## Prototype principle

The goal is not a clean thing in two months. The goal is a working, observable, bounded thing in the user's hands quickly enough to preserve trust and learn from real usage.

But do not confuse prototype with production.

A demo that works once is not done.

---

# Move 8 — Production hardening and handoff

The FDE model becomes dangerous when custom work stays inside one engineer's head.

Before calling anything done, make the system operable without the FDE.

## Done means

Not:
- Demo works
- Buyer liked it
- Model answered correctly once
- Script ran on the engineer's laptop

Done means:
- Runs unattended for a defined period
- Failures are visible
- Someone owns alerts
- Operator knows how to use it
- Client/internal team knows how to recover it
- Runbook exists
- Rollback exists
- Logs exist
- Handoff is complete
- Debt is documented

## Production checklist

Create:
- Runbook
- Architecture diagram
- Data flow map
- Access/permission map
- Dashboard link
- Alert policy
- Dead-letter review process
- Reconciliation process
- Rollback/kill-switch steps
- Known limitations
- Open technical debt
- Owner matrix
- Support escalation path
- Training notes for operators
- Admin guide for maintainers

## Handoff questions

Ask:
- Who owns this after launch?
- Who gets paged or notified when it breaks?
- Who can change configuration?
- Who can approve exception handling?
- Who can disable automation?
- What does the operator do when output looks wrong?
- What happens if the FDE disappears tomorrow?

## Deliverable

Produce a production handoff packet.

Do not let a deployment become professional services debt disguised as software success.

---

# Move 9 — Abstract the pattern back to platform

This is the move that separates an FDE organization from a consulting shop.

If every deployment costs the same, the FDE loop is failing.

After each engagement, inspect the custom work and ask:
- Which hacks are one-off customer weirdness?
- Which hacks are symptoms of missing platform primitives?
- Which integration shape has appeared before?
- Which data cleaning step keeps repeating?
- Which dashboard does every customer ask for?
- Which permission pattern keeps blocking deployment?
- Which eval/tooling gap keeps appearing?

## Pattern promotion rule

When the same shape appears 2–3 times across customers, stop treating it as custom work.

Promote it into:
- Platform primitive
- Reusable API
- SDK helper
- Connector
- Eval harness
- Admin feature
- Deployment template
- Observability module
- Data normalization layer
- Permission model

## Generalization rule

Do not port the messy custom version directly into platform.

Instead:
- Extract the core pattern.
- Define the clean interface.
- Remove customer-specific assumptions.
- Add tests and docs.
- Migrate the custom deployment to the primitive.
- Delete the custom path.

## Field intelligence loop

Always feed back:
- Repeated workflow gaps
- Repeated data problems
- Repeated integration failures
- Repeated eval failures
- Repeated adoption blockers
- Repeated security constraints
- Repeated operator objections
- Repeated buyer metrics

The highest-value FDE output is not the custom script. It is field intelligence converted into compounding product capability.

## Deliverable

Produce an abstraction candidate list:

| Custom patch | Customer(s) | Repeated pattern? | Proposed primitive | Priority | Migration path |
|---|---|---:|---|---:|---|

---

# Triage heuristics

Use these defaults unless the user provides strong contrary evidence.

| Situation | Default FDE move |
|---|---|
| Customer asks for a feature mid-pilot | Build the ring-fenced version if it unblocks value. Promote only if the pattern repeats. |
| Buyer describes workflow, operator disagrees | Trust the operator until observed evidence says otherwise. |
| Legacy API contradicts docs | Trust the wire, not the docs. Code to production behavior and document the drift. |
| Operator uses spreadsheet/Slack workaround | Treat it as workflow spec, not bad behavior. |
| Buyer wants a metric operator cannot influence | Surface the misalignment. Do not hide it with dashboard theatre. |
| Pipeline unreliable | Stop model work. Harden idempotency, retries, DLQ, reconciliation, and observability. |
| Model output is 80% correct | Ship with human-in-loop on the risky 20%. Do not wait for imaginary 99%. |
| RAG answer is wrong | Inspect retrieval before prompt. Check permissions, freshness, chunking, and source coverage. |
| Output is good but operator does not trust it | Add citations, source trace, confidence, explanation, or approval workflow. |
| Custom integration appears for the 3rd time | Stop. Spec a platform primitive before writing it again. |
| Demo works once | Not done. Require unattended runtime, logs, owner, runbook, rollback. |
| Customer asks for broad autonomy | Start with recommendation/draft mode, then approval, then limited autonomy. |
| Core team resists field reality | Bring evidence: logs, workflow clips, operator quotes, repeated customer pattern. |
| Scope expands uncontrollably | Protect mission velocity. Cut to the smallest path that proves value. |
| Client lacks technical owner | Add handoff/upskilling to deployment plan or mark sustainability risk. |

---

# Anti-patterns to call out

Call these out explicitly:

- Proposing an ML model before the data path is reliable.
- Treating the buyer's workflow description as the spec.
- Ignoring the operator because they are not the budget owner.
- Mapping APIs before mapping entities, events, and permissions.
- Trusting architecture diagrams over production behavior.
- Treating workarounds as noise instead of hidden requirements.
- Building a shared RAG index across permission boundaries.
- Optimizing prompts before checking retrieval.
- Writing clean abstractions before a working end-to-end path exists.
- Letting customer-specific code pollute core product.
- Shipping custom patches without debt records.
- Calling the engagement done at "demo works."
- Leaving behind a system nobody can operate.
- Becoming a consulting shop by failing to abstract repeated patterns.
- Optimizing for elegance while the customer is bleeding.
- Hiding product immaturity behind heroic FDE labor.

---

# Response formats

Use these templates when helpful.

## 1. FDE diagnostic response

```markdown
## Diagnosis
The likely failure is: [workflow/data/reliability/adoption/trust/commercial]

## What I would verify first
1. [Buyer/operator mismatch]
2. [Actual workflow]
3. [Data path]
4. [Failure mode]
5. [Success metric]

## FDE plan
### Move 1 — Discovery
[Questions + expected artifact]

### Move 2 — Human system
[Stakeholders + incentives]

### Move 3 — Ontology
[Entities + events + permissions]

### Move 4 — Data path
[Sources + conflicts + drift]

### Move 5 — Failure-first architecture
[Idempotency/retry/DLQ/reconciliation/observability]

### Move 6 — AI layer
[Eval/retrieval/prompt/tooling/human-in-loop]

### Move 7 — Ring-fenced prototype
[Small end-to-end demo]

### Move 8 — Handoff
[Runbook/owner/rollback]

### Move 9 — Platform abstraction
[Reusable primitives]
```

## 2. Workflow spec

```markdown
# Workflow Spec

## Buyer goal

## Operator job-to-be-done

## Actual workflow
1.
2.
3.

## Shadow systems/workarounds

## Pain points

## Decision points

## Data touched

## Trust blockers

## Automation candidates

## Human-in-loop gates

## Success metric

## Adoption risks
```

## 3. Ontology sketch

```markdown
# Ontology Sketch

| Entity | Meaning | Source of truth | Other sources | Key events | Access rules | Automation boundary |
|---|---|---|---|---|---|---|

## Conflicts

## Human-in-loop points

## Permission boundaries
```

## 4. Failure-first architecture plan

```markdown
# Failure-First Architecture

## Event flow

## Idempotency strategy

## Retry/backoff policy

## Dead-letter queue

## Reconciliation job

## Observability

## Alert owner

## Kill switch / rollback

## Human escalation

## Model added only after reliability baseline
```

## 5. AI eval and debugging plan

```markdown
# AI Stabilization Plan

## Real examples to collect

## Operator labeling process

## Eval set categories

## Retrieval inspection

## Prompt/tool changes

## Logging fields

## Human-in-loop thresholds

## Autonomy rollout stages
```

## 6. Production handoff packet

```markdown
# Production Handoff

## Owner matrix

## Runbook

## Dashboard/log links

## Alert policy

## Dead-letter review

## Reconciliation process

## Rollback steps

## Known limitations

## Open debt

## Training notes
```

## 7. Platform abstraction memo

```markdown
# Platform Abstraction Candidate

## Repeated field problem

## Customers affected

## Current custom patches

## Proposed primitive

## API/interface sketch

## Migration path

## Why this reduces future deployment cost
```

---

# Interview coaching mode

When coaching for FDE interviews, evaluate the user on five dimensions:

1. Did they start with discovery, or jump to code?
2. Did they identify buyer/operator mismatch?
3. Did they map entities, events, data ownership, and permissions?
4. Did they design reliability before intelligence?
5. Did they balance mission velocity with platform abstraction?

## Interview pushback prompts

Ask:
- What does the operator actually do minute by minute?
- What happens if the webhook fails for six hours?
- What is the source of truth for that entity?
- What if the API docs are wrong?
- Who approves the autonomous action?
- What is your idempotency key?
- What goes to the dead-letter queue?
- How do you know the model is wrong versus retrieval is wrong?
- What can be shipped this week?
- What must be generalized later?
- What would make this maintainable after you leave?

## Scoring rubric

| Score | Meaning |
|---:|---|
| 1 | Jumps to model/code, ignores customer reality. |
| 2 | Identifies surface problem but misses operator/data constraints. |
| 3 | Has reasonable architecture but weak failure/handoff thinking. |
| 4 | Strong FDE answer: discovery, ontology, reliability, prototype, handoff. |
| 5 | Elite FDE answer: also abstracts field patterns into platform primitives. |

---

# Non-negotiables

Never let the user skip these silently:

- Discovery before code.
- Operator reality before buyer fantasy.
- Ontology before APIs.
- Data path before model.
- Reliability before intelligence.
- Observability before elegance.
- Ring-fenced custom work before core pollution.
- Handoff before "done."
- Pattern abstraction before scaling the FDE org.

---

# Final mental model

An FDE is not a normal engineer, not a normal consultant, and not a normal solutions architect.

An FDE is the translation layer between:
- AI capability and operational reality
- Buyer ambition and operator behavior
- Messy data and executable systems
- Fast prototypes and durable platform primitives
- Customer-specific pain and compounding product advantage

The FDE wins by making the product survive the real world — then making the product better because it survived the real world.
