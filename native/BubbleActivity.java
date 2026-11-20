package __PKG__;

import com.getcapacitor.BridgeActivity;

/** Hosts the chat inside an Android chat bubble (floating head). */
public class BubbleActivity extends BridgeActivity {
    @Override
    protected void onStart() {
        super.onStart();
        AppState.onStart();
    }

    @Override
    protected void onStop() {
        AppState.onStop();
        super.onStop();
    }
}
