const express = require("express");
const session = require("express-session");
const { fetchMongoData } = require("./db");

const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const STYLE = `
  :root { --bg:#f4f6fb; --card:#fff; --text:#1f2937; --muted:#6b7280; --border:#e5e7eb;
          --primary:#2563eb; --primary-dark:#1d4ed8; --nav:#0f172a; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; flex-direction:column;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif;
         background:var(--bg); color:var(--text); }
  header { background:var(--nav); color:#fff; padding:14px 24px;
           display:flex; align-items:center; justify-content:space-between; }
  .brand { font-weight:600; font-size:16px; }
  .brand span { color:#93c5fd; font-weight:400; }
  .nav-right { display:flex; align-items:center; gap:12px; font-size:14px; color:#cbd5e1; }
  .nav-right form { margin:0; }
  main { flex:1; display:flex; justify-content:center; align-items:flex-start; padding:48px 16px; }
  .card { background:var(--card); width:100%; max-width:760px; border:1px solid var(--border);
          border-radius:14px; padding:32px; box-shadow:0 12px 32px rgba(15,23,42,.07); }
  .card.narrow { max-width:440px; }
  .top-bar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0; font-size:14px; }
  label { display:block; font-size:14px; font-weight:500; margin-bottom:6px; }
  input { width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px;
          font-size:15px; margin-bottom:18px; font-family:inherit; }
  input:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px rgba(37,99,235,.18); }
  .btn { width:100%; padding:11px; border:0; border-radius:8px; background:var(--primary);
         color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
  .btn:hover { background:var(--primary-dark); }
  .btn-sm { width:auto; padding:8px 14px; font-size:13px; text-decoration:none; display:inline-block; }
  .btn-ghost { background:transparent; border:1px solid #475569; color:#e2e8f0;
               padding:6px 12px; border-radius:6px; font-size:13px; cursor:pointer; }
  .btn-ghost:hover { background:#1e293b; }
  .alert { padding:10px 12px; border-radius:8px; font-size:14px; margin-bottom:18px; }
  .alert.err { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
  .table-wrap { overflow-x:auto; border:1px solid var(--border); border-radius:10px; }
  table { width:100%; border-collapse:collapse; font-size:14px; text-align:left; }
  th { background:#f8fafc; color:var(--muted); font-weight:600; font-size:12px;
       text-transform:uppercase; letter-spacing:.04em; padding:12px 16px; border-bottom:1px solid var(--border); }
  td { padding:14px 16px; border-bottom:1px solid var(--border); }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#f9fafb; }
  .badge { display:inline-block; padding:3px 9px; border-radius:999px; font-weight:600;
           font-size:12px; background:#eff6ff; color:#1d4ed8; }
  .num { font-variant-numeric: tabular-nums; font-weight:500; }
  .avg { font-weight:700; color:#0f172a; }
  .muted { color:var(--muted); font-size:13px; }
  .empty { text-align:center; padding:32px; color:var(--muted); }
  footer { text-align:center; color:var(--muted); font-size:12px; padding:20px; }
`;

const page = (title, body, user, narrow = false) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Results Page</title><style>${STYLE}</style></head>
<body>
  <header>
    <div class="brand">Results Page <span>· Data Collection System</span></div>
    ${
      user
        ? `<div class="nav-right">Signed in as <strong>${escape(user)}</strong>
      <form method="post" action="/logout"><button class="btn-ghost">Log out</button></form></div>`
        : ""
    }
  </header>
  <main><div class="card${narrow ? " narrow" : ""}">${body}</div></main>
  <footer>ACIT3495 · Group 17</footer>
</body></html>`;

const alert = (msg, kind) =>
  msg ? `<div class="alert ${kind}">${escape(msg)}</div>` : "";

const loginForm = (msg = "") =>
  page(
    "Login",
    `
  <h1>Welcome back</h1>
  <p class="sub" style="margin-bottom:24px;">Sign in to access student grades.</p>
  ${alert(msg, "err")}
  <form method="post" action="/login">
    <label for="username">Username</label>
    <input id="username" name="username" required maxlength="50" autocomplete="username">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required maxlength="100" autocomplete="current-password">
    <button class="btn">Sign in</button>
  </form>`,
    null,
    true,
  );

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? escape(val) : d.toLocaleString();
};

const formatNum = (val) =>
  typeof val === "number" ? val.toFixed(2) : escape(val ?? "—");

function createApp({ authUrl, sessionSecret }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false, limit: "10kb" }));
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 1000 },
    }),
  );

  const requireAuth = (req, res, next) =>
    req.session.user ? next() : res.redirect("/login");

  app.get("/", (req, res) =>
    res.redirect(req.session.user ? "/results" : "/login"),
  );
  app.get("/login", (req, res) => res.send(loginForm()));

  app.post("/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!username || !password)
      return res
        .status(400)
        .send(loginForm("Username and password are required"));

    let authRes;
    try {
      authRes = await fetch(`${authUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      console.error("login: auth service unreachable:", err.message);
      return res
        .status(503)
        .send(loginForm("Login is temporarily unavailable, try again shortly"));
    }

    if (authRes.status !== 200) {
      console.warn(
        `login failed for "${username}" (auth status ${authRes.status})`,
      );
      return res.status(401).send(loginForm("Invalid username or password"));
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).send(loginForm("Session error"));
      req.session.user = username;
      console.info(`login ok for "${username}"`);
      res.redirect("/results");
    });
  });

  app.post("/logout", (req, res) =>
    req.session.destroy(() => res.redirect("/login")),
  );

  app.get("/results", requireAuth, async (req, res) => {
    try {
      const docs = await fetchMongoData();
      docs.sort((a, b) =>
        String(a.course_code || "").localeCompare(String(b.course_code || "")),
      );

      const rows = docs
        .map(
          (doc) => `
          <tr>
            <td><span class="badge">${escape(doc.course_code)}</span></td>
            <td class="num">${escape(doc.total_submissions)}</td>
            <td class="num">${formatNum(doc.min_grade)}%</td>
            <td class="num">${formatNum(doc.max_grade)}%</td>
            <td class="num avg">${formatNum(doc.avg_grade)}%</td>
            <td class="muted">${formatDate(doc.last_updated)}</td>
          </tr>`,
        )
        .join("");

      const content =
        docs.length > 0
          ? `<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Submissions</th>
                    <th>Min Grade</th>
                    <th>Max Grade</th>
                    <th>Average</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`
          : `<div class="empty">No grade analytics available yet.</div>`;

      res.send(
        page(
          "Results",
          `
          <div class="top-bar">
            <div>
              <h1>Course Grade Analytics</h1>
              <p class="sub">Live aggregated statistics synced from MongoDB</p>
            </div>
            <a href="/results" class="btn btn-sm">Refresh</a>
          </div>
          ${content}`,
          req.session.user,
        ),
      );
    } catch (err) {
      console.error("Error rendering /results:", err);
      res.status(500).send("Failed to load analytics results.");
    }
  });

  return app;
}

module.exports = { createApp };