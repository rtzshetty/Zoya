import { auth } from '../lib/firebase';

let cachedAccessToken: string | null = null;

export const setAccessToken = (token: string) => {
  cachedAccessToken = token;
};

export const driveService = {
  async saveToDrive(text: string, fileName: string = 'Zoya_Talk.txt') {
    if (!cachedAccessToken) {
      throw new Error('Please sign in with Google to save to Drive.');
    }

    try {
      const metadata = {
        name: fileName,
        mimeType: 'text/plain',
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([text], { type: 'text/plain' }));

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
        },
        body: form,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save to Google Drive');
      }

      return await response.json();
    } catch (error) {
      console.error('Drive API Error:', error);
      throw error;
    }
  }
};
