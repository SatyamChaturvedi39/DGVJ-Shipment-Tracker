import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { askAI } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  time: string;
}

const SUGGESTIONS = [
  { icon: 'cube-outline', label: 'Active shipments', color: '#6366f1' },
  { icon: 'alert-circle-outline', label: 'Delayed shipments', color: '#f59e0b' },
  { icon: 'stats-chart-outline', label: "Today's summary", color: '#10b981' },
  { icon: 'people-outline', label: 'Team performance', color: '#8b5cf6' },
  { icon: 'checkmark-done-outline', label: 'Delivered today', color: '#22c55e' },
  { icon: 'search-outline', label: 'Most busy phase', color: '#3b82f6' },
];

const TOOL_LABELS: Record<string, string> = {
  get_active_shipments:     'Analyzed active inventory',
  get_delayed_shipments:    'Scanned for delayed cargo',
  get_shipment_detail:      'Retrieved specific manifest',
  get_employee_performance: 'Audited personnel metrics',
  get_operations_summary:   'Calculated operational KPIs',
};

function getTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AIAssistantScreen() {
  const { logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const listRef = useRef<FlatList>(null);

  const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message    = { id: Date.now().toString(), role: 'user', content: q, time: getTime() };
    const thinkingMsg: Message = { id: 'thinking', role: 'assistant', content: '', time: '' };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setLoading(true);
    
    try {
      const result = await askAI({ question: q, history: historyForApi });
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        tools_used: result.tools_used,
        time: getTime(),
      };
      setMessages(prev => [...prev.filter(m => m.id !== 'thinking'), aiMsg]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
      setMessages(prev => [...prev.filter(m => m.id !== 'thinking'), {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered a communication error with the core. Please retry.\n\n(ERR: ${detail})`,
        time: getTime(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  const renderItem = ({ item }: { item: Message }) => {
    const isUser     = item.role === 'user';
    const isThinking = item.id === 'thinking';

    if (isThinking) {
      return (
        <View style={s.aiRow}>
          <View style={s.avatar}>
            <Ionicons name="sparkles" size={16} color="#FFF" />
          </View>
          <View style={[s.bubble, s.aiBubble]}>
            <View style={s.dotsRow}>
              <ActivityIndicator size="small" color={Colors.slate} />
              <Text style={s.thinkingText}>Querying operations database...</Text>
            </View>
          </View>
        </View>
      );
    }

    if (isUser) {
      return (
        <View style={s.userRow}>
          <View style={s.userBubbleWrap}>
            <View style={[s.bubble, s.userBubble]}>
              <Text style={s.userBubbleText}>{item.content}</Text>
            </View>
            <Text style={s.timeText}>{item.time}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={s.aiRow}>
        <View style={s.avatar}>
          <Ionicons name="sparkles" size={16} color="#FFF" />
        </View>
        <View style={s.aiBubbleWrap}>
          <View style={[s.bubble, s.aiBubble]}>
            <Text style={s.aiBubbleText}>{item.content}</Text>
          </View>
          {item.tools_used && item.tools_used.length > 0 && (
            <View style={s.toolsRow}>
              {item.tools_used.map(t => (
                <View key={t} style={s.toolChip}>
                  <Ionicons name="shield-checkmark" size={10} color={Colors.slate} />
                  <Text style={s.toolChipText}>{TOOL_LABELS[t] ?? t}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={s.timeText}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerAvatar}>
              <Ionicons name="sparkles" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={s.headerName}>Digi AI</Text>
              <View style={s.headerStatusRow}>
                <View style={s.onlineDot} />
                <Text style={s.headerSub}>Active · Llama 3.3 Core</Text>
              </View>
            </View>
          </View>
          <View style={s.headerRight}>
            {messages.length > 0 && (
              <TouchableOpacity onPress={clearChat} style={s.headerBtn}>
                <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleLogout} style={[s.headerBtn, s.signOutBtn]}>
              <Text style={s.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chat area */}
        {messages.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIconContainer}>
              <Ionicons name="infinite" size={60} color={Colors.slate} />
            </View>
            <Text style={s.emptyGreeting}>Operations Command Center</Text>
            <Text style={s.emptySub}>
              I have direct access to your live shipment data. How can I assist your logistics flow today?
            </Text>
            
            <View style={s.gridContainer}>
              {SUGGESTIONS.map(({ icon, label, color }) => (
                <TouchableOpacity
                  key={label}
                  style={s.gridItem}
                  onPress={() => send(label)}
                  activeOpacity={0.7}
                >
                  <View style={[s.gridIconCircle, { backgroundColor: color + '15' }]}>
                    <Ionicons name={icon as any} size={22} color={color} />
                  </View>
                  <Text style={s.gridLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Bottom Panel */}
        <View style={s.bottomPanel}>
          {messages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.chipsScroll}
              contentContainerStyle={s.chipsContent}
              keyboardShouldPersistTaps="handled"
            >
              {SUGGESTIONS.map(({ icon, label }) => (
                <TouchableOpacity
                  key={label}
                  style={[s.chip, loading && s.chipDisabled]}
                  onPress={() => send(label)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Ionicons name={icon as any} size={14} color={Colors.slate} />
                  <Text style={s.chipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={s.inputContainer}>
            <TextInput
              style={s.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Query live data manifest..."
              placeholderTextColor="rgba(71, 85, 105, 0.5)"
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              editable={!loading}
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
              onPress={() => send(input)}
              disabled={!input.trim() || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="arrow-up" size={24} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#f8fafc' },
  flex:              { flex: 1 },

  // Header
  header:            { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: Colors.slateDark,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar:      { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerName:        { fontSize: 17, fontWeight: '700', color: '#FFF' },
  headerStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  headerSub:         { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  headerRight:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn:         { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  signOutBtn:        { width: 'auto', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  signOutText:       { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Empty state
  emptyWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIconContainer: { marginBottom: 20, opacity: 0.8 },
  emptyGreeting:     { fontSize: 24, fontWeight: '800', color: Colors.slateDark, marginBottom: 8, textAlign: 'center' },
  emptySub:          { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 20 },
  
  gridContainer:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  gridItem:          { width: '45%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  gridIconCircle:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridLabel:         { fontSize: 13, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },

  // Messages
  list:              { padding: 16, paddingBottom: 24 },
  aiRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 20 },
  userRow:           { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
  aiBubbleWrap:      { flex: 1, maxWidth: '85%' },
  userBubbleWrap:    { maxWidth: '85%', alignItems: 'flex-end' },

  avatar:            { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: Colors.slate, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexShrink: 0,
    marginTop: 2,
    shadowColor: Colors.slate,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  bubble:            { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble:        { backgroundColor: Colors.slateDark, borderBottomRightRadius: 4 },
  aiBubble:          { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#e2e8f0', borderTopLeftRadius: 4 },
  userBubbleText:    { fontSize: 15, color: '#FFFFFF', lineHeight: 22, fontWeight: '500' },
  aiBubbleText:      { fontSize: 15, color: Colors.slateDark, lineHeight: 23 },

  dotsRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkingText:      { fontSize: 14, color: Colors.slate, fontWeight: '500', fontStyle: 'italic' },

  timeText:          { fontSize: 10, color: '#94a3b8', marginTop: 6, marginHorizontal: 4, fontWeight: '600' },

  toolsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  toolChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  toolChipText:      { fontSize: 10, color: Colors.slate, fontWeight: '700', textTransform: 'uppercase' },

  // Bottom Panel
  bottomPanel:       { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingBottom: Platform.OS === 'ios' ? 20 : 10 },
  chipsScroll:       { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chipsContent:      { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 8 },
  chipDisabled:      { opacity: 0.5 },
  chipText:          { fontSize: 13, color: Colors.slateDark, fontWeight: '600' },

  // Input
  inputContainer:    { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10 },
  textInput:         { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
    borderRadius: 24, 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 12, 
    fontSize: 15, 
    color: Colors.slateDark, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    maxHeight: 120,
  },
  sendBtn:           { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.slate, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sendBtnDisabled:   { backgroundColor: '#cbd5e1' },
});
