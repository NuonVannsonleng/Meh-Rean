# Course Hub — Frontend Build Specification

## 1. ROLE

You are a senior frontend engineer and UI/UX designer.

Build a polished, production-quality frontend for **Course Hub**, a web application for Cambodian university students to discover courses and share study materials such as lecture notes, past exam papers, and presentation slides.

Do not build a backend yet.

The result should feel like a real product that students would trust and actually want to use, not like a basic school project.

Prioritize:

* Excellent mobile experience
* Fast and simple navigation
* Clean visual hierarchy
* Professional UI
* Accessibility
* Reusable components
* Maintainable TypeScript
* Easy future backend integration
* Smooth but subtle animations
* Khmer + English readiness

---

# 2. PRODUCT IDEA

## Problem

University study materials are often scattered across:

* Telegram groups
* Google Drive
* Personal phones
* Messenger conversations
* Different student groups

Students waste time asking:

> "Does anyone have last year's exam paper?"

or:

> "Can someone send me the lecture slides?"

Course Hub solves this by organizing materials by course.

## Target Users

Primary users:

* Cambodian university students
* Starting with IT Engineering students
* Years 1–4
* Mostly mobile users
* Users commonly access the app from links shared inside Telegram groups

Users may read:

* English
* Khmer

The UI must therefore be prepared for Khmer localization.

---

# 3. CURRENT DEVELOPMENT PHASE

This is **Phase 1 only**.

### Build now

* Frontend
* Mock data
* Course browsing
* Search
* Filtering
* Course details
* Resource browsing
* Mock uploads
* Responsive UI
* Loading states
* Empty states
* Error states

### Do NOT build yet

* Backend
* Database
* Authentication
* Real file storage
* Real API
* Telegram login
* Telegram bot
* Reviews
* Ratings
* Moderation
* Notifications
* Admin dashboard
* Real user accounts

Do not create fake backend functionality.

The application should clearly behave as a frontend prototype.

---

# 4. FUTURE ROADMAP

Keep the architecture ready for these future phases, but do not implement them now.

### Phase 2

Node.js + TypeScript + Express + MySQL

Features:

* Real API
* Real file uploads
* Search
* Persistent resources
* Course management

### Phase 3

Authentication and community features:

* Telegram login
* User accounts
* Anonymous reviews
* Reporting
* Moderation

### Phase 4

Telegram integration:

* Telegram bot
* Course/resource search
* Reminders
* Resource notifications

Design today's code so these features can be added without rewriting the entire frontend.

---

# 5. TECH STACK

Use exactly:

* Vite
* React
* TypeScript
* React Router DOM
* Tailwind CSS v4
* `@tailwindcss/vite`

Do NOT add another UI component library.

Avoid unnecessary dependencies.

Use native React and Tailwind wherever possible.

Icons may be implemented using a lightweight icon solution only if absolutely necessary. Prefer simple SVG icons/components rather than introducing a large UI library.

---

# 6. TYPESCRIPT REQUIREMENTS

Use strict TypeScript.

No:

```ts
any
```

No:

```ts
@ts-ignore
```

No:

```ts
@ts-expect-error
```

unless there is an unavoidable third-party typing issue.

Use proper types for:

* props
* state
* API responses
* form values
* route parameters
* filters
* resource types
* errors

---

# 7. PROJECT STRUCTURE

Use this structure:

```text
src/
├── components/
│   ├── Navbar.tsx
│   ├── CourseCard.tsx
│   ├── ResourceCard.tsx
│   ├── SearchBar.tsx
│   ├── EmptyState.tsx
│   ├── LoadingState.tsx
│   └── ErrorState.tsx
│
├── pages/
│   ├── Home.tsx
│   ├── CourseDetail.tsx
│   ├── Upload.tsx
│   └── NotFound.tsx
│
├── services/
│   └── api.ts
│
├── data/
│   └── mock.ts
│
├── i18n/
│   └── en.ts
│
├── types.ts
│
├── App.tsx
├── main.tsx
└── index.css
```

Keep the architecture simple.

Do not over-engineer it.

---

# 8. DESIGN DIRECTION

The visual style should feel like a modern education/productivity platform.

Take inspiration from the clarity of modern products such as:

* Notion
* Google Classroom
* Linear
* modern university portals
* modern document platforms

Do NOT copy their branding.

Course Hub needs its own visual identity.

## Design principles

