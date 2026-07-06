import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { getOfferings } from '../services/revenueCat';
import { PurchasesPackage } from 'react-native-purchases';

const { width } = Dimensions.get('window');

export default function SubscriptionScreen() {
  const { currentUser, theme, isPro, purchasePro, restoreProPurchases, t } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isCouponProcessing, setIsCouponProcessing] = useState(false);
  const couponRef = useRef<TextInput>(null);

  const [proPackage, setProPackage] = useState<PurchasesPackage | null>(null);
  const [displayPrice, setDisplayPrice] = useState('₩3,900');

  useEffect(() => {
    getOfferings().then(offering => {
      const pkg = offering?.availablePackages?.[0] ?? null;
      if (pkg) {
        setProPackage(pkg);
        setDisplayPrice(pkg.product.priceString);
      }
    }).catch(() => {});
  }, []);

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
        setCouponError(t('couponError'));
        return;
      }
      if (!data) {
        setCouponError(t('couponInvalid'));
        return;
      }
      await purchasePro(data.duration_days);
      Alert.alert(t('couponApplied'), t('proActivated'));
      setCouponCode('');
    } catch (e: any) {
      console.error('[coupon] unexpected error:', e);
      setCouponError(t('couponApplyError'));
    } finally {
      setIsCouponProcessing(false);
    }
  };

  const handlePurchase = async () => {
    if (!proPackage) {
      Alert.alert(t('errorTitle'), t('paymentError'));
      return;
    }
    setIsProcessing(true);
    try {
      await purchasePro(proPackage);
      Alert.alert(t('subscriptionComplete'), t('proActivated'));
    } catch (e: any) {
      // 사용자가 구매를 취소한 경우는 에러 표시 안 함
      if (!e?.userCancelled) {
        Alert.alert(t('errorTitle'), t('paymentError'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const restored = await restoreProPurchases();
      if (restored) {
        Alert.alert(t('subscriptionComplete'), t('proActivated'));
      } else {
        Alert.alert(t('errorTitle'), '복원할 구독 내역이 없습니다.');
      }
    } catch (e: any) {
      Alert.alert(t('errorTitle'), t('paymentError'));
    } finally {
      setIsRestoring(false);
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
          <Text style={styles.popularBadgeText}>{t('recommended')}</Text>
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
            {isCurrent ? t('currentlyUsing') : t('startProBtn')}
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('subscriptionTitle')}</Text>
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
              <Text style={styles.statusLabel}>{t('currentPlan')}</Text>
              <Text style={styles.statusTier}>{t('proCurrently')}</Text>
            </View>
            <View style={styles.daysBadge}>
              <Text style={styles.daysText}>{daysLeft}{t('daysLeft')}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{t('proProductTitle')}</Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
              {t('proTagline')}
            </Text>
          </View>
        )}

        {!isPro && (
          <View style={[styles.couponSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.couponHeader}>
              <Ionicons name="ticket-outline" size={18} color={theme.primary} />
              <Text style={[styles.couponLabel, { color: theme.text }]}>{t('enterCouponLabel')}</Text>
            </View>
            <View style={styles.couponRow}>
              <TextInput
                ref={couponRef}
                style={[styles.couponInput, { color: theme.text, borderColor: couponError ? '#ff4d4f' : theme.border, backgroundColor: theme.background }]}
                placeholder={t('couponPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={couponCode}
                onChangeText={text => { setCouponCode(text); setCouponError(''); }}
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
                  : <Text style={styles.couponApplyText}>{t('applyCoupon')}</Text>
                }
              </TouchableOpacity>
            </View>
            {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
          </View>
        )}

        <PlanCard
          title={t('proCardTitle')}
          price={displayPrice}
          subText={t('priceSubText')}
          tier="pro"
          isCurrent={isPro}
          isPopular={true}
          features={[
            { text: t('featureUnlimitedRooms'), pro: true },
            { text: t('featureFormation'), pro: true },
            { text: t('featureUnlimitedArchive'), pro: true },
            { text: t('featureFeedbackVideos'), pro: true },
            { text: t('featureNonResponder'), pro: true },
            { text: t('featureNoAds'), pro: true },
          ]}
        />

        {!isPro && (
          <TouchableOpacity
            style={[styles.restoreBtn, { borderColor: theme.border }]}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring
              ? <ActivityIndicator size="small" color={theme.textSecondary} />
              : <Text style={[styles.restoreBtnText, { color: theme.textSecondary }]}>{t('restorePurchase')}</Text>
            }
          </TouchableOpacity>
        )}

        <View style={styles.faqSection}>
          <Text style={[styles.faqTitle, { color: theme.text }]}>{t('faqTitle')}</Text>
          <View style={styles.faqItem}>
            <Text style={[styles.faqQ, { color: theme.text }]}>{t('faq1Q')}</Text>
            <Text style={[styles.faqA, { color: theme.textSecondary }]}>{t('faq1A')}</Text>
          </View>
        </View>

        <Text style={[styles.footerInfo, { color: theme.textSecondary }]}>
          {t('footerInfo')}
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
  restoreBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  restoreBtnText: { fontSize: 13, fontWeight: '600' },
});
