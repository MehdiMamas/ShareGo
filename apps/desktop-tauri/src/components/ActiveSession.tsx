import { useState } from "react";
import { colors } from "../styles/theme";
import { StatusIndicator } from "./StatusIndicator";
import type { useSession } from "../hooks/useSession";

interface ActiveSessionProps {
  session: ReturnType<typeof useSession>;
  onEnd: () => void;
}

export function ActiveSession({ session, onEnd }: ActiveSessionProps) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    session.sendData(input.trim());
    setInput("");
  };

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
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
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          end session
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
        {session.sentItems.map((item) => (
          <div
            key={`sent-${item.seq}`}
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
            <div>{item.text}</div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.6)",
                marginTop: 4,
                textAlign: "right",
              }}
            >
              {item.acked ? "delivered" : "sending..."}
            </div>
          </div>
        ))}

        {session.receivedItems.map((item) => (
          <div
            key={`recv-${item.id}`}
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
            <div>{item.text}</div>
            <button
              onClick={() => handleCopy(item.text, item.id)}
              style={{
                marginTop: 6,
                padding: "4px 10px",
                borderRadius: 6,
                background:
                  copied === item.id ? colors.success : colors.border,
                color: colors.textPrimary,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {copied === item.id ? "copied!" : "copy"}
            </button>
          </div>
        ))}

        {session.receivedItems.length === 0 &&
          session.sentItems.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ color: colors.textSecondary, fontSize: 14 }}>
                no messages yet
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
          placeholder="enter text to send..."
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
          send
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
