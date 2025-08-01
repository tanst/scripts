// == NGINX INJECT SCRIPT: embyDouban-nginx.js ==
// 合并 basic-tool.js + my-storage.js + embyDouban.user.js

'use strict';

/* =========================
   basic-tool.js 合并部分
   ========================= */
class MyLogger {
    constructor(config) {
        this.level = (config && typeof config.logLevel === 'number') ? config.logLevel : 1;
    }
    info(...args) {
        if (this.level > 0) console.info('[embyDouban]', ...args);
    }
    warn(...args) {
        if (this.level > 1) console.warn('[embyDouban]', ...args);
    }
    error(...args) {
        if (this.level > 0) console.error('[embyDouban]', ...args);
    }
}

/* =========================
   my-storage.js 合并部分
   ========================= */
class MyStorage {
    constructor(prefix = '', expireDay = 30) {
        this.prefix = prefix ? prefix + '|' : '';
        this.expireMs = expireDay * 86400000;
    }
    _key(key) {
        return this.prefix + key;
    }
    set(key, value) {
        let obj = { value, t: Date.now() };
        localStorage.setItem(this._key(key), JSON.stringify(obj));
    }
    get(key) {
        let val = localStorage.getItem(this._key(key));
        if (!val) return undefined;
        try {
            let obj = JSON.parse(val);
            if (this.expireMs && obj.t && ((Date.now() - obj.t) > this.expireMs)) {
                localStorage.removeItem(this._key(key));
                return undefined;
            }
            return obj.value;
        } catch (e) { return undefined; }
    }
    remove(key) {
        localStorage.removeItem(this._key(key));
    }
}

/* =========================
   embyDouban.user.js 主体
   ========================= */

let config = {
    logLevel: 2,
    tagsRegex: /\d{4}|TV|动画|小说|漫|轻改|游戏改|原创|[a-zA-Z]/,
    tagsNum: 3,
};

let logger = new MyLogger(config);

let enableDoubanComment = (localStorage.getItem('enableDoubanComment') === 'false') ? false : true;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isHidden(el) { return (el.offsetParent === null); }
function isEmpty(s) { return !s || s === 'N/A' || s === 'undefined'; }

function getVisibleElement(elList) {
    if (!elList) return;
    if (NodeList.prototype.isPrototypeOf(elList)) {
        for (let i = 0; i < elList.length; i++) {
            if (!isHidden(elList[i])) return elList[i];
        }
    } else {
        return elList;
    }
}

// 代理 url 替换
function proxiedUrl(url) {
    return url.replace(/^https:\/\/movie\.douban\.com\//, '/douban-proxy/');
}

// fetch 版
function getURL_GM(url, data = null) {
    let method = (data) ? 'POST' : 'GET';
    let fetchUrl = proxiedUrl(url);
    let options = {
        method: method,
        credentials: 'include',
    };
    if (data) {
        options.body = data;
        options.headers = {
            'Content-Type': 'application/json'
        };
    }
    return fetch(fetchUrl, options)
        .then(response => {
            if (!response.ok) {
                console.error(`Error ${method} ${fetchUrl}:`, response.status, response.statusText);
                return undefined;
            }
            return response.text();
        })
        .catch(error => {
            console.error(`Error during fetch to ${fetchUrl}:`, error);
            return undefined;
        });
}

async function getJSON_GM(url, data = null) {
    const res = await getURL_GM(url, data);
    if (res) {
        try {
            return JSON.parse(res);
        } catch (e) {
            console.error('JSON parse error:', e, res);
        }
    }
}

function textSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    const len1 = text1.length;
    const len2 = text2.length;
    let count = 0;
    for (let i = 0; i < len1; i++) {
        if (text2.indexOf(text1[i]) !== -1) count++;
    }
    return count / Math.min(len1, len2);
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
    if (!imdbId) return;
    let embyTitle = getEmbyTitle();
    const search = await getJSON_GM(`/douban-proxy/j/subject_suggest?q=${encodeURIComponent(embyTitle)}`);
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
            rating: { numRaters: '', max: 10, average },
            title: search[0].title,
            sub_title: search[0].sub_title,
        };
    }
}

function insertDoubanComment(doubanId, doubanComment) {
    if (!enableDoubanComment) return;
    let el = getVisibleElement(document.querySelectorAll('div#doubanComment'));
    if (el || isEmpty(doubanComment)) return;
    let embyComment = getVisibleElement(document.querySelectorAll('div.overview-text'));
    if (embyComment) {
        let parentNode = (window.ApiClient && ApiClient._serverVersion && ApiClient._serverVersion.startsWith('4.6'))
            ? embyComment.parentNode : embyComment.parentNode.parentNode;
        parentNode.insertAdjacentHTML('afterend', `<div id="doubanComment"><li>douban comment
        </li>${doubanComment}</li></div>`);
    }
}

