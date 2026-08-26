import {secureCookie} from "../../../api-security";
export async function POST(req:Request){const secure=secureCookie(req),res=Response.json({ok:true});res.headers.append("Set-Cookie",`s2s_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);res.headers.append("Set-Cookie",`s2s_2fa=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);return res}
