'use strict';


document.addEventListener("DOMContentLoaded", function() {
let logger = {
    error: function (...args) {
        if (config.logLevel >= 1) {
            console.log('%cerror', 'color: yellow; font-style: italic; background-color: blue;', ...args);
        }
    },
    info: function (...args) {
        if (config.logLevel >= 2) {
            console.log('%cinfo', 'color: yellow; font-style: italic; background-color: blue;', ...args);
        }
    },
    debug: function (...args) {
        if (config.logLevel >= 3) {
            console.log('%cdebug', 'color: yellow; font-style: italic; background-color: blue;', ...args);
        }
    },
}
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

function cleanLocalStorage() {
    let count = 0
    for (i in localStorage) {
        if (i.search(/^tt/) != -1 || i.search(/^\d{7}/) != -1) {
            console.log(i);
            count++;
            localStorage.removeItem(i);
        }
    }
    console.log(`remove done, count=${count}`)
}

function getURL_GM(url, data = null) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(data ? 'POST' : 'GET', url, true);
        xhr.onload = function() {
            if (this.status >= 200 && this.status < 400) {
                resolve(this.responseText);
            } else {
                console.error(`Error ${data ? 'POST' : 'GET'} ${url}:`, this.status, this.statusText, this.responseText);
                resolve(); 
            }
        };

        xhr.onerror = function() {
            console.error(`Error during XMLHttpRequest to ${url}:`, this.statusText);
            reject(new Error(`Error during XMLHttpRequest to ${url}: ${this.statusText}`));
        };

        xhr.send(data ? JSON.stringify(data) : null);
    });
}

async function getJSON_GM(url, data = null) {
    const res = await getURL_GM(url, data);
    if (res) {
        return JSON.parse(res);
    }
}


async function getJSON(url) {
    try {
        const response = await fetch(url);
        if (response.status >= 200 && response.status < 400)
            return await response.json();
        console.error(`Error fetching ${url}:`, response.status, response.statusText, await response.text());
    }
    catch (e) {
        console.error(`Error fetching ${url}:`, e);
    }
}

async function getDoubanInfo(id) {
    if (!id) {
        return;
    }
    try {
        const search = await getJSON_GM(`https://emby.028028.xyz:8/douban-proxy/j/subject_suggest?q=${id}`);
        if (search && search.length > 0 && search[0].id) {
            const abstract = await getJSON_GM(`https://emby.028028.xyz:8/douban-proxy/j/subject_abstract?subject_id=${search[0].id}`);
            const average = abstract && abstract.subject && abstract.subject.rate ? abstract.subject.rate : '?';
            const comment = abstract && abstract.subject && abstract.subject.short_comment && abstract.subject.short_comment.content;
            const doubanId = search[0].id;
            localStorage.setItem(id, doubanId); // 同步操作
            return {
                id: doubanId,
                comment: comment,
                rating: { numRaters: '', max: 10, average },
                title: search[0].title,
                sub_title: search[0].sub_title,
            };
        }
    } catch (error) {
        console.error('Error fetching Douban info:', error);
        // 如果需要，可以在这里处理错误
    }
}

