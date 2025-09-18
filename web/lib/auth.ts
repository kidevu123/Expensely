"use client";

export type Role = 'admin'|'coordinator'|'accountant'|'attendee';
export type User = { id:string; email?:string; username?:string; name:string; role: Role; avatar_url?:string };

const KEY = 'expensely:user';

export function getUser(): User|null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(KEY); return raw? JSON.parse(raw): null; } catch { return null; }
}
export function setUser(u:User){ if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(u)); }
export function clearUser(){ if (typeof window !== 'undefined') localStorage.removeItem(KEY); }

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}){
  const u = getUser();
  const headers = new Headers(init.headers || {});
  if(u?.email) headers.set('x-user-email', u.email);
  if(u?.username) headers.set('x-user-username', u.username);
  return fetch(input, { ...init, headers });
}

