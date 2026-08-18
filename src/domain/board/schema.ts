import { z } from 'zod';

export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  desc: z.string(),
});

export type Board = z.infer<typeof boardSchema>;

export const postSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  title: z.string(),
  content: z.string(),
  author: z.string(),
  date: z.string(),
  views: z.number().default(0),
  isPinned: z.boolean().optional().default(false),
  hasAttachment: z.boolean().optional().default(false),
  attachedFiles: z.array(
    z.object({
      name: z.string(),
      size: z.string(),
    })
  ).optional(),
});

export type Post = z.infer<typeof postSchema>;
