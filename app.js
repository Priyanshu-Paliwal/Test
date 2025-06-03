require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// 1. Disable 'x-powered-by'
app.disable('x-powered-by');

// 2. Apply helmet defaults
app.use(helmet());

// 3. Apply HSTS explicitly (2 years, include subdomains, preload)
app.use(helmet.hsts({
  maxAge: 63072000,
  includeSubDomains: true,
  preload: true
}));

// 4. Serve static files with `X-Content-Type-Options: nosniff`
app.use(express.static(path.join(__dirname, '/public'), {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// 5. Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 6. Routes
app.post('/client-credentials/', activity.fetchClientCredentials);
app.post('/fetch-external-key/', activity.fetchExternalKey);
app.post('/save/', activity.save);
app.post('/validate/', activity.validate);
app.post('/publish/', activity.publish);
app.post('/execute/', activity.execute);

// 7. Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT);
