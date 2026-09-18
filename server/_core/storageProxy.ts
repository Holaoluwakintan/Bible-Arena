import type { Express } from "express";

export function registerStorageProxy(app: Express): void {
  app.get("/api/storage/*", (_req, res) => {
    res.status(404).json({ error: "Storage not configured" });
  });
}
