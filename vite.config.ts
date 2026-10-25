import { defineConfig, type Plugin, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import handler from './api/db.ts';

function apiDevServerPlugin(env: Record<string, string>): Plugin {
  const middleware = async (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/db')) return next();

    // Ensure environment variables are attached to process.env
    if (!process.env.TURSO_DB_URL && env.TURSO_DB_URL) {
      process.env.TURSO_DB_URL = env.TURSO_DB_URL;
    }
    if (!process.env.TURSO_AUTH_TOKEN && env.TURSO_AUTH_TOKEN) {
      process.env.TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query: Record<string, string> = {};
    parsedUrl.searchParams.forEach((v, k) => { query[k] = v; });

    let body: any = null;
    if (req.method === 'POST') {
      const buffers: Buffer[] = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const bodyStr = Buffer.concat(buffers).toString('utf8');
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }
    }

    const vercelRes = {
      status(code: number) { res.statusCode = code; return this; },
      setHeader(name: string, value: string) { res.setHeader(name, value); return this; },
      json(data: any) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return this;
      },
      end() { res.end(); }
    };

    const vercelReq = {
      method: req.method,
      query,
      body,
      headers: req.headers as any,
    };

    try {
      await handler(vercelReq, vercelRes as any);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err?.message || 'Server error' }));
    }
  };

  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: '/',
    plugins: [react(), apiDevServerPlugin(env)],
    server: {
      port: 5175,
      host: true, // allow LAN access from other PCs/phones
    },
    preview: {
      port: 5175,
      host: true,
    }
  };
});
