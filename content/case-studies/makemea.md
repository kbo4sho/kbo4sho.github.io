# MakeMeA

**Role:** Solo · **Timeframe:** 2026–present · **Status:** live, unprofitable, valuable as a learning lab
**Link:** https://makemea.ai

---

## Headline

> **Shipped a full AI product end-to-end, live on the internet, in 2 days — then built an autonomous content engine around it that finds trends, generates new styles, and writes its own content.**

A deliberate experiment in **AI-native velocity** and **product-as-a-self-running-system**, not a startup pitch.

---

## What it is
An AI photo style-transfer app — upload a photo, pick a style, get a watermarked comedy transformation back. Differentiates on **taste over capability**: 48 styles curated for comedy and novelty, not "professional studio portrait #47."

## Why I built it
- **Pressure-test AI-native development velocity** in a real product context. Ship something live in a weekend, learn what that actually costs and enables.
- **Build a self-updating AI product** — not just generate once, but have the product keep itself current as taste and trends shift.
- Treat the whole thing as a **learning lab**: fast feedback, real users, honest market signal.

## Built in 2 days
Pair-programmed with agents from empty repo to live URL. Next.js + TypeScript + OpenAI, deployed straight to production. Every design decision optimized for *shipability*: tailored prompts per style, watermark as a single overlay step, minimal server infra.

The speed is the case study. If you want to see what an AI-native engineer ships in a weekend, this is it.

## The autonomous content engine
The longer-term bet. MakeMeA runs a **trend-to-publish pipeline** without human intervention:

```
   trend finder ────▶ new style
         │             (prompt + params)
         │                 │
         │                 ▼
         │           sample images
         │                 │
         │                 ▼
         │           short-form videos
         │                 │
         │                 ▼
         │           cloud folder ───▶ operator publishes
         │
         └────────▶ SEO/AEO blog posts (80+)
                       auto-generated per style
```

- **Trend detection → new styles.** The pipeline spots emerging visual trends and spins up a style (prompt, parameters) to match.
- **Sample generation.** For every new style, sample images are produced for landing pages and discovery.
- **Video production.** Short-form videos get generated and dropped into a cloud folder for me to publish when I want.
- **SEO / AEO at scale.** 80+ blog posts auto-generated — every style has its own organic discovery surface, optimized for both traditional search and AI engine retrieval.

The product catalog doesn't sit still. It refreshes itself.

## Honest results

| | |
|---|---|
| **Time to live** | 2 days |
| **Traffic** | Decent — organic pickup from the SEO pipeline |
| **Revenue** | Not yet profitable |
| **Market read** | Crowded; competitors give away what I charge for |
| **Value realized** | High — validated AI-native velocity, shipped real autonomous systems infra, honest market learnings |

## What I'd do differently
- **Product-market fit comes before velocity.** Shipping in 2 days is a capability, not a strategy. The same 2 days spent in a less-crowded niche would have different economics.
- **Free competitors reset the pricing floor** for anything that feels like a commodity style-transfer use case.
- The infra (trend pipeline, auto-content engine) is **more valuable than the product** it happens to be wrapping — it's reusable across verticals.

## Learnings

- **AI-native velocity is real and measurable.** "Live in 2 days, solo" is a baseline I can now plan around in any future product.
- **The system is the moat, not the UI.** The autonomous trend-to-publish loop is more defensible and more portable than another SaaS frontend.
- **Taste differentiation only works when you can ship fast enough to keep leading it.** Comedy, novelty, and cultural timing all decay — the trend engine exists to keep up.
- **Monetization is a separate engineering problem** from the product itself. I didn't solve it here, and I know exactly why.

## What I personally owned
100% — design, architecture, code, ops, prompts, content strategy. Pair-programmed with agents for speed; no contractors, no co-founders.

## Shareable
Personal project, fully public. Nothing NDA.
