import { Client, Databases } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.widdyax.com/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a8288390007f641306d')
  .setKey(process.env.APPWRITE_API_KEY || '');

const db = new Databases(client);

async function check() {
  const usersRes = await db.listDocuments('workfit', 'users');
  console.log('=== USERS ===');
  console.log(JSON.stringify(usersRes.documents.map(u => ({ id: u.$id, empNo: u.empNo, email: u.email, name: u.name, dept: u.dept })), null, 2));

  const roomsRes = await db.listDocuments('workfit', 'chatRooms');
  console.log('=== DEPT ROOMS MEMBERS ===');
  const deptRooms = roomsRes.documents.filter(r => r.$id.startsWith('RM-DEPT-'));
  for (const r of deptRooms) {
    console.log(`Room: ${r.$id} | Name: ${r.name} | Type: ${r.type} | Members (${typeof r.members}):`, r.members);
  }
}

check();
