import {AuthConfigurationError,createSession,validateCredentials} from "../../../password-auth";
import {clearRateLimit,clientAddress,contentLengthTooLarge,rateLimit,rateLimitStatus,secureCookie,tooManyRequests} from "../../../api-security";
export async function POST(req:Request){
 try{
 if(contentLengthTooLarge(req,8_192))return Response.json({error:"Invalid request"},{status:413});
 let credentials:{username?:string;password?:string};try{credentials=await req.json()}catch{return Response.json({error:"Invalid request"},{status:400})}
 const username=(credentials.username||"").slice(0,128),key=`login:${clientAddress(req)}:${username.toLowerCase()}`,limit=rateLimitStatus(key,5);
 if(!limit.allowed)return tooManyRequests(limit.retryAfter);
 if(!username||!credentials.password||credentials.password.length>512||!await validateCredentials(username,credentials.password)){rateLimit(key,5,15*60_000);return Response.json({error:"Incorrect username or password"},{status:401})}
 clearRateLimit(key);const secure=secureCookie(req),res=Response.json({ok:true});res.headers.append("Set-Cookie",`s2s_session=${await createSession(username)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);res.headers.append("Set-Cookie",`s2s_2fa=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);return res
 }catch(error){console.error("Password login failed",error);return Response.json({error:error instanceof AuthConfigurationError?"Cloudflare authentication secrets are missing or AUTH_SESSION_SECRET is shorter than 32 characters.":"Authentication session could not be created.",code:error instanceof AuthConfigurationError?"AUTH_BINDINGS_MISSING":"AUTH_SESSION_FAILED"},{status:500})}
}
