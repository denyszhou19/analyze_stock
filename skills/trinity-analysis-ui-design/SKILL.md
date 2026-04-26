---
name: trinity-analysis-ui-design
description: Use when designing, reviewing, or polishing Trinity analysis UI components such as TradingCycleBus, rule-chain status cards, period-detail evidence blocks, topology preview hovers, badges, and tooltips. Apply when spacing, visual hierarchy, Chinese copy, hover responsibilities, bullish/bearish color semantics, or topology-card presentation need project-specific guidance.
---

# Trinity Analysis UI Design

## Overview

Use this skill to keep Trinity analysis UI work inside one project language: terminal-style information structure, report-style breathing room, natural Chinese copy, and stable bullish/bearish semantics.

Keep the default priority order fixed:

1. Explainability
2. Scanability
3. Professional tone
4. Visual flair

## Scope

Use this skill only for Trinity analysis components:

1. `TradingCycleBus`
2. Rule-chain status cards
3. Period-detail evidence blocks
4. Structure-topology explanation blocks
5. Topology preview hovers
6. Badges, tooltips, summary cards, and evidence rows inside those areas

Do not use this skill for:

1. Marketing pages
2. Login or operations pages
3. Global brand redesign
4. Backend field design or strategy logic

## Default Direction

Apply this visual direction by default:

1. Keep a terminal skeleton:
   - clear module boundaries
   - clear status / direction / constraint separation
   - information reads like a research tool, not a promo page
2. Add report whitespace:
   - cards breathe
   - text does not stick to edges
   - summary blocks and evidence blocks have reading rhythm
3. Preserve trading color semantics:
   - bullish stays red
   - bearish stays green
   - neutral / waiting / observation stays slate or gray-blue
4. Keep user-facing copy in natural Chinese

## Hard Rules

### Information Layering

1. Show conclusion first, summary second, evidence third.
2. Keep badges short; do not turn badges into sentences.
3. Use hover only to explain, never to hide the first thing the user must see.
4. Do not repeat the same meaning across badge, summary, and hover.

### Color Responsibilities

1. Never flip bullish red / bearish green.
2. Do not use bright accent colors unless they carry business meaning.
3. Do not rely on color alone; key status must still read clearly in Chinese.
4. Let neutral states stay calm so they do not compete with bullish/bearish calls.

### Spacing and Density

1. Prefer terminal structure with report whitespace.
2. Leave clear breathing room between cards and between card sections.
3. Build cards as `title -> one-line summary -> structured content`.
4. Give hover cards, explanation cards, and topology cards enough inner padding.
5. Avoid “debug panel density” unless the area is explicitly for internal debugging.

### Badge Rules

1. Let one badge express one judgment.
2. Keep badge copy specific to level, action, or state when possible.
3. Do not expose internal enums, field names, or debug vocabulary.
4. Control badge count; avoid “pill pile” layouts.

### Hover and Tooltip Rules

1. Let hover titles clearly read as explanations.
2. Make hover content answer:
   - what this means
   - why this is judged this way
   - what the impact is
3. Give hovers enough width; never allow premature wrapping with unused right-side space.
4. Keep graph, level, and summary from the same level; never mix parent copy with child topology.
5. Keep user-visible hover content in Chinese.
6. Replace raw technical terms like `render_payload` and `explainability` with user-facing Chinese phrasing.

### Topology Card Rules

1. Show the objective structure line first whenever structure graph data exists.
2. Enter annotated mode only when explainability is complete.
3. Fall back to pure lines plus objective summary when explainability is missing or incomplete.
4. Use a fixed two-column summary: left label, right value.
5. Make topology cards feel like compact research cards, not dark technical popups.

### Copy Rules

1. Default to natural Chinese.
2. Make copy concrete: level, condition, action.
3. Prefer short conclusion sentences before longer explanation sentences.
4. Allow standard abbreviations such as `MA55 / MA233`, but avoid mixed-language UI otherwise.

## Component Playbooks

### TradingCycleBus

Structure the card as:

1. Combination title + current overall state
2. One-line summary
3. Three layers:
   - current action state
   - child-level judgment basis
   - parent constraint

Keep these boundaries:

1. Use `current action state` for “what can be done now”.
2. Use `child-level judgment basis` only for child evidence supporting the current action.
3. Keep `parent constraint` separate; never bury it inside child evidence.
4. Let parent-constraint hovers show parent topology. Let other execution-related hovers show child topology.

### Rule Chain

Structure each rule item as:

1. Rule name
2. Status label
3. One-line reason
4. Hover for rule definition, current status, and trading impact

Keep these boundaries:

1. Separate status from direction.
2. Let the main label express state, not every piece of evidence.
3. Keep the rule chain as a judgment framework, not an evidence dump.

### Period Detail and Structure Explanation

Structure the area as:

1. Level conclusion
2. Structure summary
3. Evidence zone:
   - structure type
   - current leg / next confirmation
   - topology
   - risk / invalidation

Keep these boundaries:

1. Keep topology in the evidence zone; do not let it replace the top-line conclusion.
2. Explain current structure and stage before drilling into anchors.
3. Make downgrade states explicit when the structure is not fully explainable.

### Topology Hover Card

Structure the hover card as:

1. Title + level label
2. Structure graph
3. Two-column summary rows

Default row sets:

1. Annotated:
   - 当前结构
   - 当前阶段
   - 下一确认
2. Raw lines:
   - 当前结构
   - 原始描述
   - 数据状态

Keep these boundaries:

1. Differentiate annotated vs raw-lines with Chinese semantics, not English engineering labels.
2. Keep raw-lines fallback looking intentional and finished.
3. Let the graph stay visually central; let surrounding text explain it.

## Working Method

When using this skill on a UI task, follow this order:

1. Identify the top-line conclusion the user must see without hover.
2. Separate summary content from evidence content.
3. Check whether each badge really deserves to exist.
4. Check whether any hover is carrying information that should move into the main surface.
5. Check spacing and breathing room before adding more decoration.
6. Rewrite user-facing copy into natural Chinese before finishing.

## Review Checklist

Run this checklist before claiming the UI is ready:

1. Is the main conclusion visible at first glance?
2. Is anything repeated across badge, summary, and hover?
3. Are bullish and bearish colors still red and green?
4. Does hover only explain, not hide core meaning?
5. Is all user-facing copy natural Chinese?
6. Do cards and hover panels have enough padding and breathing room?
7. Does the topology card feel like a research aid instead of a debug popup?

## Common Failure Modes

Avoid these mistakes:

1. Turning every fact into a badge
2. Using hover as a dumping ground
3. Making dark popups with cramped padding
4. Letting neutral content use aggressive color
5. Mixing parent copy with child topology
6. Exposing internal field names to users
7. Optimizing for “more information” while losing explainability
