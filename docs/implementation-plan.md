# Kirana Saathi Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; steps use checkboxes.

**Goal:** Hindi voice bug reporting, managed Antigravity repair, tested GitHub draft PR and container preview.
**Architecture:** Separate static inventory app and same-origin voice console/API. Direct Live WebSocket with ephemeral tokens; durable SQLite background jobs; backend publication after isolated Docker checks.
**Tech Stack:** React/Vite/TypeScript, Express, Node SQLite, @google/genai 2.31.0 (planned 2.32.0 was unpublished), Octokit, Docker, Vitest and Playwright.
**Spec:** The user-approved Kirana Saathi plan in this chat.

## Global constraints
- Public monuminu/kirana-saathi-demo and monuminu/gemini-kirana-bugfix-agent; synthetic data only.
- Local loopback only. Hindi voice bug reporting; UI inventory operations.
- Gemini models: gemini-3.8-live, gemini-3.8-flash, antigravity-preview-09-2026.
- Single active repair; 15-minute deadline; initial attempt plus two revision rounds.
- No credentials in browser, sandbox or public evidence; no automatic PR merge.
- Raw media/transcripts local; GitHub evidence sanitized.

## Review focus
- Approval before read-back or after correction must never dispatch.
- Interrupted or duplicated Live calls must not duplicate jobs.
- Failed checks/cancellation/stale bases must prevent publication.
- Provider-create timeouts must never silently duplicate execution.
- Exact fixed commit must produce 13 kg in isolated preview.

## Tasks
- [x] Inventory: tests for seed/units/oversell/storage, Hindi UI; preserve one intentional sale regression.
- [x] Voice: Live event reducer, AudioWorklet, frames, transcription, tool response deduplication, read-back completion.
- [x] Backend: shared schemas, SQLite, local session/CSRF boundary, report/consent tests, provider adapter.
- [x] Runner: background state machine, cancellation/recovery, fixed Docker checks, safe GitHub publication, preview.
- [x] Journey: actual API probes, observed friction exports and runbook. Authenticated AI Studio prototype/export remains a documented manual acceptance item.
- [x] Verify: unit/type/build checks, browser screenshots, isolated repair proof and real APIs with explicitly synthetic Hindi microphone/screen replay. Physical shopkeeper hardware remains manual.
- [x] Publish: public source repos, no secrets, tested patch draft PR and exact-commit preview. Inventory deployed to Azure Static Web Apps.
