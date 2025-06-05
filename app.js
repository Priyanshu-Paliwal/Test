require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ✅ Static files served first
app.use(express.static(path.join(__dirname, 'public')));

app.use(
        helmet({
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    'default-src': ["'self'"],
  'script-src': ["'self'", "https://*.marketingcloudapps.com"],
  'style-src': ["'self'", "https://*.marketingcloudapps.com"],
  'img-src': ["'self'", "data:", "https://*.marketingcloudapps.com"],
  'connect-src': ["'self'", "https://*.marketingcloudapps.com"],
  'frame-ancestors': ["'self'", "https://*.marketingcloudapps.com"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
  'upgrade-insecure-requests': [],
                }
            }
        })
);

// ✅ Disable "X-Powered-By" for security
app.disable('x-powered-by');

// ✅ Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Your API routes
app.post('/client-credentials/', activity.fetchClientCredentials);
app.post('/fetch-external-key/', activity.fetchExternalKey);
app.post('/save/', activity.save);
app.post('/validate/', activity.validate);
app.post('/publish/', activity.publish);
app.post('/execute/', activity.execute);

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
