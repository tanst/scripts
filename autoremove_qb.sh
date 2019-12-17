#!/bin/sh

#Host
HOST=http://127.0.0.1:9091
USR=username
PAS=password

echo "\n[$(date "+%Y-%m-%d %H:%M:%S")] Start"
cd $(dirname $0)

human_bytes_2() {
	while read B dummy; do
		[ $B -lt 1024 ] && echo ${B} Bytes && break
		KB=$(echo "scale = 2; $B/1024" | bc | awk '{printf "%.2f", $0}')
		[ $(echo "$KB > 1024" | bc) -eq 0 ] && echo ${KB} KiB && break

		MB=$(echo "scale = 2; $KB/1024" | bc | awk '{printf "%.2f", $0}')
		[ $(echo "$MB > 1024" | bc) -eq 0 ] && echo ${MB} MiB && break

		GB=$(echo "scale = 2; $MB/1024" | bc | awk '{printf "%.2f", $0}')
		[ $(echo "$GB > 1024" | bc) -eq 0 ] && echo ${GB} GiB && break

		echo $(echo "scale = 2; $GB/1024" | bc | awk '{printf "%.2f", $0}') TiB
	done
}

#获取cookie

COOKIE="$(curl -i -s -k --header Referer: "${HOST}" --data "username=${USR}&password=${PAS}" "${HOST}/api/v2/auth/login" | grep SID | sed 's/.*SID=\(.*\); H.*/\1/')"

#获取种子列表

TORRENTS_LIST="$(curl -s -k "${HOST}/api/v2/torrents/info" --cookie "SID=$COOKIE")"

LIST=$(echo "${TORRENTS_LIST}" | sed "s/},{/}\n{/g")

echo "$LIST" >LIST
TOTAL_NO=$(echo "$LIST" | wc -l)
DELETE_NO=0

while read line; do
	NAME=$(echo $line | sed "s/.*\"name\":\"\(.*\)\",\"num_complete\".*/\1/")
	HASH=$(echo $line | sed "s/.*\"hash\":\"\(.*\)\",\"last_activity\".*/\1/")
	CATEGORY=$(echo $line | sed "s/.*\"category\":\"\(.*\)\",\"completed\".*/\1/")
	TOTAL_SIZE=$(echo $line | sed "s/.*\"total_size\":\(.*\),\"tracker\".*/\1/")
	RATIO=$(echo $line | sed "s/.*\"ratio\":\(.*\),\"ratio_limit\".*/\1/")
	UPLOADED=$(echo $line | sed "s/.*\"uploaded\":\(.*\),\"uploaded_session\".*/\1/")
	COMPLETION_ON=$(echo $line | sed "s/.*\"completion_on\":\(.*\),\"dl_limit\".*/\1/")
	UPSPEED=$(echo $line | sed "s/.*\"upspeed\":\([0-9]*\)}.*/\1/")
	STATE=$(echo $line | sed "s/.*\"state\":\"\(.*\)\",\"super_seeding\".*/\1/")
	LAST_ACTIVITY=$(echo $line | sed "s/.*\"last_activity\":\(.*\),\"magnet_uri\".*/\1/")

	#筛选符合条件的种子列表
	#1MB=1048576 2MB=2097152
	#分类：FREE; 上传速度小于 1MB/S; 完成时间大于30分钟; 状态：上传中和做种中（无上传）；最后活动时间大于12小时(排除效验的0)，并且上传速度等于0。
	SEEDING_TIME=$(expr $(date +%s) - $COMPLETION_ON)
	LAST_ACTIVITY_TIME=$(expr $(date +%s) - $LAST_ACTIVITY)

	if [ $CATEGORY = FREE ] && [ $UPSPEED -lt 1048576 ] && [ $SEEDING_TIME -gt 1800 ] && ([ $STATE = uploading ] || [ $STATE = stalledUP ]) || ([ $LAST_ACTIVITY -ne 0 ] && [ $LAST_ACTIVITY_TIME -gt 43200 ] && [ $UPSPEED -eq 0 ]); then
		DELETE="$HASH|$DELETE"
		DELETE_NO=$(($DELETE_NO + 1))
		echo "[$(date "+%Y-%m-%d %H:%M:%S")] [Removed] [${NAME}]	HASH:${HASH}	Size:$(echo ${TOTAL_SIZE} | human_bytes_2)	Ratio: $(echo ${RATIO} | awk '{printf "%.3f", $0}')	Total Uploaded: $(echo ${UPLOADED} | human_bytes_2)	Category:${CATEGORY}	Completion On: $(date "+%Y-%m-%d %H:%M:%S" -d @${COMPLETION_ON})"

	fi

done <LIST
rm LIST

#删除种子
DELETE_HASH=$(echo $DELETE | sed 's/\(.*\)|/\1/')
curl -s -k "${HOST}/api/v2/torrents/delete?hashes=${DELETE_HASH}&deleteFiles=true" --cookie "SID=$COOKIE"

echo "[$(date "+%Y-%m-%d %H:%M:%S")] Total: ${TOTAL_NO} torrent(s). ${DELETE_NO} torrent(s) have been removed."
