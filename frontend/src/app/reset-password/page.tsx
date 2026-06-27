'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const params = new URLSearchParams(window.location.search);
    const response = await fetch(`${api}/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.get('email'),
        token: params.get('token'),
        password,
      }),
    });
    const data = await response.json();
    setMessage(data.message || data.error);
    if (response.ok) setTimeout(() => router.push('/login'), 1000);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-white">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-card-border bg-card-bg/60 p-8">
        <h1 className="text-xl font-bold">Choose a new password</h1>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="10+ chars, upper/lowercase, number, symbol"
          required
          className="w-full rounded-xl border border-card-border bg-bg-primary px-4 py-3 outline-none"
        />
        <button className="w-full rounded-xl bg-accent-blue py-3 font-semibold">Update password</button>
        {message && <p className="text-xs text-text-secondary">{message}</p>}
      </form>
    </main>
  );
}
