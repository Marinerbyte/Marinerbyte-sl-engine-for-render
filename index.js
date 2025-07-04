const express = require('express');
const app = express();
app.use(express.json());

// Test route for the home page
app.get('/', (req, res) => {
  console.log("SUCCESS: Root URL '/' was accessed.");
  res.send('API Server is running perfectly without a database!');
});

// Test route for creating a game
app.post('/game/create', (req, res) => {
  console.log("SUCCESS: /game/create endpoint was called.");
  // We send back a fake game ID
  res.status(201).json({ message: 'Fake game created!', gameId: 12345 });
});

app.listen(3000, () => {
  console.log('Simple test server is running on port 3000.');
});
