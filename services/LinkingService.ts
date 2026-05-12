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
  shareRoomInvite: async (roomName: string, roomId: string, passcode: string, inviteMsg?: string, inviteMsgWithLink?: string, inviteShareTitle?: string) => {
    const url = LinkingService.createRoomInviteLink(roomId, passcode);
    const replace = (tmpl: string) => tmpl.replace('{roomName}', roomName).replace('{roomId}', roomId).replace('{passcode}', passcode).replace('{url}', url);
    const iosMsg = inviteMsg ? replace(inviteMsg) : `[LAON DANCE] '${roomName}' 팀에 초대되셨습니다!\n\n방 ID: ${roomId}\n참여 코드: ${passcode}`;
    const androidMsg = inviteMsgWithLink ? replace(inviteMsgWithLink) : `[LAON DANCE] '${roomName}' 팀에 초대되셨습니다!\n\n링크: ${url}\n\n방 ID: ${roomId}\n참여 코드: ${passcode}`;
    const shareTitle = inviteShareTitle ? replace(inviteShareTitle) : `'${roomName}' 팀 초대`;
    const message = Platform.OS === 'ios' ? iosMsg : androidMsg;

    try {
      await Share.share({
        title: shareTitle,
        message,
        url: Platform.OS === 'ios' ? url : undefined,
      }, {
        dialogTitle: shareTitle,
      });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  }
};
