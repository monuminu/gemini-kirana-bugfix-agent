import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, AppIllustration } from './icons.js';
import { LiveConsole, initialSnapshot, type ConsoleSnapshot, type ConsoleConfig } from './live-console.js';
import { CONNECTION_LABELS, copy, jobMessage, localizeError, readLanguage, urlWithLanguage, type Language } from './language.js';
import type { FixJob } from '../shared/types.js';
import './styles.css';

const TERMINAL = new Set(['completed','failed','cancelled','needs_attention']);

export default function App() {
  const [snapshot,setSnapshot] = useState<ConsoleSnapshot>(()=>({...initialSnapshot,language:readLanguage()}));
  const [text,setText] = useState('');
  const [developerOpen,setDeveloperOpen] = useState(false);
  const [frictionOpen,setFrictionOpen] = useState(false);
  const closeFriction=useCallback(()=>setFrictionOpen(false),[]);
  const [showScreenGuide,setShowScreenGuide] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const controller = useRef<LiveConsole | null>(null);
  const t=copy(snapshot.language);
  useEffect(() => {
    const live = new LiveConsole(setSnapshot);
    controller.current = live;
    void live.initialize();
    return () => { live.destroy(); controller.current = null; };
  },[]);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({block:'nearest'}); },[snapshot.turns]);
  const connected = snapshot.connection === 'connected';
  const busy = snapshot.connection === 'connecting' || snapshot.connection === 'reconnecting';
  const speakState = snapshot.speaking ? t.speaking : connected && snapshot.microphone === 'listening' ? t.listening : connected ? t.paused : busy ? t.connecting : t.ready;
  const sendText = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !connected) return;
    await controller.current?.sendText(value);
    setText('');
  };
  const changeLanguage=(language:Language)=>{setShowScreenGuide(false);controller.current?.setLanguage(language);};
  return <>
    <header className="site-header"><div className="shell header-inner">
      <a className="brand" href={`/?lang=${snapshot.language}`} aria-label={t.brandLabel}><span className="brand-icon"><Icon name="shop" size={25}/></span><div><div className="brand-title">{t.brand}</div><div className="brand-subtitle">{t.tagline}</div></div></a>
      <div className="header-actions"><a className="inventory-link" href={urlWithLanguage(snapshot.config?.demoUrl || 'http://127.0.0.1:4301',snapshot.language)} target="_blank" rel="noreferrer">{t.shopApp}<Icon name="external" size={14}/></a><div className="language-toggle" role="group" aria-label={t.language}><button type="button" aria-pressed={snapshot.language==='hi'} lang="hi" onClick={()=>changeLanguage('hi')}>हिंदी</button><button type="button" aria-pressed={snapshot.language==='en'} lang="en" onClick={()=>changeLanguage('en')}>English</button></div></div>
    </div></header>
    <main className="shell">
      <section className="intro"><div><div className="eyebrow">{t.eyebrow}</div><h1>{t.title}</h1><p>{t.intro}</p></div><div className="intro-seal"><Icon name="leaf" size={31}/></div></section>
      <div className="journey" aria-label={t.journeyLabel}>
        <div className={`journey-step ${!snapshot.report ? 'active':''}`}><span className="step-number">1</span>{t.step1}</div><span className="step-line"/>
        <div className={`journey-step ${snapshot.report && !snapshot.job ? 'active':''}`}><span className="step-number">2</span>{t.step2}</div><span className="step-line"/>
        <div className={`journey-step ${snapshot.job ? 'active':''}`}><span className="step-number">3</span>{t.step3}</div>
      </div>
      <div className="workspace-grid">
        <section className="card voice-card" aria-labelledby="voice-heading">
          <div className="card-top"><h2 className="section-title" id="voice-heading"><Icon name="mic" size={17}/>{t.voiceHeading}</h2><span className={`status-pill ${snapshot.connection}`} role="status"><span className="status-dot"/>{CONNECTION_LABELS[snapshot.language][snapshot.connection]}</span></div>
          <div className="voice-center">
            <div className={`voice-orb-wrap ${connected && snapshot.microphone === 'listening' ? 'listening':''} ${snapshot.speaking ? 'speaking':''}`}><div className="voice-orb"><Icon name={snapshot.microphone === 'paused' ? 'micOff':'mic'} size={30}/></div></div>
            <h3 className="voice-state" aria-live="polite">{speakState}</h3>
            <p className="voice-helper">{connected ? t.voiceHelperLive:t.voiceHelperIdle}</p>
            <div className="voice-buttons">
              {!connected ? <><button className="primary-button" onClick={() => void controller.current?.connect()} disabled={busy || !snapshot.config?.configured.gemini}><Icon name="mic" size={16}/>{busy ? t.joining:t.start}<Icon name="arrow" size={15}/></button>{busy && <button className="secondary-button" onClick={()=>controller.current?.disconnect()}><Icon name="stop" size={14}/>{t.end}</button>}</> : <>
                <button className="primary-button" onClick={() => void controller.current?.toggleMicrophone()}><Icon name={snapshot.microphone === 'listening' ? 'pause':'mic'} size={16}/>{snapshot.microphone === 'listening' ? t.pauseMic:t.startMic}</button>
                <button className="secondary-button" onClick={() => controller.current?.disconnect()}><Icon name="stop" size={14}/>{t.end}</button>
              </>}
            </div>
            <p className="headphone-tip"><Icon name="headphones" size={12}/>{t.headphones}</p>
          </div>
          {snapshot.languageRestartNeeded && <p className="language-restart-hint" role="status">{t.restart}</p>}
          {snapshot.error && <div className="error-notice" role="alert"><p>{localizeError(snapshot.error,snapshot.language)}</p><button onClick={() => setDeveloperOpen(true)}>{t.setupInfo}</button></div>}
          {snapshot.config && !snapshot.config.configured.gemini && !snapshot.error && <div className="error-notice" role="alert"><p>{t.setupMissing}</p><button onClick={() => setDeveloperOpen(true)}>{t.developerOpen}</button></div>}
        </section>
        <section className="card visual-card" aria-labelledby="visual-heading">
          <div className="card-top"><h2 className="section-title" id="visual-heading"><Icon name="screen" size={17}/>{t.visualHeading}</h2><span className="connection-live-label">{t.optional}</span></div>
          <p className="card-subtitle" style={{margin:'7px 23px 0'}}>{t.visualSubtitle}</p>
          <div className="visual-buttons">
            <button className={`secondary-button ${snapshot.visualSource === 'screen' ? 'selected':''}`} disabled={!connected} onClick={() => { setShowScreenGuide(true); void controller.current?.startVisual('screen'); }}><Icon name="screen" size={14}/>{t.showScreen}</button>
            <button className={`secondary-button ${snapshot.visualSource === 'camera' ? 'selected':''}`} disabled={!connected} onClick={() => { setShowScreenGuide(false); void controller.current?.startVisual('camera'); }}><Icon name="camera" size={14}/>{t.startCamera}</button>
          </div>
          <div className="visual-area">{snapshot.frame ? <><img src={snapshot.frame} alt={snapshot.visualSource === 'screen' ? t.screenAlt:t.cameraAlt}/><span className="frame-label"><span className="status-dot"/>{t.frameLive}</span></> : <div className="visual-placeholder"><AppIllustration/><p>{t.screenEmpty}</p></div>}</div>
          {showScreenGuide && !snapshot.frame ? <div className="permission-guide"><strong>{t.screenPermission}</strong> {t.screenGuide}</div> : <p className="visual-note">{snapshot.frame ? t.frameNote:t.visualNote}</p>}
          {snapshot.frame && <div className="frame-actions"><button className="secondary-button" disabled={snapshot.attachingFrame} onClick={() => void controller.current?.attachFrame()}><Icon name="image" size={13}/>{snapshot.attachingFrame ? t.attaching:t.attach}</button>{snapshot.evidenceCount > 0 && <span className="attached-label"><Icon name="check" size={12}/>{snapshot.evidenceCount} {t.attached}</span>}<button className="quiet-button" onClick={() => controller.current?.stopVisual()}><Icon name="close" size={12}/>{t.close}</button></div>}
        </section>
        <section className="card conversation-card" aria-labelledby="conversation-heading">
          <div className="card-top conversation-header"><h2 className="section-title" id="conversation-heading"><Icon name="message" size={17}/>{t.conversation}</h2><span className="connection-live-label">{t.transcriptHint}</span></div>
          <div className="conversation-list" role="log" aria-live="polite" aria-relevant="additions text">
            {snapshot.turns.length === 0 ? <div className="conversation-empty"><span className="empty-symbol"><Icon name="message" size={20}/></span><p>{t.conversationEmpty}</p><button className="sample-prompt" onClick={() => setText(t.sample)}><span>{t.sampleLabel}</span>{t.sampleShort}</button></div> : snapshot.turns.map(turn => <div className={`transcript-row ${turn.role}`} key={turn.id}><span className="transcript-avatar"><Icon name={turn.role === 'user' ? 'shop':'leaf'} size={13}/></span><div className="transcript-body"><div className="transcript-meta"><span className="transcript-name">{turn.role === 'user' ? t.you:t.brand}</span>{!turn.finalized && <><span className="streaming-dot"/>{t.transcribing}</>}</div><p>{turn.text}</p></div></div>)}
            <div ref={transcriptEnd}/>
          </div>
          <form className="typing-form" onSubmit={sendText}><label htmlFor="typed-message" className="sr-only">{t.typedLabel}</label><textarea id="typed-message" value={text} onChange={e => setText(e.target.value)} placeholder={t.typedPlaceholder} rows={1} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); void sendText(e); } }}/><button className="send-button" type="submit" disabled={!connected || !text.trim()} aria-label={t.send}><Icon name="arrow" size={16}/></button></form>
          {!connected && <p className="text-tip">{t.typedTip}</p>}
        </section>
        <ReportCard snapshot={snapshot}/>
        {snapshot.job && <JobCard job={snapshot.job} language={snapshot.language} onCancel={()=>void controller.current?.cancelJob()}/>}
      </div>
      <footer className="site-footer"><div className="footer-note"><Icon name="shield" size={13}/>{t.footerNote}</div><div className="footer-actions"><button onClick={() => void controller.current?.prepareFriction().then(ready=>{if(ready)setFrictionOpen(true);})}><Icon name="note" size={12}/>{t.feedback}</button><button onClick={() => setDeveloperOpen(value => !value)} aria-expanded={developerOpen}><Icon name="settings" size={12}/>{t.developer}</button></div></footer>
      {developerOpen && <DeveloperDetails config={snapshot.config} language={snapshot.language}/>}
    </main>
    {frictionOpen && <FrictionDrawer language={snapshot.language} onClose={closeFriction} onSave={entry => controller.current!.saveFriction(entry)} evidenceIds={snapshot.evidenceIds}/>}
  </>;
}

