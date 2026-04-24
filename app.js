require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const activity = require('./routes/activity');

const app = express();

// FIX 1: Trust Railway's proxy. 
// This fixes the "Strict-Transport-Security Header Not Set" ZAP alert.
app.enable('trust proxy');

// Security: Hide technical stack details from the header
app.disable('x-powered-by');

// SECURITY HEADERS (Strict Configuration)
app.use(
  helmet({
    // Security: Disable frameguard (we use CSP frameAncestors instead)
    frameguard: false,

    // Security: Enforces HTTPS connections (HSTS)
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    // Security: Prevents MIME-type sniffing
    noSniff: true,

    // Security: Disable referrer leakage
    referrerPolicy: { policy: 'no-referrer' },

    // Security: Restrict browser features
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },

    // Security: Content Security Policy (CSP) to block malicious scripts
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ['\'self\''],

        // Allow scripts only from trusted domains
        scriptSrc: [
          '\'self\'',
          'https://*.marketingcloudapps.com',
          'https://*.exacttarget.com',
          'https://*.postgrid.com',
          'https://*.salesforce.com'
        ],

        // Styles from trusted domains only (unsafe-inline removed for ZAP compliance)
        styleSrc: [
          '\'self\'',
          'https://*.marketingcloudapps.com',
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com'
        ],

        // Allow images and blobs
        imgSrc: [
          '\'self\'',
          'data:',
          'blob:',
          'https://*.marketingcloudapps.com',
          'https://*.postgrid.com'
        ],

        // Allow API connections to PostGrid backend
        connectSrc: [
          '\'self\'',
          'https://*.marketingcloudapps.com',
          'https://api.postgrid.com'
        ],

        // Security: Critical for embedding inside Salesforce Journey Builder
        frameAncestors: [
          '\'self\'',
          'https://*.marketingcloudapps.com',
          'https://*.salesforce.com',
          'https://*.exacttarget.com'
        ],

        // Allow iframes only from PostGrid (for PDF preview)
        frameSrc: [
          '\'self\'',
          'blob:',
          'https://*.postgrid.com',
          'https://*.amazonaws.com'
        ],

        fontSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        baseUri: ['\'self\''],
        workerSrc: ['\'none\''],

        // Security: Restrict where forms can be submitted
        formAction: ['\'self\''],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// FIX: Proper Cache-Control headers per file type (fixes ZAP Cache-control alert)
app.use((req, res, next) => {
  const url = req.url.toLowerCase();
  // Never cache HTML — always fresh
  if (url === '/' || url.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  // Immutable static assets (CSS, JS, fonts, images) — long cache
  } else if (
    url.endsWith('.css') || url.endsWith('.js') ||
    url.endsWith('.woff') || url.endsWith('.woff2') || url.endsWith('.ttf') ||
    url.endsWith('.ico') || url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.svg')
  ) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // robots.txt, sitemap.xml — short cache
  } else if (url.endsWith('.txt') || url.endsWith('.xml') || url.endsWith('.json')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// Serve static assets (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public'), {
  // Disable express's default etag + last-modified (we control caching above)
  etag: false,
  lastModified: false,
}));

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

// FIX: /stop route — referenced in config.json but was missing
app.post('/stop/', (req, res) => {
  res.status(200).send('Stop');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});