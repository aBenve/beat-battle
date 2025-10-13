import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
        new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          videoCategoryId: '10', // Music category
          maxResults: '10',
          key: YOUTUBE_API_KEY,
        })
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('YouTube API error:', errorData);
      throw new Error(`YouTube API request failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // Get video details to get duration
    const videoIds = data.items.map((item: any) => item.id.videoId).join(',');

    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
        new URLSearchParams({
          part: 'contentDetails,snippet',
          id: videoIds,
          key: YOUTUBE_API_KEY,
        })
    );

    const detailsData = await detailsResponse.json();

    // Format results
    const results = detailsData.items.map((item: any) => {
      // Parse ISO 8601 duration (e.g., PT4M13S)
      const duration = parseDuration(item.contentDetails.duration);

      return {
        id: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        duration,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    );
  }
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}