* Clean
* Friendly
* Trustworthy
* Modern
* Academic
* Simple
* Fast
* Mobile-first

Avoid:

* excessive gradients
* excessive glassmorphism
* huge shadows
* overly colorful UI
* unnecessary animations
* cluttered dashboards
* tiny text
* complicated navigation

---

# 9. COLOR SYSTEM

Use one primary accent color throughout the application.

Suggested direction:

* Deep blue / indigo primary
* Neutral white background
* Soft gray surfaces
* Dark text
* Muted secondary text
* Light borders

Create the colors as reusable Tailwind classes/tokens where practical.

The accent color should be used for:

* primary buttons
* active filters
* links
* selected tabs
* important actions
* focus states

Resource types can have subtle semantic colors:

* Notes
* Papers
* Slides

Keep these colors restrained.

---

# 10. TYPOGRAPHY

The application must support both English and Khmer.

Use:

* Inter for English
* Noto Sans Khmer for Khmer

Create a font stack that gracefully falls back if the fonts are unavailable.

Text hierarchy should be clear:

* Page title
* Section heading
* Course title
* Metadata
* Body text
* Supporting text

Never make important information unnecessarily small.

---

# 11. RESPONSIVE DESIGN

Mobile-first is mandatory.

The application must look good at:

### 375px

This is the most important breakpoint.

Also test:

* 390px
* 768px
* 1024px
* 1280px
* 1440px+

## Home course grid

Mobile:

```text
1 column
```

Tablet:

```text
2 columns
```

Desktop:

```text
3 columns
```

The layout should never create:

* horizontal scrolling
* clipped buttons
* overflowing text
* broken cards

Long course names and resource titles must wrap correctly.

---

# 12. NAVBAR

Create a sticky top navigation bar.

Desktop:

```text
[Course Hub logo]     Courses     Upload
```

Mobile:

* Compact logo
* Navigation remains accessible
* Do not make the navbar unnecessarily tall

The navbar should:

* remain visible while scrolling
* have a subtle bottom border
* have a clean background
* contain accessible navigation links
* show an active state

Logo:

Create a simple text/icon-based Course Hub identity.

Do not use an external brand logo.

---

# 13. HOME PAGE

Route:

```text
/
```

The Home page is the main discovery experience.

## Hero/header area

Create a welcoming section containing:

### Heading

Something similar to:

> Find your courses. Share your knowledge.

### Supporting text

Explain that students can find lecture notes, past papers and slides in one place.

Keep the copy short.

Add the search bar immediately below.

---

# 14. SEARCH

Create a reusable:

```text
SearchBar
```

Search should filter courses live.

Search against:

* course code
* course name
* lecturer

Examples:

```text
DS201
Database
Operating
Mr. Sok
```

Search should be case-insensitive.

Search should update immediately as the user types.

Add a search icon.

Use a clear input placeholder such as:

> Search courses, lecturers, or course codes...

On mobile, the search input should have comfortable touch size.

---

# 15. COURSE FILTERS

Add filter chips/buttons for:

### Year

* All
* Year 1
* Year 2
* Year 3
* Year 4

### Semester

* All
* Semester 1
* Semester 2

Filters must work together.

Example:

```text
Search: Database
Year: 2
Semester: 1
```

Only matching courses should appear.

Selected filters must have a clear visual state.

Provide an easy way to return to:

```text
All
```

---

# 16. COURSE CARD

Create a reusable:

```text
CourseCard
```

Each card should display:

* Course code
* Course name
* Lecturer
* Year
* Semester
* Resource count if available

Example:

```text
DB201

Database Systems

👤 Dr. Sok Dara

Year 2 · Semester 1

12 resources
```

Card requirements:

* Rounded corners
* Subtle border
* Minimal shadow
* Comfortable padding
* Hover state on desktop
* Tap feedback on mobile
* Entire card should be clickable
* Clear visual hierarchy

Clicking the card navigates to:

```text
/courses/:id
```

---

# 17. EMPTY STATE

Create reusable:

```text
EmptyState
```

Show it when no courses match the search/filter.

Example:

> No courses found

Supporting text:

> Try a different search or remove some filters.

Include a reset filters action.

Do not leave the page looking broken or empty.

---

# 18. COURSE DETAIL PAGE

Route:

```text
/courses/:id
```

Page structure:

```text
← Back to courses

DS201
Database Systems

Dr. Sok Dara

Year 2 · Semester 1
```

Use a clean course header.

---

# 19. RESOURCE TABS

