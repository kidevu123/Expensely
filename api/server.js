import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Local file storage (persist receipts)
const DATA_DIR = process.env.DATA_DIR || '/data';
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
app.use('/files', express.static(DATA_DIR));
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const SHOWS_PATH = path.join(DATA_DIR, 'shows.json');
const EXPENSES_PATH = path.join(DATA_DIR, 'expenses.json');
const PARTICIPANTS_PATH = path.join(DATA_DIR, 'participants.json');
const COSTS_PATH = path.join(DATA_DIR, 'costs.json');
const CARDMAP_PATH = path.join(DATA_DIR, 'cardmap.json');
const AUDIT_PATH = path.join(DATA_DIR, 'audit.json');
const FEEDBACK_PATH = path.join(DATA_DIR, 'feedback.json');

function loadUsersFromDisk(){
  try { const raw = fs.readFileSync(USERS_PATH, 'utf8'); const arr = JSON.parse(raw); if(Array.isArray(arr)) return arr; } catch {}
  return [];
}
function saveUsersToDisk(users){
  try { fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2)); } catch {}
}

function loadFrom(pathname, fallback){ try { const raw=fs.readFileSync(pathname,'utf8'); return JSON.parse(raw); } catch { return fallback; } }
function saveTo(pathname, data){ try { fs.writeFileSync(pathname, JSON.stringify(data, null, 2)); } catch {} }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Simple in-memory stubs (replace with Postgres soon) ---
const memory = {
  shows: loadFrom(SHOWS_PATH, []),
  expenses: loadFrom(EXPENSES_PATH, []),
  users: loadUsersFromDisk(),
  showParticipants: loadFrom(PARTICIPANTS_PATH, []), // { show_id, user_id, airline?, ... }
  showCosts: loadFrom(COSTS_PATH, []), // { id, show_id, type, description, amount, file_id? }
  files: {}, // id -> { contentType, dataBase64 }
  analytics: {
    logins: [], // { email, ts, ip, ua }
    heartbeats: {}, // email -> { last_seen, ip, ua }
  },
  cardMap: loadFrom(CARDMAP_PATH, {}), // last4 -> org_label
  audit: loadFrom(AUDIT_PATH, []), // { ts, actor, action, entity, entity_id, details }
  feedback: loadFrom(FEEDBACK_PATH, []), // { id, note, file_id?, created_by, created_at, status }
};

function actorFrom(req){
  const email = String(req.header('x-user-email')||'').toLowerCase();
  const username = String(req.header('x-user-username')||'');
  return email || username || 'system';
}
function audit(req, action, entity, entity_id, details){
  const actor = actorFrom(req);
  const item = { ts: Date.now(), actor, action, entity, entity_id, details };
  memory.audit.push(item);
  saveTo(AUDIT_PATH, memory.audit);
}

function bootstrapAdmin(){
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@localhost').toLowerCase();
  if(!memory.users.find(u=>u.email===adminEmail)){
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin', 10);
    memory.users.push({ id:'u-admin', email: adminEmail, name:'Admin', role:'admin', permissions:['admin','accountant','coordinator'], password_hash: passwordHash, phone_e164: process.env.ADMIN_PHONE||'', avatar_url: '' });
    saveUsersToDisk(memory.users);
  }
}
bootstrapAdmin();

// Auth stubs
app.post('/api/auth/login', (req, res) => {
  const { email, username, password } = req.body || {};
  if(!(email||username)) return res.status(400).json({ error:'username or email required' });
  const e = email? String(email).toLowerCase(): undefined;
  const uname = username? String(username): undefined;
  let user = memory.users.find(u=> (e && u.email===e) || (uname && u.username===uname));
  if(!user) return res.status(401).json({ error:'invalid credentials' });
  if(!user.password_hash) return res.status(401).json({ error:'password not set. Contact admin.' });
  const ok = bcrypt.compareSync(String(password||''), user.password_hash);
  if(!ok) return res.status(401).json({ error:'invalid credentials' });
  // record login analytics
  try {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
    const ua = req.headers['user-agent'] || '';
    const key = user.email || user.username || 'user';
    memory.analytics.logins.push({ email: key, ts: Date.now(), ip, ua });
    memory.analytics.heartbeats[key] = { last_seen: Date.now(), ip, ua };
  } catch {}
  res.json({ ok: true, user });
});
app.get('/api/users/me', (req, res) => {
  const email = String(req.header('x-user-email')||'').toLowerCase();
  const username = String(req.header('x-user-username')||'');
  let user = memory.users.find(u=> (email && u.email===email) || (username && u.username===username));
  if(!user) return res.status(401).json({ error:'unauthorized' });
  res.json(user);
});

