# Interview demo review

Reviewed 5 October 2026: application source, API routes, contracts, query engine, tests, deployment configuration, and the deployed site's initial render and read-only AI status.

## Fixed in this working tree

- **Incorrect analytical answers:** fallback execution previously used a grouped SUM plan regardless of the displayed SQL (AVG, totals, top-N, or raw records). SQL and fallback execution now share one plan. Successful AI SQL executes as returned instead of substituting a heuristic query. Arbitrary AI SQL no longer offers an unrelated widget; adding these answers faithfully to the dashboard needs a query-backed widget contract.
- **Browser SQL execution:** a direct cross-origin DuckDB Worker URL could fail browser security checks. The worker now starts from a blob, and failed initialization can retry. A browser test exercises a filtered SQL average through the real WASM database.
- **Blank CSV and Excel exports:** original display headers were used to look up sanitized row keys. Values now follow the sheet's column mapping. Downloads preserve typed-array byte bounds.
- **Missing table rows:** query plans fetched only one page of records even though sorting, searching, and pagination happen in the client. They now fetch the dataset up to the existing 10,000-row cap.
- **Percentage KPI:** fractional values such as 0.6 displayed as 0.6%. Percentage specifications now explicitly scale by 100.
- **AI refinement:** the current dashboard is included in the model prompt. Adding a chart no longer also converts an existing chart; conversion requests do not also insert one.
- **Provider credential routing:** endpoint/provider/model headers are ignored unless accompanied by a client key, preventing caller-controlled endpoints from receiving the server's key. Provider-specific models are selected correctly, and DISABLE_LLM is honored. AI calls have a 20-second timeout and one retry; query fallback is labeled.
- **Upload and dataset controls:** the navbar upload input remains mounted when ingestion is collapsed; uploaded files are read as bytes; oversize files are rejected before reading. The UI correctly states the 10 MB limit. Field selection also removes recommendations for deselected columns.
- **UI reliability:** answer summaries avoid unsupported ranking/total claims. Query execution failures surface as errors. AI components are remounted for dataset changes. KPI annotation contrast was corrected. The inspector defaults closed on small screens and overlays the canvas when opened; icon-only actions have accessible labels.
- **Verification:** lint excludes vendored assistant skills and browser reports. Browser tests now assert actual pagination, filtering, downloads, upload, query execution, and refinement/undo instead of conditionally skipping actions.

## Remaining issues and demo constraints

1. **High — deployed share persistence is not guaranteed.** `apps/web/lib/share/store.ts` silently falls back to a process-local Map if Supabase is absent or an insert fails. Netlify functions can run in separate processes or lose memory. Configure a durable store and verify the migration and credentials before demonstrating share links. Production storage failures should be explicit rather than returning a link that may disappear. The deployed storage configuration was not available for this review.
2. **High — share access policies need tightening before sensitive data is shared.** The migration's public SELECT policy allows reads of all active share records, without requiring a token predicate. Anyone with access to the public Supabase client credentials can query active records directly. Share creation and revocation routes do not verify identity; revocation uses possession of the public read token. Use server-only token lookup plus a separate management capability or verified owner identity.
3. **Medium — arbitrary AI query results cannot yet be saved faithfully as widgets.** Their filters and expressions are not represented in the current widget contract. Results and SQL can be demonstrated; use Refine for AI-created dashboard widgets. The deterministic demo path supports Add to Dashboard for its structured queries.
4. **Medium — several advertised features are not connected to the home page.** Widget editor/actions, template save/library, and drift-resolution components exist and have tests, but are not imported into the active product flow. Avoid claiming these are available in the demo UI until wired in.
5. **Medium — large uploads can block the UI.** Parsing, normalization, and profiling are called on the main browser thread. A Web Worker would keep the loading state responsive for large files. Use the supplied samples or a rehearsed modest-sized workbook this week.
6. **Medium — AI spend controls are per-process.** In-memory IP rate limits do not provide a shared cap across serverless instances. The connection-test POST route also lacks rate limiting. A durable limiter/budget is needed for a publicly promoted deployment.
7. **Medium — documentation overstates some guarantees.** SQL safety uses regex validation, not an AST parser. The README advertises Anthropic/CHAT_MODEL, although provider resolution supports OpenAI, xAI, and compatible endpoints. Render timing is measured before React paints and is not actual render duration. CSP allows unsafe-eval; do not describe it as a fully strict policy. Custom endpoints with client keys also need URL restrictions if exposed publicly.

## Suggested interview flow

1. Load Project Pipeline and explain browser ingestion → normalization → profiling → validated dashboard JSON → generic renderer.
2. Filter Stage, show KPI recalculation, reset, and paginate Raw Records.
3. Upload a small prepared CSV with readable headers.
4. Ask a numerical question with a known expected answer, inspect SQL, and show the result table. Confirm AI connection before the interview; a configured key alone does not prove successful model calls.
5. Refine the dashboard title or add a chart; demonstrate undo.
6. Export CSV and open it to show preserved headers and values.
7. Demonstrate sharing only after checking durable storage on the deployment, including opening the link in a fresh browser session.

The deployed site loaded without page errors during inspection. Its status endpoint reported OpenAI / gpt-4o-mini from server environment configuration. No changes were pushed or deployed during this review, and no live model call or share creation was made on the production site.

## Verification results

- 666 unit/integration tests passed across 56 test files.
- 18 browser checks passed across desktop Chromium and Mobile Chrome, including two accessibility audits per browser configuration.
- The browser SQL check uses a stubbed AI response and the real DuckDB-WASM engine. Provider-generation tests mock the model; production model connectivity and production sharing still need live verification.
- Typechecking and production build passed. Lint passed with 0 errors and 141 existing security-plugin warnings; no lint rules were disabled.
