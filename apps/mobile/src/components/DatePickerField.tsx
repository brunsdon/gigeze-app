import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDateOnlyLabel } from "../lib/date-display";
import { formatDatePickerValue, getCalendarMonthGrid, parseDatePickerValue } from "./DatePickerField.helpers";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
};

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  optional = false,
}: DatePickerFieldProps) {
  const [visible, setVisible] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseDatePickerValue(value) ?? new Date());
  const selectedValue = parseDatePickerValue(value) ? value : "";
  const monthDays = useMemo(() => getCalendarMonthGrid(viewMonth), [viewMonth]);
  const monthTitle = viewMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  function openPicker() {
    setViewMonth(parseDatePickerValue(value) ?? new Date());
    setVisible(true);
  }

  function moveMonth(direction: -1 | 1) {
    setViewMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1));
  }

  function selectDate(nextValue: string) {
    onChange(nextValue);
    setVisible(false);
  }

  function selectToday() {
    selectDate(formatDatePickerValue(new Date()));
  }

  function clearDate() {
    onChange("");
    setVisible(false);
  }

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selectedValue ? formatDateOnlyLabel(selectedValue) : placeholder}`}
        onPress={openPicker}
        style={({ pressed }) => [styles.inputButton, pressed && styles.pressed]}
      >
        <Text style={[styles.inputText, !selectedValue && styles.placeholderText]}>
          {selectedValue ? formatDateOnlyLabel(selectedValue) : placeholder}
        </Text>
        <Text style={styles.calendarIcon}>Calendar</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={visible} onRequestClose={() => setVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable accessibilityRole="button" onPress={() => moveMonth(-1)} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>Prev</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <Pressable accessibilityRole="button" onPress={() => moveMonth(1)} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>Next</Text>
              </Pressable>
            </View>

            <View style={styles.weekdayGrid}>
              {weekdays.map((weekday) => (
                <Text key={weekday} style={styles.weekdayLabel}>{weekday}</Text>
              ))}
            </View>

            <View style={styles.dayGrid}>
              {monthDays.map((day) => {
                const selected = day.dateValue === selectedValue;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={day.dateValue}
                    onPress={() => selectDate(day.dateValue)}
                    style={({ pressed }) => [
                      styles.dayButton,
                      !day.inCurrentMonth && styles.outsideMonthDay,
                      selected && styles.selectedDay,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      !day.inCurrentMonth && styles.outsideMonthDayText,
                      selected && styles.selectedDayText,
                    ]}>
                      {day.dayLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actionRow}>
              <Pressable accessibilityRole="button" onPress={selectToday} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Today</Text>
              </Pressable>
              {optional ? (
                <Pressable accessibilityRole="button" onPress={clearDate} style={styles.secondaryAction}>
                  <Text style={styles.secondaryActionText}>Clear</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: "#B8AFC0",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  inputButton: {
    alignItems: "center",
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputText: {
    color: "#FFF7EA",
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  placeholderText: {
    color: "#B8AFC0",
  },
  calendarIcon: {
    color: "#B8AFC0",
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 10,
    textTransform: "uppercase",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(8, 7, 10, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#1E1724",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 430,
    padding: 16,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthTitle: {
    color: "#FFF7EA",
    flex: 1,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  monthButton: {
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  monthButtonText: {
    color: "#FFB000",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  weekdayGrid: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayLabel: {
    color: "#B8AFC0",
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayButton: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    width: `${100 / 7}%`,
  },
  outsideMonthDay: {
    opacity: 0.38,
  },
  selectedDay: {
    backgroundColor: "#FF2E63",
  },
  dayText: {
    color: "#FFF7EA",
    fontSize: 15,
    fontWeight: "800",
  },
  outsideMonthDayText: {
    color: "#B8AFC0",
  },
  selectedDayText: {
    color: "#FFF7EA",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 16,
  },
  secondaryAction: {
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: "#FFB000",
    fontSize: 14,
    fontWeight: "900",
  },
  primaryAction: {
    backgroundColor: "#FF2E63",
    borderColor: "#FF2E63",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryActionText: {
    color: "#FFF7EA",
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
  },
});
