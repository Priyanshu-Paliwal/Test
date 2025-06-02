require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// Use helmet for standard security headers
app.use(helmet());

// Explicitly add nosniff to all responses (in case helmet skips for static HTML)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.disable('x-powered-by');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API endpoints
app.post('/client-credentials/', activity.fetchClientCredentials);
app.post('/fetch-external-key/', activity.fetchExternalKey);
app.post('/save/', activity.save);
app.post('/validate/', activity.validate);
app.post('/publish/', activity.publish);
app.post('/execute/', activity.execute);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