function insertDoubanScore(doubanId, rating) {
    rating = rating || localStorage.getItem(doubanId);
    console.log('%c%s', 'color: orange;', 'start ', doubanId, rating);
    let el = getVisibleElement(document.querySelectorAll('a#doubanScore'));
    if (el || !rating) {
        console.log('%c%s', 'color: orange', 'skip add score', el, rating);
        return;
    }
    let yearDiv = getVisibleElement(document.querySelectorAll('div[class="mediaInfoItem"]'));
    if (yearDiv) {
        let doubanIco = `<img style="width:16px;margin-right:3px;" src="data:image/x-icon;base64,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AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP+RwIn////////////4+/j/GnwK/xF3AP8RdwD/EXcA/xF3AP8afAr/+Pv4////////////kcCJ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Xn0v///////////77auf8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP++2rn////////////V59L/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8rhhz/////////////////erNw/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/3qzcP////////////////8rhhz/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/26sZP////////////////81jCf/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/NYwn/////////////////26sZP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/vdm4////////////5PDi/y+IIP8viCD/L4gg/y+IIP8viCD/L4gg/y+IIP8viCD/5PDi////////////vdm4/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ/////////////////////////////////////////////////////////////////////////////////////////////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/T5tD/////////////////////////////////////////////////////////////////////////////////////////////////0+bQ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Pm0P///////////9vq2P+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP/b6tj////////////T5tD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ////////////tdWw/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/7XVsP///////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/T5tD///////////+11bD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/tdWw////////////0+bQ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Pm0P///////////7XVsP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP+11bD////////////T5tD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ////////////tdWw/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/7XVsP///////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/T5tD////////////b6tj/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/iLuA/4i7gP+Iu4D/2+rY////////////0+bQ/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/9Pm0P/////////////////////////////////////////////////////////////////////////////////////////////////T5tD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/0+bQ/////////////////////////////////////////////////////////////////////////////////////////////////9Pm0P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/+Lu4P//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////4u7g/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/4u7g///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////i7uD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP/i7uD//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+Lu4P8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AOYRdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwDmEXcASRF3AOYRdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA/xF3AP8RdwD/EXcA5hF3AEkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==">`
        yearDiv.insertAdjacentHTML('beforebegin', `<div class="starRatingContainer mediaInfoItem">${doubanIco}<a id="doubanScore" class="button-link button-link-color-inherit emby-button" is="emby-linkbutton" style="font-weight:inherit;" href="https://movie.douban.com/subject/${doubanId}/" target="_blank">${rating}</a></div>`);
        console.log('%c%s', 'color: orange;', 'insert score ', doubanId, rating);
    }
    console.log('%c%s', 'color: orange;', 'finish ', doubanId, rating);
}

async function insertDoubanMain(linkZone) {
    if (isEmpty(linkZone)) { return; }
    let doubanButton = linkZone.querySelector('a[href*="douban.com"]');
    let imdbButton = linkZone.querySelector('a[href^="https://www.imdb"]');
    if (doubanButton || !imdbButton) { return; }
    let imdbId = imdbButton.href.match(/tt\d+/);
    if(!imdbId){
        return;
    }
    if (imdbId in localStorage) {
        var doubanId = localStorage.getItem(imdbId);
    } else {
        await getDoubanInfo(imdbId).then(function (data) {
            if (!isEmpty(data)) {
                let doubanId = data.id;
                localStorage.setItem(imdbId, doubanId);
                if (data.rating && !isEmpty(data.rating.average)) {
                    insertDoubanScore(doubanId, data.rating.average);
                    localStorage.setItem(doubanId, data.rating.average);
                    localStorage.setItem(doubanId + 'Info', JSON.stringify(data));
                }
            }
            console.log('%c%o%s', 'background:yellow;', data, ' result and send a requests')
        });
        var doubanId = localStorage.getItem(imdbId);
    }
    console.log('%c%s', "color:orange;", `douban id: ${doubanId} , imdb id: ${imdbId}`);
    if (doubanId === null || doubanId === undefined || doubanId === '') {
        console.error(`Invalid doubanId: ${doubanId}`);
        return;
    }
    if (!doubanId) {
        localStorage.setItem(imdbId, '');
        return;
    }
    let buttonClass = imdbButton.className;
    let doubanString = `<a is="emby-linkbutton" class="${buttonClass}" href="https://movie.douban.com/subject/${doubanId}/" target="_blank"><i class="md-icon button-icon button-icon-left">link</i>Douban</a>`;
    imdbButton.insertAdjacentHTML('beforebegin', doubanString);
    insertDoubanScore(doubanId);
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

function checkIsExpire(key, expireDay = 1) {
    let timestamp = localStorage.getItem(key);
    if (!timestamp) return true;
    let expireMs = expireDay * 864E5;
    if (Number(timestamp) + expireMs < Date.now()) {
        localStorage.removeItem(key)
        logger.info(key, "IsExpire, old", timestamp, "now", Date.now());
        return true;
    } else {
        return false;
    }

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
        if (i.search(/^tt\d+/) != -1 && localStorage.getItem(i) === '') {
            console.log(i);
            count++;
            localStorage.removeItem(i);
        }
    }
    logger.info(`cleanDoubanError done, count=${count}`);
}

var runLimit = 50;

async function main() {
    let linkZone = getVisibleElement(document.querySelectorAll('div[class*="linksSection"]'));
    let infoTable = getVisibleElement(document.querySelectorAll('div[class*="flex-grow detailTextContainer"]'));
    if (infoTable && linkZone) {
        if (!infoTable.querySelector('h3.itemName-secondary')) { // not eps page
            insertDoubanMain(linkZone);
        } else {
            let bgmIdNode = document.evaluate('//div[contains(text(), "[bgm=")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
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
});
