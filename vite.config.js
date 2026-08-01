import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Serves the `/api/*` folder during `npm run dev`.
 *
 * In production these files are deployed as Vercel serverless functions. Vite
 * knows nothing about them, so without this plugin the AI endpoints only work
 * after deploying. The plugin loads each handler through Vite's SSR module
 * graph (so edits hot-reload) and hands it an Express-shaped `res`, which is
 * the same shape Vercel's Node runtime provides.
 */
function apiRoutes(env) {
  return {
    name: 'sejuk-api-routes',
    configureServer(server) {
      // Serverless functions read secrets from process.env, not import.meta.env.
      for (const [key, value] of Object.entries(env)) {
        if (!process.env[key]) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const route = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')
        const file = path.resolve(process.cwd(), 'api', `${route}.js`)
        if (!route || !fs.existsSync(file)) return next()

        try {
          const body = await readJsonBody(req)
          const mod = await server.ssrLoadModule(file)
          await mod.default(
            Object.assign(req, { body, query: queryOf(req.url) }),
            expressLikeResponse(res),
          )
        } catch (err) {
          server.config.logger.error(`[api] ${route}: ${err.stack || err.message}`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
        }
      })
    },
  }
}

function queryOf(url) {
  return Object.fromEntries(new URL(url, 'http://localhost').searchParams)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve({})
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function expressLikeResponse(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
    return res
  }
  return res
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), apiRoutes(env)] }
})
