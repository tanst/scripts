#!/bin/bash
# qbittorrent 批量编辑 tracker
# 设置变量
HOST=http://127.0.0.1:9094
USR=toy
PASSWORD='iG^n$&i54dh57$X2EoB'
oldTracker="https://chdbits.co/"
newTracker="https://chdbits.xyz/"

# 登录并获取COOKIE
COOKIE=$(curl -isk --data-urlencode "username=${USR}" --data-urlencode "password=${PASSWORD}" "${HOST}/api/v2/auth/login" | grep -i 'Set-Cookie' | awk '{print $2}')

# 检查COOKIE是否存在，提示登录成功
if [ -n "$COOKIE" ]; then
    echo "登录成功！"

    # 获取所有种子信息
    json=$(curl -sk "$HOST/api/v2/torrents/info" --cookie "$COOKIE")

    # 使用grep和sed命令提取hash和tracker值
    hash_values=$(echo "${json}" | grep -o '"hash":"[^"]*' | sed 's/"hash":"//g')
    tracker_values=$(echo "${json}" | grep -o '"tracker":"[^"]*' | sed 's/"tracker":"//g')

    # 循环处理每一组hash和tracker
    i=0
    while IFS= read -r hash; do
        tracker=$(echo "${tracker_values}" | awk NR==$((i + 1)))

        # 判断tracker是否包含oldTracker
        if [ "$(expr "$tracker" : ".*$oldTracker")" -gt 0 ]; then
            origUrl="$tracker"
            newUrl="${tracker//$oldTracker/$newTracker}"

            # 运行cURL命令
            curl -k --data-urlencode "origUrl=$origUrl" --data-urlencode "newUrl=$newUrl" --data-urlencode "hash=$hash" "$HOST/api/v2/torrents/editTracker" --cookie "$COOKIE"
        fi

        i=$((i + 1))
    done <<EOF
$hash_values
EOF
else
    echo "登录失败！"
fi
