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
}

const SUGGESTIONS = [
  'How many shipments are active?',
  'Show delayed shipments',
  "Today's operations summary",
  'Employee performance stats',
  'Which phase has the most shipments?',
  'Any shipments delivered today?',
];

const TOOL_LABELS: Record<string, string> = {
  get_active_shipments:     'Active Shipments',
  get_delayed_shipments:    'Delayed Shipments',
  get_shipment_detail:      'Shipment Detail',
  get_employee_performance: 'Employee Stats',
  get_operations_summary:   'Ops Summary',
};

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

    const userMsg: Message    = { id: Date.now().toString(), role: 'user', content: q };
    const thinkingMsg: Message = { id: 'thinking', role: 'assistant', content: '' };
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
      };
      setMessages(prev => [...prev.filter(m => m.id !== 'thinking'), aiMsg]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `AI error: ${detail}`,
      };
      setMessages(prev => [...prev.filter(m => m.id !== 'thinking'), errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser     = item.role === 'user';
    const isThinking = item.id === 'thinking';

    if (isThinking) {
      return (
        <View style={[s.bubble, s.aiBubble]}>
          <ActivityIndicator size="small" color={Colors.textSecondary} />
          <Text style={s.thinkingText}>  Thinking…</Text>
        </View>
      );
    }

    return (
      <View style={[s.bubbleWrap, isUser && s.bubbleWrapUser]}>
        <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
          <Text style={[s.bubbleText, isUser && s.userBubbleText]}>{item.content}</Text>
        </View>
        {!isUser && item.tools_used && item.tools_used.length > 0 && (
          <View style={s.toolsRow}>
            {item.tools_used.map(t => (
              <View key={t} style={s.toolChip}>
                <Text style={s.toolChipText}>🔧 {TOOL_LABELS[t] ?? t}</Text>
              </View>
            ))}
          </View>
        )}
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
        {/* Chat area */}
        {messages.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>✨</Text>
            <Text style={s.emptyTitle}>AI Operations Copilot</Text>
            <Text style={s.emptySub}>Ask questions about live shipment data — powered by Llama 3.3</Text>
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

        {/* Suggestion chips — always visible */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipsScroll}
          contentContainerStyle={s.chipsContent}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map(suggestion => (
            <TouchableOpacity
              key={suggestion}
              style={[s.chip, loading && s.chipDisabled]}
              onPress={() => send(suggestion)}
              disabled={loading}
            >
              <Text style={s.chipText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your shipments…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            editable={!loading}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.background },
  flex:            { flex: 1 },
  list:            { padding: 16, paddingBottom: 8 },

  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySub:        { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  chipsScroll:     { flexShrink: 0, borderTopWidth: 1, borderTopColor: Colors.border },
  chipsContent:    { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip:            { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8 },
  chipDisabled:    { opacity: 0.4 },
  chipText:        { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

  bubbleWrap:      { marginBottom: 12 },
  bubbleWrapUser:  { alignItems: 'flex-end' },
  bubble:          { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  userBubble:      { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble:        { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText:      { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  userBubbleText:  { color: '#FFFFFF' },
  thinkingText:    { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },

  toolsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginLeft: 4 },
  toolChip:        { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#C5D0F0' },
  toolChipText:    { fontSize: 11, color: '#3B4FCC', fontWeight: '600' },

  inputRow:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, gap: 8 },
  textInput:       { flex: 1, backgroundColor: Colors.surface, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  sendBtn:         { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText:     { color: '#FFF', fontSize: 22, fontWeight: '700' },
});
