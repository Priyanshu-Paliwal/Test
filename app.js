require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// --- SECURITY MIDDLEWARE (MUST BE FIRST) ---
app.use(
  helmet({
    // 1. Fixes "Missing Anti-clickjacking Header" (X-Frame-Options)
    frameguard: { action: "deny" },

    // 2. Fixes "Strict-Transport-Security Header Not Set" (HSTS)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    // 3. Fixes "CSP Header Not Set" & allows your integrations
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", // Needed for many UI frameworks
          "https://*.marketingcloudapps.com", 
          "https://*.exacttarget.com",
          "https://*.postgrid.com", 
          "https://*.salesforce.com"
        ],
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://*.marketingcloudapps.com", 
          "https://fonts.googleapis.com"
        ],
        imgSrc: [
          "'self'", 
          "data:", 
          "https://*.marketingcloudapps.com",
          "https://*.postgrid.com"
        ],
        connectSrc: [
          "'self'", 
          "https://*.marketingcloudapps.com", 
          "https://api.postgrid.com"
        ],
        frameAncestors: ["'self'", "https://*.marketingcloudapps.com", "https://*.salesforce.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"], // Fixes Google Fonts
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Manually ensure nosniff is set (Helmet usually does this, but keeping it as backup is fine)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// --- STATIC FILES (Served AFTER security headers) ---
app.use(express.static(path.join(__dirname, 'public')));

// Disable "X-Powered-By"
app.disable('x-powered-by');

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API routes
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