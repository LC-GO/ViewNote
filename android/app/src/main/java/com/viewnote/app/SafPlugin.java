package com.viewnote.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * SAF（Storage Access Framework）文件夹授权与读取。
 * 解决 Android 11+ 分区存储下无法随意遍历存储的问题：
 * 用户授权某个目录后，可持久浏览/读取其中的 md/html 与图片（支持相对路径图片）。
 */
@CapacitorPlugin(name = "Saf")
public class SafPlugin extends Plugin {

    // 弹出系统目录选择器，授权并持久化读取权限
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("已取消");
            return;
        }
        Uri treeUri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                    treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
        }
        String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
        JSObject ret = new JSObject();
        ret.put("treeUri", treeUri.toString());
        ret.put("docId", rootDocId);
        ret.put("name", displayName(rootDocId));
        call.resolve(ret);
    }

    // 列出目录内容
    @PluginMethod
    public void list(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String docId = call.getString("docId");
        if (treeUriStr == null) {
            call.reject("缺少 treeUri");
            return;
        }
        try {
            Uri treeUri = Uri.parse(treeUriStr);
            if (docId == null) docId = DocumentsContract.getTreeDocumentId(treeUri);
            JSArray entries = readChildren(treeUri, docId, null);
            JSObject ret = new JSObject();
            ret.put("entries", entries);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("列目录失败: " + e.getMessage());
        }
    }

    // 读取文档为 UTF-8 文本
    @PluginMethod
    public void readText(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("缺少 uri");
            return;
        }
        try {
            byte[] bytes = readBytes(Uri.parse(uri));
            JSObject ret = new JSObject();
            ret.put("text", new String(bytes, StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("读取失败: " + e.getMessage());
        }
    }

    // 按相对路径在已授权目录里找图片并返回 data URL（支持 a.png / ./a.png / img/a.png / ../b/c.png）
    @PluginMethod
    public void readRelativeImage(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String dirDocId = call.getString("dirDocId");
        String relPath = call.getString("relPath");
        if (treeUriStr == null || dirDocId == null || relPath == null) {
            call.reject("参数不足");
            return;
        }
        try {
            Uri treeUri = Uri.parse(treeUriStr);
            String[] parts = relPath.replace("\\", "/").split("/");
            String curDocId = dirDocId;
            String fileName = null;
            for (int i = 0; i < parts.length; i++) {
                String seg = parts[i];
                if (seg.isEmpty() || seg.equals(".")) continue;
                if (seg.equals("..")) {
                    // 简化：不向上跨越授权根；忽略 .. 段
                    continue;
                }
                if (i == parts.length - 1) {
                    fileName = seg; // 最后一段是文件名
                } else {
                    String sub = findChildId(treeUri, curDocId, seg, true);
                    if (sub == null) {
                        call.reject("找不到子目录: " + seg);
                        return;
                    }
                    curDocId = sub;
                }
            }
            if (fileName == null) {
                call.reject("路径无效");
                return;
            }
            String fileId = findChildId(treeUri, curDocId, fileName, false);
            if (fileId == null) {
                call.reject("找不到图片: " + fileName);
                return;
            }
            Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, fileId);
            String mime = getContext().getContentResolver().getType(docUri);
            byte[] bytes = readBytes(docUri);
            String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("dataUrl", "data:" + (mime == null ? "image/png" : mime) + ";base64," + b64);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("读取图片失败: " + e.getMessage());
        }
    }

    // ---------- 内部工具 ----------
    private JSArray readChildren(Uri treeUri, String docId, String onlyName) {
        JSArray out = new JSArray();
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId);
        try (Cursor c = getContext().getContentResolver().query(childrenUri, new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
        }, null, null, null)) {
            if (c != null) {
                while (c.moveToNext()) {
                    String id = c.getString(0);
                    String name = c.getString(1);
                    String mime = c.getString(2);
                    if (onlyName != null && !onlyName.equals(name)) continue;
                    boolean isDir = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);
                    Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id);
                    JSObject o = new JSObject();
                    o.put("name", name);
                    o.put("isDirectory", isDir);
                    o.put("docId", id);
                    o.put("uri", docUri.toString());
                    o.put("mime", mime == null ? "" : mime);
                    out.put(o);
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    private String findChildId(Uri treeUri, String docId, String name, boolean wantDir) {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId);
        try (Cursor c = getContext().getContentResolver().query(childrenUri, new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
        }, null, null, null)) {
            if (c != null) {
                while (c.moveToNext()) {
                    if (name.equals(c.getString(1))) {
                        boolean isDir = DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2));
                        if (isDir == wantDir) return c.getString(0);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private byte[] readBytes(Uri uri) throws Exception {
        try (InputStream is = getContext().getContentResolver().openInputStream(uri)) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
            return bos.toByteArray();
        }
    }

    private String displayName(String docId) {
        if (docId == null) return "文件夹";
        String tail = docId.contains(":") ? docId.substring(docId.lastIndexOf(':') + 1) : docId;
        int slash = tail.lastIndexOf('/');
        if (slash >= 0) tail = tail.substring(slash + 1);
        return tail.isEmpty() ? "文件夹" : tail;
    }
}
