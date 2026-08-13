# General Playwright MCP Testing Guidance

Project-agnostic conventions for browser-level verification with the Playwright MCP server. Copy this into any project and adapt the environment specifics.

## Start With The Diff

Do not open the browser until the coverage plan is grounded in the current change set.

Before browser testing:

- inspect `git diff --name-only` and `git diff --stat`
- read the changed files, not just the filenames
- map changed frontend routes/components to the user-visible flows they affect
- map changed backend handlers to the corresponding frontend page flow
- map changed shared helpers to every page or route that consumes them

The browser plan comes from the diff. If a changed file can affect multiple flows, test each affected flow or state the untested risk explicitly.

## Test Every Modified Or Impacted Path Thoroughly

Thorough coverage is required, not optional. Every code path that was modified — or that could be impacted by the change — must be exercised in the browser.

This means:

- every route, component, handler, and shared helper touched by the diff
- every caller of a changed shared function, not just the one the change was "for"
- every adjacent flow that could regress because of the change
- every branch inside each of those flows (not just the happy path)

If a path was not tested, say so explicitly. Do not imply full coverage.

## What Playwright MCP Should Cover

Do not stop at the happy path. For every affected flow, exercise all meaningful branches, including:

- success states
- validation failures from bad or incomplete input
- empty states
- permission/auth failures
- loading states when they are visible to the user
- error states caused by rejected requests, invalid data, or failed backend actions
- navigation outcomes, including redirects and blocked transitions

If a change introduces a new branch in the UI or route behavior, that branch should be tested directly.

## Test The Failure Paths On Purpose

For every changed form, action, or workflow, deliberately try inputs that should fail instead of only proving that correct input works.

Examples of failure-path checks:

- submit with missing required fields
- submit malformed values
- submit values that violate length or format rules
- attempt actions while logged out
- attempt actions without the required role or ownership
- repeat an action that should no longer be allowed
- load a page with missing, invalid, expired, or revoked identifiers

The goal is not just to confirm that the backend rejects bad input. The goal is to confirm that the user gets a clear, usable response in the browser.

## Evaluate The Error Experience, Not Just The HTTP Result

When a flow hits a failure case, check what the user actually sees:

- Is an error shown at all?
- Is the error visible without needing to inspect the console or network tab?
- Is it placed in the right location?
- Is the message understandable to a normal user?
- Does it explain what went wrong in plain language?
- Does it tell the user what they can do next?
- If the error is field-specific, is it shown near the relevant field?
- If the error is form-level, is it styled clearly and distinct from normal content?
- Does the UI recover correctly after the error?
- After correcting the input, can the user retry successfully?

A response can be technically correct and still be a poor user experience if the message is vague, hidden, or awkwardly presented.

## Screenshot Capture Is Required

Every Playwright MCP browser flow should leave behind a step-by-step screenshot trail that can be turned into a review video.

### Browser Resolution

Run the browser at **1920x1080** for every test session. Set this before the first navigation so every screenshot in the run is captured at the same resolution. This keeps title cards, form layouts, and final-state screens visually consistent and stitches cleanly into a single video without letterboxing or rescaling artifacts.

In Playwright:

```ts
await page.setViewportSize({ width: 1920, height: 1080 })
```

Or via Playwright MCP: call `mcp__playwright__browser_resize` with `width: 1920, height: 1080` at the start of the session. Do not change the viewport mid-run.

### Run directory

Create a dedicated run directory per feature under `test_screenshots/`, for example:

- `test_screenshots/2026-04-23-login-validation/`
- `test_screenshots/2026-04-23-admin-node-edit/`

All paths tested for a single feature go into the **same** run directory so they can be stitched into one video per feature.

### Title Card Screenshots

Every test within a run must begin with a **title card screenshot** — a dedicated image whose only purpose is to tell the reviewer what the next sequence is testing.

Requirements:

