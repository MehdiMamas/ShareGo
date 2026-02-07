---
name: add-screen
description: Guide for adding a new screen to both desktop and mobile apps. Use when adding a new page/view to ShareGo, ensuring UI parity between platforms.
---

# Adding a new screen

ShareGo enforces strict UI parity between desktop (Tauri) and mobile (React Native). Adding a screen requires changes in both app shells simultaneously.

## Steps

### 1. Define the screen contract

before writing any code, define:
- **screen name** (e.g. `SettingsScreen`)
- **purpose** (one sentence)
- **required elements** (list of UI components)
- **state dependencies** (which `SessionSnapshot` fields it uses)

### 2. Add translations

add all user-facing text to `core/src/i18n/en.ts`:

```typescript
// in en.ts, add a new namespace
settings: {
  title: "settings",
  themeLabel: "theme",
  // ...
},
```

### 3. Create the desktop screen

file: `apps/desktop-tauri/src/screens/SettingsScreen.tsx`

```typescript
import { useTranslation } from "react-i18next";

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t } = useTranslation();
  return (
    <div style={{ /* use theme colors */ }}>
      <h1>{t("settings.title")}</h1>
      {/* screen content */}
    </div>
  );
}
```

### 4. Create the mobile screen

file: `apps/mobile-rn/src/screens/SettingsScreen.tsx`

```typescript
import { useTranslation } from "react-i18next";
import { View, Text, SafeAreaView } from "react-native";

export function SettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View>
        <Text>{t("settings.title")}</Text>
        {/* screen content — same elements as desktop */}
      </View>
    </SafeAreaView>
  );
}
```

### 5. Wire up navigation

**desktop** (`App.tsx`): add a new case to the screen state and navigation callbacks

```typescript
type Screen = "home" | "receive" | "send" | "active" | "settings";
```

**mobile** (`App.tsx`): add a new screen to the React Navigation stack

```typescript
<Stack.Screen name="Settings" component={SettingsScreen} />
```

### 6. Update the ui-parity rule

add the new screen to the screen contract table in `.cursor/rules/ui-parity.mdc`.

## Parity checklist

- [ ] Screen exists in both `apps/desktop-tauri/src/screens/` and `apps/mobile-rn/src/screens/`
- [ ] All user-facing text comes from `core/src/i18n/en.ts`
- [ ] Same elements, labels, and behavior on both platforms
- [ ] Colors from `styles/theme.ts`, not hardcoded
- [ ] Timing values from `core/src/config.ts`, not hardcoded
- [ ] Navigation wired in both `App.tsx` files
- [ ] Screen contract updated in `.cursor/rules/ui-parity.mdc`
- [ ] Desktop uses callback props for navigation, mobile uses react-navigation

## Allowed differences

- `<div>` vs `<View>`, `<button>` vs `<TouchableOpacity>`, etc.
- `SafeAreaView` wrapper on mobile only
- `maxWidth` constraints on desktop for large screens
- hover states on desktop only
- desktop uses `100vh`, mobile uses `flex: 1`
