package __PKG__;

/** Tracks whether any Textora screen is visible (so we don't show system notifications while the app is in use). */
public final class AppState {
    private static volatile int started = 0;
    private AppState() {}
    public static synchronized void onStart() { started++; }
    public static synchronized void onStop() { if (started > 0) started--; }
    public static boolean isForeground() { return started > 0; }
}
