// ==UserScript==
// @name         embyLaunchPotplayer
// @namespace    http://tampermonkey.net/
// @version      1.1.7
// @description  emby/jellyfin launch external player, support latest Emby
// @license      MIT
// @author       @bpking (mod by Copilot)
// @github       https://github.com/bpking1/embyExternalUrl
// @include      */web/index.html
// ==/UserScript==

(function () {
    'use strict';

    // 配置项
    const useRealFileName = false;

    let isEmby = "";

    // 兼容新版Emby按钮插入点选择器
    function getMainDetailButtons() {
        // 新版Emby通常有.mainDetailButtons（详情页主按钮区域）
        let el = document.querySelector(".mainDetailButtons, .detailButtons");
        if (el) return el;
        // Jellyfin 兼容
        el = document.querySelector("div.itemDetailPage:not(.hide) div.detailPagePrimaryContainer");
        if (el) return el;
        // 兜底：详情页其它按钮区
        el = document.querySelector(".actionsContainer, .itemActions, .mediaInfoPrimary");
        return el;
    }

    function removeOldBtns(playBtnsId = "ExternalPlayersBtns") {
        const playBtns = document.getElementById(playBtnsId);
        if (playBtns) playBtns.remove();
    }

    function injectButtons() {
        const playBtnsId = "ExternalPlayersBtns";
        removeOldBtns(playBtnsId);

        const mainDetailButtons = getMainDetailButtons();
        if (!mainDetailButtons) return;

        const buttons = [
            { id: "embyPot", title: "Potplayer", iconId: "icon-PotPlayer" },
            { id: "embyIINA", title: "IINA", iconId: "icon-IINA" },
            { id: "embyMX", title: "MXPlayer", iconId: "icon-MXPlayer" },
            { id: "embyCopyUrl", title: "复制串流地址", iconId: "icon-Copy" }
        ];
        function generateButtonHTML({ id, title, iconId }) {
            return `
                <button
                    id="${id}"
                    type="button"
                    class="detailButton emby-button raised-backdropfilter detailButton-primary"
                    title="${title}"
                >
                    <div class="detailButton-content">
                        <i class="md-icon detailButton-icon button-icon button-icon-left"
                            id="${iconId}">　</i>
                        <span class="button-text">${title}</span>
                    </div>
                </button>
            `;
        }
        let buttonHtml = `
            <div id="${playBtnsId}" class="detailButtons flex align-items-flex-start flex-wrap-wrap" style="margin-top:8px">
                ${buttons.map(button => generateButtonHTML(button)).join('')}
            </div>
        `;
        // 插入到按钮区后面
        mainDetailButtons.insertAdjacentHTML('afterend', buttonHtml);

        // 按钮事件
        document.querySelector("#embyPot").onclick = embyPot;
        document.querySelector("#embyIINA").onclick = embyIINA;
        document.querySelector("#embyMX").onclick = embyMX;
        document.querySelector("#embyCopyUrl").onclick = embyCopyUrl;

        // 图标
        const iconBaseUrl = "https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/icons";
        const icons = [
            { id: "icon-PotPlayer", name: "icon-PotPlayer.webp", fontSize: "1.4em" },
            { id: "icon-IINA", fontSize: "1.4em" },
            { id: "icon-MXPlayer", fontSize: "1.4em" },
            { id: "icon-Copy", fontSize: "1.4em" },
        ];
        icons.forEach((icon, idx) => {
            const el = document.querySelector(`#${icon.id}`);
            if (el) {
                const url = `${iconBaseUrl}/${icon.name || `${icon.id}.webp`}`;
                el.style.cssText += `
                    background-image: url(${url});
                    background-repeat: no-repeat;
                    background-size: 100% 100%;
                    font-size: ${icon.fontSize};
                `;
            }
        });
    }

    // 兼容新版Emby的判定
    function isNewEmby() {
        // 新版Emby页面一般有 window.ApiClient 且页面路由 hash 以 /web/ 开头
        return typeof window.ApiClient !== "undefined" &&
            location.pathname.includes("/web/");
    }

    // 检查是否到达详情页（新旧Emby/Jellyfin兼容）
    function isOnItemDetailPage() {
        // 新版Emby
        if (location.hash.startsWith("#!/item/")) return true;
        // 旧版Emby/Jellyfin
        if (/item(id|\/)/.test(location.hash)) return true;
        // 兜底：详情页主内容含有媒体信息
        return !!document.querySelector(".mediaInfoPrimary, .itemMiscInfo-primary");
    }

    // Emby/Jellyfin媒体信息获取（兼容新版）
    async function getItemInfo() {
        let ApiClient = window.ApiClient;
        if (!ApiClient || !ApiClient._serverInfo || !ApiClient._serverInfo.UserId) {
            // 兜底：尝试从window.AppUserId
            if (window.AppUserId) {
                ApiClient = window.ApiClient;
            } else {
                alert("未检测到ApiClient，请确认已进入详情页！");
                throw new Error("No ApiClient");
            }
        }
        let userId = ApiClient._serverInfo.UserId || window.AppUserId;
        let itemId = null;
        // 兼容新版Emby的itemId获取
        const hash = window.location.hash;
        let match = hash.match(/item(?:id)?[=\/](\w+)/);
        if (!match) match = hash.match(/id=([A-Za-z0-9]+)/);
        if (!match) match = hash.match(/item\/(\w+)/);
        if (match) itemId = match[1];
        else if (window.AppItemId) itemId = window.AppItemId;
        if (!itemId) {
            alert("无法获取itemId，请确认当前为媒体详情页");
            throw new Error("No itemId");
        }
        // 调用Emby接口获取item信息
        let response = await ApiClient.getItem(userId, itemId);
        // 剧集、季、电影等与原逻辑一致
        if (response.Type == "Series") {
            let nextUp = await ApiClient.getNextUpEpisodes({ SeriesId: itemId, UserId: userId });
            if (nextUp.Items && nextUp.Items.length > 0) {
                return await ApiClient.getItem(userId, nextUp.Items[0].Id);
            }
        }
        if (response.Type == "Season") {
            let seasonItems = await ApiClient.getItems(userId, { parentId: itemId });
            if (seasonItems.Items && seasonItems.Items[0])
                return await ApiClient.getItem(userId, seasonItems.Items[0].Id);
        }
        if (response.MediaSources && response.MediaSources.length > 0)
            return response;
        let firstItems = await ApiClient.getItems(userId, { parentId: itemId, Recursive: true, IsFolder: false, Limit: 1 });
        if (firstItems.Items && firstItems.Items[0])
            return await ApiClient.getItem(userId, firstItems.Items[0].Id);
        throw new Error("媒体信息获取失败");
    }

    // 其它辅助函数与原脚本一致
    function getSeek(position) {
        let ticks = position * 10000;
        let parts = [], hours = Math.floor(ticks / 36e9);
        if (hours) parts.push(hours);
        let minutes = Math.floor((ticks - hours * 36e9) / 6e8);
        if (minutes < 10 && hours) minutes = "0" + minutes;
        parts.push(minutes);
        let seconds = Math.floor((ticks - hours * 36e9 - minutes * 6e8) / 1e7);
        if (seconds < 10) seconds = "0" + seconds;
        parts.push(seconds);
        return parts.join(":");
    }

    function getSubPath(mediaSource) {
        let selectSubtitles = document.querySelector("select.selectSubtitles");
        let subTitlePath = '';
        if (selectSubtitles && selectSubtitles.value > 0) {
            let SubIndex = mediaSource.MediaStreams.findIndex(m => m.Index == selectSubtitles.value && m.IsExternal);
            if (SubIndex > -1) {
                let subtitleCodec = mediaSource.MediaStreams[SubIndex].Codec;
                subTitlePath = `/${mediaSource.Id}/Subtitles/${selectSubtitles.value}/Stream.${subtitleCodec}`;
            }
        } else {
            let chiSubIndex = mediaSource.MediaStreams.findIndex(m => m.Language == "chi" && m.IsExternal);
            if (chiSubIndex > -1) {
                let subtitleCodec = mediaSource.MediaStreams[chiSubIndex].Codec;
                subTitlePath = `/${mediaSource.Id}/Subtitles/${chiSubIndex}/Stream.${subtitleCodec}`;
            } else {
                let externalSubIndex = mediaSource.MediaStreams.findIndex(m => m.IsExternal);
                if (externalSubIndex > -1) {
                    let subtitleCodec = mediaSource.MediaStreams[externalSubIndex].Codec;
                    subTitlePath = `/${mediaSource.Id}/Subtitles/${externalSubIndex}/Stream.${subtitleCodec}`;
                }
            }
        }
        return subTitlePath;
    }

    async function getEmbyMediaInfo() {
        let itemInfo = await getItemInfo();
        let mediaSourceId = itemInfo.MediaSources[0].Id;
        let selectSource = document.querySelector("select.selectSource:not([disabled])");
        if (selectSource && selectSource.value.length > 0) {
            mediaSourceId = selectSource.value;
        }
        let mediaSource = itemInfo.MediaSources.find(m => m.Id == mediaSourceId) || itemInfo.MediaSources[0];
        let uri = "/emby/videos";
        let domain = `${window.ApiClient._serverAddress}${uri}/${itemInfo.Id}`;
        let subPath = getSubPath(mediaSource);
        let subUrl = subPath.length > 0 ? `${domain}${subPath}?api_key=${window.ApiClient.accessToken()}` : '';
        let streamUrl = `${domain}/`;
        let fileName = mediaSource.Path ? mediaSource.Path.replace(/.*[\\/]/, "") : "";
        if (mediaSource.IsInfiniteStream) {
            streamUrl += "master.m3u8";
        } else {
            streamUrl += useRealFileName ? `stream/${fileName}` : `stream.${mediaSource.Container}`;
        }
        streamUrl += `?api_key=${window.ApiClient.accessToken()}&Static=true&MediaSourceId=${mediaSourceId}`;
        let position = parseInt(itemInfo.UserData.PlaybackPositionTicks / 10000) || 0;
        let intent = await getIntent(mediaSource, position);
        return {
            streamUrl: streamUrl,
            subUrl: subUrl,
            intent: intent,
        }
    }

    async function getIntent(mediaSource, position) {
        let title = mediaSource.IsInfiniteStream
            ? mediaSource.Name
            : (mediaSource.Path ? mediaSource.Path.split('/').pop() : "video");
        let externalSubs = mediaSource.MediaStreams.filter(m => m.IsExternal == true);
        let subs_name = externalSubs.map(s => s.DisplayTitle);
        let subs_filename = externalSubs.map(s => s.Path.split('/').pop());
        return {
            title: title,
            position: position,
            subs: '',
            subs_name: subs_name,
            subs_filename: subs_filename,
            subs_enable: ''
        };
    }

    async function embyPot() {
        let mediaInfo = await getEmbyMediaInfo();
        let intent = mediaInfo.intent;
        let poturl = `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub=${encodeURI(mediaInfo.subUrl)} /current /title="${intent.title}" /seek=${getSeek(intent.position)}`;
        window.open(poturl, "_self");
    }

    async function embyIINA() {
        let mediaInfo = await getEmbyMediaInfo();
        let iinaUrl = `iina://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1`;
        window.open(iinaUrl, "_self");
    }

    async function embyMX() {
        let mediaInfo = await getEmbyMediaInfo();
        let intent = mediaInfo.intent;
        let mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURI(intent.title)};i.position=${intent.position};end`;
        window.open(mxUrl, "_self");
    }

    async function embyCopyUrl() {
        const mediaInfo = await getEmbyMediaInfo();
        let textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.style.position = 'absolute';
        textarea.style.clip = 'rect(0 0 0 0)';
        const streamUrl = decodeURI(mediaInfo.streamUrl);
        textarea.value = streamUrl;
        textarea.select();
        if (document.execCommand('copy', true)) {
            this.innerText = '复制成功';
        }
        textarea.remove();
    }

    // 页面监听，适配新版Emby
    function tryInjectButtonsOnDetailPage() {
        // 避免多次插入
        if (!isOnItemDetailPage()) return;
        setTimeout(() => {
            injectButtons();
        }, 600); // 延迟，等待DOM加载
    }

    // 监听路由变化（新版Emby通常用hash路由）
    window.addEventListener("hashchange", tryInjectButtonsOnDetailPage, false);
    // 页面加载后尝试插入
    setTimeout(tryInjectButtonsOnDetailPage, 1000);

    // 监听Emby页面自定义事件（兼容旧版脚本方式）
    document.addEventListener("viewbeforeshow", function (e) {
        isEmby = !!(e.detail && e.detail.contextPath);
        setTimeout(tryInjectButtonsOnDetailPage, 500);
    });

})();