Create tabs:

```text
All
Notes
Papers
Slides
```

Each tab displays a count.

Example:

```text
All 8
Notes 3
Papers 3
Slides 2
```

Tabs must actually filter the displayed resources.

The active tab must have a strong visual state.

Tabs must work well on mobile without overflowing.

---

# 20. RESOURCE CARD

Create:

```text
ResourceCard
```

Each resource should display:

* Resource title
* Resource type
* Uploaded by
* Upload date
* Download button

Example:

```text
Midterm Review Notes

NOTES

Uploaded by Vannak
Sep 12, 2026

[Download]
```

Resource type badges:

```text
Notes
Paper
Slides
```

Download button should use the supplied `fileUrl`.

For the mock project, the URL may point to a placeholder file/resource.

Do not pretend that a real uploaded file exists.

---

# 21. UPLOAD PAGE

Route:

```text
/upload
```

Create a professional upload form.

Fields:

### Course

Select from available courses.

### Resource type

Options:

```text
Note
Past Paper
Slide
```

### Title

Text input.

### File

File input.

Show accepted file information if appropriate.

---

# 22. FORM VALIDATION

Validate:

* Course required
* Resource type required
* Title required
* File required

Show errors inline next to the appropriate fields.

Do not use browser-only validation as the entire UX.

Use accessible error messages.

Invalid fields should have visible error styling.

---

# 23. UPLOAD SUCCESS

When submitted successfully:

1. Call `createResource()`
2. Log the submitted data
3. Show a success message

Example:

> Resource uploaded successfully!

Make it clear that this is a prototype and the resource is not actually persisted.

Do not implement real file storage.

After success, either:

* keep the form available for another upload, or
* provide a clear way to return to the course.

Choose the cleaner UX.

---

# 24. LOADING STATES

Pages using async service functions must display loading states.

Do not immediately render content while pretending the API already returned.

Create reusable:

```text
LoadingState
```

Use subtle skeletons or a simple loading indicator.

Loading UI should prevent layout jumping where possible.

---

# 25. ERROR STATES

Create reusable:

```text
ErrorState
```

If a service request fails, display a friendly message.

Example:

> Something went wrong.

Supporting text:

> We couldn't load this information. Please try again.

Include:

```text
Try again
```

where appropriate.

Do not expose technical errors to users.

---

# 26. NOT FOUND PAGE

Route:

```text
*
```

Create a friendly 404 page.

Example:

```text
404

Page not found

The page you're looking for doesn't exist.

[Back to Courses]
```

Keep it simple.

---

# 27. SERVICE LAYER

Create:

```text
src/services/api.ts
```

All data access must go through this file.

Components/pages should NOT directly import mock arrays.

Implement:

```ts
getCourses()
getCourse(id)
getResources(courseId)
createResource(data)
```

All functions should be asynchronous.

Example concept:

```ts
export async function getCourses(): Promise<Course[]> {
  await delay();
  return courses;
}
```

Use a small artificial delay so loading states can be tested.

This service layer must be designed so that later it can be replaced with real HTTP requests without changing page components.

---

# 28. MOCK DATA

Create:

```text
src/data/mock.ts
```

Create at least 8 realistic IT Engineering courses covering Years 1–4.

Use courses such as:

* Data Structures II
* Database Systems
* Web Technologies
* Operating Systems
* Computer Networks
* Software Engineering
* Algorithms
* UX/UI Design

Make the data feel realistic for a Cambodian university environment.

Create at least 20 resources.

Mix:

* Notes
* Past Papers
* Slides

Use realistic titles.

Examples:

```text
Chapter 1–5 Lecture Notes
Midterm Examination 2025
Final Examination Review
Database Normalization Slides
Web Technologies Week 6 Notes
Operating Systems Final Review
```

Use realistic dates.

Spread resources across multiple courses rather than putting everything into one course.

---

# 29. TYPES

Create:

```text
src/types.ts
```

Use:

```ts
export type ResourceType = "note" | "paper" | "slide";

export interface Course {
  id: string;
  code: string;
  name: string;
  year: number;
  semester: 1 | 2;
  lecturer: string;
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  type: ResourceType;
  uploadedBy: string;
  createdAt: string;
  fileUrl: string;
}
```

Add additional types only when they are genuinely useful.

---

# 30. INTERNATIONALIZATION PREPARATION

Create:

```text
src/i18n/en.ts
```

All visible UI text should come from this file where practical.

