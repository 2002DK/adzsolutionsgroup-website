# ADZ Solutions — Company Website & Employee Portal

Live site: [adzsolutionsgroup.com](https://adzsolutionsgroup.com)

## Overview

Full company website and internal employee portal built for ADZ Solutions LLC, an IT consulting and solutions firm based in Marlton, NJ. The site serves two audiences — prospective clients on the public-facing side, and the internal team through a secure employee portal for tracking New Jersey government bid opportunities.

---

## What's Built

### Public Website
A responsive single-page site built with vanilla HTML, CSS, and JavaScript featuring:
- Animated background shapes and smooth scroll navigation
- Services, About, and Contact sections
- Formspree-powered contact form
- Footer links to the Employee Portal and Capability Statement

### Employee Portal — NJ SBE Bid Tracker
A secure internal tool for tracking Small Business Enterprise (SBE) bid opportunities across all 21 New Jersey counties. Features include:

- **Google OAuth authentication** restricted to @adzsolutionsgroup.com accounts
- **Real-time Google Sheets database** — all team members see the same data instantly across any device
- **Full CRUD** — add, edit, and delete bid opportunities
- **Pipeline dashboard** — live stats for total bids, active opportunities, deadlines within 14 days, wins, and estimated pipeline value
- **Filtering** — search and filter by county, status, and category
- **County directory** — direct links to all 21 NJ county purchasing portals with active opportunity notes
- **CSV export** — one-click export of all bid data
- **Weekly email notifications** — automated Monday morning deadline reminders sent to the full team for any bids due within 7 days
- **Responsive design** — works on desktop and mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Fonts | Syne, DM Sans (Google Fonts) |
| Authentication | Google Identity Services (OAuth 2.0) |
| Database | Google Sheets via Apps Script API |
| Backend | Google Apps Script (serverless) |
| Email | Google Apps Script MailApp |
| Hosting | GitHub Pages |
| Domain | Namecheap (DNS) |
| Forms | Formspree |

---

## Architecture

```
Public Site (GitHub Pages)
├── index.html              — Main marketing site
└── tracker/
    ├── login.html          — Google OAuth login
    ├── dashboard.html      — Bid tracker UI
    └── tracker.js          — App logic & API calls

Google Infrastructure (private)
├── Apps Script             — Secure API endpoint
│   ├── Domain verification — Validates @adzsolutionsgroup.com tokens
│   ├── CRUD operations     — Read/write to Google Sheet
│   └── Email scheduler     — Weekly deadline reminders
└── Google Sheet            — Bid data storage
```

---

## Security Model

- **Domain-restricted OAuth** — Only @adzsolutionsgroup.com Google Workspace accounts can authenticate. Enforced on both the frontend and server-side in Apps Script
- **Token verification** — Every API request sends a Google ID token which Apps Script verifies against Google's servers before executing any operation
- **No credentials in code** — Client ID is public by Google's design. Apps Script URL is stored as a GitHub Secret and injected into the code at build time via GitHub Actions — the placeholder `YOUR_APPS_SCRIPT_URL_HERE` is what appears in this repository. The real URL is never committed or visible in version history
- **Session-based auth** — Tokens stored in `sessionStorage`, cleared automatically when the browser tab closes
- **No backend server** — Apps Script runs entirely on Google's infrastructure, eliminating server maintenance and attack surface

---

## Key Features in Detail

### Google Sheets as a Database
Rather than a traditional database, bid data lives in a Google Sheet accessible to the whole team directly. The Apps Script acts as a REST-like API layer, handling authentication and data operations. This means the team can view and manage data both through the tracker UI and directly in the familiar Google Sheets interface.

### Automated Deadline Reminders
A time-based trigger runs `sendDeadlineReminders()` every Monday morning. It scans all active bids, filters for deadlines within 7 days, and sends a branded HTML email to all team members listing the upcoming bids with county, category, assigned person, and days remaining.

### County Directory
Built-in reference of all 21 NJ county purchasing portals with direct links and notes on active opportunities identified through research — covering IT services, healthcare, consulting, marketing, and web development categories relevant to ADZ Solutions' service offerings.

---

## Project Structure

```
├── index.html                  — Public marketing site
├── README.md                   — This file
├── favicon.ico                 — Site favicon
├── assets/
│   └── logo.png                — Company logo
├── tracker/
│   ├── login.html              — Authentication page
│   ├── dashboard.html          — Main tracker interface
│   └── tracker.js              — Shared app logic (URL injected at build time)
└── .github/
    └── workflows/
        └── deploy.yml          — GitHub Actions deployment workflow
```

---

## Deployment

The site is deployed via GitHub Actions on every push to `main`. The workflow:
1. Checks out the repository
2. Injects the real Apps Script URL from GitHub Secrets into `tracker.js`
3. Verifies the injection succeeded
4. Deploys to GitHub Pages

The `APPS_SCRIPT_URL` secret is stored in GitHub's encrypted secrets and never appears in the codebase or version history.

## Local Development

Since this is a static site, no build step is required. Clone the repo and open `index.html` in a browser. Note that the Employee Portal requires valid Google OAuth credentials and an Apps Script deployment to function — the `APPS_SCRIPT_URL` placeholder in `tracker.js` must be replaced with a live deployment URL for local testing.

---

## About ADZ Solutions

ADZ Solutions LLC is an IT consulting and solutions firm based in Marlton, NJ serving small and mid-size businesses with IT consulting, web development, marketing, project management, systems integration, and business process improvement services.

- **Website:** [adzsolutionsgroup.com](https://adzsolutionsgroup.com)
- **Phone:** (856) 719-1356
- **Email:** daanyalkaleem@adzsolutionsgroup.com