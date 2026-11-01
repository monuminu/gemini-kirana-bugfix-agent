import { describe, expect, it } from 'vitest';
import { extractLiveEvent, ModelTurnGate, ToolCallLedger, TurnAccumulator } from '../src/client/event-utils.js';

describe('Live event transport', () => {
  it('keeps every audio part and both transcripts in a mixed server event', () => {
    const result = extractLiveEvent({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { data: 'first', mimeType: 'audio/pcm;rate=24000' } }, { text: 'ignored thought', thought: true }, { inlineData: { data: 'second', mimeType: 'audio/pcm;rate=24000' } }] },
        inputTranscription: { text: 'चावल बेचा', finished: true },
        outputTranscription: { text: 'मैं समझ गई।' }, turnComplete: true,
      }, toolCallCancellation: { ids: ['cancel-me'] },
    });
    expect(result.audio).toEqual(['first', 'second']);
    expect(result.input).toEqual({ text: 'चावल बेचा', finished: true });
    expect(result.output?.text).toBe('मैं समझ गई।');
    expect(result.turnComplete).toBe(true);
    expect(result.cancelledCallIds).toEqual(['cancel-me']);
  });

  it('does not convert non-audio content parts into speaker audio', () => {
    expect(extractLiveEvent({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'jpeg', mimeType: 'image/jpeg' } }, { text: 'plain' }] } } }).audio).toEqual([]);
  });

  it('accumulates fragments without changing a turn’s chronological position', () => {
    const turns = new TurnAccumulator(() => 'turn-1');
    expect(turns.append('user', 'चावल ', false)).toEqual({ id: 'turn-1', role: 'user', text: 'चावल ', sequence: 1, finalized: false });
    expect(turns.append('user', 'बेचा', true)).toEqual({ id: 'turn-1', role: 'user', text: 'चावल बेचा', sequence: 1, finalized: true });
  });

  it('finalizes pending user transcription before model activity', () => {
    const turns = new TurnAccumulator(() => 'user-1');
    turns.append('user', 'एक समस्या है', false);
    expect(turns.finalize('user')).toEqual({ id: 'user-1', role: 'user', text: 'एक समस्या है', sequence: 1, finalized: true });
    expect(turns.finalize('user')).toBeUndefined();
  });

  it('never sends a second tool response for duplicate call IDs', () => {
    const ledger = new ToolCallLedger();
    expect(ledger.begin('call-1')).toBe(true);
    expect(ledger.begin('call-1')).toBe(false);
    expect(ledger.claimResponse('call-1')).toBe(true);
    expect(ledger.claimResponse('call-1')).toBe(false);
  });

  it('ignores late results after the model cancels a pending tool', () => {
    const ledger = new ToolCallLedger();
    ledger.begin('call-1');
    ledger.cancel(['call-1', 'future-call']);
    expect(ledger.claimResponse('call-1')).toBe(false);
    expect(ledger.begin('future-call')).toBe(false);
  });

  it('identifies cancellation before a queued side effect begins', () => {
    const ledger = new ToolCallLedger();
    ledger.begin('queued');
    expect(ledger.isPending('queued')).toBe(true);
    ledger.cancel(['queued']);
    expect(ledger.isPending('queued')).toBe(false);
  });

  it('marks a spoken turn complete only after its speaker queue drains', () => {
    const gate = new ModelTurnGate();
    gate.begin('model-1');
    expect(gate.serverComplete(false)).toBeUndefined();
    expect(gate.speakerDrained()).toBe('model-1');
    expect(gate.speakerDrained()).toBeUndefined();
  });

  it('never marks an interrupted readback complete when stopped audio drains', () => {
    const gate = new ModelTurnGate();
    gate.begin('model-1');
    gate.serverComplete(false);
    gate.interrupt();
    expect(gate.speakerDrained()).toBeUndefined();
  });
});
