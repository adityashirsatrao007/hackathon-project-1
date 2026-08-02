package com.tracelify;

import java.util.HashMap;
import java.util.Map;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.sql.SQLException;
import java.text.ParseException;
import java.util.NoSuchElementException;
import java.util.ConcurrentModificationException;

public class TracelifyTest {
    private static final String DSN = "http://c482f74735cacf53d2ad256c8429f1f7@54.251.156.151.nip.io:8000/api/d19f7705-48bc-4842-af80-55da7bc29007/events";

    private static void capture(Tracelify sdk, int idx, Exception e) {
        System.out.println("[" + idx + "] Capturing " + e.getClass().getSimpleName() + "...");
        sdk.captureException(e);
    }

    public static void main(String[] args) {
        System.out.println("=== Tracelify Java SDK Test (20 Errors) ===");
        Tracelify sdk = new Tracelify(DSN, "1.0.0");
        Map<String, Object> user = new HashMap<>(); user.put("id", "usr_j_1"); sdk.setUser(user);
        
        try { int x = 10/0; } catch (Exception e) { capture(sdk, 1, e); }
        try { String s = null; s.length(); } catch (Exception e) { capture(sdk, 2, e); }
        try { throw new IllegalArgumentException("Bad"); } catch (Exception e) { capture(sdk, 3, e); }
        try { throw new FileNotFoundException("/null"); } catch (Exception e) { capture(sdk, 4, e); }
        try { int[] a = new int[1]; int b = a[5]; } catch (Exception e) { capture(sdk, 5, e); }
        try { throw new IOException("Net err"); } catch (Exception e) { capture(sdk, 6, e); }
        try { throw new SQLException("DB err"); } catch (Exception e) { capture(sdk, 7, e); }
        try { Object o = 1; String s = (String)o; } catch (Exception e) { capture(sdk, 8, e); }
        try { throw new ParseException("Err", 0); } catch (Exception e) { capture(sdk, 9, e); }
        try { throw new UnsupportedOperationException(""); } catch (Exception e) { capture(sdk, 10, e); }
        try { throw new IllegalStateException(); } catch (Exception e) { capture(sdk, 11, e); }
        try { Integer.parseInt("abc"); } catch (Exception e) { capture(sdk, 12, e); }
        try { throw new SecurityException(); } catch (Exception e) { capture(sdk, 13, e); }
        try { Object[] a = new String[1]; a[0] = 1; } catch (Exception e) { capture(sdk, 14, e); }
        try { "a".substring(5); } catch (Exception e) { capture(sdk, 15, e); }
        try { int[] a = new int[-1]; } catch (Exception e) { capture(sdk, 16, e); }
        try { throw new InterruptedException(); } catch (Exception e) { capture(sdk, 17, e); }
        try { throw new ConcurrentModificationException(); } catch (Exception e) { capture(sdk, 18, e); }
        try { throw new NoSuchElementException(); } catch (Exception e) { capture(sdk, 19, e); }
        try { throw new RuntimeException("Generic app failure"); } catch (Exception e) { capture(sdk, 20, e); }

        System.out.println("Shutting down...");
        try { sdk.shutdown(); } catch (Exception e) {}
        System.out.println("✅ Done");
    }
}
