const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Supabase (These variables will be set in Render)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET: Fetch all faculties
app.get('/api/faculties', async (req, res) => {
  const { data: faculties, error } = await supabase
    .from('faculties')
    .select('name, schedule');

  if (error) {
    console.error('Error fetching data:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  res.json(faculties || []);
});

// POST: Add or update a faculty
app.post('/api/faculties', async (req, res) => {
  const { name, schedule } = req.body;
  if (!name || typeof schedule !== 'object') {
    return res.status(400).json({ error: 'Invalid request payload' });
  }

  // Supabase 'upsert' will update the row if the 'name' already exists, or insert a new one if it doesn't
  const { data, error } = await supabase
    .from('faculties')
    .upsert({ name, schedule }, { onConflict: 'name' }) 
    .select();

  if (error) {
    console.error('Error saving data:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  res.json({ success: true, faculties: data });
});

// DELETE: Remove a faculty
app.delete('/api/faculties/:name', async (req, res) => {
  const name = req.params.name;
  
  const { error } = await supabase
    .from('faculties')
    .delete()
    .eq('name', name);

  if (error) {
    console.error('Error deleting data:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});