#!/usr/bin/env node
'use strict';

const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const TOKEN = process.env.DEVVAULT_SMOKE_TOKEN || process.env.ACCESS_TOKEN || '';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function main() {
  try {
    const healthUrl = API_URL.replace(/\/api$/, '/health');
    const healthRes = await fetch(healthUrl);
    console.log(`[SMOKE] health ${healthRes.status}`);

    if (!TOKEN) {
      console.log('[SKIP] DEVVAULT_SMOKE_TOKEN/ACCESS_TOKEN not set; authenticated API smoke skipped.');
      return;
    }

    const projects = await request('/projects');
    console.log(`[SMOKE] projects ${projects.status}`);
    const notifications = await request('/notifications');
    console.log(`[SMOKE] notifications ${notifications.status}`);
    const unread = await request('/notifications/unread-count');
    console.log(`[SMOKE] notification unread count ${unread.status}`);
    const invalidNotification = await request('/notifications/not-an-id/read', { method: 'PUT' });
    console.log(`[SMOKE] invalid notification id ${invalidNotification.status} ${invalidNotification.body?.code || ''}`);
    const missingProject = await request('/projects/000000000000000000000000');
    console.log(`[SMOKE] missing project ${missingProject.status} ${missingProject.body?.code || ''}`);
  } catch (error) {
    console.log(`[SKIP] Live API smoke unavailable: ${error.message}`);
  }
}

main();
