import type { FeedPost, Club, Comment, CommentReply, ClubMember, ClubPost } from '@/domain/community/schema';
import { FEED_SEED_DATA, CLUB_SEED_DATA } from '@/data/seeds/community.seed';

class CommunityRepository {
  private feeds: FeedPost[] = [...FEED_SEED_DATA];
  private clubs: Club[] = [...CLUB_SEED_DATA];

  // --- 자유게시판 피드 API ---
  getFeeds(): FeedPost[] {
    return this.feeds;
  }

  addFeed(feed: Omit<FeedPost, 'id' | 'date' | 'comments'>): FeedPost {
    const newFeed: FeedPost = {
      ...feed,
      id: this.feeds.length + 1,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      comments: [],
    };
    this.feeds = [newFeed, ...this.feeds];
    return newFeed;
  }

  addFeedComment(feedId: number, comment: Omit<Comment, 'id' | 'date' | 'replies'>): Comment {
    const newComment: Comment = {
      ...comment,
      id: Date.now(),
      date: '방금 전',
      replies: [],
    };

    this.feeds = this.feeds.map((f) => {
      if (f.id === feedId) {
        return { ...f, comments: [...f.comments, newComment] };
      }
      return f;
    });

    return newComment;
  }

  addFeedReply(feedId: number, commentId: number, reply: Omit<CommentReply, 'id' | 'date'>): CommentReply {
    const newReply: CommentReply = {
      ...reply,
      id: Date.now(),
      date: '방금 전',
    };

    this.feeds = this.feeds.map((f) => {
      if (f.id === feedId) {
        return {
          ...f,
          comments: f.comments.map((c) => {
            if (c.id === commentId) {
              return { ...c, replies: [...(c.replies || []), newReply] };
            }
            return c;
          }),
        };
      }
      return f;
    });

    return newReply;
  }

  deleteFeed(feedId: number): void {
    this.feeds = this.feeds.filter((f) => f.id !== feedId);
  }

  // --- 소모임 마당 API ---
  getClubs(): Club[] {
    return this.clubs;
  }

  addClub(club: Omit<Club, 'id' | 'memberCount' | 'posts'>): Club {
    const newClub: Club = {
      ...club,
      id: this.clubs.length + 1,
      memberCount: club.members.length,
      posts: [],
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
}

export const communityRepo = new CommunityRepository();