export function ReportCard({snapshot}:{snapshot:ConsoleSnapshot}) {
  const t=copy(snapshot.language),report=snapshot.report;
  const confirmed=!!snapshot.job || snapshot.readbackComplete;
  const summary=report?.[snapshot.language==='hi'?'summary_hi':'summary_en'];
  const expected=report?.[snapshot.language==='hi'?'expected_hi':'expected_en'];
  const actual=report?.[snapshot.language==='hi'?'actual_hi':'actual_en'];
  const steps=report?.[snapshot.language==='hi'?'reproduction_hi':'reproduction_en'];
  return <section className="card report-card" aria-labelledby="report-heading">
    <div className="card-top"><h2 className="section-title" id="report-heading"><Icon name="clipboard" size={17}/>{t.reportHeading}</h2>{report && <span className="status-pill">{t.reportVersion} {report.version}</span>}</div>
    <div className="report-content">
      {!report ? <><div className="report-empty"><h3 className="report-empty-title"><Icon name="clipboard" size={15}/>{t.reportEmptyTitle}</h3><p>{t.reportEmpty}</p></div><div className="consent-guide"><strong>{t.consentTitle}</strong><p>{t.consentGuide}</p></div></> : <>
        <h3 className="report-title">{summary}</h3><dl className="report-detail"><dt>{t.expected}</dt><dd>{expected}</dd><dt>{t.actual}</dt><dd>{actual}</dd></dl>
        {!!steps?.length && <ol className="report-steps">{steps.map((step,index) => <li key={index}>{step}</li>)}</ol>}
        <div className={`report-ready ${confirmed ? '':'waiting'}`} role="status"><Icon name={confirmed ? 'check':'headphones'} size={15}/><span>{snapshot.job ? t.consentReceived : snapshot.readbackComplete ? t.consentReady:t.readbackWaiting}</span></div>
      </>}
    </div>
  </section>;
}

