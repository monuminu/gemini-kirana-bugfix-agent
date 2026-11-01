import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../src/server/store.js';
import {exportFriction} from '../src/server/friction.js';
const store=new Store(path.resolve('work/state.sqlite'));
try{const destination=path.resolve(process.argv[2]||'work');for(const format of ['md','csv'] as const)await writeFile(path.join(destination,`friction-log.${format}`),exportFriction(store.friction(),format));console.log(`Exported ${store.friction().length} local friction entries.`);}finally{store.close();}
