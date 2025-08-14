"use client";
import { useEffect, useState } from 'react';

function getApiBase(): string {
	const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || '';
	if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
	if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
	return '';
}
const API = getApiBase();
import { getUser, authFetch } from '../../lib/auth';

export default function Accounting(){
  const [mounted, setMounted] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [showId, setShowId] = useState<string>('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [edit, setEdit] = useState<any|null>(null);
  const [dragging, setDragging] = useState<any|null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<any|null>(null);
  const [cardMap, setCardMap] = useState<Record<string,string>>({});
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);
  const [showCardsMgr, setShowCardsMgr] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReports, setShowReports] = useState<Record<string, any>>({});
  
  async function resolveReceiptUrl(e:any): Promise<string>{
    // Standard: prefer API redirect
    if (e.file_id) return `${API}/api/files/${e.file_id}`;
    let direct = e.file_url || '';
    if (!direct && e.cost_id){
      try{ const c = await (await fetch(`${API}/api/costs/${e.cost_id}`)).json(); if(c){ if(!e.file_id && c.file_id) e.file_id=c.file_id; if(!direct && c.file_url) direct=c.file_url; } } catch {}
    }
    if (direct){ if (/^https?:\/\//i.test(direct)) return direct; if (direct.startsWith('/files/')) return `${API}${direct}`; }
    return e.file_id? `${API}/api/files/${e.file_id}` : '';
  }

  function exportCsvForOrg(orgLabel:string){
    // Export everything visible in this lane (both show-tagged and daily assigned to this org)
    const items = expenses.filter(e=> e.org_label===orgLabel);
    const header = ['merchant','date','time','subtotal','tax','tip','total','last4','uploader','notes','type','receipt_url'];
    const lines = [header.join(',')];
    items.forEach(e=>{
      const url = resolveReceiptUrl(e);
      const row = [
        JSON.stringify(e.merchant||''),
        JSON.stringify(e.date||''),
        JSON.stringify(e.time||''),
        e.subtotal||'', e.tax||'', e.tip||'', e.total||'',
        e.last4? `**** ${e.last4}`:'',
        e.created_by||'',
        JSON.stringify(e.notes||''),
        e.is_daily? 'Daily':'Show',
        JSON.stringify(url)
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${orgLabel}-expenses.csv`; a.click();
  }

  useEffect(()=>{ setMounted(true); },[]);
  function uniqueById(list:any[]){ const seen=new Set<string>(); const out:any[]=[]; for(const x of list){ if(!x||!x.id) continue; if(seen.has(x.id)) continue; seen.add(x.id); out.push(x);} return out; }
  useEffect(()=>{ (async()=>{
    const o = await (await fetch(`${API}/api/zoho/orgs`)).json(); setOrgs(o);
    const s = await (await authFetch(`${API}/api/shows`)).json(); setShows(s); if(s[0]) setShowId(s[0].id);
    const m = await (await fetch(`${API}/api/cardmap`)).json(); setCardMap(m);
    const reports: Record<string, any> = {};
    await Promise.all((s||[]).map(async (sh:any)=>{ try { reports[sh.id] = await (await fetch(`${API}/api/reports/show/${sh.id}`)).json(); } catch {} }));
    setShowReports(reports);
    const all = await (await fetch(`${API}/api/expenses`)).json(); setAllExpenses(all);
  })(); },[]);

  useEffect(()=>{ (async()=>{
    if(!showId){ const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses(uniqueById(d)); setReport(null); return; }
    const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses(uniqueById([...e, ...d])); const r=await (await fetch(`${API}/api/reports/show/${showId}`)).json(); setReport(r);
    const all = await (await fetch(`${API}/api/expenses`)).json(); setAllExpenses(all);
  })(); },[showId]);

  async function linkReceiptToExpense(exp:any){
    const url = prompt('Paste the receipt URL from WorkDrive');
    if(!url) return;
    try{
      await fetch(`${API}/api/expenses/${exp.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file_url: url }) });
      const all = await (await fetch(`${API}/api/expenses`)).json(); setAllExpenses(all);
      const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses(uniqueById([...e,...d]));
    } catch {}
  }

  const u = getUser();
  if(!mounted) return null;
  if(!u) return <main className="p-6 max-w-3xl mx-auto"><p>Please <a className="underline" href="/login">sign in</a>.</p></main>;
  if(!(u.role==='admin'||u.role==='accountant')) return <main className="p-6 max-w-3xl mx-auto"><p>Access denied. Accountants only.</p></main>;

  const colorForOrg = (label:string)=>{
    const palette = ['#2563eb','#16a34a','#f59e0b','#db2777','#0891b2','#7c3aed'];
    const i = Math.abs(label.split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % palette.length;
    return palette[i];
  };
  const colorForShow = (idOrName:string)=>{
    if(!idOrName) return '#6366f1';
    const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#84cc16','#f43f5e'];
    const i = Math.abs(idOrName.split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % palette.length;
    return palette[i];
  };
  const hexToRgba = (hex:string, alpha:number)=>{
    try{ const h=hex.replace('#',''); const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }catch{ return 'rgba(99,102,241,0.15)'; }
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-medium mb-4">Accounting</h2>
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        {shows.map((s:any)=>{ const rep = showReports[s.id]; const total = rep?.overall ?? 0; const isClosed = !!s.closed; const isActive = s.id===showId; const col=colorForShow(s.id||s.name); return (
          <div key={s.id} className={`card cursor-pointer ${isActive? 'ring-2 ring-indigo-400':''}`} onClick={()=>setShowId(s.id)} style={{ borderColor: col, background: hexToRgba(col, 0.08) }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-slate-600"><span className="font-medium">Total:</span> ${Number(total||0).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                {isClosed && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700">Closed</span>}
                <button className={isClosed? 'btn-primary px-3 py-1 text-xs':'btn-danger px-3 py-1 text-xs'} onClick={async(e)=>{ e.stopPropagation(); await authFetch(`${API}/api/shows/${s.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ closed: !isClosed }) }); const ns=await (await authFetch(`${API}/api/shows`)).json(); setShows(ns); const r = await (await fetch(`${API}/api/reports/show/${s.id}`)).json(); setShowReports(prev=>({ ...prev, [s.id]: r })); }}>
                  {isClosed? 'Reopen':'Close'}
                </button>
              </div>
            </div>
          </div>
        ); })}
      </div>
      <div className="mb-3 grid md:grid-cols-3 gap-2 items-center">
        <input className="select" placeholder="Search merchant, notes, last4" onChange={async(e)=>{
          const q=e.target.value.toLowerCase();
          const base = await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json();
          setExpenses((base as any[]).filter(x=> (x.merchant||'').toLowerCase().includes(q) || (x.notes||'').toLowerCase().includes(q) || String(x.last4||'').includes(q)));
        }} />
        <button className="btn-primary" onClick={()=>setShowCardsMgr(true)} type="button">Manage cards</button>
        <button className="btn-primary" onClick={()=>setShowReport(true)} type="button">Generate report</button>
      </div>
      <div className="grid gap-3">
        <div className="card" onDragOver={e=>e.preventDefault()} onDrop={async()=>{ if(!dragging) return; await fetch(`${API}/api/expenses/${dragging.id}/assign`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_label: null }) }); setDragging(null); const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses(uniqueById([...e,...d])); }}>
          <div className="flex items-center justify-between mb-2"><h4 className="font-medium">Unassigned <span className="ml-2 text-xs text-slate-500">{allExpenses.filter(e=>e.status==='unassigned').length}</span></h4>
            <div className="flex items-center gap-2">
              <select id="assignOrg" className="select w-48">
                {orgs.map((o:any)=> <option key={o.label} value={o.label}>{o.label}</option>)}
              </select>
              <button className="btn-primary" onClick={async()=>{
                const selectEl = document.getElementById('assignOrg') as HTMLSelectElement; const label = selectEl?.value; if(!label) return;
                const ids = Object.entries(selected).filter(([id,checked])=> checked && allExpenses.find(e=>e.id===id)?.status==='unassigned').map(([id])=>id);
                await Promise.all(ids.map(id=> fetch(`${API}/api/expenses/${id}/assign`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_label: label }) })));
                const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses([...e,...d]); const all=await (await fetch(`${API}/api/expenses`)).json(); setAllExpenses(all);
              }} type="button">Assign selected</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500"><tr><th className="text-left py-2 w-8"></th><th className="text-left py-2">Merchant</th><th className="text-left">Amount</th><th className="text-left">Category</th><th className="text-left">Card</th><th className="text-left">Uploader</th><th className="text-left">Type</th><th className="text-right w-[220px]">Actions</th></tr></thead>
              <tbody>
                 {uniqueById(allExpenses.filter(e=>e.status==='unassigned')).map(e=> (
                  <tr key={e.id} className="border-t">
                    <td className="py-2"><input type="checkbox" checked={!!selected[e.id]} onChange={()=>setSelected(s=>({ ...s, [e.id]: !s[e.id] }))} /></td>
                    <td className="py-2">{e.merchant}</td>
                    <td>${e.total}</td>
                    <td>{e.category||'—'}</td>
                    <td>{e.last4? `**** ${e.last4}`:''}</td>
                     <td>{e.created_by||'—'}</td>
                    <td>
                      {(() => { const sh = shows.find((s:any)=>s.id===e.show_id); if(!sh) return (<span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">Daily</span>); const col=colorForShow(sh.id||sh.name||''); return (<span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: hexToRgba(col,0.15), color: col }}>{sh.name}</span>); })()}
                    </td>
                     <td className="text-right">
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    {(()=>{ return (<button className="btn-outline px-2 py-1 text-xs" aria-label="View" onClick={async()=>{ const url = await resolveReceiptUrl(e); if(url) setPreviewUrl(url); }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      </button>); })()}
                    <button className="btn-outline px-2 py-1 text-xs" aria-label="Edit" onClick={()=>setEdit(e)}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487l3.651 3.65M4.5 20.25l6.808-1.134a2 2 0 00.99-.54l8.515-8.515a2 2 0 000-2.828l-2.8-2.8a2 2 0 00-2.828 0L6.69 12.948a2 2 0 00-.54.99L5.016 20.25H4.5z"/></svg>
                    </button>
                    <button className="btn-danger px-2 py-1 text-xs" aria-label="Delete" onClick={async()=>{ if(!confirm('Delete expense?')) return; await fetch(`${API}/api/expenses/${e.id}`, { method:'DELETE' }); const all=await (await fetch(`${API}/api/expenses`)).json(); setAllExpenses(all); const e1=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d1=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses(uniqueById([...e1, ...d1])); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid gap-3">
          {orgs.map((o:any)=> (
            <div key={o.label} className="card" onDragOver={e=>e.preventDefault()} onDrop={async()=>{ if(!dragging) return; await fetch(`${API}/api/expenses/${dragging.id}/assign`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_label: o.label }) }); setDragging(null); const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses([...e,...d]); }}>
              <div className="flex items-center justify-between">
                <h4 className="font-medium" style={{ color: colorForOrg(o.label) }}>{o.label} <span className="ml-2 text-xs text-slate-500">{expenses.filter(e=>e.status==='assigned' && e.org_label===o.label).length}</span></h4>
                <div className="flex items-center gap-2">
                  <button className="btn-outline px-3 py-1 text-xs" onClick={async()=>{ const ids=Object.entries(selected).filter(([,v])=>v).map(([id])=>id); await Promise.all(ids.map(id=> fetch(`${API}/api/expenses/${id}/assign`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_label: null }) }))); const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses([...e,...d]); }} >Unassign</button>
                  <button className="btn-primary px-3 py-1 text-xs" onClick={async()=>{ const ids=Object.entries(selected).filter(([,v])=>v).map(([id])=>id); const r=await fetch(`${API}/api/expenses/push`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ids, org_label: o.label }) }); const j=await r.json(); alert(`Pushed ${j.count}`); }} >Push</button>
                  <button className="btn-outline px-3 py-1 text-xs" onClick={()=>exportCsvForOrg(o.label)}>Export</button>
                  <button className="btn-outline px-3 py-1 text-xs" onClick={(e)=>{ const body=(e.currentTarget as HTMLButtonElement).closest('.card')!.querySelector('.company-body') as HTMLDivElement; body.classList.toggle('hidden'); }}>+</button>
                </div>
              </div>
              <div className="text-xs text-slate-500">{o.configured? 'Ready' : 'Setup needed'} • Drop expenses here</div>
              <div className="company-body mt-2 hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                     <thead className="text-slate-500"><tr><th className="text-left py-2 w-8"></th><th className="text-left py-2">Merchant</th><th className="text-left">Amount</th><th className="text-left">Category</th><th className="text-left">Card</th><th className="text-left">Uploader</th><th className="text-left">Type</th><th className="text-right w-[220px]">Actions</th></tr></thead>
                    <tbody>
                      {expenses.filter(e=>e.status==='assigned' && e.org_label===o.label).map(e=> (
                        <tr key={e.id} className="border-t">
                          <td className="py-2"><input type="checkbox" checked={!!selected[e.id]} onChange={()=>setSelected(s=>({ ...s, [e.id]: !s[e.id] }))} /></td>
                          <td className="py-2">{e.merchant}</td>
                          <td>${e.total}</td>
                          <td>{e.category||'—'}</td>
                          <td>{e.last4? `**** ${e.last4}`:''}</td>
                          <td>{e.created_by||'—'}</td>
                          <td>{(() => { const sh = shows.find((s:any)=>s.id===e.show_id); if(!sh) return (<span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">Daily</span>); const col=colorForShow(sh.id||sh.name||''); return (<span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: hexToRgba(col,0.15), color: col }}>{sh.name}</span>); })()}</td>
                           <td className="text-right">
                              <div className="flex justify-end gap-2 whitespace-nowrap">
                                {(()=>{ const url = resolveReceiptUrl(e); if(url){ return (
                                  <button className="btn-outline px-2 py-1 text-xs" aria-label="View" onClick={()=>setPreviewUrl(url)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                  </button>
                                ); } return (<button className="btn-outline px-2 py-1 text-xs opacity-50 cursor-not-allowed" disabled title="No receipt linked">View</button>); })()}
                                <button className="btn-outline px-2 py-1 text-xs" aria-label="Edit" onClick={()=>setEdit(e)}>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487l3.651 3.65M4.5 20.25l6.808-1.134a2 2 0 00.99-.54l8.515-8.515a2 2 0 000-2.828l-2.8-2.8a2 2 0 00-2.828 0L6.69 12.948a2 2 0 00-.54.99L5.016 20.25H4.5z"/></svg>
                                </button>
                                <button className="btn-danger px-2 py-1 text-xs" aria-label="Delete" onClick={async()=>{ if(!confirm('Delete expense?')) return; await fetch(`${API}/api/expenses/${e.id}`, { method:'DELETE' }); const all=await (await fetch(`${API}/api/expenses`)).json(); setAllExpenses(all); const e1=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); const d1=await (await fetch(`${API}/api/expenses?daily=1`)).json(); setExpenses([...e1, ...d1]); }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              </div>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input className="input w-24" placeholder="Last 4" onBlur={async(e)=>{ const v=e.target.value.replace(/\D/g,'').slice(-4); if(!v) return; await fetch(`${API}/api/cardmap`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ last4: v, org_label: o.label }) }); const m = await (await fetch(`${API}/api/cardmap`)).json(); setCardMap(m); (e.target as HTMLInputElement).value=''; }} />
                    <span className="text-slate-500">Map → {o.label}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(cardMap).filter(([,_l])=>_l===o.label).map(([k])=> (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 border border-slate-200">
                        **** {k}
                        <button className="text-slate-500 hover:text-red-600" title="Remove mapping" onClick={async()=>{ await fetch(`${API}/api/cardmap`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ last4: k, org_label: null }) }); const m = await (await fetch(`${API}/api/cardmap`)).json(); setCardMap(m); }}>×</button>
                      </span>
                    ))}
                    {Object.entries(cardMap).filter(([,_l])=>_l===o.label).length===0 && (<span className="text-slate-400">—</span>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* totals row removed; handled by show tiles */}

      {edit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full">
            <h4 className="font-medium mb-2">Edit expense</h4>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Merchant" defaultValue={edit.merchant} onBlur={e=>edit.merchant=e.target.value} />
              <input className="input" placeholder="Date" type="date" defaultValue={edit.date||''} onBlur={e=>edit.date=e.target.value} />
              <input className="input" placeholder="Time" type="time" defaultValue={edit.time||''} onBlur={e=>edit.time=e.target.value} />
              <input className="input" placeholder="Subtotal" defaultValue={edit.subtotal||''} onBlur={e=>edit.subtotal=e.target.value} />
              <input className="input" placeholder="Tax" defaultValue={edit.tax||''} onBlur={e=>edit.tax=e.target.value} />
              <input className="input" placeholder="Tip" defaultValue={edit.tip||''} onBlur={e=>edit.tip=e.target.value} />
              <input className="input" placeholder="Total" defaultValue={edit.total||''} onBlur={e=>edit.total=e.target.value} />
              <div className="col-span-2">
                <label className="text-sm text-slate-600">Attach/replace receipt</label>
                <input id="edit-file" className="file-input" type="file" accept="image/*,application/pdf" />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={async()=>{
                let payload:any = { ...edit };
                const inp = document.getElementById('edit-file') as HTMLInputElement | null;
                const f = inp?.files?.[0];
                if(f){
                  const b64 = await new Promise<string>((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(f); });
                  const fr = await fetch(`${API}/api/files`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data: b64, content_type: f.type||'application/octet-stream' }) });
                  const fj = await fr.json();
                  if(fj){ payload.file_id = fj.id; payload.file_url = fj.url; }
                }
                await fetch(`${API}/api/expenses/${edit.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                setEdit(null);
                const e=await (await fetch(`${API}/api/expenses?show_id=${showId}`)).json(); setExpenses(e);
              }}>Save</button>
              <button className="btn-outline" onClick={()=>setEdit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" onClick={()=>setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full p-3" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">Receipt preview</div>
              <div className="flex gap-2">
                <a className="btn-outline" href={previewUrl} target="_blank" rel="noreferrer">Open in new tab</a>
                <a className="btn-outline" href={previewUrl} download>Download</a>
                <button className="btn-primary" onClick={()=>setPreviewUrl(null)}>Close</button>
              </div>
            </div>
            {(() => {
              const url = String(previewUrl);
              const boxStyle = { width:'90vw', maxWidth:'1200px', height:'75vh', maxHeight:'850px' } as React.CSSProperties;
              const contentStyle = { width:'100%', height:'100%', objectFit:'contain' } as React.CSSProperties;
              return (
                <div className="flex items-center justify-center" style={boxStyle}>
                  {(/\.pdf(\?|$)/i.test(url) || /\/api\/files\//.test(url)) ? (
                    <iframe src={url} title="receipt" style={contentStyle} className="rounded-xl bg-slate-50" />
                  ) : (
                    <img src={url} alt="receipt" style={contentStyle} className="rounded-xl bg-slate-50" />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showCardsMgr && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowCardsMgr(false)}>
          <div className="card max-w-lg w-full" onClick={e=>e.stopPropagation()}>
            <h4 className="font-medium mb-2">Manage card mappings</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <input className="input w-24" placeholder="Last 4" id="newCardLast4" />
                <select className="select" id="newCardOrg">{orgs.map((o:any)=> <option key={o.label} value={o.label}>{o.label}</option>)}</select>
                <button className="btn-primary" onClick={async()=>{ const last4=(document.getElementById('newCardLast4') as HTMLInputElement).value.replace(/\D/g,'').slice(-4); const org=(document.getElementById('newCardOrg') as HTMLSelectElement).value; if(!last4||!org) return; await fetch(`${API}/api/cardmap`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ last4, org_label: org }) }); const m = await (await fetch(`${API}/api/cardmap`)).json(); setCardMap(m); }}>Add</button>
              </div>
              <div className="mt-2">
                {Object.entries(cardMap).map(([k,v])=> (
                  <div key={k} className="flex items-center justify-between border-b py-1"><span>**** {k}</span><span className="text-slate-500">{v as any}</span><button className="btn-outline" onClick={async()=>{ await fetch(`${API}/api/cardmap`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ last4: k, org_label: null }) }); const m = await (await fetch(`${API}/api/cardmap`)).json(); setCardMap(m); }}>Remove</button></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReport && report && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowReport(false)}>
          <div className="card max-w-4xl w-full" onClick={e=>e.stopPropagation()}>
            <h4 className="font-medium mb-4">Trade show report</h4>
            <div className="grid gap-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500">
                    <tr><th className="text-left">Section</th><th className="text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.by_org||{}).map(([k,v]:any)=> (
                      <tr key={`org-${k}`} className="border-t"><td>Org • {k}</td><td className="text-right">${'{'}Number(v).toFixed(2){'}'}</td></tr>
                    ))}
                    {Object.entries(report.by_category||{}).map(([k,v]:any)=> (
                      <tr key={`cat-${k}`} className="border-t"><td>Category • {k}</td><td className="text-right">${'{'}Number(v).toFixed(2){'}'}</td></tr>
                    ))}
                    <tr className="border-t font-medium"><td>Total</td><td className="text-right">${'{'}Number(report.overall||0).toFixed(2){'}'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h5 className="font-medium mb-1">Detail</h5>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-slate-500"><tr><th className="text-left">Merchant</th><th className="text-left">Type</th><th className="text-left">Category</th><th className="text-right">Amount</th><th className="text-left">Company</th></tr></thead>
                    <tbody>
                      {expenses.filter(e=> showId? e.show_id===showId: true).map(e=> (
                        <tr key={e.id} className="border-t"><td>{e.merchant}</td><td>{e.is_daily? 'Daily': 'Show'}</td><td>{e.category||'—'}</td><td className="text-right">${e.total}</td><td>{e.org_label||'Unassigned'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ExpenseCard({ e, onEdit, onDragStart, checked, onToggle, setPreviewUrl }:{ e:any; onEdit:()=>void; onDragStart:()=>void; checked:boolean; onToggle:()=>void; setPreviewUrl?:(url:string)=>void }){
  return (
    <div draggable onDragStart={onDragStart} className="rounded-xl border border-slate-200 p-2 text-sm flex items-center justify-between bg-white">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" />
        <div>
          <div className="font-medium">{e.merchant} — ${'{'}e.total{'}'}</div>
          <div className="text-xs text-slate-500">{e.date} {e.time} {e.org_label? `→ ${e.org_label}`:''} {e.last4? `• **** ${e.last4}`:''} {e.pushed? '• pushed':''}</div>
          {(() => { const url = e.file_url || (e.file_id? `${API}/api/files/${e.file_id}`:''); return url? (<a className="text-xs text-blue-600 underline" href={url} target="_blank" rel="noreferrer">view receipt</a>) : null; })()}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-outline" onClick={onEdit}>Edit</button>
        <button className="btn-outline" onClick={async()=>{ if(!confirm('Delete expense?')) return; await fetch(`${API}/api/expenses/${e.id}`, { method:'DELETE' }); const r=await fetch(`${API}/api/expenses?show_id=${e.show_id||''}`); const list=await r.json(); const d=await (await fetch(`${API}/api/expenses?daily=1`)).json(); location.reload(); }}>Delete</button>
      </div>
    </div>
  );
}

