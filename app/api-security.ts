const attempts = new Map<string, {count:number; resetAt:number}>();

export function clientAddress(request:Request){
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function rateLimit(key:string, limit:number, windowMs:number){
  const now=Date.now(), current=attempts.get(key);
  if(attempts.size>5_000)for(const [entry,value] of attempts)if(value.resetAt<=now)attempts.delete(entry);
  if(attempts.size>10_000)attempts.clear();
  if(!current||current.resetAt<=now){attempts.set(key,{count:1,resetAt:now+windowMs});return {allowed:true,retryAfter:0}}
  if(current.count>=limit)return {allowed:false,retryAfter:Math.max(1,Math.ceil((current.resetAt-now)/1000))};
  current.count+=1;
  return {allowed:true,retryAfter:0};
}

export function rateLimitStatus(key:string,limit:number){
  const current=attempts.get(key),now=Date.now();
  if(!current||current.resetAt<=now)return {allowed:true,retryAfter:0};
  return current.count<limit?{allowed:true,retryAfter:0}:{allowed:false,retryAfter:Math.max(1,Math.ceil((current.resetAt-now)/1000))};
}

export function clearRateLimit(key:string){attempts.delete(key)}

export function tooManyRequests(retryAfter:number){
  return Response.json({error:"Too many attempts. Please wait and try again."},{status:429,headers:{"Retry-After":String(retryAfter)}});
}

export function secureCookie(request:Request){
  const forwarded=request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwarded==="https"||request.url.toLowerCase().startsWith("https://")?"; Secure":"";
}

export function contentLengthTooLarge(request:Request,maxBytes:number){
  const value=request.headers.get("content-length");
  if(!value)return false;
  const length=Number(value);
  return !Number.isFinite(length)||length<0||length>maxBytes;
}
