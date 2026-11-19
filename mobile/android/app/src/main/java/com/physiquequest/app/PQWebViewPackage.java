package com.physiquequest.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.webkit.WebViewAssetLoader;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManager;
import com.reactnativecommunity.webview.RNCWebViewClient;
import com.reactnativecommunity.webview.RNCWebViewManager;
import com.reactnativecommunity.webview.RNCWebViewPackage;
import com.reactnativecommunity.webview.RNCWebViewWrapper;
import java.util.Collections;
import java.util.List;

public class PQWebViewPackage extends RNCWebViewPackage {
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.singletonList(new RNCWebViewManager() {
      @Override protected void addEventEmitters(@NonNull ThemedReactContext ctx, RNCWebViewWrapper wrapper) {
        if (!BuildConfig.PQ_STANDALONE) { super.addEventEmitters(ctx, wrapper); return; }
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(ctx)).build();
        wrapper.getWebView().setWebViewClient(new RNCWebViewClient() {
          @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost()))
              return super.shouldInterceptRequest(view, request);
            String path = uri.getPath();
            if (path == null || path.contains("..") || path.startsWith("/api/"))
              return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), null);
            String file = path.equals("/") ? "/index.html" : path.endsWith("/") ? path.substring(0, path.length()-1) + ".html" : path;
            if (!file.substring(file.lastIndexOf('/') + 1).contains(".")) file += ".html";
            Uri asset = uri.buildUpon().path("/physiquequest-shell" + file).clearQuery().build();
            WebResourceResponse response = loader.shouldInterceptRequest(asset);
            return response != null ? response : new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), null);
          }
        });
      }
    });
  }
}
