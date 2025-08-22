// FF14生产职业计算器 - 交互逻辑
// 作者：AI助手
// 说明：本文件为演示用，数据为内置示例，后续可替换为真实数据或JSON文件

// ===================== 示例数据 =====================
// 职业列表
const JOBS = [
  { key: 'quickcalc', name: '快捷计算', icon: 'assets/icons/jobs/32px-职业图标_能工巧匠.webp' },
  { key: 'carpenter', name: '刻木匠' },
  { key: 'blacksmith', name: '锻铁匠' },
  { key: 'armorer', name: '铸甲匠' },
  { key: 'goldsmith', name: '雕金匠' },
  { key: 'leatherworker', name: '制革匠' },
  { key: 'weaver', name: '裁衣匠' },
  { key: 'alchemist', name: '炼金术士' },
  { key: 'culinarian', name: '烹调师' },
  { key: 'miner', name: '采矿工' },
  { key: 'botanist', name: '园艺工' }
  // 捕鱼人职业暂未使用，已隐藏
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
  // 捕鱼人职业暂未使用，已隐藏
};

// 当前配方数据
let ITEMS = [];

// 完成状态管理
let completedItems = new Set(); // 已完成的物品ID集合
let completedMaterials = new Set(); // 已完成的半成品ID集合
let completedBaseMaterials = new Set(); // 已完成的基础材料ID集合

// ========== 全职业配方全量数据，支持跨职业半成品递归 ========== //
let ALL_RECIPES = [];
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
          cache: 'force-cache', // 使用缓存
          headers: {
            'Cache-Control': 'max-age=3600' // 缓存1小时
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
        console.warn(`Failed to load recipes for ${job}:`, e);
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
      // 兼容开发模式，fetch 本地 json 文件
      const gatherFile = `assets/gather/${job}.json`;
      try {
        const res = await fetch(gatherFile, {
          cache: 'force-cache', // 使用缓存
          headers: {
            'Cache-Control': 'max-age=3600' // 缓存1小时
          }
        });
        if (!res.ok) throw new Error('采集职业文件加载失败');
        // 采集职业json为[{category, items:[...]}]，需转为[{category, recipes:[...]}]
        const gatherData = await res.json();
        ITEMS = gatherData.map(cat => ({
          category: cat.category,
          recipes: cat.items.map(item => ({ ...item, job })) // 补全job字段，确保筛选通过
        }));
      } catch (e) {
        console.warn(`Failed to load gather data for ${job}:`, e);
        ITEMS = [];
      }
    }
  } else {
    // 生产职业
    if (typeof window !== 'undefined' && window.EMBEDDED_RECIPES) {
      ITEMS = window.EMBEDDED_RECIPES[job] || [];
    } else {
      const file = `assets/recipe/${JOB_JSON_MAP[job]}.json`;
      try {
        const res = await fetch(file, {
          cache: 'force-cache', // 使用缓存
          headers: {
            'Cache-Control': 'max-age=3600' // 缓存1小时
          }
        });
        if (!res.ok) throw new Error('配方文件加载失败');
        ITEMS = await res.json();
      } catch (e) {
        console.warn(`Failed to load recipes for ${job}:`, e);
        ITEMS = [];
      }
    }
  }
  // 切换职业时重置分类展开状态为全部折叠
  categoryExpandState = {};
  // 重新渲染物品选择区、已选物品、计算结果等
  renderItemSelection();
  materialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>点击计算按钮查看半成品</p></div>';
  baseMaterialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>点击计算按钮查看基础材料</p></div>';
}

// 职业切换时自动加载配方
async function onJobChange(job) {
  await loadJobRecipes(job);
  // 切换采集职业模式
  toggleGatheringMode(job);
  // 如果是采集职业，确保倒计时定时器运行，并检查通知权限
  if (isGatheringJob(job)) {
    renderGatherAlarms();
  }
  // 其他职业切换逻辑...
  toggleExportBtnByJob(job);
}

