import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryActionButton } from "./PrimaryActionButton";
import { createExternalMediaLink, deleteExternalMediaLink, fetchExternalMediaLinks, type MobileExternalMediaLink } from "../features/external-media/client";
import {
  detectMobileExternalMediaPlatform,
  getClipboardExternalMediaCandidate,
  getDeepLinkTarget,
  getPlatformDetectedLabel,
  getPlatformDisplayName,
  type MobileExternalMediaTarget,
} from "../features/external-media/helpers";

type ExternalMediaSectionProps = {
  accessToken?: string;
  target: MobileExternalMediaTarget | null;
};

type SheetMode = "actions" | "paste" | null;

export function ExternalMediaSection({ accessToken, target }: ExternalMediaSectionProps) {
  const insets = useSafeAreaInsets();
  const [links, setLinks] = useState<MobileExternalMediaLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [clipboardCandidate, setClipboardCandidate] = useState<string | null>(null);
  const lastClipboardPromptRef = useRef<string | null>(null);

  const detectedPlatform = useMemo(() => {
    if (!url.trim()) {
      return null;
    }

    return detectMobileExternalMediaPlatform(url);
  }, [url]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setFeedback(null);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    let cancelled = false;

    async function loadLinks() {
      if (!accessToken || !target) {
        setLinks([]);
        return;
      }

      setLoading(true);
      try {
        const nextLinks = await fetchExternalMediaLinks(accessToken, target.entityType, target.entityId);
        if (!cancelled) {
          setLinks(nextLinks);
          setError(null);
        }
      } catch (unknownError) {
        if (!cancelled) {
          setError(unknownError instanceof Error ? unknownError.message : "Unable to load external media.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLinks();

    return () => {
      cancelled = true;
    };
  }, [accessToken, target]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && sheetMode) {
        void maybeApplyClipboardCandidate();
      }
    });

    return () => subscription.remove();
  }, [sheetMode]);

  function applyClipboardCandidate(candidate: string) {
    setClipboardCandidate(candidate);
    setUrl(candidate);
    setSheetMode("paste");
    setFeedback("Link pasted from clipboard");
    setError(null);
  }

  async function maybeApplyClipboardCandidate() {
    const clipboardText = await Clipboard.getStringAsync();
    const candidate = getClipboardExternalMediaCandidate(clipboardText);

    if (!candidate || candidate === lastClipboardPromptRef.current) {
      return;
    }

    lastClipboardPromptRef.current = candidate;
    applyClipboardCandidate(candidate);
  }

  function openAddMediaSheet() {
    setSheetMode("actions");
    void maybeApplyClipboardCandidate();
  }

  async function openPlatform(platform: "flickr" | "instagram" | "youtube") {
    const deepLinkTarget = getDeepLinkTarget(platform, Platform.OS);
    try {
      if (Platform.OS === "android" && deepLinkTarget.androidIntent) {
        await IntentLauncher.startActivityAsync(deepLinkTarget.androidIntent.action, {
          category: deepLinkTarget.androidIntent.category,
          data: deepLinkTarget.androidIntent.data,
          packageName: deepLinkTarget.androidIntent.packageName,
        });
        return;
      }

      const canOpen = await Linking.canOpenURL(deepLinkTarget.appUrl);
      await Linking.openURL(canOpen ? deepLinkTarget.appUrl : deepLinkTarget.fallbackUrl);
    } catch {
      await Linking.openURL(deepLinkTarget.fallbackUrl);
    }
  }

  function openPasteComposer(prefilledUrl?: string) {
    if (prefilledUrl) {
      setUrl(prefilledUrl);
    }
    setSheetMode("paste");
  }

  function resetComposer() {
    setSheetMode(null);
    setUrl("");
    setTitle("");
    setCaption("");
    setClipboardCandidate(null);
  }

  async function handleAttach() {
    if (!accessToken || !target || !url.trim()) {
      return;
    }

    setSaving(true);
    try {
      const created = await createExternalMediaLink(accessToken, {
        entityType: target.entityType,
        entityId: target.entityId,
        url: url.trim(),
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
      });

      setLinks((currentValue) => [created, ...currentValue]);
      setError(null);
      setFeedback("Media attached");
      resetComposer();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Unable to attach external media.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(linkId: string) {
    if (!accessToken) {
      return;
    }

    setDeletingId(linkId);
    try {
      await deleteExternalMediaLink(accessToken, linkId);
      setLinks((currentValue) => currentValue.filter((link) => link.id !== linkId));
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Unable to remove external media.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.cardTitle}>Tour photos</Text>
          <Text style={styles.cardCaption}>
            Add Flickr photos to {target ? target.label : "this Tour"}, with social links available when you need them.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add Flickr photos"
          disabled={!target}
          onPress={openAddMediaSheet}
          style={({ pressed }) => [
            styles.addMediaButton,
            !target && styles.addMediaButtonDisabled,
            pressed && target ? styles.addMediaButtonPressed : null,
          ]}
        >
          <Text style={styles.addMediaButtonText}>Add Flickr</Text>
        </Pressable>
      </View>

      {!target ? (
        <Text style={styles.note}>
          Save this trip to GigEze before attaching external media.
        </Text>
      ) : (
        <Text style={styles.tipMessage}>
          Tip: copy a Flickr photo, album, or photostream link, then come back here. GigEze will offer to paste it for you.
        </Text>
      )}

      {feedback ? <Text style={styles.successMessage}>{feedback}</Text> : null}
      {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
      {loading ? <Text style={styles.note}>Loading media links…</Text> : null}

      <View style={styles.linkList}>
        {links.map((link) => (
          <View key={link.id} style={styles.linkCard}>
            {(() => {
              const platform = detectMobileExternalMediaPlatform(link.url);
              const openLabel =
                platform === "flickr"
                  ? "Open in Flickr"
                  : platform === "instagram"
                  ? "Open in Instagram"
                  : platform === "youtube"
                    ? "Open in YouTube"
                    : platform === "tiktok"
                      ? "Open in TikTok"
                    : "Open";

              return (
                <>
            <View style={styles.linkCardTopRow}>
              <View style={styles.linkMeta}>
                <Text style={styles.platformBadge}>{getPlatformDisplayName(platform)}</Text>
                <Text style={styles.linkTitle}>{link.title || getPlatformDisplayName(platform)}</Text>
              </View>
            </View>

            {link.thumbnailUrl ? (
              <Image source={{ uri: link.thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={styles.previewFallback}>
                <Text style={styles.previewFallbackBadge}>{getPlatformDisplayName(platform)}</Text>
                <Text style={styles.previewFallbackTitle}>Preview unavailable</Text>
                <Text style={styles.previewFallbackBody}>
                  {platform === "instagram"
                    ? "Instagram does not always provide a safe preview image here. Open the original post to view it."
                    : platform === "flickr"
                      ? "Open the Flickr link to view the original photo, album, or photostream."
                    : "This link was attached successfully, but a preview image is not available for it here."}
                </Text>
              </View>
            )}

            {link.caption ? <Text style={styles.linkCaption}>{link.caption}</Text> : null}
            <Text style={styles.linkUrl} numberOfLines={2}>{link.url}</Text>

            <View style={styles.linkActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void Linking.openURL(link.url);
                }}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryActionPressed]}
              >
                <Text style={styles.secondaryActionText}>{openLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  Alert.alert("Remove link?", "This only removes the link from GigEze.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => {
                        void handleRemove(link.id);
                      },
                    },
                  ]);
                }}
                style={({ pressed }) => [styles.removeAction, pressed && styles.secondaryActionPressed]}
              >
                <Text style={styles.removeActionText}>{deletingId === link.id ? "Removing…" : "Remove"}</Text>
              </Pressable>
            </View>
                </>
              );
            })()}
          </View>
        ))}
      </View>

      {!loading && links.length === 0 ? (
        <Text style={styles.note}>No Flickr photos attached yet.</Text>
      ) : null}

      <Modal transparent animationType="slide" visible={sheetMode !== null} onRequestClose={resetComposer}>
        <Pressable style={styles.modalBackdrop} onPress={resetComposer}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 24, 40) }]} onPress={() => undefined}>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              {sheetMode === "actions" ? (
                <>
                  <Text style={styles.sheetTitle}>Add Flickr photos</Text>
                  <Text style={styles.sheetBody}>Open Flickr, copy a photo, album, or photostream link, then return here. If the link is already on your clipboard, it will be ready to attach.</Text>
                  <Pressable style={[styles.sheetAction, styles.primarySheetAction]} onPress={() => { void openPlatform("flickr"); }}>
                    <Text style={styles.primarySheetActionTitle}>Open Flickr</Text>
                    <Text style={styles.primarySheetActionDetail}>Copy a Flickr photo, album, or photostream link, then return here.</Text>
                  </Pressable>
                  <Pressable style={styles.sheetAction} onPress={() => openPasteComposer(clipboardCandidate ?? undefined)}>
                    <Text style={styles.sheetActionTitle}>Paste Flickr link</Text>
                    <Text style={styles.sheetActionDetail}>Use this when you already copied a Flickr link.</Text>
                  </Pressable>
                  <Text style={styles.sheetSectionLabel}>Other media</Text>
                  <Pressable style={styles.sheetAction} onPress={() => { void openPlatform("instagram"); }}>
                    <Text style={styles.sheetActionTitle}>Open Instagram</Text>
                    <Text style={styles.sheetActionDetail}>Copy the post or reel link in Instagram, then return here.</Text>
                  </Pressable>
                  <Pressable style={styles.sheetAction} onPress={() => { void openPlatform("youtube"); }}>
                    <Text style={styles.sheetActionTitle}>Open YouTube</Text>
                    <Text style={styles.sheetActionDetail}>Copy the video or Shorts link in YouTube, then return here.</Text>
                  </Pressable>
                  <Pressable style={styles.sheetAction} onPress={() => openPasteComposer(clipboardCandidate ?? undefined)}>
                    <Text style={styles.sheetActionTitle}>Paste another link</Text>
                    <Text style={styles.sheetActionDetail}>Use this after copying an Instagram, YouTube, TikTok, or website link.</Text>
                  </Pressable>
                  <Pressable style={styles.sheetCancel} onPress={resetComposer}>
                    <Text style={styles.sheetCancelText}>Cancel</Text>
                  </Pressable>
                </>
              ) : null}

              {sheetMode === "paste" ? (
                <>
                  <Text style={styles.sheetTitle}>Attach link</Text>
                  <Text style={styles.sheetBody}>Paste a Flickr link or another supported media link, then optionally add a title or caption.</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setUrl}
                    placeholder="https://www.flickr.com/photos/..."
                    style={styles.input}
                    value={url}
                  />
                  {detectedPlatform ? (
                    <Text style={styles.detectedLabel}>{getPlatformDetectedLabel(detectedPlatform)}</Text>
                  ) : null}
                  <TextInput
                    onChangeText={setTitle}
                    placeholder="Optional title"
                    style={styles.input}
                    value={title}
                  />
                  <TextInput
                    multiline
                    onChangeText={setCaption}
                    placeholder="Optional caption"
                    style={[styles.input, styles.captionInput]}
                    value={caption}
                  />
                  <PrimaryActionButton
                    label={saving ? "Attaching…" : "Attach"}
                    onPress={handleAttach}
                    disabled={saving || !url.trim()}
                  />
                  <Pressable style={styles.sheetCancel} onPress={resetComposer}>
                    <Text style={styles.sheetCancelText}>Cancel</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dce2de",
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: "#17201c",
    fontSize: 18,
    fontWeight: "900",
  },
  cardCaption: {
    color: "#52675f",
    fontSize: 14,
    lineHeight: 20,
  },
  addMediaButton: {
    backgroundColor: "#1d5c49",
    borderRadius: 999,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addMediaButtonDisabled: {
    backgroundColor: "#9fb4aa",
  },
  addMediaButtonPressed: {
    opacity: 0.84,
  },
  addMediaButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  note: {
    color: "#52675f",
    fontSize: 14,
    lineHeight: 20,
  },
  tipMessage: {
    color: "#52675f",
    fontSize: 13,
    lineHeight: 19,
  },
  successMessage: {
    color: "#1d5c49",
    fontSize: 14,
    fontWeight: "800",
  },
  errorMessage: {
    color: "#9f3a2f",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  linkList: {
    gap: 12,
  },
  linkCard: {
    backgroundColor: "#f7f8f4",
    borderColor: "#dce2de",
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  linkCardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  linkMeta: {
    flex: 1,
    gap: 6,
  },
  platformBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e1eee6",
    borderRadius: 999,
    color: "#1d5c49",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkTitle: {
    color: "#17201c",
    fontSize: 16,
    fontWeight: "800",
  },
  thumbnail: {
    borderRadius: 10,
    height: 180,
    width: "100%",
  },
  previewFallback: {
    backgroundColor: "#eef5f0",
    borderColor: "#d6ded9",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    minHeight: 140,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  previewFallbackBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    color: "#1d5c49",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewFallbackTitle: {
    color: "#17201c",
    fontSize: 15,
    fontWeight: "800",
  },
  previewFallbackBody: {
    color: "#52675f",
    fontSize: 13,
    lineHeight: 19,
  },
  linkCaption: {
    color: "#32453d",
    fontSize: 14,
    lineHeight: 20,
  },
  linkUrl: {
    color: "#596960",
    fontSize: 13,
    lineHeight: 18,
  },
  linkActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryAction: {
    backgroundColor: "#ffffff",
    borderColor: "#b7c7c0",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  removeAction: {
    backgroundColor: "#fff3f1",
    borderColor: "#e5bbb5",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryActionPressed: {
    opacity: 0.8,
  },
  secondaryActionText: {
    color: "#1d5c49",
    fontSize: 14,
    fontWeight: "800",
  },
  removeActionText: {
    color: "#9f3a2f",
    fontSize: 14,
    fontWeight: "800",
  },
  modalBackdrop: {
    backgroundColor: "rgba(23, 32, 28, 0.4)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sheetContent: {
    gap: 12,
  },
  sheetTitle: {
    color: "#17201c",
    fontSize: 22,
    fontWeight: "900",
  },
  sheetBody: {
    color: "#52675f",
    fontSize: 14,
    lineHeight: 20,
  },
  sheetAction: {
    borderColor: "#dce2de",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primarySheetAction: {
    backgroundColor: "#e8f2ff",
    borderColor: "#b8d7ff",
  },
  primarySheetActionTitle: {
    color: "#0f3d68",
    fontSize: 16,
    fontWeight: "900",
  },
  primarySheetActionDetail: {
    color: "#375875",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  sheetSectionLabel: {
    color: "#596960",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4,
    textTransform: "uppercase",
  },
  sheetActionTitle: {
    color: "#17201c",
    fontSize: 16,
    fontWeight: "800",
  },
  sheetActionDetail: {
    color: "#52675f",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  sheetCancel: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  sheetCancelText: {
    color: "#596960",
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    borderColor: "#cdd8d1",
    borderRadius: 10,
    borderWidth: 1,
    color: "#17201c",
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  captionInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  detectedLabel: {
    color: "#1d5c49",
    fontSize: 13,
    fontWeight: "800",
  },
});
