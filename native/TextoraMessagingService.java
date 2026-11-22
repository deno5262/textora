package __PKG__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * Receives data-only FCM messages and shows Messenger-style conversation notifications
 * with chat bubbles (Android 11+). Falls back to a normal notification if bubbles fail.
 */
public class TextoraMessagingService extends FirebaseMessagingService {
    private static final String TAG = "TextoraPush";
    private static final String CHANNEL = "chat_bubbles";
    private static final HashMap<String, ArrayList<Object[]>> HISTORY = new HashMap<>();

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> d = message.getData();
        if (d == null) return;
        String type = d.get("type");
        if ("call_cancel".equals(type)) { cancelCall(getApplicationContext(), d.get("conversation_id")); return; }
        if ("call".equals(type)) {
            if (!AppState.isForeground()) { try { showCall(getApplicationContext(), d); } catch (Throwable t) { Log.w(TAG, "call notification failed", t); } }
            return;
        }
        if (!"chat".equals(type)) return;
        ack(d.get("ack_url"));                       // tell the server this device received it (delivered tick)
        if (AppState.isForeground()) return;         // app is open: the in-app alert handles it
        try {
            show(getApplicationContext(), d, true);
        } catch (Throwable t) {
            Log.w(TAG, "bubble notification failed, using plain one", t);
            try { show(getApplicationContext(), d, false); } catch (Throwable t2) { Log.w(TAG, "plain notification failed", t2); }
        }
    }

    /** Remove all chat notifications (called when the user opens the app). */
    public static void clearAll(Context ctx) {
        synchronized (HISTORY) { HISTORY.clear(); }
        try { NotificationManagerCompat.from(ctx).cancelAll(); } catch (Throwable ignored) { }
    }

    private static void ack(final String url) {
        if (url == null || url.isEmpty()) return;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(5000);
                    c.setReadTimeout(5000);
                    c.getResponseCode();
                    c.disconnect();
                } catch (Throwable ignored) { }
            }
        }).start();
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Messages", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("New message alerts and chat bubbles");
        ch.enableVibration(true);
        ch.enableLights(true);
        if (Build.VERSION.SDK_INT >= 29) ch.setAllowBubbles(true);
        nm.createNotificationChannel(ch);
    }

    private static void show(Context ctx, Map<String, String> d, boolean withBubble) {
        String cid = d.get("conversation_id");
        if (cid == null) return;
        String title = nz(d.get("title"), "TextGen");
        String body = nz(d.get("body"), "New message");
        String sender = nz(d.get("sender_name"), title);
        String avatarUrl = nz(d.get("avatar_url"), "");
        boolean isGroup = "true".equals(d.get("is_group"));
        boolean hidden = "hide".equals(d.get("lock"));

        ensureChannel(ctx);

        Bitmap avatar = avatarUrl.isEmpty() ? null : download(avatarUrl);
        Bitmap face = avatar != null ? circle(avatar) : letter(sender);
        IconCompat icon = IconCompat.createWithBitmap(face);
        Person person = new Person.Builder().setName(sender).setIcon(icon).setKey(cid).setImportant(true).build();
        Person me = new Person.Builder().setName("You").build();

        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("textora://chat/" + cid));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPi = PendingIntent.getActivity(ctx, cid.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me);
        if (isGroup) { style.setConversationTitle(title); style.setGroupConversation(true); }
        ArrayList<Object[]> list;
        synchronized (HISTORY) {
            list = HISTORY.get(cid);
            if (list == null) { list = new ArrayList<>(); HISTORY.put(cid, list); }
            list.add(new Object[]{body, System.currentTimeMillis()});
            while (list.size() > 6) list.remove(0);
            for (Object[] m : list) style.addMessage((CharSequence) m[0], (Long) m[1], person);
        }

        NotificationCompat.Builder nb = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(smallIcon(ctx))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(style)
                .setLargeIcon(face)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setColor(0xFF5B6CFF)
                .setAutoCancel(true)
                .setContentIntent(contentPi);

        if (withBubble && !hidden && Build.VERSION.SDK_INT >= 30) {
            ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(ctx, "chat_" + cid)
                    .setLongLived(true)
                    .setShortLabel(sender)
                    .setIcon(icon)
                    .setPerson(person)
                    .setIntent(open)
                    .build();
            ShortcutManagerCompat.pushDynamicShortcut(ctx, shortcut);

            Intent bubble = new Intent(ctx, BubbleActivity.class);
            bubble.setAction(Intent.ACTION_VIEW);
            bubble.setData(Uri.parse("textora://chat/" + cid));
            int mut = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
            PendingIntent bubblePi = PendingIntent.getActivity(ctx, cid.hashCode() + 1, bubble, PendingIntent.FLAG_UPDATE_CURRENT | mut);
            NotificationCompat.BubbleMetadata meta = new NotificationCompat.BubbleMetadata.Builder(bubblePi, icon)
                    .setDesiredHeight(640)
                    .setAutoExpandBubble(false)
                    .setSuppressNotification(false)
                    .build();
            nb.setShortcutId("chat_" + cid).addPerson(person).setBubbleMetadata(meta);
        }

        NotificationManagerCompat.from(ctx).notify(cid.hashCode(), nb.build());
    }

    private static int smallIcon(Context ctx) {
        int id = ctx.getResources().getIdentifier("ic_stat_textora", "drawable", ctx.getPackageName());
        return id != 0 ? id : ctx.getApplicationInfo().icon;
    }


    private static final String CALL_CHANNEL = "chat_calls";

    private static void ensureCallChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CALL_CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CALL_CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        Uri ring = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        ch.setSound(ring, aa);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 600, 400, 600, 400, 600});
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /** Rings like a phone call, even when the app is closed (full-screen on a locked phone if the user allows it). */
    private static void showCall(Context ctx, Map<String, String> d) {
        String cid = d.get("conversation_id");
        if (cid == null) return;
        String who = nz(d.get("sender_name"), "TextGen");
        boolean video = "video".equals(d.get("call_kind"));
        ensureCallChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("textora://call/" + cid));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, ("call" + cid).hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder nb = new NotificationCompat.Builder(ctx, CALL_CHANNEL)
                .setSmallIcon(smallIcon(ctx))
                .setContentTitle(who)
                .setContentText(video ? "Incoming video call" : "Incoming voice call")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(0xFF5B6CFF)
                .setOngoing(true)
                .setAutoCancel(true)
                .setTimeoutAfter(45000)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi);
        Notification n = nb.build();
        n.flags |= Notification.FLAG_INSISTENT;
        NotificationManagerCompat.from(ctx).notify(("call" + cid).hashCode(), n);
    }

    private static void cancelCall(Context ctx, String cid) {
        if (cid == null) return;
        try { NotificationManagerCompat.from(ctx).cancel(("call" + cid).hashCode()); } catch (Throwable ignored) { }
    }

    private static String nz(String s, String def) { return (s == null || s.isEmpty()) ? def : s; }

    private static Bitmap download(String url) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(5000);
            c.setReadTimeout(5000);
            InputStream in = c.getInputStream();
            Bitmap b = BitmapFactory.decodeStream(in);
            in.close();
            c.disconnect();
            return b;
        } catch (Throwable t) {
            return null;
        }
    }

    private static Bitmap circle(Bitmap src) {
        int size = 192;
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        cv.drawCircle(size / 2f, size / 2f, size / 2f, p);
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        int side = Math.min(src.getWidth(), src.getHeight());
        Rect from = new Rect((src.getWidth() - side) / 2, (src.getHeight() - side) / 2, (src.getWidth() + side) / 2, (src.getHeight() + side) / 2);
        cv.drawBitmap(src, from, new Rect(0, 0, size, size), p);
        return out;
    }

    private static Bitmap letter(String name) {
        int size = 192;
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(0xFF5B6CFF);
        cv.drawCircle(size / 2f, size / 2f, size / 2f, p);
        p.setColor(0xFFFFFFFF);
        p.setTextSize(96f);
        p.setTypeface(Typeface.DEFAULT_BOLD);
        p.setTextAlign(Paint.Align.CENTER);
        String l = name == null || name.isEmpty() ? "T" : name.substring(0, 1).toUpperCase();
        cv.drawText(l, size / 2f, size / 2f + 34f, p);
        return out;
    }
}
