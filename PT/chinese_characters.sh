#!/bin/sh

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

## 清除【movie】和【TV】分类文件名中的中文字段 ##
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
        curl -s -k -G --data-urlencode "oldPath=$oldPath" --data-urlencode "newPath=$newPath" "$HOST/api/v2/torrents/renameFile?hash=$HASH" --cookie "SID=$COOKIE"
		echo "=============================="
		echo "oldPath : $oldPath"
		echo "newPath : $newPath"
		rm /dev/shm/TEST$$
	done </dev/shm/FILESLIST$$
	rm /dev/shm/FILESLIST$$

}
RESULT=$(echo "${CATEGORY}" | grep -E 'TV|movie')
if [ -z ${RESULT} ]; then
	exit
else
	clear_chinese_char
fi
