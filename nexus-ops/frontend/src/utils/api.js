const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS  = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000'

// ── API key management ─────────────────────────────────────────────────────
// Stored in memory (per-session). Set via Settings page or VITE_API_KEY env.
let _apiKey = import.meta.env.VITE_API_KEY || localStorage.getItem('nexus_api_key') || 'demo-user'

export function setApiKey(key) {
  _apiKey = key
  localStorage.setItem('nexus_api_key', key)
}

export function getApiKey() { return _apiKey }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'X-API-Key': _apiKey }
}

// ── Tickets ────────────────────────────────────────────────────────────────

export async function submitTicket(ticketText, priority = 3) {
  const res = await fetch(`${API}/api/tickets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ticket: ticketText, priority }),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.detail?.reason || data.detail || `API error ${res.status}`)
    err.detail = data.detail
    throw err
  }
  return data
}

export async function cancelTicket(taskId) {
  const res = await fetch(`${API}/api/tickets/${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.detail?.reason || data.detail || `Cancel failed ${res.status}`)
    err.detail = data.detail
    throw err
  }
  return data
}

export async function validateTicket(ticketText) {
  if (!ticketText || ticketText.trim().length < 3)
    return { status: 'INCOMPLETE', error: 'Too short', suggestion: null }
  try {
    const res = await fetch(
      `${API}/api/health/validate?ticket=${encodeURIComponent(ticketText)}`,
      { headers: authHeaders() }
    )
    return await res.json()
  } catch {
    return { status: 'VALID', confidence: 0.5 }
  }
}

export async function previewCost(ticketText) {
  try {
    const res = await fetch(`${API}/api/tickets/preview-cost`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ticket: ticketText }),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function fetchTask(taskId) {
  const res = await fetch(`${API}/api/tickets/${taskId}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Task not found')
  return res.json()
}

export async function fetchTasks() {
  const res = await fetch(`${API}/api/tickets`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function fetchTrace(taskId) {
  try {
    const res = await fetch(`${API}/api/tickets/${taskId}/trace`, { headers: authHeaders() })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function fetchMetrics() {
  try {
    const res = await fetch(`${API}/api/metrics`, { headers: authHeaders() })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ── WebSocket ──────────────────────────────────────────────────────────────

export function connectToTask(taskId, onMessage, onClose) {
  let ws = null, reconnectTimer = null, stopped = false
  let delay = 1000, reconnects = 0
  const MAX_R = 5

  function connect() {
    if (stopped) return
    // Pass API key as query param (WS doesn't support custom headers in browser)
    ws = new WebSocket(`${WS}/ws/${taskId}?key=${encodeURIComponent(_apiKey)}`)
    ws.onopen  = () => { delay = 1000; reconnects = 0 }
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data)) } catch {} }
    ws.onclose = () => {
      if (stopped) { if (onClose) onClose(); return }
      if (reconnects < MAX_R) {
        reconnects++
        reconnectTimer = setTimeout(connect, delay)
        delay = Math.min(delay * 2, 8000)
      } else { if (onClose) onClose() }
    }
    ws.onerror = () => ws.close()
  }
  connect()
  return {
    close: () => {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
  }
}
