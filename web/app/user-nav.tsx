"use client";
import { useEffect, useState } from 'react';
import { getUser, clearUser, type User } from '../lib/auth';

export default function UserNav(){
  const [mounted, setMounted] = useState(false);
  const [u, setU] = useState<User|null>(null);
  useEffect(()=>{ setU(getUser()); setMounted(true); },[]);
  // heartbeat for active sessions analytics
  useEffect(()=>{
    if(!u) return;
    const API = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    const id = setInterval(()=>{ fetch(`${API}/api/analytics/heartbeat`, { method:'POST', headers:{ 'x-user-email': u.email } }); }, 30000);
    return ()=> clearInterval(id);
  },[u]);
  // refresh user from server (to get persisted avatar updates)
  useEffect(()=>{ (async()=>{ if(!u) return; try{ const API = process.env.NEXT_PUBLIC_API_BASE_URL as string; const r=await fetch(`${API}/api/users/me`, { headers:{ 'x-user-email': u.email } }); if(r.ok){ const j=await r.json(); setU(j as any); } }catch{} })(); },[mounted]);
  if(!mounted) return <div className="w-40 h-6"/>;
  if(!u) return (<div className="flex items-center gap-3 text-sm"><a className="text-white hover:underline" href="/login">Sign in</a></div>);
  return (
    <div className="flex items-center gap-3 text-sm">
      <a href="/settings" title="Settings"><img src={u.avatar_url||`https://www.gravatar.com/avatar/${btoa(u.email)}?d=identicon`} className="w-8 h-8 rounded-full border border-white/40" alt="avatar"/></a>
      <div className="hidden sm:block text-white"><div className="font-medium leading-tight">{u.name||u.email}</div><div className="text-white/80 text-xs">{u.role}</div></div>
      <button className="btn-outline" onClick={()=>{ clearUser(); location.href='/login'; }}>Sign out</button>
    </div>
  );
}

