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
