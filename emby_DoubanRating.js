// EmbyDouban脚本 - nginx注入版本（只替换油猴API）
// 原作者: https://github.com/kjtsune/embyToLocalPlayer/blob/main/embyDouban/embyDouban.user.js
// 修改: 将油猴API替换为原生浏览器API，保持所有原有逻辑不变

(function() {
    'use strict';

    // ===== 油猴API替换为原生浏览器API =====
    
    // GM.xmlHttpRequest 替换
    const GM = {
        xmlHttpRequest: function(options) {
            const xhr = new XMLHttpRequest();
            xhr.open(options.method || 'GET', options.url, true);
            
            if (options.timeout) {
                xhr.timeout = options.timeout;
            }
            
            if (options.headers) {
                Object.keys(options.headers).forEach(key => {
                    xhr.setRequestHeader(key, options.headers[key]);
                });
            }
            
            xhr.onload = function() {
                if (options.onload) {
                    options.onload({
                        status: xhr.status,
                        statusText: xhr.statusText,
                        responseText: xhr.responseText,
                        response: xhr.response,
                        readyState: xhr.readyState
                    });
                }
            };
            
            xhr.onerror = function() {
                if (options.onerror) {
                    options.onerror({
                        status: xhr.status,
                        statusText: xhr.statusText,
                        responseText: xhr.responseText,
                        response: xhr.response,
                        readyState: xhr.readyState
                    });
                }
            };
            
            xhr.ontimeout = xhr.onerror;
            
            xhr.send(options.data);
            return xhr;
        }
    };

    // GM_registerMenuCommand 和 GM_unregisterMenuCommand 替换
    let menuCommandId = 0;
    const menuCommands = {};
    
    function GM_registerMenuCommand(name, func) {
        const id = ++menuCommandId;
        menuCommands[id] = { name, func };
        console.log(`菜单命令已注册: ${name}`);
        return id;
    }
    
    function GM_unregisterMenuCommand(id) {
        if (menuCommands[id]) {
            console.log(`菜单命令已注销: ${menuCommands[id].name}`);
            delete menuCommands[id];
        }
    }

    // ===== basic-tool.js 内容（原逻辑不变） =====
    
    function myBool(value) {
        if (Array.isArray(value) && value.length === 0) return false;
        if (value !== null && typeof value === 'object' && Object.keys(value).length === 0) return false;
        return Boolean(value);
    }

    class MyLogger {
        constructor({ logLevel = 1, logStack = false } = {}) {
            this.logLevel = logLevel;
            this.logStack = logStack;
            this.styles = {
                error: 'color: yellow; font-style: italic; background-color: blue;',
                info: 'color: yellow; font-style: italic; background-color: blue;',
                debug: 'color: yellow; font-style: italic; background-color: blue;',
            };
        }

        _getStack() {
            return this.logStack
                ? `\n→ ${new Error().stack.split('\n')[3]?.trim() || ''}`
                : '';
        }

        _log(level, ...args) {
            const levels = { error: 1, info: 2, debug: 3 };
            if (this.logLevel >= levels[level]) {
                console.log(`%c${level}`, this.styles[level], ...args, this._getStack());
            }
        }

        error(...args) {
            this._log('error', ...args);
        }

        info(...args) {
            this._log('info', ...args);
        }

        debug(...args) {
            this._log('debug', ...args);
        }
    }

    // ===== my-storage.js 内容（原逻辑不变，只替换GM API） =====
    
    // 替换GM存储API
    function GM_getValue(key, defaultValue) {
        try {
            const value = localStorage.getItem('GM_' + key);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('GM_getValue error:', e);
            return defaultValue;
        }
    }

    function GM_setValue(key, value) {
        try {
            localStorage.setItem('GM_' + key, JSON.stringify(value));
        } catch (e) {
            console.error('GM_setValue error:', e);
        }
    }

    function GM_deleteValue(key) {
        try {
            localStorage.removeItem('GM_' + key);
        } catch (e) {
            console.error('GM_deleteValue error:', e);
        }
    }

    class MyStorage {
        constructor(prefix, expireDay = 0, splitStr = '|', useGM = false, useShared = false) {
            this.prefix = prefix;
            this.splitStr = splitStr;
            this.expireDay = expireDay;
            this.expireMs = expireDay * 864E5;
            this.useGM = useGM;
            this.useShared = useShared;

            this._getItem = (useGM) ? GM_getValue : localStorage.getItem.bind(localStorage);
            this._setItem = (useGM) ? GM_setValue : localStorage.setItem.bind(localStorage);
            this._removeItem = (useGM) ? GM_deleteValue : localStorage.removeItem.bind(localStorage);

            if (this.useShared) {
                this._initSharedStorage();

                let sTime = localStorage.getItem('SharedStorageServerTime') || 0;
                if (sTime + this._dayToMs(30) < Date.now()) {

                    return new Proxy(this, {
                        get(target, prop, receiver) {
                            if (prop.startsWith('share') && typeof target[prop] === 'function') {
                                return () => null;
                            }
                            return Reflect.get(target, prop, receiver);
                        }
                    });
                }

            }

        }

        _initSharedStorage() {
            // 使用全局唯一的 requestId，避免多实例冲突
            if (!window._sharedStorageGlobalState) {
                window._sharedStorageGlobalState = {
                    requestId: 0,
                    pendingRequests: new Map()
                };
            }

            this.globalState = window._sharedStorageGlobalState;

            // 初始化消息监听器（全局只初始化一次）
            if (!window._sharedStorageListenerInit) {
                window.addEventListener('message', (event) => {
                    const { type, requestId, result, error } = event.data;

                    if (type === 'SHARED_STORAGE_RESPONSE') {
                        const request = this.globalState.pendingRequests.get(requestId);
                        if (request) {
                            this.globalState.pendingRequests.delete(requestId);
                            if (error) {
                                request.reject(new Error(error));
                            } else {
                                request.resolve(result);
                            }
                        }
                    }
                });
                window._sharedStorageListenerInit = true;
            }
        }

        withShared(expireDay = null) {
            expireDay = expireDay || this.expireDay
            return new MyStorage(this.prefix, expireDay, this.splitStr, this.useGM, true);
        }

        _sendSharedRequest(action, key = null, value = null, timeout = 5000) {
            return new Promise((resolve, reject) => {
                // 使用全局唯一的 requestId
                const requestNum = ++this.globalState.requestId;
                const requestId = `${action}|${key}|${performance.now()}-${Math.random()}-${requestNum}`

                this.globalState.pendingRequests.set(requestId, { resolve, reject });

                window.postMessage({
                    type: 'SHARED_STORAGE',
                    action,
                    key,
                    value,
                    requestId
                }, window.location.origin);

                // 设置超时
                setTimeout(() => {
                    if (this.globalState.pendingRequests.has(requestId)) {
                        this.globalState.pendingRequests.delete(requestId);
                        reject(new Error(`共享存储请求超时 (requestId: ${requestId})`));
                    }
                }, timeout);
            });
        }

        _dayToMs(day) {
            return day * 864E5;
        }

        _msToDay(ms) {
            return ms / 864E5;
        }

        _keyGenerator(key) {
            return `${this.prefix}${this.splitStr}${key}`;
        }

        get(key, defalut = null) {
            key = this._keyGenerator(key);
            let res = this._getItem(key);
            if (this.expireMs && res) {
                let data = (this.useGM) ? res : JSON.parse(res);
                let expireTime = data.expireTime;
                if (!expireTime) {
                    res = null
                    this.del(key);
                } else {
                    if (expireTime < Date.now()) {
                        res = null;
                        this.del(key);
                    } else {
                        res = data.value;
                    }
                }
            } else if (!this.useGM && res) {
                try {
                    res = JSON.parse(res);
                } catch (_error) {
                    // pass
                }
            }
            res = res || defalut;
            return res
        }

        set(key, value) {
            key = this._keyGenerator(key);
            if (this.expireMs) {
                value = { expireTime: Date.now() + this.expireMs, value: value };
            }
            if (!this.useGM && typeof (value) == 'object') {
                value = JSON.stringify(value)
            }
            this._setItem(key, value)
        }

        del(key) {
            key = this._keyGenerator(key);
            try {
                this._removeItem(key);
            } catch (_error) {
                // pass
            }
        }

        async shareGet(key, defaultValue = null) {
            const fullKey = this._keyGenerator(key);
            try {
                let res = await this._sendSharedRequest('GET', fullKey);
                if (this.expireMs && res) {
                    let expireTime = res.expireTime;
                    if (!expireTime) {
                        res = null
                        await this.shareDel(key);
                    } else {
                        if (expireTime < Date.now()) {
                            res = null;
                            await this.shareDel(key);
                        } else {
                            res = res.value;
                        }
                    }
                }
                return res !== null ? res : defaultValue;
            } catch (error) {
                console.error('MyStorage shareGet error:', error);
                return defaultValue;
            }
        }

        async shareSet(key, value) {
            const fullKey = this._keyGenerator(key);
            try {
                let finalValue = value;
                if (this.expireMs) {
                    finalValue = { expireTime: Date.now() + this.expireMs, value: value };
                }
                await this._sendSharedRequest('SET', fullKey, finalValue);
            } catch (error) {
                console.error('MyStorage shareSet error:', error);
            }
        }

        async shareDel(key) {
            const fullKey = this._keyGenerator(key);
            try {
                await this._sendSharedRequest('DELETE', fullKey);
            } catch (error) {
                console.error('MyStorage shareDel error:', error);
            }
        }
    }

    // ===== embyDouban.user.js 主要逻辑（完全保持原样） =====

    let config = {
        logLevel: 2,
        // 清除无效标签的正则匹配规则
        tagsRegex: /\d{4}|TV|动画|小说|漫|轻改|游戏改|原创|[a-zA-Z]/,
        // 标签数量限制，填0禁用标签功能。
        tagsNum: 3,
    };

    let logger = new MyLogger(config)

    let enableDoubanComment = (localStorage.getItem('enableDoubanComment') === 'true');

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function switchLocalStorage(key, defaultValue = 'false', trueValue = 'true', falseValue = 'false') {
        if (key in localStorage) {
            let value = (localStorage.getItem(key) === trueValue) ? falseValue : trueValue;
            localStorage.setItem(key, value);
        } else {
            localStorage.setItem(key, defaultValue)
        }
        console.log('switchLocalStorage ', key, ' to ', localStorage.getItem(key))
    }

    function setModeSwitchMenu(storageKey, menuStart = '', menuEnd = '', defaultValue = '关闭', trueValue = '开启', falseValue = '关闭') {
        let switchNameMap = { 'true': trueValue, 'false': falseValue, null: defaultValue };
        let menuId = GM_registerMenuCommand(menuStart + switchNameMap[localStorage.getItem(storageKey)] + menuEnd, clickMenu);

        function clickMenu() {
            GM_unregisterMenuCommand(menuId);
            switchLocalStorage(storageKey)
            menuId = GM_registerMenuCommand(menuStart + switchNameMap[localStorage.getItem(storageKey)] + menuEnd, clickMenu);
        }

    }

    function isHidden(el) {
        return (el.offsetParent === null);
    }

    function isEmpty(s) {
        return !s || s === 'N/A' || s === 'undefined';
    }

    function getVisibleElement(elList) {
        if (!elList) { return; }
        if (NodeList.prototype.isPrototypeOf(elList)) {
            for (let i = 0; i < elList.length; i++) {
                if (!isHidden(elList[i])) {
                    return elList[i];
                }
            }
        } else {
            console.log('%c%s', 'color: orange;', 'return raw ', elList);
            return elList;
        }

    }

    function getURL_GM(url, data = null) {
        let method = (data) ? 'POST' : 'GET'
        return new Promise(resolve => GM.xmlHttpRequest({
            method: method,
            url: url,
            data: data,
            onload: function (response) {
                if (response.status >= 200 && response.status < 400) {
                    resolve(response.responseText);
                } else {
                    console.error(`Error ${method} ${url}:`, response.status, response.statusText, response.responseText);
                    resolve();
                }
            },
            onerror: function (response) {
                console.error(`Error during GM.xmlHttpRequest to ${url}:`, response.statusText);
                resolve();
            }
        }));
    }

    async function getJSON_GM(url, data = null) {
        const res = await getURL_GM(url, data);
        if (res) {
            return JSON.parse(res);
        }
    }

    function textSimilarity(text1, text2) {
        const len1 = text1.length;
        const len2 = text2.length;
        let count = 0;
        for (let i = 0; i < len1; i++) {
            if (text2.indexOf(text1[i]) != -1) {
                count++;
            }
        }
        const similarity = count / Math.min(len1, len2);
        return similarity;
    }

    function getEmbyTitle() {
        let container = getVisibleElement(document.querySelectorAll('.itemPrimaryNameContainer'));
        if (!container) return '';
        let textTitle = container.querySelector('.itemName-primary');
        if (textTitle && textTitle.textContent) {
            return textTitle.textContent.trim();
        }
        let imgTitle = container.querySelector('.itemName-primary-logo img');
        if (imgTitle) {
            return imgTitle.getAttribute('alt')?.trim() || '';
        }
        return '';
    }

    async function getDoubanInfo(imdbId) {
        if (!imdbId) {
            return;
        }

        let embyTitle = getEmbyTitle();
        // const search = await getJSON_GM(`https://movie.douban.com/j/subject_suggest?q=${id}`);
        const search = await getJSON_GM(`/douban-proxy/j/subject_suggest?q=${embyTitle}`);
        if (search && search.length > 0 && search[0].id) {
            let doubanId = search[0].id;
            let doubanTitle = search[0].title;
            let doubanSubTitle = search[0].sub_title;
            if (textSimilarity(embyTitle, doubanTitle) < 0.4 && textSimilarity(embyTitle, doubanSubTitle) < 0.4) {
                logger.info(`douban title not match emby:${embyTitle} douban:${doubanTitle} ${doubanSubTitle}`);
                return;
            }
            const abstract = await getJSON_GM(`/douban-proxy/j/subject_abstract?subject_id=${doubanId}`);
            const average = abstract && abstract.subject && abstract.subject.rate ? abstract.subject.rate : '?';
            const comment = abstract && abstract.subject && abstract.subject.short_comment && abstract.subject.short_comment.content;
            return {
                id: doubanId,
                comment: comment,
                // url: `https://movie.douban.com/subject/${doubanId}/`,
                rating: { numRaters: '', max: 10, average },
                title: search[0].title,
                sub_title: search[0].sub_title,
            };
        }
    }

    function insertDoubanComment(doubanId, doubanComment) {
        console.log('%c%o%s', 'color:orange;', 'start add comment ', doubanId)
        if (!enableDoubanComment) { return; }
        let el = getVisibleElement(document.querySelectorAll('div#doubanComment'));
        if (el || isEmpty(doubanComment)) {
            console.log('%c%s', 'color: orange', 'skip add doubanComment', el, doubanComment);
            return;
        }
        let embyComment = getVisibleElement(document.querySelectorAll('div.overview-text'));
        if (embyComment) {
            let parentNode = (ApiClient._serverVersion.startsWith('4.6')
            ) ? embyComment.parentNode : embyComment.parentNode.parentNode
            parentNode.insertAdjacentHTML('afterend', `<div id="doubanComment"><li>douban comment
        </li>${doubanComment}</li></div>`);
            console.log('%c%s', 'color: orange;', 'insert doubanComment ', doubanId, doubanComment);
        }
    }

    function insertDoubanScore(doubanId, rating, socreIconHrefClass) {
        console.log('%c%s', 'color: orange;', 'start ', doubanId, rating);
        let el = getVisibleElement(document.querySelectorAll('a#doubanScore'));
        if (el || !rating) {
            console.log('%c%s', 'color: orange', 'skip add score', el, rating);
            return;
        }
        let yearDiv = getVisibleElement(document.querySelectorAll('div[class="mediaInfoItem"]'));
        if (yearDiv) {
            let doubanIco = '<img style="width:16px;margin-right:3px;" src="data:image/x-icon;base64,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AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP+RwIn////////////4+/j/GnwK/xF3AP8RdwD/EXcA/xF3AP8afAr/+Pv4////////////kcCJ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Xn0v///////////77auf8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP++2rn////////////V59L/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8rhhz/////////////////erNw/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/3qzcP////////////////8rhhz/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/26sZP////////////////81jCf/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/NYwn/////////////////26sZP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/vdm4////////////5PDi/y+IIP8viCD/L4gg/y+IIP8viCD/L4gg/y+IIP8viCD/5PDi////////////vdm4/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ/////////////////////////////////////////////////////////////////////////////////////////////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/T5tD/////////////////////////////////////////////////////////////////////////////////////////////////0+bQ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Pm0P///////////9vq2P+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP/b6tj////////////T5tD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ////////////tdWw/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/7XVsP///////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/T5tD///////////+11bD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/tdWw////////////0+bQ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Pm0P///////////7XVsP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP+11bD////////////T5tD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ////////////tdWw/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/7XVsP///////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/T5tD////////////b6tj/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/2+rY////////////0+bQ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Pm0P/////////////////////////////////////////////////////////////////////////////////////////////////T5tD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ/////////////////////////////////////////////////////////////////////////////////////////////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/+Lu4P//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////4u7g/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/4u7g///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////i7uD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/i7uD//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+Lu4P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AOYRdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwDmEXcASRF3AOYRdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA5hF3AEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==">'
            yearDiv.insertAdjacentHTML('beforebegin', `<div class="starRatingContainer mediaInfoItem douban">${doubanIco}<a id="doubanScore" 
            href="https://movie.douban.com/subject/${doubanId}/" ${socreIconHrefClass}>${rating}</a></div>`);
            console.log('%c%s', 'color: orange;', 'insert score ', doubanId, rating);
        }
        console.log('%c%s', 'color: orange;', 'finish ', doubanId, rating);
    }

    function imdbIconLinkAdder(imdbHref, socreIconHrefClass) {
        let imdbDiv = getVisibleElement(document.querySelectorAll('div[class="starRatingContainer mediaInfoItem"]'));
        if (isEmpty(imdbDiv)) { return; }
        if (imdbDiv.querySelector('#imdbScoreLink')) { return; }
        let imdbScore = imdbDiv.textContent.match(/[0-9.]+/);
        imdbDiv.lastChild.remove();
        imdbDiv.insertAdjacentHTML('beforeend', `<a id="imdbScoreLink" 
            href="${imdbHref}" ${socreIconHrefClass}>${imdbScore}</a>`)
    }

    async function insertDoubanMain(linkZone) {
        if (isEmpty(linkZone)) { return; }
        let doubanButton = linkZone.querySelector('a[href*="douban.com"]');
        let imdbButton = linkZone.querySelector('a[href^="https://www.imdb"]');
        if (doubanButton || !imdbButton) { return; }
        let imdbId = imdbButton.href.match(/tt\d+/);
        if (!imdbId) {
            return;
        }
        let socreIconHrefClass = 'class="button-link button-link-color-inherit emby-button" style="font-weight:inherit;" target="_blank"';
        imdbIconLinkAdder(imdbButton.href, socreIconHrefClass);

        let imdbDoubanDb = new MyStorage('imdb|douban');
        let doubanDb = new MyStorage('douban');

        let doubanId = imdbDoubanDb.get(imdbId);

        if (doubanId == '_') { return; }

        let data = doubanDb.get(doubanId);
        if (isEmpty(data)) {
            data = await getDoubanInfo(imdbId);
            console.log('%c%o%s', 'background:yellow;', data, ' result and send a requests')
            if (isEmpty(data)) {
                imdbDoubanDb.set(imdbId, '_');
                return;
            }
            doubanId = data.id;
            imdbDoubanDb.set(imdbId, doubanId);
            doubanDb.set(doubanId, data);
        }
        if (!isEmpty(data)) {
            insertDoubanScore(doubanId, data.rating.average, socreIconHrefClass);
            if (enableDoubanComment) {
                insertDoubanComment(doubanId, data.comment);
            }

            let buttonClass = imdbButton.className;
            let doubanString = `<a is="emby-linkbutton" class="${buttonClass}" 
        href="https://movie.douban.com/subject/${doubanId}/" target="_blank">
        <i class="md-icon button-icon button-icon-left">link</i>Douban</a>`;
            imdbButton.insertAdjacentHTML('beforebegin', doubanString);
        }
        console.log('%c%o%s', 'color:orange;', 'douban id ', doubanId, String(imdbId));
        if (!imdbDoubanDb.get(imdbId)) {
            imdbDoubanDb.set(imdbId, '_');
            return;
        }

    }

    function insertBangumiByPath(idNode) {
        let el = getVisibleElement(document.querySelectorAll('a#bangumibutton'));
        if (el) { return; }
        let id = idNode.textContent.match(/(?<=bgm\=)\d+/);
        let bgmHtml = `<a id="bangumibutton" is="emby-linkbutton" class="raised item-tag-button nobackdropfilter emby-button" href="https://bgm.tv/subject/${id}" target="_blank"><i class="md-icon button-icon button-icon-left">link</i>Bangumi</a>`
        idNode.insertAdjacentHTML('beforebegin', bgmHtml);
    }

    function insertBangumiScore(bgmObj, infoTable, linkZone) {
        if (!bgmObj) return;
        let bgmRate = infoTable.querySelector('a#bgmScore');
        if (bgmRate) return;

        let yearDiv = infoTable.querySelector('div[class="mediaInfoItem"]');
        let bgmHref = `https://bgm.tv/subject/${bgmObj.id}`;
        if (yearDiv && bgmObj.trust) {
            let socreIconHrefClass = 'class="button-link button-link-color-inherit emby-button" style="font-weight:inherit;" target="_blank"';
            let bgmIco = '<img style="width:16px;" src="data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALJu+f//////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsm75ELJu+cCybvn/sm75/7Ju+f+ybvn//////7Ju+f+ybvn/sm75/7Ju+f+ybvn/sm75/7Ju+f+ybvnAsm75ELJu+cCybvn/sm75/7Ju+f+ybvn/sm75////////////sm75/7Ju+f+ybvn/sm75/7Ju+f+ybvn/sm75/7Ju+cCwaPn/sGj5/9iz/P///////////////////////////////////////////////////////////9iz/P+waPn/rF/6/6xf+v//////////////////////////////////////////////////////////////////////rF/6/6lW+/+pVvv/////////////////////////////////zXn2/////////////////////////////////6lW+/+lTfz/pU38///////Nefb/zXn2/8159v//////zXn2///////Nefb//////8159v/Nefb/zXn2//////+lTfz/okT8/6JE/P//////////////////////2bb8/8159v/Nefb/zXn2/9m2/P//////////////////////okT8/546/f+eOv3//////8159v/Nefb/zXn2////////////////////////////zXn2/8159v/Nefb//////546/f+bMf7/mzH+//////////////////////////////////////////////////////////////////////+bMf7/lyj+wJco/v/Mk/7////////////////////////////////////////////////////////////Mk///lyj+wJQf/xCUH//AlB///5Qf//+UH///lB///5Qf//+aP///mj///5o///+UH///lB///5Qf//+UH///lB//wJQf/xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzXn2/5o////Nefb/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzXn2/wAAAAAAAAAAAAAAAM159v8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzXn2/wAAAAAAAAAAAAAAAAAAAAAAAAAAzXn2/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzXn2/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADNefb/AAAAAAAAAAAAAAAA+f8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/j8AAP3fAAD77wAA9/cAAA==">'
            yearDiv.insertAdjacentHTML('beforebegin', `<div class="starRatingContainer mediaInfoItem bgm">${bgmIco} 
            <a id="bgmScore" href="${bgmHref}" ${socreIconHrefClass}>${bgmObj.score}</a></div>`);
            console.log('%c%s', 'color: orange;', 'insert bgmScore ', bgmObj.score);
            let tags = bgmObj.tags;
            if (tags && tags.length > 0 && config.tagsNum > 0) {
                tags = tags.filter(name => !config.tagsRegex.test(name)).slice(0, config.tagsNum);
                let tagsHtml = `<div class="mediaInfoItem">${tags.join(', ')}</div>`
                yearDiv.insertAdjacentHTML('afterend', tagsHtml);

            }
        }
        let tmdbButton = linkZone.querySelector('a[href^="https://www.themovie"]');
        let bgmButton = linkZone.querySelector('a[href^="https://bgm.tv"]');
        if (bgmButton) return;
        let buttonClass = tmdbButton.className;
        let bgmString = `<a is="emby-linkbutton" class="${buttonClass}" href="${bgmHref}" target="_blank"><i class="md-icon button-icon button-icon-left">link</i>Bangumi</a>`;
        tmdbButton.insertAdjacentHTML('beforebegin', bgmString);
    }

    function checkIsExpire(key, expireDay = 1) {
        let timestamp = localStorage.getItem(key);
        if (!timestamp) return true;
        let expireMs = expireDay * 864E5;
        if (Number(timestamp) + expireMs < Date.now()) {
            localStorage.removeItem(key)
            logger.info(key, 'IsExpire, old', timestamp, 'now', Date.now());
            return true;
        } else {
            return false;
        }

    }

    async function cleanBgmTags(tags) {
        tags = tags.filter(item => item.count >= 10 && !(config.tagsRegex.test(item.name)));
        let namesList = tags.map(item => item.name);
        return namesList;
    }

    async function insertBangumiMain(infoTable, linkZone) {
        if (!infoTable || !linkZone) return;
        let mediaInfoItems = infoTable.querySelectorAll('div[class="mediaInfoItem"] > a');
        let isAnime = 0;
        mediaInfoItems.forEach(tagItem => {
            if (tagItem.textContent && tagItem.textContent.search(/动画|Anim/) != -1) { isAnime++ }
        });
        if (isAnime == 0) {
            if (mediaInfoItems.length > 2) return;
            let itemGenres = getVisibleElement(document.querySelectorAll('div[class*="itemGenres"]'));
            if (!itemGenres) return;
            itemGenres = itemGenres.querySelectorAll('a')
            itemGenres.forEach(tagItem => {
                if (tagItem.textContent && tagItem.textContent.search(/动画|Anim/) != -1) { isAnime++ }
            });
            if (isAnime == 0) return;
        };

        let bgmRate = infoTable.querySelector('a#bgmScore');
        if (bgmRate) return;

        let tmdbButton = linkZone.querySelector('a[href^="https://www.themovie"]');
        if (!tmdbButton) return;
        let tmdbId = tmdbButton.href.match(/...\d+/);

        let year = infoTable.querySelector('div[class="mediaInfoItem"]').textContent.match(/^\d{4}/);
        let expireDay = (Number(year) < new Date().getFullYear() && new Date().getMonth() + 1 != 1) ? 30 : 3

        let tmdbBgmDb = new MyStorage('tmdb|bgm', expireDay);

        let bgmObj = tmdbBgmDb.get(tmdbId);
        if (bgmObj) {
            insertBangumiScore(bgmObj, infoTable, linkZone);
            return;
        }

        let tmdbNotBgmDb = new MyStorage('tmdb|NotBgm', 1);
        if (tmdbNotBgmDb.get(tmdbId)) {
            return;
        }
        let userId = ApiClient._serverInfo.UserId;
        let itemId = /\?id=(\d*)/.exec(window.location.hash)[1];
        let itemInfo = await ApiClient.getItems(userId, {
            'Ids': itemId,
            'Fields': 'OriginalTitle,PremiereDate'
        })
        itemInfo = itemInfo['Items'][0]
        let title = itemInfo.Name;
        let originalTitle = itemInfo.OriginalTitle;

        let splitRe = /[／\/]/;
        if (splitRe.test(originalTitle)) { //纸片人
            logger.info(originalTitle);
            let zprTitle = originalTitle.split(splitRe);
            for (let _i in zprTitle) {
                let _t = zprTitle[_i];
                if (/[あいうえおかきくけこさしすせそたちつてとなにぬねのひふへほまみむめもやゆよらりるれろわをんー]/.test(_t)) {
                    originalTitle = _t;
                    break
                } else {
                    originalTitle = zprTitle[0];
                }
            }
        }

        let premiereDate = new Date(itemInfo.PremiereDate);
        premiereDate.setDate(premiereDate.getDate() - 2);
        let startDate = premiereDate.toISOString().slice(0, 10);
        premiereDate.setDate(premiereDate.getDate() + 4);
        let endDate = premiereDate.toISOString().slice(0, 10);

        logger.info('bgm ->', originalTitle, title, startDate, endDate);
        let bgmInfo;
        for (const _t of [originalTitle, title]) {
            bgmInfo = await getJSON_GM('https://api.bgm.tv/v0/search/subjects?limit=10', JSON.stringify({
                'keyword': _t,
                // "keyword": 'titletitletitletitletitletitletitle',
                'filter': {
                    'type': [
                        2
                    ],
                    'air_date': [
                        `>=${startDate}`,
                        `<${endDate}`
                    ],
                    'nsfw': true
                }
            }))
            logger.info('bgmInfo', bgmInfo['data'])
            bgmInfo = (bgmInfo['data']) ? bgmInfo['data'][0] : null;
            if (bgmInfo) { break; }
        }

        if (!bgmInfo) {
            tmdbNotBgmDb.set(tmdbId, true);
            logger.error('getJSON_GM not bgmInfo return');
            return;
        };

        let trust = false;
        if (textSimilarity(originalTitle, bgmInfo['name']) < 0.4 && (textSimilarity(title, bgmInfo['name_cn'])) < 0.4
            && (textSimilarity(title, bgmInfo['name'])) < 0.4) {
            tmdbNotBgmDb.set(tmdbId, true);
            logger.error('not bgmObj and title not Similarity, skip');
        } else {
            trust = true
        }
        let score = bgmInfo.score ? bgmInfo.score : bgmInfo.rating?.score;
        let tags = bgmInfo.tags ? await cleanBgmTags(bgmInfo.tags) : [];
        logger.info(bgmInfo)
        bgmObj = {
            id: bgmInfo['id'],
            score: score,
            name: bgmInfo['name'],
            name_cn: bgmInfo['name_cn'],
            trust: trust,
            tags: tags,
        }
        tmdbBgmDb.set(tmdbId, bgmObj)
        insertBangumiScore(bgmObj, infoTable, linkZone);
    }

    function cleanDoubanError() {
        let expireKey = 'doubanErrorExpireKey';
        let needClean = false;
        if (expireKey in localStorage) {
            if (checkIsExpire(expireKey, 3)) {
                needClean = true
                localStorage.setItem(expireKey, JSON.stringify(Date.now()));
            }
        } else {
            localStorage.setItem(expireKey, JSON.stringify(Date.now()));
        }
        if (!needClean) return;

        let count = 0
        for (let i in localStorage) {
            if (
                i.search(/^tt\d+$/) !== -1 ||
                /^\d{7,9}(Info|Comment)?$/.test(i) ||
                /^(ie|tv)\/\d{4,7}(expire|bgm|NotBgm)$/.test(i) ||
                (i.startsWith('imdb|douban|tt') && localStorage.getItem(i) === '_')
            ) {
                console.log(i);
                count++;
                localStorage.removeItem(i);
            }
        }
        logger.info(`cleanDoubanError done, count=${count}`);
    }

    setModeSwitchMenu('enableDoubanComment', '豆瓣评论已经', '', '开启')
    var runLimit = 50;

    async function main() {
        let linkZone = getVisibleElement(document.querySelectorAll('div[class*="linksSection"]'));
        let infoTable = getVisibleElement(document.querySelectorAll('div[class*="flex-grow detailTextContainer"]'));
        if (infoTable && linkZone) {
            if (!infoTable.querySelector('h3.itemName-secondary')) { // not eps page
                insertDoubanMain(linkZone);
                await insertBangumiMain(infoTable, linkZone)
            } else {
                let bgmIdNode = document.evaluate('//div[contains(text(), "[bgm=")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (bgmIdNode) { insertBangumiByPath(bgmIdNode) };
            }
        }
        if (runLimit > 50) {
            cleanDoubanError();
            runLimit = 0
        }
    }

    (function loop() {
        setTimeout(async function () {
            // if (runLimit > 5) return;
            await main();
            loop();
            runLimit += 1
        }, 700);
    })();

})();
