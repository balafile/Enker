# Wisepurse — Expense Tracker

A responsive expense tracker with a login/signup page and a full dashboard (add, edit, delete expenses, live charts). **Google Sheets is the database, and a Google Apps Script Web App is the entire backend** — no Google Cloud Console, no service accounts, no servers to run. The site itself is plain static HTML/CSS/JS, so it deploys to Netlify as-is.

```
expense-tracker/
├── index.html                  Login / signup page
├── dashboard.html               Dashboard (overview, transactions, analytics)
├── css/styles.css               Shared design tokens + animations
├── js/
│   ├── config.js                 ← paste your Apps Script URL here
│   ├── auth.js                   Login/signup page logic
│   ├── dashboard.js              Dashboard app logic (fetch, render, CRUD)
│   ├── charts.js                 Chart.js wrappers
│   └── avatar.js                 Male avatar SVG generator (happy/sad)
├── google-apps-script/
│   └── Code.gs                   The entire backend — paste into Apps Script
└── netlify.toml
```

## 1. Create the Google Sheet

Go to [Google Sheets](https://sheets.google.com) and create a new, blank spreadsheet — call it anything, e.g. **Wisepurse Data**. You don't need to add any tabs or headers yourself; the script does that for you in step 2.

## 2. Add the backend script

1. In your new sheet, go to **Extensions → Apps Script**. This opens the script editor, already bound to this sheet.
2. Delete whatever is in `Code.gs`, then paste in the entire contents of `google-apps-script/Code.gs` from this project.
3. At the top of the editor, pick **setupSheets** from the function dropdown and click **Run** (▶). The first time, Google will ask you to authorize the script (it's your own script acting on your own sheet — click through **Advanced → Go to project (unsafe) → Allow**; "unsafe" here just means it isn't submitted to Google's app review, which unpublished personal scripts never are).
4. Check your spreadsheet — you should now see three tabs: `Users`, `Expenses`, `Sessions`, each with a header row. That's your whole database, ready.

## 3. Deploy it as a Web App

1. Still in the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set **Execute as: Me**, and **Who has access: Anyone**.
4. Click **Deploy**, authorize again if asked, then copy the **Web app URL** it gives you (it ends in `/exec`).

## 4. Connect your site to it

Open `js/config.js` in this project and paste the URL in:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec';
```

That's the only configuration this project needs.

## 5. Try it locally

Since everything is static files, you don't need a build step — just open `index.html` with a local server (opening it directly as a `file://` URL will block the fetch calls). The easiest options:
- VS Code's **Live Server** extension → right-click `index.html` → "Open with Live Server"
- or, from a terminal in the project folder: `npx serve .`

Sign up with a name and a password (6+ characters), and you should land on the dashboard. Check your Google Sheet — a new row should appear in `Users`.

## 6. Deploy to Netlify

Since there's no backend to host, this is just a static-site deploy:

- **Drag and drop:** in the Netlify dashboard, **Add new site → Deploy manually**, then drag the whole project folder onto the page.
- **Git (recommended):** push this folder to a GitHub repo, then in Netlify choose **Add new site → Import an existing project** and pick the repo. Netlify will use `netlify.toml` automatically (publish directory `.`) — no build command needed.

## Whenever you change Code.gs

Apps Script Web Apps don't auto-update when you edit the code — after any change, go to **Deploy → Manage deployments**, click the pencil/edit icon on your existing deployment, and choose **Version: New version**, then **Deploy**. The URL stays the same, so you won't need to touch `config.js` again.

## How it works

- **Signup / login**: `Code.gs`'s `doPost` looks up the `Users` sheet by name. On signup, the password is combined with a random salt and hashed with SHA-256 (`Utilities.computeDigest`) before it's written — the plain password is never stored. On login, the same hash is recomputed from what you typed and compared. Either way, a random session token is generated, saved in the `Sessions` sheet with a 7-day expiry, and returned to the browser, which keeps it in `localStorage`.
- **Expenses**: every read/write includes that token. `doGet` handles listing (filtered to your `UserID`); `doPost` handles add/update/delete, each checking the token first. Deletes remove the row from the sheet entirely.
- **CORS trick**: browsers only skip the extra "preflight" check for plain GET requests and POSTs with a `text/plain` body — which Apps Script can't answer with the browser's expected response otherwise. So the frontend only ever sends GET (for reads) or POST with a `text/plain` body containing JSON (for writes), and never a custom `Authorization` header — the token just travels inside the request itself. That's why the API contract looks the way it does in `js/dashboard.js`'s `api()` helper.
- **Dashboard**: `js/dashboard.js` fetches all of your expenses once on load, then computes every stat, chart and table from that array in the browser. Add/edit/delete update the Sheet and the in-memory array together, so the whole dashboard refreshes instantly without a full page reload.

## Notes & things you can customize

- Category list and colors live at the top of `js/dashboard.js` (`EXPENSE_CATEGORIES` / `INCOME_CATEGORIES`).
- Colors and fonts are defined once as CSS variables in `css/styles.css`.
- Passwords must be more than 5 characters — enforced both in the browser and in `Code.gs`.
- Because the Apps Script deployment is set to "Anyone" access, treat the exec URL itself as semi-public (don't post it somewhere public) — every request still needs a valid name/password to get a token, and every expense action still needs a valid token, but there's no separate network-level restriction beyond that.
- If you'd rather sessions end when the browser closes, swap `localStorage` for `sessionStorage` in `js/auth.js` and `js/dashboard.js`.
