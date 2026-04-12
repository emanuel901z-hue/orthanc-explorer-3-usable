import { Study, Series, Instance, DicomTag, DicomModality, DicomWebServer } from '@/shared/types';
import { subDays, subYears, addHours } from 'date-fns';

const FIRST_NAMES_M = [
  'James',
  'Robert',
  'Michael',
  'William',
  'David',
  'Richard',
  'Thomas',
  'Charles',
  'Daniel',
  'Matthew',
];
const FIRST_NAMES_F = [
  'Mary',
  'Patricia',
  'Jennifer',
  'Linda',
  'Barbara',
  'Elizabeth',
  'Susan',
  'Jessica',
  'Sarah',
  'Karen',
];
const LAST_NAMES = [
  'Anderson',
  'Thompson',
  'Martinez',
  'Robinson',
  'Clark',
  'Rodriguez',
  'Lewis',
  'Lee',
  'Walker',
  'Hall',
  'Allen',
  'Young',
  'Hernandez',
  'King',
  'Wright',
  'Lopez',
  'Hill',
  'Scott',
  'Green',
  'Adams',
];

interface Patient {
  id: string;
  name: string;
  birthDate: Date;
  sex: 'M' | 'F';
}

function generatePatients(count: number): Patient[] {
  return Array.from({ length: count }, (_, i) => {
    const sex: 'M' | 'F' = Math.random() > 0.5 ? 'M' : 'F';
    const firstNames = sex === 'M' ? FIRST_NAMES_M : FIRST_NAMES_F;
    const firstName = firstNames[i % firstNames.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    return {
      id: `PAT${String(i + 1).padStart(6, '0')}`,
      name: `${lastName}^${firstName}`,
      birthDate: subYears(new Date(), Math.floor(Math.random() * 60) + 20),
      sex,
    };
  });
}

const STUDY_TEMPLATES: { modality: string; descriptions: string[] }[] = [
  {
    modality: 'CT',
    descriptions: [
      'CT Chest with Contrast',
      'CT Abdomen Pelvis',
      'CT Head without Contrast',
      'CT Angiography Chest',
      'CT Spine Lumbar',
    ],
  },
  {
    modality: 'MR',
    descriptions: [
      'MRI Brain with and without Contrast',
      'MRI Knee Left',
      'MRI Lumbar Spine',
      'MRI Shoulder Right',
      'MRI Cardiac',
    ],
  },
  {
    modality: 'US',
    descriptions: [
      'US Abdomen Complete',
      'US Thyroid',
      'US Renal',
      'US Carotid Doppler',
      'US Obstetric',
    ],
  },
  {
    modality: 'CR',
    descriptions: ['CR Chest PA and Lateral', 'CR Hand Left', 'CR Foot Right', 'CR Pelvis AP'],
  },
  {
    modality: 'DX',
    descriptions: ['DX Chest', 'DX Spine Cervical', 'DX Knee Bilateral', 'DX Ankle Right'],
  },
  {
    modality: 'PT',
    descriptions: ['PET/CT Whole Body', 'PET Brain FDG', 'PET/CT Oncology Follow-up'],
  },
  {
    modality: 'NM',
    descriptions: ['NM Bone Scan Whole Body', 'NM Thyroid Uptake', 'NM Myocardial Perfusion'],
  },
];

const LABELS = ['Urgent', 'Reviewed', 'Exported', 'Teaching', 'Follow-up', 'AI Processed'];

export function generateDemoStudies(count: number): Study[] {
  const patients = generatePatients(25);

  return Array.from({ length: count }, (_, i) => {
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const template = STUDY_TEMPLATES[Math.floor(Math.random() * STUDY_TEMPLATES.length)];
    const description =
      template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
    const studyDate = subDays(new Date(), Math.floor(Math.random() * 365));
    const numSeries = Math.floor(Math.random() * 6) + 1;
    const numInstances = numSeries * (Math.floor(Math.random() * 80) + 10);
    const labels: string[] = [];
    if (Math.random() > 0.7) {
      labels.push(LABELS[Math.floor(Math.random() * LABELS.length)]);
      if (Math.random() > 0.6) labels.push(LABELS[Math.floor(Math.random() * LABELS.length)]);
    }

    return {
      id: `study-${String(i).padStart(4, '0')}`,
      patientId: patient.id,
      patientName: patient.name,
      patientBirthDate: patient.birthDate,
      patientSex: patient.sex,
      studyInstanceUID: `1.2.840.113619.${Date.now()}.${i}.${Math.floor(Math.random() * 99999)}`,
      studyDate,
      studyTime: `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      studyDescription: description,
      accessionNumber: `ACC${String(i + 1000).padStart(8, '0')}`,
      modalities: [template.modality],
      numberOfSeries: numSeries,
      numberOfInstances: numInstances,
      diskSize: numInstances * (Math.floor(Math.random() * 500000) + 100000),
      labels: [...new Set(labels)],
      isStable: Math.random() > 0.05,
      lastUpdate: addHours(studyDate, Math.floor(Math.random() * 48)),
    };
  });
}

export function generateDemoSeries(studyId: string, modality: string, count: number): Series[] {
  const descriptions: Record<string, string[]> = {
    CT: ['Axial', 'Coronal', 'Sagittal', 'Scout', 'Bone Window', '3D Reconstruction'],
    MR: ['T1 Axial', 'T2 Axial', 'FLAIR', 'DWI', 'T1 Post Contrast', 'MRA'],
    US: ['B-mode', 'Doppler', 'M-mode'],
    CR: ['PA', 'Lateral', 'AP'],
    DX: ['AP', 'Lateral', 'Oblique'],
    PT: ['PET Corrected', 'CT Attenuation', 'Fused'],
    NM: ['Anterior', 'Posterior', 'SPECT'],
  };
  const descs = descriptions[modality] || ['Series'];

  return Array.from({ length: count }, (_, i) => ({
    id: `series-${studyId}-${i}`,
    studyId,
    seriesInstanceUID: `1.2.840.113619.${Date.now()}.${studyId}.${i}`,
    seriesNumber: i + 1,
    seriesDescription: descs[i % descs.length],
    modality,
    numberOfInstances: Math.floor(Math.random() * 120) + 5,
  }));
}

const SOP_CLASSES: Record<string, string> = {
  CT: '1.2.840.10008.5.1.4.1.1.2',
  MR: '1.2.840.10008.5.1.4.1.1.4',
  US: '1.2.840.10008.5.1.4.1.1.6.1',
  CR: '1.2.840.10008.5.1.4.1.1.1',
  DX: '1.2.840.10008.5.1.4.1.1.1.1',
  PT: '1.2.840.10008.5.1.4.1.1.128',
  NM: '1.2.840.10008.5.1.4.1.1.20',
};

const TRANSFER_SYNTAXES = [
  '1.2.840.10008.1.2.1', // Explicit VR Little Endian
  '1.2.840.10008.1.2', // Implicit VR Little Endian
  '1.2.840.10008.1.2.4.70', // JPEG Lossless
  '1.2.840.10008.1.2.4.90', // JPEG 2000 Lossless
];

export function generateDemoInstances(
  seriesId: string,
  modality: string,
  count: number,
): Instance[] {
  const sopClassUID = SOP_CLASSES[modality] || '1.2.840.10008.5.1.4.1.1.2';
  const transferSyntax = TRANSFER_SYNTAXES[Math.floor(Math.random() * TRANSFER_SYNTAXES.length)];

  return Array.from({ length: count }, (_, i) => {
    const fileSize = Math.floor(Math.random() * 800000) + 50000;
    const tags: DicomTag[] = [
      { tag: '(0008,0016)', name: 'SOP Class UID', vr: 'UI', value: sopClassUID },
      {
        tag: '(0008,0018)',
        name: 'SOP Instance UID',
        vr: 'UI',
        value: `1.2.840.113619.${Date.now()}.${seriesId}.${i}`,
      },
      { tag: '(0020,0013)', name: 'Instance Number', vr: 'IS', value: String(i + 1) },
      { tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: modality },
      { tag: '(0028,0010)', name: 'Rows', vr: 'US', value: String(512) },
      { tag: '(0028,0011)', name: 'Columns', vr: 'US', value: String(512) },
      { tag: '(0028,0100)', name: 'Bits Allocated', vr: 'US', value: '16' },
      { tag: '(0028,0101)', name: 'Bits Stored', vr: 'US', value: '12' },
      { tag: '(0028,0102)', name: 'High Bit', vr: 'US', value: '11' },
      { tag: '(0028,0103)', name: 'Pixel Representation', vr: 'US', value: '0' },
      { tag: '(0002,0010)', name: 'Transfer Syntax UID', vr: 'UI', value: transferSyntax },
      { tag: '(0008,0008)', name: 'Image Type', vr: 'CS', value: 'ORIGINAL\\PRIMARY\\AXIAL' },
      {
        tag: '(0018,0050)',
        name: 'Slice Thickness',
        vr: 'DS',
        value: (Math.random() * 5 + 0.5).toFixed(1),
      },
      {
        tag: '(0020,0032)',
        name: 'Image Position (Patient)',
        vr: 'DS',
        value: `${(Math.random() * 200 - 100).toFixed(1)}\\${(Math.random() * 200 - 100).toFixed(1)}\\${(i * 2.5).toFixed(1)}`,
      },
    ];

    return {
      id: `instance-${seriesId}-${i}`,
      seriesId,
      sopInstanceUID: tags[1].value,
      sopClassUID,
      instanceNumber: i + 1,
      fileSize,
      transferSyntax,
      tags,
    };
  });
}

export function generateDemoModalities(): DicomModality[] {
  return [
    {
      id: 'mod-1',
      name: 'CT Scanner Main',
      aet: 'CT_MAIN',
      host: '192.168.1.10',
      port: 104,
      manufacturer: 'Siemens',
      lastEcho: subDays(new Date(), 0),
      lastEchoStatus: 'success',
    },
    {
      id: 'mod-2',
      name: 'MRI Suite A',
      aet: 'MR_SUITE_A',
      host: '192.168.1.20',
      port: 104,
      manufacturer: 'GE Healthcare',
      lastEcho: subDays(new Date(), 1),
      lastEchoStatus: 'success',
    },
    {
      id: 'mod-3',
      name: 'Ultrasound Room 3',
      aet: 'US_ROOM3',
      host: '192.168.1.30',
      port: 104,
      manufacturer: 'Philips',
      lastEcho: subDays(new Date(), 0),
      lastEchoStatus: 'success',
    },
    {
      id: 'mod-4',
      name: 'X-Ray Emergency',
      aet: 'XR_ER',
      host: '192.168.1.40',
      port: 104,
      manufacturer: 'Canon',
      lastEcho: subDays(new Date(), 3),
      lastEchoStatus: 'failure',
    },
    {
      id: 'mod-5',
      name: 'PET/CT',
      aet: 'PETCT',
      host: '192.168.1.50',
      port: 11112,
      manufacturer: 'Siemens',
      lastEcho: subDays(new Date(), 0),
      lastEchoStatus: 'success',
    },
  ];
}

export function generateDemoDicomWebServers(): DicomWebServer[] {
  return [
    {
      id: 'dw-1',
      name: 'Cloud PACS',
      url: 'https://pacs.hospital.org/dicomweb',
      authType: 'bearer',
      hasQidoSupport: true,
      hasWadoSupport: true,
      hasStowSupport: true,
    },
    {
      id: 'dw-2',
      name: 'Research Archive',
      url: 'https://research.med.edu/wado-rs',
      authType: 'basic',
      username: 'researcher',
      hasQidoSupport: true,
      hasWadoSupport: true,
      hasStowSupport: false,
    },
  ];
}