export function JobCard({job,language,onCancel}:{job:FixJob;language:Language;onCancel:()=>void}) {
  const t=copy(language),active=!TERMINAL.has(job.status);
  return <section className="card job-card" aria-labelledby="job-heading"><div className="job-inner"><span className="job-icon"><Icon name={job.status === 'completed' ? 'check':job.status === 'failed' ? 'note':'tools'} size={23}/></span><div className="job-copy"><div className="job-eyebrow">{t.jobHeading}</div><h2 id="job-heading" aria-live="polite">{jobMessage(job,language) || t.jobLoading}</h2><p>{job.error ? localizeError(job.error,language) : job.status === 'completed' ? t.jobCompleted:active ? t.jobActive:t.jobFinished}</p></div><div className="job-links">{job.preview_url && <a className="preview" href={urlWithLanguage(job.preview_url,language)} target="_blank" rel="noreferrer">{t.preview}<Icon name="external" size={13}/></a>}{job.pr_url && <a href={job.pr_url} target="_blank" rel="noreferrer">{t.codeChanges}<Icon name="external" size={13}/></a>}{active && <button className="quiet-button" onClick={onCancel}>{t.stopFix}</button>}</div></div>{active && <div className="job-progress" aria-label={t.jobProgress}><span/></div>}</section>;
}