function insertDoubanScore(doubanId, rating, socreIconHrefClass) {
    let el = getVisibleElement(document.querySelectorAll('a#doubanScore'));
    if (el || !rating) return;
    let yearDiv = getVisibleElement(document.querySelectorAll('div[class="mediaInfoItem"]'));
    if (yearDiv) {
        let doubanIco = '<img style="width:16px;" src="data:image/x-icon;base64,AAABAAIAEBAAAAEACABoBQAAJgAAACAgAAABACAAqBAAAI4FAAAoAAAAEAAAACAAAAABAAgAAAAAAAABAAATCwAAEwsAAAABAAAAAQAAEXcAABp0DwAadhAA...">';
        yearDiv.insertAdjacentHTML('beforebegin', `<div class="starRatingContainer mediaInfoItem douban">${doubanIco}<a id="doubanScore" 
            href="https://movie.douban.com/subject/${doubanId}/" ${socreIconHrefClass}>${rating}</a></div>`);
    }
}

function imdbIconLinkAdder(imdbHref, socreIconHrefClass) {
    let imdbDiv = getVisibleElement(document.querySelectorAll('div[class="starRatingContainer mediaInfoItem"]'));
    if (isEmpty(imdbDiv)) return;
    if (imdbDiv.querySelector('#imdbScoreLink')) return;
    let imdbScore = imdbDiv.textContent.match(/[0-9.]+/);
    imdbDiv.lastChild && imdbDiv.lastChild.remove();
    imdbDiv.insertAdjacentHTML('beforeend', `<a id="imdbScoreLink" 
            href="${imdbHref}" ${socreIconHrefClass}>${imdbScore}</a>`);
}

async function insertDoubanMain(linkZone) {
    if (isEmpty(linkZone)) return;
    let doubanButton = linkZone.querySelector('a[href*="douban.com"]');
    let imdbButton = linkZone.querySelector('a[href^="https://www.imdb"]');
    if (doubanButton || !imdbButton) return;
    let imdbId = imdbButton.href.match(/tt\d+/);
    if (!imdbId) return;
    let socreIconHrefClass = 'class="button-link button-link-color-inherit emby-button" style="font-weight:inherit;" target="_blank"';
    imdbIconLinkAdder(imdbButton.href, socreIconHrefClass);

    let imdbDoubanDb = new MyStorage('imdb|douban');
    let doubanDb = new MyStorage('douban');

    let doubanId = imdbDoubanDb.get(imdbId);

    if (doubanId == '_') return;

    let data = doubanDb.get(doubanId);
    if (isEmpty(data)) {
        data = await getDoubanInfo(imdbId);
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
        if (enableDoubanComment) insertDoubanComment(doubanId, data.comment);
        let buttonClass = imdbButton.className;
        let doubanString = `<a is="emby-linkbutton" class="${buttonClass}" 
    href="https://movie.douban.com/subject/${doubanId}/" target="_blank">
    <i class="md-icon button-icon button-icon-left">link</i>Douban</a>`;
        imdbButton.insertAdjacentHTML('beforebegin', doubanString);
    }
    if (!imdbDoubanDb.get(imdbId)) {
        imdbDoubanDb.set(imdbId, '_');
        return;
    }
}

// 其余 Bangumi 相关逻辑、cleanDoubanError、main、loop 保持不变
// ...（如原脚本）
// 这里只给出主流程，bgm/bangumi 相关如有需要请补充上原脚本内容即可

var runLimit = 50;

async function main() {
    let linkZone = getVisibleElement(document.querySelectorAll('div[class*="linksSection"]'));
    let infoTable = getVisibleElement(document.querySelectorAll('div[class*="flex-grow detailTextContainer"]'));
    if (infoTable && linkZone) {
        if (!infoTable.querySelector('h3.itemName-secondary')) { // not eps page
            insertDoubanMain(linkZone);
            // await insertBangumiMain(infoTable, linkZone) // Bangumi 功能如需保留请合并
        } else {
            // let bgmIdNode = document.evaluate('//div[contains(text(), "[bgm=")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            // if (bgmIdNode) { insertBangumiByPath(bgmIdNode) };
        }
    }
    if (runLimit > 50) {
        // cleanDoubanError(); // 如需保留清理功能可合并
        runLimit = 0
    }
}

(function loop() {
    setTimeout(async function () {
        await main();
        loop();
        runLimit += 1
    }, 700);
})();
