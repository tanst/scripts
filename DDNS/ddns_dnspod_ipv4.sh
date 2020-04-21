#!/bin/sh
#====IPv4=========#

#必须手动先创建一个任意A记录#

#===============personal config==============#
API_ID=123456
API_Token=b32g354g532g34h345g45ga35d3444d
SUBDOMAIN=@
DOMAIN=example.com

Email=admin@example.com
Email_title='The IP Changed.'
Email_sender='Router'
WCappToken=AT_DB8w1TG9LKJlHLhkPQpf72UlfD
WCuids=UID_bq3LJlkjLUlJLjlHJMfb3MhTK

#===========================================
CHECKURL_1=myip.ipip.net
CHECKURL_2=ipv4.ip.sb
CHECKURL_3=ipv4.icanhazip.com

#=============== system config ===============
DNSPOD_TOKEN="login_token=${API_ID},${API_Token}"
date
cd $(dirname $0)

#=============== function ===============
dnspod_send_email(){
	curl -k https://tanst.net/script/mail.php -X POST -d "event=the New ip is: $CURRENT_IP&title=$Email_title&email=$Email&sender=$Email_sender"
	echo -e "\033[1;32;40mEmail is sent succeededfully."
	exit
}

dnspod_send_wechat(){
    date=`date "+%Y-%m-%d %H:%M:%S"`
    JSON='{
      "appToken":"'$WCappToken'",
      "content":"'$Email_sender' 的IP地址已更改为：\n'$CURRENT_IP'\n时间：'$date'",
      "contentType":1,
      "uids":["'$WCuids'"]
    }'
    curl -k http://wxpusher.zjiecode.com/api/send/message -X POST -H "Content-Type: application/json" -d "${JSON}"
}

CURRENT_IP() {
    
	if type curl >/dev/null 2>&1; then
		echo "curl 已安装"
	else
		echo "curl 未安装"
		exit
	fi
	
	IPv4REX='[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}'
	CURRENT_IP=$(curl -k -s $CHECKURL_1 | grep -Eo "$IPv4REX")

	if test $CURRENT_IP 
	then
		echo "succeeded : $CHECKURL_1 获取公网IP正常"
		echo "CURRENT_IP : $CURRENT_IP"
	else
		echo "error : $CHECKURL_1 获取公网IP错误，请检查URL是否正常"
		CURRENT_IP=$(curl -k -s $CHECKURL_2 | grep -Eo "$IPv4REX" | sed -nr "$SEDREX")
		if test $CURRENT_IP 
		then
			echo "succeeded : $CHECKURL_2 获取公网IP正常"
			echo "CURRENT_IP : $CURRENT_IP"
		else
			echo "error : $CHECKURL_2 获取公网IP错误，请检查URL是否正常"
			CURRENT_IP=$(curl -k -s $CHECKURL_3 | grep -Eo "$IPv4REX" | sed -nr "$SEDREX")
			if test $CURRENT_IP 
			then
				echo "succeeded : $CHECKURL_3 获取公网IP正常"
				echo "CURRENT_IP : $CURRENT_IP"
			else
				echo "error : $CHECKURL_3 获取公网IP错误，请检查URL是否正常"
				exit
			fi
		fi
	fi
	
}

dnspod_record_ip() {

	Record_List="$(curl -s -k https://dnsapi.cn/Record.List -d "${DNSPOD_TOKEN}&format=json&record_type=A&domain=${DOMAIN}&sub_domain=${SUBDOMAIN}")"

	RECORD_IP=$(echo $Record_List | sed 's/.*,"value":"\([0-9\.]*\)".*/\1/')
	LINE_ID=$(echo $Record_List | sed 's/.*,"line_id":"\([0-9]*\)".*/\1/')
	STATUS_CODE=$(echo $Record_List | sed 's/.*{"code":"\([0-9]*\)".*/\1/')
	RECORD_ID=$(echo $Record_List | sed 's/.*\[{"id":"\([0-9]*\)".*/\1/')

	#echo "RECORD_IP: $RECORD_IP";
	#echo "RECORD_ID: $RECORD_ID";
	#echo "LINE_ID: $LINE_ID";
	#echo "STATUS_CODE: $STATUS_CODE";

	if [ "$STATUS_CODE" != "1" ]
	then echo "Error:Get DNSPOD API Error!";exit
	fi

	echo "RECORD_IP : $RECORD_IP"

}

dnspod_update() {

	if [ "$RECORD_IP" == "$CURRENT_IP" ]
	then
		echo "RECORD_IP = CURRENT_IP , SKIP UPDATE."
		exit
	fi

	echo Start DDNS update...

	Record_Ddns="$(curl -s -k -X POST https://dnsapi.cn/Record.Ddns -d "${DNSPOD_TOKEN}&record_id=${RECORD_ID}&record_line_id=${LINE_ID}&domain=${DOMAIN}&sub_domain=${SUBDOMAIN}&value=${CURRENT_IP}")"
	
	DDNS_RESULT=${Record_Ddns#*\<message\>};
	DDNS_RESULT=${DDNS_RESULT%%\</message\>*};
	echo -e "\033[1;32;40m$DDNS_RESULT"
	#echo -e "\033[字背景颜色;字体颜色m 字符串 \033[0m" 
	for line in $Record_Ddns;do
		if [ $(echo $line|grep '<value>' |wc -l) != 0 ];then
			Finale_IP=${line%<*};
			Finale_IP=${Finale_IP#*>};
			echo -e "\033[0mFinale_IP: \033[1;32;40m$Finale_IP";
		fi
	done

	dnspod_send_wechat
	dnspod_send_email

}

CURRENT_IP
dnspod_record_ip
dnspod_update
