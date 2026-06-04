import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { Room } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../constants/theme';

export default function InviteScreen() {
  const { roomId, passcode } = useLocalSearchParams<{ roomId: string; passcode: string }>();
  const { currentUser, joinRoom, getRoomByIdRemote, rooms, theme, t } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomId || !passcode) {
      setError(t('inviteInvalidLink'));
      setLoading(false);
      return;
    }

    const existing = rooms.find(r => r.id === roomId);
    if (existing) {
      router.replace(`/room/${roomId}` as any);
      return;
    }

    if (!currentUser) return;

    getRoomByIdRemote(roomId)
      .then(r => {
        if (r) setRoom(r);
        else setError(t('inviteInvalidLink'));
      })
      .catch(() => setError(t('inviteInvalidLink')))
      .finally(() => setLoading(false));
  }, [roomId, passcode, currentUser, rooms]);

  const handleJoin = async () => {
    if (!room || !passcode) return;
    setJoining(true);
    try {
      const joined = await joinRoom(roomId, passcode);
      if (joined) {
        router.replace(`/room/${roomId}` as any);
      } else {
        setError(t('joinFailed'));
        setJoining(false);
      }
    } catch (e: any) {
      setError(e.message || t('joinError'));
      setJoining(false);
    }
  };

  const handleDecline = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/rooms');
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t('checkingInfo')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.textSecondary} />
        <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.singleBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.replace('/rooms')}
        >
          <Text style={[styles.singleBtnText, { color: theme.text }]}>{t('ok')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.card, { backgroundColor: theme.card, ...Shadows.medium }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primary + '18' }]}>
          {room?.imageUri
            ? <Image source={{ uri: room.imageUri }} style={styles.roomImage} />
            : <Ionicons name="people" size={52} color={theme.primary} />
          }
        </View>

        <Text style={[styles.badgeLabel, { color: theme.primary, backgroundColor: theme.primary + '18' }]}>
          {t('teamInvite')}
        </Text>

        <Text style={[styles.roomName, { color: theme.text }]}>{room?.name}</Text>

        <Text style={[styles.desc, { color: theme.textSecondary }]}>{t('inviteDesc')}</Text>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.declineBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={handleDecline}
            disabled={joining}
          >
            <Text style={[styles.declineText, { color: theme.textSecondary }]}>{t('decline')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.joinBtn, { backgroundColor: theme.primary }]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.joinText}>{t('join')}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  singleBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
  },
  singleBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  roomImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  roomName: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    borderWidth: 1,
  },
  joinBtn: {},
  declineText: {
    fontSize: 15,
    fontWeight: '600',
  },
  joinText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
