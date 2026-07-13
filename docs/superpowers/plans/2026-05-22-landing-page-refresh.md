# Landing Page Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the VYDRA CORE landing page so it presents the app as both an AI learning platform and a classroom-ready exam preparation system, while keeping the current structure and warm visual identity.

**Architecture:** Update only the landing-page UI in `frontend/pages/index.jsx`, preserving the current section rhythm but rewriting the content hierarchy and component copy. Keep the existing CTA/navigation behavior, extract any repeated content into local data structures where it improves clarity, and verify the new visible copy and hero styling through a frontend build plus a small text-focused test.

**Tech Stack:** Next.js pages router, React, Tailwind utility classes, Node test runner, existing design tokens/styles

---

### Task 1: Add a landing-page content contract test

**Files:**
- Create: `frontend/tests/landing-page-content.test.mjs`
- Test: `frontend/tests/landing-page-content.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('landing page contains the refreshed product positioning hooks', () => {
  const source = fs.readFileSync(new URL('../pages/index.jsx', import.meta.url), 'utf8')

  assert.match(source, /Smarter Learning Starts Here\./)
  assert.match(source, /study from your own material/i)
  assert.match(source, /classroom-ready/i)
  assert.match(source, /proctored/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/landing-page-content.test.mjs`
Expected: FAIL because the updated landing-page content does not exist yet.

- [ ] **Step 3: Add the minimal test file**

Create `frontend/tests/landing-page-content.test.mjs` with the code above.

- [ ] **Step 4: Run test to verify it fails correctly**

Run: `node --test frontend/tests/landing-page-content.test.mjs`
Expected: FAIL with an assertion about missing refreshed landing text.

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/landing-page-content.test.mjs
git commit -m "test: add landing page refresh content contract"
```

### Task 2: Refresh the hero and top-level product messaging

**Files:**
- Modify: `frontend/pages/index.jsx`
- Test: `frontend/tests/landing-page-content.test.mjs`

- [ ] **Step 1: Write the refreshed hero copy and supporting message**

Update the landing-page hero so it uses:

```jsx
const heroWords = ['Smarter', 'Learning', 'Starts', 'Here.']
```

and update the supporting copy to emphasize:

```jsx
VYDRA CORE turns uploaded study material into AI-guided learning for students and classroom-ready assessment, intervention, and support workflows for educators.
```

Also ensure the highlighted first letters use:

```jsx
<span className="text-[#B45309]">{first}</span>
```

- [ ] **Step 2: Refresh the top header hierarchy**

Make the visible `VYDRA CORE` eyebrow larger and more premium:

```jsx
<p className="text-lg font-semibold uppercase tracking-[0.32em] text-[#8a5a36] md:text-xl">VYDRA CORE</p>
```

- [ ] **Step 3: Run the landing content test**

Run: `node --test frontend/tests/landing-page-content.test.mjs`
Expected: may still FAIL because lower sections have not been updated yet.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/index.jsx frontend/tests/landing-page-content.test.mjs
git commit -m "feat: refresh landing hero positioning"
```

### Task 3: Rewrite the product-flow and student/educator sections

**Files:**
- Modify: `frontend/pages/index.jsx`
- Test: `frontend/tests/landing-page-content.test.mjs`

- [ ] **Step 1: Rewrite the product flow card**

Replace the current compact product-flow language with copy centered on:

```jsx
[
  {
    index: '01',
    title: 'Study from your own material',
    description: 'Upload PDFs or notes, reopen them offline, and ask AI questions from the same source base.'
  },
  {
    index: '02',
    title: 'Practice and track performance',
    description: 'Generate quizzes, review answer quality, and monitor progress across real Bloom-level performance.'
  },
  {
    index: '03',
    title: 'Support classrooms in real time',
    description: 'Educators manage classrooms, publish assessments, respond to messages, and intervene when students need help.'
  }
]
```

- [ ] **Step 2: Rewrite the student and educator mode cards**

Update student points so they foreground:

```jsx
[
  'Study from your own material with offline-ready PDFs and AI explanations.',
  'Practice with quizzes generated from the same source material you are learning from.',
  'Track performance and return to the exact materials that need more review.'
]
```

Update educator points so they foreground:

```jsx
[
  'Run classroom spaces with materials, announcements, messages, and live coordination.',
  'Create quizzes manually or from study material, then publish them with schedule and proctoring controls.',
  'Monitor performance, respond quickly, and step in when learners raise concerns or show risk signals.'
]
```

- [ ] **Step 3: Run the landing content test**

Run: `node --test frontend/tests/landing-page-content.test.mjs`
Expected: may still FAIL if the capability section wording has not yet been updated.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/index.jsx
git commit -m "feat: refresh landing role sections"
```

### Task 4: Refresh the capability and trust sections

**Files:**
- Modify: `frontend/pages/index.jsx`
- Test: `frontend/tests/landing-page-content.test.mjs`

- [ ] **Step 1: Update the capability cards**

Use differentiator-led titles and descriptions:

```jsx
[
  {
    title: 'Study from your own material',
    description: 'Turn uploaded PDFs and notes into a reusable study system instead of jumping between disconnected tools.'
  },
  {
    title: 'Classroom-ready workflows',
    description: 'Bring students, educators, materials, and communication into one organized classroom flow.'
  },
  {
    title: 'Proctored quiz delivery',
    description: 'Publish timed quizzes with answer-key grading, scheduling, and protected attempt rules.'
  },
  {
    title: 'Progress and intervention',
    description: 'Move from performance signals to targeted support with progress, alerts, and educator follow-through.'
  }
]
```

- [ ] **Step 2: Refresh the closing platform/trust section**

Update the supporting copy so it emphasizes the connected system:

```jsx
The platform now connects study, assessment, communication, and intervention into one product flow for students, educators, and classroom teams.
```

And update proof rows so they align to real product strengths:

```jsx
[
  'AI learning chat grounded in uploaded study material',
  'Classroom messaging, live coordination, and educator alerts',
  'Manual and generated quizzes with progress-aware follow-through'
]
```

- [ ] **Step 3: Run the landing content test**

Run: `node --test frontend/tests/landing-page-content.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/index.jsx frontend/tests/landing-page-content.test.mjs
git commit -m "feat: complete landing page feature refresh"
```

### Task 5: Verify the refreshed landing page build

**Files:**
- Modify: none
- Test: `frontend/tests/landing-page-content.test.mjs`

- [ ] **Step 1: Run the focused landing-page test**

Run: `node --test frontend/tests/landing-page-content.test.mjs`
Expected: PASS

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build`
Expected: PASS with the repo’s existing ESLint warning and possible offline Google Fonts optimization warning.

- [ ] **Step 3: Review visible UI copy constraints**

Run:

```bash
rg -n "Google Classroom|Google-Classroom|Classroom-style" frontend/pages frontend/components
```

Expected: no matches in visible frontend UI files that power the website pages.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/index.jsx frontend/tests/landing-page-content.test.mjs
git commit -m "chore: verify landing page refresh"
```
