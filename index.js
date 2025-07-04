const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

let db_connection_status = "Attempting to connect...";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000, // 10 second timeout
});

pool.connect((err, client, release) => {
  if (err) {
    db_connection_status = `ERROR: ${err.message}`;
    return console.error('DATABASE CONNECTION FAILED!', err.stack);
  }
  db_connection_status = 'Database connection successful.';
  console.log(db_connection_status);
  client.release();
});

const snakes = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const ladders = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };

app.get('/', (req, res) => {
  res.send(`<h1>API is live!</h1><h2>DB Status: ${db_connection_status}</h2>`);
});

// Important: Key changed from gameId to game_id
app.post('/game/create', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO games (status) VALUES ($1) RETURNING id', ['active']);
        res.status(201).json({ message: 'Game created!', game_id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// All other endpoints (/join, /roll, /state, /setup-database-secret-path)
// can be pasted here from the previous complete Node.js script.
// They don't need changes.
app.post('/game/:gameId/join', async (req, res) => { /* ... (paste full code here) ... */ });
app.post('/game/:gameId/roll', async (req, res) => { /* ... (paste full code here) ... */ });
app.get('/game/:gameId/state', async (req, res) => { /* ... (paste full code here) ... */ });
app.get('/setup-database-secret-path', async (req, res) => { /* ... (paste full code here) ... */ });


app.listen(3000, () => console.log('Game Logic server is running.'));
