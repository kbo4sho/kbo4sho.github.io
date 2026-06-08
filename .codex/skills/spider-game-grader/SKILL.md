---
name: spider-game-grader
description: Grade the portfolio spider mini-game against its documented purpose. Use when the user asks to grade, evaluate, assess, audit, or score the spider game, especially prompts like "grade the spider game", "how well is the spider game doing", or "grade it based on spider-game-purpose.md".
---

# Spider Game Grader

## Workflow

1. Read `spider-game-purpose.md` first and use it as the source of truth.
2. Inspect the current game implementation in `spider-game.js` and the page wiring in `index.html`.
3. If available and relevant, run non-mutating checks:
   - `node --check spider-game.js`
   - `node tools/spider-motion-audit.mjs`
   - a local browser preview when visual/readability or interaction confidence matters.
4. Grade the game against the purpose, not against generic arcade standards.

## Rubric

Use this default scale unless the user asks for another format:

- Overall grade: letter grade plus `/10`.
- Craft: interaction detail, animation polish, sprite quality, and technical reliability.
- Systems thinking: catches, hooks, threads, remnants, and ending web clearly become a larger structure.
- Web metaphor: "spin a web" reads both literally and conceptually.
- Quiet portfolio fit: hidden/playful without hijacking reading or feeling like a separate feature.
- Transformation/emergence: chaotic motion becomes elegant structure and the win state is construction, not score.
- Interaction clarity: visitors can discover, play, recover, and reach the construction arc without fighting the controls.

## Response Shape

Lead with the grade, then concise evidence.

Include:

- The strongest purpose-aligned wins.
- The biggest gaps or risks.
- 2-4 highest-leverage improvements.
- Tests/checks run, or a clear note if no live checks were run.

Do not implement changes during a grading request unless the user explicitly asks for implementation.
