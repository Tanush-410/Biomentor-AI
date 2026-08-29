# Client-Requested Changes — Delivery Log

This document tracks every client-requested change made to VYDRA CORE, in the order the requests came in, with what was actually built/fixed/verified for each. It complements the other documents in this folder (`requirements-document.md`, `deployment-document.md`, `high-level-design-document.md`, `test-plan-document.md`), which describe the product as a whole; this one is a record of *changes* against client asks specifically.

Every item below was verified — either with a live browser test (Playwright), a direct API call against the running backend, a real multi-turn conversation, or a full test-suite run — not just written and assumed correct. Where a fix uncovered a second, related bug, that's noted too, since several of the more serious issues were found this way rather than being reported directly.

---

## 1. Landing and login page: remove marketing content

**Ask:** Strip the descriptive/marketing content from the landing page and login page ("PLS REMOVE ALL").

**Delivered:**
- `frontend/pages/index.jsx` reduced from a full marketing page (feature grids, audience cards, "learning loop" diagrams, proof points) to: header with logo/tagline, two call-to-action buttons, footer. No paragraphs of sales copy.
- `frontend/pages/login.jsx` reduced to the functional sign-in form and the Student/Educator mode toggle, with the descriptive text around each mode removed.
- `frontend/pages/register.jsx`, `forgot-password.jsx`, `reset-password.jsx` kept their functional forms but had incidental descriptive copy trimmed.

## 2. STEM Education section

**Ask:** Add a "STEM Education" section after login for both students and educators, listing the client's specified strategies; show it at the top of every page.

**Delivered:**
- New dedicated page `frontend/pages/stem-education.jsx` (client chose "new dedicated page" over a dashboard banner when asked).
- **Student side** — 8 cards using the client's own wording: voice-based Socratic tutor (with the full language list), 24/7 question/answer/assessment/feedback, virtual classroom STEM labs, self-study STEM labs, SOLO-aligned quiz generation, sticky notes, Anticheat Bot, feedback.
- **Educator side** (role-gated, only shown to educator/admin accounts) — split into two subsections matching the client's grouping:
  - *"AI systems now visible"* — AI Meeting Assistant, AI Educator Copilot, AI Study Coach, Material Intelligence.
  - *"Assessment, proctoring, certificates"* — Exam Maker, Anticheat Bot, Certifications, Automated progress reports.
- A `STEM Education` badge (`frontend/components/StemEducationBadge.jsx`) added to every page's header — landing, login, register, forgot/reset password, and the authenticated app shell (`AppShell.jsx`), so it's visible everywhere as asked.
- After the client's follow-up ("where is the text for students and teachers"), the post-login redirect was changed so `/stem-education` is now the **first page a user lands on after logging in** (both roles), rather than requiring a click into the nav — `frontend/pages/login.jsx`. Verified live: register → login → lands on `/stem-education`.

## 3. Client-supplied infographic

**Ask:** Add the provided infographic image next to the student/educator login page, no explanatory text around it.

**Delivered:** Wired into `frontend/pages/login.jsx` (`frontend/public/stem-education-hero.png`) with a graceful `onError` fallback that hides the image block entirely if the file is ever missing, so a missing asset can never break the login page layout. Width/height corrected to the artwork's real aspect ratio (1037×653) to avoid a distortion flash on load.

## 4. Tagline instead of full rename

**Ask (clarified):** "Name the application as an intelligent AI-driven teaching and studying application" — client chose to add this as a tagline rather than rename the product.

**Delivered:** Product name kept as **VYDRA CORE**; tagline "An intelligent, AI-driven teaching and studying application." added under the wordmark on the landing page and carried through to the login/register pages.

## 5. Footer on every page

**Ask:** "© 2026 VYDRA CORE. All rights reserved." on every page.

**Delivered:** `frontend/components/Footer.jsx`, rendered from the landing page, every auth page, and `AppShell.jsx` (which every authenticated page uses) — so it reaches all ~43 pages in the app. This surfaced a real bug (see §9).

## 6. Bug report: "login is troubling"

**Ask:** Client reported login problems on the live site.

