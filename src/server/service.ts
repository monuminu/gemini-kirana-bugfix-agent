import { randomUUID } from 'node:crypto';
import { Store } from './store.js';
import type { BriefProvider } from './provider.js';
import type { BugBrief, FixJob } from '../shared/types.js';
import { TERMINAL_STATUSES } from '../shared/types.js';

export class BugService {
  private dispatchQueue: Promise<unknown> = Promise.resolve();
  constructor(readonly store: Store, readonly provider: BriefProvider,
    readonly resolveBase: () => Promise<string>, readonly repository: string,
    readonly baseBranch: string) {}

  private userSnapshot(sessionId: string): string {
    return JSON.stringify(this.store.turns(sessionId).filter(t => t.role === 'user')
      .map(t => [t.id, t.text, t.sequence, t.finalized]));
  }

  async prepare(sessionId: string, evidenceIds: string[]): Promise<BugBrief> {
    const session = this.store.getSession(sessionId);
    if (!session) throw new Error('सत्र नहीं मिला।');
    if (this.store.listJobs().some(j => j.session_id === sessionId && !TERMINAL_STATUSES.includes(j.status)))
      throw new Error('सुधार चल रहा है। नया विवरण देने से पहले उसे रोकें।');
    const turns = this.store.turns(sessionId);
    if (!turns.some(t => t.role === 'user' && t.finalized && t.text.trim()))
      throw new Error('पहले अपनी समस्या बताइए।');
    const evidence = this.store.evidence(sessionId);
    if (evidenceIds.some(id => !evidence.some(e => e.id === id)))
      throw new Error('यह चित्र इस सत्र का नहीं है।');
    const selected = evidence.filter(e => evidenceIds.includes(e.id));
    const snapshot = this.userSnapshot(sessionId);
    const generation = (session.report_generation ?? 0) + 1;
    this.store.updateSession(sessionId, { report_generation: generation });
    if (session.active_report_id) {
      const previous = this.store.getReport(session.active_report_id);
      if (previous) this.store.saveReport({ ...previous, invalidated: true });
    }
    const content = await this.provider.createBrief(turns, selected);
    const baseSha = await this.resolveBase();
    if (!/^[a-f0-9]{40}$/.test(baseSha)) throw new Error('Repository का पूरा commit नहीं मिला।');
    const current = this.store.getSession(sessionId)!;
    if (current.report_generation !== generation || this.userSnapshot(sessionId) !== snapshot)
      throw new Error('बात बदल गई है। नवीनतम विवरण से रिपोर्ट फिर बनाइए।');
    const brief: BugBrief = {
      ...content, id: randomUUID(), session_id: sessionId, version: current.version + 1,
      evidence_ids: selected.map(e => e.id), repository: this.repository, base_sha: baseSha,
      base_branch: this.baseBranch, created_at: new Date().toISOString(), readback_epoch: 0,
    };
    this.store.saveReport(brief);
    this.store.updateSession(sessionId, { version: brief.version, active_report_id: brief.id });
    return brief;
  }

  async completeReadback(sessionId: string, turnId: string) {
    const session = this.store.getSession(sessionId);
    const brief = session?.active_report_id ? this.store.getReport(session.active_report_id) : undefined;
    const turn = this.store.turns(sessionId).find(t => t.id === turnId);
    if (!brief || brief.invalidated || !turn || turn.role !== 'model' || !turn.finalized ||
        Date.parse(turn.created_at) < Date.parse(brief.created_at)) return { ready: false };
    const epoch = brief.readback_epoch ?? 0;
    if (!await this.provider.validateReadback(brief, turn)) return { ready: false };
    const current = this.store.getReport(brief.id);
    if (!current || current.invalidated || (current.readback_epoch ?? 0) !== epoch ||
        this.store.getSession(sessionId)?.active_report_id !== brief.id) return { ready: false };
    this.store.saveReport({ ...current, readback_turn_id: turn.id, readback_sequence: turn.sequence });
    return { ready: true, report_id: brief.id, version: brief.version };
  }

  interrupt(sessionId: string) {
    const session = this.store.getSession(sessionId);
    const brief = session?.active_report_id ? this.store.getReport(session.active_report_id) : undefined;
    if (brief) {
      const { readback_turn_id: _id, readback_sequence: _sequence, ...rest } = brief;
      this.store.saveReport({ ...rest, readback_epoch: (brief.readback_epoch ?? 0) + 1 });
    }
  }

  async dispatch(sessionId: string, reportId: string, version: number, consentTurnId?: string): Promise<FixJob> {
    const task = this.dispatchQueue.then(() => this.dispatchLocked(sessionId, reportId, version, consentTurnId));
    this.dispatchQueue = task.catch(() => {});
    return task;
  }

  private async dispatchLocked(sessionId: string, reportId: string, version: number,
    consentTurnId?: string): Promise<FixJob> {
    const session = this.store.getSession(sessionId), brief = this.store.getReport(reportId);
    if (!session || !brief || brief.session_id !== sessionId || session.active_report_id !== reportId ||
        brief.version !== version || brief.invalidated)
      throw new Error('विवरण बदल गया है। नया विवरण सुनकर पुष्टि करें।');
    const existing = this.store.listJobs().find(j => j.report_id === reportId);
    if (existing) return existing;
    if (!brief.readback_turn_id || brief.readback_sequence === undefined)
      throw new Error('पहले समस्या का पूरा विवरण सुन लीजिए।');
    const context = this.store.turns(sessionId);
    const newest = context.filter(t => t.role === 'user' && t.finalized).at(-1);
    const turn = consentTurnId ? context.find(t => t.id === consentTurnId) : newest;
    if (!turn || turn.role !== 'user' || !turn.finalized || turn.id !== newest?.id ||
        turn.sequence <= brief.readback_sequence)
      throw new Error('विवरण के बाद स्पष्ट रूप से सुधार शुरू करने को कहें।');
    const snapshot = this.userSnapshot(sessionId);
    const decision = await this.provider.classifyConsent(brief, turn, context.slice(-12));
    if (snapshot !== this.userSnapshot(sessionId))
      throw new Error('आपने नई बात कही है। नई बात के बाद पुष्टि करें।');
    const latest = this.store.getReport(reportId);
    if (!latest || latest.invalidated || this.store.getSession(sessionId)?.active_report_id !== reportId ||
        latest.readback_turn_id !== brief.readback_turn_id || latest.readback_epoch !== brief.readback_epoch)
      throw new Error('पुष्टि के दौरान विवरण बदल गया। फिर से सुनें।');
    if (decision === 'correction') {
      this.store.saveReport({ ...latest, invalidated: true });
      throw new Error('आपने विवरण बदला है। नया विवरण बनाकर फिर पुष्टि करें।');
    }
    if (decision !== 'approve') throw new Error('सुधार शुरू करने की स्पष्ट अनुमति नहीं मिली।');
    if (this.store.listJobs().some(j => !TERMINAL_STATUSES.includes(j.status)))
      throw new Error('एक सुधार पहले से चल रहा है। उसके पूरा होने की प्रतीक्षा करें।');
    const now = new Date();
    const job: FixJob = {
      id: randomUUID(), session_id: sessionId, report_id: reportId, status: 'queued', stage: 'queued',
      message_hi: 'सुधार का काम शुरू हो रहा है।', attempt: 0, created_at: now.toISOString(),
      updated_at: now.toISOString(), deadline_at: new Date(now.getTime() + 900000).toISOString(),
    };
    this.store.saveJob(job);
    return job;
  }
}
