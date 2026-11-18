export async function adminRequest(options: {
  path: string
  method: string
  body?: object
  signal: AbortSignal
  timeoutMs?: number
}): Promise<Response> {
  const { path, method, body, signal, timeoutMs = 8000 } = options
  return fetch(`/api/admin${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  })
}
