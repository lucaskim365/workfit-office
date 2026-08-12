import type { FeedPost, Club } from '@/domain/community/schema';

export const FEED_SEED_DATA: FeedPost[] = [
  {
    id: 1,
    author: '홍채원 사원',
    authorId: 'U012',
    isAnonymous: false,
    content: '오늘 점심 다들 맛있는 거 드셨나요? 회사 근처에 새로 생긴 파스타 가게 가봤는데 대기가 좀 길긴 하지만 분위기도 좋고 맛있네요! 다음엔 팀 분들이랑 같이 가봐야겠어요. 🍝',
    date: '2026-08-11 12:15',
    comments: [
      {
        id: 1,
        author: '박광래 차장',
        content: '거기 주차장 뒤편 골목에 있는 곳 맞죠? 지나가다 봤는데 분위기 좋아 보이더군요.',
        date: '2026-08-11 12:30',
        replies: [
          { id: 1, author: '홍채원 사원', content: '네 맞아요 차장님! 오일 파스타가 정말 맛있습니다.', date: '2026-08-11 12:35' }
        ]
      },
      {
        id: 2,
        author: '최지혜 사원',
        content: '채원씨 다음에 저랑 점심에 피자랑 파스타 먹으러 같이 가요!',
        date: '2026-08-11 13:02',
        replies: []
      }
    ],
    attachments: [],
    tags: ['#맛집추천', '#점심메뉴', '#소통']
  },
  {
    id: 2,
    author: '김승기 부장',
    authorId: 'U011',
    isAnonymous: false,
    content: '날씨가 많이 덥습니다. 외근 나가시는 분들 건강 유의하시고 수분 섭취 자주 하시기 바랍니다. 오늘도 파이팅합시다.',
    date: '2026-08-10 10:00',
    comments: [],
    attachments: [],
    tags: ['#응원', '#수요팅', '#건강관리']
  },
  {
    id: 3,
    author: '익명',
    authorId: 'U008',
    isAnonymous: true,
    content: '사내 카페테리아에 아이스 아메리카노 원두 맛이 최근에 좀 더 다크한 거로 바뀐 것 같은데 저만 느끼는 건가요? ㅎㅎ 예전보다 산미가 덜해서 저는 더 마음에 드네요!',
    date: '2026-08-09 16:45',
    comments: [
      {
        id: 1,
        author: '손승원 상무',
        content: '동감합니다. 커피 바디감이 훨씬 훌륭해졌더군요.',
        date: '2026-08-09 17:10',
        replies: []
      }
    ],
    attachments: [],
    tags: ['#사내카페', '#커피수혈', '#원두후기']
  }
];

export const CLUB_SEED_DATA: Club[] = [
  {
    id: 1,
    name: '⚽ FC 워크핏 (풋살)',
    desc: '매주 목요일 퇴근 후 풋살 한판! 사내 건강 증진 및 친목 도모를 위한 풋살 소모임입니다.',
    icon: '⚽',
    joinPolicy: 'free',
    memberCount: 4,
    members: [
      { userId: 'U009', name: '박명규', dept: '사업관리팀', position: '부장', role: 'owner' },
      { userId: 'U006', name: '강윤석', dept: '품질관리팀', position: '이사', role: 'member' },
      { userId: 'U008', name: '홍형표', dept: '영업팀', position: '부장', role: 'member' },
      { userId: 'U010', name: '박광래', dept: '사업관리팀', position: '차장', role: 'member' },
    ],
    posts: [
      {
        id: 1,
        title: '이번 주 목요일 저녁 7시 정기 매치 투표 및 공지',
        content: '이번 주 목요일 용산 실내 풋살장에서 7시 매치 있습니다. 참가 인원 수에 따라 대관 포맷 조절하겠습니다. 수요일 정오까지 댓글로 참석 여부 알려주세요!',
        author: '박명규 부장',
        authorId: 'U009',
        date: '2026-08-10',
        comments: [
          { id: 1, author: '홍형표 부장', content: '참석합니다! 날씨도 더운데 실내라서 다행이네요.', date: '2026-08-10 14:20', replies: [] }
        ]
      }
    ]
  },
  {
    id: 2,
    name: '📚 책 읽는 직장인 (독서)',
    desc: '한 달에 책 한 권 읽고 가벼운 마음으로 토론과 다과를 나눕니다. 장르 불문 편안한 독서 모임입니다.',
    icon: '📚',
    joinPolicy: 'approval',
    memberCount: 3,
    members: [
      { userId: 'U011', name: '김승기', dept: 'S/W 개발팀', position: '부장', role: 'owner' },
      { userId: 'U012', name: '홍채원', dept: 'S/W 개발팀', position: '사원', role: 'member' },
      { userId: 'U007', name: '최지혜', dept: '품질관리팀', position: '사원', role: 'member' },
    ],
    posts: [
      {
        id: 1,
        title: '8월 선정도서 안내 및 모임 장소 공지',
        content: '8월의 도서는 한강 작가의 소설입니다. 각자 완독 후 8월 27일(목) 퇴근 후에 4층 회의실에 다과와 함께 모여 이야기 나눕니다.',
        author: '김승기 부장',
        authorId: 'U011',
        date: '2026-08-05',
        comments: []
      }
    ]
  },
  {
    id: 3,
    name: '💻 개발 및 IT 트렌드 스터디',
    desc: '신기술 스택 공유 및 업계 IT 기술 동향 분석을 지향하는 소규모 기술 연구 모임입니다.',
    icon: '💻',
    joinPolicy: 'invite',
    memberCount: 2,
    members: [
      { userId: 'U011', name: '김승기', dept: 'S/W 개발팀', position: '부장', role: 'owner' },
      { userId: 'U003', name: '손승원', dept: 'AX사업본부', position: '상무이사', role: 'member' },
    ],
    posts: []
  }
];
