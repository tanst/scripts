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
# bash /config/run.sh "%I" "%L" > /config/run.log

## 配置 ##
HOST=http://127.0.0.1:9094
USR=user
PAS=password

## 基础变量 ##
HASH=$1
CATEGORY=$2
cd $(dirname $0)
COOKIE="$(curl -i -s -k --header Referer: "${HOST}" --data "username=${USR}&password=${PAS}" "${HOST}/api/v2/auth/login" | grep SID | sed 's/.*SID=\(.*\); H.*/\1/')"
IFS=$'\n'

## 获取种子信息 ##
TORRENT_INFO="$(curl -s -k "${HOST}/api/v2/torrents/info?hashes=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g")"
# echo "===========种子信息=========="
# echo "${TORRENT_INFO}"

## 获取文件信息 ##
FILES_INFO="$(curl -s -k "${HOST}/api/v2/torrents/files?hash=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g")"
#echo "===========文件信息=========="
#echo "${FILES_INFO}"

## 获取文件名 ##
FILES_NAME="$(echo "${FILES_INFO}" | sed 's/.*"name":"\([^"]*\)".*/\1/g')"
#echo "===========文件名=========="
#echo "${FILES_NAME}"

# ## 获取种子名 ##
TORRENT_NAME="$(echo "${TORRENT_INFO}" | sed 's/.*"name":"\([^"]*\)".*/\1/g')"
# echo "===========种子名=========="
# echo "${TORRENT_NAME}"

## 获取种子属性 ##
# TORRENT_s="$(curl -s -k "${HOST}/api/v2/torrents/properties?hash=${HASH}" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g")"
# echo "===========种子属性=========="
# echo "${TORRENT_s}"

# ## 获取种子保存路径 ##
TORRENT_SAVE_PATH="$(echo "${TORRENT_INFO}" | sed 's/.*"save_path":"\([^"]*\)".*/\1/g')"
# echo "===========种子保存路径=========="
# echo "${TORRENT_SAVE_PATH}"

# ## 清除丢失文件的种子 ##
DELETE_HASHES="$(curl -s -k "${HOST}/api/v2/torrents/info" --cookie "SID=$COOKIE" | sed "s/},{/}\n{/g" | grep missingFiles | sed "s/.*\"hash\":\"\(.*\)\",\"last_activity\".*/\1/" | sed ":a;N;s/\n/|/g;ta")"
curl -s -k "${HOST}/api/v2/torrents/delete?hashes=${DELETE_HASHES}&deleteFiles=true" --cookie "SID=$COOKIE"

echo "++++++++++种子信息++++++++++"
echo ""
echo $(echo '[' && date "+%Y-%m-%d %H:%M:%S" && echo ']')
echo "${TORRENT_NAME}"
echo "${HASH}"
echo "${TORRENT_SAVE_PATH}"
echo ""
echo "++++++++++++++++++++++++++++++++++++++++"

if [ -z "$(echo "${FILES_NAME}" | grep -E '/')" ]; then
	echo "===========自动创建子文件夹=========="
	TORRENT_NEW_SAVE_PATH="${TORRENT_SAVE_PATH}$(echo "${TORRENT_NAME}" | sed 's/\(.*\)\.[^.]*/\1/')"
	echo "单文件，即将创建子文件夹"
	curl -s -k --data-urlencode "location=$TORRENT_NEW_SAVE_PATH" --data-urlencode "hashes=$HASH" "${HOST}/api/v2/torrents/setLocation" --cookie "SID=$COOKIE"
	echo "种子原保存路径：${TORRENT_SAVE_PATH}"
	echo "种子新保存路径：${TORRENT_NEW_SAVE_PATH}"
fi

## 判断分类 ##
RESULT=$(echo "${CATEGORY}" | grep -E 'TV|movie')
if [ -z ${RESULT} ]; then
	echo "不是电视剧或电影，跳过"
	exit
fi

files_no=0
for oldPath in ${FILES_NAME}; do
	files_no=$(($files_no + 1))
	## 判断分类 ##
	if [ "${CATEGORY}" == "TV" ]; then
		se="$(echo ${oldPath} | grep -iE s[0-9]\{1,2\}ep\?[0-9]\{1,2\})"
		if test -z "$se"; then
			SPath=$(echo "${oldPath}" | sed 's/ep\?\([0-9]\{1,2\}\)/S01E\1/gi')
		fi
		fen=$(echo ${SPath} | sed 's/ /\./g' | sed 's/\//\/\n/g')
	else
		fen=$(echo ${oldPath} | sed 's/ /\./g' | sed 's/\//\/\n/g')
	fi
	for line in ${fen}; do
		NOCHANGE=$(echo ${line} | grep -Ev '.txt|.nfo|.jpg|.png|.ini')
		if [ -z ${NOCHANGE} ]; then
			# 如果是文本图片文件，则执行以下命令
			newPath+="${line}"
		else
			# 开始去中文
			line=$(echo "${line}" | sed 's/\./\n/g' | sed '/[^A-Za-z0-9 -/@_&￡]/d' | sed ':a;N;s/\n/./g;ta')
			newPath+="${line}"
		fi

	done
	curl -s -k --data-urlencode "oldPath=$oldPath" --data-urlencode "newPath=$newPath" --data-urlencode "hash=$HASH" "$HOST/api/v2/torrents/renameFile" --cookie "SID=$COOKIE"
	echo "=========文件$files_no================"
	echo "oldPath : $oldPath"
	echo "newPath : $newPath"
	newPath=""

done

row_number=$(grep -c "" run.log)
delete_number=$(expr $row_number - 500)
if [ ${delete_number} -gt 0 ]; then
	sed -i "1,${delete_number}d" run.log
fi
