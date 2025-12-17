require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// ========================================================
// SECURITY HEADERS (Must be the FIRST app.use)
// ========================================================
app.use(
  helmet({
    // 1. Fixes "Missing Anti-clickjacking Header" (Medium Risk)
    frameguard: { action: "sameorigin" }, 

    // 2. Fixes "Strict-Transport-Security Header Not Set" (Low Risk)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    // 3. Fixes "X-Content-Type-Options Header Missing" (Low Risk)
    noSniff: true,

    // 4. Fixes "CSP Header Not Set" (Medium Risk) 
    // AND "Cross-Domain JavaScript Source File Inclusion" (Low Risk)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Fixes Console Errors: 'unsafe-eval' allows Salesforce/jQuery to run
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", 
          "https://*.marketingcloudapps.com",
          "https://*.exacttarget.com",
          "https://*.postgrid.com",
          "https://*.salesforce.com",
          "https://code.jquery.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net"
        ],
        // Fixes Style/Font loading issues
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://*.marketingcloudapps.com",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],
        // Fixes Image loading (blob: and data: are often needed)
        imgSrc: [
          "'self'",
          "data:",
          "blob:", 
          "https://*.marketingcloudapps.com",
          "https://*.postgrid.com"
        ],
        connectSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://api.postgrid.com"
        ],
        // Essential for Salesforce Apps: Allows your app to be shown inside Salesforce
        frameAncestors: ["'self'", "https://*.marketingcloudapps.com", "https://*.salesforce.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // 5. Fixes "Server Leaks Information via 'X-Powered-By'" (Low Risk)
    hidePoweredBy: true, 
  })
);

// ========================================================
// STATIC FILES & APP LOGIC
// ========================================================

// Serve static files AFTER security headers are set
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers (JSON/Form data)
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