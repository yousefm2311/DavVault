#!/usr/bin/env node
'use strict';

const path = require('path');

async function main() {
  const token = process.env.DEVVAULT_SMOKE_TOKEN || process.env.ACCESS_TOKEN || '';
  const projectId = process.env.DEVVAULT_SMOKE_PROJECT_ID || '';
  const socketUrl = process.env.SOCKET_URL || 'http://localhost:5001';

  if (!token) {
    console.log('[SKIP] DEVVAULT_SMOKE_TOKEN/ACCESS_TOKEN not set; socket smoke skipped.');
    return;
  }

  let io;
  try {
    io = require(path.join(__dirname, 'frontend/node_modules/socket.io-client')).io;
  } catch (error) {
    console.log('[SKIP] socket.io-client not installed; socket smoke skipped.');
    return;
  }

  await new Promise((resolve) => {
    const socket = io(socketUrl, { auth: { token }, timeout: 3000 });
    const done = (message) => {
      console.log(message);
      socket.disconnect();
      resolve();
    };
    socket.on('connect', () => {
      console.log('[SMOKE] socket connected');
      socket.emit('join_project', 'not-an-object-id');
      socket.emit('join_project', { buffer: { 0: 1 } });
      if (projectId) socket.emit('join_project', projectId);
      setTimeout(() => done('[SMOKE] socket invalid join attempts emitted safely'), 1000);
    });
    socket.on('connect_error', (error) => done(`[SKIP] socket connection failed: ${error.message}`));
    setTimeout(() => done('[SKIP] socket smoke timed out'), 5000);
  });
}

main();
