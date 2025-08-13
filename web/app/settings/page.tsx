"use client";
import { useEffect, useState } from 'react';
import { getUser, setUser } from '../../lib/auth';
const API = process.env.NEXT_PUBLIC_API_BASE_URL as string;

export default function Settings(){
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarFile, setAvatarFile] = useState<string>('');
  const [newPw, setNewPw] = useState('');

  useEffect(()=>{ setMounted(true); const u=getUser(); setMe(u); setName(u?.name||''); setEmail(u?.email||''); },[]);
  if(!mounted) return null;
  if(!me) return <main className="p-6 max-w-3xl mx-auto"><p>Please <a className="underline" href="/login">sign in</a>.</p></main>;

  async function saveProfile(){
    let avatar_url = me.avatar_url||'';
    if(avatarFile){ const fr=await fetch(`${API}/api/files`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: avatarFile, content_type: 'image/jpeg' }) }); const fj=await fr.json(); avatar_url = `${API}/files/${fj.id}`.replace(/\/$/, ''); }
    const r = await fetch(`${API}/api/users/${me.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, avatar_url }) });
    const j = await r.json(); if(!r.ok){ alert(j.error||'Failed'); return; }
    setUser({ ...me, name: j.name, email: j.email, avatar_url: j.avatar_url });
    alert('Profile saved');
  }

  async function changePassword(){
    if(!newPw) return;
    const r = await fetch(`${API}/api/users/${me.id}/password`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: newPw }) });
    if(r.ok){ setNewPw(''); alert('Password updated'); } else { const j=await r.json(); alert(j.error||'Failed'); }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-medium mb-4">Settings</h2>
      <div className="card grid gap-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">Name</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-600">Avatar</label>
          <input className="file-input" type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setAvatarFile(String(r.result)); r.readAsDataURL(f);} } />
        </div>
        <div>
          <button className="btn-primary" onClick={saveProfile}>Save profile</button>
        </div>
      </div>

      <div className="card grid gap-3 mt-4">
        <div>
          <label className="text-sm text-slate-600">New password</label>
          <input className="input" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} />
        </div>
        <div>
          <button className="btn-outline" onClick={changePassword}>Update password</button>
        </div>
      </div>
    </main>
  );
}

