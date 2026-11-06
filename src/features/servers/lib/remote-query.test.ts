import { describe, it, expect } from 'vitest';
import { buildRemoteQuery, candidatesFor, parseDateToken, REMOTE_RETURN_KEYS } from './remote-query';

describe('parseDateToken — die Schreibweisen aus der Praxis', () => {
  it.each([
    ['03.06.2026', '20260603'],
    ['3.6.2026', '20260603'],
    ['03.06.26', '20260603'],
    ['2026-06-03', '20260603'],
    ['03/06/2026', '20260603'],
    ['03062026', '20260603'],
    ['030626', '20260603'],
    ['020592', '19920502'],
    ['19920502', '19920502'],
  ])('%s → %s', (input, expected) => {
    expect(parseDateToken(input)).toBe(expected);
  });

  it('versteht das verstümmelte 4-stellige Datum 3623 als 3.6.23', () => {
    expect(parseDateToken('3623')).toBe('20230603');
  });

  it('liest vier Ziffern als Tag.Monat.Jahr ohne führende Nullen', () => {
    // 2512 ist bei vier Ziffern nur als 2.5.12 lesbar (Tag und Monat einstellig)
    expect(parseDateToken('2512')).toBe('20120502'); // 2.5.2012
    // 00 als Tag gibt es nicht
    expect(parseDateToken('0012')).toBeUndefined();
  });

  it('lässt ungültige Werte fallen', () => {
    expect(parseDateToken('321399')).toBeUndefined();
    expect(parseDateToken('123456')).toBeUndefined();
    expect(parseDateToken('Muster')).toBeUndefined();
  });

  it('löst zweistellige Jahre relativ zum laufenden Jahr auf', () => {
    const currentYY = new Date().getFullYear() % 100;
    expect(parseDateToken(`01.01.${String(currentYY).padStart(2, '0')}`)).toBe(
      `${new Date().getFullYear()}0101`,
    );
    expect(parseDateToken('01.01.92')).toBe('19920101');
  });
});

describe('candidatesFor — wahrscheinlichste Deutung zuerst', () => {
  it('Datum vor ID vor Zugangsnummer', () => {
    expect(candidatesFor('030626')).toEqual(['birthDate', 'patientId', 'accession']);
    expect(candidatesFor('3623')).toEqual(['birthDate', 'patientId', 'accession']);
  });

  it('reine Zahl ohne Datum ist eine ID', () => {
    expect(candidatesFor('123456')).toEqual(['patientId', 'accession']);
  });

  it('Name bleibt Name, solange er nicht mehrdeutig ist', () => {
    expect(candidatesFor('Muster')).toEqual(['name']);
    expect(candidatesFor('E2E')).toEqual(['name', 'accession']);
  });

  it('Modalität wird erkannt', () => {
    expect(candidatesFor('CT')).toEqual(['modality']);
  });
});

