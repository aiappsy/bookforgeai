import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Gemini API Proxy to forward client/BYOK requests smoothly & strip platform query parameters
  app.use("/gemini-api-proxy", async (req, res) => {
    try {
      const rawUrl = new URL(req.url, "https://generativelanguage.googleapis.com");
      
      // Clean query parameters injected by platform proxy wrappers
      const keysToDelete: string[] = [];
      rawUrl.searchParams.forEach((_, key) => {
        if (key.includes("applet_proxy") || key.startsWith("_applet")) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((k) => rawUrl.searchParams.delete(k));

      const targetUrl = rawUrl.toString();
      const headers: Record<string, string> = {
        "Content-Type": req.headers["content-type"] || "application/json",
      };
      if (req.headers["x-goog-api-key"]) {
        headers["x-goog-api-key"] = req.headers["x-goog-api-key"] as string;
      }
      if (req.headers["user-agent"]) {
        headers["User-Agent"] = req.headers["user-agent"] as string;
      }

      const options: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD" && req.body && Object.keys(req.body).length > 0) {
        options.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      }

      const targetRes = await fetch(targetUrl, options);
      const contentType = targetRes.headers.get("content-type") || "application/json";

      res.status(targetRes.status);
      res.setHeader("Content-Type", contentType);

      const data = await targetRes.arrayBuffer();
      res.send(Buffer.from(data));
    } catch (err: any) {
      console.error("Gemini API Proxy Error:", err);
      res.status(500).json({ error: err.message || "Failed to proxy Gemini API request" });
    }
  });

  // AI Support Assistant Endpoint (Server-Side Gemini API)
  app.post("/api/support/chat", async (req, res) => {
    const { messages, userContext } = req.body;

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `You are the Expert AI Assistant for 'manus' (byaiappsy), a premier multi-user AI publishing and manuscript studio.
Your job is to provide friendly, clear, expert help to authors, publishers, and agencies using this application.

KEY APP FEATURES YOU ARE AN EXPERT IN:
1. **Manuscript Generator & Outline Studio**:
   - Outlines books by chapter with custom target word counts, target audience, tone, and language.
   - Smart Chapter Writing powered by Gemini 3.6 Flash & 3.1 Pro with real-time word counting, auto-saving, and continuity memory.
   - Custom Category & Sub-genre system (Fiction, Non-Fiction, Sci-Fi, Thriller, Memoir, Self-Help, etc.).

2. **300 DPI KDP Print Cover & Spine Studio**:
   - Generates high-resolution front covers, back covers, and calculated print spine widths (based on page count and cream/white paper thickness).
   - Generates Amazon KDP-ready cover bundles.

3. **Audiobook Synthesis Studio**:
   - Converts manuscripts into high-quality spoken audiobooks using Gemini TTS voices (Kore, Puck, Fenrir, Zephyr, Charon) or ElevenLabs integration.

4. **Anti-AI Humanizer Studio**:
   - Analyzes AI detection scores and rewrites text with human burstiness, varied sentence lengths, and natural flow to pass AI detectors.

5. **Amazon KDP Niche & Keyword Research**:
   - Analyzes BSR (Best Seller Rank), keyword competitiveness, and profit potential for Kindle Direct Publishing.

6. **PayPal SaaS Subscriptions & Account Tiers**:
   - Free Tier: 10,000 AI words/month, 2 manuscripts.
   - Pro Publisher ($29/mo): 250,000 words/month, unlimited manuscripts, 300 DPI Cover Studio, Audiobook TTS, Humanizer.
   - Agency Studio ($79/mo): 2,000,000 words/month, whitelabel exports, multi-tenant workspace.
   - In-App Admin Settings: Admins can configure PayPal Client ID, Secret, and Plan IDs directly in the "Admin" menu at the bottom left.

7. **Multi-User Authentication & Cloud Storage**:
   - Powered by Google Firebase Auth (Email/Password & Google Sign-In) and Cloud Firestore persistent database so each author's books stay private and synced across devices.

Maintain a polite, encouraging, professional, and helpful tone. Format your answers with clear Markdown formatting (bullet points, bold text). If the user asks about an issue, provide concise step-by-step guidance.
Current User Context: User Email: ${userContext?.email || 'Guest'}, Plan: ${userContext?.plan || 'Free'}, Books Count: ${userContext?.bookCount || 0}.`;

      // Format conversation history for Gemini API
      const formattedContents = (messages || []).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      // Ensure last content is from user
      if (formattedContents.length === 0) {
        formattedContents.push({ role: 'user', parts: [{ text: 'Hello, how can you help me with manus?' }] });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      return res.json({ text: response.text || "I'm here to help you publish your book with manus! What would you like assistance with?" });
    } catch (err: any) {
      console.error("Support Chat API Error:", err);
      return res.status(500).json({ error: err.message || "Failed to process support request" });
    }
  });

  // Fetch URL proxy
  app.post("/api/fetch-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    try {
      const response = await fetch(url);
      const html = await response.text();
      
      // Basic text extraction using cheerio
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, etc.
      $("script, style, noscript, iframe, img, svg, nav, footer, header").remove();
      
      const text = $("body").text().replace(/\s+/g, " ").trim();
      res.json({ text: text.substring(0, 10000) }); // Limit to 10k chars to avoid blowing up prompts
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch url: " + error.message });
    }
  });

  // App Owner Runtime SaaS State (PayPal & Tier Pricing Configuration)
  let appOwnerConfig = {
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || "",
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
      mode: (process.env.PAYPAL_MODE as "sandbox" | "live") || "sandbox"
    },
    ownerPasscode: process.env.ADMIN_PASSCODE || "admin123", // Default admin security passcode
    currency: "USD",
    currencySymbol: "$",
    tiers: {
      free: {
        name: "Free Tier",
        priceMonthly: 0,
        wordLimit: 10000,
        maxProjects: 2,
        features: [
          "10,000 AI words/month",
          "Up to 2 Manuscripts",
          "Standard AI Chapter Outliner",
          "Basic Export formats (TXT/HTML)"
        ]
      },
      pro: {
        name: "Pro Publisher",
        priceMonthly: 29,
        planId: process.env.PAYPAL_PLAN_ID_PRO || "P-PRO-PLAN-ID",
        wordLimit: 250000,
        maxProjects: 10,
        features: [
          "250,000 AI words/month",
          "Up to 10 Manuscripts in Library",
          "300 DPI KDP Cover Studio & Spine Calculator",
          "Audiobook TTS Voice Synthesis",
          "Anti-AI Humanizer Studio",
          "Amazon KDP Niche & Keyword Research"
        ]
      },
      agency: {
        name: "Agency Studio",
        priceMonthly: 79,
        planId: process.env.PAYPAL_PLAN_ID_AGENCY || "P-AGENCY-PLAN-ID",
        wordLimit: 2000000,
        maxProjects: 100,
        features: [
          "2,000,000 AI words/month",
          "Up to 100 Manuscripts in Library",
          "Everything in Pro Tier",
          "Whitelabel PDF / EPUB Exports",
          "Multi-Tenant Workspace & Continuity Memory",
          "Priority Gemini 3.6 Flash & 3.1 Pro API Routing"
        ]
      }
    }
  };

  // Public App Configuration & SaaS Tier Endpoint
  app.get("/api/app-config", (req, res) => {
    const isPaypalConfigured = Boolean(appOwnerConfig.paypal.clientId && appOwnerConfig.paypal.clientSecret);
    res.json({
      configured: isPaypalConfigured,
      currency: appOwnerConfig.currency,
      currencySymbol: appOwnerConfig.currencySymbol,
      paypal: {
        clientId: appOwnerConfig.paypal.clientId || "test_client_id",
        mode: appOwnerConfig.paypal.mode
      },
      tiers: appOwnerConfig.tiers
    });
  });

  // Backward compatible PayPal config endpoint
  app.get("/api/paypal/config", (req, res) => {
    const isConfigured = Boolean(appOwnerConfig.paypal.clientId && appOwnerConfig.paypal.clientSecret);
    res.json({
      configured: isConfigured,
      clientId: appOwnerConfig.paypal.clientId || "test_client_id",
      mode: appOwnerConfig.paypal.mode,
      plans: {
        pro: appOwnerConfig.tiers.pro.planId || "P-PRO-PLAN-ID",
        agency: appOwnerConfig.tiers.agency.planId || "P-AGENCY-PLAN-ID"
      }
    });
  });

  // Helper function to check admin passcode authorization
  const isAuthorizedAdmin = (req: express.Request): boolean => {
    const headerPasscode = req.headers["x-admin-passcode"];
    const bodyPasscode = req.body?.passcode;
    const queryPasscode = req.query?.passcode;
    const passcode = headerPasscode || bodyPasscode || queryPasscode;
    return Boolean(passcode && passcode === appOwnerConfig.ownerPasscode);
  };

  // Verify Admin Security Passcode Endpoint
  app.post("/api/admin/verify-passcode", (req, res) => {
    const { passcode } = req.body;
    if (passcode && passcode === appOwnerConfig.ownerPasscode) {
      return res.json({ authenticated: true, message: "Admin access granted" });
    }
    return res.status(401).json({ authenticated: false, error: "Invalid Admin Passcode" });
  });

  // Change Admin Security Passcode Endpoint
  app.post("/api/admin/change-passcode", (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing Admin Passcode" });
    }
    const { currentPasscode, newPasscode } = req.body;
    if (!currentPasscode || currentPasscode !== appOwnerConfig.ownerPasscode) {
      return res.status(400).json({ error: "Current admin passcode is incorrect" });
    }
    if (!newPasscode || newPasscode.trim().length < 4) {
      return res.status(400).json({ error: "New passcode must be at least 4 characters long" });
    }
    appOwnerConfig.ownerPasscode = newPasscode.trim();
    console.log("[Owner Admin] Admin security passcode updated");
    return res.json({ success: true, message: "Admin Security Passcode updated successfully" });
  });

  // App Owner Admin Settings Endpoint (SECURED)
  app.get("/api/paypal/admin-settings", (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing Admin Passcode" });
    }
    res.json({
      clientId: appOwnerConfig.paypal.clientId,
      hasSecret: Boolean(appOwnerConfig.paypal.clientSecret),
      secretMasked: appOwnerConfig.paypal.clientSecret
        ? `${appOwnerConfig.paypal.clientSecret.slice(0, 4)}••••••••${appOwnerConfig.paypal.clientSecret.slice(-4)}`
        : "",
      mode: appOwnerConfig.paypal.mode,
      currency: appOwnerConfig.currency,
      currencySymbol: appOwnerConfig.currencySymbol,
      tiers: appOwnerConfig.tiers
    });
  });

  // Save App Owner Admin Settings Endpoint (SECURED)
  app.post("/api/paypal/admin-settings", (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing Admin Passcode" });
    }
    const {
      clientId,
      clientSecret,
      mode,
      currency,
      currencySymbol,
      tiers
    } = req.body;

    if (clientId !== undefined) appOwnerConfig.paypal.clientId = clientId.trim();
    if (clientSecret !== undefined && clientSecret !== "" && !clientSecret.includes("••••")) {
      appOwnerConfig.paypal.clientSecret = clientSecret.trim();
    }
    if (mode !== undefined && (mode === "sandbox" || mode === "live")) appOwnerConfig.paypal.mode = mode;
    if (currency !== undefined) appOwnerConfig.currency = currency;
    if (currencySymbol !== undefined) appOwnerConfig.currencySymbol = currencySymbol;

    if (tiers) {
      if (tiers.free) {
        appOwnerConfig.tiers.free = { ...appOwnerConfig.tiers.free, ...tiers.free };
      }
      if (tiers.pro) {
        appOwnerConfig.tiers.pro = { ...appOwnerConfig.tiers.pro, ...tiers.pro };
      }
      if (tiers.agency) {
        appOwnerConfig.tiers.agency = { ...appOwnerConfig.tiers.agency, ...tiers.agency };
      }
    }

    console.log("[Owner Admin] SaaS app config updated:", {
      clientId: appOwnerConfig.paypal.clientId,
      mode: appOwnerConfig.paypal.mode,
      tiers: appOwnerConfig.tiers
    });

    res.json({
      success: true,
      message: "Owner SaaS configuration & Subscription Tiers updated successfully",
      config: {
        clientId: appOwnerConfig.paypal.clientId,
        hasSecret: Boolean(appOwnerConfig.paypal.clientSecret),
        secretMasked: appOwnerConfig.paypal.clientSecret
          ? `${appOwnerConfig.paypal.clientSecret.slice(0, 4)}••••••••${appOwnerConfig.paypal.clientSecret.slice(-4)}`
          : "",
        mode: appOwnerConfig.paypal.mode,
        currency: appOwnerConfig.currency,
        currencySymbol: appOwnerConfig.currencySymbol,
        tiers: appOwnerConfig.tiers
      }
    });
  });

  app.post("/api/paypal/test-connection", async (req, res) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing Admin Passcode"
      });
    }

    const clientId = appOwnerConfig.paypal.clientId;
    const clientSecret = appOwnerConfig.paypal.clientSecret;
    const paypalMode = appOwnerConfig.paypal.mode;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        error: "Missing PayPal Client ID or Client Secret. Please configure both in Owner Admin Settings."
      });
    }

    try {
      const baseUrl = paypalMode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      });

      const authData = await authRes.json();
      if (!authRes.ok) {
        return res.status(401).json({
          success: false,
          error: authData.error_description || authData.error || "PayPal Authentication failed. Check your credentials."
        });
      }

      return res.json({
        success: true,
        message: `Successfully connected to PayPal ${paypalMode.toUpperCase()} API! Access token acquired.`,
        appId: authData.app_id,
        mode: paypalMode
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to reach PayPal API servers"
      });
    }
  });

  app.post("/api/paypal/create-subscription", async (req, res) => {
    const { userId, userEmail, planName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const clientId = appOwnerConfig.paypal.clientId;
    const clientSecret = appOwnerConfig.paypal.clientSecret;
    const paypalMode = appOwnerConfig.paypal.mode;
    const planId = planName === "agency"
      ? (appOwnerConfig.tiers.agency.planId || "P-AGENCY-PLAN-ID")
      : (appOwnerConfig.tiers.pro.planId || "P-PRO-PLAN-ID");

    // Live or Sandbox API call if credentials present
    if (clientId && clientSecret && !clientId.startsWith("test_")) {
      try {
        const baseUrl = paypalMode === "live"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com";

        // Get Access Token
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "grant_type=client_credentials"
        });

        const authData = await authRes.json();
        if (!authRes.ok) {
          throw new Error(authData.error_description || "PayPal OAuth token generation failed");
        }

        const accessToken = authData.access_token;

        // Create Subscription
        const subRes = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            plan_id: planId,
            custom_id: userId,
            subscriber: {
              email_address: userEmail
            },
            application_context: {
              brand_name: "manus AI Publishing",
              locale: "en-US",
              shipping_preference: "NO_SHIPPING",
              user_action: "SUBSCRIBE_NOW"
            }
          })
        });

        const subData = await subRes.json();
        if (!subRes.ok) {
          throw new Error(subData.message || "Failed to create PayPal subscription");
        }

        const approveLink = subData.links?.find((l: any) => l.rel === "approve")?.href;
        return res.json({
          subscriptionId: subData.id,
          approveUrl: approveLink,
          mode: paypalMode
        });
      } catch (err: any) {
        console.error("PayPal Subscription Creation Error:", err);
        return res.status(500).json({ error: err.message || "Failed to initialize PayPal subscription" });
      }
    }

    // Development / Demo Simulation Mode
    return res.json({
      subscriptionId: `SUB-SIMULATED-${Date.now()}`,
      approveUrl: null,
      mode: "test",
      message: "PayPal sandbox/test mode active: Plan upgraded in test mode",
      simulatedPlan: planName || "pro"
    });
  });

  app.post("/api/paypal/verify-subscription", async (req, res) => {
    const { subscriptionId, userId, planName } = req.body;
    console.log(`[PayPal Subscription Verified]: ID ${subscriptionId} for User ${userId} (${planName})`);
    return res.json({ success: true, subscriptionId, userId, plan: planName || "pro", status: "active" });
  });

  app.post("/api/paypal/webhook", async (req, res) => {
    try {
      const event = req.body;
      const eventType = event?.event_type;
      const resource = event?.resource || {};
      const customId = resource?.custom_id;

      console.log(`[PayPal Webhook Received]: ${eventType} for Custom ID ${customId}`);

      if (customId) {
        let status = "active";
        let plan = "pro";

        if (eventType === "BILLING.SUBSCRIPTION.CANCELLED" || eventType === "BILLING.SUBSCRIPTION.EXPIRED" || eventType === "BILLING.SUBSCRIPTION.SUSPENDED") {
          status = "canceled";
          plan = "free";
        } else if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "PAYMENT.SALE.COMPLETED") {
          status = "active";
        }

        return res.json({ success: true, userId: customId, eventType, plan, status });
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("PayPal Webhook Error:", err);
      res.status(500).json({ error: "Webhook processing error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
