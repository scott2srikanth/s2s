import {secureCookie} from "../../../api-security";
export async function POST(req:Request){const res=Response.json({ok:true});res.headers.append("Set-Cookie",`s2s_presenter=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req)}`);return res}
