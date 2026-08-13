import { useState, useCallback } from 'react';
import { communityRepo } from '@/data/community/community.repo';
import type { Club, ClubMember, ClubPost, ClubEvent } from '@/domain/community/schema';

export function useCommunity() {
  const [clubs, setClubs] = useState<Club[]>(() => communityRepo.getClubs());

  const refresh = useCallback(() => {
    setClubs([...communityRepo.getClubs()]);
  }, []);

  const createClub = useCallback((club: Omit<Club, 'id' | 'memberCount' | 'posts' | 'events' | 'greetings'>) => {
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

  const addClubEvent = useCallback((clubId: number, event: Omit<ClubEvent, 'id' | 'votes'>) => {
    communityRepo.addClubEvent(clubId, event);
    refresh();
  }, [refresh]);

  const voteClubEvent = useCallback((clubId: number, eventId: number, userId: string, voteType: 'attend' | 'absent' | 'undecided') => {
    communityRepo.voteClubEvent(clubId, eventId, userId, voteType);
    refresh();
  }, [refresh]);

  const addClubGreeting = useCallback((clubId: number, content: string, author: string) => {
    communityRepo.addClubGreeting(clubId, content, author);
    refresh();
  }, [refresh]);

  return {
    clubs,
    createClub,
    joinClub,
    leaveClub,
    addClubPost,
    addClubEvent,
    voteClubEvent,
    addClubGreeting,
  };
}