**Investigation:** Verified end-to-end against the real production backend (register → login → authenticated request) — the login mechanism itself worked correctly. Root cause: Render's free tier spins the backend down after ~15 minutes idle, and the first request after that takes 30–60 seconds to wake it — with no loading feedback, that reads as "broken," not "slow."

**Delivered:** `frontend/pages/login.jsx` and `register.jsx` now show "Still working — the server can take up to a minute to wake up if it has been idle. Please wait, no need to refresh." if the request runs past 4 seconds, so the wait is explained instead of silent.

## 7. Bug report: "educator chatbot has been missing"

**Ask:** Client reported the chatbot (Learning Chat) missing from the educator side.

**Root cause:** `frontend/components/AppShell.jsx`'s educator navigation list was missing the Learning Chat entry (present for students, absent for educators).

**Delivered:** Added `{ href: '/learning-chat', label: 'Learning Chat', ... }` to the educator nav list.

## 8. Deployment

**Ask:** Provide deployment steps (client chose "written steps," not a code export or Claude executing the deployment).

**Delivered:** `README.md` → *Production Deployment: Vercel + Render* section — full environment variable lists for both platforms, cold-start behavior explained, and a troubleshooting section ("If login doesn't work for someone") covering the actual verified rate-limit/lockout numbers in the code. Updated again once the client confirmed the app was already live, to point at the real URLs instead of a generic template, and again to document the `SMTP_*`/`FRONTEND_BASE_URL` variables required for password-reset emails to actually send (see §11).

## 9. Real bug found while wiring the footer: transparent footer never worked

Not something the client reported directly — found while implementing §5. `AppShell.jsx` passed `className="border-t-0 bg-transparent"` to `Footer`, intending a transparent footer that blends into each page's own background. It never worked: two Tailwind utility classes targeting the same CSS property have equal specificity, and the compiled stylesheet happened to place `bg-white/80` (the default) *after* `bg-transparent`, so the override silently lost every time — on every single authenticated page in the app. Fixed by giving `Footer` explicit `dark`/`transparent` boolean props that swap in a fully separate class string instead of relying on override order. Verified with a live dashboard screenshot after register/login.

---

## Feature build-out (deferred, then delivered)

The client's brief described three features — a voice-based Socratic tutor, an AI whiteboard, and a "10 agents" Socratic study system — that didn't exist in the code yet. Rather than write marketing copy claiming they existed, the client agreed to build them for real once everything else above was handled.

## 10. Voice-based Socratic tutor

**Ask:** A voice tutor available in 4 Indian languages that both speaks and understands the student.

**Delivered:**
- New page `frontend/pages/socratic-tutor.jsx` — language picker, topic/document picker, microphone input (Web Speech API `SpeechRecognition`), spoken responses (`SpeechSynthesis`), text-input fallback for unsupported browsers.
- New backend endpoints under `/api/socratic` (`start`, `{id}/respond`, `{id}/end`, `{id}`), a new `SocraticSession` database model, and full auth/ownership checks.
- The tutor never states the answer — it asks the next question. Verified across a real multi-turn session that SOLO level correctly progressed from Unistructural to Extended Abstract as answers got structurally richer.
- Languages: started at the requested 4 (Hindi, Tamil, Telugu, Kannada) plus English, then expanded on a later request to 12 total — added Bengali, Marathi, German, Portuguese, Dutch, Chinese, and Japanese, each with real translated encouragement phrasing (not just an English fallback). Verified live: German, Chinese, Japanese, Bengali, and Dutch sessions all produced grammatically correct AI-generated questions in the target language.

## 11. AI whiteboard

