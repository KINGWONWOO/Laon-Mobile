export const youtubeService = {
  /**
   * 유튜브 URL에서 영상 ID를 추출합니다.
   * 지원 형식:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://www.youtube.com/embed/VIDEO_ID
   */
  extractVideoId: (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  },

  /**
   * 영상 ID로 썸네일 URL을 생성합니다.
   */
  getThumbnailUrl: (videoId: string): string => {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  },

  /**
   * 임베드용 URL을 생성합니다.
   */
  getEmbedUrl: (videoId: string): string => {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent('http://localhost:8081')}`;
  }
};
