package __PKG__;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        callFlags(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        callFlags(intent);
    }

    /** An incoming-call screen may appear above the lock screen. Normal chats never do. */
    private void callFlags(Intent intent) {
        Uri u = intent == null ? null : intent.getData();
        if (u == null || !"call".equals(u.getHost())) return;
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        AppState.onStart();
        TextoraMessagingService.clearAll(this);
    }

    @Override
    public void onStop() {
        AppState.onStop();
        super.onStop();
    }
}