export function DeveloperDetails({config,language}:{config?:ConsoleConfig;language:Language}) {
  const t=copy(language);
  return <section className="developer-details"><h2>{t.developerSetup}</h2><dl><dt>{t.repository}</dt><dd>{config?.repository || t.loadingConfig}</dd><dt>{t.baseBranch}</dt><dd>{config?.baseBranch || '—'}</dd><dt>{t.liveModel}</dt><dd>{config?.models.live || '—'}</dd><dt>{t.reportModel}</dt><dd>{config?.models.structured || '—'}</dd><dt>{t.repairAgent}</dt><dd>{config?.models.agent || '—'}</dd><dt>Gemini / GitHub</dt><dd>{config ? `${config.configured.gemini ? t.configured:t.missing} / ${config.configured.github ? t.configured:t.missing}`:t.loading}</dd><dt>{t.browserSession}</dt><dd>{t.sessionDescription}</dd><dt>{t.liveLanguage}</dt><dd>{language==='hi'?'हिंदी':'English'}</dd></dl>{!config?.configured.gemini && <p>{t.geminiSetup}</p>}{config && !config.configured.github && <p>{t.githubSetup}</p>}<p>{t.mediaSetup}</p></section>;
}

export function FrictionDrawer({onClose,onSave,evidenceIds,language}:{onClose:()=>void;onSave:(entry:Record<string,unknown>)=>Promise<void>;evidenceIds:string[];language:Language}) {
  const [result,setResult] = useState<'saved'|string>('');
  const [error,setError] = useState(false);
  const [saving,setSaving] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const t=copy(language);
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
  const submit = async (event:React.FormEvent<HTMLFormElement>) => { event.preventDefault();setSaving(true);setResult(''); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await onSave({...values,time_lost_minutes:Number(values.time_lost_minutes),evidence_ids:evidenceIds}); setError(false);setResult('saved'); } catch(cause){setError(true);setResult(cause instanceof Error ? cause.message:t.noteFailed);} finally{setSaving(false);} };
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><aside className="friction-drawer" role="dialog" aria-modal="true" aria-labelledby="friction-heading" ref={drawer}><div className="drawer-header"><h2 id="friction-heading">{t.feedback}</h2><button className="icon-button" onClick={onClose} aria-label={t.feedbackClose}><Icon name="close" size={17}/></button></div><p className="friction-description">{t.feedbackDescription}</p><form onSubmit={submit}>
    <label className="field-label" htmlFor="friction-title">{t.problemName}</label><input id="friction-title" name="title" required maxLength={200}/>
    <div className="friction-row"><div><label className="field-label" htmlFor="friction-kind">{t.observedLabel}</label><select id="friction-kind" name="kind"><option value="observed">{t.observed}</option><option value="hypothesis">{t.hypothesis}</option><option value="not_tested">{t.untested}</option></select></div><div><label className="field-label" htmlFor="friction-stage">{t.stage}</label><input id="friction-stage" name="stage" required placeholder={t.stagePlaceholder}/></div></div>
    <label className="field-label" htmlFor="friction-reproduction">{t.reproduction}</label><textarea id="friction-reproduction" name="reproduction" required/>
    <label className="field-label" htmlFor="friction-expected">{t.feedbackExpected}</label><textarea id="friction-expected" name="expected" required/>
    <label className="field-label" htmlFor="friction-actual">{t.feedbackActual}</label><textarea id="friction-actual" name="actual" required/>
    <label className="field-label" htmlFor="friction-workaround">{t.workaround}</label><textarea id="friction-workaround" name="workaround"/>
    <div className="friction-row"><div><label className="field-label" htmlFor="friction-severity">{t.severity}</label><select id="friction-severity" name="severity"><option value="P2">{t.severityP2}</option><option value="P1">{t.severityP1}</option><option value="P3">{t.severityP3}</option></select></div><div><label className="field-label" htmlFor="friction-time">{t.timeLost}</label><input id="friction-time" name="time_lost_minutes" type="number" min="0" defaultValue="0" required/></div></div>
    <label className="field-label" htmlFor="friction-frequency">{t.frequency}</label><input id="friction-frequency" name="frequency" required placeholder={t.frequencyPlaceholder}/>
    <label className="field-label" htmlFor="friction-recommendation">{t.recommendation}</label><textarea id="friction-recommendation" name="product_recommendation" required/>
    <div className="friction-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? t.saving:t.saveNote}</button><a className="export-link" href="/api/friction/export?format=md" download>Markdown</a><a className="export-link" href="/api/friction/export?format=csv" download>CSV</a></div>{result && <p className={`form-result ${error ? 'error':''}`} role="status">{!error && result==='saved'?t.noteSaved:localizeError(result,language)}</p>}
  </form></aside></div>;
}
