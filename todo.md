# Single-room Sli change checklist

- [ ] Locate all room, agent, character, and navigation definitions.
- [ ] Identify the canonical Sli room ID and preserve its behavior.
- [ ] Remove UI entries and routing paths for the other rooms.
- [ ] Restrict backend/config selection to Sli without breaking API contracts.
- [ ] Update affected tests and documentation.
- [ ] Run the full relevant test suite and frontend build.
- [ ] Review the final diff and prepare a commit summary.

## Email system code audit

- [ ] Map Gmail, OAuth, SMTP, mail-sending, password-reset, and notification code paths.
- [ ] Identify required environment variables and where secrets are read or exposed.
- [ ] Check callback URL validation, CSRF/state handling, session/token storage, and scope minimization.
- [ ] Inspect email-related routes, UI, error handling, rate limits, and audit logging.
- [ ] Review tests and run safe static checks without opening or modifying real email.
- [ ] Write an evidence-based audit summary with severity and concrete remediation steps.

## Render deployment repair

- [ ] Verify the Render service identity and current deployment source.
- [ ] Compare the deployed production content with GitHub commit `41b9cb3`.
- [ ] Fix repository, branch, auto-deploy, or manual deploy configuration as needed.
- [ ] Monitor the build and confirm the deployment becomes healthy.
- [ ] Re-check production room count and manifest after deployment.
- [ ] Record the final deployment status and any required user action.

## Production QA test matrix

- [ ] Check production availability, headers, manifest, and single-room content.
- [ ] Exercise landing-page navigation and visible theme controls without submitting credentials.
- [ ] Exercise safe room-entry behavior and unauthenticated redirects.
- [ ] Probe public health/status endpoints and expected unauthorized responses for protected endpoints.
- [ ] Check OAuth route configuration responses without completing an external login.
- [ ] Capture desktop/mobile rendering and inspect console/network errors.
- [ ] Produce a pass/fail report with severity, evidence, and recommended fixes.

## Sli chat route adjustment

- [ ] Check current production handling for `/`, `/chat`, `/chat/:roomId`, and `/silelo-neo-connect`.
- [ ] Preserve the real Sli chat flow and avoid adding fake automatic replies.
- [ ] Add or correct route handling and refresh fallback only where needed.
- [ ] Ensure landing-page links point to the canonical Sli chat URL.
- [ ] Test public routes, safe unauthenticated behavior, and mobile layout.
- [ ] Review the diff and prepare a clear change summary.

## Real platform implementation

- [ ] Audit current UI routes, Agent, Tasks, Tools, connectors, files/artifacts, settings, and model configuration.
- [ ] Inspect enabled connector permissions and required OAuth/API scopes before wiring actions.
- [ ] Define real API contracts, persistence boundaries, and permission checks for each module.
- [ ] Implement UI/UX and module flows without mock records or fake success states.
- [ ] Implement Agent and Tasks execution, status, cancellation, retry, and audit behavior.
- [ ] Implement Tools, Plugins/Connectors, Files/Artifacts, and Settings with real capability gating.
- [ ] Implement OpenRouter retry/fallback across exactly eight configured models with safe secret handling.
- [ ] Test authorized and unauthorized paths, failure recovery, mobile UI, and production behavior.
- [ ] Document unavailable permissions, required user approvals, and deployment steps.

## SILELO Manus archive review

- [ ] Extract `silelo-manus-app.zip` into an isolated workspace.
- [ ] Identify framework, entry points, build scripts, routes, and environment expectations.
- [ ] Compare feature and file coverage with the connected GitHub repository.
- [ ] Check whether the archive contains newer Sli chat, Agent, Tasks, connectors, files, settings, or model fallback code.
- [ ] Do not overwrite GitHub or Render until the source of truth is confirmed.
- [ ] Summarize findings and recommend the next safe merge or replacement step.

## Repository target change — 2026-09-08

- [ ] Confirm repository `silelo` owner and active GitHub permission.
- [ ] Push `manus-app-migration-20260905` to `silelo` under a non-main branch.
- [ ] Create and verify a Pull Request against `main`.
- [ ] Confirm Render deployment source before any production switch.
- [ ] Report migration handover status and remaining real-platform implementation work.
