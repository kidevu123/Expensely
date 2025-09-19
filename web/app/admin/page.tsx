"use client";
import { useEffect, useState } from 'react';
function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || '';
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}
const API = getApiBase();
import { getUser } from '../../lib/auth';

type User = { id:string; email:string; name:string; role:'admin'|'coordinator'|'accountant'|'attendee'; phone_e164?: string; allow_daily_expenses?: boolean; permissions?: string[] };

export default function Admin(){
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<any|null>(null);
  const [form, setForm] = useState({ email:'', name:'', role:'attendee', password:'', phone:'', avatar_file: '' as any, permissions: [] as string[], daily: false });
  const [passwordEdits, setPasswordEdits] = useState<Record<string,string>>({});
  const [audit, setAudit] = useState<any[]>([]);
  const [editor, setEditor] = useState<{ user: User|null; phone: string; permissions: string[]; daily: boolean; password: string }|null>(null);
  const [orphaned, setOrphaned] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  async function load(){ const [ur, mr] = await Promise.all([
      fetch(`${API}/api/users`),
      fetch(`${API}/api/admin/metrics`)
    ]);
    setUsers(await ur.json());
    setMetrics(await mr.json());
  }
  useEffect(()=>{ setMounted(true); },[]);
  useEffect(()=>{ if(mounted){ load(); (async()=>{ const r=await fetch(`${API}/api/admin/audit?limit=200`); setAudit(await r.json()); const o=await (await fetch(`${API}/api/expenses?orphaned=1`)).json(); setOrphaned(o); const t = await (await fetch(`${API}/api/feedback`)).json(); setTickets(Array.isArray(t)? t.reverse(): []); })(); } },[mounted]);

  // Guard (client-side): require admin
  const u = getUser();
  if(!mounted) return null;
  if(!u) return <main className="p-6 max-w-3xl mx-auto"><p>Please <a className="underline" href="/login">sign in</a>.</p></main>;
  if(u.role!=='admin') return <main className="p-6 max-w-3xl mx-auto"><p>Access denied. Admins only.</p></main>;

  async function addUser(e:any){ e.preventDefault();
    let avatar_url = (form as any).avatar_url||'';
    if(form.avatar_file){
      const fr = await fetch(`${API}/api/files`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: form.avatar_file, content_type: 'image/jpeg' }) });
      const fj = await fr.json();
      avatar_url = fj.url || '';
    }
    const payload:any = { email:form.email, name:form.name, role:form.role, password:form.password, phone:form.phone, avatar_url, permissions: Array.isArray(form.permissions)? form.permissions: [], allow_daily_expenses: !!(form as any).daily };
    const r = await fetch(`${API}/api/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(r.ok){ setForm({ email:'', name:'', role:'attendee', password:'', phone:'', avatar_file:'', permissions: [], daily: false }); load(); } else alert('Error adding user');
  }
  async function setRole(id:string, role:string){ await fetch(`${API}/api/users/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role }) }); load(); }
  async function delUser(id:string){ if(!confirm('Delete user?')) return; await fetch(`${API}/api/users/${id}`, { method:'DELETE' }); load(); }
  async function setPassword(id:string){ const pw=passwordEdits[id]; if(!pw) return; await fetch(`${API}/api/users/${id}/password`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw }) }); setPasswordEdits(prev=>({ ...prev, [id]: '' })); load(); }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-medium">Admin — Users & RBAC</h2>
        <a href="/admin/settings" className="btn-outline">⚙️ API Settings</a>
      </div>
      {metrics && (
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <div className="card"><div className="text-sm text-slate-500">Users</div><div className="text-2xl font-semibold">{metrics.totals.users}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Shows</div><div className="text-2xl font-semibold">{metrics.totals.shows}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Expenses</div><div className="text-2xl font-semibold">{metrics.totals.expenses}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Active now</div><div className="text-2xl font-semibold">{metrics.activeNow.length}</div></div>
        </div>
      )}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Feedback tickets</h3>
          <button className="btn-outline" onClick={async()=>{ const t=await (await fetch(`${API}/api/feedback`)).json(); setTickets(Array.isArray(t)? t.reverse(): []); }}>Refresh</button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500"><tr><th className="text-left py-2">User</th><th className="text-left">Note</th><th className="text-left">Attachment</th><th className="text-left">Status</th><th></th></tr></thead>
          <tbody>
            {tickets.map((t:any)=> (
              <tr key={t.id} className="border-t">
                <td className="py-2 pr-2 text-xs text-slate-600">{t.created_by}</td>
                <td className="py-2 pr-2 truncate max-w-[360px]">{t.note}</td>
                 <td className="py-2 pr-2">{t.file_id? (<a className="underline" href={`${API}/api/files/${t.file_id}`} target="_blank">view</a>): '-'}</td>
                <td className="py-2 pr-2">{t.status}</td>
                <td className="py-2 text-right">
                  {t.status==='open'? (
                    <button className="btn-primary px-2 py-1 text-xs" onClick={async()=>{ await fetch(`${API}/api/feedback/${t.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'resolved' }) }); const list=await (await fetch(`${API}/api/feedback`)).json(); setTickets(Array.isArray(list)? list.reverse(): []); }}>Resolve</button>
                  ): (
                    <button className="btn-outline px-2 py-1 text-xs" onClick={async()=>{ await fetch(`${API}/api/feedback/${t.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'open' }) }); const list=await (await fetch(`${API}/api/feedback`)).json(); setTickets(Array.isArray(list)? list.reverse(): []); }}>Reopen</button>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length===0 && (<tr><td className="py-2 text-slate-500" colSpan={5}>No feedback yet</td></tr>)}
          </tbody>
        </table>
      </div>
      {metrics && (
      <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div className="card">
            <h3 className="font-medium mb-2">Users by role</h3>
            <ul className="text-sm">
              {Object.entries(metrics.usersByRole||{}).map(([k,v]:any)=> (<li key={k} className="flex justify-between border-b py-1"><span>{k}</span><span>{v as any}</span></li>))}
            </ul>
          </div>
          <div className="card">
            <h3 className="font-medium mb-2">Audit log</h3>
            <ul className="text-sm max-h-64 overflow-auto">
              {audit.map((a:any)=> (
                <li key={a.ts+String(a.entity_id)} className="border-b py-1 flex justify-between">
                  <span className="text-slate-500">{new Date(a.ts).toLocaleString()}</span>
                  <span>{a.actor}</span>
                  <span>{a.action}</span>
                  <span>{a.entity} {a.entity_id}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Orphaned receipts</h3>
          <div className="flex gap-2">
            <button className="btn-outline" onClick={async()=>{ const o=await (await fetch(`${API}/api/expenses?orphaned=1`)).json(); setOrphaned(o); }}>Refresh</button>
            <button className="btn-primary" onClick={async()=>{ if(!confirm('Convert all orphaned to Daily?')) return; await fetch(`${API}/api/admin/reconcile`, { method:'POST' }); const o=await (await fetch(`${API}/api/expenses?orphaned=1`)).json(); setOrphaned(o); }}>Reclassify to Daily</button>
          </div>
        </div>
        <div className="text-sm text-slate-600 mb-2">These expenses reference deleted shows. You can delete individually or reclassify to Daily.</div>
        <table className="w-full text-sm">
          <thead className="text-slate-500"><tr><th className="text-left py-2">Merchant</th><th className="text-left">Total</th><th className="text-left">Show ID</th><th></th></tr></thead>
          <tbody>
            {orphaned.map((e:any)=> (
              <tr key={e.id} className="border-t">
                <td className="py-2">{e.merchant}</td>
                <td>${'{'}e.total{'}'}</td>
                <td className="text-xs text-slate-500">{e.show_id}</td>
                <td className="text-right"><button className="btn-outline px-2 py-1 text-xs" onClick={async()=>{ if(!confirm('Delete this receipt?')) return; await fetch(`${API}/api/expenses/${e.id}`, { method:'DELETE' }); const o=await (await fetch(`${API}/api/expenses?orphaned=1`)).json(); setOrphaned(o); }}>Delete</button></td>
              </tr>
            ))}
            {orphaned.length===0 && (<tr><td className="py-2 text-slate-500" colSpan={4}>None</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 items-start">
        <form onSubmit={addUser} className="card grid gap-3">
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input className="input" placeholder="user@company.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Password (optional)</label>
            <input className="input" placeholder="Set initial password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Phone (E.164)</label>
            <input className="input" placeholder="+14045551234" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Avatar</label>
            <input className="file-input" type="file" accept="image/*" onChange={async(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setForm(prev=>({...prev, avatar_file: String(r.result)})); r.readAsDataURL(f); }} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Name</label>
            <input className="input" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Role</label>
            <select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
              <option value="admin">Admin</option>
              <option value="coordinator">Coordinator</option>
              <option value="accountant">Accountant</option>
              <option value="attendee">Attendee</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Additional permissions</label>
            <div className="flex flex-wrap gap-4 text-sm items-center">
              {['admin','coordinator','accountant'].map(p=> (
                <label key={p} className="flex items-center gap-2"><input type="checkbox" checked={Array.isArray(form.permissions) && form.permissions.includes(p)} onChange={(e)=>{
                  setForm(prev=> {
                    const current = Array.isArray(prev.permissions)? prev.permissions: [];
                    return ({...prev, permissions: e.target.checked? Array.from(new Set([...current,p])): current.filter(x=>x!==p)});
                  });
                }} /> {p}</label>
              ))}
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.daily} onChange={e=>setForm(prev=>({...prev, daily: e.target.checked}))} /> daily</label>
            </div>
          </div>
          <div className="flex gap-3"><button className="btn-primary" type="submit">Add user</button></div>
        </form>

          <div className="card">
          <h3 className="font-medium mb-2">Users</h3>
          <div className="text-xs text-slate-500 mb-2">Manage users. Click Edit to change permissions, phone, or password.</div>
          <table className="w-full text-sm table-fixed">
            <thead><tr className="text-left text-slate-500">
              <th className="py-2 pr-2 w-[240px]">Email</th>
              <th className="py-2 pr-2 w-[180px]">Name</th>
              <th className="py-2 pr-2 w-[140px]">Role</th>
              <th className="py-2 pr-2 w-[160px]">Actions</th>
            </tr></thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} className="border-t align-middle">
                  <td className="py-2 pr-2 truncate">{u.email}</td>
                  <td className="py-2 pr-2 flex items-center gap-2">
                    <img src={(u as any).avatar_url||`https://www.gravatar.com/avatar/${btoa(u.email)}?d=identicon`} className="w-7 h-7 rounded-full"/>
                    <span className="truncate">{u.name||u.email}</span>
                  </td>
                  <td className="py-1">
                    <select className="select" value={u.role} onChange={e=>setRole(u.id, e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="accountant">Accountant</option>
                      <option value="attendee">Attendee</option>
                    </select>
                  </td>
                  <td className="py-1">
                    <div className="flex gap-2">
                      <button className="btn-outline px-3 py-1 text-xs" title="Edit" onClick={()=>setEditor({ user: u, phone: u.phone_e164||'', permissions: u.permissions||[], daily: !!u.allow_daily_expenses, password: '' })} type="button">✏️</button>
                      <button className="btn-danger px-3 py-1 text-xs" title="Delete" onClick={()=>delUser(u.id)} type="button">✖️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={()=>setEditor(null)}>
          <div className="card max-w-lg w-full" onClick={e=>e.stopPropagation()}>
            <h4 className="font-medium mb-2">Edit user</h4>
            <div className="grid gap-2">
              <input className="input" placeholder="Phone" value={editor.phone} onChange={e=>setEditor({ ...editor, phone: e.target.value }) as any} />
              <div>
                <div className="text-sm text-slate-600 mb-1">Avatar</div>
                <button className="btn-outline" onClick={async()=>{ const pick=await new Promise<string|undefined>((resolve)=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=async()=>{ const f=i.files?.[0]; if(!f) return resolve(undefined); const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.readAsDataURL(f); }; i.click(); }); if(!pick||!editor?.user) return; await fetch(`${API}/api/users/${editor.user.id}/avatar`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: pick, content_type: 'image/jpeg' }) }); await load(); }}>Upload new</button>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {['admin','coordinator','accountant'].map(p=> (
                  <label key={p} className="flex items-center gap-2"><input type="checkbox" checked={editor.permissions.includes(p)} onChange={e=>{
                    const next = new Set(editor.permissions); if(e.target.checked) next.add(p); else next.delete(p);
                    setEditor({ ...editor, permissions: Array.from(next) } as any);
                  }} /> {p}</label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.daily} onChange={e=>setEditor({ ...editor, daily: e.target.checked } as any)} /> Allow daily expenses</label>
              <input className="input" type="password" placeholder="New password" value={editor.password} onChange={e=>setEditor({ ...editor, password: e.target.value } as any)} />
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="btn-outline" onClick={()=>setEditor(null)} type="button">Cancel</button>
              <button className="btn-primary" onClick={async()=>{
                if(!editor?.user) return; const id=editor.user.id; await fetch(`${API}/api/users/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: editor.phone, permissions: editor.permissions, allow_daily_expenses: editor.daily }) }); if(editor.password){ await fetch(`${API}/api/users/${id}/password`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: editor.password }) }); }
                setEditor(null); load();
              }} type="button">Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

