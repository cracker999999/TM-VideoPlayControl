// ==UserScript==
// @name         视频网站 播放控制
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在YouTube和B站视频播放页面上按键+增加播放速度，按键-减小播放速度；在虎牙按f全屏
// @author       Leen
// @match        *://www.youtube.com/*
// @match        *://www.youtube.com/watch?v=*
// @match        *://www.bilibili.com/video/*
// @match        *://live.bilibili.com/*
// @match        *://www.huya.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 配置参数
    const config = {
        speedIncrement: 0.25, // 每次增加/减少的速度值
        minSpeed: 0.25, // 最小播放速度
        maxSpeed: 5.0, // 最大播放速度
        showNotification: true, // 是否显示速度变化通知
        notificationDuration: 1000 // 通知显示时间（毫秒）
    };

    // 网站检测
    const isHuya = () => window.location.hostname.includes('huya.com');
    const isBiliBiliLive = () => window.location.hostname.includes('live.bilibili.com');

    // 创建通知元素
    let notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 16px;
        font-weight: bold;
        z-index: 9999;
        display: none;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(notification);

    // 显示通知
    function showNotification(message) {
        if (!config.showNotification) return;

        notification.textContent = message;
        notification.style.display = 'block';
        notification.style.opacity = '1';
        console.log(message);

        // 设置定时器，自动隐藏通知
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, config.notificationDuration);
    }

    // 获取当前视频元素（带缓存）
    let cachedVideo = null;
    function getVideoElement() {
        if (cachedVideo && document.contains(cachedVideo)) return cachedVideo;

        cachedVideo = document.querySelector('video.html5-main-video') //YouTube
                   || document.querySelector('video.bilibili-player-video') //b站
                   || document.querySelector('.bpx-player-video-wrap video') //b站
                   || document.querySelector('#hy-video') //虎牙
                   || document.querySelector('video');

        return cachedVideo;
    }

    // 改变播放速度
    function changePlaybackSpeed(delta) {
        const video = getVideoElement();
        if (!video) return;

        let newSpeed = Math.round((video.playbackRate + delta) * 100) / 100;
        newSpeed = Math.max(config.minSpeed, Math.min(config.maxSpeed, newSpeed));

        video.playbackRate = newSpeed;
        showNotification(`播放速度: ${newSpeed.toFixed(2)}x`);
    }

    // ========== 超限音量控制 ==========
    const audioState = {
        extraVolume: 1,
        gainNode: null,
        audioCtx: null,
        sourceNode: null,
        lastVideo: null
    };

    function safeDisconnect(node) {
        try { node?.disconnect(); } catch (e) {}
    }

    // 初始化Web Audio API
    function initAudioContext(video) {
        if (!audioState.audioCtx) {
            audioState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!audioState.sourceNode || audioState.lastVideo !== video) {
            safeDisconnect(audioState.sourceNode);
            audioState.sourceNode = audioState.audioCtx.createMediaElementSource(video);
            audioState.lastVideo = video;
        }
        if (!audioState.gainNode) {
            audioState.gainNode = audioState.audioCtx.createGain();
        }
    }

    function applyExtraVolume(video, factor) {
        if (!video) return;

        if (factor <= 1) {
            // 恢复原生音量
            if (audioState.gainNode && audioState.sourceNode) {
                safeDisconnect(audioState.sourceNode);
                safeDisconnect(audioState.gainNode);
                try {
                    audioState.sourceNode.connect(audioState.audioCtx.destination);
                } catch (e) {}
            }
            audioState.extraVolume = 1;
            showNotification(`音量: ${(video.volume * 100).toFixed(0)}%`);
            return;
        }

        initAudioContext(video);
        audioState.gainNode.gain.value = factor;
        safeDisconnect(audioState.sourceNode);
        audioState.sourceNode.connect(audioState.gainNode);
        audioState.gainNode.connect(audioState.audioCtx.destination);
        audioState.extraVolume = factor;
        showNotification(`超限音量: ${(video.volume * 100 * factor).toFixed(0)}%`);
    }

    function handleVolumeKeyByBracket(event, isUp) {
        const video = getVideoElement();
        if (!video) return;
        // 只有音量大于等于100%或已超限时才允许调节
        if (video.volume >= 1 || audioState.extraVolume > 1) {
            if (isUp) {
                // 增大超限音量
                const newVolume = audioState.extraVolume === 1 ? 1.5 : Math.min(audioState.extraVolume + 0.5, 5);
                applyExtraVolume(video, newVolume);
                event.preventDefault();
            } else {
                // 减小超限音量
                if (audioState.extraVolume > 1) {
                    const newVolume = audioState.extraVolume - 0.5 <= 1 ? 1 : audioState.extraVolume - 0.5;
                    applyExtraVolume(video, newVolume);
                    event.preventDefault();
                }
            }
        }
    }

    // ========== 网站特定操作 ==========
    function clickHuyaButton(buttonId, event) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.click();
            event.preventDefault();
            return true;
        }
        return false;
    }

    function clickBiliBiliControl(video, selector, index) {
        imitataMouseMove(video, 0, 0);
        document.querySelectorAll(selector)[index].click();
    }

    const siteHandlers = {
        mute: (video, event) => {
            if (isHuya()) return clickHuyaButton('player-sound-btn', event);
            if (isBiliBiliLive()) clickBiliBiliControl(video, '.left-area .icon', 2);
        },
        fullscreen: (video, event) => {
            if (isHuya()) return clickHuyaButton('player-fullscreen-btn', event);
            if (isBiliBiliLive()) clickBiliBiliControl(video, '.right-area .icon', 0);
        },
        theater: (video, event) => {
            if (isHuya()) return clickHuyaButton('player-fullpage-btn', event);
            if (isBiliBiliLive()) clickBiliBiliControl(video, '.right-area .icon', 1);
        }
    };

    // 键盘事件监听
    function handleKeyDown(event) {
        // 忽略在输入框中的按键事件
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
            return;
        }

        const video = getVideoElement();

        // 按键 + 增加速度
        if (event.key === '+' || event.key === '=') {
            changePlaybackSpeed(config.speedIncrement);
            event.preventDefault();
        }
        // 按键 - 减小速度
        else if (event.key === '-' || event.key === '_') {
            changePlaybackSpeed(-config.speedIncrement);
            event.preventDefault();
        }
        // 用 [ ] 控制超限音量
        else if (event.key === ']') {
            handleVolumeKeyByBracket(event, true);
        }
        else if (event.key === '[') {
            handleVolumeKeyByBracket(event, false);
        }
        // M 键 - 静音/取消静音
        else if (event.key === 'm' || event.key === 'M') {
            siteHandlers.mute(video, event);
        }
        // F键点击全屏按钮
        else if (event.key === 'f' || event.key === 'F') {
            siteHandlers.fullscreen(video, event);
        }
        //P键剧场模式
        else if (event.key === 'p' || event.key === 'P') {
            siteHandlers.theater(video, event);
        }
    }

    /* 鼠标按键事件模拟 */
    function imitateMouseClick(type, oElement, iClientX, iClientY) {
        var oEvent;
        oEvent = document.createEvent("MouseEvents");
        var rect = oElement.getBoundingClientRect();
        oEvent.initMouseEvent(type, true, true, document.defaultView, 0, 0, 0, rect.x + iClientX, rect.y + iClientY, false, false, false, false, 0, null);
        oElement.dispatchEvent(oEvent);
    }

    /* 鼠标移动事件模拟 */
    function imitataMouseMove(oElement, clientX, clientY) {
        const doc = oElement.ownerDocument;
        const win = doc.defaultView || doc.parentWindow;
        const mousemove = document.createEvent("MouseEvent");
        mousemove.initMouseEvent("mousemove", true, true, win, 0, clientX, clientY, clientX, clientY, 0, 0, 0, 0, 0, null);
        oElement.dispatchEvent(mousemove);
    }

    // 清理资源
    function cleanup() {
        safeDisconnect(audioState.sourceNode);
        safeDisconnect(audioState.gainNode);
        if (audioState.audioCtx) {
            audioState.audioCtx.close().catch(() => {});
        }
        document.removeEventListener('keydown', handleKeyDown);
    }

    // 初始化
    let isInitialized = false;
    function init() {
        if (isInitialized) return;

        setTimeout(() => {
            document.addEventListener('keydown', handleKeyDown);
            isInitialized = true;
            console.log('播放速度控制脚本已加载');
        }, 2000); // 2 seconds delay
    }

    window.addEventListener('load', init);
    window.addEventListener('yt-navigate-finish', () => {
        cachedVideo = null;
        init();
    });
    window.addEventListener('beforeunload', cleanup);
    init();
})();
