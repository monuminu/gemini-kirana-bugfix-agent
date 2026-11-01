export type Language = 'hi'|'en';
export const LANGUAGE_STORAGE_KEY = 'kirana-saathi.language.v1';
export function isLanguage(value:unknown):value is Language { return value==='hi' || value==='en'; }
export function readLanguage():Language {
  if(typeof window==='undefined')return 'hi';
  try { const query=new URLSearchParams(window.location.search).get('lang');if(isLanguage(query))return query; } catch {}
  try { const stored=localStorage.getItem(LANGUAGE_STORAGE_KEY);if(isLanguage(stored))return stored; } catch {}
  return 'hi';
}
export function saveLanguage(language:Language):void {
  if(typeof window!=='undefined')try { localStorage.setItem(LANGUAGE_STORAGE_KEY,language); } catch {}
  if(typeof document!=='undefined'){document.documentElement.lang=language;document.title=language==='en'?'Kirana Saathi · App help':'किराना साथी · ऐप सहायता';}
}
export function updateLanguageQuery(language:Language):void {
  try { const url=new URL(window.location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',language);window.history.replaceState(window.history.state,'',url);} } catch {}
}
export function urlWithLanguage(value:string,language:Language):string {
  try { const url=new URL(value,typeof window!=='undefined'?window.location.href:'http://127.0.0.1:4300');url.searchParams.set('lang',language);return url.href; } catch { return value; }
}

const COPY = {
  brand:['किराना साथी','Kirana Saathi'],
  brandLabel:['किराना साथी ऐप सहायता','Kirana Saathi app help'],
  tagline:['आपकी दुकान, आपकी आवाज़','Your shop, your voice'],
  language:['भाषा चुनें','Choose language'],
  shopApp:['दुकान का ऐप खोलें','Open shop app'],
  eyebrow:['अपनी भाषा में, आसानी से','Easy help in your language'],
  title:['ऐप सहायता','App help'],
  intro:['दुकान के ऐप में कुछ ठीक नहीं चल रहा? बोलकर बताइए। हम आपकी बात समझकर सुधार की रिपोर्ट तैयार करेंगे, फिर आपकी अनुमति से काम शुरू होगा।','Something wrong with your shop app? Tell us what happened. We’ll prepare a problem report, then start the fix with your permission.'],
  journeyLabel:['सहायता के तीन कदम','Three steps to get help'],
  step1:['समस्या बताइए','Tell us the problem'],
  step2:['बात जाँचिए','Check the report'],
  step3:['सुधार देखिए','See the fix'],
  voiceHeading:['बात करके बताइए','Tell us by talking'],
  speaking:['किराना साथी बोल रहा है…','Kirana Saathi is speaking…'],
  listening:['बताइए, क्या परेशानी है?','Tell us, what’s the problem?'],
  paused:['बात चालू है, माइक रुका है','Conversation is open; the microphone is paused'],
  connecting:['एक पल, हम जुड़ रहे हैं…','One moment, we’re connecting…'],
  ready:['मैं आपकी बात सुनने के लिए तैयार हूँ','I’m ready to listen'],
  voiceHelperLive:['जैसे किसी साथी से बात करते हैं, वैसे ही बताइए।','Explain it as you would to a friend.'],
  voiceHelperIdle:['कोई तकनीकी शब्द नहीं — बस अपनी परेशानी बताइए।','Just tell us what’s wrong in your own words.'],
  start:['बात शुरू करें','Start talking'],
  joining:['जुड़ रहे हैं…','Connecting…'],
  end:['बात समाप्त करें','End conversation'],
  pauseMic:['माइक रोकें','Pause microphone'],
  startMic:['माइक चालू करें','Turn on microphone'],
  headphones:['साफ़ आवाज़ के लिए हेडफ़ोन लगाएँ','Use headphones for clearer audio'],
  setupInfo:['सेटअप की जानकारी देखें','View setup information'],
  setupMissing:['बात शुरू करने के लिए सर्वर का Gemini सेटअप पूरा करें।','Complete the server’s Gemini setup to start talking.'],
  developerOpen:['डेवलपर विवरण खोलें','Open developer details'],
  restart:['भाषा बदल गई। नई भाषा में बात करने के लिए “बात शुरू करें” दबाएँ। आपकी रिपोर्ट और सुधार का काम सुरक्षित हैं।','Language changed. Press “Start talking” to begin in this language. Your report and repair job are saved.'],
  visualHeading:['चाहें तो ऐप दिखाइए','Show the app if you like'],
  optional:['वैकल्पिक','Optional'],
  visualSubtitle:['समस्या जहाँ दिख रही है, वह स्क्रीन साझा करें।','Share the screen where the problem appears.'],
  showScreen:['स्क्रीन दिखाएँ','Share screen'],
  startCamera:['कैमरा चालू करें','Turn on camera'],
  screenAlt:['साझा की गई ऐप स्क्रीन','Shared app screen'],
  cameraAlt:['कैमरे से वर्तमान तस्वीर','Current camera frame'],
  frameLive:['अभी दिख रही तस्वीर','Current live frame'],
  screenEmpty:['आपकी स्क्रीन यहाँ दिखेगी','Your screen will appear here'],
  screenPermission:['स्क्रीन की अनुमति:','Screen permission:'],
  screenGuide:['खुलने वाले बॉक्स में अपने दुकान वाले ऐप का टैब चुनें, फिर Share दबाएँ।','In the dialog, select the tab with your shop app, then press Share.'],
  frameNote:['यह तस्वीर बातचीत में दिख रही है। रिपोर्ट में रखने के लिए नीचे “तस्वीर जोड़ें” दबाएँ।','This frame is visible in the conversation. Press “Attach image” to keep it in the report.'],
  visualNote:['स्क्रीन या कैमरा आपकी अनुमति के बाद ही चालू होगा। एक समय में एक ही स्रोत दिखाया जाएगा।','Screen sharing or camera starts only with your permission. One source is shown at a time.'],
  attaching:['जोड़ रहे हैं…','Attaching…'],
  attach:['तस्वीर जोड़ें','Attach image'],
  attached:['तस्वीर जुड़ी','image(s) attached'],
  close:['बंद करें','Close'],
  conversation:['हमारी बातचीत','Our conversation'],
  transcriptHint:['जो कहा, यहाँ दिखेगा','What you say appears here'],
  conversationEmpty:['बात शुरू करें, या अपनी परेशानी लिखकर भेजें।','Start talking, or type your problem.'],
  sampleLabel:['इस तरह बता सकते हैं','You can explain it like this'],
  sampleShort:['“20 किलो चावल में से 7 किलो बेचा, लेकिन स्टॉक बढ़ गया।”','“I sold 7 kg from 20 kg of rice, but the stock increased.”'],
  sample:['20 किलो चावल में से 7 किलो बेचा, लेकिन ऐप में स्टॉक कम होने के बजाय बढ़ गया। इसे ठीक कर दीजिए।','I sold 7 kg from 20 kg of rice, but the app increased the stock instead of reducing it. Please fix this.'],
  you:['आप','You'],
  transcribing:['सुन रहे हैं…','Listening…'],
  typedLabel:['अपनी परेशानी लिखें','Type your problem'],
  typedPlaceholder:['बोल नहीं पा रहे? यहाँ लिखकर बताइए…','Can’t speak? Type your problem here…'],
  send:['संदेश भेजें','Send message'],
  typedTip:['लिखकर भेजने के लिए भी पहले “बात शुरू करें” दबाएँ।','Press “Start talking” before sending a typed message.'],
  reportHeading:['आपकी समस्या की रिपोर्ट','Your problem report'],
  reportVersion:['रिपोर्ट','Report'],
  reportEmptyTitle:['पहले आपकी बात समझेंगे','First, we’ll understand the problem'],
  reportEmpty:['क्या हुआ, क्या होना चाहिए था, और उसे दोबारा कैसे देखें — ये बातें यहाँ लिखी जाएँगी।','What happened, what should happen, and how to reproduce it will be written here.'],
  consentTitle:['आपकी अनुमति, फिर सुधार','Your permission, then the fix'],
  consentGuide:['किराना साथी रिपोर्ट आपको पढ़कर सुनाएगा। बात सही हो तो बोलिए: “हाँ, यही समस्या है। सुधार शुरू करें।”','Kirana Saathi will read the report aloud. If it’s correct, say: “Yes, that’s the problem. Start the fix.”'],
  expected:['होना चाहिए','Expected'],
  actual:['अभी हो रहा है','Actual'],
  consentReceived:['आपकी अनुमति मिल गई। नीचे सुधार की स्थिति देखिए।','Your permission was received. See the repair status below.'],
  consentReady:['बात सही है? बोलिए: “हाँ, यही समस्या है। सुधार शुरू करें।” कोई गलती हो तो पहले उसे बताइए।','Is the report correct? Say: “Yes, that’s the problem. Start the fix.” Tell us about any errors first.'],
  readbackWaiting:['पूरी रिपोर्ट सुन लीजिए। सही होने पर आपकी अनुमति से सुधार शुरू होगा।','Listen to the full report. If it’s correct, the fix can start with your permission.'],
  jobHeading:['सुधार की स्थिति','Repair status'],
  jobLoading:['सुधार की जानकारी मिल रही है…','Getting repair status…'],
  jobCompleted:['बदला हुआ ऐप खोलकर जाँचिए। कोड का बदलाव भी देख सकते हैं।','Open the updated app to check it. You can also review the code changes.'],
  jobActive:['काम चलते समय आप बातचीत जारी रख सकते हैं।','You can continue the conversation while the work runs.'],
  jobFinished:['यह काम समाप्त हो गया है।','This job has ended.'],
  preview:['बदला हुआ ऐप देखें','View updated app'],
  codeChanges:['कोड का बदलाव देखें','View code changes'],
  stopFix:['सुधार रोकें','Stop the fix'],
  jobProgress:['सुधार का काम चल रहा है','The repair is in progress'],
  footerNote:['सुधार शुरू करने से पहले आपकी बात की पुष्टि होगी','Your report will be confirmed before the fix starts'],
  feedback:['फीडबैक नोट','Feedback note'],
  developer:['डेवलपर विवरण','Developer details'],
  developerSetup:['डेवलपर सेटअप','Developer setup'],
  repository:['रिपॉज़िटरी','Repository'],
  baseBranch:['मूल ब्रांच','Base branch'],
  liveModel:['बातचीत का मॉडल','Live model'],
  reportModel:['रिपोर्ट का मॉडल','Report model'],
  repairAgent:['सुधार एजेंट','Repair agent'],
  configured:['सेटअप पूरा','Configured'],
  missing:['सेटअप बाकी','Missing'],
  loading:['लोड हो रहा है…','Loading…'],
  loadingConfig:['सेटअप लोड हो रहा है…','Loading configuration…'],
  browserSession:['ब्राउज़र सत्र','Browser session'],
  sessionDescription:['कम समय का टोकन · इसी सर्वर का स्थानीय सत्र','Ephemeral token · same-origin local session'],
  liveLanguage:['बातचीत की भाषा','Conversation language'],
  geminiSetup:['सर्वर की .env.local में GEMINI_API_KEY जोड़ें, फिर API सर्वर दोबारा शुरू करें। ब्राउज़र को केवल कम समय का Live टोकन मिलता है।','Set GEMINI_API_KEY in the server’s .env.local, then restart the API server. The browser receives only a short-lived Live token.'],
  githubSetup:['सुधार का पुल रिक्वेस्ट प्रकाशित करने के लिए सर्वर पर GITHUB_TOKEN जोड़ें।','Set GITHUB_TOKEN on the server to publish a repair pull request.'],
  mediaSetup:['माइक और स्क्रीन साझा करने के लिए localhost या HTTPS चाहिए। “तस्वीर जोड़ें” दबाने पर ही प्रमाण जुड़ता है। बातचीत में तस्वीरें अधिकतम एक प्रति सेकंड भेजी जाती हैं।','Microphone and screen sharing require localhost or HTTPS. Evidence is attached only when “Attach image” is pressed. Live frames are limited to one per second.'],
  feedbackClose:['फीडबैक बंद करें','Close feedback'],
  feedbackDescription:['बनाते या जाँचते समय हुई परेशानी का वास्तविक रिकॉर्ड रखें। बिना जाँची बात को अलग चिह्नित करें।','Keep a factual record of problems found while building or testing. Mark untested ideas separately.'],
  problemName:['समस्या का नाम','Problem title'],
  observedLabel:['क्या यह देखा गया?','Was this observed?'],
  observed:['देखी हुई समस्या','Observed problem'],
  hypothesis:['अभी एक अनुमान','Hypothesis'],
  untested:['अभी नहीं जाँचा','Not tested'],
  stage:['कौन सा चरण?','Which stage?'],
  stagePlaceholder:['बातचीत का कनेक्शन, उपकरण…','Live connection, tools…'],
  reproduction:['दोबारा कैसे देखें?','How can it be reproduced?'],
  feedbackExpected:['क्या होना चाहिए था?','What should have happened?'],
  feedbackActual:['क्या हुआ?','What happened?'],
  workaround:['काम आगे बढ़ाने का तरीका','Workaround'],
  severity:['असर','Impact'],
  severityP2:['P2 — काम में रुकावट','P2 — Work interrupted'],
  severityP1:['P1 — काम बंद','P1 — Work blocked'],
  severityP3:['P3 — छोटी परेशानी','P3 — Minor problem'],
  timeLost:['गँवाया समय (मिनट)','Time lost (minutes)'],
  frequency:['कितनी बार हुआ?','How often did it happen?'],
  frequencyPlaceholder:['जैसे: 3 में से 2 बार','For example: 2 of 3 attempts'],
  recommendation:['प्रोडक्ट के लिए सुझाव','Product recommendation'],
  saving:['सेव कर रहे हैं…','Saving…'],
  saveNote:['नोट सेव करें','Save note'],
  noteSaved:['नोट सेव हो गया। अब उसे Markdown या CSV में निकाल सकते हैं।','Note saved. You can now export it as Markdown or CSV.'],
  noteFailed:['नोट सेव नहीं हुआ।','The note could not be saved.'],
} as const;
export function copy(language:Language):Record<keyof typeof COPY,string> {return Object.fromEntries(Object.entries(COPY).map(([key,value])=>[key,value[language==='hi'?0:1]])) as Record<keyof typeof COPY,string>;}

export const CONNECTION_LABELS = {
  hi:{idle:'अभी जुड़े नहीं',connecting:'जुड़ रहे हैं',connected:'जुड़े हुए हैं',reconnecting:'फिर जुड़ रहे हैं',error:'जुड़ नहीं पाए'},
  en:{idle:'Offline',connecting:'Connecting',connected:'Connected',reconnecting:'Reconnecting',error:'Connection failed'},
};
const ERRORS:Array<[string,string]> = [
  ['सर्वर से संपर्क नहीं हुआ। स्थानीय सहायता सर्वर चालू है या नहीं, जाँचें और दोबारा कोशिश करें।','Could not reach the server. Check that the local help server is running, then try again.'],
  ['अनुमति नहीं मिली। ब्राउज़र की माइक या स्क्रीन की अनुमति जाँचें। आप लिखकर भी बता सकते हैं।','Permission was denied. Check browser microphone or screen permissions. You can also type your problem.'],
  ['माइक या कैमरा नहीं मिला। उसे जोड़ें, या लिखकर अपनी बात बताइए।','No microphone or camera was found. Connect one, or type your problem.'],
  ['माइक या कैमरा किसी दूसरे ऐप में चल रहा है। उसे बंद करके दोबारा कोशिश करें।','The microphone or camera is in use by another app. Close it, then try again.'],
  ['अभी यह काम पूरा नहीं हुआ। दोबारा कोशिश करें।','This action could not be completed. Try again.'],
  ['इस ब्राउज़र में आवाज़ की सुविधा उपलब्ध नहीं है। Chrome या Edge में localhost / HTTPS पर खोलें।','Voice is unavailable in this browser. Open Chrome or Edge on localhost or HTTPS.'],
  ['आवाज़ के सर्वर से समय पर जवाब नहीं मिला। दोबारा कोशिश करें।','The voice server did not respond in time. Try again.'],
  ['आवाज़ का कनेक्शन नहीं चल पाया।','The voice connection failed.'],['आवाज़ का कनेक्शन बंद हो गया।','The voice connection closed.'],
  ['तीन कोशिशों के बाद भी आवाज़ नहीं जुड़ी। इंटरनेट जाँचें, फिर “बात शुरू करें” दबाएँ।','Voice could not connect after three attempts. Check your internet connection, then press “Start talking”.'],
  ['बातचीत पूरी तरह सेव नहीं हुई। सहायता पेज दोबारा खोलकर समस्या बताइए। सुधार अभी शुरू नहीं होगा।','The conversation was not fully saved. Reopen app help and describe the problem. The fix cannot start yet.'],
  ['यह सुविधा उपलब्ध नहीं है।','This feature is unavailable.'],['संदेश सेव नहीं हुआ। सहायता पेज दोबारा खोलें।','The message was not saved. Reopen app help.'],['बात समाप्त हो गई।','The conversation ended.'],
  ['सत्र समाप्त है। सहायता फिर खोलें।','The session has expired. Reopen app help.'],['यह सत्र आपका नहीं है।','This session does not belong to you.'],['सत्र की पुष्टि नहीं हुई। सहायता फिर खोलें।','The session could not be verified. Reopen app help.'],['यह सेवा केवल स्थानीय उपयोग के लिए है।','This service is available only for local use.'],['अनुमति नहीं है।','Permission denied.'],['मान्य JPEG चित्र चुनें (अधिकतम 2 MB)।','Choose a valid JPEG image (up to 2 MB).'],['चित्र JPEG नहीं है।','The image is not a JPEG.'],['एक सत्र में अधिकतम आठ चित्र जोड़ें।','You can attach up to eight images per session.'],['यह उपकरण उपलब्ध नहीं है।','This tool is unavailable.'],['GitHub प्रकाशन के लिए स्थानीय GitHub साइन-इन या GITHUB_TOKEN जोड़ें।','Sign in to GitHub locally or set GITHUB_TOKEN to publish the fix.'],['सुधार का काम नहीं मिला।','The repair job was not found.'],['काम नहीं मिला।','The job was not found.'],['काम नहीं मिला','The job was not found.'],['सत्र नहीं मिला।','The session was not found.'],['सत्र नहीं मिला','The session was not found.'],['पूरा हो चुका कथन बदला नहीं जा सकता।','A finalized transcript turn cannot be changed.'],
  ['सुधार चल रहा है। नया विवरण देने से पहले उसे रोकें।','A repair is running. Stop it before preparing a new report.'],['पहले अपनी समस्या बताइए।','Describe your problem first.'],['यह चित्र इस सत्र का नहीं है।','This image does not belong to this session.'],['Repository का पूरा commit नहीं मिला।','The full repository commit was not found.'],['बात बदल गई है। नवीनतम विवरण से रिपोर्ट फिर बनाइए।','The conversation changed. Prepare a new report from the latest details.'],['विवरण बदल गया है। नया विवरण सुनकर पुष्टि करें।','The report changed. Listen to the new report and confirm it.'],['पहले समस्या का पूरा विवरण सुन लीजिए।','Listen to the full problem report first.'],['विवरण के बाद स्पष्ट रूप से सुधार शुरू करने को कहें।','After the report, clearly ask to start the fix.'],['आपने नई बात कही है। नई बात के बाद पुष्टि करें।','You added new information. Confirm the report after that information.'],['पुष्टि के दौरान विवरण बदल गया। फिर से सुनें।','The report changed during confirmation. Listen to it again.'],['आपने विवरण बदला है। नया विवरण बनाकर फिर पुष्टि करें।','You corrected the details. Prepare a new report, then confirm it.'],['सुधार शुरू करने की स्पष्ट अनुमति नहीं मिली।','Clear permission to start the fix was not received.'],['एक सुधार पहले से चल रहा है। उसके पूरा होने की प्रतीक्षा करें।','A repair is already running. Wait for it to finish.'],['GEMINI_API_KEY को स्थानीय .env.local में जोड़ें।','Set GEMINI_API_KEY in the local .env.local file.'],['Gemini ने पूरा संरचित उत्तर नहीं लौटाया।','Gemini did not return a complete structured response.'],['Live API ने टोकन नहीं दिया।','The Live API did not return a token.'],
  ['इस रिपोर्ट की पुष्टि फिर से करें।','Confirm this report again.'],['सुधार का समय पूरा हो गया।','The repair deadline was reached.'],['सुधार रोक दिया गया है।','The repair was stopped.'],['सुधार रोक दिया गया','The repair was stopped.'],['समस्या का विवरण नहीं मिला।','The problem report was not found.'],['सुधार पूरा नहीं हुआ। विवरण देखें।','The repair did not complete. Review the details.'],
  ['भाषा hi या en होनी चाहिए।','Language must be hi or en.'],
  ['Invalid or stale confirmed report.','रिपोर्ट अमान्य है या पुरानी हो गई है।'],['15-minute repair deadline exceeded.','सुधार की 15 मिनट की समय सीमा समाप्त हुई।'],['Repair deadline exceeded.','सुधार की समय सीमा समाप्त हुई।'],['Job cancelled.','सुधार रोक दिया गया है।'],['Missing report','समस्या की रिपोर्ट नहीं मिली।'],
];
export function localizeError(message:string,language:Language):string {
  // Only known interface errors are translated. Provider diagnostics remain original evidence.
  for(const [left,right] of ERRORS){
    const leftHindi=/[\u0900-\u097f]/.test(left);
    if(message===left)return language==='hi'?(leftHindi?left:right):(leftHindi?right:left);
    if(message===right)return language==='hi'?(leftHindi?left:right):(leftHindi?right:left);
  }
  const http=message.match(/^सर्वर से पूरा उत्तर नहीं मिला \(HTTP (\d+)\)।$/);
  if(http)return language==='en'?`The server returned an incomplete response (HTTP ${http[1]}).`:message;
  const failed=message.match(/^सर्वर का काम पूरा नहीं हुआ \(HTTP (\d+)\)।$/);
  if(failed)return language==='en'?`The server request failed (HTTP ${failed[1]}).`:message;
  return message;
}

const JOB_STAGES:Record<string,string> = {
  queued:'The repair is starting.',creating_interaction:'Starting the agent or sending verification results.',agent_running:'The agent is reproducing the problem and finding a fix.',repairing:'The agent is finding a fix.',building_published_preview:'Checking the published fix and building its preview.',preview_verified:'The fix is ready. Preview checks passed.',resuming_published_patch:'Resuming checks for the saved fix.',resuming_interaction:'Reconnecting to the agent’s existing work.',independent_verification:'Checking the original tests and fix in a separate container.',verification_revision:'Checks did not pass. The agent is making a small revision.',publishing_verified_patch:'Saving the verified fix in a draft pull request.',publication_acknowledgement_unknown:'The draft fix is saved; the agent acknowledgement needs checking.',invalid_report:'Confirm this report again.',create_outcome_unknown:'The agent request outcome is unclear. Check it before starting again.',unknown_dispatch:'The previous request outcome is unclear. Review it before restarting.',deadline_exceeded:'The repair deadline was reached.',cancelled:'The repair was stopped.',published_preview_needs_attention:'The draft fix is saved, but preview checks need attention.',repair_failed:'The repair did not complete. Review the details.',failed:'The repair did not complete. Review the details.',
};
const JOB_STATUS = {
  hi:{queued:'सुधार शुरू हो रहा है।',starting:'एजेंट शुरू हो रहा है।',running:'सुधार का काम चल रहा है।',verifying:'सुधार की जाँच चल रही है।',publishing:'सुधार प्रकाशित हो रहा है।',previewing:'प्रीव्यू बन रहा है।',completed:'सुधार तैयार है।',failed:'सुधार पूरा नहीं हुआ।',cancelled:'सुधार रोक दिया गया है।',needs_attention:'इस सुधार को जाँचने की ज़रूरत है।'},
  en:{queued:'The repair is queued.',starting:'The agent is starting.',running:'The repair is running.',verifying:'The fix is being verified.',publishing:'The fix is being published.',previewing:'The preview is being prepared.',completed:'The fix is ready.',failed:'The repair did not complete.',cancelled:'The repair was stopped.',needs_attention:'This repair needs attention.'},
};
export function jobMessage(job:import('../shared/types.js').FixJob,language:Language):string {
  if(language==='hi')return job.message_hi || JOB_STATUS.hi[job.status];
  return JOB_STAGES[job.stage] || JOB_STATUS.en[job.status];
}
