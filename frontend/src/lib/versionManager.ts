import * as React from "react"
import { toast } from "sonner"

export interface AppVersionInfo {
  version: string
  commit: string
  packageVersion: string
  buildTime: string
}

export const CURRENT_BUILD_VERSION =
  typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev"
export const CURRENT_BUILD_TIME =
  typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "dev"
export const CURRENT_COMMIT =
  typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev"
export const CURRENT_PACKAGE_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "2.0.0"

export const LAST_RELOADED_KEY = "mgh_last_reloaded_version"

/**
 * Safe sessionStorage read wrapper to prevent crashes in private/sandboxed browsing.
 */
export function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(key)
    }
  } catch {
    // Restricted or unavailable in strict private mode
  }
  return null
}

/**
 * Safe sessionStorage write wrapper to prevent crashes in private/sandboxed browsing.
 */
export function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(key, value)
    }
  } catch {
    // Restricted or unavailable in strict private mode
  }
}

/**
 * Safe sessionStorage remove wrapper to prevent crashes in private/sandboxed browsing.
 */
export function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // Restricted or unavailable in strict private mode
  }
}

/**
 * Clean any cache-busting search params (?_v=..., ?_reload=..., or ?_t=...)
 * from the browser address bar while preserving the view path and hash.
 */
export function cleanCacheBustingParams() {
  try {
    const url = new URL(window.location.href)
    let changed = false
    if (url.searchParams.has("_v")) {
      url.searchParams.delete("_v")
      changed = true
    }
    if (url.searchParams.has("_reload")) {
      url.searchParams.delete("_reload")
      changed = true
    }
    if (url.searchParams.has("_t")) {
      url.searchParams.delete("_t")
      changed = true
    }
    if (changed) {
      const searchStr = url.searchParams.toString()
      const newUrl =
        url.pathname + (searchStr ? `?${searchStr}` : "") + url.hash
      window.history.replaceState(null, "", newUrl)
    }
  } catch {
    // Ignore errors in non-browser environments
  }
}

/**
 * Resolve the absolute endpoint for version.json.
 * Avoids relative "./version.json" resolution failures on sub-routes with trailing slashes (e.g. /connectors/).
 */
export function getVersionEndpoint(): string {
  const envBase =
    (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/"
  if (envBase.startsWith("/")) {
    const cleanBase = envBase.replace(/\/+$/, "")
    return `${cleanBase}/version.json`
  }
  return "/version.json"
}

/**
 * Fetch the latest version manifest directly from the server,
 * explicitly bypassing browser HTTP cache with unique timestamp, timeout, and no-store headers.
 */
export async function fetchRemoteVersion(
  timeoutMs = 6000
): Promise<AppVersionInfo | null> {
  // If browser is known to be offline, skip network request
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return null
  }

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  try {
    const targetUrl = `${getVersionEndpoint()}?_t=${Date.now()}`
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
      cache: "no-store",
      signal: controller?.signal,
    })

    if (!response.ok) {
      return null
    }

    const data: AppVersionInfo = await response.json()
    return data
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.warn("[VersionManager] Could not fetch remote version manifest:", err)
    }
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Check if the remote version is newer or different from the current loaded bundle.
 */
export function isNewerVersion(remote: AppVersionInfo | null): boolean {
  if (!remote || !remote.buildTime) return false

  // In local development or unbundled mode, skip mismatch detection
  if (
    CURRENT_BUILD_TIME === "dev" ||
    remote.buildTime === "dev" ||
    remote.version === "dev" ||
    CURRENT_BUILD_VERSION === "dev" ||
    (typeof import.meta !== "undefined" && import.meta.env?.DEV)
  ) {
    return false
  }

  // Parse ISO build times for chronological comparison
  const remoteTime = Date.parse(remote.buildTime)
  const currentTime = Date.parse(CURRENT_BUILD_TIME)

  if (!isNaN(remoteTime) && !isNaN(currentTime)) {
    // If remote build is newer than currently running bundle
    if (remoteTime > currentTime) {
      return true
    }
    // If remote build is older or identical, never trigger a false-positive downgrade
    if (remoteTime <= currentTime) {
      return false
    }
  }

  // Fallback for non-standard timestamp strings
  if (CURRENT_BUILD_TIME !== remote.buildTime) {
    return true
  }

  // Check version ID mismatch if not "dev"
  if (
    CURRENT_BUILD_VERSION !== "dev" &&
    remote.version &&
    CURRENT_BUILD_VERSION !== remote.version
  ) {
    return true
  }

  // Check commit mismatch if available
  if (
    CURRENT_COMMIT !== "dev" &&
    remote.commit !== "dev" &&
    CURRENT_COMMIT !== remote.commit
  ) {
    return true
  }

  return false
}

/**
 * Perform a cache-busting reload by redirecting to current URL with `_v=<version>`,
 * completely circumventing GitHub Pages 10-minute browser disk cache.
 *
 * @param targetVersion - version manifest identifier or custom token
 * @param isUserInitiated - if true, guarantees an immediate cache-busting reload even if URL or storage already contains targetVersion
 */
