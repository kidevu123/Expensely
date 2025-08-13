"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUser } from '../lib/auth';
const API = process.env.NEXT_PUBLIC_API_BASE_URL as string;
export default function Home(){
  const [mounted, setMounted] = useState(false);
  const [u, setU] = useState<any>(null);
  const [metrics, setMetrics] = useState<any|null>(null);
  useEffect(()=>{ setU(getUser()); setMounted(true); },[]);
  useEffect(()=>{ if(!mounted) return; (async()=>{ const m=await (await fetch(`${API}/api/admin/metrics`)).json(); setMetrics(m); })(); },[mounted]);
  useEffect(()=>{
    if(!mounted) return;
    if(!u) return;
    if(u.role==='attendee'){ window.location.href='/upload'; return; }
    if(u.role==='accountant'){ window.location.href='/accounting'; return; }
  },[mounted,u]);
  useEffect(()=>{ if(mounted && !u){ window.location.href = '/login'; } },[mounted,u]);
  if(!mounted || !u) return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Expensely</h1>
      <p className="text-slate-600 mb-6">Redirecting to sign in…</p>
    </main>
  );
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="profile-card mb-6">
        <img className="avatar-lg" src={(u as any)?.avatar_url||`https://www.gravatar.com/avatar/${btoa(u.email)}?d=identicon`} alt="avatar" />
        <div>
          <div className="text-2xl font-semibold">Welcome, {u.name||u.email}</div>
          <div className="text-slate-600">Role: {u.role}</div>
        </div>
      </div>
      {(u?.role==='admin' && metrics) && (
        <div className="grid md:grid-cols-4 gap-3 mb-6">
          <div className="card"><div className="text-sm text-slate-500">Users</div><div className="text-2xl font-semibold">{metrics.totals.users}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Shows</div><div className="text-2xl font-semibold">{metrics.totals.shows}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Expenses</div><div className="text-2xl font-semibold">{metrics.totals.expenses}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Active now</div><div className="text-2xl font-semibold">{metrics.activeNow.length}</div></div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {(u?.role==='admin') && (
          <div className="card">
            <h3 className="font-medium mb-2">Admin</h3>
            <p className="text-sm text-slate-600 mb-3">User management and RBAC controls.</p>
            <Link href="/admin" className="btn-primary">Open</Link>
          </div>
        )}
        {(u?.role==='admin' || u?.role==='coordinator') && (
          <div className="card">
            <h3 className="font-medium mb-2">Coordinator</h3>
            <p className="text-sm text-slate-600 mb-3">Create shows, add participants and itineraries.</p>
            <Link href="/coordinator" className="btn-primary">Open</Link>
          </div>
        )}
        {/* Accountant and Attendee auto-redirect; tiles hidden for them */}
        {(u?.role==='admin') && (
          <div className="card">
            <h3 className="font-medium mb-2">Accounting</h3>
            <p className="text-sm text-slate-600 mb-3">Review and push expenses to Zoho; reporting.</p>
            <Link href="/accounting" className="btn-primary">Open</Link>
          </div>
        )}
      </div>
    </main>
  );
}

