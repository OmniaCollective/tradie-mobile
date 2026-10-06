<stack>
  Expo SDK 57, React Native 0.86.3, React 19.2, npm (not bun).
  React Query for server/async state.
  NativeWind + Tailwind v3 for styling.
  react-native-reanimated v4 for animations (preferred over Animated from react-native).
  react-native-gesture-handler for gestures.
  lucide-react-native for icons.
  All packages are pre-installed. DO NOT install new packages unless they are @expo-google-font packages or pure JavaScript helpers like lodash, dayjs, etc.
</stack>

<structure>
  src/app/          — Expo Router file-based routes (src/app/_layout.tsx is root). Add new screens to this folder.
  src/components/   — Reusable UI components. Add new components to this folder.
  src/lib/          — Utilities: cn.ts (className merge), example-context.ts (state pattern)
</structure>

<typescript>
  Explicit type annotations for useState: `useState<Type[]>([])` not `useState([])`
  Null/undefined handling: use optional chaining `?.` and nullish coalescing `??`
  Include ALL required properties when creating objects — TypeScript strict mode is enabled.
</typescript>

<environment>
  Development is done locally via VSCode + Claude Code.
  Build and submission via EAS CLI (eas build, eas submit).
  All files are editable as needed for builds and submissions.
  Do not edit: patches/, babel.config.js, metro.config.js, tsconfig.json, nativewind-env.d.ts
</environment>

<routing>
  Expo Router for file-based routing. Every file in src/app/ becomes a route.
  Never delete or refactor RootLayoutNav from src/app/_layout.tsx.
  
  <stack_router>
    src/app/_layout.tsx (root layout), src/app/index.tsx (matches '/'), src/app/settings.tsx (matches '/settings')
    Use <Stack.Screen options={{ title, headerStyle, ... }} /> inside pages to customize headers.
  </stack_router>
  
  <tabs_router>
    Only files registered in src/app/(tabs)/_layout.tsx become actual tabs.
    Unregistered files in (tabs)/ are routes within tabs, not separate tabs.
    Nested stacks create double headers — remove header from tabs, add stack inside each tab.
    At least 2 tabs or don't use tabs at all — single tab looks bad.
  </tabs_router>
  
  <router_selection>
    Games should avoid tabs — use full-screen stacks instead.
    For full-screen overlays/modals outside tabs: create route in src/app/ (not src/app/(tabs)/), 
    then add `<Stack.Screen name="page" options={{ presentation: "modal" }} />` in src/app/_layout.tsx.
  </router_selection>
  
  <rules>
    Only ONE route can map to "/" — can't have both src/app/index.tsx and src/app/(tabs)/index.tsx.
    Dynamic params: use `const { id } = useLocalSearchParams()` from expo-router.
  </rules>
</routing>

<state>
  React Query for server/async state. Always use object API: `useQuery({ queryKey, queryFn })`.
  Never wrap RootLayoutNav directly.
  React Query provider must be outermost; nest other providers inside it.
  
  Use `useMutation` for async operations — no manual `setIsLoading` patterns.
  Wrap third-party lib calls (RevenueCat, etc.) in useQuery/useMutation for consistent loading states.
  Reuse query keys across components to share cached data — don't create duplicate providers.
  
  For local state, use Zustand. However, most state is server state, so use React Query for that.
  Always use a selector with Zustand to subscribe only to the specific slice of state you need (e.g., useStore(s => s.foo)) rather than the whole store to prevent unnecessary re-renders. Make sure that the value returned by the selector is a primitive. Do not execute store methods in selectors; select data/functions, then compute outside the selector.
  For persistence: use AsyncStorage inside context hook providers. Only persist necessary data.
  Split ephemeral from persisted state to avoid hydration bugs.
</state>

<safearea>
  Import from react-native-safe-area-context, NOT from react-native.
  Skip SafeAreaView inside tab stacks with navigation headers.
  Skip when using native headers from Stack/Tab navigator.
  Add when using custom/hidden headers.
  For games: use useSafeAreaInsets hook instead.
</safearea>

<data>
  Create realistic mock data when you lack access to real data.
  For image analysis: actually send to LLM don't mock.
