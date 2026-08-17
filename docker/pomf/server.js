const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9999;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const name = Math.random().toString(36).substring(2, 10) + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/uploads', express.static(uploadDir));

// POMF API Endpoint (accepts any file field name: files[], files, file, fileToUpload, etc.)
app.post(['/upload.php', '/api/upload', '/upload'], upload.any(), (req, res) => {
  const files = (req.files || []).map(file => ({
    name: file.originalname,
    url: `${DOMAIN}/uploads/${file.filename}`,
    size: file.size
  }));

  console.log(`[POMF TEST SERVER] Uploaded ${files.length} file(s):`, files.map(f => f.url));

  res.json({
    success: true,
    files
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[POMF TEST SERVER] Running on ${DOMAIN} (listening on port ${PORT})`);
});
