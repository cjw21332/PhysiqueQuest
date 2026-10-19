# Shared dark scrollbar

`app/scrollbars.css` is loaded by the root layout. Every scrollable page and
nested panel receives the dark track and slate thumb, including mobile web
views. Existing filter strips that deliberately hide scrollbars stay hidden.

To use the shared visible scrollbar on a new container:

```tsx
<div className="pq-scrollbar" style={{ overflowY: 'auto', maxHeight: 400 }}>
  {children}
</div>
```

Override these inherited CSS variables on a container or at the root to customize
its appearance:

```css
.my-panel {
  --pq-scrollbar-size: 8px;
  --pq-scrollbar-track: #171e27;
  --pq-scrollbar-thumb: #64748b;
  --pq-scrollbar-hover: #94a3b8;
  --pq-scrollbar-active: #cbd5e1;
}
```

Use `pq-scrollbar--hidden` when a horizontal strip should scroll without a
visible bar. The classes style scrolling; they do not set a container's height
or turn on overflow. No JavaScript is required.

Browsers supporting `scrollbar-color` use their native thin scrollbar with these
colors. Older WebKit browsers use the rounded custom thumb and hover styles.
Some mobile systems manage the indicator's shape, width, visibility, and timing
themselves. The native Expo WebView requests a light indicator over dark screens
(and a dark indicator over the remaining light screens). Physical-device
appearance is subject to platform support. Windows high-contrast mode keeps its
system scrollbar colors.
