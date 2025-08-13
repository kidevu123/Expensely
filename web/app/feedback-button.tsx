"use client";
import { useState } from 'react';
import { authFetch } from '../lib/auth';

export default function FeedbackButton(){
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [fileData, setFileData] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_BASE_URL as string;

  async function submit(e:any){
    e.preventDefault(); if(!note.trim()) return alert('Please enter a note'); setBusy(true);
    const r = await authFetch(`${API}/api/feedback`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ note, file_data: fileData }) });
    setBusy(false);
    if(!r.ok){ const j=await r.json().catch(()=>({error:'Error'})); alert(j.error||'Error'); return; }
    setNote(''); setFileData(''); setOpen(false); alert('Thanks! Feedback submitted.');
  }

  return (
    <>
      <button className="btn-outline" onClick={()=>setOpen(true)}>Feedback</button>
      {open && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center p-4 z-50" onClick={()=>setOpen(false)}>
          <div className="card max-w-lg w-full shadow-2xl ring-2 ring-indigo-300" onClick={(e)=>e.stopPropagation()}>
            <h3 className="font-medium mb-2">Send feedback</h3>
            <form onSubmit={submit} className="grid gap-3">
              <textarea className="input h-32" placeholder="Describe the issue or suggestion" value={note} onChange={e=>setNote(e.target.value)} />
              <div>
                <label className="text-sm text-slate-600">Optional screenshot</label>
                <input className="file-input" type="file" accept="image/*,.pdf" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f){ setFileData(''); return; } const r=new FileReader(); r.onload=()=>setFileData(String(r.result)); r.readAsDataURL(f); }} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn-outline" onClick={()=>setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy? 'Sending…':'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

