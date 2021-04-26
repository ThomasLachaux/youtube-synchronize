import axios from 'axios';
import config from './config';
import { youtubeApi } from './helpers';

interface ApiResponse<T> {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  items: T[];
}

interface Playlist {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
  };
}

interface PlaylistItem {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    resourceId: {
      kind: string;
      videoId: string;
    };
  };
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export const getPlaylistSlug = async (playlistId: string) => {
  const { data } = await youtubeApi.get<ApiResponse<Playlist>>('playlists', {
    params: {
      part: 'snippet',
      id: playlistId,
      key: config.youtube.apiKey,
    },
  });

  return data.items[0].snippet.title.toLowerCase().replace(/ +/, '-');
};

export const getVideosByPlaylist = async (
  playlistId: string,
  nextPageToken?: string
): Promise<{ id: string; title: string }[]> => {
  const { data } = await youtubeApi.get<ApiResponse<PlaylistItem>>(
    'playlistItems',
    {
      params: {
        part: 'snippet',
        maxResults: 50,
        pageToken: nextPageToken,
        playlistId,
        key: config.youtube.apiKey,
      },
    }
  );

  // Get an array of videos ids
  const simplifiedData = data.items.map((item) => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
  }));

  // If we didn't reach the last page fetch the next video playlist
  if (data.nextPageToken) {
    const nextPageIds = await getVideosByPlaylist(
      playlistId,
      data.nextPageToken
    );
    return simplifiedData.concat(nextPageIds);
  }

  return simplifiedData;
};
