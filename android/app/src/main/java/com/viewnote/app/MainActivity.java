package com.viewnote.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册自定义插件（必须在 super.onCreate 之前）
        registerPlugin(FileOpenPlugin.class);
        registerPlugin(SafPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // APP 已在运行时被再次「打开方式」拉起，更新当前 intent，
        // 前端会在 resume 时调用 getOpenedFile 取到新文件
        setIntent(intent);
    }
}