// 页面初始化时加载全职业配方
window.addEventListener('DOMContentLoaded', async () => {
  // 检查DOM元素是否正确获取
  await loadAllRecipesForCalc(); // 先加载全量配方
  
  // 通知功能已禁用
  
  const defaultJob = 'quickcalc'; // 改为默认选择快捷计算
  currentJob = defaultJob;
  
  await onJobChange(defaultJob);
  
  document.querySelectorAll('.job-tab').forEach(btn => {
    if (btn.dataset.job === defaultJob) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  toggleExportBtnByJob(currentJob);
  
  // 渲染闹钟列表
  renderGatherAlarms();
  // 启动倒计时更新定时器
  startCountdownTimer();
  
  // 绑定导出Excel按钮事件
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn) {
    // 使用新的绑定机制
    bindExportExcelEvent();
  } else {
  }
});

// ===================== 物品与配方示例（真实项目请用JSON文件替换） =====================
const ITEMS_EXAMPLE = [
  {
    id: 'gold_ingot',
    name: '绿金锭',
    level: 37,
    job: 'goldsmith',
    icon: 'assets/icons/items/绿金锭.webp',
    recipe: [
      { id: 'raw_ore', name: '绿金矿石', quantity: 2, icon: 'assets/icons/items/raw_ore.png' },
      { id: 'crystal', name: '水晶', quantity: 4, icon: 'assets/icons/items/crystal.png' }
    ]
  },
  {
    id: 'gold_ring',
    name: '绿金环',
    level: 38,
    job: 'goldsmith',
    icon: 'assets/icons/items/绿金环.webp',
    recipe: [
      { id: 'gold_ingot', name: '绿金锭', quantity: 2, icon: 'assets/icons/items/绿金锭.webp' },
      { id: 'crystal', name: '水晶', quantity: 2, icon: 'assets/icons/items/crystal.png' }
    ]
  },
  {
    id: 'spruce_healing_shoes',
    name: '云杉治愈木鞋',
    level: 50,
    job: 'carpenter',
    icon: 'assets/icons/items/云杉治愈木鞋.webp',
    recipe: [
      { id: 'spruce_lumber', name: '云杉木材', quantity: 2, icon: 'assets/icons/items/云杉木材.webp' },
      { id: 'silk_thread', name: '天蚕丝', quantity: 1, icon: 'assets/icons/items/天蚕丝.webp' },
      { id: 'raptor_leather', name: '盗龙革', quantity: 1, icon: 'assets/icons/items/盗龙革.webp' },
      { id: 'high_purity_solvent', name: '高纯度心力炼金溶剂', quantity: 2, icon: 'assets/icons/items/高纯度心力炼金溶剂.webp' },
      { id: 'wind_crystal', name: '风之碎晶', quantity: 6, icon: 'assets/icons/items/风之碎晶.webp' },
      { id: 'ice_crystal', name: '冰之碎晶', quantity: 6, icon: 'assets/icons/items/冰之碎晶.webp' }
    ]
  },
  // 半成品材料定义
  {
    id: 'spruce_lumber',
    name: '云杉木材',
    level: 45,
    job: 'carpenter',
    icon: 'assets/icons/items/云杉木材.webp',
    recipe: [
      { id: 'spruce_log', name: '云杉原木', quantity: 5, icon: 'assets/icons/items/云杉原木.webp' },
      { id: 'tree_sap', name: '树汁块', quantity: 2, icon: 'assets/icons/items/树汁块.webp' },
      { id: 'wind_crystal', name: '风之碎晶', quantity: 6, icon: 'assets/icons/items/风之碎晶.webp' }
    ]
  },
  {
    id: 'silk_thread',
    name: '天蚕丝',
    level: 48,
    job: 'weaver',
    icon: 'assets/icons/items/天蚕丝.webp',
    recipe: [
      { id: 'cocoon', name: '蚕茧', quantity: 3, icon: 'assets/icons/items/蚕茧.webp' },
      { id: 'gray_juice', name: '灰汁', quantity: 1, icon: 'assets/icons/items/灰汁.webp' },
      { id: 'lightning_crystal', name: '雷之碎晶', quantity: 6, icon: 'assets/icons/items/雷之碎晶.webp' }
    ]
  },
  {
    id: 'raptor_leather',
    name: '盗龙革',
    level: 46,
    job: 'leatherworker',
    icon: 'assets/icons/items/盗龙革.webp',
    recipe: [
      { id: 'raptor_hide', name: '盗龙的粗皮', quantity: 2, icon: 'assets/icons/items/盗龙的粗皮.webp' },
      { id: 'black_alum', name: '黑明矾', quantity: 1, icon: 'assets/icons/items/黑明矾.webp' },
      { id: 'earth_crystal', name: '土之碎晶', quantity: 4, icon: 'assets/icons/items/土之碎晶.webp' }
    ]
  },
  {
    id: 'high_purity_solvent',
    name: '高纯度心力炼金溶剂',
    level: 49,
    job: 'alchemist',
    icon: 'assets/icons/items/高纯度心力炼金溶剂.webp',
    recipe: [
      { id: 'savin_mistletoe', name: '萨维奈槲寄生', quantity: 5, icon: 'assets/icons/items/萨维奈槲寄生.webp' },
      { id: 'pure_water', name: '纯净水', quantity: 2, icon: 'assets/icons/items/纯净水.webp' },
      { id: 'water_crystal', name: '水之碎晶', quantity: 6, icon: 'assets/icons/items/水之碎晶.webp' }
    ]
  }
];

// 基础材料图标映射
const BASE_MATERIAL_ICONS = {
  'spruce_log': 'assets/icons/items/云杉原木.webp',
  'tree_sap': 'assets/icons/items/树汁块.webp',
  'cocoon': 'assets/icons/items/蚕茧.webp',
  'gray_juice': 'assets/icons/items/灰汁.webp',
  'raptor_hide': 'assets/icons/items/盗龙的粗皮.webp',
  'black_alum': 'assets/icons/items/黑明矾.webp',
  'savin_mistletoe': 'assets/icons/items/萨维奈槲寄生.webp',
  'pure_water': 'assets/icons/items/纯净水.webp',
  'wind_crystal': 'assets/icons/items/风之碎晶.webp',
  'ice_crystal': 'assets/icons/items/冰之碎晶.webp',
  'lightning_crystal': 'assets/icons/items/雷之碎晶.webp',
  'earth_crystal': 'assets/icons/items/土之碎晶.webp',
  'water_crystal': 'assets/icons/items/水之碎晶.webp'
};

// 基础材料中文名称映射
const BASE_MATERIAL_NAMES = {
  'spruce_log': '云杉原木',
  'tree_sap': '树汁块',
  'cocoon': '蚕茧',
  'gray_juice': '灰汁',
  'raptor_hide': '盗龙的粗皮',
  'black_alum': '黑明矾',
  'savin_mistletoe': '萨维奈槲寄生',
  'pure_water': '纯净水',
  'wind_crystal': '风之碎晶',
  'ice_crystal': '冰之碎晶',
  'lightning_crystal': '雷之碎晶',
  'earth_crystal': '土之碎晶',
  'water_crystal': '水之碎晶'
};

// ===================== 状态管理 =====================
let currentJob = 'carpenter';
let searchKeyword = '';
let selectedItems = [];

// ===================== DOM 元素获取 =====================
const jobTabs = document.querySelectorAll('.job-tab');
const itemsGrid = document.getElementById('itemsGrid');
const itemSearch = document.getElementById('itemSearch');
const selectedItemsList = document.getElementById('selectedItemsList');
const calculateBtn = document.getElementById('calculateBtn');
const materialsList = document.getElementById('materialsList');

// ========== 收藏功能 ========== //
let favItems = JSON.parse(localStorage.getItem('ff14_favs') || '[]');
let showFavOnly = false;
const favToggleBtn = document.getElementById('favToggleBtn');

// ========== 采集职业闹钟功能 ========== //
// 采集职业闹钟物品id数组，持久化到localStorage
let gatherAlarms = JSON.parse(localStorage.getItem('gather_alarms') || '[]');

// 系统通知功能（已禁用）
let notificationPermission = false;
let notifiedItems = new Set();
let notificationNoticeDismissed = true;

// 请求通知权限
async function requestNotificationPermission() { return false; }

// 发送系统通知
function sendNotification() { /* disabled */ }

// 关闭通知权限提示
function dismissNotificationNotice() { /* disabled */ }

// 检查是否需要发送通知
function checkNotificationAlarm() { /* disabled */ }

// 渲染右侧闹钟列表
function renderGatherAlarms() {
  const alarmItemsList = document.getElementById('alarmItemsList');
  // 只在采集职业下显示
  if (!isGatheringJob(currentJob)) {
    if (alarmItemsList) alarmItemsList.innerHTML = '';
    return;
  }
  // 获取当前职业所有物品（分类展开）
  let allItems = [];
  ITEMS.forEach(cat => {
    allItems.push(...cat.recipes);
  });
  // 过滤出已添加闹钟的物品
  const alarmItems = allItems.filter(item => gatherAlarms.includes(item.id));
  // 构建HTML内容
  let html = '';
  // 已移除：通知权限提示条相关内容
  if (alarmItems.length === 0) {
    html += '<div class="empty-state"><i class="fas fa-clock"></i><p>请添加闹钟提醒的物品</p></div>';
    alarmItemsList.innerHTML = html;
    return;
  }
  // 为每个闹钟物品计算倒计时信息并排序
  const alarmItemsWithCountdown = alarmItems.map(item => {
    const countdownInfo = calculateCountdownInfo(item);
    return {
      ...item,
      countdownInfo,
      countdownText: countdownInfo.text
    };
  });
  // 排序：已出现的物品在前，按剩余时间从短到长；未出现的物品在后，按出现时间从短到长
  alarmItemsWithCountdown.sort((a, b) => {
    // 首先按状态排序：已出现 > 未出现
    if (a.countdownInfo.isAppearing !== b.countdownInfo.isAppearing) {
      return a.countdownInfo.isAppearing ? 1 : -1; // 已出现的排在前面
    }
    // 同状态下按时间排序：时间短的排在前面
    return a.countdownInfo.minutes - b.countdownInfo.minutes;
  });
  // 直接显示排序后的物品列表，不按分类分组
  alarmItemsWithCountdown.forEach(item => {
    // 为已出现的物品添加动态绿色遮罩
    const isAppearing = item.countdownInfo.isAppearing;
    const countdownClass = isAppearing ? 'alarm-countdown' : 'alarm-countdown active-item';
    const progressStyle = isAppearing ? '' : `style="--progress: ${calculateProgress(item.countdownInfo)}%"`;
    // 为已出现的物品添加绿色边框，为剩余时间较短的物品添加动效
    const isActive = !isAppearing; // 已出现的物品
    const isUrgent = isActive && item.countdownInfo.minutes < 3; // 剩余时间小于3分钟
    let iconClass = 'alarm-item-icon';
    if (isActive) iconClass += ' active';
    if (isUrgent) iconClass += ' urgent';
    html += `
      <div class="alarm-item" data-id="${item.id}">
        <div class="alarm-item-info">
          <div class="${iconClass}"><img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" style="width:32px;height:32px;"></div>
          <div class="alarm-item-details">
            <h4>${item.name} <span class="item-level-inline">等级：${item.level}</span></h4>
          </div>
        </div>
        <div class="${countdownClass}" data-id="${item.id}" ${progressStyle}>
          <div class="countdown-progress"></div>
          <span class="countdown-text">${item.countdownText}</span>
        </div>
        <button class="alarm-remove-btn" title="移除闹钟" data-id="${item.id}"><img src="assets/icons/button/closealert.png" alt="移除"></button>
      </div>
    `;
  });
  alarmItemsList.innerHTML = html;
}

// 计算倒计时信息（返回详细信息用于排序）
function calculateCountdownInfo(item) {
  if (!item.startTime || !item.endTime) {
    return {
      text: '时间未知',
      minutes: Infinity,
      isAppearing: false
    };
  }
  
  // 获取当前艾欧泽亚时间（小时）
  const eorzeaTimeElement = document.getElementById('eorzeaTimeValue');
  if (!eorzeaTimeElement) {
    return {
      text: '时间未知',
      minutes: Infinity,
      isAppearing: false
    };
  }
  
  const eorzeaTimeStr = eorzeaTimeElement.textContent;
  const [hours, minutes] = eorzeaTimeStr.split(':').map(Number);
  const currentEorzeaTime = hours + minutes / 60; // 转换为小时的小数形式
  
  // 将艾欧泽亚时间转换为0-1的小数形式（一天中的时间比例）
  const currentTimeRatio = currentEorzeaTime / 24;
  
  // 处理跨天的情况
  let startTime = item.startTime;
  let endTime = item.endTime;
  
  // 如果结束时间小于开始时间，说明跨天了
  if (endTime < startTime) {
    if (currentTimeRatio >= startTime) {
      // 当前时间在开始时间之后，结束时间需要加1
      endTime += 1;
    } else {
      // 当前时间在开始时间之前，开始时间需要减1
      startTime -= 1;
    }
  }
  
  // 计算倒计时（艾欧泽亚时间）
  let timeUntil;
  let isAppearing = false;
  
  if (currentTimeRatio < startTime) {
    // 尚未出现
    timeUntil = (startTime - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    isAppearing = true;
  } else if (currentTimeRatio >= startTime && currentTimeRatio < endTime) {
    // 已经出现，计算距离消失的时间
    timeUntil = (endTime - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    isAppearing = false;
  } else {
    // 已经消失，计算到下次出现的时间
    // 如果当前时间超过了结束时间，计算到下次开始时间
    if (currentTimeRatio >= endTime) {
      timeUntil = (startTime + 1 - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    } else {
      timeUntil = (startTime - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
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
  
  const text = isAppearing ? `距离出现还有${timeStr}` : `距离消失还有${timeStr}`;
  
  return {
    text,
    minutes: localTimeMinutes,
    isAppearing,
    item: item // 添加原始物品数据用于计算持续时间
  };
}

// 计算进度百分比（用于绿色遮罩）
function calculateProgress(countdownInfo) {
  if (countdownInfo.isAppearing) {
    return 0; // 未出现的物品不显示进度
  }
  
  // 获取物品的实际持续时间（从JSON数据中计算）
  const startTime = countdownInfo.item.startTime;
  const endTime = countdownInfo.item.endTime;
  
  // 计算艾欧泽亚时间的持续时间
  let duration;
  if (endTime > startTime) {
    duration = (endTime - startTime) * 24; // 转换为艾欧泽亚小时
  } else {
    duration = ((1 + endTime) - startTime) * 24; // 跨天情况
  }
  
  // 转换为现实分钟
  const totalDuration = duration * 3; // 1艾欧泽亚小时 = 3现实分钟
  const remainingTime = countdownInfo.minutes;
  
  // 计算进度百分比：剩余时间越短，进度越低（绿色条越短）
  const progress = Math.max(0, Math.min(100, (remainingTime / totalDuration) * 100));
  
  return Math.round(progress);
}

// 计算倒计时函数
function calculateCountdown(item) {
  if (!item.startTime || !item.endTime) {
    return '时间未知';
  }
  
  // 获取当前艾欧泽亚时间（小时）
  const eorzeaTimeElement = document.getElementById('eorzeaTimeValue');
  if (!eorzeaTimeElement) {
    return '时间未知';
  }
  
  const eorzeaTimeStr = eorzeaTimeElement.textContent;
  const [hours, minutes] = eorzeaTimeStr.split(':').map(Number);
  const currentEorzeaTime = hours + minutes / 60; // 转换为小时的小数形式
  
  // 将艾欧泽亚时间转换为0-1的小数形式（一天中的时间比例）
  const currentTimeRatio = currentEorzeaTime / 24;
  
  // 处理跨天的情况
  let startTime = item.startTime;
  let endTime = item.endTime;
  
  // 如果结束时间小于开始时间，说明跨天了
  if (endTime < startTime) {
    if (currentTimeRatio >= startTime) {
      // 当前时间在开始时间之后，结束时间需要加1
      endTime += 1;
    } else {
      // 当前时间在开始时间之前，开始时间需要减1
      startTime -= 1;
    }
  }
  
  // 计算倒计时（艾欧泽亚时间）
  let timeUntil;
  let isAppearing = false;
  
  if (currentTimeRatio < startTime) {
    // 尚未出现
    timeUntil = (startTime - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    isAppearing = true;
  } else if (currentTimeRatio >= startTime && currentTimeRatio < endTime) {
    // 已经出现，计算距离消失的时间
    timeUntil = (endTime - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    isAppearing = false;
  } else {
    // 已经消失，计算到下次出现的时间
    // 如果当前时间超过了结束时间，计算到下次开始时间
    if (currentTimeRatio >= endTime) {
      timeUntil = (startTime + 1 - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
    } else {
      timeUntil = (startTime - currentTimeRatio) * 24; // 转换为艾欧泽亚小时
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
  
  return isAppearing ? `距离出现还有${timeStr}` : `距离消失还有${timeStr}`;
}

// 添加/移除闹钟
function toggleGatherAlarm(itemId) {
  const idx = gatherAlarms.indexOf(itemId);
  if (idx === -1) {
    gatherAlarms.push(itemId);
  } else {
    gatherAlarms.splice(idx, 1);
  }
  localStorage.setItem('gather_alarms', JSON.stringify(gatherAlarms));
  renderGatherAlarms();
  renderItemSelection(); // 让按钮高亮同步
}

// 右侧闹钟列表移除按钮事件
const alarmItemsList = document.getElementById('alarmItemsList');
if (alarmItemsList) {
  alarmItemsList.addEventListener('click', function(e) {
    const btn = e.target.closest('.alarm-remove-btn');
    if (btn) {
      const itemId = btn.dataset.id;
      toggleGatherAlarm(itemId);
    }
  });
}

// 采集职业切换时自动渲染闹钟列表
function loadAlarmItems() {
  renderGatherAlarms();
}

// 页面初始化时渲染闹钟列表（已合并到主DOMContentLoaded事件中）

// 启动倒计时更新定时器
function startCountdownTimer() {
  // 每200ms更新一次倒计时，确保每秒跳1秒
  // 因为艾欧泽亚时间流逝速度是现实的20倍，所以需要更频繁的更新
  setInterval(() => {
    if (isGatheringJob(currentJob)) {
      updateAlarmCountdowns();
    }
  }, 1000);
}

// 更新闹钟倒计时
function updateAlarmCountdowns() {
  // 重新渲染整个闹钟列表，避免DOM元素复用导致的样式错误
  renderGatherAlarms();
  
  // 检查是否需要发送系统通知
  if (false && notificationPermission && isGatheringJob(currentJob)) {
    // 获取当前职业所有物品
    let allItems = [];
    ITEMS.forEach(cat => {
      allItems.push(...cat.recipes);
    });
    
    // 只检查已添加闹钟的物品
    const alarmItems = allItems.filter(item => gatherAlarms.includes(item.id));
    
    // 为每个闹钟物品检查是否需要发送通知
    alarmItems.forEach(item => {
      const countdownInfo = calculateCountdownInfo(item);
      checkNotificationAlarm(item, countdownInfo);
    });
  }
}

// 多级分类下的物品过滤
function filterItemsByCategory() {
  // 当存在搜索关键字时，改为在全职业数据 ALL_RECIPES 中搜索，并按 category 分组
  const keyword = (searchKeyword || '').trim().toLowerCase();
  if (keyword) {
    const grouped = new Map();
    const source = Array.isArray(ALL_RECIPES) ? ALL_RECIPES : [];
    source.forEach(item => {
      const name = (item?.name || '').toLowerCase();
      const pinyin = (item?.pinyin || '').toLowerCase();
      const matchSearch = name.includes(keyword) || pinyin.includes(keyword);
      const matchFav = !showFavOnly || isFaved(item?.id);
      if (matchSearch && matchFav) {
        const cat = item.category || '未分类';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat).push(item);
      }
    });
    return Array.from(grouped.entries()).map(([category, recipes]) => ({ category, recipes }));
  }

  // 无搜索关键字时，保持原有：按当前职业的 ITEMS 渲染
  if (!Array.isArray(ITEMS)) return [];
  const result = [];
  ITEMS.forEach(cat => {
    const filtered = cat.recipes.filter(item => {
      let matchJob = true;
      if (!isGatheringJob(currentJob)) {
        matchJob = (currentJob === 'quickcalc') ? true : (item.job === currentJob);
      }
      const name = (item.name || '').toLowerCase();
      const pinyin = (item.pinyin || '').toLowerCase();
      const matchSearch = !keyword || name.includes(keyword) || pinyin.includes(keyword);
      const matchFav = !showFavOnly || isFaved(item.id);
      return matchJob && matchSearch && matchFav;
    });
    if (filtered.length > 0) {
      result.push({ category: cat.category, recipes: filtered });
    }
  });
  return result;
}

// 分类展开状态，默认全部折叠
let categoryExpandState = {};

// ========== 图标路径自动匹配 ========== //
function getItemIcon(name, fallback) {
  // 优先使用fallback参数（如果提供了的话）
  if (fallback) {
    return fallback;
  }
  
  // 首先检查BASE_MATERIALS映射（如果存在）
  if (typeof BASE_MATERIALS !== 'undefined' && BASE_MATERIALS[name]) {
    return BASE_MATERIALS[name].icon;
  }
  
  // 尝试从ALL_RECIPES中找到对应的物品，获取其pinyin字段
  const item = ALL_RECIPES.find(item => item.name === name);
  if (item && item.pinyin) {
    // 使用pinyin字段构建itemse路径
    return `assets/icons/itemse/${item.pinyin}.webp`;
  }
  
  // 如果ALL_RECIPES中没有找到，尝试从当前ITEMS中查找
  if (ITEMS && Array.isArray(ITEMS)) {
    for (const category of ITEMS) {
      if (category.recipes && Array.isArray(category.recipes)) {
        const foundItem = category.recipes.find(item => item.name === name);
        if (foundItem && foundItem.pinyin) {
          return `assets/icons/itemse/${foundItem.pinyin}.webp`;
        }
      }
    }
  }
  
  // 最后回退到原始名称（兼容性）
  return `assets/icons/items/${name}.webp`;
}

// 渲染物品选择区（多级分类）
function renderItemSelection() {
  // 新增：只看收藏时平铺显示
  if (showFavOnly) {
    itemsGrid.classList.add('fav-only'); // 只看收藏时加class
    const allItems = getAllItemsFlat();
    // 渲染前去重：同id只显示一次
    const uniqueFaved = [];
    const seen = new Set();
    for (const item of allItems) {
      if (favItems.includes(item.id) && !seen.has(item.id)) {
        uniqueFaved.push(item);
        seen.add(item.id);
      }
    }
    if (uniqueFaved.length === 0) {
      itemsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-heart-broken"></i><p>暂无收藏的物品</p></div>';
      return;
    }
    // 判断当前是否采集职业
    const isGathering = isGatheringJob(currentJob);
    itemsGrid.innerHTML = uniqueFaved.map(item => `
      <div class="item-card${selectedItems.find(sel => sel.id === item.id) ? ' selected' : ''}" data-id="${item.id}">
        <div class="item-icon"><img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" style="width:28px;height:28px;"></div>
        <div class="item-name">${item.name}</div>
        <div class="item-level">等级：${item.level}</div>
        <button class="fav-btn faved" title="${isGathering ? '闹钟提醒' : '取消收藏'}">${isGathering ? '<img src="assets/icons/button/alert.png" alt="alarm" style="width:18px;height:18px;object-fit:contain;">' : '<i class="fas fa-star"></i>'}</button>
      </div>
    `).join('');
    return;
  } else {
    itemsGrid.classList.remove('fav-only'); // 退出只看收藏时移除class
  }
  // 原有分组渲染逻辑
  const filtered = filterItemsByCategory();
  if (!Array.isArray(filtered) || filtered.length === 0) {
    itemsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>无符合条件的物品</p></div>';
    return;
  }
  // 判断当前是否采集职业
  const isGathering = isGatheringJob(currentJob);
  let html = '';
  filtered.forEach(cat => {
    if (!(cat.category in categoryExpandState)) categoryExpandState[cat.category] = false;
    const expanded = categoryExpandState[cat.category];
    html += `
      <div class="item-category">
        <div class="item-category-header${expanded ? ' expanded' : ''}" data-category="${cat.category}">
          <span class="category-toggle">${expanded ? '▼' : '▶'}</span>
          <span class="category-title">${cat.category}</span>
          <button class="category-select-all-btn" data-category="${cat.category}" title="批量选择该分类下所有配方">
            <i class="fas fa-plus-square"></i>
          </button>
        </div>
        <div class="item-category-list" style="display:${expanded ? 'block' : 'none'};">
          ${cat.recipes.map(item => `
            <div class="item-card${selectedItems.find(sel => sel.id === item.id) ? ' selected' : ''}" data-id="${item.id}">
              <div class="item-icon"><img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" style="width:28px;height:28px;"></div>
              <div class="item-name">${item.name}</div>
              <div class="item-level">等级：${item.level}</div>
              <button class="fav-btn${isGathering && gatherAlarms.includes(item.id) ? ' faved' : ''}" title="${isGathering ? '闹钟提醒' : (isFaved(item.id) ? '取消收藏' : '收藏')}" data-id="${item.id}">${isGathering ? '<img src="assets/icons/button/alert.png" alt="alarm" style="width:18px;height:18px;object-fit:contain;">' : '<i class="fas fa-star"></i>'}</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  itemsGrid.innerHTML = html;
}

// 获取所有配方的扁平数组（用于递归查找半成品，始终用全职业数据）
function getAllItemsFlat() {
  return ALL_RECIPES;
}

function isFaved(itemId) {
  return favItems.includes(itemId);
}
function toggleFav(itemId) {
  if (isFaved(itemId)) {
    favItems = favItems.filter(id => id !== itemId);
  } else {
    if (!favItems.includes(itemId)) { // 防止重复收藏
    favItems.push(itemId);
    }
  }
  localStorage.setItem('ff14_favs', JSON.stringify(favItems));
  renderItemSelection(); // 保证分级目录结构
}

favToggleBtn.addEventListener('click', () => {
  showFavOnly = !showFavOnly;
  favToggleBtn.classList.toggle('active', showFavOnly);
  renderItemSelection(); // 保证分级目录结构
});

// ===================== 物品筛选与渲染 =====================
function filterItems() {
  return ITEMS.filter(item => {
    // 快捷计算模式不过滤职业
    const matchJob = currentJob === 'quickcalc' ? true : (item.job === currentJob);
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const name = (item.name || '').toLowerCase();
    const pinyin = (item.pinyin || '').toLowerCase();
    const matchSearch = !keyword || name.includes(keyword) || pinyin.includes(keyword);
    const matchFav = !showFavOnly || isFaved(item.id);
    return matchJob && matchSearch && matchFav;
  });
}

// 修正renderItems，支持多级分类结构
function renderItems() {
  const items = (searchKeyword ? getAllItemsFlat() : getAllItemsFlat()).filter(item => {
    // 全局搜索：有关键字时不限制职业
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const limitByJob = !keyword; // 只有在没有关键字时才限制职业
    const matchJob = limitByJob ? (currentJob === 'quickcalc' ? true : (item.job === currentJob)) : true;
    const name = (item.name || '').toLowerCase();
    const pinyin = (item.pinyin || '').toLowerCase();
    const matchSearch = !keyword || name.includes(keyword) || pinyin.includes(keyword);
    const matchFav = !showFavOnly || isFaved(item.id);
    return matchJob && matchSearch && matchFav;
  });
  if (items.length === 0) {
    itemsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>无符合条件的物品</p></div>';
    return;
  }
  itemsGrid.innerHTML = items.map(item => `
    <div class="item-card${selectedItems.find(sel => sel.id === item.id) ? ' selected' : ''}" data-id="${item.id}">
      <div class="item-icon"><img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" style="width:28px;height:28px;"></div>
      <div class="item-name">${item.name}</div>
      <div class="item-level">等级：${item.level}</div>
      <div class="item-job">${JOBS.find(j=>j.key===item.job)?.name||''}</div>
      <button class="fav-btn${isFaved(item.id) ? ' faved' : ''}" title="${isFaved(item.id) ? '取消收藏' : '收藏'}"><i class="fas fa-star"></i></button>
    </div>
  `).join('');
}

// ===================== 职业切换 =====================
jobTabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    // 新增：只看收藏时切换职业自动退出只看收藏
    if (showFavOnly) {
      showFavOnly = false;
      favToggleBtn.classList.remove('active');
    }
    jobTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const jobKey = tab.dataset.job;
    currentJob = jobKey;
    await onJobChange(jobKey); // 确保异步加载后再渲染
  });
});

// ===================== 搜索功能 =====================
itemSearch.addEventListener('input', e => {
  searchKeyword = e.target.value.trim();
  // 输入关键字后，切换为全局搜索视图（按 ALL_RECIPES 分组渲染）
  renderItemSelection();
});

// ===================== 物品选择 =====================
// 修正物品选择事件，始终调用renderItemSelection
itemsGrid.addEventListener('click', e => {
  // 采集职业闹钟按钮
  if (isGatheringJob(currentJob) && e.target.closest('.fav-btn')) {
    e.stopPropagation();
    e.preventDefault();
    const btn = e.target.closest('.fav-btn');
    const card = btn.closest('.item-card');
    if (!card) return;
    const itemId = card.dataset.id;
    toggleGatherAlarm(itemId);
    return;
  }
  // 生产职业收藏按钮
  if (!isGatheringJob(currentJob) && e.target.closest('.fav-btn')) {
    e.stopPropagation();
    e.preventDefault();
    const card = e.target.closest('.item-card');
    if (!card) return;
    const itemId = card.dataset.id;
    toggleFav(itemId);
    return;
  }
  // 只看收藏模式下的收藏按钮
  if (showFavOnly && e.target.closest('.fav-btn')) {
    e.stopPropagation();
    e.preventDefault();
    const btn = e.target.closest('.fav-btn');
    const card = btn.closest('.item-card');
    if (!card) return;
    const itemId = card.dataset.id;
    favItems = favItems.filter(id => id !== itemId);
    localStorage.setItem('ff14_favs', JSON.stringify(favItems));
    renderItemSelection();
    return;
  }
  // 采集职业下不处理物品选择（避免添加到已选物品）
  if (isGatheringJob(currentJob)) {
    return;
  }
  const card = e.target.closest('.item-card');
  if (!card) return;
  const itemId = card.dataset.id;
  const item = getAllItemsFlat().find(i => i.id === itemId);
  if (!item) {
    return;
  }
  const exist = selectedItems.find(sel => sel.id === itemId);
  if (exist) return; // 已选中不重复添加
  selectedItems.push({ ...item, quantity: 1 });
  renderSelectedItems();
  renderItemSelection(); // 保证左侧分级目录和滚动正常
});

// ===================== 已选物品渲染与操作 =====================
function renderSelectedItems() {
  if (selectedItems.length === 0) {
    selectedItemsList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>请选择要制造的物品</p></div>';
    return;
  }
  selectedItemsList.innerHTML = selectedItems.map(item => {
    const isCompleted = completedItems.has(item.id);
    const completedClass = isCompleted ? 'completed' : '';
    const completedStyle = isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : '';
    
    return `
      <div class="selected-item ${completedClass}" data-id="${item.id}">
        <div class="selected-item-info">
          <div class="selected-item-icon"><img src="${getItemIcon(item.name, item.icon)}" alt="${item.name}" style="width:32px;height:32px;"></div>
          <div class="selected-item-details">
            <h4 style="${completedStyle}" class="item-name-clickable">${item.name} <span class="item-level-inline">等级：${item.level}</span></h4>
          </div>
        </div>
        <div class="quantity-controls">
          <button class="quantity-btn" data-action="decrease">-</button>
          <input type="number" class="quantity-input" value="${item.quantity}" min="1">
          <button class="quantity-btn" data-action="increase">+</button>
          <button class="quantity-btn" data-action="remove" title="移除">×</button>
        </div>
      </div>
    `;
  }).join('');
  
  // 添加点击事件监听器
  addItemClickListeners();
}

// 添加物品点击事件监听器
function addItemClickListeners() {
  // 移除旧的事件监听器
  document.querySelectorAll('.item-name-clickable, .material-name-clickable').forEach(element => {
    element.removeEventListener('click', handleItemClick);
  });
  
  // 添加新的事件监听器
  document.querySelectorAll('.item-name-clickable, .material-name-clickable').forEach(element => {
    element.addEventListener('click', handleItemClick);
  });
}

// 统一的点击事件处理函数
function handleItemClick(e) {
  e.preventDefault();
  const itemDiv = this.closest('.selected-item, .material-item');
  const itemId = itemDiv.dataset.id;
  
  // 判断类型
  let type = 'baseMaterial';
  if (this.closest('.selected-item')) {
    type = 'item';
  } else if (this.closest('.materials-list .material-item')) {
    type = 'material';
  } else if (this.closest('.base-materials-list .material-item')) {
    type = 'baseMaterial';
  }
  
  toggleItemCompletion(itemId, type);
}

// 切换物品完成状态
function toggleItemCompletion(itemId, type) {
  let completedSet;
  let itemName = '';
  
  switch(type) {
    case 'item':
      completedSet = completedItems;
      const selectedItem = selectedItems.find(item => item.id === itemId);
      itemName = selectedItem ? selectedItem.name : itemId;
      break;
    case 'material':
      completedSet = completedMaterials;
      // 从当前显示的材料中获取名称
      const materialElement = document.querySelector(`.material-item[data-id="${itemId}"] .material-details h4`);
      itemName = materialElement ? materialElement.textContent.trim() : itemId;
      break;
    case 'baseMaterial':
      completedSet = completedBaseMaterials;
      // 从当前显示的基础材料中获取名称
      const baseMaterialElement = document.querySelector(`.base-materials-list .material-item[data-id="${itemId}"] .material-details h4`);
      itemName = baseMaterialElement ? baseMaterialElement.textContent.trim() : itemId;
      break;
  }
  
  if (completedSet.has(itemId)) {
    completedSet.delete(itemId);
  } else {
    completedSet.add(itemId);
  }
  
  // 重新渲染相关列表
  renderSelectedItems();
  
  // 根据类型决定是否需要重新计算
  if (type === 'material' || type === 'item' || type === 'baseMaterial') {
    recalculateMaterials();
  }
}

// 数量调整与移除
selectedItemsList.addEventListener('click', e => {
  const itemDiv = e.target.closest('.selected-item');
  if (!itemDiv) return;
  const itemId = itemDiv.dataset.id;
  const idx = selectedItems.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  if (e.target.dataset.action === 'increase') {
    selectedItems[idx].quantity++;
    renderSelectedItems();
  } else if (e.target.dataset.action === 'decrease') {
    if (selectedItems[idx].quantity > 1) {
      selectedItems[idx].quantity--;
      renderSelectedItems();
    }
  } else if (e.target.dataset.action === 'remove') {
    selectedItems.splice(idx, 1);
    renderSelectedItems();
    renderItemSelection(); // 保证左侧分级目录和滚动正常
  }
});
// 直接输入数量
selectedItemsList.addEventListener('input', e => {
  if (!e.target.classList.contains('quantity-input')) return;
  const itemDiv = e.target.closest('.selected-item');
  if (!itemDiv) return;
  const itemId = itemDiv.dataset.id;
  const idx = selectedItems.findIndex(i => i.id === itemId);
  let val = parseInt(e.target.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  selectedItems[idx].quantity = val;
});

// ===================== 素材计算 =====================
const baseMaterialsList = document.getElementById('baseMaterialsList');

calculateBtn.addEventListener('click', () => {
  // 清空完成状态
  completedItems.clear();
  completedMaterials.clear();
  completedBaseMaterials.clear();
  
  // 调用重新计算函数
  recalculateMaterials();
});

// ===================== 素材详情弹窗 =====================
// 已移除原有的素材详情弹窗功能，现在只保留标记完成功能

// ===================== 初始化渲染 =====================
renderItems();
renderSelectedItems();

// ======= 本地时间显示功能 =======
// 直接使用本地时间，不再依赖外部网络API
function updateLocalTime() {
  const el = document.getElementById('localTimeValue');
  if (!el) return;
  
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  el.textContent = `${hh}:${mm}`;
}

// 启动本地时间显示
setInterval(updateLocalTime, 1000);
updateLocalTime(); // 首次立即显示
// ======= 本地时间显示功能 END =======

// ======= 艾欧泽亚时钟显示功能 =======
function updateEorzeaTime() {
  const el = document.getElementById('eorzeaTimeValue');
  if (!el) return;
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
  const hh = Math.floor(curEorzeaMin / 60).toString().padStart(2, '0');
  const mm = (curEorzeaMin % 60).toString().padStart(2, '0');
  el.textContent = `${hh}:${mm}`;

  // 同步天气面板的预测刷新（每次时钟刷新尝试更新一次，内部有节流）
  if (typeof window.refreshWeatherForecastThrottled === 'function') {
    window.refreshWeatherForecastThrottled();
  }
}
setInterval(updateEorzeaTime, 1000);
updateEorzeaTime(); // 首次立即显示
// ======= 艾欧泽亚时钟显示功能 END =======

// ===================== 其他功能（收藏、设置等可后续扩展） =====================
// ... 

// 分类展开/折叠事件
itemsGrid.addEventListener('click', e => {
  // 批量选择按钮点击事件
  if (e.target.closest('.category-select-all-btn')) {
    e.stopPropagation(); // 阻止事件冒泡到分类标题
    const btn = e.target.closest('.category-select-all-btn');
    const category = btn.dataset.category;
    
    // 获取该分类下的所有配方
    const categoryItems = ITEMS.find(cat => cat.category === category)?.recipes || [];
    
    // 根据当前职业模式决定批量添加行为
    if (isGatheringJob(currentJob)) {
      // 采集职业模式：批量添加到闹钟列表
      let addedCount = 0;
      categoryItems.forEach(item => {
        if (!gatherAlarms.includes(item.id)) {
          gatherAlarms.push(item.id);
          addedCount++;
        }
      });
      
      // 保存到本地存储
      localStorage.setItem('gather_alarms', JSON.stringify(gatherAlarms));
      
      // 更新显示
      renderGatherAlarms();
      renderItemSelection();
      
      // 显示提示信息
      if (addedCount > 0) {
        // 已批量添加物品到闹钟列表
      } else {
        // 该分类下的物品已全部在闹钟列表中
      }
    } else {
      // 生产职业模式：批量添加到已选物品中（跳过已存在的）
      let addedCount = 0;
      categoryItems.forEach(item => {
        const exist = selectedItems.find(sel => sel.id === item.id);
        if (!exist) {
          selectedItems.push({ ...item, quantity: 1 });
          addedCount++;
        }
      });
      
      // 更新显示
      renderSelectedItems();
      renderItemSelection();
      
      // 显示提示信息
      if (addedCount > 0) {
        // 已批量添加配方到已选物品
      } else {
        // 该分类下的配方已全部在已选物品中
      }
    }
    
    return;
  }
  
  const catHeader = e.target.closest('.item-category-header');
  if (catHeader && !e.target.closest('.item-card')) {
    const cat = catHeader.dataset.category;
    categoryExpandState[cat] = !categoryExpandState[cat];
    renderItemSelection();
    return;
  }
  // ...原有item-card点击逻辑...
});

// ===================== 一键清空已选物品 =====================
const clearSelectedBtn = document.getElementById('clearSelectedBtn');
if (clearSelectedBtn) {
  clearSelectedBtn.addEventListener('click', () => {
    // 清空已选物品数组
    selectedItems.length = 0;
    // 刷新已选物品列表
    renderSelectedItems();
    // 刷新左侧物品选择区（含分类菜单和高亮）
    renderItemSelection();
    // 清空计算结果区域
    materialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>请选择物品后再计算</p></div>';
    baseMaterialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>请选择物品后再计算</p></div>';
  });
}

// ===================== 主题切换功能 =====================
class ThemeManager {
  constructor() {
            this.currentTheme = this.getStoredTheme() || 'light';
    this.themeToggle = document.getElementById('themeToggle');
    this.init();
  }

  // 获取存储的主题
  getStoredTheme() {
    return localStorage.getItem('ff14-calculator-theme');
  }

  // 存储主题
  setStoredTheme(theme) {
    localStorage.setItem('ff14-calculator-theme', theme);
  }

  // 应用主题
  applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      this.themeToggle.title = '切换到夜晚模式';
    } else {
      document.documentElement.removeAttribute('data-theme');
      this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
      this.themeToggle.title = '切换到白天模式';
    }
    this.currentTheme = theme;
    this.setStoredTheme(theme);
  }

  // 切换主题
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    
    // 添加切换动画
    this.themeToggle.classList.add('theme-transition');
    
    // 延迟应用主题，配合动画效果
    setTimeout(() => {
      this.applyTheme(newTheme);
      
      // 移除动画类
      setTimeout(() => {
        this.themeToggle.classList.remove('theme-transition');
      }, 400);
    }, 200);
  }

  // 初始化
  init() {
    if (!this.themeToggle) {
      console.warn('主题切换按钮未找到');
      return;
    }

    // 应用初始主题
    this.applyTheme(this.currentTheme);

    // 绑定点击事件
    this.themeToggle.addEventListener('click', () => {
      this.toggleTheme();
    });

    // 添加键盘快捷键 (Ctrl/Cmd + Shift + T)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  }
}

// 初始化主题管理器
const themeManager = new ThemeManager();

// 删除闹钟按钮事件监听器
if (calculateBtn) {
  calculateBtn.addEventListener('click', () => {
    // 检查当前是否为采集职业
    if (isGatheringJob(currentJob)) {
      // 清空所有闹钟
      gatherAlarms.length = 0;
      localStorage.setItem('gather_alarms', JSON.stringify(gatherAlarms));
      renderGatherAlarms();
      renderItemSelection(); // 更新物品选择区的按钮状态
    } else {
      // 生产职业的计算逻辑（原有逻辑）
      // 这里可以保留原有的计算功能
    }
  });
}



// ========== 采集职业判断与UI切换 ========== //
// 判断是否为采集职业（采矿工/园艺工）
function isGatheringJob(job) {
  return job === 'miner' || job === 'botanist';
}

// 切换采集职业模式，调整UI和功能
function toggleGatheringMode(job) {
  // 判断是否为采集职业
  const isGathering = isGatheringJob(job);
  const calculatorContainer = document.querySelector('.calculator-container');
  const favToggleBtn = document.getElementById('favToggleBtn');
  const alarmToggleBtn = document.getElementById('alarmToggleBtn');
  const calculateBtn = document.getElementById('calculateBtn');
  const calculateBtnText = document.querySelector('.calculate-btn-text');
  const calculateBtnIcon = calculateBtn.querySelector('i');
  const calculateDelImg = calculateBtn.querySelector('.calculate-del-img');
  const calculateCalcImg = calculateBtn.querySelector('.calculate-calc-img');
  const clearSelectedBtn = document.getElementById('clearSelectedBtn');
  const productionContent = document.querySelector('.production-content');
  const alarmContent = document.querySelector('.alarm-content');
  // 获取右上角标题及图标
  const sectionHeader = document.querySelector('.calculation-results .section-header h2');
  const sectionHeaderIcon = sectionHeader.querySelector('i');
  // 获取闹钟内容区的h3（"闹钟列表"标签）
  const alarmListH3 = document.querySelector('.alarm-content .alarm-list h3');

  if (isGathering) {
    // 采集职业模式
    calculatorContainer.classList.add('gathering-mode');
    favToggleBtn.style.display = 'none';
    alarmToggleBtn.style.display = 'flex';
    // 1. 修改标题和图标
    if(sectionHeaderIcon) sectionHeaderIcon.className = 'fas fa-clock';
    sectionHeader.childNodes[1].nodeValue = ' 闹钟列表';
    // 2. 删除下方"闹钟列表"标签
    if(alarmListH3) alarmListH3.style.display = 'none';
    // 3. 隐藏清空按钮（垃圾桶）
    clearSelectedBtn.style.display = 'none';
    // 4. 删除文字，仅显示 del.png 图标
    if (calculateBtnIcon) calculateBtnIcon.style.display = 'none';
    if (calculateCalcImg) calculateCalcImg.style.display = 'none';
    if (calculateDelImg) calculateDelImg.style.display = 'inline-block';
    if (calculateBtnText) calculateBtnText.style.display = 'none';
    if (calculateBtn) calculateBtn.setAttribute('aria-label', '删除闹钟');
    // 切换内容区域
    if (productionContent) productionContent.style.display = 'none';
    if (alarmContent) alarmContent.style.display = '';
    // 加载闹钟数据
    renderGatherAlarms();
  } else {
    // 生产职业模式
    calculatorContainer.classList.remove('gathering-mode');
    favToggleBtn.style.display = 'flex';
    alarmToggleBtn.style.display = 'none';
    // 恢复标题和图标
    if(sectionHeaderIcon) sectionHeaderIcon.className = 'fas fa-chart-bar';
    sectionHeader.childNodes[1].nodeValue = ' 计算结果';
    // 恢复下方"闹钟列表"标签
    if(alarmListH3) alarmListH3.style.display = '';
    // 显示清空按钮
    clearSelectedBtn.style.display = 'flex';
    // 恢复"计算素材"按钮图标和文字（隐藏 del.png）
    if (calculateBtnIcon) calculateBtnIcon.style.display = 'none';
    if (calculateCalcImg) calculateCalcImg.style.display = 'inline-block';
    if (calculateDelImg) calculateDelImg.style.display = 'none';
    if (calculateBtnText) {
      calculateBtnText.textContent = '计算素材';
      calculateBtnText.style.display = 'inline';
    }
    if (calculateBtn) calculateBtn.setAttribute('aria-label', '计算素材');
    // 切换内容区域
    if (productionContent) productionContent.style.display = '';
    if (alarmContent) alarmContent.style.display = 'none';
    // 重置闹钟模式
    showAlarmOnly = false;
    alarmToggleBtn.classList.remove('active');
  }
}
// 在onJobChange中调用toggleGatheringMode

// ====== 导出Excel功能 ======
// 需要引入 xlsx 库（CDN）
let xlsxLoaded = false;

function loadXLSXLibrary() {
  return new Promise((resolve, reject) => {
    // 如果已经加载过，直接返回
    if (window.XLSX) {
      xlsxLoaded = true;
      resolve();
      return;
    }
    
    // 如果正在加载，等待加载完成
    if (window.xlsxLoading) {
      const checkLoaded = setInterval(() => {
        if (window.XLSX) {
          clearInterval(checkLoaded);
          xlsxLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }
    
    // 开始加载
    window.xlsxLoading = true;
    
    // 多个CDN源，提高加载成功率
    const cdnSources = [
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    ];
    
    let currentSourceIndex = 0;
    
    function tryLoadScript() {
      if (currentSourceIndex >= cdnSources.length) {
        window.xlsxLoading = false;
        reject(new Error('所有CDN源都无法访问，请检查网络连接'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = cdnSources[currentSourceIndex];
      
      // 设置超时时间（10秒）
      const timeout = setTimeout(() => {
        script.onerror();
      }, 10000);
      
      script.onload = () => {
        clearTimeout(timeout);
        xlsxLoaded = true;
        window.xlsxLoading = false;
        resolve();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        currentSourceIndex++;
        tryLoadScript();
      };
      
      document.head.appendChild(script);
    }
    
    tryLoadScript();
  });
}

// 导出Excel功能
async function exportToExcel() {
  
  // 添加按钮状态反馈
  const exportBtn = document.getElementById('exportExcelBtn');
  const originalText = exportBtn.innerHTML;
  exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导出中...';
  exportBtn.disabled = true;
  
  try {
    // 1. 确保XLSX库已加载
    if (!xlsxLoaded) {
      await loadXLSXLibrary();
    }
    
    // 2. 获取已选物品
    const selected = selectedItems || [];
    
    if (!selected.length) {
      alert('请先选择要制造的物品');
      return;
    }
    
    // 3. 递归统计半成品和基础素材，与页面显示一致
    const materialMap = {};
    const baseMaterialMap = {};
    
    function addMaterial(materialId, quantity, isBase = false) {
      const targetMap = isBase ? baseMaterialMap : materialMap;
      if (!materialId || typeof materialId !== 'string') return;
      if (!quantity || typeof quantity !== 'number') return;
      if (!targetMap[materialId]) {
        let item = null;
        try {
          const allItems = getAllItemsFlat();
          if (Array.isArray(allItems)) {
            item = allItems.find(i => i && i.id === materialId);
          }
        } catch (e) { 
          console.warn('获取物品信息失败:', e);
          item = null; 
        }
        if (item) {
          targetMap[materialId] = { id: item.id, name: item.name || materialId, total: 0 };
        } else {
          targetMap[materialId] = { id: materialId, name: materialId, total: 0 };
        }
      }
      if (targetMap[materialId]) {
        targetMap[materialId].total += quantity;
      }
    }
    
    function processRecipe(recipe, multiplier = 1) {
      if (!recipe || !Array.isArray(recipe) || recipe.length === 0) return;
      for (let i = 0; i < recipe.length; i++) {
        const mat = recipe[i];
        if (!mat || typeof mat !== 'object') continue;
        if (!mat.id || typeof mat.id !== 'string') continue;
        if (!mat.quantity || typeof mat.quantity !== 'number') continue;
        let foundItem = null;
        try {
          foundItem = getAllItemsFlat().find(item => item && item.id === mat.id);
        } catch (e) { 
          console.warn('查找物品失败:', e);
          foundItem = null; 
        }
        const hasRecipe = foundItem && foundItem.recipe && Array.isArray(foundItem.recipe);
        if (hasRecipe) {
          addMaterial(mat.id, mat.quantity * multiplier, false);
          processRecipe(foundItem.recipe, mat.quantity * multiplier);
        } else {
          addMaterial(mat.id, mat.quantity * multiplier, true);
        }
      }
    }
    
    selected.forEach(item => {
      if (item.recipe) {
        processRecipe(item.recipe, item.quantity);
      }
    });
        
    // 4. 组装数据
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    // 已选物品
    const selectedRows = selected.map(item => ({ '已选物品': item.name, '数量': item.quantity }));
    // 半成品
    const level2Rows = Object.values(materialMap).map(mat => ({ '半成品': mat.name, '数量': mat.total }));
    // 基础素材
    const baseRows = Object.values(baseMaterialMap).map(mat => ({ '基础素材': mat.name, '数量': mat.total }));
    
    // 5. 生成sheet
     const wb = XLSX.utils.book_new();
    if (selectedRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(selectedRows), '已选物品');
    if (level2Rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(level2Rows), '半成品');
    if (baseRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baseRows), '基础素材');
    
    // 6. 导出
    const filename = `result${timeStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    alert('Excel文件导出成功！');
    
  } catch (error) {
    console.error('导出Excel失败:', error);
    let errorMessage = '导出Excel失败';
    
    if (error.message.includes('CDN源都无法访问')) {
      errorMessage = '网络连接问题，无法加载Excel库，请检查网络连接后重试';
    } else if (error.message.includes('XLSX库加载失败')) {
      errorMessage = 'Excel库加载失败，请检查网络连接';
    } else {
      errorMessage = `导出Excel失败：${error.message}`;
    }
    
    alert(errorMessage);
  } finally {
    // 恢复按钮状态
    exportBtn.innerHTML = originalText;
    exportBtn.disabled = false;
  }
}

// 备用事件绑定机制，确保按钮事件能够正常工作
function bindExportExcelEvent() {
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn && !exportExcelBtn.hasAttribute('data-export-bound')) {
    exportExcelBtn.setAttribute('data-export-bound', 'true');
    
    // 移除可能存在的旧事件监听器
    exportExcelBtn.removeEventListener('click', exportToExcel);
    
    // 添加新的事件监听器
    exportExcelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exportToExcel();
    });
    
    // 添加鼠标事件监听器作为备用
    exportExcelBtn.addEventListener('mousedown', (e) => {
    });
    
  } else if (!exportExcelBtn) {
  } else {
  }
}

// 多重保障的事件绑定
function ensureExportButtonBound() {
  // 立即尝试绑定
  bindExportExcelEvent();
  
  // 延迟绑定，确保DOM完全加载
  setTimeout(bindExportExcelEvent, 100);
  setTimeout(bindExportExcelEvent, 500);
  setTimeout(bindExportExcelEvent, 1000);
  setTimeout(bindExportExcelEvent, 2000);
}

// 在页面加载完成后调用
window.addEventListener('DOMContentLoaded', ensureExportButtonBound);
window.addEventListener('load', bindExportExcelEvent);

function toggleExportBtnByJob(job) {
  const btn = document.getElementById('exportExcelBtn');
  if (!btn) return;
  if (isGatheringJob(job)) {
    btn.style.display = 'none';
  } else {
    btn.style.display = '';
  }
}

// 重新计算材料（考虑已完成物品的影响）
function recalculateMaterials() {
  if (selectedItems.length === 0) {
    materialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>请选择物品后再计算</p></div>';
    baseMaterialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>请选择物品后再计算</p></div>';
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
            name: BASE_MATERIAL_NAMES[materialId] || materialId, 
            icon: BASE_MATERIAL_ICONS[materialId] || getItemIcon(BASE_MATERIAL_NAMES[materialId] || materialId),
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
          // 如果材料已完成，将需求设为0
          targetMap[materialId].total = 0;
        } else {
          // 正常添加需求
          targetMap[materialId].total += quantity;
        }
      }
    } catch (error) {
      console.error('addMaterial函数出错:', error);
      console.error('参数:', { materialId, quantity, isBase });
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
          foundItem = getAllItemsFlat().find(item => item && item.id === mat.id);
        } catch (e) {
          foundItem = null;
        }
        
        const hasRecipe = foundItem && foundItem.recipe && Array.isArray(foundItem.recipe);
        
        if (hasRecipe) {
          // 半成品，加入2级材料统计（无论是否完成都要显示）
          addMaterial(mat.id, mat.quantity * multiplier, false);
          // 如果半成品未完成，才处理其配方
          if (!completedMaterials.has(mat.id)) {
            processRecipe(foundItem.recipe, mat.quantity * multiplier);
          } else {
            // 跳过已完成的半成品配方
          }
        } else {
          // 基础材料，加入1级材料统计（无论是否完成都要显示）
          addMaterial(mat.id, mat.quantity * multiplier, true);
        }
      } catch (error) {
        console.error(`处理材料[${i}]时出错:`, error);
        console.error('错误的材料对象:', recipe[i]);
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
  
  // 渲染2级材料（半成品）
  const level2Mats = Object.values(materialMap);
  if (level2Mats.length > 0) {
    materialsList.innerHTML = level2Mats.map(mat => {
      const isCompleted = completedMaterials.has(mat.id);
      const completedClass = isCompleted ? 'completed' : '';
      const completedStyle = isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : '';
      
      return `
        <div class="material-item ${completedClass}" data-id="${mat.id}">
          <div class="material-info">
            <div class="material-icon"><img src="${getItemIcon(mat.name, mat.icon)}" alt="${mat.name}" style="width:24px;height:24px;"></div>
            <div class="material-details">
              <h4 style="${completedStyle}" class="material-name-clickable">${mat.name}</h4>
            </div>
          </div>
          <div class="material-quantity">×${mat.total}</div>
        </div>
      `;
    }).join('');
  } else {
    materialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>无需半成品材料</p></div>';
  }
  
  // 渲染1级材料（基础材料）
  const level1Mats = Object.values(baseMaterialMap);
  // 碎晶类材料ID
  const crystalIds = [
    '风之碎晶', '冰之碎晶', '雷之碎晶', '土之碎晶', '水之碎晶', '火之碎晶',
    'wind_crystal', 'ice_crystal', 'lightning_crystal', 'earth_crystal', 'water_crystal', 'fire_crystal'
  ];
  // 先分组
  const normalMats = level1Mats.filter(mat => !crystalIds.includes(mat.id) && !crystalIds.includes(mat.name));
  const crystalMats = level1Mats.filter(mat => crystalIds.includes(mat.id) || crystalIds.includes(mat.name));
  // 合并，碎晶类排最后
  const sortedLevel1Mats = [...normalMats, ...crystalMats];
  if (sortedLevel1Mats.length > 0) {
    baseMaterialsList.innerHTML = sortedLevel1Mats.map(mat => {
      const isCompleted = completedBaseMaterials.has(mat.id);
      const completedClass = isCompleted ? 'completed' : '';
      const completedStyle = isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : '';
      
      return `
        <div class="material-item ${completedClass}" data-id="${mat.id}">
          <div class="material-info">
            <div class="material-icon"><img src="${getItemIcon(mat.name, mat.icon)}" alt="${mat.name}" style="width:24px;height:24px;"></div>
            <div class="material-details">
              <h4 style="${completedStyle}" class="material-name-clickable">${mat.name}</h4>
            </div>
          </div>
          <div class="material-quantity">×${mat.total}</div>
        </div>
      `;
    }).join('');
  } else {
    baseMaterialsList.innerHTML = '<div class="empty-state"><i class="fas fa-boxes"></i><p>无需基础材料</p></div>';
  }
  
  // 添加点击事件监听器
  addItemClickListeners();
}

// 设备切换功能
function switchToMobile() {
  // 清除强制桌面端标记
  localStorage.removeItem('force-desktop');
  // 保存当前状态到localStorage
  localStorage.setItem('force-mobile', 'true');
  // 跳转到移动端页面
  window.location.href = 'mobile.html';
}

// 初始化设备切换按钮
function initDeviceToggle() {
  const deviceToggle = document.getElementById('deviceToggle');
  if (deviceToggle) {
    deviceToggle.addEventListener('click', switchToMobile);
  }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  // 为新用户设置默认白天模式
  if (!localStorage.getItem('ff14-calculator-theme')) {
    localStorage.setItem('ff14-calculator-theme', 'light');
  }
  
  // 初始化主题管理器
  window.themeManager = new ThemeManager();
  
  // 初始化设备切换按钮
  initDeviceToggle();
  
  // 时间显示已在全局初始化
  
  // 初始化闹钟功能
  loadAlarmItems();
  startCountdownTimer();
  
  // 初始化导出Excel功能
  bindExportExcelEvent();
  
  // 加载默认职业数据
  onJobChange('quickcalc');
  
  // 初始化天气面板
  initWeatherPanel();
});

// ===================== 天气预报（内置算法与数据） =====================
function initWeatherPanel() {
  const toggleBtn = document.getElementById('weatherToggle');
  const panel = document.getElementById('weatherPanel');
  const closeBtn = document.getElementById('weatherPanelClose');
  const zoneSelect = document.getElementById('weatherZoneSelect');
  const listEl = document.getElementById('weatherForecastList');
  const headerToggle = document.getElementById('weatherTimeToggle');

  if (!toggleBtn || !panel || !closeBtn || !zoneSelect || !listEl || !headerToggle) return;

  // 绑定开关
  toggleBtn.addEventListener('click', () => {
    const isActive = panel.classList.toggle('active');
    panel.setAttribute('aria-hidden', String(!isActive));
    if (isActive) {
      populateZones(zoneSelect);
      refreshWeatherForecast();
      maybeDebugLogCurrentWeathers();
    }
  });
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
  });
  // 切换地区：清除天气筛选，恢复默认8段
  zoneSelect.addEventListener('change', () => {
    weatherFilterKey = null;
    refreshWeatherForecast();
  });

  // 节流：每500ms最多刷新一次列表
  let lastRefresh = 0;
  window.refreshWeatherForecastThrottled = function() {
    const now = Date.now();
    if (now - lastRefresh > 500) {
      lastRefresh = now;
      if (panel.classList.contains('active')) refreshWeatherForecast();
    }
  };

  // ========== 时间显示（ET/LT 切换，仅针对天气面板） ==========
  let weatherTimeMode = 'LT'; // 默认显示 LT
  let weatherFilterKey = null; // 点击底部图标筛选的天气键，null 表示不筛选
  headerToggle.addEventListener('click', () => {
    weatherTimeMode = weatherTimeMode === 'ET' ? 'LT' : 'ET';
    refreshWeatherForecast();
    // 同步按钮文本
    headerToggle.innerText = weatherTimeMode;
  });
  // 初始化按钮文本
  headerToggle.innerText = weatherTimeMode;

  // 调试：输出当前各区域天气命中（不影响UI）。仅在打开面板时触发；或加上 ?weatherDebug=1 强制输出。
  function maybeDebugLogCurrentWeathers() {
    const params = new URLSearchParams(location.search || '');
    if (!params.has('weatherDebug')) return;
    const nowStart = nearestIntervalStart(Date.now());
    const rows = [];
    Object.keys(WEATHER_DATA_MINI).forEach(key => {
      const val = calculateWeatherValue(nowStart);
      const w = pickWeatherByValue(key, val);
      rows.push({ 区域: WEATHER_LABELS[key] || key, 值: val, 天气: WEATHER_NAME_CN[w.name] || w.name });
    });
    try { console.table(rows); } catch (_) { console.log(rows); }
  }

  function populateZones(selectEl) {
    if (selectEl.options.length > 0) return; // 只填充一次
    selectEl.innerHTML = '';

    // 分组定义（顺序固定）
    const groups = WEATHER_ZONE_GROUPS;
    let firstValue = '';
    groups.forEach(group => {
      const keys = group.keys.filter(k => WEATHER_DATA_MINI[k]);
      if (keys.length === 0) return;
      const og = document.createElement('optgroup');
      og.label = group.label;
      keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = WEATHER_LABELS[key] || key;
        og.appendChild(opt);
        if (!firstValue) firstValue = key;
      });
      selectEl.appendChild(og);
    });
    // 默认选中第一项（乌尔达哈）
    if (firstValue) selectEl.value = firstValue;
  }

  function refreshWeatherForecast() {
    const zone = zoneSelect.value || 'gridania';
    let forecasts;
    if (weatherFilterKey) {
      // 若该地区不可能出现所选天气，给出提示并清空列表
      if (!zoneHasWeather(zone, weatherFilterKey)) {
        listEl.innerHTML = `<div class="empty-state"><i class="fas fa-info-circle"></i><p>该地区不会出现“${WEATHER_NAME_CN[weatherFilterKey] || weatherFilterKey}”。</p></div>`;
        renderWeatherIconGrid();
        return;
      }
      forecasts = getNextMatchingForecasts(zone, weatherFilterKey, 8);
    } else {
      forecasts = getForecasts(zone, 8); // 默认显示接下来8个时段
    }
    listEl.innerHTML = forecasts.map((f, idx) => {
      const icon = getWeatherIconPath(f.name);
      const timeText = weatherTimeMode === 'ET' ? `ET ${f.intervalLabel.slice(3)}` : `LT ${formatLTFromIntervalStart(f.intervalStart)}`;
      const countdownHtml = idx === 0 ? buildWeatherCountdownHtml(f) : '';
      return `
      <div class="weather-forecast-item">
        <div class="weather-left">
          <span class="weather-time-badge">${timeText}</span>
          <img class="weather-icon" src="${icon}" alt="${WEATHER_NAME_CN[f.name] || f.name}">
          <span class="weather-name">${WEATHER_NAME_CN[f.name] || f.name}</span>
        </div>
        ${countdownHtml}
      </div>`;
    }).join('');
    startWeatherCountdownTick();

    // 渲染底部天气类型图标按钮
    renderWeatherIconGrid();
  }

  // 底部两排天气图标按钮
  function renderWeatherIconGrid() {
    const grid = document.getElementById('weatherIconGrid');
    if (!grid) return;
    const zone = zoneSelect.value || 'gridania';
    const orderedWeather = [
      'clearSkies','fairSkies','clouds','fog','rain','showers','wind','gales',
      'thunder','thunderstorms','snow','blizzard','gloom','heatWaves','dustStorms'
    ];
    const html = orderedWeather.map(key => {
      const cn = WEATHER_NAME_CN[key] || key;
      const icon = getWeatherIconPath(key);
      const canAppear = zoneHasWeather(zone, key);
      const stateClass = weatherFilterKey === key ? ' active' : '';
      const disabledAttr = canAppear ? '' : ' disabled aria-disabled="true"';
      const disabledClass = canAppear ? '' : ' disabled';
      return `<button class="weather-icon-btn${stateClass}${disabledClass}" data-weather="${key}" data-tooltip="${cn}" aria-label="${cn}"${disabledAttr}><img src="${icon}" alt="${cn}"></button>`;
    }).join('');
    grid.innerHTML = html;
    // 绑定点击筛选
    grid.querySelectorAll('.weather-icon-btn').forEach(btn => {
      if (btn.classList.contains('disabled')) return; // 不可用则不绑定
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-weather');
        // 点击同一按钮可取消筛选
        weatherFilterKey = (weatherFilterKey === key) ? null : key;
        refreshWeatherForecast();
      });
    });
  }

  // 判断某地区是否可能出现某天气
  function zoneHasWeather(zoneKey, weatherKey) {
    const table = WEATHER_DATA_MINI[zoneKey] || [];
    return table.some(w => w.name === weatherKey);
  }

  // 获取该地区接下来满足某天气的N个时段
  function getNextMatchingForecasts(zoneKey, weatherKey, count = 8) {
    const result = [];
    let t = nearestIntervalStart(Date.now());
    let guard = 0; // 安全上限，防止极端配置导致死循环
    const MAX_STEPS = 2000; // 约 2000 段（> 66 小时现实时间）
    while (result.length < count && guard < MAX_STEPS) {
      const label = nearestEorzeaIntervalLabel(t);
      const val = calculateWeatherValue(t);
      const weather = pickWeatherByValue(zoneKey, val);
      if (weather.name === weatherKey) {
        result.push({ intervalLabel: `ET ${label.slice(0, 5)}`, intervalStart: t, name: weather.name });
      }
      t += EORZEA_8_HOUR_MS;
      guard++;
    }
    if (result.length === 0) {
      return [];
    }
    // 若不足 count，也按已找到的返回
    return result.slice(0, count);
  }
}

// 轻量天气数据（新增 5 组区域，权重加总为100；数据为通用占比，后续可替换精确表）
const WEATHER_DATA_MINI = {
  // 1) 乌尔达哈与萨纳兰分区
  uldah: [
    { name: 'clearSkies', chance: 40 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 25 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 5 },
  ],
  centralThanalan: [ // 中萨纳兰
    { name: 'dustStorms', chance: 15 },
    { name: 'clearSkies', chance: 40 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 10 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 5 },
  ],
  westernThanalan: [ // 西萨纳兰
    { name: 'clearSkies', chance: 40 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 25 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 5 },
  ],
  easternThanalan: [ // 东萨纳兰
    { name: 'clearSkies', chance: 40 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 10 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 5 },
    { name: 'showers', chance: 15 },
  ],
  southernThanalan: [ // 南萨纳兰
    { name: 'heatWaves', chance: 20 },
    { name: 'clearSkies', chance: 40 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 10 },
    { name: 'fog', chance: 10 },
  ],
  northernThanalan: [ // 北萨纳兰
    { name: 'clearSkies', chance: 5 },
    { name: 'fairSkies', chance: 15 },
    { name: 'clouds', chance: 30 },
    { name: 'fog', chance: 50 },
  ],

  // 2) 格里达尼亚与黑衣森林分区
  gridania: [
    // 参考标准：含两段晴朗（fairSkies）权重
    { name: 'rain', chance: 20 },
    { name: 'fog', chance: 10 },
    { name: 'clouds', chance: 10 },
    { name: 'fairSkies', chance: 15 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 15 },
  ],
  centralShroud: [ // 黑衣森林中央林区（centralShroud）
    { name: 'thunder', chance: 5 },
    { name: 'rain', chance: 15 },
    { name: 'fog', chance: 10 },
    { name: 'clouds', chance: 10 },
    { name: 'fairSkies', chance: 15 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 15 },
  ],
  eastShroud: [ // 黑衣森林东部林区（eastShroud）
    { name: 'thunder', chance: 5 },
    { name: 'rain', chance: 15 },
    { name: 'fog', chance: 10 },
    { name: 'clouds', chance: 10 },
    { name: 'fairSkies', chance: 15 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 15 },
  ],
  southShroud: [ // 黑衣森林南部林区（southShroud）
    { name: 'fog', chance: 5 },
    { name: 'thunderstorms', chance: 5 },
    { name: 'thunder', chance: 15 },
    { name: 'fog', chance: 5 },
    { name: 'clouds', chance: 10 },
    { name: 'fairSkies', chance: 30 },
    { name: 'clearSkies', chance: 30 },
  ],
  northShroud: [ // 黑衣森林北部林区（northShroud）
    { name: 'fog', chance: 5 },
    { name: 'showers', chance: 5 },
    { name: 'rain', chance: 15 },
    { name: 'fog', chance: 5 },
    { name: 'clouds', chance: 10 },
    { name: 'fairSkies', chance: 30 },
    { name: 'clearSkies', chance: 30 },
  ],

  // 3) 利姆萨与拉诺西亚分区
  limsaLominsa: [
    { name: 'clouds', chance: 20 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 30 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 10 },
  ],
  middleLaNoscea: [ // 中拉诺西亚
    { name: 'clouds', chance: 20 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 20 },
    { name: 'wind', chance: 10 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 10 },
  ],
  lowerLaNoscea: [ // 拉诺西亚低地
    { name: 'clouds', chance: 20 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 20 },
    { name: 'wind', chance: 10 },
    { name: 'fog', chance: 10 },
    { name: 'rain', chance: 10 },
  ],
  easternLaNoscea: [ // 东拉诺西亚
    { name: 'fog', chance: 5 },
    { name: 'clearSkies', chance: 45 },
    { name: 'fairSkies', chance: 30 },
    { name: 'clouds', chance: 10 },
    { name: 'rain', chance: 5 },
    { name: 'showers', chance: 5 },
  ],
  westernLaNoscea: [ // 西拉诺西亚
    { name: 'fog', chance: 10 },
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 20 },
    { name: 'wind', chance: 10 },
    { name: 'gales', chance: 10 },
  ],
  upperLaNoscea: [ // 拉诺西亚高地
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 20 },
    { name: 'fog', chance: 10 },
    { name: 'thunder', chance: 10 },
    { name: 'thunderstorms', chance: 10 },
  ],
  outerLaNoscea: [ // 拉诺西亚外地
    { name: 'clearSkies', chance: 30 },
    { name: 'fairSkies', chance: 20 },
    { name: 'clouds', chance: 20 },
    { name: 'fog', chance: 15 },
    { name: 'rain', chance: 15 },
  ],

  // 4) 库尔札斯中央高地
  coerthasCentralHighlands: [
    { name: 'blizzard', chance: 20 },
    { name: 'snow', chance: 40 },
    { name: 'fairSkies', chance: 10 },
    { name: 'clearSkies', chance: 5 },
    { name: 'clouds', chance: 15 },
    { name: 'fog', chance: 10 },
  ],

  // 5) 摩杜纳
  morDhona: [
    { name: 'clouds', chance: 15 },
    { name: 'fog', chance: 15 },
    { name: 'gloom', chance: 30 },
    { name: 'clearSkies', chance: 15 },
    { name: 'fairSkies', chance: 25 },
  ],
};

// 区域中文名
const WEATHER_LABELS = {
  // 1) 乌尔达哈 + 萨纳兰
  uldah: '乌尔达哈',
  westernThanalan: '西萨纳兰',
  centralThanalan: '中萨纳兰',
  easternThanalan: '东萨纳兰',
  southernThanalan: '南萨纳兰',
  northernThanalan: '北萨纳兰',

  // 2) 格里达尼亚 + 黑衣森林
  gridania: '格里达尼亚',
  centralShroud: '黑衣森林中央林区',
  eastShroud: '黑衣森林东部林区',
  southShroud: '黑衣森林南部林区',
  northShroud: '黑衣森林北部林区',

  // 3) 利姆萨 + 拉诺西亚
  limsaLominsa: '利姆萨·罗敏萨',
  middleLaNoscea: '中拉诺西亚',
  lowerLaNoscea: '拉诺西亚低地',
  easternLaNoscea: '东拉诺西亚',
  westernLaNoscea: '西拉诺西亚',
  upperLaNoscea: '拉诺西亚高地',
  outerLaNoscea: '拉诺西亚外地',

  // 4) 库尔札斯
  coerthasCentralHighlands: '库尔札斯中央高地',

  // 5) 摩杜纳
  morDhona: '摩杜纳',

  // 其余（保留，避免丢失原有地区）
  ishgard: '伊修加德',
  kugane: '黄金港',
  shirogane: '白银乡',
};

// 区域分组（用于下拉 optgroup）
const WEATHER_ZONE_GROUPS = [
  { label: '乌尔达哈', keys: ['uldah', 'westernThanalan', 'centralThanalan', 'easternThanalan', 'southernThanalan', 'northernThanalan'] },
  { label: '格里达尼亚', keys: ['gridania', 'centralShroud', 'eastShroud', 'southShroud', 'northShroud'] },
  { label: '利姆萨·罗敏萨', keys: ['limsaLominsa', 'middleLaNoscea', 'lowerLaNoscea', 'easternLaNoscea', 'westernLaNoscea', 'upperLaNoscea', 'outerLaNoscea'] },
  { label: '伊修加德', keys: ['coerthasCentralHighlands'] },
  { label: '其他', keys: ['morDhona'] },
];

// 天气中文名
const WEATHER_NAME_CN = {
  clearSkies: '碧空',
  fairSkies: '晴朗',
  clouds: '阴云',
  fog: '薄雾',
  rain: '小雨',
  showers: '暴雨',
  wind: '微风',
  gales: '强风',
  thunder: '打雷',
  thunderstorms: '雷雨',
  snow: '小雪',
  blizzard: '暴雪',
  gloom: '妖雾',
  umbralWind: '灵风',
  umbralStatic: '灵电',
  heatWaves: '热浪',
  dustStorms: '扬沙',
};

// 参考 weather.js 算法（自实现，避免直接调用子项目）
const EORZEA_HOUR_MS = 175 * 1000; // 1艾时 = 175000ms = 175s
const EORZEA_8_HOUR_MS = 8 * EORZEA_HOUR_MS;
const EORZEA_DAY_MS = 24 * EORZEA_HOUR_MS;

function calculateWeatherValue(unixMs) {
  // 标准 FFXIV 天气种子算法（确保使用无符号32位整数运算）
  const ms = Math.floor(unixMs);
  const bell = Math.floor(ms / 175000) % 24; // 1艾时=175000ms
  const increment = (bell + 8 - (bell % 8)) % 24; // 0/8/16
  const totalDays = Math.floor(ms / 4200000); // 1艾日=24*175000ms
  const calcBase = totalDays * 100 + increment;
  const step1 = ((calcBase << 11) ^ calcBase) >>> 0;
  const step2 = ((step1 >>> 8) ^ step1) >>> 0;
  return step2 % 100;
}

function nearestIntervalStart(unixMs) {
  // 现实时间中，8艾时为一个段：对齐到 bell 的 8 小时边界
  const ms = Math.floor(unixMs);
  const bell = Math.floor(ms / EORZEA_HOUR_MS);
  const alignedBell = bell - (bell % 8);
  return alignedBell * EORZEA_HOUR_MS;
}

function nearestEorzeaIntervalLabel(unixMs) {
  const bell = Math.floor(unixMs / EORZEA_HOUR_MS) % 24;
  const h = (bell - (bell % 8) + 24) % 24; // 对齐到段起点小时
  const hh = String(h).padStart(2, '0');
  return `${hh}:00`;
}

function pickWeatherByValue(zoneKey, value) {
  const table = WEATHER_DATA_MINI[zoneKey] || [];
  let cursor = 0;
  for (let i = 0; i < table.length; i++) {
    cursor += table[i].chance;
    if (value < cursor) return table[i];
  }
  return table[table.length - 1] || { name: 'clearSkies', chance: 100 };
}

function getForecasts(zoneKey, intervals = 6) {
  const result = [];
  // 以当前时刻所在段的起点为基准
  let t = nearestIntervalStart(Date.now());
  for (let i = 0; i < intervals; i++) {
    const label = nearestEorzeaIntervalLabel(t);
    const val = calculateWeatherValue(t);
    const weather = pickWeatherByValue(zoneKey, val);
    result.push({ intervalLabel: `ET ${label.slice(0, 5)}`, intervalStart: t, name: weather.name });
    t += EORZEA_8_HOUR_MS; // 下一段
  }
  return result;
}

// 天气图标路径（基于中文名，对应 assets/icons/weather/*）
function getWeatherIconPath(weatherKey) {
  const name = WEATHER_NAME_CN[weatherKey] || '';
  if (!name) return 'assets/icons/weather/晴朗.png';
  return `assets/icons/weather/${name}.png`;
}

// 从艾欧泽亚段起点换算现实本地时间（段起点 t 是现实时间戳）
function formatLTFromIntervalStart(realUnixMs) {
  const d = new Date(realUnixMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// 计算倒计时文本（基于 LT 时间和当前本地时间）
function getWeatherCountdownText(forecast, mode) {
  const now = Date.now();
  const start = forecast.intervalStart; // 本段现实起点
  const end = start + EORZEA_8_HOUR_MS; // 下一段起点即结束
  const msLeftToStart = start - now;
  const msLeftToEnd = end - now;
  if (msLeftToStart > 0) {
    // 未出现
    return `距离天气变化 ${formatMs(Math.max(0, msLeftToStart))}`;
  }
  if (msLeftToEnd > 0) {
    // 已出现
    return `距离天气变化 ${formatMs(Math.max(0, msLeftToEnd))}`;
  }
  // 已过期
  return `即将更新`;
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// 构建与采集倒计时一致的绿色进度条样式
function buildWeatherCountdownHtml(forecast) {
  const info = getWeatherCountdownInfo(forecast);
  const countdownClass = info.isAppearing ? 'alarm-countdown pending' : 'alarm-countdown active-item';
  const progressStyle = `style="--progress: ${info.progress}%"`;
  const text = getWeatherCountdownText(forecast);
  return `
    <div class="${countdownClass} weather-countdown" ${progressStyle}>
      <div class="countdown-progress"></div>
      <span class="countdown-text">${text}</span>
    </div>
  `;
}

// 计算进度信息（复用采集逻辑思路）
function getWeatherCountdownInfo(forecast) {
  const now = Date.now();
  const start = forecast.intervalStart;
  const end = start + EORZEA_8_HOUR_MS;
  const msLeftToStart = start - now;
  const msLeftToEnd = end - now;
  const isAppearing = msLeftToStart > 0;
  let progress = 0;
  const total = EORZEA_8_HOUR_MS;
  const remaining = Math.max(0, isAppearing ? msLeftToStart : msLeftToEnd);
  progress = Math.max(0, Math.min(100, (remaining / total) * 100));
  return { isAppearing, progress };
}

let weatherCountdownTimer = null;
function startWeatherCountdownTick() {
  if (weatherCountdownTimer) clearInterval(weatherCountdownTimer);
  weatherCountdownTimer = setInterval(() => {
    const first = document.querySelector('#weatherForecastList .weather-forecast-item');
    if (!first) return;
    // 解析第一条的时间起点（我们记录在 dataset 上会更好，但这里直接重算）
    // 直接刷新整块，简单可靠
    const zoneSelect = document.getElementById('weatherZoneSelect');
    if (!zoneSelect) return;
    // 触发节流刷新
    if (typeof window.refreshWeatherForecastThrottled === 'function') {
      window.refreshWeatherForecastThrottled();
    }
  }, 1000);
}