// Heartbeat for active sessions
app.post('/api/analytics/heartbeat', (req,res)=>{
  const email = String(req.header('x-user-email')||'').toLowerCase();
  if(!email) return res.json({ ok:false });
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
  const ua = req.headers['user-agent'] || '';
  memory.analytics.heartbeats[email] = { last_seen: Date.now(), ip, ua };
  res.json({ ok:true });
});

// Admin metrics dashboard
app.get('/api/admin/metrics', (_req,res)=>{
  const now = Date.now();
  const activeCutoff = now - 5*60*1000; // 5 minutes
  const lastDayCutoff = now - 24*60*60*1000;
  const sessions = Object.entries(memory.analytics.heartbeats).map(([email, v])=>({ email, ...v }));
  const activeUsers = sessions.filter(s=>s.last_seen>=activeCutoff);
  const recentLogins = memory.analytics.logins.filter(l=>l.ts>=lastDayCutoff);
  const usersByRole = memory.users.reduce((acc, u)=>{ acc[u.role]=(acc[u.role]||0)+1; return acc; },{});
  // logins per day (last 7 days)
  const days = Array.from({length:7}).map((_,i)=>{
    const start = now - (6-i)*24*60*60*1000;
    const day = new Date(start).toISOString().slice(0,10);
    const count = memory.analytics.logins.filter(l=> new Date(l.ts).toISOString().slice(0,10)===day).length;
    return { day, count };
  });
  const topIps = recentLogins.reduce((acc, l)=>{ acc[l.ip]=(acc[l.ip]||0)+1; return acc; },{});
  const topIpList = Object.entries(topIps).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ip,count])=>({ip,count}));
  res.json({
    totals: { users: memory.users.length, shows: memory.shows.length, expenses: memory.expenses.length },
    usersByRole,
    activeNow: activeUsers,
    sessions,
    recentLogins: recentLogins.slice(-50),
    loginsLast7Days: days,
    topIps: topIpList,
  });
});

// Users admin
app.get('/api/users', (_req,res)=>{ res.json(memory.users); });
app.post('/api/users', (req,res)=>{
  const { email, username, name, role, password, phone, avatar_url, permissions, allow_daily_expenses } = req.body||{}; if(!(email||username)) return res.status(400).json({error:'username or email required'});
  const e = email? String(email).toLowerCase(): '';
  const uname = username? String(username): (e? e.split('@')[0]: '');
  if(e && memory.users.find(u=>u.email===e)) return res.status(409).json({ error:'exists' });
  if(uname && memory.users.find(u=>u.username===uname)) return res.status(409).json({ error:'username exists' });
  const u={ id:`u-${Date.now()}`, email:e, username: uname, name:name||uname||e, role: role||'attendee', permissions: Array.isArray(permissions)? permissions: [], password_hash: password? bcrypt.hashSync(String(password), 10): undefined, phone_e164: phone||'', allow_daily_expenses: !!allow_daily_expenses, avatar_url: avatar_url||'' };
  memory.users.push(u); saveUsersToDisk(memory.users); audit(req,'create','user',u.id,{ email: u.email, role: u.role }); res.json(u);
});
app.patch('/api/users/:id', (req,res)=>{
  const u = memory.users.find(x=>x.id===req.params.id); if(!u) return res.status(404).json({error:'not found'});
  const { role, name, phone, allow_daily_expenses, avatar_url, permissions, email } = req.body||{};
  if(role) u.role=role;
  if(name) u.name=name;
  if(phone!==undefined) u.phone_e164 = phone;
  if(allow_daily_expenses!==undefined) u.allow_daily_expenses = !!allow_daily_expenses;
  if(avatar_url!==undefined) u.avatar_url = avatar_url;
  if(permissions) u.permissions = permissions;
  if(email){
    const e = String(email).toLowerCase();
    if(memory.users.some(x=>x.email===e && x.id!==u.id)) return res.status(409).json({ error:'email already in use' });
    u.email = e;
  }
  saveUsersToDisk(memory.users); audit(req,'update','user',u.id,{ role, name, phone, allow_daily_expenses, permissions });
  res.json(u);
});
app.delete('/api/users/:id', (req,res)=>{
  memory.users = memory.users.filter(u=>u.id!==req.params.id);
  saveUsersToDisk(memory.users);
  audit(req,'delete','user',req.params.id,{});
  res.json({ ok:true });
});

