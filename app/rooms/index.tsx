import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { DanceButton, StyledBackButton } from '../../components/ui/Interactions';
import { LinearGradient } from 'expo-linear-gradient';

export default function RoomsScreen() {
  const router = useRouter();
  const { rooms, currentUser } = useAppContext();

  const myRooms = rooms;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StyledBackButton />
        <View style={styles.profileSection}>
          <Text style={styles.nameText}>{currentUser?.name}</Text>
          <View style={styles.onlineBadge} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.mainTitle}>DANCE ROOMS</Text>
        
        <View style={styles.actionSection}>
          <DanceButton 
            variant="primary"
            onPress={() => router.push('/rooms/create')}
            style={styles.actionButton}
          >
            <View style={styles.actionInner}>
              <View style={styles.iconCircle}>
                <Ionicons name="add" size={32} color={Colors.text} />
              </View>
              <View>
                <Text style={styles.actionTitle}>새 방 만들기</Text>
                <Text style={styles.actionSubtitle}>팀의 새로운 아지트 생성</Text>
              </View>
            </View>
          </DanceButton>

          <DanceButton 
            variant="ghost"
            onPress={() => router.push('/rooms/join')}
            style={styles.actionButton}
          >
            <View style={styles.actionInner}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.card }]}>
                <Ionicons name="key" size={24} color={Colors.accent} />
              </View>
              <View>
                <Text style={[styles.actionTitle, { color: Colors.text }]}>방 참여하기</Text>
                <Text style={styles.actionSubtitle}>초대 코드로 입장</Text>
              </View>
            </View>
          </DanceButton>
        </View>

        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY CREWS</Text>
            <Text style={styles.countText}>{myRooms.length}</Text>
          </View>

          {myRooms.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="musical-notes-outline" size={40} color={Colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>참여 중인 크루가 없습니다</Text>
              <TouchableOpacity onPress={() => router.push('/rooms/join')}>
                <Text style={styles.joinNowText}>지금 팀에 합류하세요</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myRooms.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.roomCard}
                onPress={() => router.push(`/room/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[Colors.card, '#252335']}
                  style={styles.roomCardGradient}
                >
                  <View style={styles.roomInitialCircle}>
                    <Text style={styles.roomInitialText}>{item.name[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName}>{item.name}</Text>
                    <View style={styles.memberRow}>
                      <Ionicons name="people" size={14} color={Colors.accent} />
                      <Text style={styles.roomMeta}>Members</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: 8,
  },
  onlineBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 30,
    letterSpacing: 1,
  },
  actionSection: {
    marginBottom: 40,
  },
  actionButton: {
    marginBottom: 15,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  listSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  countText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.secondary,
  },
  roomCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  roomCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roomInitialCircle: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  roomInitialText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginBottom: 10,
  },
  joinNowText: {
    color: Colors.accent,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
