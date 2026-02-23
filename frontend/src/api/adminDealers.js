/**
 * Admin Dealer Management API Layer
 * All functions return response data or throw on error.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function authHeaders(token) {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function handleResponse(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
}

export async function getDealers(token, { page = 1, limit = 20, status = '', mandal = '', search = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    if (mandal) params.set('mandal', mandal);
    if (search) params.set('search', search);
    const res = await fetch(`${BASE}/api/admin/dealers?${params}`, {
        headers: authHeaders(token),
    });
    return handleResponse(res);
}

export async function getDealer(token, id) {
    const res = await fetch(`${BASE}/api/admin/dealers/${id}`, {
        headers: authHeaders(token),
    });
    return handleResponse(res);
}

export async function createDealer(token, payload) {
    const res = await fetch(`${BASE}/api/admin/dealers`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(payload),
    });
    return handleResponse(res);
}

export async function updateDealer(token, id, payload) {
    const res = await fetch(`${BASE}/api/admin/dealers/${id}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(payload),
    });
    return handleResponse(res);
}

export async function suspendDealer(token, id) {
    const res = await fetch(`${BASE}/api/admin/dealers/${id}/suspend`, {
        method: 'PUT',
        headers: authHeaders(token),
    });
    return handleResponse(res);
}

export async function reactivateDealer(token, id) {
    const res = await fetch(`${BASE}/api/admin/dealers/${id}/reactivate`, {
        method: 'PUT',
        headers: authHeaders(token),
    });
    return handleResponse(res);
}

export async function resetDealerPassword(token, id) {
    const res = await fetch(`${BASE}/api/admin/dealers/${id}/reset-password`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    return handleResponse(res);
}