app.patch('/api/users/:id/password', (req,res)=>{
  const u = memory.users.find(x=>x.id===req.params.id); if(!u) return res.status(404).json({error:'not found'});
  const { password } = req.body||{}; if(!password) return res.status(400).json({error:'password required'});
  u.password_hash = bcrypt.hashSync(String(password), 10);
  saveUsersToDisk(memory.users);
  res.json({ ok:true });
});

// Org list from env
app.get('/api/zoho/orgs', (_req, res) => {
  const labels = ['Nirvana','Summitt Labs','Haute Brands','Boomin Brands'];
  const out = labels.map(l => ({
    label: l,
    dc: process.env[`ZOHO_${l.replace(/ /g,'_')}_DC`] || 'com',
    configured: Boolean(process.env[`ZOHO_${l.replace(/ /g,'_')}_REFRESH_TOKEN`] && process.env[`ZOHO_${l.replace(/ /g,'_')}_ORG_ID`])
  }));
  res.json(out);
});

// Shows (filtered by user role)
app.get('/api/shows', (req, res) => {
  const email = String(req.header('x-user-email')||'').toLowerCase();
  const me = memory.users.find(u=>u.email===email);
  if(!me) return res.json([]);
  if(me.role==='admin' || me.role==='coordinator' || me.role==='accountant') return res.json(memory.shows);
  const allowedShowIds = new Set(memory.showParticipants.filter(p=>p.user_id===me.id).map(p=>p.show_id));
  res.json(memory.shows.filter(s=>allowedShowIds.has(s.id)));
});
app.post('/api/shows', (req, res) => {
  const email = String(req.header('x-user-email')||'').toLowerCase();
  const owner = memory.users.find(u=>u.email===email);
  const { name, city, starts_at, ends_at, whatsapp_group_name, whatsapp_invite_link, address, booth_number, closed } = req.body || {};
  const item = { id: `s-${Date.now()}`, name, city, starts_at, ends_at, created_by: owner?.id, whatsapp_group_name, whatsapp_invite_link, address: address||'', booth_number: booth_number||'', closed: !!closed };
  memory.shows.push(item); audit(req,'create','show',item.id,{ name, city });
  saveTo(SHOWS_PATH, memory.shows);
  res.json(item);
});
app.patch('/api/shows/:id', (req,res)=>{
  const s = memory.shows.find(x=>x.id===req.params.id); if(!s) return res.status(404).json({error:'not found'});
  const { name, city, starts_at, ends_at, whatsapp_group_name, whatsapp_invite_link, address, booth_number, closed } = req.body||{};
  if(name!==undefined) s.name=name;
  if(city!==undefined) s.city=city;
  if(starts_at!==undefined) s.starts_at=starts_at;
  if(ends_at!==undefined) s.ends_at=ends_at;
  if(whatsapp_group_name!==undefined) s.whatsapp_group_name=whatsapp_group_name;
  if(whatsapp_invite_link!==undefined) s.whatsapp_invite_link=whatsapp_invite_link;
  if(address!==undefined) s.address = address;
  if(booth_number!==undefined) s.booth_number = booth_number;
  if(closed!==undefined) s.closed = !!closed;
  saveTo(SHOWS_PATH, memory.shows); audit(req,'update','show',s.id,{ name, city, starts_at, ends_at, closed: s.closed }); res.json(s);
});
app.delete('/api/shows/:id', (req,res)=>{
  memory.shows = memory.shows.filter(s=>s.id!==req.params.id);
  memory.showParticipants = memory.showParticipants.filter(p=>p.show_id!==req.params.id);
  memory.showCosts = memory.showCosts.filter(c=>c.show_id!==req.params.id);
  // Convert expenses for this show to daily so they don't get orphaned
  memory.expenses.forEach(e=>{ if(e.show_id===req.params.id){ e.show_id=null; e.is_daily=true; } });
  saveTo(SHOWS_PATH, memory.shows);
  saveTo(PARTICIPANTS_PATH, memory.showParticipants);
  saveTo(COSTS_PATH, memory.showCosts);
  saveTo(EXPENSES_PATH, memory.expenses);
  audit(req,'delete','show',req.params.id,{});
  res.json({ ok:true });
});

