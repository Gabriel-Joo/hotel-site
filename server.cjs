const express = require("express");
const jsonServer = require("json-server");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = process.env.BASE_PATH ? process.env.BASE_PATH.replace(/\/$/, "") : "";
const DB = process.env.DB_PATH || path.join(__dirname, "db.json");

app.set("etag", false);
app.use((req, res, next) => {
  if (req.originalUrl.includes("/api/")) res.set("Cache-Control", "no-store");
  next();
});

// 정적 파일 먼저 (index.html 등이 json-server 기본 페이지보다 우선)
app.use(express.static(__dirname));
if (BASE) app.use(BASE, express.static(__dirname));

// API 라우터 (/api 로만)
const router = jsonServer.router(DB);
app.use("/api", router);
if (BASE) app.use(`${BASE}/api`, router);

app.listen(PORT, () => console.log(`listening on ${PORT}`));
