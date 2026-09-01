// ============================================================
// 旭哥记录 v9.0 - Service Worker
// 支持离线缓存、PWA安装、后台同步
// ============================================================

const CACHE_NAME = 'xuge-records-v9-cache';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// 安装：缓存核心资源
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] 缓存核心资源');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) {
              return name !== CACHE_NAME;
            })
            .map(function(name) {
              console.log('[SW] 删除旧缓存:', name);
              return caches.delete(name);
            })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// 请求拦截：缓存优先策略
self.addEventListener('fetch', function(event) {
  const request = event.request;

  // 只缓存 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // Supabase API 请求：网络优先，失败时不缓存（数据需要实时）
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          return response;
        })
        .catch(function() {
          // 离线时返回空响应，应用会使用本地数据
          return new Response(JSON.stringify([]), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 其他请求：缓存优先，网络更新
  event.respondWith(
    caches.match(request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          // 缓存命中，同时后台更新缓存
          fetch(request)
            .then(function(networkResponse) {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(function(cache) {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(function() {});
          return cachedResponse;
        }

        // 缓存未命中，从网络获取
        return fetch(request)
          .then(function(networkResponse) {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }

            // 缓存新资源
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch(function() {
            // 离线时，对于导航请求返回 index.html
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('离线状态', { status: 504 });
          });
      })
  );
});

// 后台同步：网络恢复时自动同步数据
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // 通知所有客户端进行同步
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'sync-data' });
        });
      })
    );
  }
});

// 推送通知（预留）
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || '旭哥记录', {
        body: data.body || '',
        icon: data.icon || './manifest.json',
        badge: data.badge || './manifest.json',
        data: data.data || {},
        actions: data.actions || []
      })
    );
  }
});

// 通知点击
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('./index.html');
        }
      })
  );
});

console.log('[SW] Service Worker 已加载');
