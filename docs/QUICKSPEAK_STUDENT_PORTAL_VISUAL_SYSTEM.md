# QuickSpeak Student Portal Visual System

Status: DESIGN BASELINE

This document defines the visual foundation for the Student Portal redesign. It must not change business logic, navigation, routing, authorization, or database behavior.

## 1. Design direction

QuickSpeak Student Portal uses a hybrid institutional LMS direction:

- Institutional clarity inspired by established LMS patterns.
- Premium education-product polish.
- Calm learning-workspace usability.
- QuickSpeak identity through restrained navy, blue, white, and gold accents.
- No decorative people/character illustrations in the portal.
- Visual hierarchy and alignment take priority over decorative effects.

## 2. Locked Student navigation

Primary navigation remains:

1. Dashboard
2. My Learning
3. Attendance
4. Payment
5. Profile

Notifications remain available through the header bell.

Do not add Schedule, Assignment, Announcement, Materials, Progress Tracking, Certificate, Learning Resources as standalone modules, or other invented modules.

## 3. Layout grid

Desktop:

- Sidebar: 248-264px, fixed visual column.
- Header: 64px.
- Main content: fluid with a maximum reading/workspace width around 1280-1320px.
- Main horizontal padding: 32px desktop, 24px tablet, 16px mobile.
- Vertical page rhythm: 24-32px section spacing.

Mobile:

- Sidebar becomes an overlay drawer.
- Header remains compact and stable.
- Content uses 16px horizontal padding.

## 4. Surface system

Use surfaces deliberately rather than turning every block into a floating card.

- Page background: very light cool neutral.
- Primary surface: white.
- Secondary surface: soft slate/blue neutral.
- Borders: subtle 1px neutral border.
- Shadows: restrained, low elevation only for important containers.
- Radius: moderate; avoid excessive 20-24px rounding on every element.
- Dividers and whitespace should establish hierarchy before shadows do.

## 5. Typography hierarchy

- Page title: 30-34px, bold/extrabold, tight tracking.
- Section heading: 18-20px, bold.
- Primary value: 24-28px, bold/extrabold.
- Body: 14-16px with comfortable line height.
- Supporting metadata: 12-13px.
- Eyebrow labels: 10-11px, bold uppercase with controlled letter spacing.

Do not use oversized marketing-style headlines inside internal LMS pages.

## 6. Brand palette

- Institutional navy: #102449 / #112653 family.
- Primary blue: QuickSpeak blue range for links and active states.
- Gold accent: #F4C430 used sparingly for brand emphasis.
- Success: restrained green.
- Warning: restrained amber.
- Error: restrained rose/red.
- Neutral surfaces: slate/white family.

Accent colors indicate meaning; they must not dominate the interface.

## 7. Component principles

### Sidebar

- Strong institutional presence.
- One unmistakable active state.
- Consistent item height and left alignment.
- Section labels are quiet and secondary.
- No duplicated navigation.

### Header

- Stable 64px desktop height.
- Brand/context on the left.
- Notifications and user identity on the right.
- Logout remains visually secondary to the learning workspace.

### Dashboard

The Dashboard is the master page for the Student Portal visual language.

Priority order:

1. Current learning state.
2. Attendance summary.
3. Account status.

The dashboard must preserve the approved learning states:

- No enrollment -> Choose Learning Package.
- Approved payment without teaching group -> Waiting for Class Assignment.
- Teaching group + teacher assigned -> Active learning.
- Completed 8-session package -> Continue to Next Stage.

### Status

Use compact badges/pills only where a status needs immediate recognition. Status color must not replace readable text.

### Tables/forms

Prefer disciplined alignment, consistent row height, and clear labels over nested cards.

## 8. Precision rules

Every redesign pass must check:

- Common left edge alignment.
- Equal column widths where intended.
- Consistent vertical spacing.
- Consistent heading-to-body gaps.
- No arbitrary floating elements.
- No accidental wrapping of important labels.
- Interactive targets remain comfortably usable on touch devices.

## 9. Scope protection

Visual redesign must not modify:

- Business rules.
- Auth/session behavior.
- Supabase relations or RPC semantics.
- Student navigation.
- Existing locked landing page.
- Existing approved payment, attendance, profile, or learning functionality.

## 10. Implementation sequence

1. Dashboard visual master.
2. Production visual review.
3. Refine until Dashboard is approved.
4. Apply the visual system to My Learning.
5. Apply to Attendance.
6. Apply to Payment.
7. Apply to Profile.

No multi-page redesign batch should be deployed before the Dashboard master is approved.