- render the title card in the browser (e.g. navigate to a blank page and inject large, legible text via `page.evaluate` or `page.setContent`)
- the card must explicitly state:
  - the feature being tested
  - the specific path/branch being exercised (e.g. "Login — invalid password — error state")
  - whether this is a success or failure path
- capture it as a screenshot with the same naming scheme as other frames
- insert a new title card before each distinct path within the run (success path, each failure path, each edge case)

Example title card content:

```
Feature: Login
Path: Invalid password
Expected: Inline error, form remains editable
```

### Naming

Use zero-padded filenames so lexical sort matches execution order:

- `001-title-login-happy-path.png`
- `002-open-login.png`
- `003-fill-email.png`
- `004-fill-password.png`
- `005-submit-login.png`
- `006-logged-in-dashboard.png`
- `007-title-login-invalid-password.png`
- `008-open-login.png`
- ...

### When To Capture

Take a screenshot after:

- the title card for the current path
- the initial page load for the flow
- **every single input, one per field, before moving to the next field or submitting** — the reviewer must be able to see each value land in the form
- each submit/click that advances or mutates state
- each visible success, error, loading, empty, or permission state
- each important navigation result or redirect

Do not batch multiple fills into a single screenshot. If three fields are filled, there should be three screenshots, not one taken after the last fill. A good run lets the reviewer watch the form get populated field by field instead of teleporting from an empty form to a submitted form.

### Skip Login/Registration Screenshots For Unrelated Tasks

Do not capture screenshots of the login, register, forgot-password, or reset-password pages when the task under test is something else. Logging in is plumbing for those runs, not the subject, and the screenshots add noise to the review video.

Only capture login and registration screenshots when the task being verified is itself a login, registration, password, or auth-flow change. In that case the auth UI **is** the subject and every input, error, and state transition should be screenshotted as usual.

When logging in as setup for another flow, start the screenshot sequence at the title card for the real task, not at `/login`.

### Recommended Playwright Pattern

Keep Playwright MCP actions small and save screenshots directly from the browser context into the run directory.

```ts
// Title card
await page.setContent(`
  <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
    <div style="text-align:center;">
      <h1 style="font-size:64px;">Feature: Login</h1>
      <h2 style="font-size:40px;">Path: Invalid password</h2>
      <p style="font-size:28px;">Expected: Inline error, form remains editable</p>
    </div>
  </body></html>
`)
await page.screenshot({ path: 'test_screenshots/2026-04-23-login/007-title-login-invalid-password.png', fullPage: true })

// Then drive the actual test
await page.goto('http://localhost:5173/login')
await page.screenshot({ path: 'test_screenshots/2026-04-23-login/008-open-login.png', fullPage: true })

await page.getByLabel('Email').fill('user@example.com')
await page.screenshot({ path: 'test_screenshots/2026-04-23-login/009-fill-email.png', fullPage: true })

await page.getByLabel('Password').fill('wrong-password')
await page.screenshot({ path: 'test_screenshots/2026-04-23-login/010-fill-password.png', fullPage: true })

await page.getByRole('button', { name: 'Log in' }).click()
await page.screenshot({ path: 'test_screenshots/2026-04-23-login/011-invalid-password-error.png', fullPage: true })
```

Long, monolithic scripts are harder to debug and make it easier to miss the screenshot trail.

## One Video Per Feature, Covering Every Path

After the screenshot run is complete, stitch the ordered images for the feature into a **single review video** that walks through every path that was tested.

- one feature = one run directory = one video
- the video shows all paths in order: success path first, then each failure/edge-case path
- each path inside the video is introduced by its title card so the reviewer can see the context shift
- all states covered (success, validation failure, permission failure, empty, loading, error, navigation) live inside that one video

This lets a reviewer watch a single artifact end-to-end and see the full story of the feature under test, rather than juggling multiple clips.

### Stitching Script

Use `scripts/stitch-playwright-screenshots.sh` to produce the review video:

```bash
bash scripts/stitch-playwright-screenshots.sh <run-directory> [name-prefix]
```

