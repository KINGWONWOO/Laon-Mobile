import { Share } from 'react-native';

export const LinkingService = {
  shareRoomInvite: async (roomName: string, roomId: string, passcode: string, inviteMsg?: string, _inviteMsgWithLink?: string, inviteShareTitle?: string) => {
    const replace = (tmpl: string) =>
      tmpl.replace('{roomName}', roomName).replace('{roomId}', roomId).replace('{passcode}', passcode);

    const message = inviteMsg
      ? replace(inviteMsg)
      : `[LAON] '${roomName}' 팀에 초대되셨습니다!\n\n방 ID: ${roomId}\n참여 코드: ${passcode}`;
    const shareTitle = inviteShareTitle ? replace(inviteShareTitle) : `'${roomName}' 팀 초대`;

    try {
      await Share.share({ title: shareTitle, message }, { dialogTitle: shareTitle });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  }
};
