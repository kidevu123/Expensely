"use client";
import { useEffect, useState } from 'react';
import { getUser, type User, authFetch } from '../../lib/auth';
import Tesseract from 'tesseract.js';
function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || '';
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}
const API = getApiBase();

// Helpers from your tuned parser
function parseDateFromText(str:string){
  const mdy=str.match(/\b(0?[1-9]|1[0-2])[\/. -](0?[1-9]|[12]\d|3[01])[\/. -](\d{2,4})\b/);
  if(mdy){ const [_,mm,dd,yyyy]=mdy as any; const yy=(yyyy.length===2?'20'+yyyy:yyyy); return `${String(yy).padStart(4,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
  const long=str.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:,)?\s+(\d{4})\b/i);
  if(long){ const map:any={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12}; const mm=String(map[(long[1] as string).slice(0,3).toLowerCase()]).padStart(2,'0'); return `${long[3]}-${mm}-${String(long[2]).padStart(2,'0')}`; }
  return '';
}
function escapeRe(s:string){ return String(s).replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&'); }
function parseRegexTesseract(text:string){
  if(!text) return null as any;
  const normalizedText = text
    .replace(/(\d):(\d{2})(?!\d)/g,'$1.$2')
    .replace(/(?<=\b\$?\s*)O(?=\d)/g,'0');
  const rawLines = normalizedText
    .replace(/\u00A0/g,' ')
    .replace(/[|·•]+/g,' ')
    .replace(/\s{2,}/g,' ')
    .split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const moneyRx = /\$?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/g;
  const approxMoneyRx = /\$?\s*(\d{1,4}(?:,\d{3})*(?:\s*[\.:]\s*\d{2}))/g;
  const toNum = (s:any)=> parseFloat(String(s).replace(/[Oo]/g,'0').replace(/[^\d.]/g,''));
  const toNumApprox = (s:any)=>{ const cleaned=String(s).replace(/[Oo]/g,'0').replace(/\s+/g,'').replace(/,/g,'').replace(':','.'); const m=cleaned.match(/\d+(?:\.\d{2})?/); return m?parseFloat(m[0]):NaN; };
  const looksLikeAddress = (l:string)=> /\d/.test(l) && (/(\b(ave|st|rd|blvd|hwy|pkwy|suite|ste|dr|apt|ga|ca|ny|tx|fl)\b)/i.test(l) || /\b\d{5}(?:-\d{4})?\b/.test(l));
  const isPhone = (l:string)=> /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(l);
  const hasPct = (l:string)=> /%/.test(l);

  // Merchant
  const Lrn = { brands: [] as string[], synonyms: { subtotal:[], tax:[], tip:[], total:[] as string[] } };
  const learnedBrandAtoms = (Lrn.brands||[]).map(b=>b.replace(/[^a-z0-9]+/gi,'').toLowerCase()).filter(Boolean);
  const businessHints = new RegExp(`(penang|hawker|coffee|cafe|roasters|market|supercenter|club|grill|bar|bistro|kitchen|pizza|sushi|food|city|hop|amazon|walmart|walgreens|target|costco|sam.?s|valor|lyft|uber${learnedBrandAtoms.length?`|${learnedBrandAtoms.join('|')}`:''})`,'i');
  const learnedBrandPhrases = (Lrn.brands||[]).map(escapeRe);
  const brand = text.match(new RegExp(`\\b(amazon\\.com|hop city krog|valor coffee|walmart|sam.?s club|target|costco|walgreens|whole foods|trader joe['’]?s|starbucks|dunkin|mcdonald['’]?s|parkindy|lyft|uber${learnedBrandPhrases.length?`|${learnedBrandPhrases.join('|')}`:''})\\b`,'i'));
  const alphaOnly = (s:string)=> /[A-Za-z][A-Za-z &'.-]+/.test(s) && !/[0-9$]/.test(s);
  const looksLikeNoise = (s:string)=> /(total|subtotal|tax|tip|amount\s*due|balance\s*due|receipt|powered|thanks)/i.test(s);
  const top = rawLines.slice(0,18).filter(l=>!looksLikeAddress(l)&&!isPhone(l)&&!looksLikeNoise(l));
  let merchant='';
  if(brand){ merchant = brand[1]; } else {
    merchant = top.find(l=>/\b(food|cafe|hawker|penang)\b/i.test(l) && alphaOnly(l))
            || top.find(l=>alphaOnly(l) && /\s/.test(l) && businessHints.test(l))
            || top.find(l=>alphaOnly(l) && /\s/.test(l))
            || top.find(l=>alphaOnly(l) && businessHints.test(l)) || '';
  }

  // Date/time
  const dateRaw = (text.match(/\b(0?[1-9]|1[0-2])[\/.-](0?[1-9]|[12]\d|3[01])[\/.-](\d{2,4})\b/)||[])[0]
               || (text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,)?\s+\d{4}\b/i)||[])[0] || '';
  const date = parseDateFromText(dateRaw);
  const tmatch = text.match(/\b(\d{1,2}:[0-5]\d(?:\s*[AP]M)?)\b/i);
  const time = tmatch ? tmatch[1].toUpperCase().replace(/\s+/g,'') : '';

  // Amounts
  const lastAmountOnLine = (line:string)=>{ const m=[...line.matchAll(moneyRx)].map(x=>toNum(x[1])); return m.length? m[m.length-1]: null; };
  const lastAmountOnLineApprox = (line:string)=>{ const m=[...line.matchAll(approxMoneyRx)].map(x=>toNumApprox(x[1])); return m.length? m[m.length-1]: null; };
  const subLine = rawLines.find(l=>/(purchase\s*subtotal|sub\s*-?\s*total)/i.test(l));
  let subtotal:any = subLine ? lastAmountOnLine(subLine) : null;
  const taxLines = rawLines.filter(l=>/\b(?:sales\s*tax|tax\d*|tax\s*\d+|gst|hst|vat)\b/i.test(l));
  let tax:any = null; if(taxLines.length){ const vals:number[]=[]; for(let i=0;i<taxLines.length;i++){ const l=taxLines[i]; let amts=[...l.matchAll(moneyRx)].map(x=>toNum(x[1])); if(!amts.length) amts=[...l.matchAll(approxMoneyRx)].map(x=>toNumApprox(x[1])); if(amts.length) vals.push(amts[amts.length-1]); else if(hasPct(l)){ const idx=rawLines.indexOf(l); const nextAmt = idx>=0? lastAmountOnLineApprox(rawLines[idx+1]||''): null; if(nextAmt!=null) vals.push(nextAmt);} } if(vals.length) tax=+(vals.reduce((a,b)=>a+b,0)).toFixed(2); }
  // Tip
  let tip:any=null; const inlineTip = text.match(/\b(tip|gratuity)\b[^\n\r\d$]*\$?\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/i); if(inlineTip) tip=toNum(inlineTip[2]);
  const tipCandidates = rawLines.map((l,i)=>({l,i})).filter(o=>/\b(tip|gratuity)\b/i.test(o.l) && !/(add\s*tip|tips\b)/i.test(o.l));
  if(tipCandidates.length){ const tipVals:number[]=[]; for(const {l,i} of tipCandidates){ const same=lastAmountOnLine(l); if(same!=null){ tipVals.push(same); continue;} const nextLine=rawLines[i+1]||''; if(!/(apple\s*pay|visa|mastercard|amex|payment|charged)/i.test(nextLine)){ const next=lastAmountOnLine(nextLine); if(next!=null) tipVals.push(next);} } if(tipVals.length) tip=+(tipVals[tipVals.length-1]).toFixed(2); }
  // Total
  const paymentLine = rawLines.find(l=>/(apple\s*pay|visa|mastercard|amex|payment|charged|amount\s*charged|total\s*\$?\s*\d)/i.test(l));
  const totalLines = rawLines.map((l,i)=>({i,l})).filter(o=>/\b(total|amount\s*due|balance\s*due)\b/i.test(o.l));
  let total:any=null; for(let k=totalLines.length-1;k>=0;k--){ const {l,i}=totalLines[k]; let val=lastAmountOnLine(l); if(val==null) val=lastAmountOnLineApprox(l); if(val==null&&rawLines[i+1]) val=lastAmountOnLineApprox(rawLines[i+1]); if(val!=null){ total=val; break; } }
  if(total==null && paymentLine){ const pv = lastAmountOnLine(paymentLine) || lastAmountOnLineApprox(paymentLine); if(pv!=null) total=pv; }
  if(total==null && subtotal!=null && (tax!=null || tip!=null)){ const calc=(subtotal+(tax||0)+(tip||0)); if(Number.isFinite(calc)) total=+calc.toFixed(2); }
  if(total==null){ const start=Math.floor(rawLines.length*0.6); const nums=rawLines.slice(start).flatMap(l=>[...l.matchAll(moneyRx)].map(m=>toNum(m[1]))); if(nums.length) total=Math.max(...nums); }
  // Subtotal from line items if needed
  if(subtotal==null){ const itemLines=rawLines.filter(l=>/(fare|fee|surcharge|recovery|parking\s*cost|transaction\s*fee)/i.test(l)); if(itemLines.length){ const sum=itemLines.reduce((acc,l)=>{ const xs=[...l.matchAll(moneyRx)].map(m=>toNum(m[1])); if(xs.length) acc+=xs[xs.length-1]; return acc; },0); if(sum>0) subtotal=+sum.toFixed(2);} }
  // Infer tip if bogus
  const joined = rawLines.join('\n');
  if(subtotal!=null && total!=null){ const inferred=+(total - subtotal - (tax||0)).toFixed(2); const hasExplicitTip=/\b(tip|gratuity)\b/i.test(joined); if(!hasExplicitTip && inferred>=0 && inferred<subtotal){ tip = inferred===0? null: inferred; }
  }
  const category = /coffee|cafe|toast|restaurant|bar|grill|pizza|sushi/i.test(joined) ? 'Meals & Entertainment'
                 : /(uber|lyft|fare|pickup|drop[- ]?off|ride)/i.test(joined) ? 'Travel'
                 : /(parking|parkindy|meter|zone)/i.test(joined) ? 'Parking'
                 : /walmart|target|supercenter|costco|sam.?s club/i.test(joined) ? 'Supplies' : 'Uncategorized';
  return { merchant, date, time, subtotal: subtotal!=null? subtotal.toFixed(2):'', tax: tax!=null? tax.toFixed(2):'', tip: tip!=null? tip.toFixed(2):'', total: total!=null? total.toFixed(2):'', category, notes:'' };
}

export default function Upload(){
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  const [shows, setShows] = useState<any[]>([]);
  const [showId, setShowId] = useState<string>('');
  const [file, setFile] = useState<File|null>(null);
  const [fileData, setFileData] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [mode, setMode] = useState<'daily'|'show'>('show');
  const [ocrText, setOcrText] = useState('');
  const [parsed, setParsed] = useState<any>({ merchant:'', date:'', time:'', subtotal:'', tax:'', tip:'', total:'', category:'Uncategorized', notes:'' });
  const [busy, setBusy] = useState(false);
  const [last4, setLast4] = useState('');

  useEffect(()=>{ setMounted(true); setCurrentUser(getUser()); },[]);
  useEffect(()=>{ if(!mounted) return; (async()=>{ const r=await authFetch(`${API}/api/shows`); const j=await r.json(); setShows(j);
    const firstOpen = (j||[]).find((s:any)=>!s.closed);
    if(firstOpen){ setShowId(firstOpen.id); setMode('show'); }
    else if(j && j[0]){ setShowId(j[0].id); setMode('show'); }
    else { setMode('daily'); }
  })(); },[mounted]);

  async function runOCR(f:File){
    setBusy(true); setOcrText('');
    const b64 = await fileToBase64(f); setFileData(b64); setFileType(f.type||'');
    const { data } = await Tesseract.recognize(f, 'eng');
    const text = data.text || '';
    setOcrText(text);
    const p:any = parseRegexTesseract(text);
    setParsed({ 
      merchant:p.merchant||'',
      date:p.date||'',
      time:p.time||'',
      subtotal:p.subtotal||'',
      tax:p.tax||'',
      tip:p.tip||'',
      total:p.total||'',
      category:p.category||'Uncategorized',
      notes:''
    });
    // attempt to guess card last4 from OCR text
    const lowered = text.toLowerCase();
    const candidates:string[] = [];
    const masks = [/(?:\bending\s*in\s*)(\d{4})/, /(\*{2,}|x{2,}|•{2,})\s*(\d{4})/, /(\d{4})\s*(\*{2,}|x{2,}|•{2,})/];
    for(const rx of masks){ const m = lowered.match(rx as any); if(m){ const v=m[1]||m[2]; if(v) candidates.push(v); }}
    if(!candidates.length){
      const kw = /(visa|mastercard|amex|discover|debit|credit|card)/i;
      const parts = lowered.split(/\s+/);
      for(let i=0;i<parts.length;i++){
        if(kw.test(parts[i])){
          for(let j=i+1;j<Math.min(parts.length,i+6);j++){
            const m = parts[j].match(/(\d{4})/); if(m){ candidates.push(m[1]); break; }
          }
        }
      }
    }
    if(candidates[0]) setLast4(candidates[0]);
    setBusy(false);
  }

  async function submit(e:any){ e.preventDefault();
    // Build the payload and let the server handle upload + link creation
    let dataToSend = fileData;
    if(!dataToSend && file){ dataToSend = await fileToBase64(file); }
    const payload:any = {
      show_id: mode==='show'? showId: undefined,
      is_daily: mode==='daily',
      merchant: parsed.merchant,
      date: parsed.date,
      time: parsed.time,
      subtotal: parsed.subtotal,
      tax: parsed.tax,
      tip: parsed.tip,
      total: parsed.total,
      category: parsed.category,
      notes: parsed.notes,
      last4: last4 || undefined,
    };
    if (dataToSend) { payload.file_data = dataToSend; payload.content_type = file?.type||'image/jpeg'; }
    const r = await fetch(`${API}/api/expenses`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const jr = await r.json().catch(()=>({}));
    if(r.ok){ alert('Saved.'); resetAll(); }
    else { alert(jr.error||'Failed to save expense'); }
  }

  function exportJSON(){
    const payload = { ...parsed, show_id: showId, createdAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `expense-${Date.now()}.json`; a.click();
  }

  function resetAll(){ setParsed({ merchant:'', date:'', time:'', subtotal:'', tax:'', tip:'', total:'', category:'Uncategorized', notes:'' }); setOcrText(''); setFile(null); }
  function fileToBase64(f:File){ return new Promise<string>((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(f); }); }

  if(!mounted) return null;
  if(!currentUser) return <main className="p-6 max-w-3xl mx-auto"><p>Please <a className="underline" href="/login">sign in</a>.</p></main>;
  const hasAnyShow = shows && shows.length>0;
  const allowDaily = Boolean((currentUser as any).allow_daily_expenses);
  const isPrivileged = (currentUser.role==='admin' || currentUser.role==='accountant' || currentUser.role==='coordinator');
  const selectedShow = shows.find((s:any)=>s.id===showId);
  if(!isPrivileged && !allowDaily && !hasAnyShow){
    return <main className="p-6 max-w-3xl mx-auto"><p className="text-slate-700">You are not assigned to a trade show yet. Please contact your coordinator.</p></main>;
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-medium mb-4">New expense</h2>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-3 grid gap-2 md:grid-cols-3">
          <select className="select" value={mode} onChange={e=>setMode(e.target.value as any)}>
            <option value="show" disabled={!hasAnyShow}>Trade show</option>
            <option value="daily" disabled={!(isPrivileged || allowDaily)}>Daily expense</option>
          </select>
          {mode==='show' && (
            <select className="select" value={showId} onChange={e=>setShowId(e.target.value)} disabled={!hasAnyShow}>
              {shows.map((s:any)=> <option key={s.id} value={s.id} disabled={!!s.closed}>{s.name}{s.closed?' (closed)':''}</option>)}
            </select>
          )}
        </div>
         {mode==='show' && selectedShow?.closed && (
           <div className="card bg-amber-50 border-amber-200 text-amber-800">Submissions are closed for {selectedShow.name}. Choose another show or switch to Daily.</div>
         )}
         <div className="card">
           <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 flex items-center justify-center overflow-hidden min-h-[260px] md:min-h-[380px]"
             onDragOver={e=>e.preventDefault()}
             onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(!f) return; setFile(f); runOCR(f); }}>
              {!fileData ? (
               <button type="button" className="flex flex-col items-center gap-3 text-slate-600" disabled={mode==='show' && !!selectedShow?.closed} onClick={()=>{ (document.getElementById('upload-file') as HTMLInputElement)?.click(); }}>
                 <div className="upload-icon">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"/></svg>
                 </div>
                 <div className="text-sm">Tap to upload or drag a receipt (JPG/PDF)</div>
               </button>
             ) : (
                (fileType.includes('pdf') ? (
                  <iframe title="receipt-preview" src={fileData} className="w-full h-[60vh] rounded-xl bg-slate-50" />
                ) : (
                  <img alt="receipt preview" src={fileData} className="max-w-[80vw] max-h-[60vh] w-auto h-auto object-contain bg-slate-100 rounded-xl" />
                ))
             )}
             <input id="upload-file" className="file-input" type="file" accept="image/*,application/pdf" disabled={mode==='show' && !!selectedShow?.closed} onChange={e=>{ const f=(e.target as HTMLInputElement).files?.[0]||null; setFile(f); if(f) runOCR(f); }} />
           </div>
          {busy && <p className="mt-2 text-sm text-slate-600">Scanning…</p>}
           {ocrText && <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-600">Show OCR text</summary><pre className="mt-2 text-xs bg-slate-50 p-3 rounded-xl overflow-auto max-h-64 whitespace-pre-wrap">{ocrText}</pre></details>}
           {/* Preview now rendered inside dropzone; no extra huge image below */}
        </div>
        <div className="card grid gap-2">
          <label className="text-sm text-slate-600">Merchant</label>
          <input className="input" placeholder="Merchant" value={parsed.merchant} onChange={e=>setParsed({...parsed,merchant:e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-slate-600">Date</label>
              <input className="input" type="date" value={parsed.date} onChange={e=>setParsed({...parsed,date:e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-slate-600">Time (optional)</label>
              <input className="input" type="time" value={parsed.time} onChange={e=>setParsed({...parsed,time:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-slate-600">Subtotal</label>
              <input className="input" placeholder="0.00" value={parsed.subtotal} onChange={e=>setParsed({...parsed,subtotal:e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-slate-600">Tax</label>
              <input className="input" placeholder="0.00" value={parsed.tax} onChange={e=>setParsed({...parsed,tax:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600">Tip</label>
            <input className="input" placeholder="0.00" value={parsed.tip} onChange={e=>setParsed({...parsed,tip:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Total</label>
            <input className="input" placeholder="0.00" value={parsed.total} onChange={e=>setParsed({...parsed,total:e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Card last 4 (optional)</label>
            <input className="input" placeholder="1234" value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,'').slice(-4))} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Category (guess)</label>
            <select className="select" value={parsed.category} onChange={e=>setParsed({...parsed,category:e.target.value})}>
              <option>Uncategorized</option>
              <option>Meals & Entertainment</option>
              <option>Travel</option>
              <option>Lodging</option>
              <option>Fuel</option>
              <option>Parking</option>
              <option>Supplies</option>
              <option>Shipping</option>
              <option>Software</option>
              <option>Utilities</option>
              <option>Advertising & Marketing</option>
              <option>Bank Fees</option>
              <option>Client Gifts</option>
              <option>Education & Training</option>
              <option>Insurance</option>
              <option>Licenses & Permits</option>
              <option>Maintenance & Repairs</option>
              <option>Office Expenses</option>
              <option>Phone</option>
              <option>Rent</option>
              <option>Shipping & Postage</option>
              <option>Software & Subscriptions</option>
              <option>Utilities</option>
              <option>Mileage</option>
              <option>Professional Services</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Notes</label>
            <textarea className="input" rows={4} placeholder="Optional" value={parsed.notes} onChange={e=>setParsed({...parsed,notes:e.target.value})} />
          </div>
          <div className="flex gap-3 mt-2">
            <button className="btn-primary" type="submit" disabled={!file || !parsed.total || (mode==='show' && !!selectedShow?.closed)}>Save expense</button>
            <button type="button" className="btn-primary" onClick={exportJSON}>Export JSON</button>
            <button type="button" className="btn-outline" onClick={resetAll}>Reset</button>
          </div>
        </div>
      </form>
    </main>
  );
}

