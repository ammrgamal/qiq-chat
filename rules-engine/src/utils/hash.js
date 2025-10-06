// Simple stable hash (FNV-1a like) for enrichment idempotency
export function stableHash(obj){
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj, Object.keys(obj).sort());
  let h = 2166136261 >>> 0;
  for (let i=0;i<json.length;i++){
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ('0000000'+(h>>>0).toString(16)).slice(-8);
}

export function productHash(product){
  const base = {
    pn: product.partNumber||product.PartNumber||'',
    name: product.name||product.ProductName||'',
    m: product.manufacturer||product.Manufacturer||'',
    desc: (product.description||product.LongDescription||'').slice(0,1000)
  };
  return stableHash(base);
}
