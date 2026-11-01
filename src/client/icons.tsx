import type { CSSProperties } from 'react';

export type IconName = 'shop'|'mic'|'micOff'|'screen'|'camera'|'close'|'arrow'|'external'|'message'|'clipboard'|'check'|'headphones'|'stop'|'pause'|'play'|'leaf'|'settings'|'note'|'image'|'tools'|'shield'|'spinner';
const paths: Record<IconName,string> = {
  shop:'M3 10h18M4 10v11h16V10M2 4h20l-2 6H4L2 4Zm7 17v-7h6v7M6 14h1',
  mic:'M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3Zm-7-4v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8',
  micOff:'m2 2 20 20M9 9v3a3 3 0 0 0 5.1 2.1M15 10V5a3 3 0 0 0-5.8-1M5 11v1a7 7 0 0 0 11.9 5M19 11v1a7 7 0 0 1-.5 2.6M12 19v3M8 22h8',
  screen:'M3 4h18v13H3V4Zm9 13v4M8 21h8',
  camera:'M14 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm2 5 5-3v10l-5-3',
  close:'m6 6 12 12M18 6 6 18',
  arrow:'M4 12h16m-6-6 6 6-6 6',
  external:'M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6',
  message:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0ZM7 10h10M7 14h7',
  clipboard:'M9 4H5a1 1 0 0 0-1 1v16h16V5a1 1 0 0 0-1-1h-4M9 2h6v4H9V2Zm-1 9h8M8 15h8',
  check:'m5 12 4 4L19 6',
  headphones:'M3 14v-2a9 9 0 0 1 18 0v2M3 13h4v8H3v-8Zm14 0h4v8h-4v-8Z',
  stop:'M6 6h12v12H6V6Z',
  pause:'M7 4h3v16H7V4Zm7 0h3v16h-3V4Z',
  play:'m7 3 14 9-14 9V3Z',
  leaf:'M20 3s1 10-5 15C7 23 2 13 8 8c3-3 8-2 12-5ZM5 20 16 9',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-6h4l1 4 3-2 3 3-2 3 3 1v3l-3 1 2 3-3 3-3-2-1 3h-4l-1-3-3 2-3-3 2-3-3-1v-3l3-1-2-3 3-3 3 2 1-4Z',
  note:'M4 3h16v18H4V3Zm4 5h8M8 12h8M8 16h5',
  image:'M3 3h18v18H3V3Zm0 14 6-6 5 5 3-3 4 4M15 7h.01',
  tools:'M14 5a6 6 0 0 0-7 7L3 16a3 3 0 0 0 4 4l4-4a6 6 0 0 0 8-7l-4 4-4-4 3-4Z',
  shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 9 3 3 5-5',
  spinner:'M21 12a9 9 0 1 1-9-9',
};
export function Icon({name,size=18,style}:{name:IconName;size?:number;style?:CSSProperties}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]}/></svg>;
}

export function AppIllustration() {
  return <svg width="122" height="74" viewBox="0 0 122 74" fill="none" aria-hidden="true"><rect x="16" y="12" width="91" height="51" rx="5" fill="#fffdf6" stroke="#b9c8ac"/><rect x="22" y="19" width="80" height="6" rx="2" fill="#e5ebdc"/><rect x="22" y="30" width="21" height="25" rx="2" fill="#eef2e7"/><path d="M29 37h7m-7 5h9m-9 5h5" stroke="#c1cfb4" strokeLinecap="round"/><rect x="49" y="31" width="23" height="9" rx="2" fill="#f3e7cc"/><rect x="77" y="31" width="23" height="9" rx="2" fill="#e5ecd9"/><path d="M49 46h51M49 51h41" stroke="#d3ddc8" strokeLinecap="round"/><path d="M9 66h105" stroke="#c4d1b8" strokeLinecap="round"/><circle cx="104" cy="14" r="10" fill="#dfebd4" stroke="#b4c9a4"/><path d="m100 14 3 3 5-6" stroke="#7e9b68" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