// Show participants
app.get('/api/shows/:id/participants', (req,res)=>{
  const list = memory.showParticipants.filter(p=>p.show_id===req.params.id).map(p=>({ ...p, user: memory.users.find(u=>u.id===p.user_id) }));
  res.json(list);
});
app.post('/api/shows/:id/participants', (req,res)=>{
  const { user_id, airline, flight_conf, hotel_conf, car_conf } = req.body||{}; if(!user_id) return res.status(400).json({error:'user_id required'});
  const exists = memory.showParticipants.find(p=>p.show_id===req.params.id && p.user_id===user_id);
  if(!exists){ memory.showParticipants.push({ show_id: req.params.id, user_id, airline, flight_conf, hotel_conf, car_conf }); saveTo(PARTICIPANTS_PATH, memory.showParticipants); audit(req,'add','participant',`${req.params.id}:${user_id}`,{}); }
  res.json({ ok:true });
});
app.delete('/api/shows/:id/participants/:uid', (req,res)=>{
  memory.showParticipants = memory.showParticipants.filter(p=>!(p.show_id===req.params.id && p.user_id===req.params.uid));
  saveTo(PARTICIPANTS_PATH, memory.showParticipants);
  audit(req,'remove','participant',`${req.params.id}:${req.params.uid}`,{});
  res.json({ ok:true });
});
app.patch('/api/shows/:id/participants/:uid', (req,res)=>{
  const p = memory.showParticipants.find(x=>x.show_id===req.params.id && x.user_id===req.params.uid);
  if(!p) return res.status(404).json({ error:'not found' });
  const { airline, flight_conf, hotel_conf, car_conf, hotel_name, hotel_address, car_company, car_pickup_address, refresh_flight, flight_info } = req.body||{};
  if(airline!==undefined) p.airline = airline;
  if(flight_conf!==undefined) p.flight_conf = flight_conf;
  if(hotel_conf!==undefined) p.hotel_conf = hotel_conf;
  if(car_conf!==undefined) p.car_conf = car_conf;
  if(hotel_name!==undefined) p.hotel_name = hotel_name;
  if(hotel_address!==undefined) p.hotel_address = hotel_address;
  if(car_company!==undefined) p.car_company = car_company;
  if(car_pickup_address!==undefined) p.car_pickup_address = car_pickup_address;
  if(refresh_flight && p.airline && p.flight_conf){
    // Placeholder until real flight API hooked up
    p.flight_info = { airline: p.airline, confirmation: p.flight_conf, pending: true };
  }
  if(flight_info!==undefined) p.flight_info = flight_info;
  saveTo(PARTICIPANTS_PATH, memory.showParticipants);
  res.json(p);
});

