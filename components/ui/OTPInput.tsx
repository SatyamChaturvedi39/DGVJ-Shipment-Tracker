import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { Colors } from '@/constants/colors';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

export function OTPInput({ length = 6, value, onChange }: OTPInputProps) {
  const inputRef = useRef<TextInput>(null);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <View>
      <Pressable onPress={handlePress} style={styles.container}>
        {Array.from({ length }, (_, i) => {
          const char = value[i] || '';
          const isFocused = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                isFocused && styles.boxFocused,
                char && styles.boxFilled,
              ]}
            >
              <Text style={styles.digit}>{char}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, '').slice(0, length);
          onChange(digits);
        }}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        autoFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFocused: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
  },
  boxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  digit: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});