describe('buildRemoteQuery — der Alltag: Nachname,Vorname,Geburtsdatum', () => {
  it('baut aus Muster,Erika,030626 die Abfrage', () => {
    const plan = buildRemoteQuery('Muster,Erika,030626');

    expect(plan.query.PatientName).toBe('MUSTER*^ERIKA*');
    expect(plan.query.PatientBirthDate).toBe('20260603');
    expect(plan.chips.map((chip) => chip.kind)).toEqual(['name', 'birthDate']);
  });

  it('akzeptiert auch Leerzeichen statt Kommas', () => {
    const plan = buildRemoteQuery('Muster Erika 020592');
    expect(plan.query.PatientName).toBe('MUSTER*^ERIKA*');
    expect(plan.query.PatientBirthDate).toBe('19920502');
  });

  it('nimmt ein Datum ohne Namen als Geburtsdatum', () => {
    expect(buildRemoteQuery('3623').query.PatientBirthDate).toBe('20230603');
  });

  it('nimmt eine reine Zahl ohne Datum als Patienten-ID', () => {
    const plan = buildRemoteQuery('123456');
    expect(plan.query.PatientID).toBe('123456');
    expect(plan.query.PatientBirthDate).toBe('');
  });

  it('nimmt die Zugangsnummer mit Bindestrich', () => {
    expect(buildRemoteQuery('ACC-2026-17').query.AccessionNumber).toBe('ACC-2026-17');
  });

  it('macht aus datum: ein Studiendatum statt eines Geburtsdatums', () => {
    const plan = buildRemoteQuery('Muster,datum:03.06.2026');
    expect(plan.query.StudyDate).toBe('20260603');
    expect(plan.query.PatientBirthDate).toBe('');
    expect(plan.chips.map((chip) => chip.kind)).toEqual(['name', 'studyDate']);
  });

  it('erzwingt das Geburtsdatum mit geb:', () => {
    const plan = buildRemoteQuery('geb:020592');
    expect(plan.query.PatientBirthDate).toBe('19920502');
  });

  it('lässt Felder per Präfix erzwingen', () => {
    expect(buildRemoteQuery('id:4711').query.PatientID).toBe('4711');
    expect(buildRemoteQuery('acc:4711').query.AccessionNumber).toBe('4711');
    expect(buildRemoteQuery('name:4711').query.PatientName).toBe('4711*');
  });

  it('verbindet Vor- und Nachnamen mit ^', () => {
    expect(buildRemoteQuery('Muster Erika').query.PatientName).toBe('MUSTER*^ERIKA*');
    expect(buildRemoteQuery('Muster, Erika').query.PatientName).toBe('MUSTER*^ERIKA*');
  });

  it('lässt vorhandene Platzhalter unangetastet', () => {
    expect(buildRemoteQuery('Muster*').query.PatientName).toBe('MUSTER*');
    expect(buildRemoteQuery('M?ller').query.PatientName).toBe('M?LLER*');
  });

  it('versteht eine Modalität', () => {
    expect(buildRemoteQuery('CT').query.ModalitiesInStudy).toBe('CT');
  });

  it('kombiniert Name, Geburtsdatum und Modalität', () => {
    const plan = buildRemoteQuery('Muster,020592,CT');
    expect(plan.query).toMatchObject({
      PatientName: 'MUSTER*',
      PatientBirthDate: '19920502',
      ModalitiesInStudy: 'CT',
    });
    expect(plan.chips.map((chip) => chip.kind)).toEqual(['name', 'birthDate', 'modality']);
  });

  it('meldet ein Datum ohne Jahr als nicht verwendbar', () => {
    const plan = buildRemoteQuery('29.08.');
    expect(plan.ignored).toContain('29.08.');
    expect(plan.query.PatientBirthDate).toBe('');
  });

  it('fordert immer die Felder an, die die Trefferliste anzeigt', () => {
    const plan = buildRemoteQuery('Muster');
    for (const key of Object.keys(REMOTE_RETURN_KEYS)) {
      expect(plan.query).toHaveProperty(key);
    }
    expect(plan.query.PatientBirthDate).toBe('');
  });

  it('fragt ohne Eingabe nichts ab', () => {
    const plan = buildRemoteQuery('   ');
    expect(plan.chips).toEqual([]);
    expect(plan.query.PatientName).toBe('');
  });
});

