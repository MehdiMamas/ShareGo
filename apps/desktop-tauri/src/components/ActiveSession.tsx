import { useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_MS, strings } from "../lib/core";
import { colors } from "../styles/theme";
import { StatusIndicator } from "./StatusIndicator";
import type { useSession } from "../hooks/useSession";
import type { ReceivedItem, SentItem } from "../hooks/useSession";

type ListItem =
  | { type: "sent"; data: SentItem }
  | { type: "received"; data: ReceivedItem };

interface ActiveSessionProps {
  session: ReturnType<typeof useSession>;
  onEnd: () => void;
}

export function ActiveSession({ session, onEnd }: ActiveSessionProps) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

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
      copyTimerRef.current = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
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
          {strings.BTN_END_SESSION}
        </button>
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
            return (
              <div
                key={`sent-${sent.seq}`}
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
                <div>{sent.text}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: colors.sentStatusText,
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {sent.acked ? strings.STATUS_DELIVERED : strings.STATUS_SENDING}
                </div>
              </div>
            );
          }

          const received = item.data as ReceivedItem;
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
              <div>{received.text}</div>
              <button
                onClick={() => handleCopy(received.text, received.id)}
                style={{
                  marginTop: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background:
                    copied === received.id ? colors.success : colors.border,
                  color: colors.textPrimary,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {copied === received.id ? strings.BTN_COPIED : strings.BTN_COPY}
              </button>
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
              {strings.EMPTY_MESSAGES}
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
          placeholder={strings.INPUT_PLACEHOLDER}
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
          {strings.BTN_SEND_DATA}
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
