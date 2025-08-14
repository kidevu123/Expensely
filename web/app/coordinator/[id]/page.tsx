"use client";
import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../../../lib/auth';

function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || '';
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}
const API = getApiBase();

export default function ShowDetail({ params }: { params: { id: string } }){
  const showId = params.id;
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState<any|null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [newParticipant, setNewParticipant] = useState<{ user_id: string, airline?: string, flight_conf?: string, hotel_conf?: string, car_conf?: string }>({ user_id: '' });
  const [newCost, setNewCost] = useState<{ type: string, description: string, amount: number|string, file?: File|null }>({ type:'', description:'', amount:'', file:null });
  const [hotelOpen, setHotelOpen] = useState<Record<string, boolean>>({});
  const [carOpen, setCarOpen] = useState<Record<string, boolean>>({});

  async function load(){
    const s = await (await authFetch(`${API}/api/shows`)).json();
    setShow((s||[]).find((x:any)=>x.id===showId)||null);
    const p = await (await authFetch(`${API}/api/shows/${showId}/participants`)).json();
    setParticipants(p||[]);
    const c = await (await authFetch(`${API}/api/shows/${showId}/costs`)).json();
    setCosts(c||[]);
    const users = await (await authFetch(`${API}/api/users`)).json();
    setAllUsers(users||[]);
  }

  useEffect(()=>{ setMounted(true); load(); },[]);
  if(!mounted) return null;
  if(!show) return (<main className="p-6 max-w-5xl mx-auto"><h2 className="text-2xl font-medium mb-4">Show</h2><p>Not found.</p></main>);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-medium mb-4">{show.name}</h2>
      <div className="text-sm text-slate-600 mb-3">{show.city} {show.address?`• ${show.address}`:''} {show.booth_number?`• Booth ${show.booth_number}`:''}</div>

      <div className="grid gap-4">
        <div className="card w-full">
          <h3 className="font-medium mb-2">Participants</h3>
          <div className="mb-3 grid md:grid-cols-5 gap-2 items-end">
            <select className="select md:col-span-2" value={newParticipant.user_id} onChange={e=>setNewParticipant(v=>({ ...v, user_id: e.target.value }))}>
              <option value="">Select user</option>
              {allUsers.map((u:any)=> (
                <option key={u.id} value={u.id}>{u.name||u.email}</option>
              ))}
            </select>
            <input className="input" placeholder="Airline (optional)" value={newParticipant.airline||''} onChange={e=>setNewParticipant(v=>({ ...v, airline: e.target.value }))} />
            <input className="input" placeholder="Flight conf (optional)" value={newParticipant.flight_conf||''} onChange={e=>setNewParticipant(v=>({ ...v, flight_conf: e.target.value }))} />
            <button className="btn-primary" onClick={async()=>{
              if(!newParticipant.user_id) return alert('Pick a user');
              await authFetch(`${API}/api/shows/${showId}/participants`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: newParticipant.user_id, airline: newParticipant.airline||'', flight_conf: newParticipant.flight_conf||'', hotel_conf:'', car_conf:'' }) });
              setNewParticipant({ user_id:'', airline:'', flight_conf:'' });
              await load();
            }}>Add</button>
          </div>
          <ul className="text-sm">
            {participants.map((p:any)=> (
              <li key={p.user_id} className="border-b py-3">
                <div className="font-medium mb-2">{p.user?.name||p.user?.email}</div>
                <div className="grid md:grid-cols-6 gap-2 items-center w-full panel-flight p-3">
                  <input className="input" placeholder="Airline" defaultValue={p.airline||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ airline: e.target.value }) })} />
                  <input className="input" placeholder="Flight conf" defaultValue={p.flight_conf||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ flight_conf: e.target.value }) })} />
                  <button className="btn-outline px-2 py-1 text-xs" onClick={async()=>{ const depDate = show.starts_at? String(show.starts_at).slice(0,10): new Date().toISOString().slice(0,10); const info = await (await authFetch(`${API}/api/flight/lookup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ airline: p.airline||'', flight_number: p.flight_conf||'', depart_date: depDate }) })).json(); await authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ flight_info: info }) }); await load(); }}>Lookup flight</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>setHotelOpen(o=>({ ...o, [p.user_id]: !o[p.user_id] }))}>{hotelOpen[p.user_id]? '− Hotel':'＋ Add hotel'}</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>setCarOpen(o=>({ ...o, [p.user_id]: !o[p.user_id] }))}>{carOpen[p.user_id]? '− Car':'＋ Add car rental'}</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={async()=>{ await authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'DELETE' }); await load(); }}>Remove</button>
                </div>
                {hotelOpen[p.user_id] && (
                  <div className="grid md:grid-cols-5 gap-2 mt-2 w-full panel-hotel p-3">
                    <input className="input" placeholder="Hotel name" defaultValue={p.hotel_name||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hotel_name: e.target.value }) })} />
                    <input className="input" placeholder="Hotel confirmation" defaultValue={p.hotel_conf||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hotel_conf: e.target.value }) })} />
                    <input className="input md:col-span-2" placeholder="Hotel address" defaultValue={p.hotel_address||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ hotel_address: e.target.value }) })} />
                    <div className="text-xs text-slate-600">
                      {p.hotel_address? (<a className="text-blue-600 underline" href={`https://maps.google.com/?q=${encodeURIComponent(p.hotel_address)}`} target="_blank">map</a>): 'Add address for map'}
                    </div>
                  </div>
                )}
                {carOpen[p.user_id] && (
                  <div className="grid md:grid-cols-5 gap-2 mt-2 w-full panel-car p-3">
                    <input className="input" placeholder="Car rental company" defaultValue={p.car_company||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ car_company: e.target.value }) })} />
                    <input className="input" placeholder="Car rental confirmation" defaultValue={p.car_conf||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ car_conf: e.target.value }) })} />
                    <input className="input md:col-span-2" placeholder="Pickup address" defaultValue={p.car_pickup_address||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ car_pickup_address: e.target.value }) })} />
                    <div className="text-xs text-slate-600">{p.car_pickup_address? (<a className="text-blue-600 underline" href={`https://maps.google.com/?q=${encodeURIComponent(p.car_pickup_address)}`} target="_blank">map</a>): 'Add pickup address for map'}</div>
                  </div>
                )}
              </li>
            ))}
            {participants.length===0 && (<li className="text-slate-500">No participants yet</li>)}
          </ul>
        </div>
        <div className="card w-full">
          <h3 className="font-medium mb-2">Show Expenses</h3>
          <div className="mb-3 grid md:grid-cols-5 gap-2 items-end">
            <input className="input" placeholder="Type (e.g., Booth, Electrical, Utilities)" value={newCost.type} onChange={e=>setNewCost(v=>({ ...v, type: e.target.value }))} />
            <input className="input md:col-span-2" placeholder="Description" value={newCost.description} onChange={e=>setNewCost(v=>({ ...v, description: e.target.value }))} />
            <input className="input" placeholder="Amount" type="number" value={newCost.amount} onChange={e=>setNewCost(v=>({ ...v, amount: e.target.value }))} />
            <input className="file-input" type="file" accept="image/*,application/pdf" onChange={e=> setNewCost(v=>({ ...v, file: e.target.files?.[0]||null }))} />
            <button className="btn-primary" onClick={async()=>{
              if(!newCost.type || !newCost.amount) return alert('Type and amount required');
              let file_id: string|undefined = undefined;
              let file_url: string|undefined = undefined;
              if(newCost.file){
                const b64 = await new Promise<string>((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(newCost.file as File); });
                const fr = await authFetch(`${API}/api/files`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: b64, content_type: newCost.file?.type||'image/jpeg' }) });
                const fj = await fr.json(); file_id = fj.id; file_url = fj.url;
              }
              await authFetch(`${API}/api/shows/${showId}/costs`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type: newCost.type, description: newCost.description, amount: Number(newCost.amount), file_id, file_url }) });
              setNewCost({ type:'', description:'', amount:'', file:null });
              await load();
            }}>Add</button>
          </div>
           <ul className="text-sm">
            {costs.map((c:any)=> (
              <li key={c.id} className="border-b py-1 flex justify-between items-center">
                <span>{c.type}: {c.description}</span>
                <span className="flex items-center gap-2">${c.amount} <button className="btn-outline px-2 py-1 text-xs" onClick={async()=>{ await authFetch(`${API}/api/shows/${showId}/costs/${c.id}`, { method:'DELETE' }); await load(); }}>Remove</button></span>
              </li>
            ))}
            {costs.length===0 && (<li className="text-slate-500">No costs yet</li>)}
          </ul>
        </div>
      </div>
    </main>
  );
}

