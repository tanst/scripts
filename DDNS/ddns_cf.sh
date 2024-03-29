#!/bin/sh

#====================================================
#    Tips: 同步 openwrt 的公网 IP 到所有域名A(AAAA)解析
#    Author: toy
#    Dscription: IPv4 & IPv6 cloudflare ddns script
#    email: t@tanst.net
#====================================================

#=============== personal config ==============#

DOMAIN=$(
	cat <<EOF
example.com
*.example.com
EOF
)

# API 令牌(非 API 密钥)
# https://dash.cloudflare.com/profile/api-tokens
DDNS_API="xxxxxxxxxx"

Email_to=example@example.com
Email_title='The IP Changed.'

# WxPusher微信推送服务
# https://wxpusher.zjiecode.com/
WCappToken=xxxxxxxxxx
WCuids=xxxxxxxxxx

#=============== personal config END ==============#

#===== check IPv4 =======
CHECKURL_V4_1=ip.3322.net
CHECKURL_V4_2=api.ipify.org
CHECKURL_V4_3=ipv4.icanhazip.com

#===== check IPv6 =======
CHECKURL_V6_1=ipv6.icanhazip.com
CHECKURL_V6_2=ipv6.ip.sb
CHECKURL_V6_3=checkip.dns.he.net
# checkhost=checkip.dns.he.net

#=============== system config ===============
date
cd $(dirname $0)
if type curl >/dev/null 2>&1; then
	echo "curl 已安装"
else
	echo "curl 未安装"
	exit
fi

#=============== function ===============

sleep_time() {
	sleep=5
	while [ $sleep -gt 0 ]; do
		echo -n $sleep
		sleep 1
		sleep=$(($sleep - 1))
		echo -ne "\r     \r"
	done
}

send_email() {
	Email_body="Hi~<br><br>The new ip is: <br>${NewIP}<br><br>------------<br><br>$(date "+%Y-%m-%d %H:%M:%S")<br>This mail is auto generated by mail api."
	curl -k https://tanst.net/script/mail.php -X POST -d "to=${Email_to}&title=$Email_title&fr=$Email_fr&Body=$Email_body"
}

send_wechat() {
	date=$(date "+%Y-%m-%d %H:%M:%S")
	JSON='{
      "appToken":"'$WCappToken'",
      "content":"'$DOMAIN_sub' 的IP地址已更改：\n'$NewIP'\n时间：'$date'",
      "contentType":1,
      "uids":["'$WCuids'"]
    }'
	curl -s -k http://wxpusher.zjiecode.com/api/send/message -X POST -H "Content-Type: application/json" -d "${JSON}"
}

GetZoneID() {
	DOMAIN_id=$(echo $DOMAIN_sub | awk -F . '{printf "%s.%s",$(NF-1),$(NF) }')
	ZONE_ID_json=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN_id" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json")
	ZONE_ID=$(echo $ZONE_ID_json | sed -E "s/.+\"result\":\[\{\"id\":\"([a-f0-9]+)\"[^\}]+$DOMAIN_id.+/\1/g")
	echo "ZONE_ID: ${ZONE_ID}"
}

GetWanIPv4() {
	ping -4 -c2 223.6.6.6 >>/dev/null 2>&1
	if [ $? -eq 0 ]; then
		echo -e "\nIPv4 network is ok."

		local lanIps="^$"
		lanIps="$lanIps|(^10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$)"
		lanIps="$lanIps|(^127\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$)"
		lanIps="$lanIps|(^169\.254\.[0-9]{1,3}\.[0-9]{1,3}$)"
		lanIps="$lanIps|(^172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3}$)"
		lanIps="$lanIps|(^192\.168\.[0-9]{1,3}\.[0-9]{1,3}$)"

		Home_IPv4=$(ip -o -4 addr list | grep -Ev '\s(docker|lo)' | awk '{print $4}' | cut -d/ -f1 | grep -Ev "$lanIps")

		#如果通过网卡未获取到公网 IPv4，再通过访问公网 API 获取。
		if [ -z "$Home_IPv4" ]; then
			echo "网卡未获取到公网 IPv4，开始通过访问公网 API 获取"
			IPv4REX='[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}'
			Home_IPv4=$(curl -4 -k -s $CHECKURL_V4_1 | grep -Eo "$IPv4REX")

			if test $Home_IPv4; then
				echo "succeeded: $CHECKURL_V4_1 获取公网IPv4正常"
			else
				echo "error: $CHECKURL_V4_1 获取公网IPv4错误，请检查URL是否正常"
				Home_IPv4=$(curl -4 -k -s $CHECKURL_V4_2 | grep -Eo "$IPv4REX" | sed -nr "$SEDREX")
				if test $Home_IPv4; then
					echo "succeeded: $CHECKURL_V4_2 获取公网IPv4正常"
				else
					echo "error: $CHECKURL_V4_2 获取公网IPv4错误，请检查URL是否正常"
					Home_IPv4=$(curl -4 -k -s $CHECKURL_V4_3 | grep -Eo "$IPv4REX" | sed -nr "$SEDREX")
					if test $Home_IPv4; then
						echo "succeeded: $CHECKURL_V4_3 获取公网IPv4正常"
					else
						echo "error: $CHECKURL_V4_3 获取公网IPv4错误，请检查URL是否正常"
						exit
					fi
				fi
			fi
		else
			echo "succeeded: IPv4 通过网卡获取公网 IPv4 正常"
		fi

		Home_IPv4_No=$(echo "${Home_IPv4}" | wc -l | awk '{print $1}')
		echo -e "\n${DOMAIN_sub}: Home_IPv4 ============"
		echo "${Home_IPv4}"

	else
		echo -e "\nIPv4 network is down,please check it."
	fi
}