- `<run-directory>` — path to the screenshot run directory to stitch
- `[name-prefix]` — optional; overrides the output filename prefix (defaults to the basename of the run directory). Only affects the output filename, not the screenshots themselves.

Examples:

```bash
# Output: test_videos/2026-04-23-login-<timestamp>.mp4
bash scripts/stitch-playwright-screenshots.sh test_screenshots/2026-04-23-login

# Output: test_videos/login-validation-<timestamp>.mp4
bash scripts/stitch-playwright-screenshots.sh test_screenshots/2026-04-23-login login-validation
```

What it does:

- reads every `.png` / `.jpg` / `.jpeg` / `.webp` in the run directory in lexical order
- holds each screenshot on screen for `PLAYWRIGHT_STITCH_SECONDS_PER_IMAGE` seconds (default `3`)
- writes a timestamped `.mp4` into `test_videos/`

Environment overrides:

- `PLAYWRIGHT_STITCH_SECONDS_PER_IMAGE` — default hold time per screenshot
- `PLAYWRIGHT_STITCH_OUTPUT_FPS` — output framerate
- `PLAYWRIGHT_STITCH_DURATIONS_FILE` — alternate path to the per-image manifest (see below)

### Per-Screenshot Durations (Manifest)

Individual screenshots can be held longer or shorter than the default by providing a `durations.txt` manifest inside the run directory. The stitching script loads it automatically.

Format — one entry per line, `<filename> <seconds>`:

```
# Title cards get extra time so the reviewer can read them.
001-title-login-happy-path.png 6
007-title-login-invalid-password.png 6

# Final states of each path also get extra time.
006-logged-in-dashboard.png 5
011-invalid-password-error.png 5

# Transitional frames can be shortened.
003-fill-email.png 1.5
004-fill-password.png 1.5
```

Rules:

- `<filename>` is the basename of the screenshot (no directory path)
- `<seconds>` may be an integer or a decimal
- lines starting with `#` and blank lines are ignored
- any screenshot not listed falls back to the default hold time

Recommended pattern:

- title cards: **5–7 seconds** (reviewer needs time to read the label)
- final/result states (success screen, error message, empty state): **4–6 seconds**
- intermediate field fills and transitions: **1–2 seconds**
- default (unlisted): **3 seconds**

Generate and write `durations.txt` as part of the test run so the stitched video paces itself correctly without any manual editing.

## What To Report After Running Playwright MCP

For each tested branch, the final testing summary should describe:

- what path was tested
- why that path was selected from the diff
- whether it succeeded or failed as expected
- the exact user-facing message or screen that appeared for failure cases
- whether the presentation was clear and useful
- the screenshot run directory and stitched video path
- anything that was broken, non-functional, flaky, visually incorrect, or otherwise did not work as intended

If a branch was not tested, say so explicitly instead of implying full coverage.

## Call Out Broken Behavior Clearly

Playwright MCP runs should not only confirm expected behavior. They should also surface anything that appears broken during testing, even if it was not the primary branch being exercised.

Examples worth reporting:

- buttons or links that do nothing
- forms that submit but never show feedback
- loading states that never resolve
- actions that require a refresh before the UI updates
- incorrect redirects or navigation dead ends
- validation that does not appear in the UI
- inconsistent or missing state after a successful action
- flaky behavior that only works on retry
- layout or styling problems that make the page hard to use

When something is broken, the testing feedback should say:

- what the tester tried to do
- what actually happened
- what should have happened instead
- whether the issue was consistent or flaky

Do not compress broken behavior into vague statements like `had some issues` or `seems off`. Be concrete.

## Environment Assumptions

- Prefer reusing the already-running dev app over starting new processes
- API-level `fetch(...)` checks from the browser context can be faster and more reliable than driving the full UI for some validations

## Browser Session Cleanup

- Close the Playwright MCP browser session after testing is complete
- Do not leave extra browser windows or contexts open between sessions
- Keep screenshot runs small and focused — one run directory per feature, not one giant directory for many unrelated flows
