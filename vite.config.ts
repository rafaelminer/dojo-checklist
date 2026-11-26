import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

type Row = { id: string; value: any };

// Backend local de desenvolvimento: o app chama POST "actions" com
// { action, args }. Em produção, aponte essa rota para o seu backend.
const DB_FILE = path.resolve(process.cwd(), ".data/db.json");
let store: Record<string, Row[]> = {};
try {
  store = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
} catch {
  store = {};
}
let seq = Date.now();

function persist() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2));
}

function handle(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  let raw = "";
  req.on("data", (chunk: any) => { raw += chunk; });
  req.on("end", () => {
    try {
      const { action, args } = JSON.parse(raw || "{}");
      const collection = String(args?.collection || "");
      const rows = () => store[collection] || (store[collection] = []);
      let data: any = {};
      switch (action) {
        case "records.list":
          data = { records: rows().slice(0, args?.limit || 200) };
          break;
        case "records.create": {
          const id = `${collection}-${seq++}`;
          rows().push({ id, value: args.value });
          persist();
          data = { id };
          break;
        }
        case "records.replace": {
          const arr = rows();
          const i = arr.findIndex((r) => r.id === args.id);
          if (i >= 0) arr[i] = { id: args.id, value: args.value };
          else arr.push({ id: args.id, value: args.value });
          persist();
          data = {};
          break;
        }
        case "records.delete":
          store[collection] = rows().filter((r) => r.id !== args.id);
          persist();
          data = {};
          break;
        default:
          throw new Error(`unknown action ${action}`);
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });
}

function handlePush(req: any, res: any) {
  // Em dev o push real depende das variáveis da Vercel; aqui é no-op.
  res.setHeader("content-type", "application/json");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
  } else {
    res.end(JSON.stringify({ sent: 0, failed: 0 }));
  }
}

function dojoApi(): Plugin {
  return {
    name: "dojo-local-api",
    configureServer(server) {
      server.middlewares.use("/actions", handle);
      server.middlewares.use("/api/push", handlePush);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/actions", handle);
      server.middlewares.use("/api/push", handlePush);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dojoApi()],
});
