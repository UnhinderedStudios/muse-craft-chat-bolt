import { chatAPI, ChatAPI, type ChatMessage, type ChatOptions } from './ChatAPI';
import { songAPI, SongAPI, type SongDetails } from './SongAPI';
import { imageAPI, ImageAPI } from './ImageAPI';

export { chatAPI, songAPI, imageAPI };
export { ChatAPI, SongAPI, ImageAPI };
export type { ChatMessage, ChatOptions, SongDetails };

export const apiModules = {
  chat: chatAPI,
  song: songAPI,
  image: imageAPI
};
