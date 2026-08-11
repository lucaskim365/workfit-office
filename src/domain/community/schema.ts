import { z } from 'zod';

export const commentReplySchema = z.object({
  id: z.number(),
  author: z.string(),
  content: z.string(),
  date: z.string(),
});

export const commentSchema = z.object({
  id: z.number(),
  author: z.string(),
  content: z.string(),
  date: z.string(),
  replies: z.array(commentReplySchema).default([]),
});

export const feedPostSchema = z.object({
  id: z.number(),
  author: z.string(),
  authorId: z.string(),
  isAnonymous: z.boolean(),
  content: z.string(),
  date: z.string(),
  comments: z.array(commentSchema).default([]),
  attachments: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const clubMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  dept: z.string(),
  position: z.string(),
  role: z.enum(['owner', 'member']),
});

export const clubPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  author: z.string(),
  authorId: z.string(),
  date: z.string(),
  comments: z.array(commentSchema).default([]),
});

export const clubSchema = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string(),
  icon: z.string(),
  joinPolicy: z.enum(['free', 'approval', 'invite']),
  memberCount: z.number().default(1),
  members: z.array(clubMemberSchema).default([]),
  posts: z.array(clubPostSchema).default([]),
});

export type CommentReply = z.infer<typeof commentReplySchema>;
export type Comment = z.infer<typeof commentSchema>;
export type FeedPost = z.infer<typeof feedPostSchema>;
export type ClubMember = z.infer<typeof clubMemberSchema>;
export type ClubPost = z.infer<typeof clubPostSchema>;
export type Club = z.infer<typeof clubSchema>;
export type JoinPolicy = 'free' | 'approval' | 'invite';
