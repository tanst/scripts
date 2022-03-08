#!/bin/sh

#========================================================
# 使用说明：
# 脚本根据分类执行相关操作：
# 总分类自动创建文件夹，并重命名为：中文（年份）-原文件名
# 添加S01分类自动判断添加 S01
# 利用 qbittorrent 下载完成时运行外部程序进行重命名方便搜刮器搜刮，不影响做种
# 脚本放置 /config 目录下
# qbittorrent 设置：设置-下载-Torrent 完成时运行外部程序：
# bash /config/run.sh "%I" "%L"
#========================================================

## 配置 ##
HOST=http://127.0.0.1:9094
USR=user
PAS=password
logfile="/config/run.log"
## 总分类（其余不处理） ##
CATEGORY_ARRAY=(
      'TV'
      'movie'
)

## 添加S01分类 ##
CATEGORY_ARRAY_S=(
      'TV'
)

## 基础变量 ##
HASH=$1
CATEGORY=$2

exec 1>>$logfile 2>&1
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

echo "#-------------------种子信息----------------"
echo "# "
echo $(echo '# ['&&date "+%Y-%m-%d %H:%M:%S"&&echo ']')
echo "# 种子名字：${TORRENT_NAME}"
echo "# HASH：${HASH}"
echo "# 保存路径：${TORRENT_SAVE_PATH}"
echo "# 分类：${CATEGORY}"
echo "# -------------------------------------------"

name_year() {

      if [ ! -z "$(echo $name | grep '\.[0-9]\{4\}\.')" ]; then
            year=$(echo "$name" | sed 's/.*\.\([0-9]\{4\}\)\..*/\1/g')
            # 去 4 位数字后字符
            first_name=$(echo "$name" | sed 's/\(.*\.[0-9]\{4\}\)\..*/\1/g')
            result=$(echo "$first_name" | grep '[^A-Za-z0-9 -/@_&￡]')
            if [[ "$result" != "" ]]; then
                #   echo "包含中文"
                  first_name=$(echo "$first_name" | sed 's/\./\n/g' | grep '[^A-Za-z0-9 -/@_&￡]' | sed ':a;N;s/\n/./g;ta')
            else
                #   echo "不包含中文"
                #   echo "$first_name"
                  first_name=$(echo "$first_name" | sed 's/\(.*\)\.[0-9]\{4\}/\1/g')
            fi
            finale_name=$first_name"("$year")""-"$name
      else
            finale_name=$name
      fi
}

# 检测目录是否存在
if [ -z "$(echo "${FILES_NAME}" | grep -E '/')" ]; then
      echo "===========开始自动创建文件夹=========="
      echo "单文件，即将创建子文件夹"
      name=$(echo "${TORRENT_NAME}" | sed 's/ /\./g' | sed 's/\(.*\)\.[^.]*/\1/')
      name_year
      TORRENT_NEW_SAVE_PATH="${TORRENT_SAVE_PATH}${finale_name}"
      curl -s -k --data-urlencode "location=$TORRENT_NEW_SAVE_PATH" --data-urlencode "hashes=$HASH" "${HOST}/api/v2/torrents/setLocation" --cookie "SID=$COOKIE"
      echo "种子原保存路径：${TORRENT_SAVE_PATH}"
      echo "种子新保存路径：${TORRENT_NEW_SAVE_PATH}"
fi

## 判断分类 ##
if [[ -z $(echo "${CATEGORY_ARRAY[@]}" | grep -E "${CATEGORY}") ]] || [[ ${CATEGORY} == "" ]]; then
      echo "分类：${CATEGORY}"
      echo "不在处理分类中，跳过"
      exit
fi

files_no=0
for oldPath in ${FILES_NAME}; do
    files_no=$(($files_no + 1))
    ## 判断分类 ##
    if [[ ! -z $(echo "${CATEGORY_ARRAY_S[@]}" | grep -E "${CATEGORY}") ]]; then
        se="$(echo ${oldPath} | grep -iE s[0-9]\{1,2\}ep\?[0-9]\{1,2\})"
        if test -z "$se"; then                                                  # 如果没有 s01
            SPath=$(echo "${oldPath}" | sed 's/ep\?\([0-9]\{1,2\}\)/S01E\1/gi') # 添加 S01
            fen=$(echo ${SPath} | sed 's/ /\./g')
        else
            fen=$(echo ${oldPath} | sed 's/ /\./g')
        fi
    else
        fen=$(echo ${oldPath} | sed 's/ /\./g')
    fi

    fen1=$(echo $fen | sed 's/\(.[^/]*\/\).*/\1/')
    fen2=$(echo $fen | sed 's/.[^/]*\/\(.*\)/\1/')

    name=$fen1
    name_year
    newPath=$finale_name$fen2

    curl -s -k --data-urlencode "oldPath=$oldPath" --data-urlencode "newPath=$newPath" --data-urlencode "hash=$HASH" "$HOST/api/v2/torrents/renameFile" --cookie "SID=$COOKIE"
    echo "=========文件$files_no================"
    echo "oldPath : $oldPath"
    echo "newPath : $newPath"

done

row_number=$(grep -c "" run.log)
delete_number=$(expr $row_number - 500)
if [ ${delete_number} -gt 0 ]; then
    sed -i "1,${delete_number}d" run.log
fi
