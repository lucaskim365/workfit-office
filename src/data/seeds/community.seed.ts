import type { Club } from '@/domain/community/schema';

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
        title: '이번 주 목요일 저녁 7시 정기 매치 안내',
        content: '이번 주 목요일 용산 실내 풋살장에서 7시 매치 있습니다. 참가 인원 수에 따라 대관 포맷 조절하겠습니다. 아래 일정표 탭에서 투표 부탁드립니다!',
        author: '박명규 부장',
        authorId: 'U009',
        date: '2026-08-10',
        comments: []
      }
    ],
    events: [
      {
        id: 1,
        title: '⚽ 8월 2째주 정기 풋살 경기',
        date: '2026-08-20 19:00',
        location: '용산 실내 아이파크몰 풋살장',
        desc: '인원 조율이 필요하니 수요일 오후까지 투표 바랍니다!',
        creator: '박명규 부장',
        votes: {
          'U009': 'attend',
          'U008': 'attend',
          'U010': 'absent'
        }
      }
    ],
    coverImage: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
    tags: ['#풋살', '#운동', '#친목도모'],
    greetings: [
      { id: 1, author: '강윤석 이사', content: '반갑습니다! 열심히 차겠습니다 ㅎㅎ', date: '08-11 22:00' },
      { id: 2, author: '홍형표 부장', content: '가입했습니다. 목요일에 봬요!', date: '08-12 10:00' }
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
    ],
    events: [
      {
        id: 2,
        title: '📖 8월 독서 모임 및 다과회',
        date: '2026-08-27 18:30',
        location: '4층 본관 대회의실',
        desc: '선정도서 완독하고 가벼운 마음으로 만나요! 다과는 회사에서 지원됩니다.',
        creator: '김승기 부장',
        votes: {
          'U011': 'attend',
          'U012': 'attend'
        }
      }
    ],
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
    tags: ['#독서', '#소설', '#베스트셀러'],
    greetings: [
      { id: 1, author: '홍채원 사원', content: '한강 작가님 소설 너무 기대돼요! 잘 부탁드립니다.', date: '08-10 15:30' }
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
    posts: [],
    events: [],
    coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
    tags: ['#IT스터디', '#웹개발', '#트렌드분석'],
    greetings: []
  }
];
