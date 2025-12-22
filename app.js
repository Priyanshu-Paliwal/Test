require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const activity = require("./routes/activity");

const app = express();

// Security: Hide technical stack details from the header
app.disable("x-powered-by");

// SECURITY HEADERS (Strict Configuration)
app.use(
  helmet({
    // Security: Protects against Clickjacking
    frameguard: { action: "sameorigin" },

    // Security: Enforces HTTPS connections (HSTS)
    // This is already correct in your code!
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },

    // Security: Prevents MIME-type sniffing
    noSniff: true,

    // Security: Content Security Policy (CSP)
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://*.exacttarget.com",
          "https://*.postgrid.com",
          "https://*.salesforce.com",
          "https://code.jquery.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.marketingcloudapps.com",
          "https://*.postgrid.com",
        ],
        connectSrc: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://api.postgrid.com",
        ],
        frameAncestors: [
          "'self'",
          "https://*.marketingcloudapps.com",
          "https://*.salesforce.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Serve static assets
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Activity Routes
app.post("/client-credentials/", activity.fetchClientCredentials);
app.post("/fetch-external-key/", activity.fetchExternalKey);
app.post("/save/", activity.save);
app.post("/validate/", activity.validate);
app.post("/publish/", activity.publish);
app.post("/execute/", activity.execute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
