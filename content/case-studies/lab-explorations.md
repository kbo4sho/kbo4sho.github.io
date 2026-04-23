# Lab — Early Explorations

A band of **early, in-progress explorations** of agent skills, generative pipelines, and AI-native tooling. None are finished products. All point at the same pattern as the Epsilon eval skill: **reusable AI infrastructure, composable, built in public.**

---

## Sprawl
**What:** Type a question, watch AI paint the answer in real time — Voronoi-stippled dots resolve into generated art through smooth canvas transitions.
**Stack:** Custom 2D / WebGL renderer, SDXL image generation, full solo-built pipeline.
**Status:** Live at sprawl.place. Early — exploring what real-time, visually-legible AI generation can feel like as an interface.
**Why it matters:** A bet that AI outputs become more interesting when the *process* of generation is part of the experience, not hidden.

---

## OSS Contributor
**What:** An agent skill that discovers open source GitHub issues, forks repos, implements fixes, and opens PRs with full AI disclosure.
**Stack:** Agent skill, GitHub API, published on ClawHub.
**Status:** Early — the loop runs end-to-end but I'm still tuning which issues are agent-suitable vs. require a human.
**Why it matters:** Proof-of-pattern for "agents do real work in public infrastructure." Same skill-as-abstraction pattern I use at Epsilon.

---

## Visual QA
**What:** Visual regression testing pipeline for AI agents — captures baseline screenshots with Playwright, pixel-diffs against new builds, gates deployments on similarity thresholds.
**Stack:** Playwright, pixel-diff, agent skill, published on ClawHub.
**Status:** Early — working on threshold tuning and integration stories beyond my own projects.
**Why it matters:** Agents that write code need to see whether what they shipped actually looks right. This is the seeing part.

---

## The pattern
Each of these is a **skill** — a composable unit of AI work that can be called from larger agent systems. It's the same shape as the eval skill I built at Epsilon: invest once in a narrow, reusable piece; compound leverage across every AI feature that needs it.

These are early. They're here because shipping them in public is how the pattern gets sharper.
