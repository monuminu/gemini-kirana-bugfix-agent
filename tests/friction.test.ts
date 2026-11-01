import {it,expect} from 'vitest';
import {exportFriction} from '../src/server/friction.js';
const row={id:'1',timestamp:'2026-11-01T12:00:00+05:30',kind:'observed' as const,stage:'Export',title:'SDK version missing',reproduction:'npm install',expected:'Package installs',actual:'ETARGET, missing version',workaround:'Published release',severity:'P2' as const,frequency:'once',time_lost_minutes:4,product_recommendation:'Version published guidance',evidence_ids:[]};
it('exports CSV that escapes actual error details and spreadsheet formulas',()=>{const csv=exportFriction([{...row,title:'=HYPERLINK("x")'}],'csv');expect(csv).toContain('"\'=HYPERLINK');expect(csv).toContain('"ETARGET, missing version"');});
it('labels observed and untested entries instead of inventing results',()=>{const md=exportFriction([row,{...row,id:'2',kind:'not_tested'}],'md');expect(md).toContain('observed');expect(md).toContain('not_tested');expect(md).toContain('Asia/Kolkata');});
