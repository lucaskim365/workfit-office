import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://appwrite.widdyax.com/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a8288390007f641306d')
  .setKey(process.env.APPWRITE_API_KEY || '');

const db = new Databases(client);
const DB_ID = 'workfit';

async function mergeDuplicateRooms() {
  console.log('=== STARTING 1:1 CHAT ROOM MERGE & CONSOLIDATION ===\n');

  // 1. 모든 채팅방 조회
  const roomsRes = await db.listDocuments(DB_ID, 'chatRooms', [Query.limit(500)]);
  const rooms = roomsRes.documents;

  // 1:1 대화방만 필터링 (type === 'direct' 또는 참여자가 정확히 2명인 방)
  const directRooms = rooms.filter(
    (r) => r.type === 'direct' && Array.isArray(r.members) && r.members.length === 2 && !r.deletedAt
  );

  console.log(`Found ${directRooms.length} active 1:1 direct rooms in total.`);

  // 참여자 쌍별로 그룹화 (정렬된 userA-userB 키 사용)
  const pairMap = new Map<string, typeof directRooms>();
  for (const r of directRooms) {
    const sortedMembers = [...(r.members as string[])].sort();
    const key = `${sortedMembers[0]}-${sortedMembers[1]}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, []);
    }
    pairMap.get(key)!.push(r);
  }

  let mergedCount = 0;
  let reallocatedMessageCount = 0;
  let deletedRoomCount = 0;

  // 2. 중복 그룹 탐색 및 병합
  for (const [pairKey, dupRooms] of pairMap.entries()) {
    if (dupRooms.length <= 1) continue;

    console.log(`\nFound duplicate 1:1 rooms for pair [${pairKey}]: ${dupRooms.length} rooms`);
    dupRooms.forEach((r) => console.log(`  - Room ID: ${r.$id} (name: ${r.name}, createdAt: ${r.createdAt})`));

    // 기준 대표 방(Target Room) 선정:
    // 1) 결정적 ID 형식(RM-DIR-...)이 있으면 최우선
    // 2) 없으면 가장 오래된 방(createdAt 기준)을 기준 방으로 지정
    let targetRoom = dupRooms.find((r) => r.$id.startsWith('RM-DIR-'));
    if (!targetRoom) {
      targetRoom = [...dupRooms].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0];
    }

    const secondaryRooms = dupRooms.filter((r) => r.$id !== targetRoom!.$id);
    console.log(`  => Target Master Room selected: ${targetRoom.$id} (${targetRoom.name})`);

    // 중복 방들의 메시지들을 대상 방으로 이관
    let allMessagesForPair: any[] = [];

    for (const secRoom of secondaryRooms) {
      // 해당 방의 메시지 조회
      const msgsRes = await db.listDocuments(DB_ID, 'chatMessages', [
        Query.equal('roomId', secRoom.$id),
        Query.limit(500),
      ]);

      const msgs = msgsRes.documents;
      console.log(`  => Moving ${msgs.length} messages from ${secRoom.$id} to ${targetRoom.$id}...`);

      for (const msg of msgs) {
        await db.updateDocument(DB_ID, 'chatMessages', msg.$id, {
          roomId: targetRoom.$id,
        });
        reallocatedMessageCount++;
      }

      // 방 삭제
      await db.deleteDocument(DB_ID, 'chatRooms', secRoom.$id);
      console.log(`  => Deleted redundant room: ${secRoom.$id}`);
      deletedRoomCount++;
    }

    // 3. 대상 대표 방의 최신 메시지(lastMessage) 재계산 및 갱신
    const targetMsgsRes = await db.listDocuments(DB_ID, 'chatMessages', [
      Query.equal('roomId', targetRoom.$id),
      Query.limit(500),
    ]);

    if (targetMsgsRes.documents.length > 0) {
      const sortedMsgs = [...targetMsgsRes.documents].sort((a, b) => {
        const atA = a.at || a.createdAt || a.$createdAt || '';
        const atB = b.at || b.createdAt || b.$createdAt || '';
        return atB.localeCompare(atA);
      });
      const latestMsg = sortedMsgs[0];
      const lastMessagePayload = JSON.stringify({
        text: latestMsg.text || (latestMsg.fileUrl ? '📎 파일' : ''),
        at: latestMsg.at || latestMsg.createdAt || latestMsg.$createdAt || new Date().toISOString(),
        senderId: latestMsg.senderId,
      });

      await db.updateDocument(DB_ID, 'chatRooms', targetRoom.$id, {
        lastMessage: lastMessagePayload,
      });
      console.log(`  => Updated target room lastMessage: "${latestMsg.text || '파일'}" (${lastMessagePayload})`);
    }

    mergedCount++;
  }

  console.log('\n=== MERGE SUMMARY ===');
  console.log(`- Duplicate pairs merged: ${mergedCount}`);
  console.log(`- Messages safely reallocated: ${reallocatedMessageCount}`);
  console.log(`- Redundant rooms removed: ${deletedRoomCount}`);
  console.log('=== MERGE COMPLETED SUCCESSFULLY ===\n');
}

mergeDuplicateRooms().catch(console.error);
