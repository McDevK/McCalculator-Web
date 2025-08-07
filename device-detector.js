// 设备检测脚本
// 根据用户设备类型自动选择合适的前端页面

(function() {
    'use strict';
    
    // 检测是否为移动设备
    function isMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // 检测移动设备
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        const isMobile = mobileRegex.test(userAgent);
        
        // 检测屏幕尺寸
        const isSmallScreen = window.innerWidth <= 768;
        
        // 检测触摸支持
        const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 检测设备像素比（高分辨率屏幕）
        const isHighDPI = window.devicePixelRatio > 1;
        
        // 综合判断：如果是移动设备、小屏幕、支持触摸，则认为是移动端
        return isMobile || (isSmallScreen && hasTouchSupport);
    }
    
    // 检测是否为平板设备
    function isTabletDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // 检测平板设备
        const tabletRegex = /ipad|android(?=.*\b(?:tablet|tab)\b)/i;
        const isTablet = tabletRegex.test(userAgent);
        
        // 检测屏幕尺寸（平板通常介于768-1024之间）
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const isTabletSize = (screenWidth >= 768 && screenWidth <= 1024) || 
                            (screenHeight >= 768 && screenHeight <= 1024);
        
        return isTablet || isTabletSize;
    }
    
    // 检测是否为桌面设备
    function isDesktopDevice() {
        return !isMobileDevice() && !isTabletDevice();
    }
    
    // 获取当前页面路径
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        return filename;
    }
    
    // 重定向到合适的页面
    function redirectToAppropriatePage() {
        const currentPage = getCurrentPage();
        
        // 检查是否有强制切换标记
        const forceMobile = localStorage.getItem('force-mobile') === 'true';
        const forceDesktop = localStorage.getItem('force-desktop') === 'true';
        
        // 如果强制切换到移动端
        if (forceMobile) {
            if (currentPage !== 'mobile.html') {
                window.location.href = 'mobile.html';
            }
            return;
        }
        
        // 如果强制切换到桌面端
        if (forceDesktop) {
            if (currentPage !== 'index.html') {
                window.location.href = 'index.html';
            }
            return;
        }
        
        // 如果当前已经在合适的页面，不进行重定向
        if (isMobileDevice() && currentPage === 'mobile.html') {
            return;
        }
        
        if (isDesktopDevice() && currentPage === 'index.html') {
            return;
        }
        
        // 根据设备类型重定向
        if (isMobileDevice()) {
            // 移动设备重定向到移动端页面
            if (currentPage !== 'mobile.html') {
                window.location.href = 'mobile.html';
            }
        } else {
            // 桌面设备重定向到桌面端页面
            if (currentPage !== 'index.html' && currentPage !== '') {
                window.location.href = 'index.html';
            }
        }
    }
    
    // 页面加载完成后执行检测
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', redirectToAppropriatePage);
    } else {
        redirectToAppropriatePage();
    }
    
    // 监听窗口大小变化，动态调整
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // 只有在页面大小发生显著变化时才重定向
            const currentWidth = window.innerWidth;
            const previousWidth = window.previousWidth || currentWidth;
            
            // 如果宽度变化超过200px，才考虑重定向
            if (Math.abs(currentWidth - previousWidth) > 200) {
                window.previousWidth = currentWidth;
                redirectToAppropriatePage();
            }
        }, 500); // 延迟500ms，避免频繁重定向
    });
    
    // 暴露检测函数供外部使用
    window.DeviceDetector = {
        isMobile: isMobileDevice,
        isTablet: isTabletDevice,
        isDesktop: isDesktopDevice,
        redirect: redirectToAppropriatePage
    };
    
})(); 