/**
 * /api/stats — account-wide analytics for the signed-in dashboard.
 */

import { Hono } from "hono"
import config from "../config.js"
import { authRequired, getAuth, hasScope } from "../middleware/auth.js"
import { getOverview } from "../db/clicks.js"

const stats = new Hono()

stats.get("/overview", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "stats:read")) return c.json({ error: "Not permitted" }, 403)
  const days = Math.min(
    Math.max(Number(c.req.query("days")) || config.analytics.defaultDays, 1),
    config.analytics.maxDays
  )
  return c.json({ ...getOverview(principal.user.id, days), days })
})

export default stats
