# Case Study: AI Creative Tools at Epsilon

**Status:** draft — interview in progress
**Role:** Staff Design Engineer, lead
**Timeframe:** 2021–present

---

## Headline metric
_[TBD — one number that lands the impact: e.g., "10k ad variations/week," "90% reduction in production time," "$X revenue influenced"]_

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

_[TBD — vector store / RAG component? The "our own data" in concept → layers — is that a retrieval step, a lookup, or hardcoded joins?]_

### Diagram
_[TBD — draft after Round 2]_

## Key decisions
- _[TBD — build vs. buy]_
- _[TBD — model selection + eval strategy]_
- _[TBD — failure handling / human-in-the-loop]_
- _[TBD — cost controls]_

## Metrics & outcomes
_[TBD — throughput, cost, adoption, quality]_

## What I personally owned
_[TBD — Kevin's direct scope vs. the team's]_

## Learnings
_[TBD — 1–2 sharp takeaways]_

## NDA notes
_[TBD — what can be shown publicly, what must be generic, what's off-limits]_
