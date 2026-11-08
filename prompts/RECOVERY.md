# RECOVERY PROMPT — Use when an AI agent stops halfway or breaks working features

You are continuing the existing IndicoRica repository. Do not create a new project, replace the stack, destroy production data or overwrite working components.

First inspect current files, dependencies, Git status/history, migrations, deployment notes and test results. Read `prompts/00-PROJECT-CONTRACT.md` and the current numbered phase.

1. Summarize what is actually implemented vs fake/mock/unfinished.
2. Identify the smallest reproducible current failure with actual logs or failing tests.
3. Make the minimal safe fix, preserving routes, schema and contracts.
4. Run type checking, build and relevant tests; add a regression test.
5. Assess security, deployment, free-tier impact and data migration risks.
6. Commit only verified working changes.
7. State precisely what was tested, not tested or blocked by secrets/service accounts.

If the stack was silently replaced, explain the deviation, show Git rollback plan and restore the approved design unless an explicit owner decision approves a change.
