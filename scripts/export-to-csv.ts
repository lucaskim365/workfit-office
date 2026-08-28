import { approvalProcessRepo } from '../src/data/approvalProcess/approvalProcess.repo';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('▶ 개발 DB로부터 결재 설정을 읽어오는 중...');
  const options = await approvalProcessRepo.getOptions();
  
  const headers = ['key', 'category', 'name', 'description', 'enabled', 'isImplemented'];
  const rows = options.map(opt => {
    return [
      opt.id,
      opt.category,
      opt.name,
      opt.description,
      opt.enabled ? 'true' : 'false',
      opt.isImplemented ? 'true' : 'false'
    ].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n'); // Windows 개행 표준 대응
  const targetPath = path.resolve(process.cwd(), 'scripts/approvalProcessSettings.csv');
  fs.writeFileSync(targetPath, csvContent, 'utf8');

  console.log(`✅ CSV 파일 생성 완료: ${targetPath}`);
}

main().catch(console.error);
