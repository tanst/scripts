#!/bin/sh

HOST=http://127.0.0.1:9094
USR=user
PAS=password
HASH=$1
CATEGORY=$2
#######################################
if [ "${CATEGORY}" != 'guochan' ]; then
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
		name=$(echo "${line}" | sed 's/\([eEpP]\{1,2\}[0-9]\{1,2\}\)/S01\1/g')
		echo "${id}:${name}"
		curl -s -k "${HOST}/api/v2/torrents/renameFile?hash=${HASH}&id=${id}&name=${name}" --cookie "SID=$COOKIE"
	fi
done </dev/shm/FILESLIST$$
rm /dev/shm/FILESLIST$$
