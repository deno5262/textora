package __PKG__;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onStart() {
        super.onStart();
        AppState.onStart();
        TextoraMessagingService.clearAll(this);
    }

    @Override
    protected void onStop() {
        AppState.onStop();
        super.onStop();
    }
}