Do NOT scatter UI strings throughout components.

Prepare the structure so a future:

```text
km.ts
```

can be added.

Do not implement the language switch yet unless it can be done cleanly without unnecessary complexity.

The architecture should make Khmer support easy later.

---

# 31. ACCESSIBILITY

Follow good accessibility practices.

Requirements:

* Semantic HTML
* Proper headings
* `<nav>`
* `<main>`
* `<section>`
* `<form>`
* `<label>`
* Accessible buttons
* Keyboard navigation
* Visible focus states
* Sufficient color contrast
* Meaningful link/button text
* Do not rely only on color to communicate state

Form fields must have labels.

Icons used as buttons need accessible labels.

---

# 32. ANIMATIONS

Add subtle animations to improve the experience.

Use CSS/Tailwind transitions.

Examples:

* Card hover
* Button hover
* Filter selection
* Tab selection
* Page content appearance
* Form success state

Animations should be fast and subtle.

Avoid:

* excessive bouncing
* distracting effects
* long transitions
* animation everywhere

Respect:

```text
prefers-reduced-motion
```

where practical.

---

# 33. RESPONSIVE UX DETAILS

At 375px:

* Navbar must fit
* Search must fit
* Filter chips should horizontally scroll if necessary
* Cards must fit the viewport
* Buttons must have comfortable touch targets
* Resource cards must not overflow
* Course information must wrap naturally
* Tabs must remain usable

At desktop:

* Use a centered max-width container
* Provide generous whitespace
* Do not stretch content excessively
* Course grid should use available space intelligently

---

# 34. ROUTING

Use React Router.

Routes:

```text
/
    Home

/courses/:id
    CourseDetail

/upload
    Upload

*
    NotFound
```

Navigation should work without full page reloads.

---

# 35. APP ARCHITECTURE

`App.tsx` should primarily handle routing and application structure.

Avoid putting large amounts of business logic inside `App.tsx`.

Pages should manage page-level state.

Reusable UI belongs in components.

Data access belongs in:

```text
services/api.ts
```

Mock data belongs in:

```text
data/mock.ts
```

Types belong in:

```text
types.ts
```

Translations belong in:

```text
i18n/en.ts
```

---

# 36. CODE QUALITY

Follow these rules:

* Functional components only
* React hooks only
* Strict TypeScript
* No `any`
* No unnecessary abstractions
* Small reusable components
* No duplicated UI logic where avoidable
* No giant components
* No unnecessary comments
* No dead code
* No unused imports
* No console errors

Use short comments only for major sections when necessary.

---

# 37. UX DETAILS THAT MATTER

Pay special attention to small details:

### Buttons

Buttons should have:

* hover
* active
* focus
* disabled states

### Links

Links should clearly look clickable.

### Inputs

Inputs should have:

* clear border
* focus ring
* comfortable height
* readable text
* placeholder

### Cards

Cards should have consistent spacing and alignment.

### Dates

Display dates in a friendly readable format.

Example:

```text
Sep 12, 2026
```

### Resource counts

Show resource counts where useful.

### Empty results

Never leave a blank page without explaining what happened.

---

# 38. PERFORMANCE

Keep the frontend lightweight.

Avoid:

* unnecessary packages
* huge assets
* unnecessary re-renders
* complex state libraries
* excessive JavaScript

Use React state/hooks appropriately.

Since this is mock data, no API caching library is needed.

---

# 39. README

Create a short `README.md` containing:

## Course Hub

Short project description.

## Features

List the current frontend features.

## Tech Stack

List the technologies.

## Setup

