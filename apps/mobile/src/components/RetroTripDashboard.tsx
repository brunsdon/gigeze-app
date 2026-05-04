import { StyleSheet, Text, View } from "react-native";
import { formatSpeedKmh } from "../features/trips/trip-speed";
import { colors, radii, shadows } from "../theme";

type RetroTripDashboardProps = {
  speedKmh?: number;
  distanceText: string;
  durationText: string;
  statusText: string;
  driveStateText: string;
  gpsSignalText: string;
  active?: boolean;
};

export function RetroTripDashboard({
  speedKmh,
  distanceText,
  durationText,
  statusText,
  driveStateText,
  gpsSignalText,
  active = false,
}: RetroTripDashboardProps) {
  const speedText = formatSpeedKmh(speedKmh);

  return (
    <View style={[styles.panel, active ? styles.panelActive : styles.panelIdle]}>
      <View style={styles.topRow}>
        <Text style={styles.label}>CURRENT SPEED</Text>
        <View style={[styles.indicator, active ? styles.indicatorActive : styles.indicatorIdle]} />
      </View>
      <View style={styles.readoutRow}>
        <Text style={[styles.digits, active ? styles.digitsActive : styles.digitsIdle]}>{speedText}</Text>
        <Text style={[styles.unit, active ? styles.unitActive : styles.unitIdle]}>km/h</Text>
      </View>
      <View style={styles.metricGrid}>
        <DashboardMetric label="DIST" value={distanceText} active={active} />
        <DashboardMetric label="TIME" value={durationText} active={active} />
        <DashboardMetric label="STATUS" value={statusText} active={active} />
        <DashboardMetric label="MOTION" value={driveStateText} active={active} />
      </View>
      <Text style={[styles.gpsSignal, active ? styles.gpsSignalActive : styles.gpsSignalIdle]} numberOfLines={1} adjustsFontSizeToFit>
        {gpsSignalText}
      </Text>
    </View>
  );
}

function DashboardMetric({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, active ? styles.metricValueActive : styles.metricValueIdle]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadows.surface,
  },
  panelActive: {
    borderColor: colors.accent,
  },
  panelIdle: {
    opacity: 0.9,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  indicator: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  indicatorActive: {
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  indicatorIdle: {
    backgroundColor: colors.textMuted,
  },
  readoutRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    marginTop: 3,
  },
  digits: {
    fontFamily: "monospace",
    fontSize: 56,
    fontWeight: "900",
    includeFontPadding: false,
    lineHeight: 64,
    minWidth: 112,
    textAlign: "right",
  },
  digitsActive: {
    color: colors.accent,
    textShadowColor: "rgba(255, 176, 0, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  digitsIdle: {
    color: colors.primary,
    textShadowColor: "rgba(255, 46, 99, 0.25)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  unit: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 31,
  },
  unitActive: {
    color: colors.text,
  },
  unitIdle: {
    color: colors.textMuted,
  },
  metricGrid: {
    borderColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
  },
  metricValue: {
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "900",
    includeFontPadding: false,
    marginTop: 3,
  },
  metricValueActive: {
    color: colors.accent,
  },
  metricValueIdle: {
    color: colors.textMuted,
  },
  gpsSignal: {
    borderColor: colors.border,
    borderTopWidth: 1,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 9,
    paddingTop: 8,
  },
  gpsSignalActive: {
    color: colors.success,
  },
  gpsSignalIdle: {
    color: colors.textMuted,
  },
});
