# MedRep

Mobile-first PWA for a medical representative. Data is saved locally in IndexedDB first, then synced in the background to Google Sheets through Google Apps Script.

## Stack

React, Vite, TypeScript, Dexie, PWA, Google Apps Script, Google Sheets, Vercel.

## Local development

```bash
npm install
npm run dev
```

The Apps Script URL is centralized in `src/config.ts` and can be overridden with `VITE_GAS_WEBAPP_URL` (see `.env.example`).

## Deploy Apps Script

The live Web App currently has no `doGet`. Paste [`apps-script/Code.gs`](apps-script/Code.gs) into the script bound to spreadsheet `15LeNu765ZG8AF-zkKUhSEU9-GSf0Y-Ggfaji38Hs_Qs`, then **Deploy → Manage deployments → edit the existing Web App → New version**.

- Execute as: you
- Who has access: anyone

Keep the same Web App URL so devices do not need a new config value.

## Deploy the app

Connect the GitHub repo to Vercel. Optional environment variable:

`VITE_GAS_WEBAPP_URL` — same Web App URL as in `src/config.ts`.
