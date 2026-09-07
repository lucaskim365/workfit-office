import { loadAppwriteConfig } from './appwrite-dev-env';

async function main() {
  const isProd = process.argv.includes('--prod');
  const config = loadAppwriteConfig('workfit', isProd);
  if (!config?.apiKey) {
    console.error('No API key found in env');
    process.exit(1);
  }

  const endpoint = config.endpoint;
  const projectId = config.projectId;
  const apiKey = config.apiKey;
  const DB = config.databaseId;

  console.log(`[commute-policy-provision] ${endpoint} / project=${projectId} / db=${DB}`);

  const HEADERS = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': projectId,
    'X-Appwrite-Key': apiKey,
  };

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${endpoint}${path}`, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, data: json };
  }

  console.log('1. commutePolicies 컬렉션 생성...');
  const collRes = await call('POST', `/databases/${DB}/collections`, {
    collectionId: 'commutePolicies',
    name: 'commutePolicies',
    permissions: [
      'read("any")',
      'create("any")',
      'update("any")',
      'delete("any")',
    ],
    documentSecurity: false,
  });

  if (collRes.status === 201) {
    console.log('  ✓ commutePolicies 컬렉션 생성 완료');
  } else if (collRes.status === 409) {
    console.log('  • commutePolicies 컬렉션 이미 존재함');
  } else {
    console.error('  ✕ 컬렉션 생성 실패:', collRes.status, collRes.data);
    return;
  }

  const attrs = [
    { type: 'string', key: 'name', size: 100 },
    { type: 'boolean', key: 'isDefault' },
    { type: 'string', key: 'workStartTime', size: 10 },
    { type: 'string', key: 'workEndTime', size: 10 },
    { type: 'string', key: 'breakStartTime', size: 10 },
    { type: 'string', key: 'breakEndTime', size: 10 },
    { type: 'integer', key: 'breakMin', min: 0, max: 2147483647 },
    { type: 'integer', key: 'lateGraceMin', min: 0, max: 2147483647 },
    { type: 'string', key: 'earlyInLimitTime', size: 10 },
    { type: 'integer', key: 'overtimeStartMin', min: 0, max: 2147483647 },
    { type: 'string', key: 'nightStartTime', size: 10 },
    { type: 'string', key: 'nightEndTime', size: 10 },
    { type: 'string', key: 'targetDepartmentIds', size: 1000 },
    { type: 'string', key: 'targetUserIds', size: 1000 },
    { type: 'string', key: 'updatedBy', size: 50 },
    { type: 'datetime', key: 'updatedAt' },
  ];

  for (const attr of attrs) {
    let endpointPath = `/databases/${DB}/collections/commutePolicies/attributes/${attr.type}`;
    let body: any = { key: attr.key, required: false };
    if (attr.type === 'string') {
      body.size = attr.size;
    } else if (attr.type === 'integer') {
      body.min = attr.min;
      body.max = attr.max;
    }
    const aRes = await call('POST', endpointPath, body);
    if (aRes.status === 201) {
      console.log(`  ✓ 속성 ${attr.key} 생성 완료`);
    } else if (aRes.status === 409) {
      console.log(`  • 속성 ${attr.key} 이미 존재함`);
    } else {
      console.warn(`  ! 속성 ${attr.key} 생성 응답:`, aRes.status, aRes.data);
    }
  }

  console.log('2. 속성 available 대기...');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { status, data } = await call('GET', `/databases/${DB}/collections/commutePolicies/attributes`);
    if (status === 200 && Array.isArray(data?.attributes)) {
      const notReady = data.attributes.filter((a: any) => a.status !== 'available');
      if (notReady.length === 0 && data.attributes.length >= attrs.length) {
        console.log('  ✓ 모든 속성 준비 완료');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('3. 기본 정책 DEFAULT 생성...');
  const docRes = await call('POST', `/databases/${DB}/collections/commutePolicies/documents`, {
    documentId: 'DEFAULT',
    data: {
      id: 'DEFAULT',
      name: '기본 근무제 (08:30~17:30)',
      isDefault: true,
      workStartTime: '08:30',
      workEndTime: '17:30',
      breakStartTime: '12:00',
      breakEndTime: '13:00',
      breakMin: 60,
      lateGraceMin: 0,
      earlyInLimitTime: '07:00',
      overtimeStartMin: 30,
      nightStartTime: '22:00',
      nightEndTime: '06:00',
      targetDepartmentIds: '[]',
      targetUserIds: '[]',
      updatedBy: 'SYSTEM',
      updatedAt: new Date().toISOString(),
    },
    permissions: [
      'read("any")',
      'update("any")',
    ]
  });

  if (docRes.status === 201) {
    console.log('  ✓ DEFAULT 정책 생성 완료');
  } else if (docRes.status === 409) {
    console.log('  • DEFAULT 정책 이미 존재함');
  } else {
    console.warn('  ! DEFAULT 정책 생성 응답:', docRes.status, docRes.data);
  }
}

main().catch(console.error);
