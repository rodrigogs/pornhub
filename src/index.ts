import pornhub from './pornhub.js';

export type {
  ChannelOptions,
  DetailsInput,
  DetailsManyOptions,
  Pagination,
  PornhubVideoOrdering,
  PornstarOptions,
  SearchOptions,
  VideoDetailsBatchFailure,
  VideoDetailsBatchItem,
  VideoDetailsBatchResult,
  VideoDetailsBatchSuccess,
  VideoDetailsResult,
  VideoFiles,
  VideoListResult,
  VideoProfile,
  VideoSummary,
} from './types/index.js';

export type {
  WebmastersCategory,
  WebmastersCategoryListItem,
  WebmastersCategoryListResult,
  WebmastersDeletedVideo,
  WebmastersDeletedVideosResult,
  WebmastersPornstar,
  WebmastersPornstarDetail,
  WebmastersPornstarDetailItem,
  WebmastersPornstarDetailListResult,
  WebmastersPornstarListItem,
  WebmastersPornstarListResult,
  WebmastersSearchOptions,
  WebmastersTag,
  WebmastersTagListResult,
  WebmastersThumb,
  WebmastersThumbSize,
  WebmastersVideo,
  WebmastersVideoActiveResult,
  WebmastersVideoByIdResult,
  WebmastersVideoEmbedResult,
  WebmastersVideoOrdering,
  WebmastersVideoPeriod,
  WebmastersVideoSearchResult,
} from './types/webmasters.js';

const api = pornhub;

export default api;