GetWanIPv6() {
	ping -6 -c2 2400:3200::1 >>/dev/null 2>&1
	if [ $? -eq 0 ]; then
		echo -e "\nIPv6 network is ok."

		Home_IPv6=$(ip -o -6 addr list | grep -Ev '\s(docker|lo)' | awk '{print $4}' | cut -d/ -f1 | grep ^2 | grep ::1$)
		if [ -z "$Home_IPv6" ]; then
			echo "网卡未获取到公网 IPv6，开始通过访问公网 API 获取"
			IPv6REX='([a-f0-9]{1,3}(:[a-f0-9]{1,4}){7}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){0,7}::[a-f0-9]{0,4}(:[a-f0-9]{1,4}){0,7})'
			Home_IPv6=$(curl -6 -k -s $CHECKURL_V6_1 | grep -Eo "$IPv6REX")

			if test $Home_IPv6; then
				echo "succeeded: $CHECKURL_V6_1 获取公网IPv6正常"
			else
				echo "error: $CHECKURL_V6_1 获取公网IPv6错误，请检查URL是否正常"
				Home_IPv6=$(curl -6 -k -s $CHECKURL_V6_2 | grep -Eo "$IPv6REX" | sed -nr "$SEDREX")
				#改成群晖 IPv6
				Home_IPv6=$(echo "${Home_IPv6}" | sed 's/::1/:7285:c2ff:fe58:11b6/')
				if test $Home_IPv6; then
					echo "succeeded: $CHECKURL_V6_2 获取公网IPv6正常"
				else
					echo "error: $CHECKURL_V6_2 获取公网IPv6错误，请检查URL是否正常"
					Home_IPv6=$(curl -6 -k -s $CHECKURL_V6_3 | grep -Eo "$IPv6REX" | sed -nr "$SEDREX")
					#改成群晖 IPv6
					Home_IPv6=$(echo "${Home_IPv6}" | sed 's/::1/:7285:c2ff:fe58:11b6/')
					if test $Home_IPv6; then
						echo "succeeded: $CHECKURL_V6_3 获取公网IPv6正常"
					else
						echo "error: $CHECKURL_V6_3 获取公网IPv6错误，请检查URL是否正常"
						exit
					fi
				fi
			fi
		else
			echo "succeeded: IPv6 通过网卡获取公网 IPv6 正常"
		fi

		#改成群晖 IPv6
		Home_IPv6=$(echo "${Home_IPv6}" | sed 's/::1/:7285:c2ff:fe58:11b6/')
		Home_IPv6_No=$(echo "${Home_IPv6}" | wc -l | awk '{print $1}')
		echo -e "\n${DOMAIN_sub}: Home_IPv6 ============"
		echo "${Home_IPv6}"

	else
		echo -e "\nIPv6 network is down,please check it."
	fi
}

GetRecordIPv4() {

	Record_IPv4_json=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$DOMAIN_sub&type=A" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json")
	Record_IPv4=$(echo $Record_IPv4_json | sed 's/},{/\n/g' | sed 's/.*"content":"\([0-9\.]*\)","proxiable.*/\1/')
	Record_IPv4_No=$(echo "${Record_IPv4}" | wc -l | awk '{print $1}')
	echo -e "\n${DOMAIN_sub}: Record_IPv4 ============"
	echo "${Record_IPv4}"

}

