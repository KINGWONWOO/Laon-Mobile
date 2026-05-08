import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { LegalDoc } from '../../constants/legalContent';

interface Props {
  doc: LegalDoc;
}

export default function LegalScreen({ doc }: Props) {
  const { theme, t } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {doc.title}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 타이틀 + 액센트 바 */}
        <View style={[styles.titleAccent, { backgroundColor: theme.primary }]} />
        <Text style={[styles.title, { color: theme.text }]}>{doc.title}</Text>

        {/* 인트로 */}
        {doc.intro && (
          <Text style={[styles.intro, { color: theme.textSecondary }]}>{doc.intro}</Text>
        )}

        {/* 섹션들 */}
        {doc.sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={[styles.sectionHeading, { color: theme.text, borderLeftColor: theme.primary }]}>
              {section.heading}
            </Text>
            {section.content.map((block, bi) => {
              if (block.type === 'paragraph') {
                return (
                  <Text key={bi} style={[styles.paragraph, { color: theme.textSecondary }]}>
                    {block.text}
                  </Text>
                );
              }
              return (
                <View key={bi} style={styles.list}>
                  {block.items.map((item, ii) => (
                    <View key={ii} style={styles.listItem}>
                      <Text style={[styles.bullet, { color: theme.primary }]}>•</Text>
                      <Text style={[styles.listText, { color: theme.textSecondary }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}

        {/* 이메일 문의처 */}
        {doc.contact && (
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${doc.contact}`)}>
            <Text style={[styles.contact, { color: theme.primary }]}>{doc.contact}</Text>
          </TouchableOpacity>
        )}

        {/* 시행일 */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>{doc.effectiveDate}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  titleAccent: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
    lineHeight: 32,
  },
  intro: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
    lineHeight: 22,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  list: {
    gap: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  contact: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 28,
    textDecorationLine: 'underline',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 8,
  },
  footerText: {
    fontSize: 13,
  },
});
