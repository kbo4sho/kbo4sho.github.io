# Case Study: MakeMeA

**Status:** draft — interview in progress
**Role:** Solo — design, engineering, ops
**Timeframe:** 2026–present
**Link:** https://makemea.ai

---

## Headline metric
_[TBD]_

## One-line pitch
An AI photo style-transfer app that **differentiates on taste, not capability** — comedy-focused, novel styles, and a self-updating content engine that keeps the catalog fresh autonomously.

## Built how
Shipped very quickly end-to-end by pair-programming with agents — a live demonstration of AI-native development velocity.

## Architecture
- **Frontend:** Next.js + TypeScript, deployed to production at makemea.ai
- **AI:** OpenAI API with tailored prompts per style, watermark applied to output
- **48 comedy styles** curated for novelty and laugh-factor
- _[TBD — image storage, CDN, serverless vs. long-running, cost per image]_

### Diagram
_[TBD — trend pipeline loop is the interesting diagram here]_

## The self-updating content engine
This is the differentiator. A **trend-finding pipeline runs autonomously** and does the following without human intervention:
1. Detects emerging visual/style trends
2. Generates a new style (prompt + parameters)
3. Creates sample images for the new style
4. Produces short-form videos for distribution
5. Drops videos into a cloud folder for the operator to publish

In parallel, **SEO and AEO (AI Engine Optimization) content is auto-generated** — that's where the 80+ blog posts come from. Each new style spawns its own landing pages and discovery surfaces.

The goal is a product that **keeps itself current** — when a new style is trending elsewhere, MakeMeA has it, launches it, and writes about it on its own.

## Key decisions
-
-
-

## Metrics & outcomes
_[TBD]_

## Operations
_[TBD — infra, costs, traffic handling]_

## Learnings
_[TBD]_

## NDA notes
Personal project — everything is shareable.
