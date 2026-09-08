export interface GalleryAlbum {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface GalleryItem {
  id: string;
  title?: string;
  caption?: string;
  description: string;
  images: string[];
  albumId: string;
  date: string; // YYYY-MM-DD
  authorId?: string;
  authorName: string;
  authorDept: string;
  createdAt: string;
}

export interface UploadImageItem {
  id: string;
  url: string;
  caption: string;
}

export interface TimelineMonthGroup {
  ym: string;
  monthStr: string;
  count: number;
}

export interface TimelineYearGroup {
  year: string;
  count: number;
  months: TimelineMonthGroup[];
}

export interface DateGroupedItems {
  dateKey: string;
  displayDate: string;
  items: GalleryItem[];
}

export type YearGroup = TimelineYearGroup;
export type DateGroup = DateGroupedItems;
