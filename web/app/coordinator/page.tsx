"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUser, authFetch } from '../../lib/auth';
// Using native date inputs for reliability and SSR safety

const API = process.env.NEXT_PUBLIC_API_BASE_URL as string;

export default function Coordinator(){
  const [shows, setShows] = useState<any[]>([]);
  const [form, setForm] = useState({ name:'', city:'', starts_at:'', ends_at:'', address:'', booth_number:'', whatsapp_group_name:'', whatsapp_invite_link:'' });
  const [mounted, setMounted] = useState(false);
  const [editor, setEditor] = useState<any|null>(null);

  async function load(){
    const r = await authFetch(`${API}/api/shows`);
    setShows(await r.json());
  }
  useEffect(()=>{ setMounted(true); load(); },[]);

  async function create(e:any){ e.preventDefault();
    const payload = {
      ...form,
      starts_at: form.starts_at? new Date(form.starts_at).toISOString(): '',
      ends_at: form.ends_at? new Date(form.ends_at).toISOString(): ''
    };
    const r = await authFetch(`${API}/api/shows`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(r.ok){ setForm({ name:'', city:'', starts_at:'', ends_at:'', address:'', booth_number:'', whatsapp_group_name:'', whatsapp_invite_link:'' }); load(); }
  }

  const u = getUser();
  if(!mounted) return null;
  if(!u) return <main className="p-6 max-w-3xl mx-auto"><p>Please <a className="underline" href="/login">sign in</a>.</p></main>;
  if(!(u.role==='admin'||u.role==='coordinator')) return <main className="p-6 max-w-3xl mx-auto"><p>Access denied. Coordinators only.</p></main>;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-medium mb-4">Coordinator — Trade Shows</h2>
      <form onSubmit={create} className="card grid gap-3 max-w-2xl">
        <div>
          <label className="text-sm text-slate-600">Show name</label>
          <input className="input" placeholder="Show name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        </div>
        <div>
          <label className="text-sm text-slate-600">City</label>
          <input className="input" placeholder="City" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Address</label>
          <input className="input" placeholder="Venue address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} />
          {form.address && (
            <iframe className="mt-2 rounded-xl w-full h-56" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent(form.address)}&output=embed`} />
          )}
        </div>
        <div>
          <label className="text-sm text-slate-600">Booth number</label>
          <input className="input" placeholder="e.g. 1423" value={form.booth_number} onChange={e=>setForm({...form,booth_number:e.target.value})} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">WhatsApp group name</label>
            <input className="input" placeholder="Group name" value={form.whatsapp_group_name} onChange={e=>setForm({...form,whatsapp_group_name:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">WhatsApp invite link</label>
            <input className="input" placeholder="Invite link" value={form.whatsapp_invite_link} onChange={e=>setForm({...form,whatsapp_invite_link:e.target.value})} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">Starts</label>
            <input className="input" type="date" value={form.starts_at? form.starts_at.slice(0,10): ''} onChange={e=>setForm({...form, starts_at: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Ends</label>
            <input className="input" type="date" value={form.ends_at? form.ends_at.slice(0,10): ''} onChange={e=>setForm({...form, ends_at: e.target.value})} />
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" type="submit">Create</button>
          <button className="btn-soft" type="button" onClick={()=>setForm({name:'',city:'',starts_at:'',ends_at:'', address:'', booth_number:'', whatsapp_group_name:'', whatsapp_invite_link:''})}>Reset</button>
        </div>
      </form>
      

      <h3 className="mt-6 mb-2 font-medium">Shows</h3>
      <div className="card">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="py-2">Show</th><th>City</th><th>When</th><th></th></tr></thead>
          <tbody>
            {shows.map(s=> (
              <tr key={s.id} className="border-t">
                <td className="py-2">{s.name}</td>
                <td>{s.city}</td>
                <td>{s.starts_at? new Date(s.starts_at).toLocaleDateString():''} – {s.ends_at? new Date(s.ends_at).toLocaleDateString():''}</td>
                <td className="text-right space-x-2">
                  <Link className="btn-primary" href={`/coordinator/${s.id}`}>Open</Link>
                  <button className="btn-outline" onClick={()=>setEditor(s)} type="button">Edit</button>
                  <button className="btn-danger" onClick={async()=>{ if(!confirm('Delete show?')) return; await authFetch(`${API}/api/shows/${s.id}`, { method:'DELETE' }); load(); }} type="button">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={()=>setEditor(null)}>
          <div className="card max-w-lg w-full" onClick={e=>e.stopPropagation()}>
            <h4 className="font-medium mb-2">Edit show</h4>
            <div className="grid gap-2">
              <input className="input" placeholder="Name" value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})} />
              <input className="input" placeholder="City" value={editor.city} onChange={e=>setEditor({...editor,city:e.target.value})} />
              <input className="input" placeholder="Address" value={editor.address} onChange={e=>setEditor({...editor,address:e.target.value})} />
              <input className="input" placeholder="Booth" value={editor.booth_number} onChange={e=>setEditor({...editor,booth_number:e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="date" value={editor.starts_at?.slice(0,10)||''} onChange={e=>setEditor({...editor,starts_at:e.target.value})} />
                <input className="input" type="date" value={editor.ends_at?.slice(0,10)||''} onChange={e=>setEditor({...editor,ends_at:e.target.value})} />
              </div>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="btn-outline" onClick={()=>setEditor(null)} type="button">Cancel</button>
              <button className="btn-primary" onClick={async()=>{ await authFetch(`${API}/api/shows/${editor.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(editor) }); setEditor(null); load(); }} type="button">Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ShowCard({ show, onEdit }: { show:any; onEdit:(s:any)=>void }){
  const API = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  const [users, setUsers] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [costForm, setCostForm] = useState({ type:'Registration', description:'', amount:'', fileData:'' });
  async function load(){
    const u = await (await authFetch(`${API}/api/users`)).json(); setUsers(u);
    const p = await (await authFetch(`${API}/api/shows/${show.id}/participants`)).json(); setParticipants(p);
    const c = await (await authFetch(`${API}/api/shows/${show.id}/costs`)).json(); setCosts(c);
  }
  useEffect(()=>{ load(); },[]);
  async function add(){ if(!selectedIds.length) return; 
    await Promise.all(selectedIds.map(uid=> authFetch(`${API}/api/shows/${show.id}/participants`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: uid }) })));
    setSelectedIds([]); load(); }
  async function remove(uid:string){ await authFetch(`${API}/api/shows/${show.id}/participants/${uid}`, { method:'DELETE' }); load(); }
  async function update(uid:string, field:'airline'|'flight_conf'|'hotel_conf'|'car_conf', value:string){ await authFetch(`${API}/api/shows/${show.id}/participants/${uid}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ [field]: value }) }); load(); }
  async function refreshFlight(uid:string){
    const p = participants.find(x=>x.user_id===uid);
    if(!(p && p.airline && p.flight_conf)) { alert('Enter airline and flight number first'); return; }
    const depDate = show.starts_at? new Date(show.starts_at).toISOString().slice(0,10): new Date().toISOString().slice(0,10);
    try{
      const info = await (await authFetch(`${API}/api/flight/lookup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ airline: p.airline, flight_number: p.flight_conf, depart_date: depDate }) })).json();
      await authFetch(`${API}/api/shows/${show.id}/participants/${uid}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ refresh_flight: false, airline: p.airline, flight_conf: p.flight_conf, flight_info: info }) });
    } catch(e){ console.error(e); }
    load();
  }

  async function onCostFile(e:any){ const f=e.target.files?.[0]; if(!f) return; const b=await fileToBase64(f); setCostForm(prev=>({...prev,fileData:b})); }
  async function addCost(){
    let file_id; if(costForm.fileData){ const fr=await authFetch(`${API}/api/files`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: costForm.fileData, content_type: 'image/jpeg' })}); const fj=await fr.json(); file_id=fj.id; }
    await authFetch(`${API}/api/shows/${show.id}/costs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type: costForm.type, description: costForm.description, amount: parseFloat(costForm.amount||'0'), file_id }) });
    setCostForm({ type:'Registration', description:'', amount:'', fileData:'' });
    load();
  }
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{show.city}</div>
      <div className="font-medium mb-2 flex items-center justify-between flex-wrap gap-2">
        <span>{show.name}</span>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={()=>onEdit(show)} type="button">Edit</button>
          <button className="btn-outline" onClick={async()=>{ if(!confirm('Delete show?')) return; await authFetch(`${API}/api/shows/${show.id}`, { method:'DELETE' }); location.reload(); }}>Delete</button>
        </div>
      </div>
      <div className="text-xs text-slate-600 mb-2">{show.address? `Venue: ${show.address}`: ''} {show.booth_number? `• Booth ${show.booth_number}`: ''}</div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
             <select multiple className="select h-28 min-w-[260px]" value={selectedIds} onChange={e=>setSelectedIds(Array.from(e.target.selectedOptions).map(o=>o.value))}>
              {users.map((u:any)=> <option key={u.id} value={u.id}>{u.name||u.email} ({u.role})</option>)}
            </select>
            <button className="btn-primary" onClick={add} type="button">Add selected</button>
          </div>
          <ul className="text-sm">
            {participants.map((p:any)=> (
              <li key={p.user_id} className="border-b py-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span>{p.user?.email}</span>
                  <button className="btn-outline" onClick={()=>remove(p.user_id)} type="button">Remove</button>
                </div>
                <div className="mt-2 grid md:grid-cols-5 gap-2 items-center">
                  <input className="input" placeholder="Airline (e.g. Delta)" defaultValue={p.airline||''} onBlur={e=>update(p.user_id,'airline',e.target.value)} />
                  <input className="input" placeholder="Flight conf" defaultValue={p.flight_conf||''} onBlur={e=>update(p.user_id,'flight_conf',e.target.value)} />
                  <button className="btn-outline" type="button" onClick={()=>refreshFlight(p.user_id)}>Fetch flight</button>
                  <div className="text-xs text-slate-600 col-span-2">{p.flight_info? (p.flight_info.pending? 'Flight lookup requested…' : `${p.flight_info.segments?.[0]?.from}→${p.flight_info.segments?.[0]?.to}`): 'No flight info yet'}</div>
                  <input className="input" placeholder="Hotel conf" defaultValue={p.hotel_conf||''} onBlur={e=>update(p.user_id,'hotel_conf',e.target.value)} />
                  <input className="input" placeholder="Car conf" defaultValue={p.car_conf||''} onBlur={e=>update(p.user_id,'car_conf',e.target.value)} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h4 className="font-medium mb-2">Show costs</h4>
          <div className="grid md:grid-cols-5 gap-2 items-center">
            <select className="select min-w-[160px]" value={costForm.type} onChange={e=>setCostForm({...costForm,type:e.target.value})}>
              <option>Registration</option>
              <option>Utilities</option>
              <option>Shipping</option>
              <option>Other</option>
            </select>
            <input className="input min-w-[220px]" placeholder="Description" value={costForm.description} onChange={e=>setCostForm({...costForm,description:e.target.value})} />
            <input className="input min-w-[140px]" placeholder="Amount" value={costForm.amount} onChange={e=>setCostForm({...costForm,amount:e.target.value})} />
            <input className="file-input min-w-[200px]" type="file" onChange={onCostFile} />
            <button className="btn-primary" type="button" onClick={addCost}>Add cost</button>
          </div>
          <ul className="text-sm mt-3">
            {costs.map(c=> (
              <li key={c.id} className="border-b py-1 flex items-center justify-between">
                <span>{c.type}: {c.description} — ${'{'}c.amount{'}'}</span>
                {c.file_id? <a className="text-blue-600 underline" href={`${API}/api/files/${c.file_id}`} target="_blank">receipt</a>: null}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3"><button className="btn-primary" onClick={async()=>{ await authFetch(`${API}/api/shows/${show.id}/whatsapp/invite`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) }); alert('Invite attempted. Check logs or recipients.'); }} type="button">Send WhatsApp invites</button></div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