GetRecordIPv6() {

	Record_IPv6_json=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$DOMAIN_sub&type=AAAA" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json")
	Record_IPv6=$(echo $Record_IPv6_json | sed 's/},{/\n/g' | sed 's/.*"content":"\([0-9a-f\.:]*\)","proxiable.*/\1/')
	Record_IPv6_No=$(echo "${Record_IPv6}" | wc -l | awk '{print $1}')
	echo -e "\n${DOMAIN_sub}: Record_IPv6 ============"
	echo "${Record_IPv6}"

}

UpdateIPv4() {

	# 判断 home 记录是否等于 dns 记录

	Same_No=0
	for i in ${Record_IPv4}; do
		for j in ${Home_IPv4}; do
			if [ $i == $j ]; then
				Same_No=$(($Same_No + 1))
				break
			fi
		done
	done

	if [ ${Record_IPv4_No} -eq ${Home_IPv4_No} -a ${Same_No} -eq ${Home_IPv4_No} ]; then
		echo "Record_IPv4_No: ${Record_IPv4_No}"
		echo "Home_IPv4_No: ${Home_IPv4_No}"
		echo "IPv4_Same_No: $Same_No"
		echo "记录完全相等，不用修改"
	else
		echo "home 记录与 dns 记录不一致"
		echo "开始修改记录"

		# 删除 dns 里的记录
		echo "开始删除 dns 里的记录"

		for ip in ${Record_IPv4}; do
			ID_json=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=A&name=$DOMAIN_sub&content=$ip" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json")
			Record_IPv4_ID=$(echo $ID_json | sed -E "s/.+\"result\":\[\{\"id\":\"([a-f0-9]+)\",\"zone_id\".+/\1/g")
			curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$Record_IPv4_ID" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json"
		done
		# 增加 home 里的记录
		echo "开始增加 home 里的记录"
		for ip in ${Home_IPv4}; do
			curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
				-H "Authorization: Bearer $DDNS_API" \
				-H "Content-Type: application/json" \
				--data "{\"type\":\"A\",\"name\":\"${DOMAIN_sub}\",\"content\":\"$ip\",\"ttl\":1}"
		done
		NewIP=$(echo "${Home_IPv4}" | sed ':label;N;s/\n/\\n/;b label')
		echo -e "\nNewIPv4:$DOMAIN_sub: \n$NewIP"
		sleep_time
		#send_email
		sleep 2
		send_wechat
		sleep 2
	fi

}

UpdateIPv6() {

	# 判断 home 记录是否等于 dns 记录

	Same_No=0
	for i in ${Record_IPv6}; do
		for j in ${Home_IPv6}; do
			if [ $i == $j ]; then
				Same_No=$(($Same_No + 1))
				break
			fi
		done
	done

	if [ ${Record_IPv4_No} -eq ${Home_IPv4_No} -a ${Same_No} -eq ${Home_IPv4_No} ]; then
		echo "Home_IPv6_No: ${Home_IPv4_No}"
		echo "Record_IPv6_No: ${Record_IPv6_No}"
		echo "IPv6_Same_No: $Same_No"
		echo "记录完全相等，不用修改"
	else
		echo "home 记录与 dns 记录不一致"
		echo "开始修改记录"

		# 删除 dns 里的记录
		echo "开始删除 dns 里的记录"
		for ip in ${Record_IPv6}; do
			ID_json=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=AAAA&name=$DOMAIN_sub&content=$ip" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json")
			Record_IPv6_ID=$(echo $ID_json | sed -E "s/.+\"result\":\[\{\"id\":\"([a-f0-9]+)\",\"zone_id\".+/\1/g")
			curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$Record_IPv6_ID" -H "Authorization: Bearer $DDNS_API" -H "Content-Type: application/json"
		done
		# 增加 home 里的记录
		echo "开始增加 home 里的记录"
		for ip in ${Home_IPv6}; do
			curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
				-H "Authorization: Bearer $DDNS_API" \
				-H "Content-Type: application/json" \
				--data "{\"type\":\"AAAA\",\"name\":\"${DOMAIN_sub}\",\"content\":\"$ip\",\"ttl\":1}"
		done
		NewIP=$(echo "${Home_IPv6}" | sed ':label;N;s/\n/\\n/;b label')
		echo -e "\nNewIPv6:$DOMAIN_sub: \n$NewIP"

		sleep_time
		#send_email
		sleep 2
		send_wechat
		sleep 2
	fi

}

for DOMAIN_sub in ${DOMAIN}; do

	echo -e "\n============= ${DOMAIN_sub} Start ================="
	GetZoneID
	GetWanIPv4
	GetRecordIPv4
	UpdateIPv4
	GetWanIPv6
	GetRecordIPv6
	UpdateIPv6

done