**Ask:** A whiteboard as part of the Socratic tutor experience — freeform drawing plus AI-generated diagrams (client's chosen direction over a plain sketch pad or full live multi-user collaboration).

**Delivered:** An HTML5 canvas on the tutor page the student can draw on freehand, shared with a `DiagramAgent` that decides when a visual would genuinely help and pushes plain geometric shapes (rectangles, circles, arrows, labels — not a generated image) onto the same canvas. Verified live: a misconception about the water cycle produced a real AI-drawn diagram (ocean → evaporation arrow → cloud) alongside the correction.

## 12. The "10 agents" Socratic system

**Ask:** A literal multi-agent pipeline (client's choice over "just build one strong tutor").

**Delivered:** Ten distinct, separately-invokable agents, split by whether they need a database session:
- **Model-facing (`backend/app/agents/socratic_agents.py`)** — Question, SOLO-response classification, Misconception detection, Hint, Encouragement, Diagram, Recap, and (added later, see §14) Clarifying-question detection.
- **Database-backed (`backend/app/services/socratic_tutor.py`)** — Retrieval (grounds every turn in the student's own uploaded material), Gap-linking (steers an unfocused session toward the student's weakest known topic, reusing the existing Gap Analysis engine), and the Session Orchestrator that sequences all ten per turn.

A genuine design bug was caught only through live multi-turn testing, not unit tests: the first version used the SOLO classifier's structural-complexity score as part of the "is the student struggling" signal — but a *correct* one-fact answer to a simple question is *supposed* to score low on structural complexity, so real answers kept getting misread as struggles, and the tutor never progressed past hints. Fixed by driving correctness off the misconception check instead of phrasing complexity.

A second bug, reported directly by the client after using the live tutor: answering "I don't know" got the response "Good effort" — nonsensical. Root cause was two-fold: (1) a plain "I don't know" has no factual content for the misconception checker to flag, so it was wrongly treated as a fine attempt; (2) even after fixing that, the encouragement logic required *two* consecutive struggles before switching to a sympathetic tone, so a first-time struggle still fell through to the generic line. Both fixed and verified live.

---

## Full audit ("check for bugs in gap analysis and everything, fix it all")

Requested after the feature build-out: verify Gap Analysis specifically, then a full sweep of the rest of the app.

## 13. Gap Analysis

Tested end-to-end with real data rather than just reading the code: uploaded a document, took two quizzes (2/4 then 4/4 correct) and a Learning Chat quick check, and confirmed the topic-level mastery aggregate (75%, 6/8 correct across both sessions), the trend chart (two correctly-ordered points), and the SOLO-level breakdown all computed correctly. No bug found here — likely already fixed by earlier work in this project before this audit.

## 14. Security audit

Four parallel focused audits (auth, exam/anticheat, classrooms/certifications, frontend↔backend field consistency) found:

- **Rate-limiter bypass (high severity):** `enforce_rate_limit` trusted a client-supplied `X-Forwarded-For` header outright — anyone could get a fresh rate-limit bucket on every request just by changing that header, defeating the limit on login, registration, and password reset entirely. Fixed to use Cloudflare's `CF-Connecting-IP` (which Cloudflare overwrites at its edge and a client cannot spoof, and this app is always served through Cloudflare).
- **Missing JWT-secret startup check:** `SECRET_KEY` silently defaulted to `"changeme"` with nothing verifying it was overridden before the app started serving traffic. Added a fail-fast startup check — verified safe to add by confirming a real production-issued token does *not* verify against the default, before deploying the guard.
- **Password-reset timing side-channel:** `/auth/forgot-password` always returns the same generic message (so it can't be used to check whether an email is registered) — but it sent the reset email synchronously only when the account existed, so the "exists" case took a real SMTP round trip while the "doesn't exist" case returned instantly, letting an attacker distinguish the two via response timing despite the identical message. Fixed by moving the email send to a background task. Verified by pointing SMTP at an unreachable address and confirming both cases now return in ~8ms regardless.
- **Exam grading (high severity, most user-facing):** manually-authored multiple-choice exam questions had no way to mark the correct option — only a shared free-text field labeled for "AI-assisted review," with nothing telling an educator to type the bare option letter the grader actually needs. Any educator who typed a real answer there instead got every student's correct answer graded wrong, silently. Added a proper "mark correct option" control and a submit-time check. A related bug: a teacher's manual score correction on a multiple-choice question was saved but never actually applied to the released score. Both fixed and verified with a full live classroom → exam → student attempt → teacher review flow.
- **Certificate issuance authorization (medium severity, 3 findings):** a certification with every step marked optional was instantly "ready" with zero progress; certificates could be issued to a student never enrolled in the classroom. Both fixed and verified live — issuing to a non-enrolled user now correctly 404s, and an all-optional certification correctly requires actual completion before reaching "ready."

## 15. "Make the voice tutor smarter"

- Added a **ClarifyingQuestionAgent**: previously every student message was run through misconception-detection and grading, even a genuine question like "wait, what does chlorophyll mean?" — producing confusing feedback and never actually answering what was asked. Now the tutor detects a real question, answers it directly, and returns to its pending question afterward. Verified live, including confirming a real answer attempt immediately after still goes through normal grading with no false positive.
- Deepened retrieval (top_k 5→8) and conversation history considered when asking follow-ups (6→10 turns).

## 16. "Make Learning Chat smarter"

- Deepened context window (6→8 retrieved passages, 9,000→12,000 characters) and conversation memory (6→10 turns) for richer answers to complex/multi-part questions.
- Upgraded the fallback image-generation tier (Pollinations — the tier most illustrations actually come from today, since Gemini generation isn't configured in this deployment) to its higher-quality `flux` model and a larger canvas.

---

## Visual polish

## 17. Landing page redesign

Went through three iterations based on direct feedback:
1. First pass: dark hero band with a static constellation graphic in one corner.
2. Feedback — "banner looks weird, not complete; make the constellation full-page and mouse-interactive; change the subheading." → merged into one continuous dark canvas top to bottom, widened the constellation to cover the full viewport across three parallax depth layers that respond to cursor movement, changed the headline to "AI Quantum Learning Platform."
3. Feedback — "make it light grey instead, keep the constellation, match the app's font colors." → switched to a light gray gradient background matching the rest of the app's own theme, recolored the constellation from gold to near-black ink with a warm gold glow (gold-on-light-gray had much weaker contrast than gold-on-black), and reverted all text/button colors to the app's established light-theme palette.

A real bug was found and fixed during the second pass: the connecting lines between constellation nodes had never actually been rendering, on any version — the distance threshold for drawing a line between two nodes was set before the graphic was widened to full-page coverage, and the real minimum distance between any two nodes turned out to be just above that threshold. Confirmed by computing every pairwise distance directly rather than guessing, then re-tuned.

## 18. "VYDRA CORE" heading size and page texture

- Landing page wordmark enlarged (`text-sm` → `text-2xl`/`text-3xl`).
- Added a fine film-grain texture across every page. First attempt used `mix-blend-mode: overlay`, which is mathematically a no-op at color extremes — meaning it was essentially invisible on the app's many near-white pages (only visible on the dark landing hero), which is exactly what the client's follow-up feedback caught. Fixed by switching to plain opacity compositing with a higher-contrast noise pattern, which stays visible regardless of the underlying page color. Verified with pixel-level sampling on both a white dashboard card and the dark landing hero.

---

## Earlier this cycle: platform-level upgrades (client-requested, pre-dating the requirements brief above)

- **SOLO Taxonomy migration:** replaced Bloom's Taxonomy (6 levels) with SOLO Taxonomy (5 levels: Prestructural, Unistructural, Multistructural, Relational, Extended Abstract) throughout the entire application — classifier, question generation, quiz/exam grading, dashboards, and an idempotent database migration for existing data.
- **Real semantic embeddings:** replaced a hashed bag-of-words pseudo-embedding with `fastembed` (BAAI/bge-small-en-v1.5), with Qdrant point-ID and payload-index bugs fixed once a real working Qdrant cluster was available to test against.
- **Quiz/exam grading consolidation:** personal quizzes and classroom quizzes previously graded independently and could drift apart; consolidated into one shared `grade_mcq_session` function, which also fixed a real bug where a mixed-difficulty quiz attributed every answer to one SOLO level instead of the level of the specific question answered.
- **PDF/text extraction:** rewritten on `pypdfium2` with a per-page OCR fallback (`pytesseract`) for scanned/image-based pages, replacing a extraction pipeline that silently produced empty or garbled text for many real PDFs.
- **Dead code removal** and a **Groq model deprecation fix**: found while building the Socratic tutor — Groq had removed `llama-3.3-70b-versatile` from their catalog, so every AI-generated answer across the entire app (Learning Chat, quiz generation, quiz quality review) had been silently falling back to degraded non-AI templates. Replaced with the current equivalent model and verified against the live API.
