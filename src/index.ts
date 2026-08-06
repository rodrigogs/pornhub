import pornhub from './pornhub.js';

export type {
  DetailsInput,
  DetailsManyOptions,
  Pagination,
  PornhubVideoOrdering,
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
  WebmastersPornstar,
  WebmastersTag,
  WebmastersThumb,
  WebmastersVideo,
  WebmastersVideoByIdResult,
} from './types/webmasters.js';

const api = pornhub;

export default api;
