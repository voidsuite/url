/**
 * OAuth 2.0 + PKCE helpers for VoidAuth. The client secret never reaches the
 * browser; Void Links only ever hands the browser an httpOnly session cookie.
 */

import { createHash } from "node:crypto"
import config from "../config.js"

export interface OAuthUser {
  id: string
  name: string
  email: string
  picture?: string
  role?: string
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  expiresIn?: number
  scope?: string
  user?: OAuthUser
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
  scope?: string
  user?: OAuthUser & { role?: string }
  error?: string
  error_description?: string
}

interface UserInfoResponse {
  sub?: string
  id?: string
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
  role?: string
}

const USERINFO_CACHE = new Map<string, { user: OAuthUser; expires: number }>()

export function generateRandomString(length: number): string {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Buffer.from(arr).toString("base64url")
}

export function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest("base64url")
}

export function buildAuthorizeParams(scope = config.oauthScopes) {
  const verifier = generateRandomString(32)
  const challenge = sha256Base64Url(verifier)
  const state = generateRandomString(16)
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${config.appUrl.replace(/\/+$/, "")}/oauth/callback`,
    response_type: "code",
    scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  })
  return { params, verifier, state }
}

export function authorizeUrl(params: URLSearchParams): string {
  return `${config.voidauthUrl}/oauth/authorize?${params.toString()}`
}

function mapTokens(data: TokenResponse): OAuthTokens {
  return {
    accessToken: data.access_token || "",
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    user: data.user
      ? {
          id: data.user.id,
          name: data.user.name || "",
          email: data.user.email || "",
          picture: data.user.picture,
          role: data.user.role,
        }
      : undefined,
  }
}

export async function exchangeCode(code: string, verifier: string): Promise<OAuthTokens> {
  const res = await fetch(`${config.voidauthUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${config.appUrl.replace(/\/+$/, "")}/oauth/callback`,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
    }),
  })
  const data = (await res.json()) as TokenResponse
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `Token exchange failed: ${res.status}`)
  }
  return mapTokens(data)
}

export async function refreshTokens(refreshToken: string, scope?: string): Promise<OAuthTokens> {
  const res = await fetch(`${config.voidauthUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...(scope ? { scope } : {}),
    }),
  })
  const data = (await res.json()) as TokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || `Token refresh failed: ${res.status}`)
  }
  return mapTokens(data)
}

export async function revokeToken(token: string): Promise<void> {
  if (!config.clientSecret) return
  await fetch(`${config.voidauthUrl}/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  }).catch(() => {})
}

export async function validateBearerToken(accessToken: string, force = false): Promise<OAuthUser> {
  const cached = USERINFO_CACHE.get(accessToken)
  if (!force && cached && cached.expires > Date.now()) return cached.user

  const res = await fetch(`${config.voidauthUrl}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Token validation failed: ${res.status}`)
  const data = (await res.json()) as UserInfoResponse
  const user: OAuthUser = {
    id: data.sub || data.id || "",
    name: data.name || data.preferred_username || "",
    email: data.email || "",
    picture: data.picture,
    role: data.role,
  }
  USERINFO_CACHE.set(accessToken, { user, expires: Date.now() + 60 * 1000 })
  return user
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
}