export function forceCacheBustingReload(
  targetVersion?: string,
  isUserInitiated = false
) {
  try {
    const versionKey = targetVersion || `${Date.now()}`
    safeSetStorage(LAST_RELOADED_KEY, versionKey)

    const url = new URL(window.location.href)
    // For automated mount reload, skip if query already contains this exact version to prevent infinite loops
    if (!isUserInitiated && url.searchParams.get("_v") === versionKey) {
      console.warn(
        `[VersionManager] Automated reload with target version ${versionKey} already performed. Skipping duplicate loop.`
      )
      return
    }

    // For user clicks or fresh target, append timestamp to guarantee edge CDN and browser cache bypass
    const finalParam = isUserInitiated
      ? `${versionKey}_${Date.now()}`
      : versionKey

    url.searchParams.set("_v", finalParam)
    window.location.replace(url.toString())
  } catch {
    try {
      window.location.reload()
    } catch {
      // Non-browser fallback
    }
  }
}

/**
 * Format ISO build time into user-friendly localized string.
 */
export function formatBuildDate(isoString: string): string {
  if (!isoString || isoString === "dev") return "Development"
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString("th-TH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoString
  }
}

export interface UseVersionWatcherOptions {
  onUpdateAvailable?: (info: AppVersionInfo) => void
  checkIntervalMs?: number
}

/**
 * React hook to manage automatic version checking, stale cache detection,
 * visibility change triggers, browser back/forward cache (bfcache) restoration,
 * and user-friendly update notifications.
 */
export function useVersionWatcher(options: UseVersionWatcherOptions = {}) {
  const { onUpdateAvailable, checkIntervalMs = 2 * 60 * 1000 } = options
  const [updateAvailable, setUpdateAvailable] =
    React.useState<AppVersionInfo | null>(null)
  const [isChecking, setIsChecking] = React.useState(false)
  const hasPromptedToast = React.useRef(false)
  const isMountedRef = React.useRef(true)
  const inFlightCheckRef = React.useRef(false)
  const onUpdateAvailableRef = React.useRef(onUpdateAvailable)

  // Keep callback ref updated without invalidating checkVersion
  React.useEffect(() => {
    onUpdateAvailableRef.current = onUpdateAvailable
  }, [onUpdateAvailable])

  // Track component mount lifecycle to prevent unmounted state updates
  React.useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const checkVersion = React.useCallback(
    async (isMountCheck = false) => {
      // Deduplicate concurrent check invocations
      if (inFlightCheckRef.current) {
        return
      }
      inFlightCheckRef.current = true

      if (isMountedRef.current) {
        setIsChecking(true)
      }

      try {
        const remote = await fetchRemoteVersion()
        if (!isMountedRef.current) return

        if (remote && isNewerVersion(remote)) {
          setUpdateAvailable(remote)
          onUpdateAvailableRef.current?.(remote)

          // On initial app mount (or bfcache restoration): auto-refresh if stale cache
          if (isMountCheck) {
            const lastReloaded = safeGetStorage(LAST_RELOADED_KEY)
            let currentParamV: string | null = null
            try {
              currentParamV = new URL(window.location.href).searchParams.get("_v")
            } catch {}

            if (
              lastReloaded !== remote.version &&
              lastReloaded !== remote.buildTime &&
              currentParamV !== remote.version
            ) {
              console.info(
                `[VersionManager] Stale cache detected on mount (${CURRENT_BUILD_TIME} vs ${remote.buildTime}). Auto-refreshing...`
              )
              forceCacheBustingReload(remote.version, false)
              return
            }
          }

          // If active in-session, show non-intrusive actionable notification once
          if (!hasPromptedToast.current) {
            hasPromptedToast.current = true
            toast.info("พบการอัปเดตระบบ MangaHub เวอร์ชันใหม่", {
              description: `เวอร์ชัน: ${remote.packageVersion || "ล่าสุด"} (${formatBuildDate(
                remote.buildTime
              )})`,
              action: {
                label: "อัปเดตทันที",
                onClick: () => forceCacheBustingReload(remote.version, true),
              },
              duration: 15000,
            })
          }
        } else {
          // We are on latest version: clean up session storage flag and any leftover _v param in URL
          safeRemoveStorage(LAST_RELOADED_KEY)
          cleanCacheBustingParams()
        }
      } finally {
        inFlightCheckRef.current = false
        if (isMountedRef.current) {
          setIsChecking(false)
        }
      }
    },
    [] // Stable reference: onUpdateAvailable is read from onUpdateAvailableRef
  )

  React.useEffect(() => {
    // 1. Check on mount
    checkVersion(true)

    // 2. Check when page is restored from browser back/forward cache (bfcache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkVersion(true)
      }
    }
    window.addEventListener("pageshow", handlePageShow)

    // 3. Check when user returns to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion(false)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // 4. Periodic background check (minimum 10s interval sanity clamp)
    const safeIntervalMs = Math.max(checkIntervalMs, 10000)
    const timer = setInterval(() => {
      checkVersion(false)
    }, safeIntervalMs)

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(timer)
    }
  }, [checkVersion, checkIntervalMs])

  return {
    updateAvailable,
    isChecking,
    checkVersion: () => checkVersion(false),
    applyUpdate: () => forceCacheBustingReload(updateAvailable?.version, true),
    currentVersion: CURRENT_PACKAGE_VERSION,
    currentBuildTime: CURRENT_BUILD_TIME,
    currentCommit: CURRENT_COMMIT,
  }
}
