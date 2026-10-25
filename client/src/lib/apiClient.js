/**
 * Central Fetch Wrapper for Express REST API.
 * - Sends HTTP-only JWT cookie automatically (`credentials: 'include'`)
 * - Reads `usa_autocare_csrf` cookie and attaches `X-CSRF-Token` header on mutating requests
 * - Rejects immediately on network loss or non-2xx HTTP status so UI never shows false "Saved successfully"
 */

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiRequest(path, { method = 'GET', body, headers = {}, isFormData = false } = {}) {
  if (!navigator.onLine && method !== 'GET') {
    throw new Error('Network connection is offline. Changes have NOT been saved.');
  }

  const csrfToken = getCookie('usa_autocare_csrf');
  const reqHeaders = { ...headers };

  if (!isFormData) {
    reqHeaders['Content-Type'] = 'application/json';
  }
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    reqHeaders['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: reqHeaders,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const err = new Error(
      (payload && payload.message) || `Request failed with status ${response.status}`
    );
    err.status = response.status;
    err.code = payload?.code;
    err.errors = payload?.errors;
    throw err;
  }

  return payload;
}

export function formatLkr(minorUnits) {
  const val = Number(minorUnits || 0) / 100;
  return `LKR ${val.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTimeLK(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-LK', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
