require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// ========================================================
// 1. GLOBAL SETTINGS (Fixes "X-Powered-By" Low Risk)
// ========================================================
// We disable this immediately, before any middleware runs.
app.disable('x-powered-by');

// ========================================================
// 2. SECURITY HEADERS (MUST BE FIRST)
// ========================================================
app.use(
  helmet({
    // Fixes "Missing Anti-clickjacking Header" (Medium Risk)
    frameguard: { action: "sameorigin" },

    // Fixes "Strict-Transport-Security" (Low Risk)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    // Fixes "X-Content-Type-Options" (Low Risk)
    noSniff: true,

    // Fixes "CSP: Failure to Define Directive" (Medium Risk)
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        
        // Fixes "CSP Failure": explicitly define where forms can be sent
        formAction: ["'self'"], 
        
        // Essential for Salesforce/PostGrid (Keep 'unsafe-eval' or app breaks)
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
        styleSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "https://*.marketingcloudapps.com", 
          "https://fonts.googleapis.com", 
          "https://cdnjs.cloudflare.com"
        ],
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
        frameAncestors: [
          "'self'", 
          "https://*.marketingcloudapps.com", 
          "https://*.salesforce.com"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// ========================================================
// 3. STATIC FILES (MUST BE AFTER SECURITY HEADERS)
// ========================================================
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// 4. APP LOGIC
// ========================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/client-credentials/', activity.fetchClientCredentials);
app.post('/fetch-external-key/', activity.fetchExternalKey);
app.post('/save/', activity.save);
app.post('/validate/', activity.validate);
app.post('/publish/', activity.publish);
app.post('/execute/', activity.execute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});