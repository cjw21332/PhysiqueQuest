package com.physiquequest.offlineverification;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
public class OfflineActivity extends Activity {
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    WebView.setWebContentsDebuggingEnabled(true);
    WebView view = new WebView(this);
    view.getSettings().setJavaScriptEnabled(true);
    view.getSettings().setDomStorageEnabled(true);
    setContentView(view);
    view.loadData("<title>PhysiqueQuest offline verification</title>","text/html",null);
  }
}
