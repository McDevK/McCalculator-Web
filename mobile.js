// FF14生产职业计算器 - 移动端交互逻辑
// 说明：移动端版本，保持与桌面版相同的功能

// ===================== 职业数据 =====================
// 职业列表
const JOBS = [
  { key: 'quickcalc', name: '快捷计算', icon: 'assets/icons/jobs/001.webp' },
  { key: 'carpenter', name: '刻木匠', icon: 'assets/icons/jobs/002.webp' },
  { key: 'blacksmith', name: '锻铁匠', icon: 'assets/icons/jobs/003.webp' },
  { key: 'armorer', name: '铸甲匠', icon: 'assets/icons/jobs/004.webp' },
  { key: 'goldsmith', name: '雕金匠', icon: 'assets/icons/jobs/005.webp' },
  { key: 'leatherworker', name: '制革匠', icon: 'assets/icons/jobs/006.webp' },
  { key: 'weaver', name: '裁衣匠', icon: 'assets/icons/jobs/007.webp' },
  { key: 'alchemist', name: '炼金术士', icon: 'assets/icons/jobs/008.webp' },
  { key: 'culinarian', name: '烹调师', icon: 'assets/icons/jobs/009.webp' },
  { key: 'miner', name: '采矿工', icon: 'assets/icons/jobs/010.webp' },
  { key: 'botanist', name: '园艺工', icon: 'assets/icons/jobs/011.webp' }
];

// 生产职业与json文件名映射
const JOB_JSON_MAP = {
  'quickcalc': 'quickcalc',
  'carpenter': 'carpenter',
  'blacksmith': 'blacksmith',
  'armorer': 'armorer',
  'goldsmith': 'goldsmith',
  'leatherworker': 'leatherworker',
  'weaver': 'weaver',
  'alchemist': 'alchemist',
  'culinarian': 'culinarian',
  'miner': 'miner',
  'botanist': 'botanist'
};

// 当前配方数据
let ITEMS = [];

// 完成状态管理
let completedItems = new Set(); // 已完成的物品ID集合
let completedMaterials = new Set(); // 已完成的半成品ID集合
let completedBaseMaterials = new Set(); // 已完成的基础材料ID集合

// 已选物品列表
let selectedItems = [];

// 收藏物品列表
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

// 当前职业
let currentJob = 'quickcalc';

// 搜索关键词
let searchKeyword = '';

// 采集职业倒计时相关
let gatheringItems = []; // 采集物品列表（带倒计时）
let gatheringTimer = null; // 倒计时定时器

// ========== 全职业配方全量数据，支持跨职业半成品递归 ========== //
let ALL_RECIPES = [];

// ===================== 采集职业倒计时功能 =====================

// 计算艾欧泽亚时间（与桌面版保持一致）
function getEorzeaTime() {
  // 基准点：2025-07-14 14:23:00 本地 = 艾18:10
  const baseLocal = new Date('2025-07-14T14:23:00+08:00'); // 假设东八区
  const baseEorzeaMinutes = 18 * 60 + 10;
  // 当前本地时间
  const now = new Date();
  // 距离基准点的本地秒数
  const deltaSec = (now - baseLocal) / 1000;
  // 艾欧泽亚1分钟=2.9166666666666665秒（2又11/12秒，标准精度）
  const eorzeaMinuteSec = 2 + 11/12;
  // 增加的艾分钟数
  const addEorzeaMin = Math.floor(deltaSec / eorzeaMinuteSec);
  // 当前艾分钟总数
  let curEorzeaMin = (baseEorzeaMinutes + addEorzeaMin) % (24 * 60);
  if (curEorzeaMin < 0) curEorzeaMin += 24 * 60;
  const hh = Math.floor(curEorzeaMin / 60);
  const mm = curEorzeaMin % 60;
  
  return {
    hours: hh,
    minutes: mm,
    totalMinutes: curEorzeaMin
  };
}

