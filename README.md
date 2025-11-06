# Tanzania CIS Dashboard

Tanzania Cancer Information System (CIS) Dashboard is a React + TypeScript + Vite application
that will visualise programme indicators and operational metrics for the CIS rollout.
The project currently ships with the default Vite starter to serve as the foundation for
dashboard features.

## Getting started

```bash
npm install
npm run dev
```

Open the development server at the printed URL (defaults to http://localhost:5173) to view the
dashboard.

## Available scripts

- `npm run dev` – start the local development server with hot module reloading
- `npm run build` – run the production TypeScript build and bundle assets with Vite
- `npm run lint` – execute the ESLint rules configured in `eslint.config.js`

## Project structure

```
.
├── public            # Static assets copied as-is to the build output
├── src               # Application source code (entry: main.tsx)
├── index.html        # Root HTML shell served by Vite
├── vite.config.ts    # Vite configuration
└── tsconfig*.json    # TypeScript project configuration files
```

## Next steps

- Replace the starter React content under `src/` with Tanzania CIS dashboards and components.
- Integrate data fetching layers that connect to the CIS APIs or data warehouse.
- Extend the Vite and ESLint configurations as needed for the project conventions.
