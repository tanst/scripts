#!/bin/sh

# 使用说明：
# 利用 qbittorrent 下载完成时运行外部程序进行重命名方便搜刮器搜刮，不影响做种
# 脚本放置 /config 目录下，下载时设置分类：guochan
# qbittorrent 设置：设置-下载-Torrent 完成时运行外部程序：
# sh /config/add_senson.sh %I %L

#######################################
HOST=http://127.0.0.1:9094
USR=user
PAS=password
CATEGORY_DECIDE=guochan
HASH=$1
CATEGORY=$2
#######################################
if [ "${CATEGORY}" != "${CATEGORY_DECIDE}" ]; then
    exit
fi
cd $(dirname $0)

COOKIE="$(curl -i -s -k --header Referer: "${HOST}" --data "username=${USR}&password=${PAS}" "${HOST}/api/v2/auth/login" | grep SID | sed 's/.*SID=\(.*\); H.*/\1/')"

FILES_LIST="$(curl -s -k "${HOST}/api/v2/torrents/files?hash=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g" | sed 's/.*"name":"\(.*\)","piece_range".*/\1/g')"

echo "${FILES_LIST}" >/dev/shm/FILESLIST$$

while read oldPath; do
    se="$(echo ${oldPath} | grep -iE s[0-9]\{1,2\}ep\?[0-9]\{1,2\})"
    newPath="${oldPath}"
    if test -z "$se"; then
        #去中文
        #newPath="$(echo ${oldPath} | sed 's/[^A-Za-z0-9 ._/-]//g' | sed 's/^[ .]//g' | sed 's/\/\./\//g')"
        newPath=$(echo "${newPath}" | sed 's/ep\?\([0-9]\{1,2\}\)/S01E\1/gi')
        curl -s -k -G --data-urlencode "oldPath=$oldPath" --data-urlencode "newPath=$newPath" "$HOST/api/v2/torrents/renameFile?hash=$HASH" --cookie "SID=$COOKIE"
    fi
    echo "=============================="
    echo "oldPath : $oldPath"
    echo "newPath : $newPath"
done </dev/shm/FILESLIST$$
rm /dev/shm/FILESLIST$$
