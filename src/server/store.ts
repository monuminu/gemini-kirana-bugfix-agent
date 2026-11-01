import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {Session,TranscriptTurn,BugBrief,FixJob,Evidence,FrictionEntry,EventTiming} from '../shared/types.js';
export class Store {
 readonly db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL DEFAULT '',value TEXT NOT NULL,PRIMARY KEY(kind,id));`);}
 private put(kind:string,id:string,owner:string,value:unknown){this.db.prepare('INSERT OR REPLACE INTO records(kind,id,owner,value) VALUES(?,?,?,?)').run(kind,id,owner,JSON.stringify(value));}
 private get<T>(kind:string,id:string):T|undefined{const r=this.db.prepare('SELECT value FROM records WHERE kind=? AND id=?').get(kind,id) as {value:string}|undefined;return r?JSON.parse(r.value):undefined;}
 private list<T>(kind:string,owner?:string):T[]{const rows=owner===undefined?this.db.prepare('SELECT value FROM records WHERE kind=? ORDER BY rowid').all(kind):this.db.prepare('SELECT value FROM records WHERE kind=? AND owner=? ORDER BY rowid').all(kind,owner);return rows.map(r=>JSON.parse(r.value as string));}
 createSession():Session & {csrf_token:string}{const token=randomBytes(32).toString('hex');const s:Session={id:randomUUID(),csrf_hash:createHash('sha256').update(token).digest('hex'),created_at:new Date().toISOString(),version:0};this.put('session',s.id,'',s);return{...s,csrf_token:token};}
 resumeSession(id:string){const s=this.getSession(id);if(!s)throw new Error('सत्र नहीं मिला');const token=randomBytes(32).toString('hex');this.updateSession(id,{csrf_hash:createHash('sha256').update(token).digest('hex'),csrf_previous_hashes:[...(s.csrf_previous_hashes??[]),s.csrf_hash].slice(-63)});return{...s,csrf_token:token};}
 getSession(id:string){return this.get<Session>('session',id);}
 updateSession(id:string,patch:Partial<Session>){const s=this.getSession(id);if(!s)throw new Error('सत्र नहीं मिला');this.put('session',id,'',{...s,...patch});}
 addTurn(sessionId:string,turn:Omit<TranscriptTurn,'created_at'>){if(!this.getSession(sessionId))throw new Error('सत्र नहीं मिला');const old=this.get<TranscriptTurn>('turn',sessionId+':'+turn.id);if(old&&(old.role!==turn.role||old.sequence!==turn.sequence||(old.finalized&&old.text!==turn.text)))throw new Error('पूरा हो चुका कथन बदला नहीं जा सकता।');this.put('turn',sessionId+':'+turn.id,sessionId,{...turn,finalized:old?.finalized||turn.finalized,created_at:old?.created_at??new Date().toISOString()});}
 turns(sessionId:string){return this.list<TranscriptTurn>('turn',sessionId).sort((a,b)=>a.sequence-b.sequence);}
 saveReport(b:BugBrief){this.put('report',b.id,b.session_id,b);}
 getReport(id:string){return this.get<BugBrief>('report',id);}
 saveJob(j:FixJob){const previous=this.getJob(j.id);this.put('job',j.id,j.session_id,j);if(!previous||previous.stage!==j.stage||previous.status!==j.status)this.recordTiming({owner:j.session_id,kind:'job',job_id:j.id,stage:j.stage,status:j.status,attempt:j.attempt});}
 getJob(id:string){return this.get<FixJob>('job',id);}
 listJobs(){return this.list<FixJob>('job');}
 updateJob(id:string,p:Partial<FixJob>){const j=this.getJob(id);if(!j)throw new Error('काम नहीं मिला');const next={...j,...p,updated_at:new Date().toISOString()};this.saveJob(next);return next;}
 addEvidence(e:Evidence){this.put('evidence',e.id,e.session_id,e);}
 evidence(sessionId:string){return this.list<Evidence>('evidence',sessionId);}
 addFriction(f:FrictionEntry){this.put('friction',f.id,'',f);}
 friction(){return this.list<FrictionEntry>('friction');}
 recordTiming(t:Omit<EventTiming,'id'|'timestamp'>){const event:EventTiming={...t,id:randomUUID(),timestamp:new Date().toISOString()};this.put('timing',event.id,event.owner,event);}
 timings(owner?:string){return this.list<EventTiming>('timing',owner);}
 close(){this.db.close();}
}
