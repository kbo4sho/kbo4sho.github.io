# AI Creative Tools @ Epsilon

**Role:** Staff Design Engineer, lead · **Timeframe:** 2021–present · **Status:** in production
**Internal project, Epsilon** · architecture and metric shapes are public; client names and proprietary specifics omitted.

---

## Headline

> **Hundreds of creatives. Thousands of ad variations per day. ~5× faster than the prior Adobe-based flow. Fully adopted across the creative org.**

Design and production tooling for Epsilon's creative team — purpose-built for ad creation, AI threaded through every surface, measured by a self-optimizing eval pipeline.

---

## The before-state

Creative teams lived inside Illustrator and Photoshop with v1 in-app tooling. Production was locked to the Adobe ecosystem: slow to iterate, hard to scale into the personalization Epsilon's ad system needed, and expensive to maintain per-app. Web was the only place the full workflow could come together.

## The system

An end-to-end web ad builder with AI woven through concept, layout, and edit:

1. **Brief → Concept** — creatives feed in a brief, brand guidelines, and an asset library. A chained sequence of LLM calls produces concept options.
2. **Concept → Layers** — selected concepts are converted into editable layers in the builder. Multiple AI calls combine with **structured lookups into Epsilon's production data** (e.g., font IDs resolve to real, renderable font definitions) so the output isn't just plausible — it's production-valid.
3. **Natural-language editing** — inside the builder, creatives type what they want and a single LLM call edits or generates new elements in place.
4. **Static and motion output** — the builder handles both, plus configurable product rotators and animated modules. Output feeds Epsilon's downstream ad system for personalization at scale.

Humans stay in the loop at every AI step today. The underlying AI moments are being refactored into **skills / tools an agent can compose** — the homegrown loop is the substrate that agent will run on.

### Architecture

```
   brief + brand guidelines + assets
                  │
                  ▼
        ┌──────────────────────┐
        │  Concept Generation  │   multi-step LLM chain
        └──────────┬───────────┘
                   │ concepts
                   ▼           (creative selects)
        ┌──────────────────────┐
        │  Concept → Layers    │── structured lookups ──▶ Epsilon data
        └──────────┬───────────┘   (fonts, assets, rules)
                   │ editable layers
                   ▼
        ┌──────────────────────┐
        │   Web Ad Builder     │◀── NL-edit ─── single LLM call
        │  (static + motion)   │
        └──────────┬───────────┘
                   │                      ┌──────────────────┐
                   ▼                      │  Eval Skill      │
        personalized ad output ◀─ score ─▶│ layout / color / │
                                          │ pixel-diff       │
                                          └────────┬─────────┘
                                                   │ scores
                                                   ▼
                                          ┌──────────────────┐
                                          │  Meta-optimizer  │
                                          │ (LLM tunes       │
                                          │  prompts, model, │
                                          │  pipeline,       │
                                          │  schemas)        │
                                          └──────────────────┘
```

## Orchestration & models

- **Model family:** Gemini, with multiple tiers exposed as options — each call trades cost vs. quality per step.
- **Orchestration:** homegrown loop. No LangChain / LlamaIndex. State lives in-memory per request.
- **Choice:** keep the substrate simple and debuggable while AI features evolve weekly.

## Evals — the real unlock

Scoring creative AI output is the hard problem. Everyone can generate; few can measure. So I built a **custom eval pipeline** that scores output on observable, measurable signals:

- **Layout position accuracy** — are elements where they belong on the canvas?
- **Color accuracy** — do outputs match brand palettes?
- **Pixel diff vs. baseline** — structural fidelity against a known-good reference.

**Self-optimizing, not just self-correcting.** When scores come back low, an LLM doesn't just retry — it reads the eval results and **adjusts the system itself**: the prompts, the model tier selection, the pipeline steps, and the output schemas. Conceptually closer to DSPy-style automated pipeline tuning than a critique-and-regenerate loop. The system doesn't just generate creative — it learns how to generate better creative.

**Packaged as a reusable skill.** Crucially, I built this not as one-off infrastructure for a single feature, but as a **skill any AI feature in the system can plug into**. Every new AI surface gets scoring + self-optimization for free. One investment, compounding leverage across everything the team ships.

## Key decisions

- **Move creatives off Adobe onto the web** — a purpose-built ad builder with only the design features creatives actually use, not a general design tool.
- **Homegrown orchestration over frameworks** — a simple in-memory loop keeps the system debuggable and fast to iterate while AI features evolve.
- **Tiered models** — expose multiple Gemini tiers so each step can trade cost vs. quality.
- **Invest in evals before features** — scoring creative output with a self-optimizing loop became the foundation everything else builds on.
- **Humans in the loop today, agent-composed tomorrow** — every AI moment is a human-reviewed step; those same moments are skills an agent will orchestrate.
- **Keep failure handling intentionally lightweight for now** — a deliberate call, not an oversight. A known area to harden as usage scales.

## What I personally owned

- **Designed the end-to-end process** for every AI feature — concept generation, concept → layers, NL-edit, the eval skill, and the roadmap toward agent-composition.
- **Implemented most of it hands-on**, using AI-native dev workflows (AI-assisted coding) to ship faster than a team our size normally would.
- **Lead the team** that owns, extends, and operates the system in production.

## Outcomes

| | |
|---|---|
| **Users** | Hundreds of creatives |
| **Throughput** | Thousands of ad variations per day |
| **Speed** | ~5× faster than the prior Adobe-based flow |
| **Scope** | Expanded capabilities beyond what the Adobe flow could do |
| **Adoption** | Fully adopted across Epsilon's creative org |

## Learnings

- **Evals are the job.** Generation is table stakes. The teams that win in creative AI are the ones that can measure quality and tune for it.
- **Skills > one-off features.** Packaging cross-cutting AI work (evals, agents, tools) as composable skills compounds. It's what turns a team into a platform.
- **Simple orchestration + smart meta-optimization beats heavy frameworks** — especially when the AI landscape is moving weekly.

## NDA boundaries

Epsilon, Gemini, architecture shape, and metric ranges are OK to share. No client names, no named campaigns, no teammate names, and proprietary implementation specifics stay generic.
