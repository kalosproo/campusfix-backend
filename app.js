// app.js
// CampusFix - single-file backend + mobile-like UI (uses sqlite3, multer, express)
// Usage:
//   npm install express cors multer sqlite3
//   node app.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB (sqlite3 file)
const DB_FILE = path.join(__dirname, 'campusfix.sqlite3');
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    building TEXT,
    floor TEXT,
    room TEXT,
    category TEXT,
    description TEXT,
    photo TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// uploads folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, Date.now() + '-' + safe);
  }
});
const upload = multer({ storage });

// serve uploads statically
app.use('/uploads', express.static(uploadDir));

// Serve mobile-like UI at "/"
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>CampusFix - Mobile</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#f2f4f7;color:#0b2545}
  .wrap{max-width:480px;margin:28px auto;padding:14px}
  .card{background:#fff;border-radius:14px;padding:16px;box-shadow:0 10px 30px rgba(16,24,40,0.06)}
  h1{margin:0 0 12px 0;text-align:center}
  label{display:block;margin:8px 0 6px;font-weight:600}
  input,textarea{width:100%;padding:10px;border-radius:10px;border:1px solid #e6eef8;margin-bottom:10px;font-size:15px}
  textarea{min-height:100px;resize:vertical}
  .btn{display:block;width:100%;padding:12px;border-radius:10px;background:#0066ff;color:#fff;text-align:center;font-weight:700;border:none}
  .small{font-size:13px;color:#6b7a90;margin-top:8px;text-align:center}
  .issue{background:#f8fbff;border-radius:10px;padding:10px;margin-top:12px;border:1px solid #e6eef8}
  .issue img{max-width:100%;border-radius:8px;margin-top:8px}
  .center{display:flex;justify-content:center;margin-top:12px}
  a.link-btn{display:inline-block;padding:10px 14px;border-radius:10px;background:#f1f5f9;color:#0b2545;text-decoration:none}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>CampusFix</h1>
      <form id="reportForm" enctype="multipart/form-data" autocomplete="off">
        <label>Name</label><input name="name" placeholder="Your name" required>
        <label>Email (@svce.edu.in)</label><input name="email" placeholder="you@svce.edu.in" required>
        <label>Building</label><input name="building" placeholder="Building (e.g. 7th)" required>
        <label>Floor</label><input name="floor" placeholder="Floor (optional)">
        <label>Room</label><input name="room" placeholder="Room (optional)">
        <label>Category</label><input name="category" placeholder="Electrical, Plumbing...">
        <label>Description</label><textarea name="description" placeholder="Describe the issue" required></textarea>
        <input type="file" name="photo" accept="image/*">
        <button class="btn" type="submit">Submit Issue</button>
      </form>
      <div class="small">Reports will be visible below</div>
    </div>

    <div id="issues" style="margin-top:12px"></div>

    <div class="center"><a class="link-btn" href="/admin">Open Admin Dashboard</a></div>
  </div>

<script>
function escapeHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
async function loadIssues(){ const c=document.getElementById('issues'); c.innerHTML=''; try{ const r=await fetch('/api/issues'); const data=await r.json(); if(!Array.isArray(data)||data.length===0){ c.innerHTML='<div style=\"padding:12px;text-align:center;color:#6b7a90\">No reports yet.</div>'; return; } data.forEach(i=>{ const div=document.createElement('div'); div.className='issue'; let html='<strong>'+escapeHtml(i.category||'General')+'</strong> - '+escapeHtml(i.status)+'<div style=\"margin-top:8px\">'+escapeHtml(i.description)+'</div><div style=\"margin-top:8px;color:#6b7a90;font-size:13px\">'+escapeHtml(i.email)+'</div>'; if(i.photo){ html += '<img src=\"'+escapeHtml(i.photo)+'\" alt=\"photo\">'; } div.innerHTML = html; c.appendChild(div); }); }catch(e){ c.innerHTML='<div style=\"padding:12px;color:#c00\">Failed to load reports.</div>'; console.error(e); } }
document.getElementById('reportForm').addEventListener('submit', async function(e){ e.preventDefault(); const fd=new FormData(e.target); const email=fd.get('email')||''; if(!email.endsWith('@svce.edu.in')){ alert('Please use your SVCE email'); return; } try{ const res=await fetch('/api/report',{ method:'POST', body:fd }); const j=await res.json(); if(j && j.error){ alert(j.error); } else { alert('Submitted'); e.target.reset(); loadIssues(); } }catch(err){ alert('Submission failed'); console.error(err); } });
loadIssues();
</script>
</body>
</html>`);
});

// Admin page (simple)
app.get('/admin', (req, res) => {
  // server-side build of admin HTML to avoid large inline scripts
  db.all('SELECT * FROM issues ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).send('DB error');
    let html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CampusFix Admin</title><style>body{font-family:system-ui,Arial;margin:16px;background:#f6f8fb;color:#0b2545}h1{margin:0 0 12px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(16,24,40,0.06)}th,td{padding:10px;border-bottom:1px solid #eef2f7;text-align:left}th{background:linear-gradient(90deg,#0066ff,#4b4fe1);color:#fff}button{padding:8px 10px;border-radius:8px;border:none;cursor:pointer}.fix{background:#16a34a;color:#fff}.img{max-width:120px;border-radius:8px}a{display:inline-block;margin-bottom:12px}</style></head><body><a href=\"/\">← Back</a><h1>Admin — CampusFix</h1><div style="margin-top:12px"><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Building</th><th>Description</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
    for (const r of rows) {
      const safeName = escapeHtmlServer(r.name);
      const safeEmail = escapeHtmlServer(r.email);
      const safeBuilding = escapeHtmlServer(r.building);
      const safeDesc = escapeHtmlServer(r.description);
      html += `<tr><td>${r.id}</td><td>${safeName}</td><td>${safeEmail}</td><td>${safeBuilding}</td><td>${safeDesc}</td><td>${r.status === 'Resolved' ? '<strong style="color:#16a34a">Resolved</strong>' : 'Open'}</td><td>${r.status === 'Open' ? `<form method="POST" action="/api/resolve/${r.id}"><button class="fix" type="submit">Mark Fixed</button></form>` : '—'}</td></tr>`;
    }
    html += `</tbody></table></div></body></html>`;
    res.send(html);
  });
});

function escapeHtmlServer(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// API: report
app.post('/api/report', upload.single('photo'), (req, res) => {
  const { name, email, building, floor, room, category, description } = req.body || {};
  if (!email || typeof email !== 'string' || !email.endsWith('@svce.edu.in')) {
    return res.status(400).json({ error: 'Please use your SVCE campus email' });
  }
  const photo = req.file ? '/uploads/' + req.file.filename : null;
  db.run('INSERT INTO issues (name,email,building,floor,room,category,description,photo) VALUES (?,?,?,?,?,?,?,?)',
    [name, email, building, floor, room, category, description, photo],
    function(err){
      if (err) {
        console.error('DB insert error', err);
        return res.status(500).json({ error: 'DB error' });
      }
      res.json({ success: true, id: this.lastID });
    });
});

// API: list issues
app.get('/api/issues', (req, res) => {
  db.all('SELECT * FROM issues ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json([]);
    // map photo path to absolute URL
    const mapped = rows.map(r => {
      return Object.assign({}, r, { photo: r.photo ? r.photo : null });
    });
    res.json(mapped);
  });
});

// API: resolve
app.post('/api/resolve/:id', (req, res) => {
  const id = Number(req.params.id) || 0;
  db.run("UPDATE issues SET status='Resolved' WHERE id = ?", [id], function(err){
    if (err) console.error('resolve error', err);
    res.redirect('/admin');
  });
});

// start server
app.listen(PORT, () => {
  console.log(`✅ CampusFix running at http://localhost:${PORT}`);
  try{ const open = require('child_process').exec; const url = 'http://localhost:' + PORT; if (process.platform === 'win32') open('start "" "' + url + '"'); else if (process.platform === 'darwin') open('open "' + url + '"'); else open('xdg-open "' + url + '"'); }catch(e){}
});
