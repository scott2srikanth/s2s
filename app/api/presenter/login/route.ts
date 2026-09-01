import {AuthConfigurationError,createPresenterSession,validatePresenterCredentials} from "../../../password-auth";
import {clientAddress,contentLengthTooLarge,rateLimit,rateLimitStatus,secureCookie,tooManyRequests} from "../../../api-security";

export async function POST(req:Request){
  try{
    if(contentLengthTooLarge(req,8192))return Response.json({error:"Invalid request"},{status:413});
    let body:{username?:string;password?:string};try{body=await req.json()}catch{return Response.json({error:"Invalid request"},{status:400})}
    const username=(body.username||"").slice(0,128),key=`presenter:${clientAddress(req)}:${username.toLowerCase()}`,limit=rateLimitStatus(key,8);
    if(!limit.allowed)return tooManyRequests(limit.retryAfter);
    if(!username||!body.password||body.password.length>512||!await validatePresenterCredentials(username,body.password)){rateLimit(key,8,15*60_000);return Response.json({error:"Incorrect presenter username or password"},{status:401})}
    const res=Response.json({ok:true});res.headers.append("Set-Cookie",`s2s_presenter=${await createPresenterSession(username)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureCookie(req)}`);return res;
  }catch(error){return Response.json({error:error instanceof AuthConfigurationError?"Presenter access is not configured":"Presenter session could not be created"},{status:500})}
}
