import { useTranslation } from "react-i18next";
import { colors } from "../styles/theme";

interface HomeScreenProps {
  onReceive: () => void;
  onSend: () => void;
}

export function HomeScreen({ onReceive, onSend }: HomeScreenProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: 32,
        gap: 24,
        background: colors.background,
      }}
    >
      <h1
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: 12,
        }}
      >
        {t("home.title")}
      </h1>

      <p
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {t("home.description")}
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          maxWidth: 320,
          marginTop: 32,
        }}
      >
        <button
          onClick={onReceive}
          style={{
            padding: "16px 24px",
            borderRadius: 12,
            background: colors.primary,
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: 600,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = colors.primaryHover)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = colors.primary)
          }
        >
          {t("home.receive")}
        </button>

        <button
          onClick={onSend}
          style={{
            padding: "16px 24px",
            borderRadius: 12,
            background: colors.surface,
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: 600,
            border: `1px solid ${colors.border}`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = colors.border)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = colors.surface)
          }
        >
          {t("home.send")}
        </button>
      </div>
    </div>
  );
}
