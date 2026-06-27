'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const response = await fetch(`${api}/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setMessage(data.message || data.error);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary p-6 text-white">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-card-border bg-card-bg/60 p-8">
        <h1 className="text-xl font-bold">Reset password</h1>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-xl border border-card-border bg-bg-primary px-4 py-3 outline-none"
        />
        <button className="w-full rounded-xl bg-accent-blue py-3 font-semibold">Send reset link</button>
        {message && <p className="text-xs text-text-secondary">{message}</p>}
        <Link href="/login" className="block text-center text-xs text-accent-blue">Back to login</Link>
      </form>
    </main>
  );
}
