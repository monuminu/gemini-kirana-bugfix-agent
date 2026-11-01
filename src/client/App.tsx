import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, AppIllustration } from './icons.js';
import { LiveConsole, initialSnapshot, type ConsoleSnapshot } from './live-console.js';
import './styles.css';

const SAMPLE = '20 किलो चावल में से 7 किलो बेचा, लेकिन ऐप में स्टॉक कम होने के बजाय बढ़ गया। इसे ठीक कर दीजिए।';
const CONNECTION_LABELS = { idle:'अभी जुड़े नहीं', connecting:'जुड़ रहे हैं', connected:'जुड़े हुए हैं', reconnecting:'फिर जुड़ रहे हैं', error:'जुड़ नहीं पाए' };
const TERMINAL = new Set(['completed','failed','cancelled','needs_attention']);

export default function App() {
  const [snapshot,setSnapshot] = useState<ConsoleSnapshot>(initialSnapshot);
  const [text,setText] = useState('');
  const [developerOpen,setDeveloperOpen] = useState(false);
  const [frictionOpen,setFrictionOpen] = useState(false);
  const closeFriction=useCallback(()=>setFrictionOpen(false),[]);
  const [showScreenGuide,setShowScreenGuide] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const controller = useRef<LiveConsole | null>(null);
  useEffect(() => {
    const live = new LiveConsole(setSnapshot);
    controller.current = live;
    void live.initialize();
    return () => { live.destroy(); controller.current = null; };
  },[]);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({block:'nearest'}); },[snapshot.turns]);
  const connected = snapshot.connection === 'connected';
  const busy = snapshot.connection === 'connecting' || snapshot.connection === 'reconnecting';
  const activeJob = !!snapshot.job && !TERMINAL.has(snapshot.job.status);
  const speakState = snapshot.speaking ? 'किराना साथी बोल रहा है…' : connected && snapshot.microphone === 'listening' ? 'बताइए, क्या परेशानी है?' : connected ? 'बात चालू है, माइक रुका है' : busy ? 'एक पल, हम जुड़ रहे हैं…' : 'मैं आपकी बात सुनने के लिए तैयार हूँ';
  const sendText = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !connected) return;
    await controller.current?.sendText(value);
    setText('');
  };
  return <>
    <header className="site-header"><div className="shell header-inner">
      <a className="brand" href="/" aria-label="किराना साथी ऐप सहायता"><span className="brand-icon"><Icon name="shop" size={25}/></span><div><div className="brand-title">किराना साथी</div><div className="brand-subtitle">आपकी दुकान, आपकी आवाज़</div></div></a>
      <div className="header-actions"><span className="language-pill">हिंदी में बात करें</span><a className="inventory-link" href={snapshot.config?.demoUrl || 'http://127.0.0.1:4301'} target="_blank" rel="noreferrer">दुकान का ऐप खोलें <Icon name="external" size={14}/></a></div>
    </div></header>
    <main className="shell">
      <section className="intro"><div><div className="eyebrow">अपनी भाषा में, आसानी से</div><h1>ऐप सहायता</h1><p>दुकान के ऐप में कुछ ठीक नहीं चल रहा? बोलकर बताइए। हम आपकी बात समझकर<br className="desktop-break"/> सुधार की रिपोर्ट तैयार करेंगे, फिर आपकी अनुमति से काम शुरू होगा।</p></div><div className="intro-seal"><Icon name="leaf" size={31}/></div></section>
      <div className="journey" aria-label="सहायता के तीन कदम">
        <div className={`journey-step ${!snapshot.report ? 'active':''}`}><span className="step-number">1</span>समस्या बताइए</div><span className="step-line"/>
        <div className={`journey-step ${snapshot.report && !snapshot.job ? 'active':''}`}><span className="step-number">2</span>बात जाँचिए</div><span className="step-line"/>
        <div className={`journey-step ${snapshot.job ? 'active':''}`}><span className="step-number">3</span>सुधार देखिए</div>
      </div>
      <div className="workspace-grid">
        <section className="card voice-card" aria-labelledby="voice-heading">
          <div className="card-top"><h2 className="section-title" id="voice-heading"><Icon name="mic" size={17}/>बात करके बताइए</h2><span className={`status-pill ${snapshot.connection}`} role="status"><span className="status-dot"/>{CONNECTION_LABELS[snapshot.connection]}</span></div>
          <div className="voice-center">
            <div className={`voice-orb-wrap ${connected && snapshot.microphone === 'listening' ? 'listening':''} ${snapshot.speaking ? 'speaking':''}`}><div className="voice-orb"><Icon name={snapshot.microphone === 'paused' ? 'micOff':'mic'} size={30}/></div></div>
            <h3 className="voice-state" aria-live="polite">{speakState}</h3>
            <p className="voice-helper">{connected ? 'जैसे किसी साथी से बात करते हैं, वैसे ही बताइए।':'कोई तकनीकी शब्द नहीं — बस अपनी परेशानी बताइए।'}</p>
            <div className="voice-buttons">
              {!connected ? <><button className="primary-button" onClick={() => void controller.current?.connect()} disabled={busy || !snapshot.config?.configured.gemini}><Icon name="mic" size={16}/>{busy ? 'जुड़ रहे हैं…':'बात शुरू करें'}<Icon name="arrow" size={15}/></button>{busy && <button className="secondary-button" onClick={()=>controller.current?.disconnect()}><Icon name="stop" size={14}/>बात समाप्त करें</button>}</> : <>
                <button className="primary-button" onClick={() => void controller.current?.toggleMicrophone()}><Icon name={snapshot.microphone === 'listening' ? 'pause':'mic'} size={16}/>{snapshot.microphone === 'listening' ? 'माइक रोकें':'माइक चालू करें'}</button>
                <button className="secondary-button" onClick={() => controller.current?.disconnect()}><Icon name="stop" size={14}/>बात समाप्त करें</button>
              </>}
            </div>
            <p className="headphone-tip"><Icon name="headphones" size={12}/>साफ़ आवाज़ के लिए हेडफ़ोन लगाएँ</p>
          </div>
          {snapshot.error && <div className="error-notice" role="alert"><p>{snapshot.error}</p><button onClick={() => setDeveloperOpen(true)}>सेटअप की जानकारी देखें</button></div>}
          {snapshot.config && !snapshot.config.configured.gemini && !snapshot.error && <div className="error-notice" role="alert"><p>बात शुरू करने के लिए सर्वर का Gemini सेटअप पूरा करें।</p><button onClick={() => setDeveloperOpen(true)}>डेवलपर विवरण खोलें</button></div>}
        </section>
        <section className="card visual-card" aria-labelledby="visual-heading">
          <div className="card-top"><h2 className="section-title" id="visual-heading"><Icon name="screen" size={17}/>चाहें तो ऐप दिखाइए</h2><span className="connection-live-label">वैकल्पिक</span></div>
          <p className="card-subtitle" style={{margin:'7px 23px 0'}}>समस्या जहाँ दिख रही है, वह स्क्रीन साझा करें।</p>
          <div className="visual-buttons">
            <button className={`secondary-button ${snapshot.visualSource === 'screen' ? 'selected':''}`} disabled={!connected} onClick={() => { setShowScreenGuide(true); void controller.current?.startVisual('screen'); }}><Icon name="screen" size={14}/>स्क्रीन दिखाएँ</button>
            <button className={`secondary-button ${snapshot.visualSource === 'camera' ? 'selected':''}`} disabled={!connected} onClick={() => { setShowScreenGuide(false); void controller.current?.startVisual('camera'); }}><Icon name="camera" size={14}/>कैमरा चालू करें</button>
          </div>
          <div className="visual-area">{snapshot.frame ? <><img src={snapshot.frame} alt={snapshot.visualSource === 'screen' ? 'साझा की गई ऐप स्क्रीन':'कैमरे से वर्तमान तस्वीर'}/><span className="frame-label"><span className="status-dot"/>अभी दिख रही तस्वीर</span></> : <div className="visual-placeholder"><AppIllustration/><p>आपकी स्क्रीन यहाँ दिखेगी</p></div>}</div>
          {showScreenGuide && !snapshot.frame ? <div className="permission-guide"><strong>स्क्रीन की अनुमति:</strong> खुलने वाले बॉक्स में अपने दुकान वाले ऐप का टैब चुनें, फिर <span lang="en">Share</span> दबाएँ।</div> : <p className="visual-note">{snapshot.frame ? 'यह तस्वीर बातचीत में दिख रही है। रिपोर्ट में रखने के लिए नीचे “तस्वीर जोड़ें” दबाएँ।':'स्क्रीन या कैमरा आपकी अनुमति के बाद ही चालू होगा। एक समय में एक ही स्रोत दिखाया जाएगा।'}</p>}
          {snapshot.frame && <div className="frame-actions"><button className="secondary-button" disabled={snapshot.attachingFrame} onClick={() => void controller.current?.attachFrame()}><Icon name="image" size={13}/>{snapshot.attachingFrame ? 'जोड़ रहे हैं…':'तस्वीर जोड़ें'}</button>{snapshot.evidenceCount > 0 && <span className="attached-label"><Icon name="check" size={12}/>{snapshot.evidenceCount} तस्वीर जुड़ी</span>}<button className="quiet-button" onClick={() => controller.current?.stopVisual()}><Icon name="close" size={12}/>बंद करें</button></div>}
        </section>
        <section className="card conversation-card" aria-labelledby="conversation-heading">
          <div className="card-top conversation-header"><h2 className="section-title" id="conversation-heading"><Icon name="message" size={17}/>हमारी बातचीत</h2><span className="connection-live-label">जो कहा, यहाँ दिखेगा</span></div>
          <div className="conversation-list" role="log" aria-live="polite" aria-relevant="additions text">
            {snapshot.turns.length === 0 ? <div className="conversation-empty"><span className="empty-symbol"><Icon name="message" size={20}/></span><p>बात शुरू करें, या अपनी परेशानी लिखकर भेजें।</p><button className="sample-prompt" onClick={() => setText(SAMPLE)}><span>इस तरह बता सकते हैं</span>“20 किलो चावल में से 7 किलो बेचा, लेकिन स्टॉक बढ़ गया।”</button></div> : snapshot.turns.map(turn => <div className={`transcript-row ${turn.role}`} key={turn.id}><span className="transcript-avatar"><Icon name={turn.role === 'user' ? 'shop':'leaf'} size={13}/></span><div className="transcript-body"><div className="transcript-meta"><span className="transcript-name">{turn.role === 'user' ? 'आप':'किराना साथी'}</span>{!turn.finalized && <><span className="streaming-dot"/>सुन रहे हैं…</>}</div><p>{turn.text}</p></div></div>)}
            <div ref={transcriptEnd}/>
          </div>
          <form className="typing-form" onSubmit={sendText}><label htmlFor="typed-message" className="sr-only">अपनी परेशानी लिखें</label><textarea id="typed-message" value={text} onChange={e => setText(e.target.value)} placeholder="बोल नहीं पा रहे? यहाँ लिखकर बताइए…" rows={1} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); void sendText(e); } }}/><button className="send-button" type="submit" disabled={!connected || !text.trim()} aria-label="संदेश भेजें"><Icon name="arrow" size={16}/></button></form>
          {!connected && <p className="text-tip">लिखकर भेजने के लिए भी पहले “बात शुरू करें” दबाएँ।</p>}
        </section>
        <section className="card report-card" aria-labelledby="report-heading">
          <div className="card-top"><h2 className="section-title" id="report-heading"><Icon name="clipboard" size={17}/>आपकी समस्या की रिपोर्ट</h2>{snapshot.report && <span className="status-pill">रिपोर्ट {snapshot.report.version}</span>}</div>
          <div className="report-content">
            {!snapshot.report ? <><div className="report-empty"><h3 className="report-empty-title"><Icon name="clipboard" size={15}/>पहले आपकी बात समझेंगे</h3><p>क्या हुआ, क्या होना चाहिए था, और उसे दोबारा कैसे देखें — ये बातें यहाँ लिखी जाएँगी।</p></div><div className="consent-guide"><strong>आपकी अनुमति, फिर सुधार</strong><p>किराना साथी रिपोर्ट आपको पढ़कर सुनाएगा। बात सही हो तो बोलिए: “हाँ, यही समस्या है। सुधार शुरू करें।”</p></div></> : <>
              <h3 className="report-title">{snapshot.report.summary_hi}</h3><dl className="report-detail"><dt>होना चाहिए</dt><dd>{snapshot.report.expected_hi}</dd><dt>अभी हो रहा है</dt><dd>{snapshot.report.actual_hi}</dd></dl>
              {snapshot.report.reproduction_hi?.length > 0 && <ol className="report-steps">{snapshot.report.reproduction_hi.map((step,index) => <li key={index}>{step}</li>)}</ol>}
              <div className={`report-ready ${snapshot.readbackComplete ? '':'waiting'}`} role="status"><Icon name={snapshot.readbackComplete ? 'check':'headphones'} size={15}/><span>{snapshot.job ? 'आपकी अनुमति मिल गई। नीचे सुधार की स्थिति देखिए।' : snapshot.readbackComplete ? 'बात सही है? बोलिए: “हाँ, यही समस्या है। सुधार शुरू करें।” कोई गलती हो तो पहले उसे बताइए।' : 'पूरी रिपोर्ट सुन लीजिए। सही होने पर आपकी अनुमति से सुधार शुरू होगा।'}</span></div>
            </>}
          </div>
        </section>
        {snapshot.job && <section className="card job-card" aria-labelledby="job-heading"><div className="job-inner"><span className="job-icon"><Icon name={snapshot.job.status === 'completed' ? 'check':snapshot.job.status === 'failed' ? 'note':'tools'} size={23}/></span><div className="job-copy"><div className="job-eyebrow">सुधार की स्थिति</div><h2 id="job-heading" aria-live="polite">{snapshot.job.message_hi || 'सुधार की जानकारी मिल रही है…'}</h2><p>{snapshot.job.error || (snapshot.job.status === 'completed' ? 'बदला हुआ ऐप खोलकर जाँचिए। कोड का बदलाव भी देख सकते हैं।':activeJob ? 'काम चलते समय आप बातचीत जारी रख सकते हैं।':'यह काम समाप्त हो गया है।')}</p></div><div className="job-links">{snapshot.job.preview_url && <a className="preview" href={snapshot.job.preview_url} target="_blank" rel="noreferrer">बदला हुआ ऐप देखें<Icon name="external" size={13}/></a>}{snapshot.job.pr_url && <a href={snapshot.job.pr_url} target="_blank" rel="noreferrer">कोड का बदलाव देखें<Icon name="external" size={13}/></a>}{activeJob && <button className="quiet-button" onClick={() => void controller.current?.cancelJob()}>सुधार रोकें</button>}</div></div>{activeJob && <div className="job-progress" aria-label="सुधार का काम चल रहा है"><span/></div>}</section>}
      </div>
      <footer className="site-footer"><div className="footer-note"><Icon name="shield" size={13}/>सुधार शुरू करने से पहले आपकी बात की पुष्टि होगी</div><div className="footer-actions"><button onClick={() => void controller.current?.prepareFriction().then(ready=>{if(ready)setFrictionOpen(true);})}><Icon name="note" size={12}/>फीडबैक नोट</button><button onClick={() => setDeveloperOpen(value => !value)} aria-expanded={developerOpen}><Icon name="settings" size={12}/>डेवलपर विवरण</button></div></footer>
      {developerOpen && <section className="developer-details"><h2>Developer setup</h2><dl><dt>Repository</dt><dd>{snapshot.config?.repository || 'Loading configuration…'}</dd><dt>Base branch</dt><dd>{snapshot.config?.baseBranch || '—'}</dd><dt>Live model</dt><dd>{snapshot.config?.models.live || '—'}</dd><dt>Report model</dt><dd>{snapshot.config?.models.structured || '—'}</dd><dt>Repair agent</dt><dd>{snapshot.config?.models.agent || '—'}</dd><dt>Gemini / GitHub</dt><dd>{snapshot.config ? `${snapshot.config.configured.gemini ? 'Configured':'Missing'} / ${snapshot.config.configured.github ? 'Configured':'Missing'}`:'Loading…'}</dd><dt>Browser session</dt><dd>Ephemeral token · same-origin local session</dd></dl>{!snapshot.config?.configured.gemini && <p>Set GEMINI_API_KEY in the server’s .env.local, then restart the API server. The browser receives only a short-lived Live token.</p>}{snapshot.config && !snapshot.config.configured.github && <p>Set GITHUB_TOKEN on the server to publish a repair pull request.</p>}<p>Microphone and screen sharing require localhost or HTTPS. Evidence is attached only when “तस्वीर जोड़ें” is pressed. Live frames are limited to one per second.</p></section>}
    </main>
    {frictionOpen && <FrictionDrawer onClose={closeFriction} onSave={entry => controller.current!.saveFriction(entry)} evidenceIds={snapshot.evidenceIds}/>}
  </>;
}

