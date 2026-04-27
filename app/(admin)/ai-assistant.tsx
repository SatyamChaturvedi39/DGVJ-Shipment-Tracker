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
} from 'react-native';
import { Colors } from '@/constants/colors';
import { askAI } from '@/services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  time: string;
}

const SUGGESTIONS = [
  { icon: '📦', label: 'Active shipments' },
  { icon: '⚠️', label: 'Delayed shipments' },
  { icon: '📊', label: "Today's summary" },
  { icon: '👷', label: 'Team performance' },
  { icon: '✅', label: 'Delivered today' },
  { icon: '🔍', label: 'Most busy phase' },
];

const TOOL_LABELS: Record<string, string> = {
  get_active_shipments:     'Checked active shipments',
  get_delayed_shipments:    'Checked delayed shipments',
  get_shipment_detail:      'Looked up shipment',
  get_employee_performance: 'Checked team stats',
  get_operations_summary:   'Checked operations',
};

function getTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AIAssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const listRef = useRef<FlatList>(null);

  const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message    = { id: Date.now().toString(), role: 'user', content: q, time: getTime() };
    const thinkingMsg: Message = { id: 'thinking', role: 'assistant', content: '', time: '' };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

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
        content: `Sorry, something went wrong. Please try again in a moment.\n\n(${detail})`,
        time: getTime(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const clearChat = () => setMessages([]);

  const renderItem = ({ item }: { item: Message }) => {
    const isUser     = item.role === 'user';
    const isThinking = item.id === 'thinking';

    if (isThinking) {
      return (
        <View style={s.aiRow}>
          <View style={s.avatar}><Text style={s.avatarText}>D</Text></View>
          <View style={[s.bubble, s.aiBubble]}>
            <View style={s.dotsRow}>
              <ActivityIndicator size="small" color={Colors.textSecondary} />
              <Text style={s.thinkingText}>  Looking that up…</Text>
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
        <View style={s.avatar}><Text style={s.avatarText}>D</Text></View>
        <View style={s.aiBubbleWrap}>
          <View style={[s.bubble, s.aiBubble]}>
            <Text style={s.aiBubbleText}>{item.content}</Text>
          </View>
          {item.tools_used && item.tools_used.length > 0 && (
            <View style={s.toolsRow}>
              {item.tools_used.map(t => (
                <View key={t} style={s.toolChip}>
                  <Text style={s.toolChipText}>🔍 {TOOL_LABELS[t] ?? t}</Text>
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
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerAvatar}><Text style={s.headerAvatarText}>D</Text></View>
            <View>
              <Text style={s.headerName}>Digi</Text>
              <Text style={s.headerSub}>Operations Assistant · Powered by Llama 3.3</Text>
            </View>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={s.clearBtn}>
              <Text style={s.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Chat area */}
        {messages.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyAvatar}><Text style={s.emptyAvatarText}>D</Text></View>
            <Text style={s.emptyGreeting}>Hi, I'm Digi 👋</Text>
            <Text style={s.emptySub}>
              Ask me anything about your shipments — delays, deliveries, team performance, or a quick daily summary.
            </Text>
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

        {/* Suggestion chips */}
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
              <Text style={s.chipIcon}>{icon}</Text>
              <Text style={s.chipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Digi anything…"
            placeholderTextColor={Colors.textMuted}
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
              : <Text style={s.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: Colors.background },
  flex:              { flex: 1 },

  // Header
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background },
  headerLeft:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText:  { color: '#FFF', fontWeight: '800', fontSize: 16 },
  headerName:        { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  headerSub:         { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  clearBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  clearBtnText:      { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  // Empty state
  emptyWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  emptyAvatar:       { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyAvatarText:   { color: '#FFF', fontWeight: '800', fontSize: 28 },
  emptyGreeting:     { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  emptySub:          { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Messages
  list:              { padding: 16, gap: 16 },

  aiRow:             { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userRow:           { flexDirection: 'row', justifyContent: 'flex-end' },
  aiBubbleWrap:      { flex: 1, maxWidth: '85%' },
  userBubbleWrap:    { maxWidth: '80%', alignItems: 'flex-end' },

  avatar:            { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText:        { color: '#FFF', fontWeight: '800', fontSize: 13 },

  bubble:            { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble:        { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble:          { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  userBubbleText:    { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  aiBubbleText:      { fontSize: 15, color: Colors.textPrimary, lineHeight: 23 },

  dotsRow:           { flexDirection: 'row', alignItems: 'center' },
  thinkingText:      { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },

  timeText:          { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginHorizontal: 4 },

  toolsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  toolChip:          { backgroundColor: '#F0F4FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#DDE4F8' },
  toolChipText:      { fontSize: 11, color: '#4A5FC0', fontWeight: '500' },

  // Chips
  chipsScroll:       { flexShrink: 0, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  chipsContent:      { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  chipDisabled:      { opacity: 0.4 },
  chipIcon:          { fontSize: 14 },
  chipText:          { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

  // Input
  inputRow:          { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput:         { flex: 1, backgroundColor: Colors.surface, borderRadius: 22, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, maxHeight: 120 },
  sendBtn:           { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sendBtnDisabled:   { backgroundColor: Colors.border },
  sendIcon:          { color: '#FFF', fontSize: 22, fontWeight: '700' },
});
