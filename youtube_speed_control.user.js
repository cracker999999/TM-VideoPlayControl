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

    // 获取当前视频元素
    function getVideoElement() {
        // YouTube视频选择器
        const youtubeVideo = document.querySelector('video.html5-main-video');//标签名 class
        if (youtubeVideo) return youtubeVideo;
        
        // B站视频选择器
        const bilibiliVideo = document.querySelector('video.bilibili-player-video') 
                            || document.querySelector('.bpx-player-video-wrap video'); //class元素内部的video
        if (bilibiliVideo) return bilibiliVideo;

        // 虎牙视频选择器
        const huyaVideo = document.querySelector('#hy-video');//id
        if (huyaVideo) return huyaVideo;

        // 普通视频选择器
        const video = document.querySelector('video');//标签名
        if (video) return video;

        return null;
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

    // ========== 新增：超限音量控制相关 ==========
    let extraVolume = 1; // 超限音量倍数，1为正常
    let gainNode = null;
    let audioCtx = null;
    let sourceNode = null;
    let lastVideo = null;

    function applyExtraVolume(video, factor) {
        if (!video) return;
        if (factor <= 1) {
            // 恢复原生音量
            if (gainNode && sourceNode) {
                try {
                    sourceNode.disconnect();
                    gainNode.disconnect();
                } catch (e) {}
                try {
                    sourceNode.connect(audioCtx.destination);
                } catch (e) {}
            }
            extraVolume = 1;
            showNotification(`音量: ${(video.volume * 100).toFixed(0)}%`);
            return;
        }
        // 初始化Web Audio API
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!sourceNode || lastVideo !== video) {
            if (sourceNode) {
                try { sourceNode.disconnect(); } catch (e) {}
            }
            sourceNode = audioCtx.createMediaElementSource(video);
            lastVideo = video;
        }
        if (!gainNode) {
            gainNode = audioCtx.createGain();
        }
        gainNode.gain.value = factor;
        try {
            sourceNode.disconnect();
        } catch (e) {}
        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        extraVolume = factor;
        showNotification(`超限音量: ${(video.volume * 100 * factor).toFixed(0)}%`);
    }

    function handleVolumeKeyByBracket(event, isUp) {
        const video = getVideoElement();
        if (!video) return;
        // 只有音量大于等于100%或已超限时才允许调节
        if (video.volume >= 1 || extraVolume > 1) {
            if (isUp) {
                // 增大超限音量
                if (extraVolume === 1) {
                    applyExtraVolume(video, 1.5);
                } else {
                    applyExtraVolume(video, Math.min(extraVolume + 0.5, 5));
                }
                event.preventDefault();
            } else {
                // 减小超限音量
                if (extraVolume > 1) {
                    if (extraVolume - 0.5 <= 1) {
                        applyExtraVolume(video, 1);
                    } else {
                        applyExtraVolume(video, extraVolume - 0.5);
                    }
                    event.preventDefault();
                }
            }
        }
    }

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
        } else if (event.key === '[') {
            handleVolumeKeyByBracket(event, false);
        }
        // 其它自定义调试键
        else if (event.key === 'd') {
            if (video) {
                video.volume = 3;
                showNotification(`音量: ${(video.volume * 100).toFixed(0)}%`);
            }
        }
        // M 键 - 静音/取消静音
        else if (event.key === 'm' || event.key === 'M') {
            if(window.location.hostname.includes('huya.com')) {
                const muteBtn = document.getElementById('player-sound-btn');
                if (muteBtn) {
                    muteBtn.click();
                    event.preventDefault();
                }
            }
            else if(window.location.hostname.includes('live.bilibili.com')){
                imitataMouseMove(video, 0, 0);
                document.querySelectorAll('.left-area .icon')[2].click()
            }
        }
        // F键点击全屏按钮
        else if (event.key === 'f' || event.key === 'F') {
            if (window.location.hostname.includes('huya.com')) {
                const fullscreenBtn = document.getElementById('player-fullscreen-btn');
                if (fullscreenBtn) {
                    fullscreenBtn.click();
                    event.preventDefault();
                }
            }
            else if(window.location.hostname.includes('live.bilibili.com')){
                imitataMouseMove(video, 0, 0);
                document.querySelectorAll('.right-area .icon')[0].click()
            }
        }
        //P键剧场模式
        else if (event.key === 'p' || event.key === 'P') {
            if(window.location.hostname.includes('huya.com')) {
                const playBtn = document.getElementById('player-fullpage-btn');
                if (playBtn) {
                    playBtn.click();
                    event.preventDefault();
                }
            }
            else if(window.location.hostname.includes('live.bilibili.com')){
                imitataMouseMove(video, 0, 0);
                document.querySelectorAll('.right-area .icon')[1].click();
            }
        }
    }

    // 空格键释放时恢复用户设置的速度
    document.addEventListener('keyup', function(event) {
        if (event.key === ' ') {
            const video = getVideoElement();
            if (video && video.playbackRate === 2.0) {

                // video.playbackRate = userSetSpeed;
                // showNotification(`恢复播放: ${userSetSpeed.toFixed(2)}x`);
                event.preventDefault();
            }
        }
    });

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
        var doc = oElement.ownerDocument;
        var win = doc.defaultView || doc.parentWindow;
        var mousemove = document.createEvent("MouseEvent");
        mousemove.initMouseEvent("mousemove", true, true, win, 0, clientX, clientY, clientX, clientY, 0, 0, 0, 0, 0, null);
        oElement.dispatchEvent(mousemove);
    }

    // 初始化通知
    function init() {
        // const video = getVideoElement();
        // if (video) {
        //     //showNotification(`当前播放速度: ${video.playbackRate.toFixed(2)}x`);
        // } else {
        //     // 如果视频元素还没加载，稍后再试
        //     setTimeout(init, 1000);
        // }

        setTimeout(() => {
            document.addEventListener('keydown', handleKeyDown);
            console.log('播放速度控制脚本已加载');
        }, 2000); // 2 seconds delay
    }

    // 页面加载完成后初始化
    window.addEventListener('load', init);
    window.addEventListener('yt-navigate-finish', init);
    // 直接调用，防止事件已触发过导致监听不到
    init();
})();