Example:

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
```

## Current Limitations

Mention:

* Mock data
* No backend
* No authentication
* No persistent uploads
* No real file storage

## Future Roadmap

Briefly mention the planned backend/auth/Telegram phases.

---

# 40. BUILD PROCESS

Build the application in this order:

### Step 1 — Inspect project

First inspect the existing repository.

Do not blindly overwrite existing files.

Understand:

* existing package.json
* existing Vite setup
* Tailwind setup
* existing source files
* existing configuration

Reuse existing configuration when appropriate.

---

### Step 2 — Setup

Configure:

* Vite
* React
* TypeScript
* Tailwind CSS v4
* React Router

Make sure the project starts successfully.

---

### Step 3 — Types

Create:

```text
src/types.ts
```

---

### Step 4 — Mock data

Create:

```text
src/data/mock.ts
```

Add realistic courses and resources.

---

### Step 5 — Service layer

Create:

```text
src/services/api.ts
```

Implement all async mock API functions.

---

### Step 6 — Internationalization

Create:

```text
src/i18n/en.ts
```

Move UI strings into the translation object.

---

### Step 7 — Base styling

Configure:

* fonts
* global styles
* colors
* responsive behavior
* focus states

---

### Step 8 — Components

Build:

```text
Navbar
SearchBar
CourseCard
ResourceCard
EmptyState
LoadingState
ErrorState
```

Test each component as part of the application.

---

### Step 9 — Pages

Build:

```text
Home
CourseDetail
Upload
NotFound
```

---

### Step 10 — Routing

Connect all routes with React Router.

---

### Step 11 — Responsive refinement

Test the entire app at:

```text
375px
390px
768px
1024px
1280px
1440px
```

Fix:

* overflow
* spacing
* typography
* grid behavior
* navigation
* buttons
* tabs
* forms

---

### Step 12 — Accessibility

Check:

* keyboard navigation
* labels
* focus states
* semantic structure
* button/link accessibility
* color contrast

---

### Step 13 — Build

Run:

```bash
npm run build
```

Fix every TypeScript/build error.

Do not finish while the build is failing.

---

# 41. TESTING

After implementation, verify:

### Development

```bash
npm run dev
```

Confirm the application opens successfully.

### Production build

```bash
npm run build
```

Confirm it completes with zero errors.

### Manual functional testing

Test:

1. Home page loads
2. Courses appear
3. Search works
4. Year filter works
5. Semester filter works
6. Search + filters work together
7. Empty state appears
8. Clicking a course opens details
9. Course resources load
10. Resource tabs filter correctly
11. Resource counts are correct
12. Download buttons work with mock URLs
13. Upload form loads
14. Validation works
15. Upload success message appears
16. 404 page works
17. Navbar navigation works
18. Mobile layout works
19. Desktop layout works
20. No console errors

---

# 42. ACCEPTANCE CRITERIA

The project is complete only when all of these are true:

* [ ] `npm install` succeeds
* [ ] `npm run dev` starts successfully
* [ ] `npm run build` succeeds
* [ ] No TypeScript errors
* [ ] No `any`
* [ ] No broken routes
* [ ] Home page works
* [ ] Course search works
* [ ] Year filters work
* [ ] Semester filters work
* [ ] Empty state works
* [ ] Course detail page works
* [ ] Resource tabs work
* [ ] Resource counts are correct
* [ ] Download links work with mock URLs
* [ ] Upload form works
* [ ] Upload validation works
* [ ] Upload success state works
* [ ] NotFound works
* [ ] Loading states exist
* [ ] Error states exist
* [ ] Navbar works
* [ ] Responsive at 375px
* [ ] Responsive at tablet
* [ ] Responsive at desktop
* [ ] Accessible form labels exist
* [ ] Keyboard focus states exist
* [ ] UI text is centralized in `i18n/en.ts`
* [ ] Data access is centralized in `services/api.ts`
* [ ] Mock data is centralized in `data/mock.ts`
* [ ] No backend/auth/database is implemented
* [ ] README exists

---

# 43. IMPORTANT IMPLEMENTATION RULES

Do not stop after creating the files.

Actually implement the complete application.

Do not provide pseudo-code.

Do not leave TODO placeholders for core functionality.

Do not say something is implemented unless it actually works.

If you encounter an error:

1. Inspect the error
2. Identify the cause
3. Fix it
4. Run the relevant command again
5. Continue until successful

If an existing project contains useful code, preserve and improve it instead of unnecessarily replacing everything.

If a design decision is not explicitly specified, choose the option that best supports:

1. Mobile usability
2. Simplicity
3. Accessibility
4. Future backend integration
5. Professional visual quality

Do not ask unnecessary questions. Make sensible implementation decisions and continue.

---

# 44. FINAL RESPONSE

After completing the implementation, provide a concise final report containing:

## What I Built

Summarize the completed Course Hub frontend.

## Main Features

List the major features implemented.

## Project Structure

Briefly show the important folders/files.

## Testing

Report the result of:

```bash
npm run build
```

Also mention the manual tests performed.

## Assumptions

List any important assumptions you made.

## Not Implemented Yet

Clearly state that backend, authentication, database, real file uploads, reviews, moderation and Telegram integration are not part of this phase.

Do not claim features were implemented if they were not actually implemented.
