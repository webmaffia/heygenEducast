const HEYGEN_API_URL = 'https://api.heygen.com';
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function heygenFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${HEYGEN_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': HEYGEN_API_KEY || '',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`HeyGen API Error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function listAvatars() {
  return heygenFetch<{
    data: {
      avatars: {
        avatar_id: string;
        avatar_name: string;
        gender: string;
        preview_image_url: string;
        preview_video_url: string;
        premium: boolean;
        default_voice_id: string | null;
      }[];
      talking_photos: {
        talking_photo_id: string;
        talking_photo_name: string;
        preview_image_url: string;
      }[];
    };
  }>('/v2/avatars');
}

export async function listVoices() {
  return heygenFetch<{
    data: {
      voices: {
        voice_id: string;
        name: string;
        language: string;
        gender: string;
        preview_audio: string;
      }[];
    };
  }>('/v2/voices');
}

export async function createVideo(payload: {
  avatar_id: string;
  voice_id: string;
  input_text: string;
  title?: string;
}) {
  return heygenFetch<{ data: { video_id: string } }>('/v2/video/generate', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title || 'Generated Video',
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: payload.avatar_id,
          },
          voice: {
            type: 'text',
            voice_id: payload.voice_id,
            input_text: payload.input_text,
          },
        },
      ],
    }),
  });
}

export async function getVideoStatus(videoId: string) {
  return heygenFetch<{
    code: number;
    data: {
      status: string;
      video_url?: string;
      thumbnail_url?: string;
      gif_url?: string;
      error: {
        code: number;
        detail: string;
        message: string;
      } | null;
    };
    message: string;
  }>(`/v1/video_status.get?video_id=${videoId}`);
}
