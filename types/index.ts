export type User = {
  id: string;
  name: string;
  profileImage?: string;
};

export type Room = {
  id: string;
  name: string;
  passcode: string;
  imageUri?: string;
  leaderId: string;
  members: string[]; // User IDs
};

export type Notice = {
  id: string;
  roomId: string;
  userId: string; // ID of the user who created the notice
  title: string;
  content: string;
  isPinned: boolean;
  images?: string[]; // Array of image URIs
  viewedBy: string[]; // User IDs who viewed the notice
  createdAt: number;
};

export type Comment = {
  id: string;
  userId: string;
  text: string;
  timestampMillis: number; // Video timestamp in ms
  createdAt: number;
};

export type VideoFeedback = {
  id: string;
  roomId: string;
  userId: string; // ID of the user who uploaded the video
  videoUrl: string; // uri or remote url
  title: string;
  comments: Comment[];
  createdAt: number;
};

export type Photo = {
  id: string;
  roomId: string;
  userId: string; // ID of the user who uploaded the photo
  photoUrl: string;
  createdAt: number;
};

export type ScheduleOption = {
  id: string;
  dateTime: string;
};

export type Schedule = {
  id: string;
  roomId: string;
  userId: string; // ID of the user who created the schedule
  title: string;
  options: ScheduleOption[];
  responses: { [userId: string]: string[] }; // userId to optionIds
  viewedBy: string[]; // User IDs who viewed the schedule
  startDate?: string;
  endDate?: string;
  sendNotification?: boolean;
  createdAt: number;
};

export type VoteOption = {
  id: string;
  text: string;
};

export type Vote = {
  id: string;
  roomId: string;
  userId: string; // ID of the user who created the vote
  question: string;
  options: VoteOption[];
  responses: { [userId: string]: string[] }; // userId to array of optionIds
  isAnonymous: boolean;
  allowMultiple: boolean;
  sendNotification: boolean;
  notificationMinutes?: number; // Minutes before deadline to notify
  deadline?: number; // Timestamp
  viewedBy: string[]; // User IDs who viewed the vote
  comments: Comment[];
  createdAt: number;
};

export type AlarmType = 'notice' | 'vote' | 'schedule' | 'general';

export type Alarm = {
  id: string;
  roomId: string;
  title: string;
  content: string;
  type: AlarmType;
  targetId: string; // noticeId, voteId, etc.
  createdAt: number;
  viewedBy: string[]; // User IDs who viewed the alarm
};

export type ThemeType = 'white' | 'dark' | 'cute';
