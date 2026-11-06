import { describe, it, expect } from 'vitest';
import { buildRemoteQuery, REMOTE_RETURN_KEYS } from './remote-query';

describe('buildRemoteQuery — eine Suchzeile wird zur C-FIND-Abfrage', () => {
  it('macht aus einem Namen eine Präfix-Suche (kein führendes *)', () => {
    const plan = buildRemoteQuery('muster');
    expect(plan.query.PatientName).toBe('MUSTER*');
    expect(plan.chips).toEqual([{ kind: 'name', value: 'MUSTER*' }]);
  });

  it('verbindet Vor- und Nachnamen mit ^', () => {
    expect(buildRemoteQuery('Muster Erika').query.PatientName).toBe('MUSTER^ERIKA*');
    expect(buildRemoteQuery('Muster, Erika').query.PatientName).toBe('MUSTER^ERIKA*');
  });

  it('lässt vorhandene Platzhalter unangetastet', () => {
    expect(buildRemoteQuery('Muster*').query.PatientName).toBe('MUSTER*');
    // Platzhalter mitten im Muster bleiben stehen, der Präfix-Stern kommt dazu
    expect(buildRemoteQuery('M?ller').query.PatientName).toBe('M?LLER*');
  });

  it('erkennt eine reine Zahl als Patienten-ID', () => {
    const plan = buildRemoteQuery('123456');
    expect(plan.query.PatientID).toBe('123456');
    expect(plan.query.PatientName).toBe('');
  });

  it('erkennt eine Zugangsnummer', () => {
    const plan = buildRemoteQuery('ACC-2026-17');
    expect(plan.query.AccessionNumber).toBe('ACC-2026-17');
    expect(plan.chips).toContainEqual({ kind: 'accession', value: 'ACC-2026-17' });
  });

  it('erkennt Datumsangaben in allen üblichen Schreibweisen', () => {
    expect(buildRemoteQuery('29.08.2026').query.StudyDate).toBe('20260829');
    expect(buildRemoteQuery('2026-08-29').query.StudyDate).toBe('20260829');
    expect(buildRemoteQuery('20260829').query.StudyDate).toBe('20260829');
    expect(buildRemoteQuery('29.08.26').query.StudyDate).toBe('20260829');
  });

  it('baut aus zwei Daten einen Bereich', () => {
    expect(buildRemoteQuery('01.01.2026-31.01.2026').query.StudyDate).toBe('20260101-20260131');
    expect(buildRemoteQuery('20260101-20260131').query.StudyDate).toBe('20260101-20260131');
  });

  it('versteht eine Modalität', () => {
    const plan = buildRemoteQuery('CT');
    expect(plan.query.ModalitiesInStudy).toBe('CT');
  });

  it('kombiniert Name, Datum und Modalität', () => {
    const plan = buildRemoteQuery('Muster 29.08.2026 CT');
    expect(plan.query).toMatchObject({
      PatientName: 'MUSTER*',
      StudyDate: '20260829',
      ModalitiesInStudy: 'CT',
    });
    expect(plan.chips.map((chip) => chip.kind)).toEqual(['name', 'date', 'modality']);
  });

  it('lässt Felder per Präfix erzwingen', () => {
    expect(buildRemoteQuery('id:4711').query.PatientID).toBe('4711');
    expect(buildRemoteQuery('acc:4711').query.AccessionNumber).toBe('4711');
    expect(buildRemoteQuery('name:4711').query.PatientName).toBe('4711*');
    expect(buildRemoteQuery('date:29.08.2026').query.StudyDate).toBe('20260829');
  });

  it('meldet ein Datum ohne Jahr als nicht verwendbar', () => {
    const plan = buildRemoteQuery('29.08.');
    expect(plan.ignored).toContain('29.08.');
    expect(plan.query.StudyDate).toBe('');
  });

  it('bietet für mehrdeutige Teile eine Zweitdeutung an', () => {
    const nameFirst = buildRemoteQuery('E2E');
    expect(nameFirst.query.PatientName).toBe('E2E*');
    expect(nameFirst.alternatives[0]?.chip.kind).toBe('accession');

    const accessionFirst = buildRemoteQuery('ACC-1');
    expect(accessionFirst.query.AccessionNumber).toBe('ACC-1');
    expect(accessionFirst.alternatives[0]?.chip.kind).toBe('patientId');
  });

  it('fordert immer die Felder an, die die Trefferliste anzeigt', () => {
    const plan = buildRemoteQuery('Muster');
    for (const key of Object.keys(REMOTE_RETURN_KEYS)) {
      expect(plan.query).toHaveProperty(key);
    }
    expect(plan.query.PatientName).toBe('MUSTER*');
  });

  it('fragt ohne Eingabe nichts ab', () => {
    const plan = buildRemoteQuery('   ');
    expect(plan.chips).toEqual([]);
    expect(plan.query.PatientName).toBe('');
    expect(plan.query.StudyDate).toBe('');
  });
});
