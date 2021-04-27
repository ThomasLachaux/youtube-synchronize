import axios from 'axios';
import config from './config';
import { logger, youtubeApi } from './helpers';

interface ApiEntity {
  kind: string;
  etag: string;
}

interface ApiResponse<T> extends ApiEntity {
  nextPageToken?: string;
  prevPageToken?: string;
  items: T[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface Video extends ApiEntity {
  id: string;
  contentDetails: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: string;
    regionRestriction?: {
      blocked?: string[];
    };
  };
}

interface Playlist extends ApiEntity {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
  };
}

interface PlaylistItem extends ApiEntity {
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
  status: {
    privacyStatus: string;
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

export const getVideosById = async (videoIds: String[]) => {
  const { data } = await youtubeApi.get<ApiResponse<Video>>('videos', {
    params: {
      part: 'contentDetails',
      maxResults: 50,
      id: videoIds.join(','),
      key: config.youtube.apiKey,
    },
  });

  return data.items;
};

export const getVideosByPlaylist = async (
  playlistId: string,
  nextPageToken?: string
): Promise<{ id: string; title: string }[]> => {
  const { data } = await youtubeApi.get<ApiResponse<PlaylistItem>>('playlistItems', {
    params: {
      part: 'snippet,status',
      maxResults: 50,
      pageToken: nextPageToken,
      playlistId,
      key: config.youtube.apiKey,
    },
  });

  // Get an array of videos ids and remove private videos
  const filteredData = data.items.filter((item) => {
    if (['private', 'privacyStatusUnspecified'].includes(item.status.privacyStatus)) {
      logger.warn(`[${item.snippet.resourceId.videoId}] This video is now private`);
      return false;
    }

    return true;
  });

  // Retreive the video details
  const detailedVideos = await getVideosById(filteredData.map((item) => item.snippet.resourceId.videoId));

  if (detailedVideos.length !== filteredData.length)
    throw new Error(
      `The detailed videos length is different from the playlist length (${detailedVideos.length} vs ${filteredData.length})`
    );

  // Simplifies the data and remove the blocked videos by country
  const simplifiedData = filteredData.reduce((accumulator, item) => {
    // Retreive the detailed video mapping the video id
    const detailedVideo = detailedVideos.find((video) => video.id === item.snippet.resourceId.videoId);

    // Check if the video is not blocked, if so, skips the video
    if (
      detailedVideo.contentDetails.regionRestriction &&
      detailedVideo.contentDetails.regionRestriction.blocked &&
      detailedVideo.contentDetails.regionRestriction.blocked.includes(config.currentCountry)
    ) {
      logger.warn(`[${detailedVideo.id}] ${item.snippet.title} is not available anymore in ${config.currentCountry}`);
      return accumulator;
    }

    return [
      ...accumulator,
      {
        id: detailedVideo.id,
        title: item.snippet.title,
      },
    ];
  }, []);

  // If we didn't reach the last page fetch the next video playlist
  if (data.nextPageToken) {
    const nextPageIds = await getVideosByPlaylist(playlistId, data.nextPageToken);
    return simplifiedData.concat(nextPageIds);
  }

  return simplifiedData;
};
