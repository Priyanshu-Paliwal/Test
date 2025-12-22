require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// Security: Hide technical stack details from the header
app.disable('x-powered-by');

// SECURITY HEADERS (Strict Configuration)
app.use(
  helmet({
    // Security: Protects against Clickjacking
    frameguard: { action: "sameorigin" },

    // Security: Enforces HTTPS connections
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    // Security: Prevents MIME-type sniffing
    noSniff: true,

    // Security: Content Security Policy (CSP) to block malicious scripts
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        
        // Allow scripts only from trusted domains (No unsafe-inline/eval)
        scriptSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://*.exacttarget.com",
          "https://*.postgrid.com",
          "https://*.salesforce.com",
          "https://code.jquery.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net"
        ],
        
        // Allow styles from Google Fonts and Salesforce
        styleSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com"
        ],
        
        // Allow images and blobs
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.marketingcloudapps.com",
          "https://*.postgrid.com"
        ],
        
        // Allow API connections to PostGrid backend
        connectSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://api.postgrid.com"
        ],
        
        // Security: Critical for embedding inside Salesforce
        frameAncestors: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://*.salesforce.com"
        ],
        
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        
        // Security: Restrict where forms can be submitted
        formAction: ["'self'"], 
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Serve static assets (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Activity Routes
app.post('/client-credentials/', activity.fetchClientCredentials);
app.post('/fetch-external-key/', activity.fetchExternalKey);
app.post('/save/', activity.save);
app.post('/validate/', activity.validate);
app.post('/publish/', activity.publish);
app.post('/execute/', activity.execute);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});