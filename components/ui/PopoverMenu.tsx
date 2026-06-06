import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MENU_WIDTH = 158;
const ITEM_HEIGHT = 42;

export interface PopoverOption {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  options: PopoverOption[];
  anchor: { x: number; y: number };
  theme: any;
}

export const PopoverMenu = ({ visible, onClose, options, anchor, theme }: Props) => {
  const menuHeight = options.length * ITEM_HEIGHT + 10;

  const left = Math.max(8, Math.min(anchor.x - MENU_WIDTH, SCREEN_W - MENU_WIDTH - 8));
  const showBelow = anchor.y + menuHeight < SCREEN_H - 80;
  const top = showBelow ? anchor.y + 6 : anchor.y - menuHeight - 6;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback>
            <View style={[styles.menu, { backgroundColor: theme.card, top, left }]}>
              {options.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.item,
                    idx < options.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border + '60' },
                  ]}
                  onPress={() => { opt.onPress(); onClose(); }}
                >
                  {opt.icon && (
                    <Ionicons
                      name={opt.icon as any}
                      size={15}
                      color={opt.destructive ? '#FF3B30' : theme.textSecondary}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text style={{ color: opt.destructive ? '#FF3B30' : theme.text, fontSize: 13, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: ITEM_HEIGHT,
  },
});
