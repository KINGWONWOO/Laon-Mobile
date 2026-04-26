import * as Linking from 'expo-linking';
import { Share, Platform } from 'react-native';

export const LinkingService = {
  // Generate a deep link for a specific room
  createRoomInviteLink: (roomId: string, passcode: string) => {
    // In production, this would be your app's custom scheme or a universal link
    // e.g., laondancefeedback://room/123?passcode=4567
    return Linking.createURL(`/room/${roomId}`, {
      queryParams: { passcode },
    });
  },

  // Open Native Share Sheet
  shareRoomInvite: async (roomName: string, roomId: string, passcode: string) => {
    const url = LinkingService.createRoomInviteLink(roomId, passcode);
    // Android embeds the URL in the message text; iOS receives it as a separate url field
    const message = Platform.OS === 'ios'
      ? `[LAON DANCE] '${roomName}' 팀에 초대되셨습니다!\n\n방 ID: ${roomId}\n참여 코드: ${passcode}`
      : `[LAON DANCE] '${roomName}' 팀에 초대되셨습니다!\n\n링크: ${url}\n\n방 ID: ${roomId}\n참여 코드: ${passcode}`;

    try {
      await Share.share({
        title: `'${roomName}' 팀 초대`,
        message,
        url: Platform.OS === 'ios' ? url : undefined,
      }, {
        dialogTitle: `'${roomName}' 초대장 보내기`,
      });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  }
};
