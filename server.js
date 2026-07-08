const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'faculty-data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function readFacultyData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Failed to read faculty data', err);
    return [];
  }
}

function writeFacultyData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/faculties', (req, res) => {
  const faculties = readFacultyData();
  res.json(faculties);
});

app.post('/api/faculties', (req, res) => {
  const { name, schedule } = req.body;
  if (!name || typeof schedule !== 'object') {
    return res.status(400).json({ error: 'Invalid request payload' });
  }

  const faculties = readFacultyData();
  const existing = faculties.find(f => f.name === name);

  if (existing) {
    existing.schedule = schedule;
  } else {
    faculties.push({ name, schedule });
  }

  writeFacultyData(faculties);
  res.json({ success: true, faculties });
});

app.delete('/api/faculties/:name', (req, res) => {
  const name = req.params.name;
  const faculties = readFacultyData();
  const updated = faculties.filter(f => f.name !== name);

  if (updated.length === faculties.length) {
    return res.status(404).json({ error: 'Faculty not found' });
  }

  writeFacultyData(updated);
  res.json({ success: true, faculties: updated });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
