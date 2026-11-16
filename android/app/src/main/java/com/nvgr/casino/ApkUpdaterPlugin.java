package com.nvgr.casino;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// Updates inside the app: the new version is downloaded here, with its
// progress reported to the page, and Android's own installer is opened on
// it. Android always asks the player to confirm an install from outside
// the Play Store; the first time it may also ask them to allow this app to
// install updates.
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private File apkFile() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, "NVGR-Casino-update.apk");
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("No address to download from"); return; }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                File out = apkFile();
                URL u = new URL(url);
                // GitHub answers with a redirect to its download servers, on
                // another host: followed here by hand.
                for (int redirects = 0; ; redirects++) {
                    c = (HttpURLConnection) u.openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(30000);
                    c.setRequestProperty("Cache-Control", "no-cache");
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400 && redirects < 8) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        u = new URL(u, loc);
                        continue;
                    }
                    if (code != 200) throw new IOException("HTTP " + code);
                    break;
                }
                long total = c.getContentLengthLong();
                long done = 0;
                int lastPct = -1;
                try (InputStream in = new BufferedInputStream(c.getInputStream()); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        os.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject p = new JSObject();
                                p.put("percent", pct);
                                notifyListeners("progress", p);
                            }
                        }
                    }
                }
                JSObject r = new JSObject();
                r.put("bytes", done);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("The update could not be downloaded: " + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        File f = apkFile();
        if (!f.exists()) { call.reject("Nothing has been downloaded yet"); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            // The one-time permission: Android's page for it, for this app.
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(s);
            JSObject r = new JSObject();
            r.put("needsPermission", true);
            call.resolve(r);
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        JSObject r = new JSObject();
        r.put("started", true);
        call.resolve(r);
    }
}