function FrictionDrawer({onClose,onSave,evidenceIds}:{onClose:()=>void;onSave:(entry:Record<string,unknown>)=>Promise<void>;evidenceIds:string[]}) {
  const [result,setResult] = useState('');
  const [error,setError] = useState(false);
  const [saving,setSaving] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous=document.activeElement as HTMLElement | null;
    drawer.current?.querySelector<HTMLInputElement>('input')?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){onClose();return;}
      if(event.key!=='Tab')return;
      const elements=drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,a[href]');
      if(!elements?.length)return;
      const first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',keyboard);
    return()=>{window.removeEventListener('keydown',keyboard);previous?.focus();};
  },[onClose]);
  const submit = async (event:React.FormEvent<HTMLFormElement>) => { event.preventDefault();setSaving(true);setResult(''); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await onSave({...values,time_lost_minutes:Number(values.time_lost_minutes),evidence_ids:evidenceIds}); setError(false);setResult('नोट सेव हो गया। अब उसे Markdown या CSV में निकाल सकते हैं।'); } catch(cause){setError(true);setResult(cause instanceof Error ? cause.message:'नोट सेव नहीं हुआ।');} finally{setSaving(false);} };
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><aside className="friction-drawer" role="dialog" aria-modal="true" aria-labelledby="friction-heading" ref={drawer}><div className="drawer-header"><h2 id="friction-heading">फीडबैक नोट</h2><button className="icon-button" onClick={onClose} aria-label="फीडबैक बंद करें"><Icon name="close" size={17}/></button></div><p className="friction-description">बनाते या जाँचते समय हुई परेशानी का वास्तविक रिकॉर्ड रखें। बिना जाँची बात को अलग चिह्नित करें।</p><form onSubmit={submit}>
    <label className="field-label" htmlFor="friction-title">समस्या का नाम</label><input id="friction-title" name="title" required maxLength={200}/>
    <div className="friction-row"><div><label className="field-label" htmlFor="friction-kind">क्या यह देखा गया?</label><select id="friction-kind" name="kind"><option value="observed">देखी हुई समस्या</option><option value="hypothesis">अभी एक अनुमान</option><option value="not_tested">अभी नहीं जाँचा</option></select></div><div><label className="field-label" htmlFor="friction-stage">कौन सा चरण?</label><input id="friction-stage" name="stage" required placeholder="Live connection, tools…"/></div></div>
    <label className="field-label" htmlFor="friction-reproduction">दोबारा कैसे देखें?</label><textarea id="friction-reproduction" name="reproduction" required/>
    <label className="field-label" htmlFor="friction-expected">क्या होना चाहिए था?</label><textarea id="friction-expected" name="expected" required/>
    <label className="field-label" htmlFor="friction-actual">क्या हुआ?</label><textarea id="friction-actual" name="actual" required/>
    <label className="field-label" htmlFor="friction-workaround">काम आगे बढ़ाने का तरीका</label><textarea id="friction-workaround" name="workaround"/>
    <div className="friction-row"><div><label className="field-label" htmlFor="friction-severity">असर</label><select id="friction-severity" name="severity"><option value="P2">P2 — काम में रुकावट</option><option value="P1">P1 — काम बंद</option><option value="P3">P3 — छोटी परेशानी</option></select></div><div><label className="field-label" htmlFor="friction-time">गँवाया समय (मिनट)</label><input id="friction-time" name="time_lost_minutes" type="number" min="0" defaultValue="0" required/></div></div>
    <label className="field-label" htmlFor="friction-frequency">कितनी बार हुआ?</label><input id="friction-frequency" name="frequency" required placeholder="जैसे: 3 में से 2 बार"/>
    <label className="field-label" htmlFor="friction-recommendation">प्रोडक्ट के लिए सुझाव</label><textarea id="friction-recommendation" name="product_recommendation" required/>
    <div className="friction-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'सेव कर रहे हैं…':'नोट सेव करें'}</button><a className="export-link" href="/api/friction/export?format=md" download>Markdown</a><a className="export-link" href="/api/friction/export?format=csv" download>CSV</a></div>{result && <p className={`form-result ${error ? 'error':''}`} role="status">{result}</p>}
  </form></aside></div>;
}
