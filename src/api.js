export let csrf = '';
export function setCsrf(value) {
  csrf = value;
}
export async function request(path, body, method = 'POST') {
  const form = body instanceof FormData;
  const response = await fetch('/api/' + path, {
    credentials: 'same-origin',
    ...(body !== undefined
      ? {
          method,
          headers: {
            ...(!form ? { 'Content-Type': 'application/json' } : {}),
            'X-CSRF-Token': csrf,
          },
          body: form ? body : JSON.stringify(body),
        }
      : {}),
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : {};
  if (!response.ok) {
    const e = new Error(data.error || 'Unable to complete the request.');
    e.status = response.status;
    throw e;
  }
  return data;
}
