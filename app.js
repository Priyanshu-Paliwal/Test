require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// ========================================================
// SECURITY HEADERS (MUST BE FIRST)
// ========================================================
app.use(
  helmet({
    // 1. Fixes "Missing Anti-clickjacking Header" (Medium Risk)
    // We set 'sameorigin' here, but the CSP 'frame-ancestors' below takes priority for Salesforce.
    frameguard: { action: "sameorigin" },

    // 2. Fixes "Strict-Transport-Security Header Not Set" (Low Risk)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    // 3. Fixes "Server Leaks Information via X-Powered-By" (Low Risk)
    xPoweredBy: false,

    // 4. Fixes "X-Content-Type-Options Header Missing" (Low Risk)
    noSniff: true,

    // 5. Fixes "CSP Header Not Set" (Medium Risk) & "Cross-Domain JS"
    contentSecurityPolicy: {
      useDefaults: false, // CRITICAL: Stops Helmet from adding conflicting default rules
      directives: {
        defaultSrc: ["'self'"],
        
        // SCRIPT-SRC: Defines where executable code can come from
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for basic UI frameworks
          "'unsafe-eval'",   // Required for Salesforce & PostGrid functionality
          "https://*.marketingcloudapps.com",
          "https://*.exacttarget.com",
          "https://*.postgrid.com",
          "https://*.salesforce.com",
          "https://code.jquery.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net"
        ],
        
        // STYLE-SRC: Defines where CSS can come from
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://*.marketingcloudapps.com", 
          "https://fonts.googleapis.com", 
          "https://cdnjs.cloudflare.com"
        ],
        
        // IMG-SRC: Defines where images can load from
        imgSrc: [
          "'self'", 
          "data:", 
          "blob:", 
          "https://*.marketingcloudapps.com", 
          "https://*.postgrid.com"
        ],
        
        // CONNECT-SRC: Defines where AJAX/API calls can go
        connectSrc: [
          "'self'", 
          "https://*.marketingcloudapps.com", 
          "https://api.postgrid.com"
        ],
        
        // FRAME-ANCESTORS: The modern fix for Clickjacking (allows Salesforce embedding)
        frameAncestors: [
          "'self'", 
          "https://*.marketingcloudapps.com", 
          "https://*.salesforce.com"
        ],
        
        // EXTRAS
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// ========================================================
// STATIC FILES (MUST BE AFTER SECURITY HEADERS)
// ========================================================
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// APP LOGIC (NO CHANGES TO FUNCTIONALITY)
// ========================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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