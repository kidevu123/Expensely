"use client";
import { useEffect, useMemo, useState } from 'react';
import { authFetch, getUser } from '../../../lib/auth';
import Tesseract from 'tesseract.js';

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
  const [expenses, setExpenses] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [newParticipant, setNewParticipant] = useState<{ user_id: string, airline?: string, flight_conf?: string, hotel_conf?: string, car_conf?: string }>({ user_id: '' });
  const [newCost, setNewCost] = useState<{ type: string, description: string, amount: number|string, file?: File|null }>({ type:'', description:'', amount:'', file:null });
  const [hotelOpen, setHotelOpen] = useState<Record<string, boolean>>({});
  const [carOpen, setCarOpen] = useState<Record<string, boolean>>({});
  const [previewUrl, setPreviewUrl] = useState<string|undefined>(undefined);
  const [busyOCR, setBusyOCR] = useState(false);

  async function load(){
    const s = await (await authFetch(`${API}/api/shows`)).json();
    setShow((s||[]).find((x:any)=>x.id===showId)||null);
    const p = await (await authFetch(`${API}/api/shows/${showId}/participants`)).json();
    setParticipants(p||[]);
    const c = await (await authFetch(`${API}/api/shows/${showId}/costs`)).json();
    setCosts(c||[]);
    const ex = await (await authFetch(`${API}/api/expenses?show_id=${showId}`)).json();
    setExpenses(ex||[]);
    const users = await (await authFetch(`${API}/api/users`)).json();
    setAllUsers(users||[]);
  }

  useEffect(()=>{ setMounted(true); load(); },[]);
  if(!mounted) return null;
  if(!show) return (<main className="p-6 max-w-5xl mx-auto"><h2 className="text-2xl font-medium mb-4">Show</h2><p>Not found.</p></main>);

  function resolveReceiptUrl(e:any){
    if (e.file_id) return `${API}/api/files/${e.file_id}`;
    const direct = e.file_url || '';
    if(direct){ if(/^https?:\/\//i.test(direct)) return direct; if(direct.startsWith('/files/')){ const id = direct.split('/').pop(); return id? `${API}/api/files/${id}`: ''; } }
    return '';
  }

  async function runCostOCR(file: File){
    try{
      setBusyOCR(true);
      const { data } = await Tesseract.recognize(file, 'eng');
      const text = data.text || '';
      // very lightweight parsing: last number with 2 decimals as amount
      const m = text.match(/(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/g);
      const amt = m? m[m.length-1]: '';
      const firstLine = (text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)[0]||'').slice(0,80);
      setNewCost(v=>({ ...v, description: v.description||firstLine||'', amount: v.amount||amt }));
    }finally{ setBusyOCR(false); }
  }

  // Prefer proxy: if file_id exists, always use API redirect so PDFs/JPGs are served from our origin
  function resolveReceiptUrl(e:any): string{
    if (e.file_id) return `${API}/api/files/${e.file_id}`;
    const direct = e.file_url || '';
    if (direct.startsWith('/files/')) return `${API}${direct}`;
    return direct;
  }

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
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{p.user?.name||p.user?.email}</div>
                  <div className="flex items-center gap-2">
                    <button className="btn-outline px-2 py-1 text-xs" aria-label="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487l3.651 3.65M4.5 20.25l6.808-1.134a2 2 0 00.99-.54l8.515-8.515a2 2 0 000-2.828l-2.8-2.8a2 2 0 00-2.828 0L6.69 12.948a2 2 0 00-.54.99L5.016 20.25H4.5z"/></svg>
                    </button>
                    <button className="btn-danger px-2 py-1 text-xs" aria-label="Remove" onClick={async()=>{ await authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'DELETE' }); await load(); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div className="grid md:grid-cols-6 gap-2 items-center w-full panel-flight p-3">
                  <input className="input" placeholder="Airline" defaultValue={p.airline||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ airline: e.target.value }) })} />
                  <input className="input" placeholder="Flight conf" defaultValue={p.flight_conf||''} onBlur={e=>authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ flight_conf: e.target.value }) })} />
                  <button className="btn-outline px-2 py-1 text-xs" onClick={async()=>{ const depDate = show.starts_at? String(show.starts_at).slice(0,10): new Date().toISOString().slice(0,10); const info = await (await authFetch(`${API}/api/flight/lookup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ airline: p.airline||'', flight_number: p.flight_conf||'', depart_date: depDate }) })).json(); await authFetch(`${API}/api/shows/${showId}/participants/${p.user_id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ flight_info: info }) }); await load(); }}>Lookup flight</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>setHotelOpen(o=>({ ...o, [p.user_id]: !o[p.user_id] }))}>{hotelOpen[p.user_id]? '− Hotel':'＋ Add hotel'}</button>
                  <button className="btn-outline px-2 py-1 text-xs" onClick={()=>setCarOpen(o=>({ ...o, [p.user_id]: !o[p.user_id] }))}>{carOpen[p.user_id]? '− Car':'＋ Add car rental'}</button>
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
            <div>
              <input id="cost-file" className="file-input" type="file" accept="image/*,application/pdf" onChange={async e=> { const f=(e.target as HTMLInputElement).files?.[0]||null; setNewCost(v=>({ ...v, file: f })); if(f) await runCostOCR(f); }} />
              <button type="button" className="upload-icon" onClick={()=>{ (document.getElementById('cost-file') as HTMLInputElement).click(); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"/></svg>
              </button>
            </div>
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
          {busyOCR && <div className="text-xs text-slate-500 mt-1">Scanning receipt…</div>}
        </div>

        {/* Mirrored expenses uploaded by coordinator (show-only) */}
        <div className="card w-full">
          <h3 className="font-medium mb-2">Show expense breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500"><tr><th className="text-left py-2">Description</th><th className="text-left">Category</th><th className="text-left">Paid by</th><th className="text-right">Amount</th><th className="text-right w-[160px]">Actions</th></tr></thead>
              <tbody>
                {expenses.filter(e=> e.show_id===showId && e.category==='show_cost').map(e=> (
                  <tr key={e.id} id={`row-${e.id}`} className="border-t">
                    <td className="py-2">{e.notes||e.merchant}</td>
                    <td>{e.category||'—'}</td>
                    <td>{e.org_label||'Unassigned'}</td>
                    <td className="text-right">${e.total}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button className="btn-outline px-2 py-1 text-xs" onClick={()=>{ const details=(document.getElementById(`edit-${e.id}`) as HTMLTableRowElement); if(details) details.classList.toggle('hidden'); }}>✏️</button>
                        {(()=>{ const url = resolveReceiptUrl(e); return url? (
                          <button className="btn-outline px-2 py-1 text-xs" onClick={()=> setPreviewUrl(url)}>View</button>
                        ): (<button className="btn-outline px-2 py-1 text-xs" disabled>View</button>); })()}
                        <button className="btn-danger px-2 py-1 text-xs" onClick={async()=>{ if(!confirm('Delete receipt?')) return; await authFetch(`${API}/api/expenses/${e.id}`, { method:'DELETE' }); await load(); }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {expenses.filter(e=> e.show_id===showId && e.category==='show_cost').map(e=> (
                  <tr key={`edit-${e.id}`} id={`edit-${e.id}`} className="hidden">
                    <td colSpan={5}>
                      <div className="p-3 border rounded-xl grid md:grid-cols-4 gap-2">
                        <input className="input" defaultValue={e.notes||e.merchant} placeholder="Description" onBlur={(ev:any)=> (e.notes = ev.target.value)} />
                        <input className="input" type="number" defaultValue={e.total} placeholder="Amount" onBlur={(ev:any)=> (e.total = ev.target.value)} />
                        <div>
                          <input id={`edit-file-${e.id}`} className="file-input" type="file" accept="image/*,application/pdf" onChange={async(ev:any)=>{ const f=ev.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=async()=>{ const b64=String(r.result); const fr=await authFetch(`${API}/api/files`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: b64, content_type: f.type||'application/octet-stream' })}); const j=await fr.json(); e.file_id=j.id; e.file_url=j.url; }; r.readAsDataURL(f); }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="btn-primary" onClick={async()=>{ await authFetch(`${API}/api/expenses/${e.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notes: e.notes||e.merchant, total: e.total, file_id: e.file_id, file_url: e.file_url }) }); (document.getElementById(`edit-${e.id}`) as HTMLTableRowElement).classList.add('hidden'); await load(); }}>Save</button>
                          <button className="btn-outline" onClick={()=> (document.getElementById(`edit-${e.id}`) as HTMLTableRowElement).classList.add('hidden')}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {expenses.filter(e=> e.show_id===showId && e.category==='show_cost').length===0 && (
                  <tr><td className="py-2 text-slate-500" colSpan={5}>No uploads yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {previewUrl && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" onClick={()=>setPreviewUrl(undefined)}>
            <div className="bg-white rounded-2xl shadow-xl p-3" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-end gap-2 mb-2">
                <a className="btn-outline" href={previewUrl} target="_blank" rel="noreferrer">Open in new tab</a>
                <button className="btn-primary" onClick={()=>setPreviewUrl(undefined)}>Close</button>
              </div>
              {(()=>{ const url = String(previewUrl); return (
                <div className="flex items-center justify-center" style={{ width:'90vw', height:'75vh' }}>
                  {/\.pdf(\?|$)/i.test(url) ? (
                    <embed src={url} type="application/pdf" style={{ width:'100%', height:'100%' }} />
                  ) : (
                    <img src={url} style={{ maxWidth:'100%', maxHeight:'100%', width:'auto', height:'auto' }} className="rounded-xl bg-slate-50" />
                  )}
                </div>
              ); })()}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

