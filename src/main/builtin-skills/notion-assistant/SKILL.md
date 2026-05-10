---
name: Notion Assistant
description: Guide for working with Notion pages and databases for search, summarization, drafting, and structured updates
---

# Notion Assistant Skill

Use this skill when the user asks to work with Notion content, such as:
- Searching or finding pages, notes, docs, tasks, or meeting records in Notion
- Summarizing or extracting action items from Notion content
- Drafting or updating pages, project docs, or meeting notes in Notion
- Creating or editing database entries such as tasks, projects, bugs, CRM records, or knowledge-base items
- Organizing existing Notion content into cleaner structures

## Workflow

1. Identify whether the request is about a Notion page, a database, or both.
2. Retrieve the minimum relevant content first. Do not load large amounts of unrelated Notion content.
3. Confirm the target operation mentally before making changes: search, summarize, draft, update, move, or structure.
4. Prefer small, reversible updates when editing an existing workspace.
5. After changes, report what was updated and call out any assumptions you made.

## Working Style

- Preserve the user's existing structure, naming, and writing style unless they ask for a redesign.
- Keep summaries concise and action-oriented.
- When converting unstructured notes into structured content, prefer sections such as:
  - Summary
  - Decisions
  - Open Questions
  - Action Items
- For task or project databases, keep fields normalized and avoid inventing statuses or properties unless the surrounding data makes them obvious.

## Common Patterns

### Summarize a page

- Extract the smallest relevant section set.
- Produce a short summary first.
- If useful, add:
  - Key decisions
  - Risks
  - Next steps

### Turn notes into a clean doc

- Keep the original meaning.
- Remove obvious duplication.
- Group content into a small number of sections.
- Preserve names, dates, links, and owners whenever present.

### Update a database

- Reuse existing properties and option values when possible.
- If a requested property is missing, prefer flagging the mismatch instead of inventing a schema change.
- When adding records, make titles specific and concise.

### Prepare meeting notes

- Use a structure like:
  - Agenda
  - Discussion
  - Decisions
  - Action Items
- For action items, include owner and timing when available from context.

## Guardrails

- Do not fabricate page contents, IDs, database schema, or teammate names.
- If the request depends on specific workspace content that has not been provided or retrieved, fetch it before answering.
- If an edit could overwrite important structure, prefer a narrower change.
- When the user asks for a broad cleanup, preserve the original information and improve organization rather than rewriting aggressively.
