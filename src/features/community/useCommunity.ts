import { useState, useCallback } from 'react';
import { communityRepo } from '@/data/community/community.repo';
import type { FeedPost, Club, Comment, CommentReply, ClubMember, ClubPost } from '@/domain/community/schema';

export function useCommunity() {
  const [feeds, setFeeds] = useState<FeedPost[]>(() => communityRepo.getFeeds());
  const [clubs, setClubs] = useState<Club[]>(() => communityRepo.getClubs());

  const refresh = useCallback(() => {
    setFeeds([...communityRepo.getFeeds()]);
    setClubs([...communityRepo.getClubs()]);
  }, []);

  const createFeed = useCallback((feed: Omit<FeedPost, 'id' | 'date' | 'comments'>) => {
    communityRepo.addFeed(feed);
    refresh();
  }, [refresh]);

  const addFeedComment = useCallback((feedId: number, comment: Omit<Comment, 'id' | 'date' | 'replies'>) => {
    communityRepo.addFeedComment(feedId, comment);
    refresh();
  }, [refresh]);

  const addFeedReply = useCallback((feedId: number, commentId: number, reply: Omit<CommentReply, 'id' | 'date'>) => {
    communityRepo.addFeedReply(feedId, commentId, reply);
    refresh();
  }, [refresh]);

  const deleteFeed = useCallback((feedId: number) => {
    communityRepo.deleteFeed(feedId);
    refresh();
  }, [refresh]);

  const createClub = useCallback((club: Omit<Club, 'id' | 'memberCount' | 'posts'>) => {
    communityRepo.addClub(club);
    refresh();
  }, [refresh]);

  const joinClub = useCallback((clubId: number, member: ClubMember) => {
    communityRepo.joinClub(clubId, member);
    refresh();
  }, [refresh]);

  const leaveClub = useCallback((clubId: number, userId: string) => {
    communityRepo.leaveClub(clubId, userId);
    refresh();
  }, [refresh]);

  const addClubPost = useCallback((clubId: number, post: Omit<ClubPost, 'id' | 'date' | 'comments'>) => {
    communityRepo.addClubPost(clubId, post);
    refresh();
  }, [refresh]);

  return {
    feeds,
    clubs,
    createFeed,
    addFeedComment,
    addFeedReply,
    deleteFeed,
    createClub,
    joinClub,
    leaveClub,
    addClubPost,
  };
}
