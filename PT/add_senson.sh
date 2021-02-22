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

FILES_LIST="$(curl -s -k "${HOST}/api/v2/torrents/files?hash=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g" | sed 's/.*"name":"\(.*\)","piece_range".*/\1/g' | sed 's/.*\/\(.*\)/\1/g')"

echo "${FILES_LIST}" >/dev/shm/FILESLIST$$
id=-1
while read line; do
	id=$(($id + 1))
	se="$(echo ${line} | grep -E [sS][0-9]\{1,2\}[eE][0-9]\{1,2\})"
	if [ -z "$se" ]; then
		name=$(echo "${line}" | sed 's/\([eE][0-9]\{1,2\}\|ep[0-9]\{1,2\}\|Ep[0-9]\{1,2\}\|EP[0-9]\{1,2\}\)/S01\1/g')
		echo "${id}:${name}"
		curl -s -k "${HOST}/api/v2/torrents/renameFile?hash=${HASH}&id=${id}&name=${name}" --cookie "SID=$COOKIE"
	fi
done </dev/shm/FILESLIST$$
rm /dev/shm/FILESLIST$$
