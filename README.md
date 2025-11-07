# Tanzania CIS Dashboard

Tanzania Cancer Information System (CIS) Dashboard is a React + TypeScript + Vite application
that visualises programme indicators and operational metrics for Tanzania’s collective investment
schemes. The dashboard ingests a published Google Sheet that tracks CIS fund attributes and renders
interactive views for AUM distribution and performance.

## Features

- Fetches the latest CIS fund register directly from a public Google Sheet CSV.
- Aggregates assets under management (AUM) by fund manager and displays the results in an interactive
  column chart.
- Highlights short- and medium-term performance (1-year return, 3-year CAGR) for the largest funds.
- Presents a sortable-friendly fund table with key operational details and deep links to fund and
  manager resources.

## Live demo

- https://gideonamani.github.io/tzcis-dashboard/

## Getting started

```bash
npm install
npm run dev
```

Open the development server at the printed URL (defaults to http://localhost:5173) to view the
dashboard.

## Data source

- CSV: https://docs.google.com/spreadsheets/d/e/2PACX-1vShsrgZoT3OwRgNwBm9NHLKZ5JnEURvir5A_guJRw07aDlIDRwYLOG0DJZRjZQXEBqkdLCaf7ItjYEO/pub?gid=0&single=true&output=csv
- The fetch happens on application load via the `fetchFundData` helper in `src/services/fundData.ts`.
- Because the spreadsheet is public, deployments do not require secret management. Should access
  be restricted later, migrate the fetch to a backend proxy or serverless function.

## Available scripts

- `npm run dev` – start the local development server with hot module reloading
- `npm run build` – run the production TypeScript build and bundle assets with Vite
- `npm run lint` – execute the ESLint rules configured in `eslint.config.js`
- `npm run deploy` – build and publish the latest dashboard build to the `gh-pages` branch

## Project structure

```
.
├── public            # Static assets copied as-is to the build output
├── src               # Application source code (entry: main.tsx)
├── index.html        # Root HTML shell served by Vite
├── vite.config.ts    # Vite configuration
└── tsconfig*.json    # TypeScript project configuration files
```

## Deploying to GitHub Pages

Set the repository’s GitHub Pages source to the `gh-pages` branch, then run:

```bash
npm run deploy
```

The script builds the app and pushes the `dist/` folder to the `gh-pages` branch using the
[`gh-pages`](https://www.npmjs.com/package/gh-pages) package. Because the Vite base path is
configured to emit relative asset URLs, it works for both user/organization and project pages.

## Next steps

- Integrate authentication and connect to secure CIS APIs once they are available.
- Add historical trend views (e.g., rolling AUM, flows) and sector exposures.
- Harden deployment with a GitHub Actions workflow for automated builds to GitHub Pages.
