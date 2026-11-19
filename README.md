# Textora — standalone messaging app (Web + Android)

Extracted from NEXORA. Same Supabase backend, so existing accounts, chats, groups and friends work unchanged.
Stack: Vite + React + TypeScript + Tailwind, wrapped as an Android app with **Capacitor**, push via **Firebase Cloud Messaging**.

## 1. Run on the web
```bash
cp .env.example .env     # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (same as the main app)
npm install
npm run dev
```

## 2. Supabase (one time)
1. Run `supabase/migrations/20261119_device_tokens.sql` in the SQL editor.
2. Firebase console → create project → add Android app with id `com.nexora.textora` (or your own; keep it identical in `capacitor.config.ts`) → download **google-services.json** → put it in `android/app/` (after step 3).
3. Firebase → Project settings → Service accounts → *Generate new private key* (JSON).
4. Deploy the function and set secrets:
```bash
supabase functions deploy send-push --no-verify-jwt
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)" WEBHOOK_SECRET="choose-a-long-random-string"
```
5. Dashboard → Database → Webhooks → *Create*: table `messages`, event `INSERT`, type *Supabase Edge Function* → `send-push`, add HTTP header `x-webhook-secret: <same secret>`.

## 3. Android app
```bash
npm install
npm run build
npm run android:add      # creates /android and patches permissions
# put google-services.json into android/app/
npm run android:sync
npm run android:open     # opens Android Studio → Run ▶ (or Build → Generate Signed Bundle for Play Store)
```
Requirements: Node 18+, Android Studio, JDK 17.

## What changed vs. NEXORA
- Removed: feed, stories, profile pages, service worker/PWA update gate, chat-heads (bubbles).
- `/` redirects to the chat list; `HashRouter` is used for WebView reliability.
- New: `src/push.ts` (FCM token registration + tap → opens the chat), `src/native.ts` (Android back button, clears delivered notifications), `src/MessageAlerts.tsx` (in-app toast), Log out button, `send-push` Edge Function (respects muted chats and blocks).
- Supabase URL/key are no longer hard-coded; set them in `.env`.

## Still depends on the main NEXORA database
Tables/RPCs used: messages, conversations, conversation_members, message_reactions, typing_status, blocks, user_reports, notes, friendships, friend_requests, profiles, storage bucket `media`; RPC `conversation_list`, `start_direct`, `create_group`, `textora_unread`, `typing_view`, `respond_friend_request`.
Friend requests are sent from the main app for now — a "find people / add friend" screen is the first thing to add if Textora must be fully independent.

## Next advanced features (suggested order)
1. Realtime typing via Supabase Broadcast (replace 4-second polling in `useTyping.ts`)
2. Reply/forward/delete-for-everyone polish, message search
3. Voice & video calls (WebRTC / LiveKit)
4. End-to-end encryption, multi-device, link previews
