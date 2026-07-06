import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Alert, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import AdBanner from '../../../../components/ui/AdBanner';
import { Shadows } from '../../../../constants/theme';

export default function FormationListScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { formations, addFormation, updateFormation, deleteFormation, theme, checkProAccess, isPro, t } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedAudio, setSelectedAudio] = useState<{ uri: string, name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio Extraction States
  const [showAudioExtractModal, setShowAudioExtractModal] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStatus, setExtractStatus] = useState('');
  const [extractFileName, setExtractFileName] = useState('');
  const [extractSourceUri, setExtractSourceUri] = useState<string | null>(null);
  const [extractedAudioBase64, setExtractedAudioBase64] = useState<string | null>(null);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [isCompressingAudio, setIsCompressingAudio] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const compressionResolverRef = useRef<((uri: string) => void) | null>(null);
  const compressionRejecterRef = useRef<((err: any) => void) | null>(null);
  
  const webViewRef = useRef<WebView>(null);

  useFocusEffect(
    useCallback(() => {
      const access = checkProAccess('formation');
      if (!access.canAccess) {
        Alert.alert(
          t('proFeatureTitle'),
          t('formationProOnlyMsg'),
          [
            { text: t('back'), onPress: () => router.back() },
            { text: t('viewMembership'), onPress: () => router.push('/subscription') }
          ]
        );
      }
    }, [checkProAccess, t, router])
  );

  const roomFormations = useMemo(() =>
    formations.filter(f => f.roomId === id && !f.isPublished).sort((a, b) => b.createdAt - a.createdAt),
    [formations, id]
  );

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAudio({
          uri: result.assets[0].uri,
          name: result.assets[0].name
        });
      }
    } catch (err) {
      Alert.alert(t('errorTitle'), t('filePickFailed'));
    }
  };

  const handleImportFile = async () => {
    const access = checkProAccess('formation');
    if (!access.canAccess) {
      return Alert.alert(
        t('proFeatureTitle'),
        t('importFormationProOnly'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('viewMembership'), onPress: () => router.push('/subscription') }
        ]
      );
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
        const importedData = JSON.parse(fileContent);
        
        if (!importedData.data || !importedData.settings) {
          throw new Error(t('invalidFormationFormat'));
        }

        setIsSubmitting(true);
        const newId = await addFormation(
          id as string,
          importedData.title || t('importedFormation'),
          importedData.audioUrl,
          importedData.settings,
          importedData.data
        );

        if (importedData.videoSettings) {
          await updateFormation(newId, { videoSettings: importedData.videoSettings });
        }
        
        Alert.alert(t('successTitle'), t('importSuccess'));
      }
    } catch (err: any) {
      Alert.alert(t('errorTitle'), err.message || t('importError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const compressAudio = async (uri: string): Promise<string> => {
    setIsCompressingAudio(true);
    setCompressProgress(0);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const compressScript = `
        (async () => {
          try {
            const b64 = "${base64}";
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
            
            // 64kbps Mono로 최적화
            const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
            const mp3Data = [];
            const ch0 = audioBuffer.getChannelData(0);
            
            const sampleBlockSize = 1152;
            for (let i = 0; i < ch0.length; i += sampleBlockSize) {
              const samples = new Int16Array(sampleBlockSize);
              for (let j = 0; j < sampleBlockSize; j++) {
                if (i + j < ch0.length) {
                  samples[j] = Math.max(-1, Math.min(1, ch0[i + j])) * 32767;
                }
              }
              const mp3buf = mp3encoder.encodeBuffer(samples);
              if (mp3buf.length > 0) mp3Data.push(mp3buf);
              
              if (i % (sampleBlockSize * 150) === 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'COMPRESSION_PROGRESS', 
                  progress: i / ch0.length 
                }));
              }
            }
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
            
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'COMPRESSION_RESULT', data: reader.result }));
            };
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
          }
        })();
      `;

      const compressedDataUrl: string = await new Promise((resolve, reject) => {
        compressionResolverRef.current = resolve;
        compressionRejecterRef.current = reject;
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(compressScript);
        } else {
          reject(new Error('WebView not ready'));
        }
      });

      const base64Data = compressedDataUrl.split(',')[1];
      const fileName = `compressed_${Date.now()}.mp3`;
      const destUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(destUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      return destUri;
    } catch (e) {
      setIsCompressingAudio(false);
      throw e;
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(t('errorTitle'), t('enterFormationTitle'));
      return;
    }
    
    setIsSubmitting(true);
    try {
      let audioUrl = selectedAudio ? selectedAudio.uri : undefined;
      
      if (audioUrl) {
        const fInfo = await FileSystem.getInfoAsync(audioUrl, { size: true } as any) as any;
        if (fInfo.exists && fInfo.size && fInfo.size > 2.5 * 1024 * 1024) {
          try {
            audioUrl = await compressAudio(audioUrl);
          } catch (compErr) {
            console.warn('Compression failed, using original:', compErr);
          }
        }
      }

      const newId = await addFormation(id as string, title.trim(), audioUrl);
      setShowAddModal(false);
      setTitle('');
      setSelectedAudio(null);
      router.push(`/room/${id}/formation/${newId}`);
    } catch (e: any) {
      Alert.alert(t('errorTitle'), e.message);
    } finally {
      setIsSubmitting(false);
      setIsCompressingAudio(false);
    }
  };

  const handleDelete = (fid: string) => {
    Alert.alert(t('deleteFormationTitle'), t('deleteConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteFormation(fid) }
    ]);
  };

  // Audio Extraction Logic
  const handlePickVideoForExtract = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setExtractSourceUri(result.assets[0].uri);
        const name = result.assets[0].name.split('.').slice(0, -1).join('.') || 'extracted_audio';
        setExtractFileName(name);
        setExtractedAudioBase64(null);
        setExtractProgress(0);
      }
    } catch (e) {
      Alert.alert(t('errorTitle'), t('filePickFailed'));
    }
  };

  const handleExtractAudio = async () => {
    if (!extractSourceUri) return;
    setIsExtractingAudio(true);
    setExtractProgress(0);
    setExtractStatus(t('extractStatusPreparing'));
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(extractSourceUri, { size: true } as any) as any;
      const fileSize = fileInfo.size || 0;
      
      // Initialize WebView state for reconstruction
      webViewRef.current?.injectJavaScript(`
        window.extractedChunks = [];
        window.receivedSize = 0;
        window.totalSize = ${fileSize};
        console.log('[WebView] Initialized for file size:', window.totalSize);
      `);

      const CHUNK_SIZE = 1024 * 1024 * 3; // 3MB chunks to be safe with string limits
      
      for (let i = 0; i < fileSize; i += CHUNK_SIZE) {
        setExtractStatus(`${t('extractStatusTransferring')} (${Math.round((i / fileSize) * 100)}%)`);
        const length = Math.min(CHUNK_SIZE, fileSize - i);
        
        // Read only a portion of the file to prevent OOM in Java/Bridge
        const base64Chunk = await FileSystem.readAsStringAsync(extractSourceUri, {
          encoding: FileSystem.EncodingType.Base64,
          position: i,
          length: length
        });
        
        webViewRef.current?.injectJavaScript(`
          (() => {
            try {
              const b64 = "${base64Chunk}";
              const binary = atob(b64);
              const bytes = new Uint8Array(binary.length);
              for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
              window.extractedChunks.push(bytes);
              window.receivedSize += bytes.length;
              
              if (window.receivedSize >= window.totalSize) {
                const finalBuffer = new Uint8Array(window.totalSize);
                let offset = 0;
                for (const chunk of window.extractedChunks) {
                  finalBuffer.set(chunk, offset);
                  offset += chunk.length;
                }
                window.extractedChunks = []; // Clear reference immediately
                window.processAudio(finalBuffer.buffer);
              }
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: 'Chunk processing failed: ' + err.message }));
            }
          })();
        `);
        
        setExtractProgress((i / fileSize) * 0.5); // First 50% is transfer
        // Small delay to allow WebView to process and avoid blocking the bridge
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } catch (e: any) {
      setIsExtractingAudio(false);
      const errorLog = `[AudioExtraction ERROR] Date: ${new Date().toLocaleString()}\\nMessage: ${e.message}\\nStack: ${e.stack}`;
      console.error(errorLog);
      Alert.alert(t('extractErrorOOM'), t('extractErrorMsg') + '\n\n' + e.message);
    }
  };

  const handleDownloadMP3 = async () => {
    if (!extractedAudioBase64) return;
    try {
      const finalName = (extractFileName || t('extractedAudio')).replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ._-]/gi, '_');
      const filePath = `${FileSystem.documentDirectory}${finalName}.mp3`;
      const base64Content = extractedAudioBase64.split(',')[1];
      await FileSystem.writeAsStringAsync(filePath, base64Content, { encoding: FileSystem.EncodingType.Base64 });
      
      // On Android/iOS, try to save to media library or files
      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            finalName,
            'audio/mpeg'
          );
          await FileSystem.writeAsStringAsync(destinationUri, base64Content, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert(t('successTitle'), t('saveToFolderSuccess'));
        }
      } else {
        // iOS fallback to sharing for "Save to Files"
        await Sharing.shareAsync(filePath, { mimeType: 'audio/mpeg', UTI: 'public.mp3' });
      }
    } catch (e: any) {
      Alert.alert(t('errorTitle'), `${t('saveFailed')}: ${e.message}`);
    }
  };

  const handleShareMP3 = async () => {
    if (!extractedAudioBase64) return;
    try {
      const finalName = (extractFileName || t('extractedAudio')).replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ._-]/gi, '_');
      const filePath = `${FileSystem.documentDirectory}${finalName}.mp3`;
      const base64Content = extractedAudioBase64.split(',')[1];
      await FileSystem.writeAsStringAsync(filePath, base64Content, { encoding: FileSystem.EncodingType.Base64 });
      
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('errorTitle'), t('shareNotAvailable'));
        return;
      }
      await Sharing.shareAsync(filePath, { mimeType: 'audio/mpeg', dialogTitle: t('shareAudio') });
    } catch (e: any) {
      Alert.alert(t('errorTitle'), `${t('shareError')}: ${e.message}`);
    }
  };

  const onWebViewMessage = (e: any) => {
    try {
      const event = JSON.parse(e.nativeEvent.data);
      if (event.type === 'EXTRACTION_RESULT') {
        setExtractedAudioBase64(event.data);
        setIsExtractingAudio(false);
        setExtractProgress(1);
        setExtractStatus(t('extractComplete'));
      } else if (event.type === 'EXTRACTION_PROGRESS') {
        setExtractStatus(t('extractingAudio'));
        setExtractProgress(event.progress);
      } else if (event.type === 'COMPRESSION_RESULT') {
        if (compressionResolverRef.current) {
          compressionResolverRef.current(event.data);
          compressionResolverRef.current = null;
        }
        setIsCompressingAudio(false);
      } else if (event.type === 'COMPRESSION_PROGRESS') {
        setCompressProgress(event.progress);
      } else if (event.type === 'ERROR') {
        setIsExtractingAudio(false);
        setIsCompressingAudio(false);
        setExtractStatus(t('error'));
        if (isCompressingAudio && compressionRejecterRef.current) {
          compressionRejecterRef.current(new Error(event.message));
          compressionRejecterRef.current = null;
        } else {
          Alert.alert(t('errorTitle'), `${t('processingError')}: ${event.message}`);
        }
      }
    } catch (err) {
      setIsExtractingAudio(false);
      setIsCompressingAudio(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('formationManagement')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={handleImportFile} style={styles.headerIconBtn}>
            <Ionicons name="download-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.headerIconBtn}>
            <Ionicons name="add" size={28} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={roomFormations}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/room/${id}/formation/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {t('savedToServer')} • {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 5 }}>
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={60} color={theme.border} style={{ marginBottom: 15 }} />
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              {t('noFormationMsg')}
            </Text>
          </View>
        }
      />

      {/* Audio Extract FAB */}
      <TouchableOpacity 
        style={[
          styles.extractFab, 
          { 
            backgroundColor: theme.primary, 
            bottom: isPro ? (20 + (insets.bottom > 0 ? insets.bottom : 0)) : (80 + (insets.bottom > 0 ? insets.bottom : 0))
          }
        ]} 
        onPress={() => setShowAudioExtractModal(true)}
      >
        <Ionicons name="musical-notes" size={24} color="#FFF" />
        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>{t('extract')}</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{t('newFormation')}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.label, { color: theme.text }]}>{t('formationTitleLabel')}</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder={t('formationExample')}
                placeholderTextColor="#888" 
                value={title} 
                onChangeText={setTitle} 
              />

              <Text style={[styles.label, { color: theme.text }]}>{t('audioSettings')}</Text>
              <TouchableOpacity 
                style={[styles.audioPickBtn, { borderColor: theme.border, backgroundColor: theme.background }]} 
                onPress={handlePickAudio}
              >
                <Ionicons name="musical-notes" size={20} color={theme.primary} />
                <Text style={{ color: selectedAudio ? theme.text : theme.textSecondary, marginLeft: 10, flex: 1 }} numberOfLines={1}>
                  {selectedAudio ? selectedAudio.name : t('selectAudioFromDevice')}
                </Text>
                {selectedAudio && (
                  <TouchableOpacity onPress={() => setSelectedAudio(null)}>
                    <Ionicons name="close-circle" size={20} color={theme.error} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {isCompressingAudio && (
                <View style={{ marginBottom: 15, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={{ color: theme.text, fontSize: 12, marginTop: 5 }}>{t('compressingAudio')} ({Math.round(compressProgress * 100)}%)</Text>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: theme.primary }]} 
                onPress={handleCreate}
                disabled={isSubmitting || isCompressingAudio}
              >
                {isSubmitting || isCompressingAudio ? <ActivityIndicator color={theme.background} /> : <Text style={[styles.submitBtnText, { color: theme.background }]}>{t('create')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showAudioExtractModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{t('extractAudio')}</Text>
                <TouchableOpacity onPress={() => setShowAudioExtractModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {!isExtractingAudio && !extractedAudioBase64 && (
                <View>
                  <Text style={{ color: theme.textSecondary, marginBottom: 20, fontSize: 13 }}>
                    {t('extractAudioDesc')}
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.audioPickBtn, { borderColor: theme.border, backgroundColor: theme.background, marginBottom: 20 }]} 
                    onPress={handlePickVideoForExtract}
                  >
                    <Ionicons name="videocam" size={20} color={theme.primary} />
                    <Text style={{ color: extractSourceUri ? theme.text : theme.textSecondary, marginLeft: 10, flex: 1 }} numberOfLines={1}>
                      {extractSourceUri ? t('videoSelected') : t('selectVideoToExtract')}
                    </Text>
                  </TouchableOpacity>

                  {extractSourceUri && (
                    <TouchableOpacity 
                      style={[styles.submitBtn, { backgroundColor: theme.primary }]} 
                      onPress={handleExtractAudio}
                    >
                      <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{t('startExtraction')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {isExtractingAudio && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={{ color: theme.text, marginTop: 15, fontWeight: 'bold' }}>{extractStatus}</Text>
                  <Text style={{ color: theme.textSecondary, marginTop: 5, fontSize: 12 }}>{Math.round(extractProgress * 100)}%</Text>
                  <View style={{ width: '100%', height: 6, backgroundColor: theme.border, borderRadius: 3, marginTop: 15, overflow: 'hidden' }}>
                    <View style={{ width: `${extractProgress * 100}%`, height: '100%', backgroundColor: theme.primary }} />
                  </View>
                </View>
              )}

              {extractedAudioBase64 && (
                <View>
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Ionicons name="checkmark-circle" size={48} color={theme.success} />
                    <Text style={{ color: theme.text, fontWeight: 'bold', marginTop: 10 }}>{t('extractComplete')}</Text>
                  </View>

                  <Text style={[styles.label, { color: theme.text, marginBottom: 8 }]}>{t('fileNamePlaceholder')}</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                    value={extractFileName}
                    onChangeText={setExtractFileName}
                    placeholder={t('enterFileName')}
                    placeholderTextColor={theme.textSecondary}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity 
                      style={[styles.submitBtn, { backgroundColor: theme.success, flex: 1, flexDirection: 'row' }]} 
                      onPress={handleDownloadMP3}
                    >
                      <Ionicons name="download-outline" size={20} color="#FFF" />
                      <Text style={{ color: '#FFF', fontWeight: 'bold', marginLeft: 8 }}>{t('download')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.submitBtn, { backgroundColor: theme.primary, flex: 1, flexDirection: 'row' }]} 
                      onPress={handleShareMP3}
                    >
                      <Ionicons name="share-social-outline" size={20} color="#FFF" />
                      <Text style={{ color: '#FFF', fontWeight: 'bold', marginLeft: 8 }}>{t('share')}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={{ marginTop: 15, alignItems: 'center' }} 
                    onPress={() => { setExtractedAudioBase64(null); setExtractSourceUri(null); }}
                  >
                    <Text style={{ color: theme.textSecondary }}>{t('newExtraction')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}>
        <WebView 
          ref={webViewRef} 
          onMessage={onWebViewMessage} 
          source={{ html: `
            <html>
            <head>
              <meta charset="utf-8">
              <script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js"></script>
            </head>
            <body>
              <script>
                window.processAudio = async (arrayBuffer) => {
                  try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    
                    const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, 128);
                    const mp3Data = [];
                    const ch0 = audioBuffer.getChannelData(0);
                    const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
                    
                    const sampleBlockSize = 1152;
                    for (let i = 0; i < ch0.length; i += sampleBlockSize) {
                      const left = new Int16Array(sampleBlockSize);
                      const right = new Int16Array(sampleBlockSize);
                      for (let j = 0; j < sampleBlockSize; j++) {
                        if (i + j < ch0.length) {
                          left[j] = Math.max(-1, Math.min(1, ch0[i + j])) * 32767;
                          right[j] = Math.max(-1, Math.min(1, ch1[i + j])) * 32767;
                        }
                      }
                      const mp3buf = mp3encoder.encodeBuffer(left, right);
                      if (mp3buf.length > 0) mp3Data.push(mp3buf);
                      
                      if (i % (sampleBlockSize * 10) === 0) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ 
                          type: 'EXTRACTION_PROGRESS', 
                          progress: 0.5 + (i / ch0.length) * 0.5 
                        }));
                      }
                    }
                    const mp3buf = mp3encoder.flush();
                    if (mp3buf.length > 0) mp3Data.push(mp3buf);
                    
                    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EXTRACTION_RESULT', data: reader.result }));
                    };
                  } catch (e) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
                  }
                };
              </script>
            </body>
            </html>
          ` }} 
          originWhitelist={['*']}
        />
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerIconBtn: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  publishedBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 25, borderRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 15 },
  audioPickBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, justifyContent: 'center' },
  submitBtnText: { fontWeight: 'bold', fontSize: 16 },
  extractFab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
    zIndex: 999,
  },
});