// Flight details lookup (stub). Replace with FlightAware/Amadeus later.
async function lookupFlight({ airline, flight_number, depart_date }){
  const out = { airline, flight_number, depart_date, segments: [] };
  try {
    const iata = (airline||'').slice(0,2).toUpperCase();
    const num = String(flight_number||'').replace(/\D/g,'');
    const date = (depart_date||'').slice(0,10);
    if(process.env.AVIATIONSTACK_KEY){
      const url = `http://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATIONSTACK_KEY}&airline_iata=${encodeURIComponent(iata)}&flight_number=${encodeURIComponent(num)}&flight_date=${encodeURIComponent(date)}`;
      const r = await fetch(url);
      const j = await r.json();
      const d = (j && j.data && j.data[0]) || null;
      if(d){
        out.segments.push({ from: d.departure?.iata || d.departure?.icao || '', to: d.arrival?.iata || d.arrival?.icao || '', depart_iso: d.departure?.scheduled || d.departure?.estimated || '', arrive_iso: d.arrival?.scheduled || d.arrival?.estimated || '', flight_number: `${iata}${num}` });
        return out;
      }
    }
    if(process.env.AERODATABOX_RAPIDAPI_KEY){
      const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(iata+num)}/${encodeURIComponent(date)}`;
      const r = await fetch(url, { headers: { 'X-RapidAPI-Key': process.env.AERODATABOX_RAPIDAPI_KEY, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' } });
      const j = await r.json();
      const d = (Array.isArray(j) && j[0]) || null;
      if(d){
        out.segments.push({ from: d.departure?.airport?.iata || '', to: d.arrival?.airport?.iata || '', depart_iso: d.departure?.scheduledTimeUtc || '', arrive_iso: d.arrival?.scheduledTimeUtc || '', flight_number: `${iata}${num}` });
        return out;
      }
    }
  } catch (e) {
    console.error('Flight lookup failed', e);
  }
  return out;
}

app.post('/api/flight/lookup', async (req,res)=>{
  const { airline, flight_number, depart_date } = req.body||{};
  if(!airline || !flight_number || !depart_date) return res.status(400).json({ error:'airline, flight_number and depart_date required' });
  const info = await lookupFlight({ airline, flight_number, depart_date });
  res.json(info);
});

// Files (simple in-memory store)
app.post('/api/files', (req,res)=>{
  const { data, content_type } = req.body||{};
  if(!data) return res.status(400).json({ error:'data required (base64)' });
  const id = `f-${Date.now()}`;
  const b64 = String(data);
  const cleaned = b64.replace(/^data:[^,]+,/, '');
  const buf = Buffer.from(cleaned, 'base64');
  const ext = (content_type||'').includes('png')? '.png' : (content_type||'').includes('pdf')? '.pdf' : '.jpg';
  const filePath = path.join(DATA_DIR, id + ext);
  fs.writeFileSync(filePath, buf);
  res.json({ id: id+ext, url: `/files/${id+ext}` });
});

// Show costs
app.get('/api/shows/:id/costs', (req,res)=>{
  res.json(memory.showCosts.filter(c=>c.show_id===req.params.id));
});
app.post('/api/shows/:id/costs', (req,res)=>{
  const { type, description, amount, file_id } = req.body||{};
  const item = { id:`c-${Date.now()}`, show_id: req.params.id, type, description, amount, file_id };
  memory.showCosts.push(item);
  // Mirror this cost as an expense so it appears in Accounting immediately
  const created_by = String(req.header('x-user-email')||'').toLowerCase() || null;
  const expense = {
    id: `e-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    show_id: req.params.id,
    is_daily: false,
    merchant: (type||'Show Cost'),
    date: new Date().toISOString().slice(0,10),
    time: new Date().toISOString().slice(11,16),
    subtotal: amount,
    tax: 0,
    tip: 0,
    total: amount,
    category: 'show_cost',
    notes: description||'',
    file_id,
    status: 'unassigned',
    org_label: null,
    pushed: false,
    last4: null,
    created_by,
    cost_id: item.id,
  };
  memory.expenses.push(expense);
  saveTo(COSTS_PATH, memory.showCosts);
  saveTo(EXPENSES_PATH, memory.expenses);
  audit(req,'create','show_cost',item.id,{ show_id: req.params.id, amount });
  res.json(item);
});
app.delete('/api/shows/:id/costs/:cid', (req,res)=>{
  const cid = req.params.cid;
  memory.showCosts = memory.showCosts.filter(c=>!(c.show_id===req.params.id && c.id===cid));
  // Remove mirrored expense(s)
  memory.expenses = memory.expenses.filter(e=> e.cost_id !== cid);
  saveTo(COSTS_PATH, memory.showCosts); 
  saveTo(EXPENSES_PATH, memory.expenses);
  audit(req,'delete','show_cost',cid,{});
  res.json({ ok:true });
});

