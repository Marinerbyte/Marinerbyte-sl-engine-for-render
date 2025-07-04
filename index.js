// START OF index.js CODE
const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const snakes = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const ladders = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };

app.get('/', (req, res) => res.send('Snake & Ladder Game Logic API is running!'));

app.get('/setup-database-secret-path', async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS games (id SERIAL PRIMARY KEY, status VARCHAR(20) DEFAULT 'active', turn_player_id INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS players (id SERIAL PRIMARY KEY, game_id INTEGER REFERENCES games(id), name VARCHAR(255) NOT NULL, position INT DEFAULT 0, status VARCHAR(20) DEFAULT 'active');`);
    res.status(200).send("Database tables created/ensured successfully!");
  } catch (err) { res.status(500).send("Error setting up database: " + err.message); }
});

app.post('/game/create', async (req, res) => {
  try {
    const result = await pool.query('INSERT INTO games (status) VALUES ($1) RETURNING id', ['active']);
    res.status(201).json({ message: 'Game created!', gameId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: 'DB error on create', details: err.message }); }
});

app.post('/game/:gameId/join', async (req, res) => {
    const { gameId } = req.params;
    const { playerName } = req.body;
    if (!playerName) return res.status(400).json({ error: "playerName is required" });
    try {
        const playerRes = await pool.query('INSERT INTO players (game_id, name, position) VALUES ($1, $2, 0) RETURNING id', [gameId, playerName.toLowerCase()]);
        const playersInGame = await pool.query('SELECT COUNT(*) FROM players WHERE game_id = $1', [gameId]);
        if (playersInGame.rows[0].count === '1') {
            await pool.query('UPDATE games SET turn_player_id = $1 WHERE id = $2', [playerRes.rows[0].id, gameId]);
        }
        res.json({ message: `${playerName} joined!` });
    } catch (err) { res.status(500).json({ error: 'DB error on join', details: err.message }); }
});

app.post('/game/:gameId/roll', async (req, res) => {
    const { gameId } = req.params;
    const { playerName } = req.body;
    if (!playerName) return res.status(400).json({ error: "playerName is required" });
    try {
        const gameRes = await pool.query('SELECT turn_player_id FROM games WHERE id = $1', [gameId]);
        const playerRes = await pool.query('SELECT id, position FROM players WHERE game_id = $1 AND name = $2', [gameId, playerName.toLowerCase()]);
        if (playerRes.rows.length === 0) return res.status(404).json({ error: "Player not found." });
        const currentPlayerId = playerRes.rows[0].id;
        const currentPosition = playerRes.rows[0].position;
        const turnPlayerId = gameRes.rows[0].turn_player_id;
        if (currentPlayerId !== turnPlayerId) {
            const turnPlayerNameRes = await pool.query('SELECT name FROM players WHERE id = $1', [turnPlayerId]);
            const waitingFor = turnPlayerNameRes.rows.length > 0 ? turnPlayerNameRes.rows[0].name : 'next player';
            return res.status(400).json({ error: `Not your turn! Wait for @${waitingFor}.` });
        }
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        let newPosition = currentPosition + diceRoll;
        let message = `@${playerName} rolled a ${diceRoll}.`;
        if (newPosition < 100) {
            if (ladders[newPosition]) { newPosition = ladders[newPosition]; message += ` 🪜 Ladder! Climbed to ${newPosition}.`; }
            else if (snakes[newPosition]) { newPosition = snakes[newPosition]; message += ` 🐍 Snake! Slid to ${newPosition}.`; }
            else { message += ` Moved to ${newPosition}.`; }
        } else { newPosition = 100; }
        await pool.query('UPDATE players SET position = $1 WHERE id = $2', [newPosition, currentPlayerId]);
        let winner = null;
        if (newPosition === 100) {
            winner = playerName;
            message = `@${playerName} rolled a ${diceRoll} and reached 100! 🎉 You won!`;
            await pool.query("UPDATE games SET status = 'finished', turn_player_id = NULL WHERE id = $1", [gameId]);
        } else {
            const activePlayersRes = await pool.query('SELECT id FROM players WHERE game_id = $1 AND status = $2 ORDER BY id', [gameId, 'active']);
            const activePlayerIds = activePlayersRes.rows.map(p => p.id);
            const currentPlayerIndex = activePlayerIds.indexOf(currentPlayerId);
            const nextPlayerIndex = (currentPlayerIndex + 1) % activePlayerIds.length;
            const nextPlayerId = activePlayerIds[nextPlayerIndex];
            await pool.query('UPDATE games SET turn_player_id = $1 WHERE id = $2', [nextPlayerId, gameId]);
        }
        const finalState = await pool.query('SELECT name, position FROM players WHERE game_id = $1 ORDER BY id', [gameId]);
        res.json({ message, diceRoll, winner, newState: finalState.rows });
    } catch (err) { res.status(500).json({ error: 'Server error on roll', details: err.message }); }
});

app.get('/game/:gameId/state', async (req, res) => {
    const { gameId } = req.params;
    try {
        const state = await pool.query('SELECT name, position FROM players WHERE game_id = $1 ORDER BY id', [gameId]);
        if (state.rows.length === 0) return res.status(404).json({error: "Game not found."});
        res.json({ players: state.rows });
    } catch (err) { res.status(500).json({ error: 'DB error on get state' }); }
});

app.listen(3000, () => console.log('Game Logic server is running.'));
