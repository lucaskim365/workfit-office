const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\d9b0590d-fa1d-42e8-ad9c-b567e4860a80';

function searchInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchInDir(filePath);
    } else if (file.endsWith('.log') || file.endsWith('.jsonl') || file.endsWith('.json') || file.endsWith('.txt')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('password') || content.includes('users/') || content.includes('U001') || content.includes('U011') || content.includes('U012') || content.includes('ghdcodnjs02')) {
        console.log(`=== MATCH IN FILE: ${filePath} ===`);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('password') || lines[i].includes('users/') || lines[i].includes('ghdcodnjs02') || lines[i].includes('U001') || lines[i].includes('U011')) {
            console.log(`Line ${i}: ${lines[i].substring(0, 200)}`);
          }
        }
        console.log('-'.repeat(60));
      }
    }
  }
}

searchInDir(targetDir);
