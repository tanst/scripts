#!/bin/sh

# 使用说明：
# 脚本根据分类执行相关操作：
# 分类为：TV
#		去中文+添加S01
# 分类为：movie
#		去中文
# 利用 qbittorrent 下载完成时运行外部程序进行重命名方便搜刮器搜刮，不影响做种
# 脚本放置 /config 目录下
# qbittorrent 设置：设置-下载-Torrent 完成时运行外部程序：
# sh /config/run.sh %I %L

## 配置 ##
HOST=http://127.0.0.1:9094
USR=user
PAS=password

## 基础变量 ##
HASH=$1
CATEGORY=$2
cd $(dirname $0)
COOKIE="$(curl -i -s -k --header Referer: "${HOST}" --data "username=${USR}&password=${PAS}" "${HOST}/api/v2/auth/login" | grep SID | sed 's/.*SID=\(.*\); H.*/\1/')"

# ## 清除丢失文件的种子 ##
DELETE_HASHES="$(curl -s -k "${HOST}/api/v2/torrents/info" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g" | grep missingFiles | sed "s/.*\"hash\":\"\(.*\)\",\"last_activity\".*/\1/" | sed ":a;N;s/\n/|/g;ta")"
curl -s -k "${HOST}/api/v2/torrents/delete?hashes=${DELETE_HASHES}&deleteFiles=true" --cookie "SID=$COOKIE"

## 去中文字段 ##
clear_chinese_char() {

	FILES_LIST="$(curl -s -k "${HOST}/api/v2/torrents/files?hash=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g" | sed 's/.*"name":"\(.*\)","piece_range".*/\1/g')"
	echo "${FILES_LIST}" >/dev/shm/FILESLIST$$
	while read oldPath; do
		fen=$(echo ${oldPath} | sed 's/ /\./g' | sed 's/\//\/\n/g')
		for line in ${fen}; do
			NOCHANGE=$(echo ${line} | grep -Ev '.txt|.nfo|.jpg|.png|.ini')
			if [ -z ${NOCHANGE} ]; then
				# 如果是文本图片文件，则执行以下命令
				echo "${line}" >>/dev/shm/TEST$$
			else
				# 开始去中文
				line2=$(echo "${line}" | sed 's/\./\n/g' | sed '/[^A-Za-z0-9 -/@_&￡]/d' | sed ':a;N;s/\n/./g;ta')
				echo "${line2}" >>/dev/shm/TEST$$
			fi

		done
		newPath=$(sed ':a;N;s/\/\n/\//g;ta' /dev/shm/TEST$$)
		curl -s -k --data-urlencode "oldPath=$oldPath" --data-urlencode "newPath=$newPath" --data-urlencode "hash=$HASH"  "$HOST/api/v2/torrents/renameFile" --cookie "SID=$COOKIE"
		echo "=============================="
		echo "oldPath : $oldPath"
		echo "newPath : $newPath"
		rm /dev/shm/TEST$$
	done </dev/shm/FILESLIST$$
	rm /dev/shm/FILESLIST$$

}

add_senson() {
	FILES_LIST="$(curl -s -k "${HOST}/api/v2/torrents/files?hash=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g" | sed 's/.*"name":"\(.*\)","piece_range".*/\1/g')"
	echo "${FILES_LIST}" >/dev/shm/FILESLIST$$
	while read oldPath; do
		se="$(echo ${oldPath} | grep -iE s[0-9]\{1,2\}ep\?[0-9]\{1,2\})"
		if test -z "$se"; then
			SPath=$(echo "${oldPath}" | sed 's/ep\?\([0-9]\{1,2\}\)/S01E\1/gi')
		fi
		fen=$(echo ${SPath} | sed 's/ /\./g' | sed 's/\//\/\n/g')
		for line in ${fen}; do
			NOCHANGE=$(echo ${line} | grep -Ev '.txt|.nfo|.jpg|.png|.ini')
			if [ -z ${NOCHANGE} ]; then
				# 如果是文本图片文件，则执行以下命令
				echo "${line}" >>/dev/shm/TEST$$
			else
				# 开始去中文
				line2=$(echo "${line}" | sed 's/\./\n/g' | sed '/[^A-Za-z0-9 -/@_&￡]/d' | sed ':a;N;s/\n/./g;ta')
				echo "${line2}" >>/dev/shm/TEST$$
			fi

		done
		newPath=$(sed ':a;N;s/\/\n/\//g;ta' /dev/shm/TEST$$)
		curl -s -k --data-urlencode "oldPath=$oldPath" --data-urlencode "newPath=$newPath" --data-urlencode "hash=$HASH"  "$HOST/api/v2/torrents/renameFile" --cookie "SID=$COOKIE"
		echo "=============================="
		echo "oldPath : $oldPath"
		echo "newPath : $newPath"
		rm /dev/shm/TEST$$
	done </dev/shm/FILESLIST$$
	rm /dev/shm/FILESLIST$$
}

## 判断分类 ##
RESULT=$(echo "${CATEGORY}" | grep -E 'TV|movie')
if [ -z ${RESULT} ]; then
	echo "不是电视剧或电影，跳过"
	exit
fi
if [ "${CATEGORY}" == "TV" ]; then
	add_senson
fi
if [ "${CATEGORY}" == "movie" ]; then
	clear_chinese_char
fi


row_number=$(grep -c "" run.log)
delete_number=$(expr $row_number - 500)
if  [ ${delete_number} -gt 0 ]
    then
        sed -i "1,${delete_number}d" run.log
fi

