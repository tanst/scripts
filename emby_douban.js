(function() {
  'use strict';

  let isEmpty = function(value) {
    return value === undefined || value === null || value === '';
  };

  let getVisibleElement = function(elements) {
    for (let i = 0; i < elements.length; i++) {
      let element = elements[i];
      if (element.offsetParent !== null) {
        return element;
      }
    }
    return null;
  };

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
    if(!id){
      return;
    }
    const search = await getJSON(`https://movie.douban.com/j/subject_suggest?q=${id}`);
    if (search && search.length > 0 && search[0].id) {
      const abstract = await getJSON(`https://movie.douban.com/j/subject_abstract?subject_id=${search[0].id}`);
      const average = abstract && abstract.subject && abstract.subject.rate ? abstract.subject.rate : '?';
      const comment = abstract && abstract.subject && abstract.subject.short_comment && abstract.subject.short_comment.content;
      return {
        id: search[0].id,
        comment: comment,
        rating: { numRaters: '', max: 10, average },
        title: search[0].title,
        sub_title: search[0].sub_title,
      };
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
      let doubanIco = `<img style="width:16px;" src="data:image/x-icon;base64,==">`;
      yearDiv.insertAdjacentHTML('beforebegin', `<div class="starRatingContainer mediaInfoItem">${doubanIco}<a id="doubanScore">${rating}</a></div>`);
      console.log('%c%s', 'color: orange;', 'insert score ', doubanId, rating);
    }
    console.log('%c%s', 'color: orange;', 'finish ', doubanId, rating);
  }

  function insertDoubanComment(doubanId, comment) {
    comment = comment || localStorage.getItem(doubanId + 'Comment');
    if (!comment) {
      return;
    }
    let commentContainer = getVisibleElement(document.querySelectorAll('div.secondary.metadata'));
    if (!commentContainer) {
      return;
    }
    let commentDiv = document.createElement('div');
    commentDiv.className = 'doubanComment';
    commentDiv.textContent = comment;
    commentContainer.appendChild(commentDiv);
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
          if (data.comment) {
            insertDoubanComment(doubanId, data.comment);
            localStorage.setItem(doubanId + 'Comment', data.comment);
          }
        }
        console.log('%c%o%s', 'background:yellow;', data, ' result and send a requests')
      });
      var doubanId = localStorage.getItem(imdbId);
    }
    console.log('%c%o%s', "color:orange;", 'douban id ', doubanId, String(imdbId));
    if (!doubanId) {
      localStorage.setItem(imdbId, '');
      return;
    }
    let buttonClass = imdbButton.className;
    let doubanString = `<a is="emby-linkbutton" class="${buttonClass}" href="https://movie.douban.com/subject/${doubanId}/" target="_blank"><i class="md-icon button-icon button-icon-left">link</i>Douban</a>`;
    imdbButton.insertAdjacentHTML('beforebegin', doubanString);
    insertDoubanScore(doubanId);
    insertDoubanComment(doubanId);
  }

  // 监听页面变化并执行insertDoubanMain函数
  let observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          let node = mutation.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            let linkZones = node.querySelectorAll('div.secondary.mediaInfoIcons');
            linkZones.forEach(insertDoubanMain);
          }
        }
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
