import { StyleSheet, Text, View } from "react-native";
import { formatSpeedKmh } from "../features/trips/trip-speed";

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

const amber = "#f2a12b";
const idleAmber = "#7c5a2d";

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#141816",
    borderColor: "#313931",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  panelActive: {
    borderColor: "#5c4728",
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
    color: "#9aa39c",
    fontSize: 12,
    fontWeight: "800",
  },
  indicator: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  indicatorActive: {
    backgroundColor: "#76c785",
    shadowColor: "#76c785",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  indicatorIdle: {
    backgroundColor: "#545d56",
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
    color: amber,
    textShadowColor: "rgba(242, 161, 43, 0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  digitsIdle: {
    color: idleAmber,
    textShadowColor: "rgba(124, 90, 45, 0.22)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  unit: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 31,
  },
  unitActive: {
    color: "#ffd28a",
  },
  unitIdle: {
    color: "#927147",
  },
  metricGrid: {
    borderColor: "#293028",
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
    color: "#7f8982",
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
    color: "#ffd28a",
  },
  metricValueIdle: {
    color: "#927147",
  },
  gpsSignal: {
    borderColor: "#293028",
    borderTopWidth: 1,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 9,
    paddingTop: 8,
  },
  gpsSignalActive: {
    color: "#9ec7a5",
  },
  gpsSignalIdle: {
    color: "#777f78",
  },
});
