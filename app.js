// ------------------------------
//  CampusFix Backend Server
// ------------------------------
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 10000;

// ------------------------------
//  Middleware
// ------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session system for admin login
app.use(
  session({
    secret: "campusfix_secret_key_12345",
    resave: false,
    saveUninitialized: true,
  })
);

// ------------------------------
//  Database Setup
// ------------------------------
const db = new sqlite3.Database("campusfix.sqlite3");

db.serialize(() => {
  db.run(`
      CREATE TABLE IF NOT EXISTS issues (
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
      )
  `);
});

// ------------------------------
// Upload Folder Setup
// ------------------------------
const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // MUST EXIST
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: uploadStorage });

// Serve uploads folder publicly
app.use("/uploads", express.static("uploads"));

// ------------------------------
// Serve frontend from /public
// ------------------------------
app.use(express.static("public"));

// ------------------------------
//   Admin Login API
// ------------------------------
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "kp302";

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ success: true, message: "Login successful" });
  }

  res.json({ success: false, message: "Invalid credentials" });
});

// ------------------------------
// Protect Admin APIs
// ------------------------------
function checkAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ------------------------------
//   Create Issue (Mobile Form)
// ------------------------------
app.post("/api/report", upload.single("image"), (req, res) => {
  const { name, email, building, floor, room, category, description } = req.body;
  const image = req.file ? req.file.filename : null;

  db.run(
    `INSERT INTO issues (name, email, building, floor, room, category, description, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, building, floor, room, category, description, image],
    function (err) {
      if (err) return res.json({ success: false });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// ------------------------------
//   Admin: Get All Issues
// ------------------------------
app.get("/api/admin/issues", checkAdmin, (req, res) => {
  db.all("SELECT * FROM issues ORDER BY id DESC", (err, rows) => {
    res.json(rows);
  });
});

// ------------------------------
//   Admin: Update Issue Status
// ------------------------------
app.post("/api/admin/update-status", checkAdmin, (req, res) => {
  const { id, status } = req.body;

  db.run(
    `UPDATE issues SET status = ? WHERE id = ?`,
    [status, id],
    function (err) {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});

// ------------------------------
//   Admin Logout
// ------------------------------
app.get("/api/admin/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ------------------------------
//  Fallback to index.html
// ------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------------------
//  Start Server
// ------------------------------
app.listen(PORT, () => {
  console.log("🚀 CampusFix running on port " + PORT);
});