// Expenses
app.post('/api/expenses', (req, res) => {
  const { show_id, merchant, date, time, subtotal, tax, tip, total, category, notes, file_id, is_daily, last4 } = req.body || {};
  if(!is_daily && !show_id) return res.status(400).json({ error:'show_id required unless is_daily' });
  // Block submissions to closed shows at the API layer
  if(!is_daily && show_id){
    const s = memory.shows.find(x=>x.id===show_id);
    if(s && s.closed){
      return res.status(403).json({ error: 'submissions closed for this show' });
    }
  }
  let org_label = null;
  const last4clean = (last4||'').toString().replace(/\D/g,'').slice(-4);
  if(last4clean && memory.cardMap[last4clean]) org_label = memory.cardMap[last4clean];
  const created_by = actorFrom(req);
  const e = { id: `e-${Date.now()}`, show_id: is_daily? null: show_id, is_daily: !!is_daily, merchant, date, time, subtotal, tax, tip, total, category, notes, file_id, status: org_label? 'assigned':'unassigned', org_label, pushed: false, last4: last4clean||null, created_by };
  memory.expenses.push(e); audit(req,'create','expense',e.id,{ show_id, is_daily, total });
  saveTo(EXPENSES_PATH, memory.expenses);
  res.json(e);
});
app.get('/api/expenses', (req, res) => {
  const { show_id, daily, orphaned } = req.query;
  let list = memory.expenses;
  if(String(orphaned)==='1'){
    const valid = new Set(memory.shows.map(s=>s.id));
    list = list.filter(x=> x.show_id && !valid.has(x.show_id));
  } else if(String(daily)==='1') list = list.filter(x=>x.is_daily);
  else if(show_id) list = list.filter(x => x.show_id === show_id);
  res.json(list);
});
app.delete('/api/expenses/:id', (req,res)=>{
  memory.expenses = memory.expenses.filter(e=>e.id!==req.params.id);
  saveTo(EXPENSES_PATH, memory.expenses);
  res.json({ ok:true });
});
app.patch('/api/expenses/:id', (req,res)=>{
  const e = memory.expenses.find(x=>x.id===req.params.id); if(!e) return res.status(404).json({error:'not found'});
  const { merchant, date, time, subtotal, tax, tip, total, category, notes, status, org_label, pushed } = req.body||{};
  if(merchant!==undefined) e.merchant=merchant;
  if(date!==undefined) e.date=date;
  if(time!==undefined) e.time=time;
  if(subtotal!==undefined) e.subtotal=subtotal;
  if(tax!==undefined) e.tax=tax;
  if(tip!==undefined) e.tip=tip;
  if(total!==undefined) e.total=total;
  if(category!==undefined) e.category=category;
  if(notes!==undefined) e.notes=notes;
  if(status!==undefined) e.status=status;
  if(org_label!==undefined) e.org_label=org_label;
  if(pushed!==undefined) e.pushed = pushed;
  saveTo(EXPENSES_PATH, memory.expenses); audit(req,'update','expense',e.id,{ status, org_label, pushed }); res.json(e);
});

// Assign expense to an org (drag-drop)
app.post('/api/expenses/:id/assign', (req,res)=>{
  const e = memory.expenses.find(x=>x.id===req.params.id); if(!e) return res.status(404).json({error:'not found'});
  const { org_label } = req.body||{};
  e.org_label = org_label || null;
  e.status = org_label? 'assigned': 'unassigned';
  saveTo(EXPENSES_PATH, memory.expenses); res.json(e);
});

// Push selected expenses (stub for Zoho integration)
app.post('/api/expenses/push', (req,res)=>{
  const { ids, org_label } = req.body||{};
  const targeted = memory.expenses.filter(e=> (!ids || ids.includes(e.id)) && (org_label? e.org_label===org_label: true));
  targeted.forEach(e=>{ e.pushed = true; e.pushed_at = new Date().toISOString(); });
  saveTo(EXPENSES_PATH, memory.expenses); audit(req,'push','expense_batch','-',{ count: targeted.length, org_label }); res.json({ ok:true, count: targeted.length });
});

// Card mapping
app.get('/api/cardmap', (_req,res)=>{ res.json(memory.cardMap); });
app.post('/api/cardmap', (req,res)=>{
  const { last4, org_label } = req.body||{};
  const k = String(last4||'').replace(/\D/g,'').slice(-4);
  if(!k) return res.status(400).json({ error:'last4 required' });
  if(!org_label) delete memory.cardMap[k]; else memory.cardMap[k] = org_label;
  saveTo(CARDMAP_PATH, memory.cardMap);
  audit(req, org_label? 'map_card':'unmap_card', 'card', k, { org_label });
  res.json({ ok:true, map: memory.cardMap });
});

// Audit log fetch
app.get('/api/admin/audit', (req,res)=>{
  const limit = parseInt(String(req.query.limit||'200')); res.json(memory.audit.slice(-limit).reverse());
});

// Admin data reconciliation: demote orphaned show expenses to daily
app.post('/api/admin/reconcile', (req,res)=>{
  const validShowIds = new Set(memory.shows.map(s=>s.id));
  let fixed = 0;
  for(const e of memory.expenses){
    if(e.show_id && !validShowIds.has(e.show_id)){
      e.show_id = null; e.is_daily = true; fixed++;
    }
  }
  if(fixed>0) saveTo(EXPENSES_PATH, memory.expenses);
  res.json({ ok:true, fixed });
});

