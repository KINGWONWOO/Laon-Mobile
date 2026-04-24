import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function SubscriptionScreen() {
  const { currentUser, theme, isPro, purchasePro } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isCouponProcessing, setIsCouponProcessing] = useState(false);
  const couponRef = useRef<TextInput>(null);

  const daysLeft = useMemo(() => {
    if (!currentUser?.subscription?.expiryDate) return 0;
    const diff = currentUser.subscription.expiryDate - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [currentUser]);

  const handleCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setIsCouponProcessing(true);
    setCouponError('');
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('benefit, duration_days')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (error) {
        console.error('[coupon] supabase error:', error);
        setCouponError('쿠폰 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      if (!data) {
        setCouponError('유효하지 않은 쿠폰 코드입니다.');
        return;
      }
      await purchasePro(data.duration_days);
      Alert.alert('쿠폰 적용 완료', '라온 댄스 Pro 멤버십이 활성화되었습니다!');
      setCouponCode('');
    } catch (e: any) {
      console.error('[coupon] unexpected error:', e);
      setCouponError('쿠폰 적용 중 오류가 발생했습니다.');
    } finally {
      setIsCouponProcessing(false);
    }
  };

  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
      // In a real app, this would involve expo-in-app-purchases or react-native-iap
      // For now, we simulate the store purchase through our context
      await purchasePro();
      Alert.alert('구독 완료', '라온 댄스 Pro 멤버십이 활성화되었습니다!');
    } catch (e: any) {
      Alert.alert('오류', '결제 처리 중 문제가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const PlanCard = ({ title, price, subText, tier, features, isCurrent, isPopular }: any) => (
    <View style={[
      styles.planCard, 
      { backgroundColor: theme.card, borderColor: isCurrent ? theme.primary : theme.border }, 
      Shadows.medium,
      isCurrent && { borderWidth: 2 }
    ]}>
      {isPopular && !isCurrent && (
        <View style={[styles.popularBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.popularBadgeText}>추천</Text>
        </View>
      )}
      
      <Text style={[styles.planTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.priceContainer}>
        <Text style={[styles.planPrice, { color: theme.text }]}>{price}</Text>
        {subText && <Text style={[styles.priceSub, { color: theme.textSecondary }]}>{subText}</Text>}
      </View>
      
      <View style={styles.featureList}>
        {features.map((f: { text: string, pro?: boolean }, i: number) => (
          <View key={i} style={styles.featureItem}>
            <Ionicons 
              name={f.pro ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color={f.pro ? theme.primary : theme.textSecondary + '44'} 
            />
            <Text style={[
              styles.featureText, 
              { color: theme.text },
              !f.pro && { color: theme.textSecondary, opacity: 0.5, textDecorationLine: 'line-through' }
            ]}>{f.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[
          styles.upgradeBtn, 
          { backgroundColor: isCurrent ? theme.textSecondary + '20' : theme.primary },
          isProcessing && { opacity: 0.7 }
        ]}
        disabled={isCurrent || isProcessing}
        onPress={handlePurchase}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.upgradeBtnText, { color: isCurrent ? theme.textSecondary : '#fff' }]}>
            {isCurrent ? '현재 이용 중' : 'Pro 시작하기'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>멤버십</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isPro ? (
          <LinearGradient
            colors={[theme.primary, theme.primary + 'CC']}
            style={[styles.statusCard, Shadows.medium]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View>
              <Text style={styles.statusLabel}>현재 멤버십</Text>
              <Text style={styles.statusTier}>Pro 멤버십 이용 중</Text>
            </View>
            <View style={styles.daysBadge}>
              <Text style={styles.daysText}>{daysLeft}일 남음</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>라온 댄스 Pro</Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
              크루를 위한 모든 기능을 무제한으로 즐기세요
            </Text>
          </View>
        )}

        {!isPro && (
          <View style={[styles.couponSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.couponHeader}>
              <Ionicons name="ticket-outline" size={18} color={theme.primary} />
              <Text style={[styles.couponLabel, { color: theme.text }]}>쿠폰 코드 입력</Text>
            </View>
            <View style={styles.couponRow}>
              <TextInput
                ref={couponRef}
                style={[styles.couponInput, { color: theme.text, borderColor: couponError ? '#ff4d4f' : theme.border, backgroundColor: theme.background }]}
                placeholder="쿠폰 코드를 입력하세요"
                placeholderTextColor={theme.textSecondary}
                value={couponCode}
                onChangeText={t => { setCouponCode(t); setCouponError(''); }}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleCoupon}
              />
              <TouchableOpacity
                style={[styles.couponApplyBtn, { backgroundColor: theme.primary }, isCouponProcessing && { opacity: 0.7 }]}
                onPress={handleCoupon}
                disabled={isCouponProcessing}
              >
                {isCouponProcessing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.couponApplyText}>적용</Text>
                }
              </TouchableOpacity>
            </View>
            {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
          </View>
        )}

        {!isPro && (
          <View style={[styles.trialBanner, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
            <Ionicons name="gift" size={24} color={theme.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.trialTitle, { color: theme.primary }]}>첫 달 100원 이벤트</Text>
              <Text style={[styles.trialDesc, { color: theme.textSecondary }]}>지금 시작하면 첫 달은 단돈 100원!</Text>
            </View>
          </View>
        )}

        <PlanCard 
          title="Pro 멤버십"
          price="₩3,900"
          subText=" / 월 (첫 달 100원)"
          tier="pro"
          isCurrent={isPro}
          isPopular={true}
          features={[
            { text: "방 생성 무제한 (Free: 3개)", pro: true },
            { text: "동선 제작 기능 (Pro 전용)", pro: true },
            { text: "아카이브 무제한 (Free: 20개)", pro: true },
            { text: "피드백 영상 100개 (Free: 10개)", pro: true },
            { text: "미응답자 알림 기능 (Pro 전용)", pro: true },
            { text: "광고 제거", pro: true },
          ]}
        />

        <View style={styles.faqSection}>
          <Text style={[styles.faqTitle, { color: theme.text }]}>자주 묻는 질문</Text>
          <View style={styles.faqItem}>
            <Text style={[styles.faqQ, { color: theme.text }]}>Q. 언제든지 해지할 수 있나요?</Text>
            <Text style={[styles.faqA, { color: theme.textSecondary }]}>네, 스토어 계정 설정에서 언제든지 구독을 취소할 수 있습니다.</Text>
          </View>
          <View style={styles.faqItem}>
            <Text style={[styles.faqQ, { color: theme.text }]}>Q. 첫 달 100원은 어떻게 적용되나요?</Text>
            <Text style={[styles.faqA, { color: theme.textSecondary }]}>Pro 멤버십을 처음 이용하시는 분들께 자동으로 적용됩니다.</Text>
          </View>
        </View>

        <Text style={[styles.footerInfo, { color: theme.textSecondary }]}>
          결제는 스토어 계정으로 청구되며, 구독 기간 종료 24시간 전에 취소하지 않으면 자동으로 갱신됩니다.
        </Text>
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
  heroSection: { alignItems: 'center', marginBottom: 32 },
  heroTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  heroSub: { fontSize: 15, fontWeight: '500', marginTop: 8, textAlign: 'center', opacity: 0.8 },
  statusCard: { borderRadius: 24, padding: 24, marginBottom: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  statusTier: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  daysBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  daysText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  trialBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  trialTitle: { fontSize: 16, fontWeight: '800' },
  trialDesc: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  planCard: { borderRadius: 32, padding: 32, marginBottom: 24, position: 'relative' },
  popularBadge: { position: 'absolute', top: -12, right: 24, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  popularBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  planTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 32 },
  planPrice: { fontSize: 32, fontWeight: '900' },
  priceSub: { fontSize: 16, fontWeight: '600' },
  featureList: { gap: 16, marginBottom: 32 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 15, fontWeight: '600', flex: 1 },
  upgradeBtn: { paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  upgradeBtnText: { fontSize: 16, fontWeight: '800' },
  faqSection: { marginTop: 16, gap: 20 },
  faqTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  faqItem: { gap: 4 },
  faqQ: { fontSize: 15, fontWeight: '700' },
  faqA: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  footerInfo: { fontSize: 12, textAlign: 'center', marginTop: 40, lineHeight: 18, opacity: 0.6 },
  couponSection: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 24 },
  couponHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  couponLabel: { fontSize: 14, fontWeight: '700' },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  couponApplyBtn: { paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  couponApplyText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  couponError: { color: '#ff4d4f', fontSize: 12, fontWeight: '600', marginTop: 8 },
});