// 计算倒计时（与桌面版保持一致）
function calculateCountdown(startTime, endTime) {
  if (!startTime || !endTime) {
    return {
      text: '时间未知',
      minutes: Infinity,
      isAppearing: false
    };
  }
  
  const eorzeaTime = getEorzeaTime();
  const currentEorzeaTime = eorzeaTime.hours + eorzeaTime.minutes / 60; // 转换为小时的小数形式
  
  // 将艾欧泽亚时间转换为0-1的小数形式（一天中的时间比例）
  const currentTimeRatio = currentEorzeaTime / 24;
  
  // 处理跨天的情况
  let startTimeRatio = startTime;
  let endTimeRatio = endTime;
  
  // 如果结束时间小于开始时间，说明跨天了
  if (endTimeRatio < startTimeRatio) {
    if (currentTimeRatio >= startTimeRatio) {
      // 当前时间在开始时间之后，结束时间需要加1
      endTimeRatio += 1;
    } else {
      // 当前时间在开始时间之前，开始时间需要减1
      startTimeRatio -= 1;
    }
  }
  
  // 计算倒计时（艾欧泽亚时间）
  let timeUntil;
  let isAppearing = false;
  
  if (currentTimeRatio < startTimeRatio) {
    // 尚未出现
    timeUntil = (startTimeRatio - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    isAppearing = true;
  } else if (currentTimeRatio >= startTimeRatio && currentTimeRatio < endTimeRatio) {
    // 已经出现，计算距离消失的时间
    timeUntil = (endTimeRatio - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    isAppearing = false;
  } else {
    // 已经消失，计算到下次出现的时间
    // 如果当前时间超过了结束时间，计算到下次开始时间
    if (currentTimeRatio >= endTimeRatio) {
      timeUntil = (startTimeRatio + 1 - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    } else {
      timeUntil = (startTimeRatio - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    }
    isAppearing = true;
  }
  
  // 将艾欧泽亚时间转换为本地时间（艾欧泽亚时间流逝速度是现实的20倍）
  // 1艾欧泽亚小时 = 3现实分钟
  const localTimeMinutes = timeUntil * 3; // 转换为现实分钟
  
  // 转换为mm:ss格式
  const countdownMinutes = Math.floor(localTimeMinutes);
  const countdownSeconds = Math.floor((localTimeMinutes - countdownMinutes) * 60);
  const timeStr = `${countdownMinutes.toString().padStart(2, '0')}:${countdownSeconds.toString().padStart(2, '0')}`;
  
  const text = isAppearing ? `距离出现${timeStr}` : `距离消失${timeStr}`;
  
  return {
    text,
    minutes: localTimeMinutes,
    isAppearing,
    timeUntilStart: isAppearing ? localTimeMinutes : 0,
    timeUntilEnd: isAppearing ? 0 : localTimeMinutes,
    isActive: !isAppearing && localTimeMinutes > 0
  };
}



// 更新采集物品倒计时
function updateGatheringCountdown() {
  if (!isGatheringJob(currentJob)) return;
  
  gatheringItems.forEach(item => {
    const countdown = calculateCountdown(item.startTime, item.endTime);
    item.countdown = countdown;
  });
  
  // 重新渲染采集物品列表
  renderGatheringItems();
}

// 渲染采集物品卡片
function renderGatheringItemCard(item) {
  const countdown = item.countdown || calculateCountdown(item.startTime, item.endTime);
  const isCompleted = completedItems.has(item.id);
  const completedClass = isCompleted ? 'completed' : '';
  
  let statusText = '';
  let statusClass = '';
  
  if (countdown.isAppearing) {
    statusText = countdown.text;
    statusClass = 'upcoming';
  } else if (countdown.isActive) {
    statusText = countdown.text;
    statusClass = 'active';
  } else {
    statusText = '已结束';
    statusClass = 'ended';
  }
  
  return `
    <div class="gathering-item-card ${completedClass}" data-id="${item.id}" onclick="toggleGatheringItemCompletion('${item.id}')">
      <div class="gathering-item-info">
        <img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" class="gathering-item-icon" onerror="this.src='assets/icons/items/默认图标.webp'">
        <div class="gathering-item-details">
          <div class="gathering-item-name">${item.name}</div>
          <div class="gathering-item-level">等级: ${item.level || 'N/A'}</div>
        </div>
      </div>
      <div class="gathering-item-status ${statusClass}">
        ${statusText}
      </div>
    </div>
  `;
}

// 渲染采集物品列表
function renderGatheringItems() {
  const itemsContainer = document.getElementById('itemsContainer');
  
  if (!isGatheringJob(currentJob)) {
    return; // 不是采集职业，使用原有的渲染逻辑
  }
  
  const filteredItems = filterItems();
  
  if (filteredItems.length === 0) {
    itemsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>${searchKeyword ? '未找到相关物品' : '暂无采集物品数据'}</p>
      </div>
    `;
    return;
  }
  
  // 为采集物品添加倒计时信息
  gatheringItems = filteredItems.map(item => ({
    ...item,
    countdown: calculateCountdown(item.startTime, item.endTime)
  }));
  
  // 按状态排序：进行中 -> 即将开始 -> 已结束
  gatheringItems.sort((a, b) => {
    if (a.countdown.isActive && !b.countdown.isActive) return -1;
    if (!a.countdown.isActive && b.countdown.isActive) return 1;
    if (a.countdown.isActive && b.countdown.isActive) {
      return a.countdown.minutes - b.countdown.minutes;
    }
    if (!a.countdown.isActive && !b.countdown.isActive) {
      return a.countdown.minutes - b.countdown.minutes;
    }
    return 0;
  });
  
  // 将已完成的物品移到末尾
  gatheringItems.sort((a, b) => {
    const aCompleted = completedItems.has(a.id);
    const bCompleted = completedItems.has(b.id);
    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;
    return 0;
  });
  
  let html = '';
  gatheringItems.forEach(item => {
    html += renderGatheringItemCard(item);
  });
  
  itemsContainer.innerHTML = html;
  
}

// 切换采集物品完成状态
function toggleGatheringItemCompletion(itemId) {
  if (completedItems.has(itemId)) {
    completedItems.delete(itemId);
  } else {
    completedItems.add(itemId);
  }
  
  // 重新渲染采集物品列表
  renderGatheringItems();
}

// 全局函数，供HTML调用
window.toggleGatheringItemCompletion = toggleGatheringItemCompletion;

// 启动采集倒计时定时器
function startGatheringTimer() {
  if (gatheringTimer) {
    clearInterval(gatheringTimer);
  }
  
  gatheringTimer = setInterval(() => {
    if (isGatheringJob(currentJob)) {
      updateGatheringCountdown();
    }
  }, 1000); // 每秒更新一次
}

// 停止采集倒计时定时器
function stopGatheringTimer() {
  if (gatheringTimer) {
    clearInterval(gatheringTimer);
    gatheringTimer = null;
  }
}

async function loadAllRecipesForCalc() {
  const jobs = Object.keys(JOB_JSON_MAP);
  let all = [];
  
  // 检查是否有内嵌配方数据
  if (typeof window !== 'undefined' && window.EMBEDDED_RECIPES) {
    // 使用内嵌数据
    for (const job of jobs) {
      if (window.EMBEDDED_RECIPES[job]) {
        all.push(...window.EMBEDDED_RECIPES[job].flatMap(cat => cat.recipes));
      }
    }
  } else {
    // 使用fetch加载（开发模式）
    for (const job of jobs) {
      try {
        // 判断是否为采集职业，使用不同的路径
        const isGathering = isGatheringJob(job);
        const filePath = isGathering ? `assets/gather/${job}.json` : `assets/recipe/${JOB_JSON_MAP[job]}.json`;
        
        const res = await fetch(filePath, {
          cache: 'force-cache',
          headers: {
            'Cache-Control': 'max-age=3600' // 1小时缓存
          }
        });
        if (res.ok) {
          const data = await res.json();
          // 采集职业数据结构为[{category, items:[...]}]，需转换为recipes
          if (isGathering) {
            const convertedData = data.map(cat => ({
              category: cat.category,
              recipes: cat.items.map(item => ({ ...item, job })) // 补全job字段，确保筛选通过
            }));
            all.push(...convertedData.flatMap(cat => cat.recipes));
          } else {
            all.push(...data.flatMap(cat => cat.recipes));
          }
        }
      } catch (e) {
        // 静默处理加载错误
      }
    }
  }
  ALL_RECIPES = all;
}

// 按职业加载配方
async function loadJobRecipes(job) {
  
  // 判断是否为采集职业
  const isGathering = isGatheringJob(job);
  if (job === 'all') {
    await loadAllRecipesForCalc();
  } else if (isGathering) {
    // 优先使用内嵌数据（window.EMBEDDED_RECIPES），仅在开发模式下才 fetch json 文件
    if (typeof window !== 'undefined' && window.EMBEDDED_RECIPES && window.EMBEDDED_RECIPES[job]) {
      // 详细注释：release 包下优先读取内嵌数据，保证采集职业物品列表正常显示
      ITEMS = window.EMBEDDED_RECIPES[job];
    } else {
      // 开发模式下从json文件加载
      try {
        const res = await fetch(`assets/gather/${job}.json`, {
          cache: 'force-cache',
          headers: {
            'Cache-Control': 'max-age=3600' // 1小时缓存
          }
        });
        if (res.ok) {
          ITEMS = await res.json();
        } else {
          ITEMS = [];
        }
      } catch (e) {
        ITEMS = [];
      }
    }
  } else {
    // 生产职业
    if (typeof window !== 'undefined' && window.EMBEDDED_RECIPES && window.EMBEDDED_RECIPES[job]) {
      ITEMS = window.EMBEDDED_RECIPES[job];
      // 使用内嵌数据
    } else {
      try {
        const filePath = `assets/recipe/${JOB_JSON_MAP[job]}.json`;
        const res = await fetch(filePath, {
          cache: 'force-cache',
          headers: {
            'Cache-Control': 'max-age=3600' // 1小时缓存
          }
        });
        if (res.ok) {
          ITEMS = await res.json();
        } else {
          ITEMS = [];
        }
      } catch (e) {
        ITEMS = [];
      }
    }
  }
}

// 职业切换处理
async function onJobChange(job) {
  currentJob = job;
  
  // 重新渲染职业侧边栏以更新active状态
  renderProfessionSidebar();
  
  // 清空已选物品
  selectedItems = [];
  completedItems.clear();
  completedMaterials.clear();
  completedBaseMaterials.clear();
  
  // 重新加载配方数据
  await loadJobRecipes(job);
  
  // 等待一小段时间确保数据加载完成
  setTimeout(() => {
    // 重新渲染物品列表
    renderItems();
  }, 100);
  
  // 更新已选物品显示
  updateSelectedItemsDisplay();
  
  // 处理采集职业倒计时定时器
  if (isGatheringJob(job)) {
    startGatheringTimer();
  } else {
    stopGatheringTimer();
  }
}

// 全局函数，供HTML调用
window.onJobChange = onJobChange;

// 判断是否为采集职业
function isGatheringJob(job) {
  return ['miner', 'botanist', 'fisher'].includes(job);
}

// 获取物品图标
function getItemIcon(name, fallback) {
  if (fallback) return fallback;
  
  // 尝试从assets/icons/items/目录查找图标
  const iconName = name.replace(/[^\w\u4e00-\u9fa5]/g, '') + '.webp';
  return `assets/icons/items/${iconName}`;
}

// 获取所有物品的扁平列表
function getAllItemsFlat() {
  // 全局搜索：当存在关键字时，直接使用 ALL_RECIPES 作为搜索源
  if ((searchKeyword || '').trim()) {
    return Array.isArray(ALL_RECIPES) ? ALL_RECIPES : [];
  }

  if (!ITEMS || !Array.isArray(ITEMS)) {
    return [];
  }
  
  // 非搜索场景：维持原逻辑，从当前职业的 ITEMS 提取
  const flatItems = ITEMS.flatMap(category => {
    if (isGatheringJob(currentJob)) {
      return category.items || [];
    } else {
      return category.recipes || [];
    }
  });
  return flatItems;
}

// 检查是否为收藏物品
function isFaved(itemId) {
  return favorites.includes(itemId);
}

// 全局函数，供HTML调用
window.isFaved = isFaved;

// 切换收藏状态
function toggleFav(itemId) {
  const index = favorites.indexOf(itemId);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(itemId);
  }
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

// 全局函数，供HTML调用
window.toggleFav = toggleFav;

// 过滤物品
function filterItems() {
  const allItems = getAllItemsFlat();
  let filteredItems = allItems;
  
  // 搜索过滤
  if (searchKeyword) {
    const keyword = (searchKeyword || '').trim().toLowerCase();
    filteredItems = (Array.isArray(allItems) ? allItems : []).filter(item => {
      const name = (item?.name || '').toLowerCase();
      const pinyin = (item?.pinyin || '').toLowerCase();
      return name.includes(keyword) || pinyin.includes(keyword);
    });
  }
  
  return filteredItems;
}

// 渲染物品列表
function renderItems() {
  // 采集职业且无关键字时，使用带倒计时的渲染；
  // 一旦有搜索关键字，则切换为全局搜索列表（跨职业，不显示倒计时样式）。
  if (isGatheringJob(currentJob) && !(searchKeyword && searchKeyword.trim())) {
    renderGatheringItems();
    return;
  }
  
  const itemsContainer = document.getElementById('itemsContainer');
  // 统一使用 filterItems()，其内部在有关键字时会基于 ALL_RECIPES 进行全局过滤
  const filteredItems = filterItems();
  
  if (filteredItems.length === 0) {
    itemsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <p>${searchKeyword ? '未找到相关物品' : '暂无物品数据'}</p>
      </div>
    `;
    return;
  }
  
  // 按分类分组（无关键字时使用完整分类；有关键字时仅显示包含命中条目的分类）
  const categories = {};
  filteredItems.forEach(item => {
    const cat = item.category || '未分类';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });
  
  // 渲染分类文件夹
  let html = '';
  Object.keys(categories).forEach(category => {
    const items = categories[category];
    html += `
      <div class="category-folder">
        <div class="folder-header" onclick="toggleCategory(this)">
          <span>▶ ${category}</span>
          <div class="select-all-btn" onclick="selectAllInCategory('${category}', event)">
            全选
          </div>
        </div>
        <div class="folder-content ${searchKeyword && searchKeyword.trim() ? 'expanded' : ''}">
          ${items.map(item => renderItemCard(item)).join('')}
        </div>
      </div>
    `;
  });
  
  itemsContainer.innerHTML = html;
  
  // 添加物品点击事件
  addItemClickListeners();
}

// 渲染物品卡片
function renderItemCard(item) {
  const isSelected = selectedItems.some(selected => selected.id === item.id);
  const isFavedItem = favorites.includes(item.id);
  const selectedClass = isSelected ? 'selected' : '';
  const favedClass = isFavedItem ? 'faved' : '';
  
  return `
    <div class="item-card ${selectedClass}" data-id="${item.id}">
      <div class="item-info">
        <img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" class="item-icon" onerror="this.src='assets/icons/items/默认图标.webp'">
        <div class="item-details">
          <div class="item-name">${item.name}</div>
          <div class="item-level">等级: ${item.level || 'N/A'}</div>
        </div>
      </div>
      <div class="favorite-btn ${favedClass}">
        <i class="fas fa-star"></i>
      </div>
    </div>
  `;
}

// 切换分类展开/收起
function toggleCategory(header) {
  const content = header.nextElementSibling; // 获取下一个兄弟元素，即folder-content
  const span = header.querySelector('span');
  
  if (!content || !content.classList.contains('folder-content')) {
    return;
  }
  
  const isExpanded = content.classList.contains('expanded');
  
  if (isExpanded) {
    content.classList.remove('expanded');
    span.textContent = span.textContent.replace('▼', '▶');
  } else {
    content.classList.add('expanded');
    span.textContent = span.textContent.replace('▶', '▼');
  }
}

// 全选分类下的所有物品
function selectAllInCategory(categoryName, event) {
  event.stopPropagation(); // 阻止事件冒泡
  
  // 获取该分类下的所有物品
  const allItems = getAllItemsFlat();
  const categoryItems = allItems.filter(item => item.category === categoryName);
  
  // 将分类下的所有物品添加到已选物品列表
  categoryItems.forEach(item => {
    // 检查是否已经选中
    const existingIndex = selectedItems.findIndex(selected => selected.id === item.id);
    if (existingIndex === -1) {
      // 未选中，添加到已选物品列表
      selectedItems.push({
        ...item,
        quantity: 1
      });
    }
  });
  
  // 更新显示
  updateSelectedItemsDisplay();
  
  // 重新渲染物品列表以更新选中状态
  renderItems();
  
  // 显示提示
  const message = `已添加 ${categoryItems.length} 个物品到清单`;
  showToast(message);
}

// 显示提示消息
function showToast(message) {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    pointer-events: none;
  `;
  toast.textContent = message;
  
  // 添加到页面
  document.body.appendChild(toast);
  
  // 2秒后移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 2000);
}

// 全局函数，供HTML调用
window.toggleCategory = toggleCategory;
window.selectAllInCategory = selectAllInCategory;

// 添加物品点击事件监听器
function addItemClickListeners() {
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.favorite-btn')) {
        handleItemClick(e, card.dataset.id);
      }
    });
    
    // 添加收藏按钮点击事件
    const favBtn = card.querySelector('.favorite-btn');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(e, card.dataset.id);
      });
    }
  });
}

// 处理物品点击
function handleItemClick(e, itemId) {
  e.stopPropagation();
  
  const allItems = getAllItemsFlat();
  const item = allItems.find(i => i.id === itemId);
  
  if (!item) return;
  
  // 检查是否已选中
  const existingIndex = selectedItems.findIndex(selected => selected.id === itemId);
  
  if (existingIndex > -1) {
    // 已选中，移除
    selectedItems.splice(existingIndex, 1);
    completedItems.delete(itemId);
  } else {
    // 未选中，添加
    selectedItems.push({
      ...item,
      quantity: 1
    });
  }
  
  // 更新显示
  updateSelectedItemsDisplay();
  
  // 更新物品卡片状态
  const card = document.querySelector(`[data-id="${itemId}"]`);
  if (card) {
    card.classList.toggle('selected');
  }
}

// 全局函数，供HTML调用
window.handleItemClick = handleItemClick;

// 切换收藏
function toggleFavorite(e, itemId) {
  e.stopPropagation();
  toggleFav(itemId);
  
  // 更新收藏按钮状态
  const btn = e.target.closest('.favorite-btn');
  if (btn) {
    btn.classList.toggle('faved');
  }
  
  // 如果当前只显示收藏，重新渲染列表
  if (showFavoritesOnly) {
    renderItems();
  }
}

// 全局函数，供HTML调用
window.toggleFavorite = toggleFavorite;

// 更新已选物品显示
function updateSelectedItemsDisplay() {
  const selectedItemsBtn = document.getElementById('selectedItemsBtn');
  const selectedCount = document.getElementById('selectedCount');
  const selectedItemsContent = document.getElementById('selectedItemsContent');
  
  if (selectedItems.length === 0) {
    selectedItemsBtn.style.display = 'none';
    selectedItemsContent.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>请选择要制造的物品</p>
      </div>
    `;
  } else {
    selectedItemsBtn.style.display = 'flex';
    selectedCount.textContent = selectedItems.length;
    
    selectedItemsContent.innerHTML = selectedItems.map(item => {
      const isCompleted = completedItems.has(item.id);
      const completedClass = isCompleted ? 'completed' : '';
      
      return `
        <div class="selected-item ${completedClass}" data-id="${item.id}">
          <div class="item-info">
            <img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" class="item-icon" onerror="this.src='assets/icons/items/默认图标.webp'">
            <div class="item-details">
              <div class="item-name" onclick="toggleItemCompletion('${item.id}', 'item')">${item.name}</div>
              <div class="item-level">等级: ${item.level || 'N/A'}</div>
            </div>
          </div>
          <div class="quantity-control">
            <div class="quantity-btn" onclick="changeQuantity('${item.id}', -1)">
              <img src="assets/icons/button/substrate.png" alt="减少" />
            </div>
            <div class="quantity-number">${item.quantity}</div>
            <div class="quantity-btn" onclick="changeQuantity('${item.id}', 1)">
              <img src="assets/icons/button/add.png" alt="增加" />
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// 改变物品数量
function changeQuantity(itemId, delta) {
  const item = selectedItems.find(i => i.id === itemId);
  if (item) {
    const newQuantity = item.quantity + delta;
    
    if (newQuantity <= 0) {
      // 数量减少到0或以下时，从已选物品中删除
      const index = selectedItems.findIndex(i => i.id === itemId);
      if (index > -1) {
        selectedItems.splice(index, 1);
        // 同时从完成状态中移除
        completedItems.delete(itemId);
      }
    } else {
      // 正常更新数量
      item.quantity = newQuantity;
    }
    
    updateSelectedItemsDisplay();
  }
}

// 全局函数，供HTML调用
window.changeQuantity = changeQuantity;

// 切换物品完成状态
function toggleItemCompletion(itemId, type) {
  if (type === 'item') {
    if (completedItems.has(itemId)) {
      completedItems.delete(itemId);
    } else {
      completedItems.add(itemId);
    }
  } else if (type === 'material') {
    if (completedMaterials.has(itemId)) {
      completedMaterials.delete(itemId);
    } else {
      completedMaterials.add(itemId);
    }
  } else if (type === 'baseMaterial') {
    if (completedBaseMaterials.has(itemId)) {
      completedBaseMaterials.delete(itemId);
    } else {
      completedBaseMaterials.add(itemId);
    }
  }
  
  // 执行联动计算
  performLinkedCalculation();
  
  updateSelectedItemsDisplay();
  recalculateMaterials();
}

// 联动计算：当半成品完成时，自动检查基础素材是否也需要完成
function performLinkedCalculation() {
  // 重新计算所有材料需求
  const materialMap = {};
  const baseMaterialMap = {};
  
  function addMaterial(materialId, quantity, isBase = false) {
    const targetMap = isBase ? baseMaterialMap : materialMap;
    if (!targetMap[materialId]) {
      targetMap[materialId] = { id: materialId, name: materialId, total: 0 };
    }
    targetMap[materialId].total += quantity;
  }
  
  function processRecipe(recipe, multiplier = 1) {
    if (!recipe || !Array.isArray(recipe)) return;
    
    recipe.forEach(mat => {
      if (mat && mat.id && mat.quantity) {
        const foundItem = ALL_RECIPES.find(item => item && item.id === mat.id);
        const hasRecipe = foundItem && foundItem.recipe && Array.isArray(foundItem.recipe);
        
        if (hasRecipe) {
          addMaterial(mat.id, mat.quantity * multiplier, false);
          if (!completedMaterials.has(mat.id)) {
            processRecipe(foundItem.recipe, mat.quantity * multiplier);
          }
        } else {
          addMaterial(mat.id, mat.quantity * multiplier, true);
        }
      }
    });
  }
  
  // 重新计算所有需求
  selectedItems.forEach(item => {
    if (item.recipe && !completedItems.has(item.id)) {
      processRecipe(item.recipe, item.quantity);
    }
  });
  
  // 检查基础素材是否因为半成品完成而不再需要
  Object.keys(baseMaterialMap).forEach(materialId => {
    const material = baseMaterialMap[materialId];
    if (material.total === 0) {
      // 如果某个基础素材的需求量为0，说明它已经通过半成品完成而不再需要
      // 自动标记为已完成
      completedBaseMaterials.add(materialId);
    }
  });
  
  // 检查是否有材料被错误分类，需要从completedMaterials移动到completedBaseMaterials
  const materialsToReclassify = [];
  completedMaterials.forEach(materialId => {
    const foundItem = ALL_RECIPES.find(item => item && item.id === materialId);
    const hasRecipe = foundItem && foundItem.recipe && Array.isArray(foundItem.recipe) && foundItem.recipe.length > 0;
    
    if (!hasRecipe) {
      // 这个材料实际上没有配方，应该是基础素材
      materialsToReclassify.push(materialId);
    }
  });
  
  // 重新分类材料
  materialsToReclassify.forEach(materialId => {
    completedMaterials.delete(materialId);
    completedBaseMaterials.add(materialId);
  });
}

// 全局函数，供HTML调用
window.toggleItemCompletion = toggleItemCompletion;

// 切换抽屉显示
function toggleDrawer() {
  const drawer = document.getElementById('selectedItemsDrawer');
  const backdrop = document.querySelector('.drawer-backdrop');
  drawer.classList.toggle('active');
  backdrop.classList.toggle('active');
}

// 全局函数，供HTML调用
window.toggleDrawer = toggleDrawer;

// 显示计算结果
function showCalculationResult() {
  const calculationDrawer = document.getElementById('calculationResultDrawer');
  const calculationBackdrop = document.querySelector('.calculation-backdrop');
  calculationDrawer.classList.add('active');
  calculationBackdrop.classList.add('active');
  
  // 隐藏已选物品浮窗
  const selectedDrawer = document.getElementById('selectedItemsDrawer');
  const selectedBackdrop = document.querySelector('.drawer-backdrop');
  selectedDrawer.classList.remove('active');
  selectedBackdrop.classList.remove('active');
  
  // 计算材料
  recalculateMaterials();
}

// 全局函数，供HTML调用
window.showCalculationResult = showCalculationResult;

// 隐藏计算结果
function hideCalculationResult() {
  const calculationDrawer = document.getElementById('calculationResultDrawer');
  const calculationBackdrop = document.querySelector('.calculation-backdrop');
  calculationDrawer.classList.remove('active');
  calculationBackdrop.classList.remove('active');
}

// 全局函数，供HTML调用
window.hideCalculationResult = hideCalculationResult;

// 重新计算材料
function recalculateMaterials() {
  const calculationContent = document.getElementById('calculationContent');
  
  if (selectedItems.length === 0) {
    calculationContent.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calculator"></i>
        <p>请选择物品后再计算</p>
      </div>
    `;
    return;
  }
  
  // 汇总所有素材（包含多级依赖）
  const materialMap = {};
  const baseMaterialMap = {};
  
  function addMaterial(materialId, quantity, isBase = false) {
    try {
      const targetMap = isBase ? baseMaterialMap : materialMap;
      
      if (!materialId || typeof materialId !== 'string') {
        return;
      }
      
      if (!quantity || typeof quantity !== 'number') {
        return;
      }
      
      if (!targetMap[materialId]) {
        // 尝试在配方中查找该材料
        let item = null;
        try {
          const allItems = getAllItemsFlat();
          if (Array.isArray(allItems)) {
            item = allItems.find(i => i && i.id === materialId);
          }
        } catch (e) {
          item = null;
        }
        
        if (item) {
          targetMap[materialId] = { 
            id: item.id,
            name: item.name || materialId, 
            icon: item.icon || getItemIcon(item.name || materialId),
            total: 0 
          };
        } else {
          // 基础材料
          targetMap[materialId] = { 
            id: materialId,
            name: materialId, 
            icon: getItemIcon(materialId),
            total: 0 
          };
        }
      }
      
      if (targetMap[materialId]) {
        // 检查材料是否已完成
        let isCompleted = false;
        if (isBase) {
          isCompleted = completedBaseMaterials.has(materialId);
        } else {
          isCompleted = completedMaterials.has(materialId);
        }
        
        if (isCompleted) {
          // 如果材料已完成，将需求设为0，但仍然显示
          targetMap[materialId].total = 0;
        } else {
          // 正常添加需求
          targetMap[materialId].total += quantity;
        }
      }
    } catch (error) {
      // 静默处理错误
    }
  }
  
  function processRecipe(recipe, multiplier = 1) {
    if (!recipe || !Array.isArray(recipe) || recipe.length === 0) {
      return;
    }
    
    for (let i = 0; i < recipe.length; i++) {
      try {
        const mat = recipe[i];
        
        // 安全检查材料对象
        if (!mat || typeof mat !== 'object') {
          continue;
        }
        
        if (!mat.id || typeof mat.id !== 'string') {
          continue;
        }
        
        if (!mat.quantity || typeof mat.quantity !== 'number') {
          continue;
        }
        
        // 检查是否为半成品（有配方）
        let foundItem = null;
        try {
          // 在所有职业的配方中查找该材料
          foundItem = ALL_RECIPES.find(item => item && item.id === mat.id);
        } catch (e) {
          foundItem = null;
        }
        
        const hasRecipe = foundItem && foundItem.recipe && Array.isArray(foundItem.recipe) && foundItem.recipe.length > 0;
        
        if (hasRecipe) {
          // 半成品，加入半成品材料统计（无论是否完成都要显示）
          addMaterial(mat.id, mat.quantity * multiplier, false);
          // 如果半成品未完成，才处理其配方
          if (!completedMaterials.has(mat.id)) {
            processRecipe(foundItem.recipe, mat.quantity * multiplier);
          } else {
            // 跳过已完成的半成品配方，但仍然需要确保基础材料在列表中
          }
        } else {
          // 基础材料，加入基础材料统计（无论是否完成都要显示）
          addMaterial(mat.id, mat.quantity * multiplier, true);
        }
      } catch (error) {
        // 继续处理下一个材料
        continue;
      }
    }
  }
  
  // 处理所有选中物品（排除已完成的物品）
  selectedItems.forEach(item => {
    if (item.recipe && !completedItems.has(item.id)) {
      processRecipe(item.recipe, item.quantity);
    }
  });
  
  // 确保所有已完成的材料也在列表中显示
  completedMaterials.forEach(materialId => {
    if (!materialMap[materialId]) {
      addMaterial(materialId, 0, false);
    }
  });
  
  completedBaseMaterials.forEach(materialId => {
    if (!baseMaterialMap[materialId]) {
      addMaterial(materialId, 0, true);
    }
  });
  

  
  // 渲染计算结果
  const level2Mats = Object.values(materialMap); // 显示所有半成品，包括已完成的
  const level1Mats = Object.values(baseMaterialMap); // 显示所有基础素材，包括已完成的
  
  // 确保已完成的材料也显示，即使需求量为0
  const allLevel2Mats = level2Mats.filter(mat => mat.total > 0 || completedMaterials.has(mat.id));
  const allLevel1Mats = level1Mats.filter(mat => mat.total > 0 || completedBaseMaterials.has(mat.id));
  
  let html = `
    <div class="overview-card">
      <div class="overview-title">材料清单总览</div>
      <div class="overview-stat">
        <div>总计物品：${selectedItems.length}个</div>
        <div>所需素材：${allLevel2Mats.length + allLevel1Mats.length}种</div>
      </div>
    </div>
  `;
  
  // 渲染半成品
  if (allLevel2Mats.length > 0) {
    // 分离已完成和未完成的材料
    const uncompletedMats = allLevel2Mats.filter(mat => !completedMaterials.has(mat.id));
    const completedMats = allLevel2Mats.filter(mat => completedMaterials.has(mat.id));
    
    // 未完成的排在前面，已完成的排在后面
    const sortedLevel2Mats = [...uncompletedMats, ...completedMats];
    
    html += `
      <div class="material-category">
        <div class="category-title">半成品</div>
        <div class="material-list">
          ${sortedLevel2Mats.map(mat => {
            const isCompleted = completedMaterials.has(mat.id);
            const completedClass = isCompleted ? 'completed' : '';
            return `
              <div class="material-item ${completedClass}" onclick="toggleItemCompletion('${mat.id}', 'material')">
                <div class="material-info">
                  <img src="${getItemIcon(mat.name, mat.icon)}" alt="${mat.name}" class="material-icon" onerror="this.src='assets/icons/items/默认图标.webp'">
                  <div class="material-name">${mat.name}</div>
                </div>
                <div class="material-count">需求: ${mat.total}个</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // 渲染基础材料
  if (allLevel1Mats.length > 0) {
    // 碎晶类材料ID
    const crystalIds = [
      '风之碎晶', '冰之碎晶', '雷之碎晶', '土之碎晶', '水之碎晶', '火之碎晶',
      'wind_crystal', 'ice_crystal', 'lightning_crystal', 'earth_crystal', 'water_crystal', 'fire_crystal'
    ];
    
    // 先分组
    const normalMats = allLevel1Mats.filter(mat => !crystalIds.includes(mat.id) && !crystalIds.includes(mat.name));
    const crystalMats = allLevel1Mats.filter(mat => crystalIds.includes(mat.id) || crystalIds.includes(mat.name));
    
    // 合并，碎晶类排最后
    const allMats = [...normalMats, ...crystalMats];
    
    // 分离已完成和未完成的材料
    const uncompletedMats = allMats.filter(mat => !completedBaseMaterials.has(mat.id));
    const completedMats = allMats.filter(mat => completedBaseMaterials.has(mat.id));
    
    // 未完成的排在前面，已完成的排在后面
    const sortedLevel1Mats = [...uncompletedMats, ...completedMats];
    
    html += `
      <div class="material-category">
        <div class="category-title">基础素材</div>
        <div class="material-list">
          ${sortedLevel1Mats.map(mat => {
            const isCompleted = completedBaseMaterials.has(mat.id);
            const completedClass = isCompleted ? 'completed' : '';
            return `
              <div class="material-item ${completedClass}" onclick="toggleItemCompletion('${mat.id}', 'baseMaterial')">
                <div class="material-info">
                  <img src="${getItemIcon(mat.name, mat.icon)}" alt="${mat.name}" class="material-icon" onerror="this.src='assets/icons/items/默认图标.webp'">
                  <div class="material-name">${mat.name}</div>
                </div>
                <div class="material-count">需求: ${mat.total}个</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  if (allLevel2Mats.length === 0 && allLevel1Mats.length === 0) {
    html += `
      <div class="empty-state">
        <i class="fas fa-boxes"></i>
        <p>无需额外材料</p>
      </div>
    `;
  }
  
  calculationContent.innerHTML = html;
}

// 复制材料清单
function copyMaterials() {
  const materialsText = generateMaterialsText();
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(materialsText).then(() => {
      showToast('材料清单已复制到剪贴板');
    }).catch(() => {
      // 降级方案
      copyToClipboardFallback(materialsText);
    });
  } else {
    // 降级方案
    copyToClipboardFallback(materialsText);
  }
}

// 降级复制方案
function copyToClipboardFallback(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('材料清单已复制到剪贴板');
    } else {
      showToast('复制失败，请手动复制');
    }
  } catch (err) {
    showToast('复制失败，请手动复制');
  }
  
  document.body.removeChild(textArea);
}

// 全局函数，供HTML调用
window.copyMaterials = copyMaterials;

// 生成材料文本
function generateMaterialsText() {
  if (selectedItems.length === 0) {
    return '请先选择物品';
  }
  
  let text = '';
  
  // 重新计算材料
  const materialMap = {};
  const baseMaterialMap = {};
  
  function addMaterial(materialId, quantity, isBase = false) {
    const targetMap = isBase ? baseMaterialMap : materialMap;
    if (!targetMap[materialId]) {
      targetMap[materialId] = { name: materialId, total: 0 };
    }
    targetMap[materialId].total += quantity;
  }
  
  function processRecipe(recipe, multiplier = 1) {
    if (!recipe || !Array.isArray(recipe)) return;
    
    recipe.forEach(mat => {
      if (mat && mat.id && mat.quantity) {
        // 检查是否为半成品（有配方）
        const foundItem = ALL_RECIPES.find(item => item && item.id === mat.id);
        const hasRecipe = foundItem && foundItem.recipe && Array.isArray(foundItem.recipe) && foundItem.recipe.length > 0;
        
        if (hasRecipe) {
          addMaterial(mat.id, mat.quantity * multiplier, false);
          if (!completedMaterials.has(mat.id)) {
            processRecipe(foundItem.recipe, mat.quantity * multiplier);
          }
        } else {
          addMaterial(mat.id, mat.quantity * multiplier, true);
        }
      }
    });
  }
  
  selectedItems.forEach(item => {
    if (item.recipe && !completedItems.has(item.id)) {
      processRecipe(item.recipe, item.quantity);
    }
  });
  
  const level2Mats = Object.values(materialMap).filter(mat => mat.total > 0);
  const level1Mats = Object.values(baseMaterialMap).filter(mat => mat.total > 0);
  
  if (level2Mats.length > 0) {
    text += '半成品：\n';
    level2Mats.forEach(mat => {
      text += `${mat.name} × ${mat.total}\n`;
    });
    text += '\n';
  }
  
  if (level1Mats.length > 0) {
    text += '基础素材：\n';
    level1Mats.forEach(mat => {
      text += `${mat.name} × ${mat.total}\n`;
    });
  }
  
  return text;
}

// 截图功能
function screenshotMaterials() {
  const calculationContent = document.getElementById('calculationContent');
  if (!calculationContent) {
    showToast('无法找到计算结果内容');
    return;
  }
  
  // 检查是否有内容
  if (calculationContent.querySelector('.empty-state')) {
    showToast('请先选择物品并计算材料');
    return;
  }
  
  // 创建截图容器
  const screenshotContainer = document.createElement('div');
  screenshotContainer.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 375px;
    background: white;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #333;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  `;
  
  // 复制计算结果内容
  const contentClone = calculationContent.cloneNode(true);
  // 为截图微调样式：缩小图标、拉开区块间距
  contentClone.querySelectorAll('.material-icon').forEach(img => {
    img.style.width = '32px';
    img.style.height = '32px';
  });
  contentClone.querySelectorAll('.overview-card').forEach(el => {
    el.style.marginBottom = '12px';
  });
  contentClone.querySelectorAll('.material-category').forEach(el => {
    el.style.marginTop = '8px';
    el.style.marginBottom = '12px';
  });
  contentClone.querySelectorAll('.material-item').forEach(el => {
    el.style.padding = '12px';
  });
  screenshotContainer.appendChild(contentClone);
  document.body.appendChild(screenshotContainer);
  
  // 使用html2canvas生成图片
  if (typeof html2canvas !== 'undefined') {
    html2canvas(screenshotContainer, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: 375,
      height: screenshotContainer.scrollHeight
    }).then(canvas => {
      // 转换为图片并下载
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 文件名：QQ14 材料清单 mm:dd
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        a.download = `QQ14 材料清单 ${mm}-${dd}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('截图已保存到相册');
      }, 'image/png');
    }).catch(error => {
      showToast('截图生成失败，请重试');
    }).finally(() => {
      document.body.removeChild(screenshotContainer);
    });
  } else {
    // 如果没有html2canvas，提示用户
    showToast('截图功能需要加载额外库，请稍后重试');
    document.body.removeChild(screenshotContainer);
  }
}

// 清空所有已选物品
function clearAllSelectedItems() {
  if (selectedItems.length === 0) {
    showToast('没有已选物品');
    return;
  }
  
  if (confirm('确定要清空所有已选物品吗？')) {
    selectedItems = [];
    completedItems.clear();
    completedMaterials.clear();
    completedBaseMaterials.clear();
    
    // 更新显示
    updateSelectedItemsDisplay();
    renderItems();
    
    showToast('已清空所有已选物品');
  }
}

// 全局函数，供HTML调用
window.clearAllSelectedItems = clearAllSelectedItems;
window.screenshotMaterials = screenshotMaterials;

// 搜索功能
function setupSearch() {
  const searchInput = document.getElementById('itemSearch');
  searchInput.addEventListener('input', (e) => {
    searchKeyword = e.target.value;
    // 移动端也做全局搜索：不受当前职业限制
    renderItems();
  });
}

// 渲染职业侧边栏
function renderProfessionSidebar() {
  const sidebar = document.getElementById('professionSidebar');
  sidebar.innerHTML = JOBS.map((job, index) => {
    const isActive = job.key === currentJob;
    return `
      <div class="profession-item ${isActive ? 'active' : ''}" data-job="${job.key}" onclick="onJobChange('${job.key}')" title="${job.name}">
        <img src="${job.icon}" alt="${job.name}" class="profession-icon" onerror="this.src='assets/icons/jobs/001.webp'">
      </div>
    `;
  }).join('');
}

// 主题管理
class MobileThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('mobile-theme') || 'light';
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.setupThemeToggle();
  }

  getStoredTheme() {
    return localStorage.getItem('mobile-theme') || 'light';
  }

  setStoredTheme(theme) {
    localStorage.setItem('mobile-theme', theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    this.setStoredTheme(theme);
    this.updateThemeIcon();
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  updateThemeIcon() {
    const themeToggle = document.getElementById('mobileThemeToggle');
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
      }
    }
  }

  setupThemeToggle() {
    const themeToggle = document.getElementById('mobileThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        // 添加动画效果
        const icon = themeToggle.querySelector('i');
        if (icon) {
          icon.classList.add('mobile-theme-transition');
          setTimeout(() => {
            icon.classList.remove('mobile-theme-transition');
          }, 400);
        }
        this.toggleTheme();
      });
    }
  }
}

// 设备切换功能
function switchToDesktop() {
  // 清除强制移动端标记
  localStorage.removeItem('force-mobile');
  // 设置强制桌面端标记
  localStorage.setItem('force-desktop', 'true');
  // 跳转到桌面端页面
  window.location.href = 'index.html';
}

// 初始化设备切换按钮
function initMobileDeviceToggle() {
  const deviceToggle = document.getElementById('mobileDeviceToggle');
  if (deviceToggle) {
    deviceToggle.addEventListener('click', switchToDesktop);
  }
}

// 初始化应用
async function initApp() {
  // 初始化主题管理器
  window.mobileThemeManager = new MobileThemeManager();
  
  // 初始化设备切换按钮
  initMobileDeviceToggle();
  
  // 渲染职业侧边栏
  renderProfessionSidebar();
  
  // 设置搜索功能
  setupSearch();
  
  // 加载收藏数据
  favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  
  // 先加载所有职业的配方数据，用于判断半成品
  await loadAllRecipesForCalc();
  
  // 加载默认职业数据
  await onJobChange('quickcalc');
  
  // 如果默认职业是采集职业，启动倒计时定时器
  if (isGatheringJob(currentJob)) {
    startGatheringTimer();
  }
  
  // 页面卸载时清理定时器
  window.addEventListener('beforeunload', () => {
    stopGatheringTimer();
  });

  // 初始化移动端天气面板
  initMobileWeather();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp); 

// ===================== 移动端天气预报（浮窗） =====================
let mobileWeatherTick = null;
function initMobileWeather() {
  const toggleBtn = document.getElementById('mobileWeatherToggle');
  const panel = document.getElementById('mobileWeatherPanel');
  const closeBtn = document.getElementById('mobileWeatherClose');
  const zoneSelect = document.getElementById('mobileWeatherZoneSelect');
  const listEl = document.getElementById('mobileWeatherList');
  const timeToggle = document.getElementById('mobileWeatherTimeToggle');
  const iconsGrid = document.getElementById('mobileWeatherIcons');
  if (!toggleBtn || !panel || !closeBtn || !zoneSelect || !listEl || !timeToggle || !iconsGrid) return;

  // 打开/关闭
  toggleBtn.addEventListener('click', () => {
    panel.classList.add('active');
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
    populateMobileZones(zoneSelect);
    refreshMobileWeather();
    startMobileWeatherTick();
    // 将焦点移入面板
    setTimeout(() => {
      const focusTarget = panel.querySelector('#mobileWeatherTimeToggle') || panel;
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }, 0);
  });
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
    stopMobileWeatherTick();
    // 将焦点返回到触发按钮
    if (toggleBtn && typeof toggleBtn.focus === 'function') toggleBtn.focus();
  });

  // ET/LT 切换（默认LT）
  let timeMode = 'LT';
  timeToggle.addEventListener('click', () => {
    timeMode = timeMode === 'ET' ? 'LT' : 'ET';
    timeToggle.innerText = timeMode;
    refreshMobileWeather();
  });
  timeToggle.innerText = timeMode;

  // 地区切换：清除筛选
  zoneSelect.addEventListener('change', () => {
    mobileWeatherFilter = null;
    refreshMobileWeather();
  });

  // 存储状态
  let lastRefresh = 0;
  function throttledRefresh() {
    const now = Date.now();
    if (now - lastRefresh > 500) {
      lastRefresh = now;
      if (panel.classList.contains('active')) refreshMobileWeather();
    }
  }

  // 渲染
  function refreshMobileWeather() {
    const zone = zoneSelect.value || 'gridania';
    let forecasts;
    if (mobileWeatherFilter) {
      if (!mobileZoneHasWeather(zone, mobileWeatherFilter)) {
        listEl.innerHTML = `<div class="empty-state"><i class=\"fas fa-info-circle\"></i><p>该地区不会出现“${M_WEATHER_NAME_CN[mobileWeatherFilter] || mobileWeatherFilter}”。</p></div>`;
        renderMobileIcons();
        return;
      }
      forecasts = mobileGetNextMatchingForecasts(zone, mobileWeatherFilter, 8);
    } else {
      forecasts = mobileGetForecasts(zone, 8);
    }
    listEl.innerHTML = forecasts.map((f, idx) => {
      const icon = mobileGetWeatherIconPath(f.name);
      const timeText = timeMode === 'ET' ? `ET ${f.intervalLabel.slice(3)}` : `LT ${mobileFormatLT(f.intervalStart)}`;
      const countdownHtml = idx === 0 ? mobileBuildCountdownHtml(f) : '';
      return `
      <div class="m-weather-item">
        <div class="m-weather-left">
          <span class="m-weather-time-badge">${timeText}</span>
          <img class="m-weather-icon" src="${icon}" alt="${M_WEATHER_NAME_CN[f.name] || f.name}">
          <span class="m-weather-name">${M_WEATHER_NAME_CN[f.name] || f.name}</span>
        </div>
        ${countdownHtml}
      </div>`;
    }).join('');
    renderMobileIcons();
  }

  function startMobileWeatherTick() {
    stopMobileWeatherTick();
    mobileWeatherTick = setInterval(throttledRefresh, 1000);
  }
  function stopMobileWeatherTick() {
    if (mobileWeatherTick) clearInterval(mobileWeatherTick);
    mobileWeatherTick = null;
  }

  // 天气类型图标
  let mobileWeatherFilter = null;
  function renderMobileIcons() {
    const zone = zoneSelect.value || 'gridania';
    const ordered = ['clearSkies','fairSkies','clouds','fog','rain','showers','wind','gales','thunder','thunderstorms','snow','blizzard','gloom','heatWaves','dustStorms'];
    iconsGrid.innerHTML = ordered.map(key => {
      const cn = M_WEATHER_NAME_CN[key] || key;
      const icon = mobileGetWeatherIconPath(key);
      const canAppear = mobileZoneHasWeather(zone, key);
      const disabled = canAppear ? '' : ' disabled';
      const active = mobileWeatherFilter === key ? ' style="outline:2px solid var(--color-secondary);"' : '';
      return `<button class="m-weather-icon-btn${disabled}" data-weather="${key}" aria-label="${cn}" data-tooltip="${cn}"${active}><img src="${icon}" alt="${cn}"></button>`;
    }).join('');
    iconsGrid.querySelectorAll('.m-weather-icon-btn').forEach(btn => {
      if (btn.classList.contains('disabled')) return;
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-weather');
        mobileWeatherFilter = (mobileWeatherFilter === key) ? null : key;
        refreshMobileWeather();
      });
    });
  }

  // 暴露给内部使用
  function populateMobileZones(selectEl) {
    if (selectEl.options.length > 0) return;
    // 使用与桌面端一致的分组
    const groups = M_WEATHER_ZONE_GROUPS;
    let firstValue = '';
    groups.forEach(group => {
      const keys = group.keys.filter(k => M_WEATHER_DATA[k]);
      if (keys.length === 0) return;
      const og = document.createElement('optgroup');
      og.label = group.label;
      keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = M_WEATHER_LABELS[key] || key;
        og.appendChild(opt);
        if (!firstValue) firstValue = key;
      });
      selectEl.appendChild(og);
    });
    if (firstValue) selectEl.value = firstValue;
  }

  // 工具/算法
  function mobileGetForecasts(zoneKey, intervals = 8) {
    const result = [];
    let t = mobileNearestIntervalStart(Date.now());
    for (let i = 0; i < intervals; i++) {
      const label = mobileNearestEorzeaIntervalLabel(t);
      const val = mobileCalculateWeatherValue(t);
      const weather = mobilePickWeatherByValue(zoneKey, val);
      result.push({ intervalLabel: `ET ${label.slice(0,5)}`, intervalStart: t, name: weather.name });
      t += M_EORZEA_8_HOUR_MS;
    }
    return result;
  }

  function mobileGetNextMatchingForecasts(zoneKey, weatherKey, count = 8) {
    const out = [];
    let t = mobileNearestIntervalStart(Date.now());
    let guard = 0;
    const MAX = 2000;
    while (out.length < count && guard < MAX) {
      const label = mobileNearestEorzeaIntervalLabel(t);
      const val = mobileCalculateWeatherValue(t);
      const weather = mobilePickWeatherByValue(zoneKey, val);
      if (weather.name === weatherKey) {
        out.push({ intervalLabel: `ET ${label.slice(0,5)}`, intervalStart: t, name: weather.name });
      }
      t += M_EORZEA_8_HOUR_MS;
      guard++;
    }
    return out.slice(0, count);
  }

  function mobileGetWeatherIconPath(weatherKey) {
    const name = M_WEATHER_NAME_CN[weatherKey] || '';
    if (!name) return 'assets/icons/weather/晴朗.png';
    return `assets/icons/weather/${name}.png`;
  }

  function mobileFormatLT(realUnixMs) {
    const d = new Date(realUnixMs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function mobileBuildCountdownHtml(forecast) {
    const info = mobileGetCountdownInfo(forecast);
    const cls = info.isAppearing ? 'm-countdown pending' : 'm-countdown active';
    const style = `style="--progress: ${info.progress}%"`;
    const text = mobileGetCountdownText(forecast);
    return `<div class="${cls}" ${style}><div class="m-progress"></div><span class="m-count-text">${text}</span></div>`;
  }

  function mobileGetCountdownText(forecast) {
    const now = Date.now();
    const start = forecast.intervalStart;
    const end = start + M_EORZEA_8_HOUR_MS;
    const toStart = start - now;
    const toEnd = end - now;
    if (toStart > 0) return `距离天气变化 ${mobileFormatMs(Math.max(0, toStart))}`;
    if (toEnd > 0) return `距离天气变化 ${mobileFormatMs(Math.max(0, toEnd))}`;
    return '即将更新';
  }

  function mobileGetCountdownInfo(forecast) {
    const now = Date.now();
    const start = forecast.intervalStart;
    const end = start + M_EORZEA_8_HOUR_MS;
    const isAppearing = start - now > 0;
    const total = M_EORZEA_8_HOUR_MS;
    const remaining = Math.max(0, isAppearing ? (start - now) : (end - now));
    const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
    return { isAppearing, progress };
  }

  function mobileFormatMs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  // 天气算法与数据
  const M_EORZEA_HOUR_MS = 175000;
  const M_EORZEA_8_HOUR_MS = 8 * M_EORZEA_HOUR_MS;
  const M_EORZEA_DAY_MS = 24 * M_EORZEA_HOUR_MS;

  function mobileCalculateWeatherValue(unixMs) {
    const ms = Math.floor(unixMs);
    const bell = Math.floor(ms / M_EORZEA_HOUR_MS) % 24;
    const increment = (bell + 8 - (bell % 8)) % 24;
    const totalDays = Math.floor(ms / M_EORZEA_DAY_MS);
    const calcBase = totalDays * 100 + increment;
    const step1 = ((calcBase << 11) ^ calcBase) >>> 0;
    const step2 = ((step1 >>> 8) ^ step1) >>> 0;
    return step2 % 100;
  }

  function mobileNearestIntervalStart(unixMs) {
    const bell = Math.floor(unixMs / M_EORZEA_HOUR_MS);
    const alignedBell = bell - (bell % 8);
    return alignedBell * M_EORZEA_HOUR_MS;
  }
  function mobileNearestEorzeaIntervalLabel(unixMs) {
    const bell = Math.floor(unixMs / M_EORZEA_HOUR_MS) % 24;
    const h = (bell - (bell % 8) + 24) % 24;
    return `${String(h).padStart(2, '0')}:00`;
  }

  function mobilePickWeatherByValue(zoneKey, value) {
    const table = M_WEATHER_DATA[zoneKey] || [];
    let cursor = 0;
    for (let i = 0; i < table.length; i++) {
      cursor += table[i].chance;
      if (value < cursor) return table[i];
    }
    return table[table.length - 1] || { name: 'clearSkies', chance: 100 };
  }

  function mobileZoneHasWeather(zoneKey, weatherKey) {
    const table = M_WEATHER_DATA[zoneKey] || [];
    return table.some(w => w.name === weatherKey);
  }
}

// 与桌面端一致的区域/中文映射与权重（裁剪自桌面端）
const M_WEATHER_DATA = {
  uldah: [ { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 25 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 } ],
  westernThanalan: [ { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 25 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 } ],
  centralThanalan: [ { name: 'dustStorms', chance: 15 }, { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 } ],
  easternThanalan: [ { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }, { name: 'showers', chance: 15 } ],
  southernThanalan: [ { name: 'heatWaves', chance: 20 }, { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 } ],
  northernThanalan: [ { name: 'clearSkies', chance: 5 }, { name: 'fairSkies', chance: 15 }, { name: 'clouds', chance: 30 }, { name: 'fog', chance: 50 } ],
  gridania: [ { name: 'rain', chance: 20 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 } ],
  centralShroud: [ { name: 'thunder', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 } ],
  eastShroud: [ { name: 'thunder', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 } ],
  southShroud: [ { name: 'fog', chance: 5 }, { name: 'thunderstorms', chance: 5 }, { name: 'thunder', chance: 15 }, { name: 'fog', chance: 5 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 30 }, { name: 'clearSkies', chance: 30 } ],
  northShroud: [ { name: 'fog', chance: 5 }, { name: 'showers', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 5 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 30 }, { name: 'clearSkies', chance: 30 } ],
  limsaLominsa: [ { name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 30 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 } ],
  middleLaNoscea: [ { name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 } ],
  lowerLaNoscea: [ { name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 } ],
  easternLaNoscea: [ { name: 'fog', chance: 5 }, { name: 'clearSkies', chance: 45 }, { name: 'fairSkies', chance: 30 }, { name: 'clouds', chance: 10 }, { name: 'rain', chance: 5 }, { name: 'showers', chance: 5 } ],
  westernLaNoscea: [ { name: 'fog', chance: 10 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'gales', chance: 10 } ],
  upperLaNoscea: [ { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'fog', chance: 10 }, { name: 'thunder', chance: 10 }, { name: 'thunderstorms', chance: 10 } ],
  outerLaNoscea: [ { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'fog', chance: 15 }, { name: 'rain', chance: 15 } ],
  coerthasCentralHighlands: [ { name: 'blizzard', chance: 20 }, { name: 'snow', chance: 40 }, { name: 'fairSkies', chance: 10 }, { name: 'clearSkies', chance: 5 }, { name: 'clouds', chance: 15 }, { name: 'fog', chance: 10 } ],
  morDhona: [ { name: 'clouds', chance: 15 }, { name: 'fog', chance: 15 }, { name: 'gloom', chance: 30 }, { name: 'clearSkies', chance: 15 }, { name: 'fairSkies', chance: 25 } ]
};

const M_WEATHER_LABELS = {
  uldah: '乌尔达哈',
  westernThanalan: '西萨纳兰',
  centralThanalan: '中萨纳兰',
  easternThanalan: '东萨纳兰',
  southernThanalan: '南萨纳兰',
  northernThanalan: '北萨纳兰',
  gridania: '格里达尼亚',
  centralShroud: '黑衣森林中央林区',
  eastShroud: '黑衣森林东部林区',
  southShroud: '黑衣森林南部林区',
  northShroud: '黑衣森林北部林区',
  limsaLominsa: '利姆萨·罗敏萨',
  middleLaNoscea: '中拉诺西亚',
  lowerLaNoscea: '拉诺西亚低地',
  easternLaNoscea: '东拉诺西亚',
  westernLaNoscea: '西拉诺西亚',
  upperLaNoscea: '拉诺西亚高地',
  outerLaNoscea: '拉诺西亚外地',
  coerthasCentralHighlands: '库尔札斯中央高地',
  morDhona: '摩杜纳'
};

const M_WEATHER_ZONE_GROUPS = [
  { label: '乌尔达哈', keys: ['uldah','westernThanalan','centralThanalan','easternThanalan','southernThanalan','northernThanalan'] },
  { label: '格里达尼亚', keys: ['gridania','centralShroud','eastShroud','southShroud','northShroud'] },
  { label: '利姆萨·罗敏萨', keys: ['limsaLominsa','middleLaNoscea','lowerLaNoscea','easternLaNoscea','westernLaNoscea','upperLaNoscea','outerLaNoscea'] },
  { label: '伊修加德', keys: ['coerthasCentralHighlands'] },
  { label: '其他', keys: ['morDhona'] },
];

const M_WEATHER_NAME_CN = {
  clearSkies: '碧空', fairSkies: '晴朗', clouds: '阴云', fog: '薄雾', rain: '小雨', showers: '暴雨',
  wind: '微风', gales: '强风', thunder: '打雷', thunderstorms: '雷雨', snow: '小雪', blizzard: '暴雪', gloom: '妖雾', heatWaves: '热浪', dustStorms: '扬沙'
};