describe('buildRemoteQuery — Zweitdeutungen für mehrdeutige Zahlen', () => {
  it('bietet für ein Geburtsdatum auch die ID an', () => {
    const plan = buildRemoteQuery('030626');
    expect(plan.query.PatientBirthDate).toBe('20260603');
    expect(plan.alternatives.map((alt) => alt.chip.kind)).toContain('patientId');
  });

  it('bietet für 3623 die ID an, wenn das Geburtsdatum nichts trifft', () => {
    const plan = buildRemoteQuery('3623');
    const asId = plan.alternatives.find((alt) => alt.chip.kind === 'patientId');
    expect(asId?.query.PatientID).toBe('3623');
    expect(asId?.query.PatientBirthDate).toBe('');
  });

  it('bietet für einen Namen mit Ziffern die Zugangsnummer an', () => {
    const plan = buildRemoteQuery('E2E');
    expect(plan.query.PatientName).toBe('E2E*');
    expect(plan.alternatives[0]?.chip.kind).toBe('accession');
  });

  it('führt dieselbe Variante nicht doppelt auf', () => {
    const plan = buildRemoteQuery('030626');
    const kinds = plan.alternatives.map((alt) => alt.chip.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('übernimmt den Namen in jede Variante', () => {
    const plan = buildRemoteQuery('Muster,030626');
    for (const alt of plan.alternatives) {
      expect(alt.query.PatientName).toBe('MUSTER*');
    }
  });
});

describe('buildRemoteQuery — Beschreibung und Study Instance UID', () => {
  it('sucht mit desc: in der Studienbeschreibung (enthält)', () => {
    const plan = buildRemoteQuery('Muster,desc:CT Thorax');
    expect(plan.query.PatientName).toBe('MUSTER*');
    expect(plan.query.StudyDescription).toBe('*CT THORAX*');
    expect(plan.chips.map((chip) => chip.kind)).toEqual(['name', 'studyDescription']);
  });

  it('nimmt den ganzen Text hinter dem Präfix, auch mit Leerzeichen', () => {
    expect(buildRemoteQuery('beschreibung:CT Thorax nativ').query.StudyDescription).toBe(
      '*CT THORAX NATIV*',
    );
  });

  it('bietet für Beschreibungen zusätzlich die Präfix-Suche an', () => {
    const plan = buildRemoteQuery('desc:CT Thorax');
    const alt = plan.alternatives.find((entry) => entry.chip.kind === 'studyDescription');
    expect(alt?.query.StudyDescription).toBe('CT THORAX*');
  });

  it('erkennt eine Study Instance UID an den Punktblöcken', () => {
    const uid = '1.2.276.0.7230010.3.1.2.1650800183.1.1793969725.908463';
    const plan = buildRemoteQuery(uid);
    expect(plan.query.StudyInstanceUID).toBe(uid);
    expect(plan.query.PatientName).toBe('');
  });

  it('lässt die UID auch per Präfix erzwingen', () => {
    expect(buildRemoteQuery('uid:1.2.3').query.StudyInstanceUID).toBe('1.2.3');
  });

  it('kombiniert Name, Beschreibung, Geburtsdatum und Zugangsnummer', () => {
    const plan = buildRemoteQuery('Muster,desc:CT Thorax,020592,ACC-17');
    expect(plan.query).toMatchObject({
      PatientName: 'MUSTER*',
      StudyDescription: '*CT THORAX*',
      PatientBirthDate: '19920502',
      AccessionNumber: 'ACC-17',
    });
  });
});

describe('buildRemoteQuery — Position nach dem Komma', () => {
  it('liest Müller,Paul,030847,MRT,07.08.2026 positional', () => {
    const plan = buildRemoteQuery('müller,paul,030847,mrt,07.08.2026');

    expect(plan.query.PatientName).toBe('MÜLLER*^PAUL*');
    expect(plan.query.PatientBirthDate).toBe('19470803');
    expect(plan.query.StudyDescription).toBe('*MRT*');
    expect(plan.query.StudyDate).toBe('20260807');
    expect(plan.chips.map((chip) => chip.kind)).toEqual([
      'name',
      'birthDate',
      'studyDescription',
      'studyDate',
    ]);
  });

  it('nimmt an Position 6 die Zugangsnummer und an 7 die Modalität', () => {
    const plan = buildRemoteQuery('Muster,Erika,020592,MRT Schädel,07.08.2026,ACC-17,MR');
    expect(plan.query).toMatchObject({
      PatientName: 'MUSTER*^ERIKA*',
      PatientBirthDate: '19920502',
      StudyDescription: '*MRT SCHÄDEL*',
      StudyDate: '20260807',
      AccessionNumber: 'ACC-17',
      ModalitiesInStudy: 'MR',
    });
  });

  it('gibt auf, wenn der Inhalt nicht zur Position passt', () => {
    // An Position 3 steht kein Datum, sondern eine Zugangsnummer
    const plan = buildRemoteQuery('Muster,ACC-17');
    expect(plan.query.PatientName).toBe('MUSTER*');
    expect(plan.query.AccessionNumber).toBe('ACC-17');
  });

  it('schaltet bei Präfixen auf Inhaltserkennung um', () => {
    // gemischt: Position wäre nicht mehr eindeutig
    const plan = buildRemoteQuery('Muster,desc:MRT,020592');
    expect(plan.query.PatientName).toBe('MUSTER*');
    expect(plan.query.StudyDescription).toBe('*MRT*');
    expect(plan.query.PatientBirthDate).toBe('19920502');
  });

  it('erkennt ein einzelnes Datum weiterhin am Inhalt', () => {
    // eine Angabe: Position 1 wäre „Nachname“ — das wäre falsch
    expect(buildRemoteQuery('020592').query.PatientBirthDate).toBe('19920502');
  });

  it('übersetzt deutsche Modalitätskürzel', () => {
    expect(buildRemoteQuery('mod:MRT').query.ModalitiesInStudy).toBe('MR');
    expect(buildRemoteQuery('mod:sono').query.ModalitiesInStudy).toBe('US');
  });
});

describe('buildRemoteQuery — leere Felder halten die Position', () => {
  it('überspringt die Beschreibung mit einem leeren Feld', () => {
    const plan = buildRemoteQuery('müller,paul,030847,,07.08.2026');

    expect(plan.query.PatientName).toBe('MÜLLER*^PAUL*');
    expect(plan.query.PatientBirthDate).toBe('19470803');
    expect(plan.query.StudyDescription).toBe('');
    expect(plan.query.StudyDate).toBe('20260807');
    expect(plan.chips.map((chip) => chip.kind)).toEqual(['name', 'birthDate', 'studyDate']);
  });

  it('überspringt den Vornamen', () => {
    const plan = buildRemoteQuery('müller,,030847');
    expect(plan.query.PatientName).toBe('MÜLLER*');
    expect(plan.query.PatientBirthDate).toBe('19470803');
  });

  it('ignoriert ein abschließendes Komma', () => {
    const plan = buildRemoteQuery('müller,paul,');
    expect(plan.query.PatientName).toBe('MÜLLER*^PAUL*');
    expect(plan.chips).toHaveLength(1);
  });

  it('fragt bei nur einem gefüllten Feld nichts Positionales ab', () => {
    // „,,020592“ ist eine einzelne Angabe — sie wird am Inhalt erkannt
    const plan = buildRemoteQuery(',,020592');
    expect(plan.query.PatientBirthDate).toBe('19920502');
    expect(plan.query.PatientName).toBe('');
  });

  it('hält die Position auch für die Zugangsnummer frei', () => {
    const plan = buildRemoteQuery('müller,paul,030847,,,ACC-17');
    expect(plan.query.AccessionNumber).toBe('ACC-17');
    expect(plan.query.StudyDate).toBe('');
  });
});

describe('buildRemoteQuery — unvollständige Namen', () => {
  it('macht aus jedem Namensteil eine Präfix-Suche', () => {
    // so findet man „mummelthei^manuel“, ohne alles auszuschreiben
    expect(buildRemoteQuery('mumm man').query.PatientName).toBe('MUMM*^MAN*');
  });

  it('lässt mitgegebene Platzhalter stehen', () => {
    expect(buildRemoteQuery('mumm*^man*').query.PatientName).toBe('MUMM*^MAN*');
    expect(buildRemoteQuery('mumm* man').query.PatientName).toBe('MUMM*^MAN*');
  });

  it('versteht das Prozentzeichen als Wildcard', () => {
    expect(buildRemoteQuery('mumm% man%').query.PatientName).toBe('MUMM*^MAN*');
    expect(buildRemoteQuery('mumm%').query.PatientName).toBe('MUMM*');
  });

  it('ergänzt nur, wo kein Platzhalter steht', () => {
    expect(buildRemoteQuery('mu?ler man').query.PatientName).toBe('MU?LER*^MAN*');
  });
});
