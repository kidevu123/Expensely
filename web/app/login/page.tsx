"use client";
import { useState } from 'react';
import { setUser, User } from '../../lib/auth';

function getApiBase(): string {
	const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || '';
	if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
	if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
	return '';
}

export default function Login(){
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e:any){ e.preventDefault(); setBusy(true);
    try{
      const base = getApiBase();
      const r = await fetch(`${base}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email||undefined, username: username||undefined, password }) });
      const j = await r.json().catch(()=>({ error:'Network error' })); setBusy(false);
      if(r.ok){ setUser(j.user as User); window.location.href = '/'; } else { alert(j.error||'Login failed'); }
    } catch (err:any) {
      setBusy(false); alert('Network error. Please check connectivity.');
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-medium mb-4">Sign in</h2>
      <form onSubmit={submit} className="card grid gap-3">
        <div>
          <label className="text-sm text-slate-600">Username or Email</label>
          <input className="input" placeholder="username or you@company.com" value={username || email} onChange={(e)=>{ const v=e.target.value; if(v.includes('@')){ setEmail(v); setUsername(''); } else { setUsername(v); setEmail(''); } }} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>{busy? 'Signing in…':'Sign in'}</button>
      </form>
    </main>
  );
}

