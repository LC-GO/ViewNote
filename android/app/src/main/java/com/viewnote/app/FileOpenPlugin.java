package com.viewnote.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * 自定义插件：当 APP 被「打开方式」(ACTION_VIEW) 或「分享」(ACTION_SEND) 拉起时，
 * 直接把文件文本内容读出来返回给前端。统一处理两种 intent，避免依赖外部插件。
 */
@CapacitorPlugin(name = "FileOpen")
public class FileOpenPlugin extends Plugin {

    @PluginMethod
    public void getOpenedFile(PluginCall call) {
        Intent intent = getActivity().getIntent();
        String action = intent != null ? intent.getAction() : null;

        Uri uri = null;
        String inlineText = null;

        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (stream instanceof Uri) {
                uri = (Uri) stream;
            } else if (intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
                uri = intent.getClipData().getItemAt(0).getUri();
            }
            if (uri == null) {
                CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (t != null) inlineText = t.toString();
            }
        }

        JSObject ret = new JSObject();
        try {
            if (uri != null) {
                String name = readFileName(uri);
                String text = readTextFromUri(uri);
                ret.put("name", name != null ? name : lastSegment(uri));
                ret.put("text", text);
            } else if (inlineText != null) {
                ret.put("name", "分享内容.txt");
                ret.put("text", inlineText);
            } else {
                ret.put("name", null);
                ret.put("text", null);
            }
            clearIntent(); // 取走后清空，避免回到前台时重复打开
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("读取文件失败: " + e.getMessage());
        }
    }

    private String readTextFromUri(Uri uri) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        StringBuilder sb = new StringBuilder();
        try (InputStream is = resolver.openInputStream(uri);
             BufferedReader reader = new BufferedReader(
                     new InputStreamReader(is, StandardCharsets.UTF_8))) {
            char[] buf = new char[4096];
            int n;
            while ((n = reader.read(buf)) != -1) {
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }

    private String readFileName(Uri uri) {
        if (!"content".equals(uri.getScheme())) {
            return lastSegment(uri);
        }
        try (Cursor cursor = getContext().getContentResolver()
                .query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) return cursor.getString(idx);
            }
        } catch (Exception ignored) {
        }
        return lastSegment(uri);
    }

    private String lastSegment(Uri uri) {
        String seg = uri.getLastPathSegment();
        if (seg == null) return "打开的文件";
        int slash = seg.lastIndexOf('/');
        return slash >= 0 ? seg.substring(slash + 1) : seg;
    }

    private void clearIntent() {
        getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
    }
}
