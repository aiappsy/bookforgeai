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

  app.use(express.json());

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
