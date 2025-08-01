(function() {
  // 缓存key前缀
  const CACHE_KEY_PREFIX = 'embyDoubanScore_';

  // 获取 Emby 4.8.x 电影标题
  function getEmbyTitle() {
    const container = document.querySelector('.itemPrimaryNameContainer');
    if (!container) return '';
    const textTitle = container.querySelector('.itemName-primary');
    if (textTitle && textTitle.textContent) return textTitle.textContent.trim();
    const imgTitle = container.querySelector('.itemName-primary-logo img');
    if (imgTitle && imgTitle.getAttribute('alt')) return imgTitle.getAttribute('alt').trim();
    return '';
  }

  // 查询豆瓣评分
  async function fetchDoubanScore(title) {
    try {
      const suggestUrl = `/douban-proxy/j/subject_suggest?q=${encodeURIComponent(title)}`;
      const suggestRes = await fetch(suggestUrl);
      if (!suggestRes.ok) return null;
      const suggestArr = await suggestRes.json();
      if (!suggestArr.length) return null;
      const info = suggestArr[0];
      const absUrl = `/douban-proxy/j/subject_abstract?subject_id=${info.id}`;
      const absRes = await fetch(absUrl);
      if (!absRes.ok) return null;
      const absJson = await absRes.json();
      const rate = absJson?.subject?.rate || '?';
      const link = `/douban-proxy/subject/${info.id}/`;
      return { rate, link, title: info.title };
    } catch (e) {
      return null;
    }
  }

  // 插入评分
  function insertDoubanScore(rateObj) {
    if (document.querySelector('#doubanScore_injected')) return;
    const infoList = document.querySelector('.detailPagePrimaryInfo .mediaInfoList');
    if (!infoList) return;
    const html = `
      <div class="mediaInfoItem" id="doubanScore_injected" style="color:#27ae60;font-weight:bold;">
        <img src="https://img.icons8.com/color/16/000000/d.png" style="vertical-align:middle" />
        <a href="${rateObj.link}" target="_blank" style="color:#27ae60;text-decoration:none;">豆瓣评分：${rateObj.rate}</a>
      </div>
    `;
    infoList.insertAdjacentHTML('afterbegin', html);
  }

  function cacheSet(title, data) {
    try {
      localStorage.setItem(CACHE_KEY_PREFIX + title, JSON.stringify({data, t:Date.now()}));
    } catch (e) {}
  }
  function cacheGet(title) {
    try {
      const str = localStorage.getItem(CACHE_KEY_PREFIX + title);
      if (!str) return null;
      const obj = JSON.parse(str);
      // 只缓存30天
      if (!obj || !obj.t || (Date.now() - obj.t > 1000*3600*24*30)) {
        localStorage.removeItem(CACHE_KEY_PREFIX + title);
        return null;
      }
      return obj.data;
    } catch (e) { return null; }
  }

  async function main() {
    const title = getEmbyTitle();
    if (!title) return;
    if (document.querySelector('#doubanScore_injected')) return;

    // 查缓存
    let cached = cacheGet(title);
    if (cached) {
      insertDoubanScore(cached);
      return;
    }
    // 请求
    const score = await fetchDoubanScore(title);
    if (score) {
      cacheSet(title, score);
      insertDoubanScore(score);
    }
  }

  // Emby SPA，hash变化后页面有延迟，需等一会
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(main, 1000); // 保证元素已渲染
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(main, 1000));
  }

  // 可选：你可以监听 hashchange，在切换不同影片时再次尝试 main()
  window.addEventListener('hashchange', () => setTimeout(main, 1000));

})();
