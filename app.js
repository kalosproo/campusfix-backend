const express = require("express");
const session = require("express-session");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(
  session({
    secret: "campusfix_secret_2025",
    resave: false,
    saveUninitialized: true,
  })
);

// Database
const db = new sqlite3.Database("./campusfix.sqlite3");

db.run(
  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    building TEXT,
    floor TEXT,
    room TEXT,
    category TEXT,
    description TEXT,
    image TEXT,
    status TEXT DEFAULT 'Pending'
  )`
);

// File Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Static public files
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// =============================
//       ADMIN LOGIN
// =============================
const ADMIN_USER = "admin";
const ADMIN_PASS = "kp302";

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.json({ success: true });
  }

  res.json({ success: false, message: "Invalid credentials" });
});

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// =============================
//     API ROUTES
// =============================

// Submit issue
app.post("/api/submit", upload.single("image"), (req, res) => {
  const data = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;

  db.run(
    `INSERT INTO reports 
    (name, email, building, floor, room, category, description, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.email,
      data.building,
      data.floor,
      data.room,
      data.category,
      data.description,
      image,
    ],
    function (err) {
      if (err) return res.json({ success: false, error: err });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Admin get all reports
app.get("/admin/reports", requireAdmin, (req, res) => {
  db.all("SELECT * FROM reports ORDER BY id DESC", (err, rows) => {
    if (err) return res.json({ error: err });
    res.json(rows);
  });
});

// Update issue status
app.post("/admin/update-status", requireAdmin, (req, res) => {
  const { id, status } = req.body;

  db.run(`UPDATE reports SET status = ? WHERE id = ?`, [status, id], (err) => {
    if (err) return res.json({ success: false, error: err });
    res.json({ success: true });
  });
});

// =============================
//      TEST ROUTE
// =============================
app.get("/api/test", (req, res) => {
  res.send("CampusFix backend is working!");
});

// =============================
//       START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`CampusFix running at http://localhost:${PORT}`);
});
