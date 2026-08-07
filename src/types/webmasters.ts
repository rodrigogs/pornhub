export type WebmastersPornstar = {
  pornstar_name: string;
  pornstar_link?: string;
};

export type WebmastersCategory = {
  category: string;
};

export type WebmastersTag = {
  tag_name: string;
};

export type WebmastersThumb = {
  size: string;
  width: string;
  height: string;
  src: string;
};

export type WebmastersVideo = {
  duration: string;
  views: number;
  video_id: string;
  rating: number;
  ratings: number;
  title: string;
  url: string;
  default_thumb: string;
  thumb: string;
  publish_date: string;
  thumbs: WebmastersThumb[];
  tags: WebmastersTag[];
  pornstars: WebmastersPornstar[];
  categories: WebmastersCategory[];
  segment: string;
  description: string;
};

export type WebmastersVideoByIdResult = {
  video: WebmastersVideo;
};

export type WebmastersVideoSearchResult = {
  videos: WebmastersVideo[];
};

export type WebmastersVideoActiveResult =
  | {
      active: {
        video_id: string;
        is_active: '1' | '0';
      };
    }
  | {
      code: string;
      message: string;
      example: string;
    };

export type WebmastersVideoEmbedResult =
  | {
      embed: {
        code: string;
      };
    }
  | {
      code: string;
      message: string;
      example: string;
    };

export type WebmastersDeletedVideo = {
  vkey: string;
  deleted_on: string;
};

export type WebmastersDeletedVideosResult = {
  videos: WebmastersDeletedVideo[];
};

export type WebmastersTagListResult = {
  tagsCount: number;
  tags: string[];
};

export type WebmastersCategoryListItem = {
  id: number | string;
  category: string;
};

export type WebmastersCategoryListResult = {
  categories: WebmastersCategoryListItem[];
};

export type WebmastersPornstarListItem = {
  star: {
    star_name: string;
  };
};

export type WebmastersPornstarListResult = {
  stars: WebmastersPornstarListItem[];
};

export type WebmastersPornstarDetail = {
  star_name: string;
  star_thumb: string;
  star_url: string;
  gender: string;
  videos_count_all: string;
};

export type WebmastersPornstarDetailItem = {
  star: WebmastersPornstarDetail;
};

export type WebmastersPornstarDetailListResult = {
  stars: WebmastersPornstarDetailItem[];
};

export type WebmastersVideoOrdering =
  | 'featured'
  | 'newest'
  | 'mostviewed'
  | 'rating'
  | (string & {});

export type WebmastersVideoPeriod =
  | 'weekly'
  | 'monthly'
  | 'alltime'
  | (string & {});

export type WebmastersThumbSize =
  | 'small'
  | 'medium'
  | 'large'
  | 'small_hd'
  | 'medium_hd'
  | 'large_hd'
  | (string & {});

export type WebmastersSearchOptions = {
  page?: number;
  tags?: string[];
  category?: string[];
  stars?: string[];
  ordering?: WebmastersVideoOrdering;
  period?: WebmastersVideoPeriod;
  thumbsize?: WebmastersThumbSize;
};
