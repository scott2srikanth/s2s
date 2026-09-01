import {env} from "cloudflare:workers";
import {ensureStudioSchema} from "../../../../db";
import {getPresenterUser} from "../../../password-auth";
type Row={id:string;title:string;slides_json:string;updated_at:number};
export async function GET(){if(!await getPresenterUser())return Response.json({error:"Unauthorized"},{status:401});await ensureStudioSchema();const result=await env.DB.prepare(`SELECT p.id,p.title,p.slides_json,p.updated_at FROM presentations p INNER JOIN presentation_assignments a ON a.presentation_id=p.id AND a.user_id=p.user_id WHERE a.enabled=1 ORDER BY a.updated_at DESC`).all<Row>();return Response.json({decks:result.results.map(row=>({id:row.id,title:row.title,slides:JSON.parse(row.slides_json),updatedAt:row.updated_at}))})}
