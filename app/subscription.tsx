import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../constants/theme';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function SubscriptionScreen() {
  const { currentUser, theme, refreshAllData } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: 'free' | 'pro') => {
    if (currentUser?.subscriptionTier === tier) return;
    
    setLoading(tier);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('id', currentUser?.id);

      if (error) throw error;
      
      await refreshAllData();
      Alert.alert('성공', `${tier === 'pro' ? '프로' : '무료'} 플랜으로 변경되었습니다!`);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(null);
    }
  };

  const PlanCard = ({ title, price, tier, features, isCurrent }: any) => (
    <View style={[styles.planCard, { backgroundColor: theme.card }, Shadows.medium, isCurrent && { borderColor: theme.primary, borderWidth: 2 }]}>
      {isCurrent && (
        <View style={[styles.currentBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.currentBadgeText}>현재 이용 중</Text>
        </View>
      )}
      <Text style={[styles.planTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.priceContainer}>
        <Text style={[styles.planPrice, { color: theme.text }]}>{price}</Text>
        {price !== '무료' && <Text style={[styles.priceSub, { color: theme.textSecondary }]}> / 월</Text>}
      </View>
      
      <View style={styles.featureList}>
        {features.map((f: string, i: number) => (
          <View key={i} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
            <Text style={[styles.featureText, { color: theme.text }]}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[
          styles.upgradeBtn, 
          { backgroundColor: isCurrent ? theme.textSecondary + '20' : theme.primary },
          loading === tier && { opacity: 0.7 }
        ]}
        disabled={isCurrent || loading !== null}
        onPress={() => handleUpgrade(tier)}
      >
        {loading === tier ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.upgradeBtnText, { color: isCurrent ? theme.textSecondary : '#fff' }]}>
            {isCurrent ? '현재 플랜' : '선택하기'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>멤버십 관리</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Ionicons name="flash" size={48} color={theme.primary} />
          <Text style={[styles.heroTitle, { color: theme.text }]}>나에게 맞는 플랜을 선택하세요</Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary }]}>더 강력한 기능으로 댄스 피드백 경험을 완성하세요</Text>
        </View>

        <PlanCard 
          title="Free"
          price="무료"
          tier="free"
          isCurrent={currentUser?.subscriptionTier === 'free' || !currentUser?.subscriptionTier}
          features={[
            "최대 3개의 방 생성",
            "방당 10개의 피드백 영상",
            "방당 20개의 아카이브 사진",
            "동선 툴 (뷰어 모드)",
          ]}
        />

        <PlanCard 
          title="Pro"
          price="₩4,900"
          tier="pro"
          isCurrent={currentUser?.subscriptionTier === 'pro'}
          features={[
            "무제한 방 생성",
            "방당 100개의 피드백 영상",
            "무제한 아카이브 사진",
            "동선 툴 (생성 및 편집 가능)",
            "미응답자 수동 알림 발송",
            "우선 고객 지원"
          ]}
        />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            구독은 언제든지 해지할 수 있으며, 결제는 앱스토어를 통해 안전하게 처리됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scrollContent: { padding: 24, paddingBottom: 60 },
  heroSection: { alignItems: 'center', marginBottom: 40 },
  heroTitle: { fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  heroSub: { fontSize: 14, fontWeight: '500', marginTop: 8, textAlign: 'center', opacity: 0.7 },
  planCard: { borderRadius: 32, padding: 32, marginBottom: 24, position: 'relative' },
  currentBadge: { position: 'absolute', top: -12, right: 24, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  currentBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  planTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 32 },
  planPrice: { fontSize: 32, fontWeight: '900' },
  priceSub: { fontSize: 16, fontWeight: '600' },
  featureList: { gap: 16, marginBottom: 32 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 15, fontWeight: '600', flex: 1 },
  upgradeBtn: { paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  upgradeBtnText: { fontSize: 16, fontWeight: '800' },
  infoBox: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  infoText: { fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 }
});
