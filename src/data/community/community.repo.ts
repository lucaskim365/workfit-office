import type { Club, ClubMember, ClubPost, ClubEvent } from '@/domain/community/schema';
import { CLUB_SEED_DATA } from '@/data/seeds/community.seed';

class CommunityRepository {
  private clubs: Club[] = [...CLUB_SEED_DATA];

  // --- 소모임 마당 API ---
  getClubs(): Club[] {
    return this.clubs;
  }

  addClub(club: Omit<Club, 'id' | 'memberCount' | 'posts' | 'events'>): Club {
    const newClub: Club = {
      ...club,
      id: this.clubs.length + 1,
      memberCount: club.members.length,
      posts: [],
      events: [],
    };
    this.clubs = [...this.clubs, newClub];
    return newClub;
  }

  joinClub(clubId: number, member: ClubMember): void {
    this.clubs = this.clubs.map((c) => {
      if (c.id === clubId) {
        // 중복 가입 체크
        if (c.members.some((m) => m.userId === member.userId)) return c;
        return {
          ...c,
          memberCount: c.memberCount + 1,
          members: [...c.members, member],
        };
      }
      return c;
    });
  }

  leaveClub(clubId: number, userId: string): void {
    this.clubs = this.clubs.map((c) => {
      if (c.id === clubId) {
        return {
          ...c,
          memberCount: Math.max(0, c.memberCount - 1),
          members: c.members.filter((m) => m.userId !== userId),
        };
      }
      return c;
    });
  }

  addClubPost(clubId: number, post: Omit<ClubPost, 'id' | 'date' | 'comments'>): ClubPost {
    const newPost: ClubPost = {
      ...post,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      comments: [],
    };

    this.clubs = this.clubs.map((c) => {
      if (c.id === clubId) {
        return { ...c, posts: [newPost, ...c.posts] };
      }
      return c;
    });

    return newPost;
  }

  addClubEvent(clubId: number, event: Omit<ClubEvent, 'id' | 'votes'>): ClubEvent {
    const newEvent: ClubEvent = {
      ...event,
      id: Date.now(),
      votes: {},
    };

    this.clubs = this.clubs.map((c) => {
      if (c.id === clubId) {
        return { ...c, events: [newEvent, ...c.events] };
      }
      return c;
    });

    return newEvent;
  }

  voteClubEvent(clubId: number, eventId: number, userId: string, voteType: 'attend' | 'absent' | 'undecided'): void {
    this.clubs = this.clubs.map((c) => {
      if (c.id === clubId) {
        return {
          ...c,
          events: c.events.map((e) => {
            if (e.id === eventId) {
              const updatedVotes = { ...e.votes, [userId]: voteType };
              return { ...e, votes: updatedVotes };
            }
            return e;
          }),
        };
      }
      return c;
    });
  }
}

export const communityRepo = new CommunityRepository();
