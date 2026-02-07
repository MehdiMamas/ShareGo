import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { COPY_FEEDBACK_MS } from "../lib/core";
import { colors } from "../styles/theme";
import { StatusIndicator } from "./StatusIndicator";
import type { useSession } from "../hooks/useSession";
import type { ReceivedItem, SentItem } from "../hooks/useSession";

type ListItem =
  | { type: "sent"; data: SentItem }
  | { type: "received"; data: ReceivedItem };

const MASKED_TEXT = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

function EyeIcon({
  size = 16,
  color = colors.textSecondary,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({
  size = 16,
  color = colors.textSecondary,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

interface ActiveSessionProps {
  session: ReturnType<typeof useSession>;
  onEnd: () => void;
}

export function ActiveSession({ session, onEnd }: ActiveSessionProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [autoCopy, setAutoCopy] = useState(true);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevReceivedCountRef = useRef(session.receivedItems.length);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // auto-copy latest received item to clipboard
  useEffect(() => {
    if (autoCopy && session.receivedItems.length > prevReceivedCountRef.current) {
      const latest = session.receivedItems[session.receivedItems.length - 1];
      if (latest) {
        navigator.clipboard.writeText(latest.text).then(() => {
          setCopied(latest.id);
          if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
          copyTimerRef.current = setTimeout(
            () => setCopied(null),
            COPY_FEEDBACK_MS,
          );
        }).catch(() => {
          // clipboard api may not be available
        });
      }
    }
    prevReceivedCountRef.current = session.receivedItems.length;
  }, [session.receivedItems.length, autoCopy]);

  const handleSend = () => {
    if (!input.trim()) return;
    session.sendData(input.trim());
    setInput("");
  };

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(
        () => setCopied(null),
        COPY_FEEDBACK_MS,
      );
    } catch {
      // clipboard api may not be available
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVisibility = (key: string) => {
    setVisibleItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // merge and sort messages by timestamp, matching mobile behavior
  const items: ListItem[] = [
    ...session.sentItems.map(
      (s): ListItem => ({ type: "sent", data: s }),
    ),
    ...session.receivedItems.map(
      (r): ListItem => ({ type: "received", data: r }),
    ),
  ].sort((a, b) => a.data.timestamp - b.data.timestamp);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: colors.background,
        padding: 24,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: colors.textPrimary,
              marginBottom: 4,
            }}
          >
            session {session.sessionId}
          </h2>
          <StatusIndicator state={session.state} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                userSelect: "none",
              }}
            >
              {t("session.autoCopy")}
            </span>
            <button
              onClick={() => setAutoCopy(!autoCopy)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: autoCopy ? colors.success : colors.border,
                position: "relative",
                cursor: "pointer",
                border: "none",
                padding: 0,
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: colors.white,
                  position: "absolute",
                  top: 2,
                  left: autoCopy ? 18 : 2,
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>
          <button
            onClick={onEnd}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: colors.error,
              color: colors.white,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("session.endSession")}
          </button>
        </div>
      </div>

      {/* messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingBottom: 16,
        }}
      >
        {items.map((item, index) => {
          if (item.type === "sent") {
            const sent = item.data as SentItem;
            const key = `sent-${sent.seq}`;
            const isVisible = visibleItems.has(key);
            return (
              <div
                key={key}
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: colors.primary,
                  color: colors.textPrimary,
                  fontSize: 14,
                  wordBreak: "break-all",
                }}
              >
                <div>{isVisible ? sent.text : MASKED_TEXT}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: 6,
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => toggleVisibility(key)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {isVisible ? (
                      <EyeOffIcon size={16} color={colors.sentStatusText} />
                    ) : (
                      <EyeIcon size={16} color={colors.sentStatusText} />
                    )}
                  </button>
                  <div
                    style={{
                      fontSize: 11,
                      color: colors.sentStatusText,
                      marginLeft: "auto",
                      textAlign: "right",
                    }}
                  >
                    {sent.acked
                      ? t("session.delivered")
                      : t("session.sending")}
                  </div>
                </div>
              </div>
            );
          }

          const received = item.data as ReceivedItem;
          const key = `recv-${received.id}`;
          const isVisible = visibleItems.has(key);
          return (
            <div
              key={`recv-${received.id}-${index}`}
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: 10,
                background: colors.surface,
                color: colors.textPrimary,
                fontSize: 14,
                border: `1px solid ${colors.border}`,
                wordBreak: "break-all",
              }}
            >
              <div>{isVisible ? received.text : MASKED_TEXT}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: 6,
                  gap: 8,
                }}
              >
                <button
                  onClick={() => toggleVisibility(key)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {isVisible ? (
                    <EyeOffIcon size={16} color={colors.textSecondary} />
                  ) : (
                    <EyeIcon size={16} color={colors.textSecondary} />
                  )}
                </button>
                <button
                  onClick={() => handleCopy(received.text, received.id)}
                  style={{
                    marginLeft: "auto",
                    padding: "4px 10px",
                    borderRadius: 6,
                    background:
                      copied === received.id ? colors.success : colors.border,
                    color: colors.textPrimary,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {copied === received.id
                    ? t("session.copied")
                    : t("session.copy")}
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: colors.textSecondary, fontSize: 14 }}>
              {t("session.emptyMessages")}
            </p>
          </div>
        )}
      </div>

      {/* input area */}
      <div
        style={{
          display: "flex",
          gap: 10,
          paddingTop: 16,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("session.inputPlaceholder")}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 10,
            background: colors.surface,
            color: colors.textPrimary,
            fontSize: 14,
            border: `1px solid ${colors.border}`,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            background: input.trim() ? colors.primary : colors.border,
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t("session.sendButton")}
        </button>
      </div>

      {session.error && (
        <p
          style={{
            color: colors.error,
            fontSize: 13,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {session.error}
        </p>
      )}
    </div>
  );
}
