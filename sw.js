// FF14生产计算器 - Service Worker
// 用于缓存配方数据和静态资源

const CACHE_NAME = 'mc-calculator-v1.0';
const CACHE_FILES = [
  './',
  './index.html',
  './mobile.html',
  './script.js',
  './mobile.js',
  './device-detector.js',
  './assets/icons/jobs/001.webp',
  './assets/icons/jobs/002.webp',
  './assets/icons/jobs/003.webp',
  './assets/icons/jobs/004.webp',
  './assets/icons/jobs/005.webp',
  './assets/icons/jobs/006.webp',
  './assets/icons/jobs/007.webp',
  './assets/icons/jobs/008.webp',
  './assets/icons/jobs/009.webp',
  './assets/icons/jobs/010.webp',
  './assets/icons/jobs/011.webp'
];

// 需要缓存的API路径
const API_CACHE_PATTERNS = [
  /\.\/assets\/recipe\/.*\.json$/,
  /\.\/assets\/gather\/.*\.json$/
];

// 安装事件 - 预缓存核心文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CACHE_FILES);
      })
      .catch(error => {
        // 静默处理缓存安装失败，避免控制台报错
        console.log('Cache installation failed:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 拦截fetch请求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 跳过外部API请求，避免Service Worker拦截导致错误
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // 处理API请求（配方数据）
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // 处理静态资源
  if (event.request.method === 'GET') {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }
});

// 处理API请求（配方数据）
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 先尝试从网络获取最新数据
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // 网络请求成功，更新缓存
      cache.put(request, networkResponse.clone());
      return networkResponse;
    } else {
      // 网络请求失败，尝试从缓存获取
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw new Error('Network failed and no cache available');
    }
  } catch (error) {
    // 网络请求异常，尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// 处理静态资源请求
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 先尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 缓存中没有，从网络获取
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // 网络请求失败，尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// 预缓存配方数据
async function precacheRecipes() {
  const cache = await caches.open(CACHE_NAME);
  const recipeFiles = [
    './assets/recipe/quickcalc.json',
    './assets/recipe/carpenter.json',
    './assets/recipe/blacksmith.json',
    './assets/recipe/armorer.json',
    './assets/recipe/goldsmith.json',
    './assets/recipe/leatherworker.json',
    './assets/recipe/weaver.json',
    './assets/recipe/alchemist.json',
    './assets/recipe/culinarian.json',
    './assets/gather/miner.json',
    './assets/gather/botanist.json'
  ];
  
  const promises = recipeFiles.map(async (file) => {
    try {
      const response = await fetch(file);
      if (response.ok) {
        await cache.put(file, response);
      }
    } catch (error) {
      // 静默处理预缓存失败，避免控制台报错
      console.log(`Failed to precache ${file}:`, error);
    }
  });
  
  await Promise.all(promises);
}

// 监听消息事件
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'PRECACHE_RECIPES') {
    precacheRecipes();
  }
});
