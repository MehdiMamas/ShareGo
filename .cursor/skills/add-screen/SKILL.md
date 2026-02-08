---
name: add-screen
description: Guide for adding a new screen to the unified ShareGo app. Use when adding a new page/view to ShareGo.
---

# Adding a new screen

ShareGo uses a single unified codebase in `apps/app/`. Screens are written once with React Native components and render on all platforms via react-native-web.

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

### 3. Create the screen

file: `apps/app/src/screens/SettingsScreen.tsx`

```typescript
import { useTranslation } from "react-i18next";
import { View, Text, SafeAreaView } from "react-native";

export function SettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View>
        <Text>{t("settings.title")}</Text>
        {/* screen content */}
      </View>
    </SafeAreaView>
  );
}
```

### 4. Wire up navigation

add a new screen to the React Navigation stack in `apps/app/src/App.tsx`:

```typescript
<Stack.Screen name="Settings" component={SettingsScreen} />
```

### 6. Update the ui-parity rule

add the new screen to the screen contract table in `.cursor/rules/ui-parity.mdc`.

## Checklist

- [ ] Screen exists in `apps/app/src/screens/`
- [ ] All user-facing text comes from `core/src/i18n/en.ts`
- [ ] Uses React Native components (`View`, `Text`, `TouchableOpacity`, etc.)
- [ ] Colors from `apps/app/src/styles/theme.ts`, not hardcoded
- [ ] Timing values from `core/src/config.ts`, not hardcoded
- [ ] Navigation wired in `apps/app/src/App.tsx`
- [ ] Screen contract updated in `.cursor/rules/ui-parity.mdc`
