import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Switch, ScrollView, Dimensions, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppContext } from '../../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/theme';
import { DanceButton } from '../../../components/ui/Interactions';

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate();
};

export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, rooms, schedules, addSchedule, updateSchedule, deleteSchedule, respondToSchedule, getUserById, markScheduleAsViewed, theme } = useAppContext();
  
  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [sendNotification, setSendNotification] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const room = rooms.find(r => r.id === id);
  const roomSchedules = schedules
    .filter(s => s.roomId === id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleCreateSchedule = () => {
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }

    if (editingId) {
      updateSchedule(editingId, title.trim());
      resetForm();
    } else {
      if (selectedDates.length === 0) {
        Alert.alert('오류', '날짜를 선택해주세요.');
        return;
      }
      const sortedDates = [...selectedDates].sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      const HOURS = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
      const generatedOptions: string[] = [];
      sortedDates.forEach(date => { HOURS.forEach(hour => { generatedOptions.push(`${date} ${hour}`); }); });

      addSchedule(id, title.trim(), generatedOptions, startDate, endDate, sendNotification);
      resetForm();
    }
  };

  const resetForm = () => {
    setTitle('');
    setSelectedDates([]);
    setEditingId(null);
    setShowCreate(false);
  };

  const startEdit = (schedule: any) => {
    setTitle(schedule.title);
    setEditingId(schedule.id);
    setShowCreate(true);
  };

  const confirmDelete = (scheduleId: string) => {
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSchedule(scheduleId) }
    ]);
  };

  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => 
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity 
        style={[styles.createToggle, { backgroundColor: theme.primary }]} 
        onPress={() => showCreate ? resetForm() : setShowCreate(true)}
      >
        <Ionicons name={showCreate ? "close" : "add"} size={24} color={theme.background} />
        <Text style={[styles.createToggleText, { color: theme.background }]}>{showCreate ? "취소" : "새 일정 조율 만들기"}</Text>
      </TouchableOpacity>

      {showCreate && (
        <View style={[styles.createContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>일정 제목</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="예: 정기 연습 시간"
            placeholderTextColor={theme.textSecondary}
          />
          
          {!editingId && (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>날짜 선택 (최대 7일)</Text>
              <CalendarPicker theme={theme} selectedDates={selectedDates} onToggleDate={toggleDateSelection} />
            </>
          )}

          {!editingId && (
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>팀원들에게 알림 전송</Text>
              <Switch value={sendNotification} onValueChange={setSendNotification} trackColor={{ true: theme.primary }} />
            </View>
          )}

          <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={handleCreateSchedule}>
            <Text style={[styles.submitButtonText, { color: theme.background }]}>{editingId ? "수정하기" : "만들기"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={roomSchedules}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ScheduleCard 
            schedule={item} 
            currentUser={currentUser} 
            respondToSchedule={respondToSchedule} 
            getUserById={getUserById}
            markScheduleAsViewed={markScheduleAsViewed}
            onEdit={() => startEdit(item)}
            onDelete={() => confirmDelete(item.id)}
            theme={theme}
          />
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 일정이 없습니다.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

function CalendarPicker({ selectedDates, onToggleDate, theme }: { selectedDates: string[]; onToggleDate: (date: string) => void; theme: any }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <View style={[styles.calendarContainer, { backgroundColor: theme.background + '40' }]}>
      <Text style={[styles.calendarMonth, { color: theme.text }]}>{year}년 {month + 1}월</Text>
      <View style={styles.calendarGrid}>
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <View key={d} style={styles.calendarDayHeader}><Text style={[styles.calendarDayHeaderText, { color: theme.textSecondary }]}>{d}</Text></View>
        ))}
        {days.map((day, idx) => {
          if (!day) return <View key={idx} style={styles.calendarDayCell} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDates.includes(dateStr);
          const isToday = day === now.getDate();

          return (
            <TouchableOpacity 
              key={idx} 
              style={[styles.calendarDayCell, isSelected && { backgroundColor: theme.primary }, isToday && { borderWidth: 1, borderColor: theme.primary }]}
              onPress={() => onToggleDate(dateStr)}
            >
              <Text style={[styles.calendarDayText, { color: isSelected ? theme.background : theme.text }]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const ScheduleCard = ({ schedule, currentUser, respondToSchedule, getUserById, markScheduleAsViewed, onEdit, onDelete, theme }: any) => {
  const [localResponses, setLocalResponses] = useState<string[]>(schedule.responses[currentUser?.id || ''] || []);
  const [isEditing, setIsEditing] = useState(false);
  const [showReaders, setShowReaders] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  useEffect(() => {
    markScheduleAsViewed(schedule.id);
  }, []);

  const groupedOptions: { [date: string]: any[] } = {};
  schedule.options.forEach((opt: any) => {
    const [date, time] = opt.dateTime.split(' ');
    if (!groupedOptions[date]) groupedOptions[date] = [];
    groupedOptions[date].push({ ...opt, time });
  });

  const dates = Object.keys(groupedOptions).sort();
  const creator = getUserById(schedule.userId);
  const participantIds = Object.keys(schedule.responses);
  const isMine = currentUser?.id === schedule.userId;
  const HOURS = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

  const toggleOption = (optId: string) => {
    setLocalResponses(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]);
  };

  const saveResponses = () => {
    respondToSchedule(schedule.id, localResponses);
    setIsEditing(false);
  };

  const handleCellClick = (opt: any) => {
    if (isEditing) {
      toggleOption(opt.id);
    } else {
      setExpandedCell(expandedCell === opt.id ? null : opt.id);
    }
  };

  return (
    <View style={[styles.scheduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.scheduleHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.creatorText, { color: theme.primary }]}>{creator?.name || '알 수 없음'}님의 일정 요청</Text>
          <Text style={[styles.scheduleTitle, { color: theme.text }]}>{schedule.title}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={[styles.dateBadge, { backgroundColor: theme.background + '40' }]}>
            <Text style={[styles.dateBadgeText, { color: theme.textSecondary }]}>{schedule.startDate?.slice(5)} ~ {schedule.endDate?.slice(5)}</Text>
          </View>
          {isMine && (
            <View style={styles.adminButtons}>
              <TouchableOpacity onPress={onEdit} style={styles.adminBtn}><Ionicons name="pencil" size={16} color={theme.textSecondary} /></TouchableOpacity>
              <TouchableOpacity onPress={onDelete} style={styles.adminBtn}><Ionicons name="trash" size={16} color={theme.error} /></TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.metaRow}>
        <TouchableOpacity style={styles.metaItem} onPress={() => setShowReaders(!showReaders)}>
          <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>{schedule.viewedBy.length}명 읽음</Text>
          <Ionicons name={showReaders ? "chevron-up" : "chevron-down"} size={12} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.metaItem} onPress={() => setShowParticipants(!showParticipants)}>
          <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>{participantIds.length}명 참여</Text>
          <Ionicons name={showParticipants ? "chevron-up" : "chevron-down"} size={12} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {showReaders && (
        <View style={[styles.expandableList, { backgroundColor: theme.background + '20' }]}>
          <Text style={[styles.expandableListText, { color: theme.textSecondary }]}>읽은 사람: {schedule.viewedBy.map((uid: string) => getUserById(uid)?.name).join(', ')}</Text>
        </View>
      )}
      {showParticipants && (
        <View style={[styles.expandableList, { backgroundColor: theme.background + '20' }]}>
          <Text style={[styles.expandableListText, { color: theme.textSecondary }]}>참여한 사람: {participantIds.map(uid => getUserById(uid)?.name).join(', ')}</Text>
        </View>
      )}

      {expandedCell && (
        <View style={[styles.expandableList, { backgroundColor: theme.primary + '15', borderColor: theme.primary, borderWidth: 1 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.expandableListText, { color: theme.text, fontWeight: 'bold' }]}>
              {schedule.options.find((o: any) => o.id === expandedCell)?.dateTime} 가능 인원
            </Text>
            <TouchableOpacity onPress={() => setExpandedCell(null)}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.expandableListText, { color: theme.textSecondary, marginTop: 4 }]}>
            {participantIds.filter(uid => schedule.responses[uid]?.includes(expandedCell)).map(uid => getUserById(uid)?.name).join(', ') || '없음'}
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gridContainer}>
        <View>
          <View style={styles.gridRow}>
            <View style={[styles.gridHeaderCell, { backgroundColor: theme.background + '40', borderColor: theme.border }]}><Text style={[styles.gridHeaderText, { color: theme.textSecondary }]}>시간</Text></View>
            {dates.map(date => (
              <View key={date} style={[styles.gridHeaderCell, { backgroundColor: theme.background + '40', borderColor: theme.border }]}><Text style={[styles.gridHeaderText, { color: theme.textSecondary }]}>{date.split('-')[1]}/{date.split('-')[2]}</Text></View>
            ))}
          </View>

          {HOURS.map(hour => (
            <View key={hour} style={styles.gridRow}>
              <View style={[styles.gridDateCell, { backgroundColor: theme.background + '20', borderColor: theme.border }]}><Text style={[styles.gridDateText, { color: theme.text }]}>{hour}</Text></View>
              {dates.map(date => {
                const opt = groupedOptions[date].find(o => o.time === hour);
                if (!opt) return <View key={date} style={[styles.gridCell, { borderColor: theme.border }]} />;
                const responses = Object.values(schedule.responses) as string[][];
                const count = responses.filter((r) => r.includes(opt.id)).length;
                const totalParticipants = participantIds.length;
                const isSelected = localResponses.includes(opt.id);
                const isExpanded = expandedCell === opt.id;
                const popularityRatio = totalParticipants > 0 ? count / totalParticipants : 0;
                
                let cellBg = theme.card;
                if (isEditing) {
                  cellBg = isSelected ? theme.primary : theme.card;
                } else if (count > 0) {
                  cellBg = theme.primary + Math.round((0.1 + popularityRatio * 0.9) * 255).toString(16).padStart(2, '0');
                }

                return (
                  <TouchableOpacity
                    key={date}
                    style={[
                      styles.gridCell, 
                      { backgroundColor: cellBg, borderColor: isExpanded ? theme.primary : theme.border },
                      isSelected && isEditing && { borderColor: theme.text, borderWidth: 1 }
                    ]}
                    onPress={() => handleCellClick(opt)}
                  >
                    {!isEditing && count > 0 && <Text style={[styles.cellCountText, { color: popularityRatio > 0.5 ? theme.background : theme.text }]}>{count}</Text>}
                    {isEditing && isSelected && <Ionicons name="checkmark" size={16} color={theme.background} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {isEditing ? (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]} 
            onPress={() => { setLocalResponses(schedule.responses[currentUser?.id || ''] || []); setIsEditing(false); }}
          >
            <Text style={[styles.actionButtonText, { color: theme.text }]}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary }]} onPress={saveResponses}>
            <Text style={[styles.actionButtonText, { color: theme.background }]}>가능한 시간 저장</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.primary }]} onPress={() => setIsEditing(true)}>
          <Ionicons name="calendar-outline" size={18} color={theme.background} style={{ marginRight: 8 }} />
          <Text style={[styles.editButtonText, { color: theme.background }]}>내 일정 입력하기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  createToggle: { flexDirection: 'row', alignItems: 'center', margin: 15, padding: 15, borderRadius: 12, justifyContent: 'center' },
  createToggleText: { marginLeft: 8, fontSize: 16, fontWeight: 'bold' },
  createContainer: { margin: 15, marginTop: 0, padding: 20, borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 13, marginBottom: 8, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  calendarContainer: { padding: 10, borderRadius: 12, marginBottom: 15 },
  calendarMonth: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayHeader: { width: `${100/7}%`, alignItems: 'center', paddingVertical: 4 },
  calendarDayHeaderText: { fontSize: 9 },
  calendarDayCell: { width: `${100/7}%`, aspectRatio: 1.2, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  calendarDayText: { fontSize: 11 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  toggleLabel: { fontSize: 14 },
  submitButton: { padding: 15, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { fontWeight: 'bold', fontSize: 16 },
  scheduleCard: { margin: 15, marginTop: 0, padding: 20, borderRadius: 20, borderWidth: 1 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  creatorText: { fontSize: 12, marginBottom: 4 },
  scheduleTitle: { fontSize: 18, fontWeight: 'bold' },
  dateBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 5 },
  dateBadgeText: { fontSize: 11 },
  adminButtons: { flexDirection: 'row' },
  adminBtn: { marginLeft: 15 },
  metaRow: { flexDirection: 'row', marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  metaText: { fontSize: 12, marginHorizontal: 4 },
  expandableList: { padding: 8, borderRadius: 8, marginBottom: 10 },
  expandableListText: { fontSize: 11, fontStyle: 'italic' },
  gridContainer: { marginBottom: 20 },
  gridRow: { flexDirection: 'row' },
  gridHeaderCell: { width: 50, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5 },
  gridHeaderText: { fontSize: 9 },
  gridDateCell: { width: 50, height: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5 },
  gridDateText: { fontSize: 10, fontWeight: 'bold' },
  gridCell: { width: 50, height: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5 },
  cellCountText: { fontSize: 12, fontWeight: 'bold' },
  editButton: { flexDirection: 'row', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { fontWeight: 'bold', fontSize: 15 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  actionButtonText: { fontWeight: 'bold', fontSize: 15 },
  emptyText: { textAlign: 'center', marginTop: 50 },
});
