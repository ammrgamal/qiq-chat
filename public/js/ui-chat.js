// /public/js/api.js
export async function apiSearch(query, hitsPerPage=8){
  const r = await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query, hitsPerPage})});
  const j = await r.json();
  if(!r.ok) throw new Error(j?.error || 'search failed');
  return j.hits || [];
}
export async function apiQuote(payload){
  const r = await fetch('/api/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const j = await r.json();
  if(!r.ok) throw new Error(j?.error || 'quote failed');
  return j;
}
export async function apiRegister(payload){
  const r = await fetch('/api/users/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const j = await r.json();
  if(!r.ok) throw new Error(j?.error || 'register failed');
  return j;
}
export async function apiLogin(payload){
  const r = await fetch('/api/users/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const j = await r.json();
  if(!r.ok) throw new Error(j?.error || 'login failed');
  return j;
}
export async function apiLogout(){
  const r = await fetch('/api/users/logout',{method:'POST'});
  return r.ok;
}
export async function apiMe(){
  const r = await fetch('/api/users/me');
  const j = await r.json().catch(()=>({}));
  return j?.ok ? j.user : null;
}
