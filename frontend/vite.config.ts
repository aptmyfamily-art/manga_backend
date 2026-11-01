import path from "path"
import fs from "fs"
import { execSync } from "child_process"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, Plugin } from "vite"

function getGitCommit(): string {
  if (process.env.VITE_GIT_COMMIT) {
    return process.env.VITE_GIT_COMMIT.slice(0, 7)
  }
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7)
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return "dev"
  }
}

const buildTime = new Date().toISOString()
const commitHash = getGitCommit()
const buildVersion = `${Date.now()}`
const packageVersion = process.env.npm_package_version || "2.0.0"

function versionManifestPlugin(): Plugin {
  const versionData = {
    version: buildVersion,
    commit: commitHash,
    packageVersion,
    buildTime,
  }

  return {
    name: "version-manifest",
    buildStart() {
      const publicDir = path.resolve(__dirname, "public")
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }
      fs.writeFileSync(
        path.resolve(publicDir, "version.json"),
        JSON.stringify(versionData, null, 2),
        "utf-8"
      )
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/version.json" || req.url?.startsWith("/version.json?")) {
          res.setHeader("Content-Type", "application/json")
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
          res.end(
            JSON.stringify(
              {
                version: "dev",
                commit: commitHash,
                packageVersion,
                buildTime: new Date().toISOString(),
              },
              null,
              2
            )
          )
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), versionManifestPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
