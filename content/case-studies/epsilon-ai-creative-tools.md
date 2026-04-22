# Case Study: AI Creative Tools at Epsilon

**Status:** draft — interview in progress
**Role:** Staff Design Engineer, lead
**Timeframe:** 2021–present

---

## Headline metric
Hundreds of creatives producing thousands of ad variations per day — **5× faster than the prior Adobe-based flow, with more capabilities, and fully adopted across the creative org.**

## One-line pitch
Design and production tools for Epsilon's creative team — faster, more accurate, and more expressive ad creation.

## Problem / before-state
Creative teams were working in Adobe Illustrator and Photoshop with v1 in-app tooling. Production was tied to the Adobe ecosystem, slow to iterate, and hard to scale into personalized ad output. We moved the whole flow to the web and built a purpose-built ad builder — only the design features creatives actually needed, nothing more.

## Architecture
End-to-end flow:
- Creatives provide a brief + brand guidelines + asset library
- AI produces concept options from that input
- Selected concepts are converted into editable layers inside the web ad builder
- The builder supports static and motion-based ads, configurable product rotators, and other animated modules
- Output is personalized content that feeds the downstream ad system

**Where AI is in the loop:**
- **Brief → concept:** multiple LLM calls chained together
- **Concept → layers:** multiple AI calls combined with proprietary Epsilon data
- **Natural-language edits in the editor:** single call to edit or generate new elements
- Humans are in the loop at every stage today
- Direction of travel: these are being refactored into **skills / tools for an agent** — the homegrown loop is the substrate an agent will run on top of

**Orchestration & models:**
- Model family: Gemini (primary), with multiple model tiers exposed as options so calls can trade off cost vs. quality per step
- Orchestration: homegrown loop (no LangChain / LlamaIndex)
- State: in-memory, per request

**Bridging AI output to production data:** the concept → layers step does structured lookups against Epsilon's internal data — e.g. font IDs returned by the model get resolved to real, renderable font definitions so the output lands as a valid, production-ready layer set (not just plausible-looking markup).

### Diagram
_[TBD — draft after Round 2]_

## Key decisions
- **Move off Adobe to web.** Purpose-built ad builder with only the design features creatives actually use — not a general design tool.
- **Homegrown orchestration.** No LangChain / LlamaIndex; a simple in-memory loop per request keeps the system debuggable and fast to iterate on as AI features evolve.
- **Model tiering.** Multiple Gemini tiers exposed as options so each call can trade cost vs. quality per step.
- **Invest in evals before features.** Layout/color/pixel-diff scoring with a self-improvement loop became the foundation everything else builds on — scoring creative output is the hard problem.
- **Humans in the loop today, agent-composed tomorrow.** Every AI moment is a human-reviewed step; those same moments are being refactored into skills/tools an agent can call.
- **Failure handling is intentionally lightweight today** — a known area for hardening as usage scales.

## Metrics & outcomes
- **Throughput:** thousands of ad variations produced per day across hundreds of active users
- **Speed:** ~5× faster than the prior Adobe-based creative flow
- **Capabilities:** expanded beyond what the Adobe-based flow could do
- **Adoption:** fully adopted across Epsilon's creative org

## Evals (the unlock)
Built a custom **eval pipeline** that scores generated output on observable, measurable signals:
- **Layout position accuracy** — are elements where they should be on the canvas?
- **Color accuracy** — do outputs match brand palettes?
- **Pixel diff vs. baseline** — structural fidelity against a known-good reference
- **Recursive self-improvement** — the pipeline feeds its own scores back into the generation loop so the system iterates toward higher-scoring output without manual intervention

**Packaged as a reusable skill.** The eval pipeline isn't wired into one feature — I built it as a **skill that any AI feature in the system can plug into**, so new features get the same scoring + self-improvement loop for free. This is platform thinking: one investment, compounding leverage across every AI surface the team ships.

Scoring creative AI output is the hard problem. Most teams can generate; few can measure. Turning that measurement into reusable infrastructure is what separates a prototype from a production system.
_[TBD — one-line on the self-improvement mechanism: critique-and-regenerate? rejection sampling? agent tool-use?]_

## What I personally owned
- Designed the end-to-end process for every AI feature in the system — brief → concept, concept → layers, natural-language editor edits, and the refactor toward agent-skill composition
- Implemented most of the features hands-on, using AI-native development workflows (AI-assisted coding) to ship faster
- Lead the team that owns, extends, and operates the system in production

## Learnings
_[TBD — 1–2 sharp takeaways]_

## NDA notes
- ✅ Epsilon as employer (already public on resume + LinkedIn)
- ✅ Architecture shape (homegrown loop, eval pipeline, structured lookups against production data)
- ✅ Model family (Gemini) and the tiering pattern
- ✅ Metric ranges as stated (hundreds of users, thousands of variations/day, ~5× faster, fully adopted)
- 🟡 Keep implementation specifics **generic** — describe patterns, not proprietary algorithms
- ❌ No client names, no named campaigns, no teammate names