// Feedback tickets
app.get('/api/feedback', (req,res)=>{
  // If non-admin, only show own tickets
  const actor = actorFrom(req);
  const me = memory.users.find(u=> (actor && (u.email===actor || u.username===actor)));
  const isAdmin = me && me.role==='admin';
  const list = isAdmin? memory.feedback: memory.feedback.filter(f=>f.created_by===actor);
  res.json(list);
});
app.post('/api/feedback', (req,res)=>{
  const created_by = actorFrom(req);
  const { note, file_data, content_type } = req.body||{};
  if(!note || String(note).trim()==='') return res.status(400).json({ error:'note required' });
  let file_id = null;
  if(file_data){
    try {
      const id = `fb-${Date.now()}`;
      const b64 = String(file_data).replace(/^data:[^,]+,/, '');
      const buf = Buffer.from(b64,'base64');
      const ext = (content_type||'').includes('png')? '.png' : (content_type||'').includes('pdf')? '.pdf' : '.jpg';
      const filePath = path.join(DATA_DIR, id + ext);
      fs.writeFileSync(filePath, buf);
      file_id = id + ext;
    } catch {}
  }
  const item = { id:`t-${Date.now()}`, note:String(note), file_id, created_by, created_at: Date.now(), status:'open' };
  memory.feedback.push(item);
  saveTo(FEEDBACK_PATH, memory.feedback);
  audit(req,'create','feedback',item.id,{});
  res.json(item);
});
app.patch('/api/feedback/:id', (req,res)=>{
  const f = memory.feedback.find(x=>x.id===req.params.id); if(!f) return res.status(404).json({error:'not found'});
  const { status } = req.body||{};
  if(status) f.status = status;
  saveTo(FEEDBACK_PATH, memory.feedback);
  audit(req,'update','feedback',f.id,{ status: f.status });
  res.json(f);
});

// Reports per show
app.get('/api/reports/show/:id', (req,res)=>{
  const showId = req.params.id;
  const expenses = memory.expenses.filter(e=>e.show_id===showId);
  const costs = memory.showCosts.filter(c=>c.show_id===showId);
  const parseNum = (v)=>{ const n = parseFloat(v||0); return Number.isFinite(n)? n: 0; };
  const totalExpenses = expenses.reduce((a,e)=> a + parseNum(e.total), 0);
  const totalCosts = costs.reduce((a,c)=> a + parseNum(c.amount), 0);
  const overall = +(totalExpenses + totalCosts).toFixed(2);
  const byOrg = {};
  for(const e of expenses){ const k=e.org_label||'Unassigned'; byOrg[k]=(byOrg[k]||0)+parseNum(e.total); }
  const byCategory = {};
  for(const e of expenses){ const k=e.category||'Uncategorized'; byCategory[k]=(byCategory[k]||0)+parseNum(e.total); }
  const response = { show_id: showId, overall, total_expenses:+totalExpenses.toFixed(2), total_show_costs:+totalCosts.toFixed(2), by_org: byOrg, by_category: byCategory, counts: { expenses: expenses.length, costs: costs.length } };
  res.json(response);
});

// WhatsApp invite (Cloud API)
app.post('/api/shows/:id/whatsapp/invite', async (req,res)=>{
  const s = memory.shows.find(x=>x.id===req.params.id); if(!s) return res.status(404).json({error:'not found'});
  const token = process.env.WHATSAPP_TOKEN; const phoneId = process.env.WHATSAPP_PHONE_ID;
  const link = req.body?.invite_link || s.whatsapp_invite_link || '';
  const part = memory.showParticipants.filter(p=>p.show_id===s.id);
  const users = part.map(p=> memory.users.find(u=>u.id===p.user_id)).filter(Boolean);
  if(!(token && phoneId)) return res.status(400).json({ error:'whatsapp not configured', recipients: users.map(u=>u.phone_e164).filter(Boolean) });
  const sent = []; const failed = [];
  for(const u of users){ const to = u.phone_e164; if(!to) continue; try {
      const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, { method:'POST', headers:{ 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type:'text', text:{ preview_url: true, body: `WhatsApp group for ${s.name}${link?`\nJoin: ${link}`:''}` } }) });
      const jr = await resp.json(); if(resp.ok) sent.push({ to, id: jr.messages?.[0]?.id}); else failed.push({ to, error: jr.error||jr });
    } catch (e){ failed.push({ to, error: String(e) }); }
  }
  res.json({ ok:true, sent, failed });
});

app.listen(4000, () => console.log('API on :4000'));