</data>

<design>
  Brand system v4 is approved (2026-10-06): read ../brand/BRAND-BRIEF.md before any UI work.
  Light and dark mode both supported; the phone's setting decides.

  <rules>
    Colours: only the token classes from tailwind.config.js — bg-bg, bg-surface, border-divider,
    text-fg, text-secondary, bg-accent + text-on-accent (primary button), text-link, text-alert.
    Never raw hex in className. For icon colours use useTheme() from src/lib/theme.ts.
    One cyan accent (#00F5F5, navy text on it). Red (alert) only for overdue, emergency, delete.
    Statuses are grey words + a line icon; only Paid (link colour) and Overdue/Emergency (alert) carry colour.
    Icons: lucide-react-native, line only, strokeWidth 2, sizes 16 / 20 / 24. Never on coloured tiles, never emoji. Money = PoundSterling (DollarSign when the tradie's country is US).
    Layout: 16px screen edge, grouped lists with 16px corners and no border, 12px button corners, 48px buttons, 44px minimum tap target.
    One primary button per screen. No gradients, no shadows on cards, no floating action button.
    Section titles in sentence case, not uppercase labels.
  </rules>
</design>

<mistakes>
  <styling>
    Use Nativewind for styling. Use cn() helper from src/lib/cn.ts to merge classNames when conditionally applying classNames or passing classNames via props.
    CameraView, LinearGradient, and Animated components DO NOT support className. Use inline style prop.
    Horizontal ScrollViews will expand vertically to fill flex containers. Add `style={{ flexGrow: 0 }}` to constrain height to content.
  </styling>

  <camera>
    Use CameraView from expo-camera, NOT the deprecated Camera import.
    import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
    Use style={{ flex: 1 }}, not className.
    Overlay UI must be absolute positioned inside CameraView.
  </camera>

  <react_native>
    No Node.js buffer in React Native — don't import from 'buffer'.
  </react_native>

  <ux>
    Use Pressable over TouchableOpacity.
    Use custom modals, not Alert.alert().
    Ensure keyboard is dismissable and doesn't obscure inputs. This is much harder to implement than it seems. You can use the react-native-keyboard-controller package to help with this. But, make sure to look up the documentation before implementing.
  </ux>

  <outdated_knowledge>
    Your react-native-reanimated and react-native-gesture-handler training may be outdated. Look up current docs before implementing.
  </outdated_knowledge>
</mistakes>

<code_quality>
  <architecture>
    Do not avoid improvements just because they weren't explicitly asked for. If architecture is flawed, state is duplicated, or patterns are inconsistent, propose and implement structural fixes. Ask: "What would a senior, experienced, perfectionist dev reject in code review?" Fix all of it.
  </architecture>

  <completion_gate>
    You are FORBIDDEN from reporting a task as complete until you have:
    - Run `npx tsc --noEmit` and fixed ALL type errors
    - Run `npx expo-doctor` and resolved any failures
    - Run `npx eslint . --quiet` (if configured) and fixed ALL errors
    A task is not done until these pass clean. No exceptions.
  </completion_gate>

  <file_edits>
    Before EVERY file edit, re-read the file. After editing, read it again to confirm the change applied correctly and didn't break surrounding code.
  </file_edits>

  <search_thoroughness>
    You have grep, not an AST. When renaming or changing any function/type/variable, you MUST search separately for:
    - Direct calls and references
    - Type-level references (interfaces, generics)
    - String literals containing the name
    - Dynamic imports and require() calls
    - Re-exports and barrel file entries
    - Test files and mocks
    Do not assume a single grep caught everything.
  </search_thoroughness>
</code_quality>

<appstore>
  App Store builds and submissions are managed via EAS CLI.
  Bundle ID: com.vibecode.tradie.5sttp4
  Expo account: builtbyomnia
  ASC API Key ID: H6YXD22623
</appstore>

<skills>
You have access to a few skills in the `.claude/skills` folder. Use them to your advantage.
- expo-docs: Use this skill when the user asks you to use an Expo SDK module or package that you might not know much about.
- frontend-app-design: Use this skill when the user asks you to design a frontend app component or screen.
</skills>