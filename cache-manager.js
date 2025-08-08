// 缓存管理工具
class CacheManager {
  constructor() {
    this.cacheName = 'mc-calculator-v1.2';
  }

  // 获取缓存状态
  async getCacheStatus() {
    if (!('caches' in window)) {
      return { supported: false, message: '浏览器不支持缓存API' };
    }

    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();
      const cacheSize = await this.getCacheSize();
      
      return {
        supported: true,
        cacheName: this.cacheName,
        cachedFiles: keys.length,
        cacheSize: cacheSize,
        message: `已缓存 ${keys.length} 个文件，总大小 ${cacheSize}`
      };
    } catch (error) {
      return { supported: true, error: error.message };
    }
  }

  // 获取缓存大小
  async getCacheSize() {
    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();
      let totalSize = 0;
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
      
      return this.formatBytes(totalSize);
    } catch (error) {
      return '0 B';
    }
  }

  // 格式化字节大小
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 清理缓存
  async clearCache() {
    if (!('caches' in window)) {
      throw new Error('浏览器不支持缓存API');
    }

    try {
      const cacheNames = await caches.keys();
      const promises = cacheNames.map(name => {
        if (name.startsWith('mc-calculator-')) {
          return caches.delete(name);
        }
      });
      
      await Promise.all(promises);
      return { success: true, message: '缓存清理成功' };
    } catch (error) {
      return { success: false, message: '缓存清理失败: ' + error.message };
    }
  }

  // 预缓存配方数据
  async precacheRecipes() {
    if (!('caches' in window)) {
      throw new Error('浏览器不支持缓存API');
    }

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

    try {
      const cache = await caches.open(this.cacheName);
      const promises = recipeFiles.map(async (file) => {
        try {
          const response = await fetch(file, {
            cache: 'force-cache',
            headers: {
              'Cache-Control': 'max-age=3600'
            }
          });
          if (response.ok) {
            await cache.put(file, response);
            return { file, status: 'success' };
          } else {
            return { file, status: 'failed', error: `HTTP ${response.status}` };
          }
        } catch (error) {
          return { file, status: 'failed', error: error.message };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      return {
        success: true,
        message: `预缓存完成: ${successCount} 成功, ${failedCount} 失败`,
        results: results
      };
    } catch (error) {
      return { success: false, message: '预缓存失败: ' + error.message };
    }
  }

  // 显示缓存状态
  async showCacheStatus() {
    const status = await this.getCacheStatus();
    
    if (!status.supported) {
      alert('您的浏览器不支持缓存功能');
      return;
    }

    let message = `缓存状态:\n`;
    message += `缓存名称: ${status.cacheName}\n`;
    message += `已缓存文件: ${status.cachedFiles} 个\n`;
    message += `缓存大小: ${status.cacheSize}\n`;
    
    if (status.error) {
      message += `错误: ${status.error}`;
    }

    alert(message);
  }

  // 显示缓存管理菜单
  showCacheMenu() {
    const menu = `
缓存管理菜单:
1. 查看缓存状态
2. 预缓存配方数据
3. 清理缓存
4. 取消

请选择操作 (1-4):
    `;
    
    const choice = prompt(menu);
    
    switch (choice) {
      case '1':
        this.showCacheStatus();
        break;
      case '2':
        this.precacheRecipes().then(result => {
          alert(result.message);
        });
        break;
      case '3':
        if (confirm('确定要清理所有缓存吗？这将删除所有已缓存的配方数据。')) {
          this.clearCache().then(result => {
            alert(result.message);
          });
        }
        break;
      case '4':
      default:
        break;
    }
  }
}

// 全局缓存管理器实例
window.cacheManager = new CacheManager();

// 添加快捷键支持
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+C 打开缓存管理菜单
  if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    e.preventDefault();
    window.cacheManager.showCacheMenu();
  }
});

// 页面加载完成后显示缓存提示
window.addEventListener('load', () => {
  // 延迟显示，避免影响页面加载
  setTimeout(() => {
    if (window.cacheManager) {
      window.cacheManager.getCacheStatus().then(status => {
        if (status.supported && status.cachedFiles === 0) {
          console.log('提示: 按 Ctrl+Shift+C 可以管理缓存');
        }
      });
    }
  }, 2000);
});
